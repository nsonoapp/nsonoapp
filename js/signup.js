import {
  db,
  doc,
  Timestamp,
  writeBatch,
  writeLog
} from "./firebase.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  setPersistence,
  browserLocalPersistence
} from "./auth.js";

import {
  ensureFirestoreUser,
  ensureSystemMeta,
  completeLogin,
  isAllowedRole,
  waitForAuthReady,
  authErrorMessage,
  validateCompanyAccess,
  assertUserCompanyMatch,
  isUserApproved
} from "./auth-flow.js";

import { initPasswordToggles } from "./password-toggle.js";
import { bindFormAction, bindActionButton } from "./utils/buttonManager.js";

const auth = getAuth();
const signupForm = document.getElementById("signupForm");
const googleSignupBtn = document.getElementById("googleSignupBtn");
const googleProvider = new GoogleAuthProvider();

initPasswordToggles();

bindFormAction(signupForm, async () => {
  const fullName = document.getElementById("fullName")?.value.trim();
  const email = document.getElementById("email")?.value.trim().toLowerCase();
  const password = document.getElementById("password")?.value;
  const isActive = document.getElementById("isActive")?.checked ?? true;
  const companyName = document.getElementById("companyName")?.value.trim();

  if (!fullName || !email || !password) {
    alert("Remplis tous les champs");
    return;
  }

  if (password.length < 6) {
    alert("Mot de passe trop court (6 caractères minimum)");
    return;
  }

  try {
    console.log("[signup] createUserWithEmailAndPassword", { email });
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await waitForAuthReady(auth, uid);
    console.log("[signup] Auth OK, uid:", uid);

    const { metaRef, usersCount, maxUsers } = await ensureSystemMeta();

    if (usersCount >= maxUsers) {
      await signOut(auth);
      throw new Error("user_limit");
    }

    const companyAccess = await validateCompanyAccess(companyName);
    if (!companyAccess.ok) {
      await signOut(auth);
      throw new Error(companyAccess.error || "company_credentials_required");
    }

    const nsonoFields = {};
    if (companyAccess.company) {
      nsonoFields.companyId = companyAccess.company.id;
      nsonoFields.entityId = null;
      nsonoFields.approvalStatus = "pending";
      nsonoFields.roleIds = [];
    }

    const batch = writeBatch(db);

    console.log("[signup] batch.set users/", uid);
    batch.set(doc(db, "users", uid), {
      userId: uid,
      name: fullName,
      email,
      role: "seller",
      isActive: companyAccess.company ? false : isActive,
      roleIds: [],
      createdAt: Timestamp.now(),
      ...nsonoFields
    });

    console.log("[signup] batch.update system/meta usersCount:", usersCount + 1);
    batch.update(metaRef, {
      usersCount: usersCount + 1
    });

    await batch.commit();
    console.log("[signup] batch.commit OK");

    await writeLog({
      userId: uid,
      action: "signup",
      details: {
        email,
        role: "seller",
        companyId: nsonoFields.companyId || null,
        approvalStatus: nsonoFields.approvalStatus || null
      }
    });

    await signOut(auth);
    if (nsonoFields.approvalStatus === "pending") {
      alert("Compte créé ! En attente d'approbation par un administrateur.");
    } else {
      alert("Compte créé ! Connectez-vous.");
    }
    window.location.replace("login.html");
  } catch (err) {
    console.error("[signup] erreur:", err?.code || err?.message, err);
    alert(authErrorMessage(err, "Erreur création compte"));
  }
});

bindActionButton(googleSignupBtn, async () => {
  try {
    await setPersistence(auth, browserLocalPersistence);

    const companyAccess = await validateCompanyAccess(
      document.getElementById("companyName")?.value.trim()
    );
    if (!companyAccess.ok) {
      throw new Error(companyAccess.error || "company_credentials_required");
    }

    console.log("[signup] signInWithPopup Google");
    const result = await signInWithPopup(auth, googleProvider);
    await waitForAuthReady(auth, result.user.uid);
    console.log("[signup] Google OK, uid:", result.user.uid);

    const isActive = document.getElementById("isActive")?.checked ?? true;
    const userData = await ensureFirestoreUser(result.user, {
      isActive,
      companyId: companyAccess.company?.id || null,
      entityId: null,
      approvalStatus: companyAccess.company ? "pending" : "approved"
    });

    if (userData?.approvalStatus === "rejected") {
      await signOut(auth);
      alert(authErrorMessage({ message: "approval_rejected" }));
      return;
    }

    if (!isUserApproved(userData)) {
      await signOut(auth);
      alert(authErrorMessage({ message: "approval_pending" }));
      return;
    }

    if (!userData?.isActive) {
      await signOut(auth);
      alert("Compte désactivé");
      return;
    }

    if (!isAllowedRole(userData.role)) {
      await signOut(auth);
      alert("Accès refusé : rôle non autorisé");
      return;
    }

    if (!assertUserCompanyMatch(userData, companyAccess.company)) {
      await signOut(auth);
      alert(authErrorMessage({ message: "company_mismatch" }));
      return;
    }

    await completeLogin(
      userData.userId || userData.id,
      userData.role,
      "google_signup",
      userData,
      companyAccess.company
    );
    window.location.replace("index.html");
  } catch (err) {
    console.error("[signup] Google erreur:", err?.code || err?.message, err);
    alert(authErrorMessage(err, "Erreur inscription Google"));
  }
});

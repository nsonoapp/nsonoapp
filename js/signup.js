import {
  writeLog
} from "./firebase.js";

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  deleteUser,
  setPersistence,
  browserLocalPersistence
} from "./auth.js";

import {
  createSignupUserProfile,
  ensureFirestoreUser,
  completeLogin,
  isAllowedRole,
  waitForAuthReady,
  authErrorMessage,
  validateCompanyAccess,
  assertUserCompanyMatch,
  isUserApproved,
  beginSignupFlow,
  endSignupFlow
} from "./auth-flow.js";

import { initPasswordToggles } from "./password-toggle.js";
import { bindFormAction, bindActionButton } from "./utils/buttonManager.js";

const auth = getAuth();
const signupForm = document.getElementById("signupForm");
const googleSignupBtn = document.getElementById("googleSignupBtn");
const googleProvider = new GoogleAuthProvider();

initPasswordToggles();

async function cleanupFailedSignup() {
  const user = auth.currentUser;
  if (!user) {
    return;
  }

  try {
    await deleteUser(user);
  } catch (deleteErr) {
    console.warn("[signup] nettoyage compte Auth:", deleteErr?.code || deleteErr?.message);
    await signOut(auth);
  }
}

bindFormAction(signupForm, async () => {
  const fullName = document.getElementById("fullName")?.value.trim();
  const email = document.getElementById("email")?.value.trim().toLowerCase();
  const password = document.getElementById("password")?.value;
  const companyName = document.getElementById("companyName")?.value.trim();
  const companyPassword = document.getElementById("companyPassword")?.value || "";
  const entityName = document.getElementById("entityName")?.value.trim();
  const entityPassword = document.getElementById("entityPassword")?.value || "";

  if (!fullName || !email || !password || !companyName || !companyPassword || !entityName || !entityPassword) {
    alert("Remplis tous les champs");
    return;
  }

  if (password.length < 6) {
    alert("Mot de passe trop court (6 caractères minimum)");
    return;
  }

  beginSignupFlow();
  try {
    console.log("[signup] createUserWithEmailAndPassword", { email });
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await waitForAuthReady(auth, uid);
    console.log("[signup] Auth OK, uid:", uid);

    const companyAccess = await validateCompanyAccess({
      companyIdentifier: companyName,
      companyPassword,
      entityIdentifier: entityName,
      entityPassword,
      userId: uid
    });
    if (!companyAccess.ok) {
      throw new Error(companyAccess.error || "company_credentials_required");
    }

    await createSignupUserProfile({
      uid,
      name: fullName,
      email,
      companyId: companyAccess.company.id,
      entityId: companyAccess.entity?.id || null
    });
    console.log("[signup] profil Firestore créé");

    await writeLog({
      userId: uid,
      action: "signup",
      details: {
        email,
        role: "user",
        companyId: companyAccess.company.id,
        entityId: companyAccess.entity?.id || null,
        approvalStatus: "pending"
      }
    });

    await signOut(auth);
    alert("Compte créé ! En attente d'approbation par un administrateur.");
    window.location.replace("login.html");
  } catch (err) {
    console.error("[signup] erreur:", err?.code || err?.message, err);
    if (auth.currentUser) {
      await cleanupFailedSignup();
    }
    alert(authErrorMessage(err, "Erreur lors de la création du compte"));
  } finally {
    endSignupFlow();
  }
});

bindActionButton(googleSignupBtn, async () => {
  const companyName = document.getElementById("companyName")?.value.trim();
  const companyPassword = document.getElementById("companyPassword")?.value || "";
  const entityName = document.getElementById("entityName")?.value.trim();
  const entityPassword = document.getElementById("entityPassword")?.value || "";

  if (!companyName || !companyPassword || !entityName || !entityPassword) {
    alert("Remplis tous les champs société et entité");
    return;
  }

  beginSignupFlow();
  try {
    await setPersistence(auth, browserLocalPersistence);

    console.log("[signup] signInWithPopup Google");
    const result = await signInWithPopup(auth, googleProvider);
    await waitForAuthReady(auth, result.user.uid);
    console.log("[signup] Google OK, uid:", result.user.uid);

    const companyAccess = await validateCompanyAccess({
      companyIdentifier: companyName,
      companyPassword,
      entityIdentifier: entityName,
      entityPassword,
      userId: result.user.uid
    });
    if (!companyAccess.ok) {
      throw new Error(companyAccess.error || "company_credentials_required");
    }

    const userData = await ensureFirestoreUser(result.user, {
      companyId: companyAccess.company?.id || null,
      entityId: companyAccess.entity?.id || null
    });

    if (userData?.approvalStatus === "rejected") {
      await signOut(auth);
      alert(authErrorMessage({ message: "approval_rejected" }));
      return;
    }

    if (!isUserApproved(userData)) {
      await signOut(auth);
      alert("Compte créé ! En attente d'approbation par un administrateur.");
      window.location.replace("login.html");
      return;
    }

    if (!userData?.isActive) {
      await signOut(auth);
      alert("Compte désactivé");
      return;
    }

    if (!isAllowedRole(userData.role)) {
      await signOut(auth);
      alert("Compte créé ! En attente d'approbation par un administrateur.");
      window.location.replace("login.html");
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
    if (auth.currentUser) {
      await cleanupFailedSignup();
    }
    alert(authErrorMessage(err, "Erreur lors de l'inscription Google"));
  } finally {
    endSignupFlow();
  }
});

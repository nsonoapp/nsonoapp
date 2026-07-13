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
const signupFeedbackEl = document.getElementById("signupFeedback");
const googleProvider = new GoogleAuthProvider();

initPasswordToggles();

function showSignupFeedback(message, isError = true) {
  if (!signupFeedbackEl) {
    alert(message);
    return;
  }
  signupFeedbackEl.textContent = message;
  signupFeedbackEl.classList.toggle("error", isError);
  signupFeedbackEl.classList.toggle("success", !isError);
  signupFeedbackEl.hidden = !message;
}

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

async function safeSignOut() {
  try {
    await signOut(auth);
  } catch (err) {
    console.warn("[signup] signOut ignoré:", err?.code || err?.message);
  }
}

function notifySignupError(err, fallback) {
  const message = authErrorMessage(err, fallback);
  showSignupFeedback(message);
  alert(message);
}

bindFormAction(signupForm, async () => {
  const fullName = document.getElementById("fullName")?.value.trim();
  const email = document.getElementById("email")?.value.trim().toLowerCase();
  const password = document.getElementById("password")?.value;
  const companyName = document.getElementById("companyName")?.value.trim();
  const companyPassword = document.getElementById("companyPassword")?.value || "";

  showSignupFeedback("");

  if (!fullName || !email || !password || !companyPassword) {
    showSignupFeedback("Remplissez tous les champs obligatoires.");
    return;
  }

  if (password.length < 6) {
    showSignupFeedback("Mot de passe trop court (6 caractères minimum).");
    return;
  }

  beginSignupFlow();
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const uid = userCredential.user.uid;
    await waitForAuthReady(auth, uid);

    const companyAccess = await validateCompanyAccess({
      companyIdentifier: companyName,
      companyPassword,
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
      entityId: null
    });

    await writeLog({
      userId: uid,
      action: "signup",
      details: {
        email,
        role: "user",
        companyId: companyAccess.company.id,
        approvalStatus: "pending"
      }
    });

    await safeSignOut();
    const successMsg = "Compte créé. En attente d'approbation par un administrateur.";
    showSignupFeedback(successMsg, false);
    alert(successMsg);
    window.location.replace("login.html");
  } catch (err) {
    console.error("[signup] erreur:", err?.code || err?.message, err);
    notifySignupError(err, "Création du compte impossible. Réessayez.");
    if (auth.currentUser) {
      await cleanupFailedSignup();
    }
  } finally {
    endSignupFlow();
  }
});

bindActionButton(googleSignupBtn, async () => {
  const companyName = document.getElementById("companyName")?.value.trim();
  const companyPassword = document.getElementById("companyPassword")?.value || "";

  showSignupFeedback("");

  if (!companyPassword) {
    showSignupFeedback("Le mot de passe société est requis.");
    return;
  }

  beginSignupFlow();
  try {
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, googleProvider);
    await waitForAuthReady(auth, result.user.uid);

    const companyAccess = await validateCompanyAccess({
      companyIdentifier: companyName,
      companyPassword,
      userId: result.user.uid
    });
    if (!companyAccess.ok) {
      throw new Error(companyAccess.error || "company_credentials_required");
    }

    const userData = await ensureFirestoreUser(result.user, {
      companyId: companyAccess.company?.id || null,
      entityId: null
    });

    if (userData?.approvalStatus === "rejected") {
      await safeSignOut();
      notifySignupError({ message: "approval_rejected" }, "Inscription refusée.");
      return;
    }

    if (!isUserApproved(userData)) {
      await safeSignOut();
      const successMsg = "Compte créé. En attente d'approbation par un administrateur.";
      showSignupFeedback(successMsg, false);
      alert(successMsg);
      window.location.replace("login.html");
      return;
    }

    if (!userData?.isActive) {
      await safeSignOut();
      showSignupFeedback("Compte désactivé. Contactez votre administrateur.");
      return;
    }

    if (!isAllowedRole(userData.role)) {
      await safeSignOut();
      const successMsg = "Compte créé. En attente d'approbation par un administrateur.";
      showSignupFeedback(successMsg, false);
      alert(successMsg);
      window.location.replace("login.html");
      return;
    }

    if (!assertUserCompanyMatch(userData, companyAccess.company)) {
      await safeSignOut();
      notifySignupError({ message: "company_mismatch" }, "Inscription impossible.");
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
    notifySignupError(err, "Inscription Google impossible.");
    if (auth.currentUser) {
      await cleanupFailedSignup();
    }
  } finally {
    endSignupFlow();
  }
});

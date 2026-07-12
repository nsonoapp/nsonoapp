import "./firebase.js";

import {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  getAuth,
  signOut,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence
} from "./auth.js";

import {
  isAllowedRole,
  loadUserProfile,
  completeLogin,
  ensureFirestoreUser,
  waitForAuthReady,
  authErrorMessage,
  validateCompanyAccess,
  assertUserCompanyMatch,
  isUserApproved
} from "./auth-flow.js";

import { initPasswordToggles } from "./password-toggle.js";
import { bindFormAction, bindActionButton } from "./utils/buttonManager.js";

const auth = getAuth();
const googleProvider = new GoogleAuthProvider();

const loginForm = document.getElementById("loginForm");
const emailInput = document.getElementById("email");
const passwordInput = document.getElementById("password");
const companyNameInput = document.getElementById("companyName");
const companyPasswordInput = document.getElementById("companyPassword");
const rememberMeCheckbox = document.getElementById("rememberMe");
const googleLoginBtn = document.getElementById("googleLoginBtn");
const loginFeedbackEl = document.getElementById("loginFeedback");

initPasswordToggles();

function showLoginFeedback(message, isError = true) {
  if (!loginFeedbackEl) {
    alert(message);
    return;
  }
  loginFeedbackEl.textContent = message;
  loginFeedbackEl.classList.toggle("error", isError);
  loginFeedbackEl.classList.toggle("success", !isError);
  loginFeedbackEl.hidden = !message;
}

async function resolveCompanyGate(userData, authUid = "") {
  const uid = authUid || userData?.userId || userData?.id || getAuth().currentUser?.uid || "";
  const companyIdentifier = companyNameInput?.value.trim() || "";
  const companyPassword = companyPasswordInput?.value || "";

  if (!companyPassword) {
    throw new Error("company_password_required");
  }

  const companyAccess = await validateCompanyAccess({
    companyIdentifier,
    companyPassword,
    userId: uid
  });

  if (!companyAccess.ok) {
    throw new Error(companyAccess.error || "company_credentials_required");
  }

  return companyAccess;
}

async function redirectAfterLogin(userData, action, companyAccess = null) {
  const company = companyAccess?.company || null;

  if (userData?.approvalStatus === "rejected") {
    await signOut(auth);
    showLoginFeedback(authErrorMessage({ message: "approval_rejected" }));
    return;
  }

  if (!isUserApproved(userData)) {
    localStorage.setItem("userId", userData.userId || userData.id || "");
    localStorage.setItem("userRole", userData.role || "user");
    window.location.replace("waiting.html");
    return;
  }

  if (!userData?.isActive) {
    await signOut(auth);
    showLoginFeedback("Compte désactivé. Contactez votre administrateur.");
    return;
  }

  if (!isAllowedRole(userData.role)) {
    localStorage.setItem("userId", userData.userId || userData.id || "");
    localStorage.setItem("userRole", userData.role || "user");
    window.location.replace("waiting.html");
    return;
  }

  if (!assertUserCompanyMatch(userData, company)) {
    await signOut(auth);
    showLoginFeedback(authErrorMessage({ message: "company_mismatch" }));
    return;
  }

  await completeLogin(userData.userId || userData.id, userData.role, action, userData, company);
  window.location.replace("index.html");
}

bindFormAction(loginForm, async () => {
  const email = emailInput?.value.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";

  showLoginFeedback("");

  if (!email || !password) {
    showLoginFeedback("Remplissez votre email et votre mot de passe.");
    return;
  }

  if (!companyPasswordInput?.value) {
    showLoginFeedback("Le mot de passe société est requis.");
    return;
  }

  try {
    await setPersistence(
      auth,
      rememberMeCheckbox?.checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await waitForAuthReady(auth, userCredential.user.uid);

    const userData = await loadUserProfile(userCredential.user.uid);

    if (!userData) {
      await signOut(auth);
      showLoginFeedback("Compte non configuré. Contactez votre administrateur.");
      return;
    }

    const companyAccess = await resolveCompanyGate(userData, userCredential.user.uid);
    await redirectAfterLogin(userData, "login", companyAccess);
  } catch (err) {
    console.error("[login] erreur:", err?.code || err?.message, err);
    showLoginFeedback(authErrorMessage(err, "Connexion impossible. Réessayez."));
  }
});

async function handleGoogleLogin() {
  showLoginFeedback("");

  if (!companyPasswordInput?.value) {
    showLoginFeedback("Le mot de passe société est requis.");
    return;
  }

  try {
    await setPersistence(auth, browserLocalPersistence);

    const result = await signInWithPopup(auth, googleProvider);
    await waitForAuthReady(auth, result.user.uid);

    let userData = await loadUserProfile(result.user.uid);

    if (!userData) {
      userData = await ensureFirestoreUser(result.user, { isActive: true });
    }

    const companyAccess = await resolveCompanyGate(userData, result.user.uid);
    await redirectAfterLogin(userData, "google_login", companyAccess);
  } catch (err) {
    console.error("[login] Google erreur:", err?.code || err?.message, err);
    showLoginFeedback(authErrorMessage(err, "Connexion Google impossible."));
  }
}

bindActionButton(googleLoginBtn, handleGoogleLogin);

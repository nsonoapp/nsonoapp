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
const entityNameInput = document.getElementById("entityName");
const entityPasswordInput = document.getElementById("entityPassword");
const rememberMeCheckbox = document.getElementById("rememberMe");
const googleLoginBtn = document.getElementById("googleLoginBtn");

initPasswordToggles();

async function resolveCompanyGate() {
  const companyAccess = await validateCompanyAccess({
    companyIdentifier: companyNameInput?.value.trim(),
    companyPassword: companyPasswordInput?.value || "",
    entityIdentifier: entityNameInput?.value.trim(),
    entityPassword: entityPasswordInput?.value || ""
  });

  if (!companyAccess.ok) {
    throw new Error(companyAccess.error || "company_credentials_required");
  }

  return companyAccess;
}

async function redirectAfterLogin(userData, action, companyAccess = null) {
  const company = companyAccess?.company || null;
  const entity = companyAccess?.entity || null;

  if (userData?.approvalStatus === "rejected") {
    await signOut(auth);
    alert(authErrorMessage({ message: "approval_rejected" }));
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
    alert("Compte désactivé");
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
    alert(authErrorMessage({ message: "company_mismatch" }));
    return;
  }

  if (entity?.id && userData?.entityId && userData.entityId !== entity.id) {
    await signOut(auth);
    alert("Ce compte n'appartient pas à cette entité.");
    return;
  }

  await completeLogin(userData.userId || userData.id, userData.role, action, userData, company);
  window.location.replace("index.html");
}

bindFormAction(loginForm, async () => {
  const email = emailInput?.value.trim().toLowerCase() || "";
  const password = passwordInput?.value || "";

  if (!email || !password) {
    alert("Remplis tous les champs");
    return;
  }

  try {
    await setPersistence(
      auth,
      rememberMeCheckbox?.checked
        ? browserLocalPersistence
        : browserSessionPersistence
    );

    console.log("[login] signInWithEmailAndPassword", { email });
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    await waitForAuthReady(auth, userCredential.user.uid);
    console.log("[login] Auth OK, uid:", userCredential.user.uid);

    console.log("[login] getDoc users/", userCredential.user.uid);
    const userData = await loadUserProfile(userCredential.user.uid);

    if (!userData) {
      await signOut(auth);
      alert("Utilisateur non configuré dans Firestore");
      return;
    }

    const companyAccess = await resolveCompanyGate();
    await redirectAfterLogin(userData, "login", companyAccess);
  } catch (err) {
    console.error("[login] erreur:", err?.code || err?.message, err);
    alert(authErrorMessage(err, "Erreur de connexion"));
  }
});

async function handleGoogleLogin() {
  try {
    await setPersistence(auth, browserLocalPersistence);

    console.log("[login] signInWithPopup Google");
    const result = await signInWithPopup(auth, googleProvider);
    await waitForAuthReady(auth, result.user.uid);
    console.log("[login] Google OK, uid:", result.user.uid);

    console.log("[login] getDoc users/", result.user.uid);
    let userData = await loadUserProfile(result.user.uid);

    if (!userData) {
      console.log("[login] profil absent → ensureFirestoreUser");
      userData = await ensureFirestoreUser(result.user, { isActive: true });
    }

    const companyAccess = await resolveCompanyGate();
    await redirectAfterLogin(userData, "google_login", companyAccess);
  } catch (err) {
    console.error("[login] Google erreur:", err?.code || err?.message, err);
    alert(authErrorMessage(err, "Erreur connexion Google"));
  }
}

bindActionButton(googleLoginBtn, handleGoogleLogin);

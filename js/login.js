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
import {
  getSingleCompany,
  isCompanyGeneralAdmin
} from "../admin/js/company-auth.js";

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
const entityFieldsGroup = document.getElementById("entityFieldsGroup");
const loginHintEl = document.getElementById("loginHint");

initPasswordToggles();

function setEntityFieldsRequired(required) {
  if (entityNameInput) {
    entityNameInput.required = required;
  }
  if (entityPasswordInput) {
    entityPasswordInput.required = required;
  }
  if (entityFieldsGroup) {
    entityFieldsGroup.classList.toggle("optional", !required);
  }
  if (loginHintEl) {
    loginHintEl.textContent = required
      ? "Mot de passe société (company_secrets) obligatoire. Entité + mot de passe entité (entity_secrets) obligatoires pour les comptes locaux hors admins généraux."
      : "Admin général : mot de passe société uniquement. Les champs entité sont ignorés.";
  }
}

setEntityFieldsRequired(true);

async function resolveCompanyGate(userData, authUid = "") {
  const uid = authUid || userData?.userId || userData?.id || getAuth().currentUser?.uid || "";
  const company = await getSingleCompany();
  const isMaster = isCompanyGeneralAdmin(company, uid);
  setEntityFieldsRequired(!isMaster);

  const companyIdentifier = companyNameInput?.value.trim() || "";
  const companyPassword = companyPasswordInput?.value || "";
  const entityIdentifier = entityNameInput?.value.trim() || "";
  const entityPassword = entityPasswordInput?.value || "";

  if (!companyPassword) {
    throw new Error("company_password_required");
  }

  if (!isMaster) {
    if (!entityIdentifier) {
      throw new Error("entity_required");
    }
    if (!entityPassword) {
      throw new Error("entity_password_required");
    }
  }

  const companyAccess = await validateCompanyAccess({
    companyIdentifier,
    companyPassword,
    entityIdentifier: isMaster ? "" : entityIdentifier,
    entityPassword: isMaster ? "" : entityPassword,
    userId: uid
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

  if (!companyAccess.isGeneralAdmin && entity?.id && userData?.entityId && userData.entityId !== entity.id) {
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

    const companyAccess = await resolveCompanyGate(userData, userCredential.user.uid);
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

    const companyAccess = await resolveCompanyGate(userData, result.user.uid);
    await redirectAfterLogin(userData, "google_login", companyAccess);
  } catch (err) {
    console.error("[login] Google erreur:", err?.code || err?.message, err);
    alert(authErrorMessage(err, "Erreur connexion Google"));
  }
}

bindActionButton(googleLoginBtn, handleGoogleLogin);

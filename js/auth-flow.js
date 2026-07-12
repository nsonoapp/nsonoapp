import {
  db,
  doc,
  getDoc,
  setDoc,
  Timestamp,
  writeLog,
  collection,
  query,
  limit,
  getDocs
} from "./firebase.js";
import { getAuth, signOut, onAuthStateChanged } from "./auth.js";
import {
  resolveCompanyAccess,
  storeCompanySession,
  clearCompanySession,
  hasSingleCompany,
  isCompanyGeneralAdmin,
  getSingleCompany
} from "../admin/js/company-auth.js";
import { setEntityContext } from "../admin/js/entity-context.js";
import {
  loadUserPermissions,
  clearPermissionsCache
} from "../admin/js/permissions.js";

const auth = getAuth();
let signupFlowActive = false;

export function beginSignupFlow() {
  signupFlowActive = true;
}

export function endSignupFlow() {
  signupFlowActive = false;
}

export function isSignupFlowActive() {
  return signupFlowActive;
}

export function isAllowedRole(role) {
  return role === "admin" || role === "seller";
}

export function storeSession(uid, role) {
  localStorage.setItem("userId", uid);
  localStorage.setItem("userRole", role);
}

export function waitForAuthReady(authInstance = auth, expectedUid = null) {
  return new Promise((resolve, reject) => {
    const tryResolve = user => {
      if (!user) {
        return false;
      }
      if (expectedUid && user.uid !== expectedUid) {
        return false;
      }
      resolve(user);
      return true;
    };

    if (tryResolve(authInstance.currentUser)) {
      return;
    }

    const timeoutId = setTimeout(() => {
      unsub();
      reject(new Error("auth_not_ready"));
    }, 15000);

    const unsub = onAuthStateChanged(authInstance, user => {
      if (tryResolve(user)) {
        clearTimeout(timeoutId);
        unsub();
      }
    });
  });
}

export async function ensureSystemMeta() {
  const metaRef = doc(db, "system", "meta");
  console.log("[auth-flow] getDoc system/meta");
  const metaSnap = await getDoc(metaRef);

  if (metaSnap.exists()) {
    const data = metaSnap.data();
    return {
      metaRef,
      usersCount: Number(data.usersCount) || 0
    };
  }

  console.log("[auth-flow] system/meta absent → création { usersCount: 0 }");
  const initial = { usersCount: 0 };
  await setDoc(metaRef, initial);
  return { metaRef, usersCount: 0 };
}

export async function loadUserProfile(uid) {
  console.log("[auth-flow] getDoc users/", uid);
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    console.log("[auth-flow] profil introuvable users/", uid);
    return null;
  }
  return { id: snap.id, ...snap.data() };
}

export async function hasActiveCompanies() {
  return hasSingleCompany();
}

export function isUserApproved(userData) {
  if (!userData?.approvalStatus) {
    return true;
  }
  return userData.approvalStatus === "approved";
}

export function clearNsonoSession() {
  localStorage.removeItem("userId");
  localStorage.removeItem("userRole");
  localStorage.removeItem("nsono_companyId");
  clearEntityContext();
  clearCompanySession();
  clearPermissionsCache();
}

export function applyNsonoSession(userData, company = null) {
  const uid = userData?.userId || userData?.id;
  const companyId = company?.id || userData?.companyId || null;
  const isGeneralAdmin = isCompanyGeneralAdmin(company, uid);

  setEntityContext({
    companyId,
    entityId: isGeneralAdmin ? null : (userData?.entityId || null),
    isMasterAdmin: isGeneralAdmin
  });

  if (company?.id) {
    storeCompanySession(company.id, company.name || "");
  } else if (companyId && userData?.companyName) {
    storeCompanySession(companyId, userData.companyName);
  }

  clearPermissionsCache();
}

export async function validateCompanyAccess(credentials = {}) {
  const hasCompanies = await hasActiveCompanies();
  if (!hasCompanies) {
    return { ok: false, error: "company_not_configured", company: null };
  }
  return resolveCompanyAccess(credentials);
}

export function assertUserCompanyMatch(userData, company) {
  if (!company || !userData?.companyId) {
    return true;
  }
  return userData.companyId === company.id;
}

export async function completeLogin(uid, role, action, userData = null, company = null) {
  storeSession(uid, role);
  if (userData) {
    applyNsonoSession(userData, company);
    await loadUserPermissions(uid);
    window.dispatchEvent(new CustomEvent("nsono:session-ready", { detail: { uid } }));
  }
  await writeLog({
    userId: uid,
    action,
    role,
    details: company?.id ? { companyId: company.id } : null
  });
}

export async function restoreNsonoSession(uid) {
  if (!uid) {
    return;
  }

  const userData = await loadUserProfile(uid);
  if (!userData) {
    return;
  }

  const company = await getSingleCompany().catch(() => null);
  const isGeneralAdmin = isCompanyGeneralAdmin(company, uid);
  const role = userData.role || "user";

  if (isAllowedRole(role) || isGeneralAdmin) {
    storeSession(uid, isAllowedRole(role) ? role : "admin");
  }

  applyNsonoSession(userData, company);
  await loadUserPermissions(uid);
  window.dispatchEvent(new CustomEvent("nsono:session-ready", { detail: { uid } }));
}

export async function createSignupUserProfile({
  uid,
  name,
  email,
  companyId = null,
  entityId = null
}) {
  console.log("[auth-flow] setDoc users/", uid);
  await setDoc(doc(db, "users", uid), {
    userId: uid,
    name,
    email,
    role: "user",
    isActive: false,
    roleIds: [],
    approvalStatus: "pending",
    companyId,
    entityId,
    createdAt: Timestamp.now()
  });
}

export async function ensureFirestoreUser(user, options = {}) {
  const uid = user.uid;

  await waitForAuthReady(auth, uid);

  const existing = await loadUserProfile(uid);
  if (existing) {
    return existing;
  }

  await createSignupUserProfile({
    uid,
    name: user.displayName || user.email?.split("@")[0] || "Utilisateur",
    email: (user.email || "").toLowerCase(),
    companyId: options.companyId || null,
    entityId: options.entityId || null
  });

  return loadUserProfile(uid);
}

export function authErrorMessage(err, fallback = "Erreur") {
  const message = err?.message || "";

  if (message === "meta_missing") {
    return "Configuration system/meta manquante.";
  }

  if (message === "auth_not_ready") {
    return "Session non prête après connexion. Réessayez.";
  }

  if (message === "company_required") {
    return "Nom de société requis.";
  }

  if (message === "company_not_configured") {
    return "Aucune société configurée. Contactez le support.";
  }

  if (message === "company_name_invalid") {
    return "Nom de société incorrect. Vérifiez auprès de votre administrateur.";
  }

  if (message === "company_not_found") {
    return "Nom de société incorrect. Vérifiez auprès de votre administrateur.";
  }

  if (message === "company_password_required") {
    return "Mot de passe société requis.";
  }

  if (message === "company_password_invalid") {
    return "Mot de passe société incorrect.";
  }

  if (message === "company_credentials_required") {
    return "Identifiants société incomplets.";
  }

  if (message === "entity_required") {
    return "Entité requise.";
  }

  if (message === "entity_not_found") {
    return "Entité introuvable. Vérifiez le nom saisi ou contactez l'administrateur.";
  }

  if (message === "entity_password_required") {
    return "Mot de passe entité requis.";
  }

  if (message === "entity_password_invalid") {
    return "Mot de passe entité incorrect.";
  }

  if (message === "company_mismatch") {
    return "Ce compte n'appartient pas à cette société.";
  }

  if (message === "approval_pending") {
    return "Compte en attente d'approbation par un administrateur.";
  }

  if (message === "approval_rejected") {
    return "Compte refusé par un administrateur.";
  }

  const code = err?.code || "";

  if (code === "auth/invalid-email") return "Email invalide";
  if (code === "auth/invalid-credential") return "Email ou mot de passe incorrect";
  if (code === "auth/user-disabled") return "Compte désactivé";
  if (code === "auth/email-already-in-use") return "Email déjà utilisé";
  if (code === "auth/weak-password") return "Mot de passe trop faible (6 caractères min.)";
  if (code === "auth/network-request-failed") return "Pas de connexion internet";
  if (code === "auth/too-many-requests") return "Trop de tentatives. Réessayez plus tard";
  if (code === "auth/popup-closed-by-user") return "Connexion Google annulée";
  if (code === "auth/popup-blocked") return "Popup bloquée par le navigateur";
  if (code === "auth/cancelled-popup-request") return "Connexion Google annulée";
  if (code === "permission-denied") return "Accès refusé. Réessayez ou contactez l'administrateur.";
  if (code === "already-exists") return "Ce compte existe déjà. Connectez-vous.";
  if (code === "meta_missing") return "Configuration système manquante.";

  if (message) {
    return message;
  }

  return fallback;
}

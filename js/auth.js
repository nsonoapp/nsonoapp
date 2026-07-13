// auth.js — Auth lié à la même instance Firebase que Firestore (firebase.js)

import { app, db, doc, getDoc } from "./firebase.js";
import { getSingleCompany, isCompanyGeneralAdmin } from "../admin/js/company-auth.js";

import {
  getAuth as getFirebaseAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  reload,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  connectAuthEmulator
} from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";

const auth = getFirebaseAuth(app);

const authPersistenceReady = setPersistence(auth, browserLocalPersistence).catch(err => {
  console.warn("[auth] persistance locale indisponible:", err?.code || err?.message || err);
});

export function waitForAuthPersistence() {
  return authPersistenceReady;
}

const PUBLIC_PAGES = new Set(["login.html", "signup.html", "waiting.html", "404.html"]);
const ADMIN_ONLY_PAGES = new Set([
  "stats.html",
  "admin.html",
  "entities.html",
  "roles.html",
  "approvals.html",
  "onboarding.html",
  "company.html",
  "settings.html",
  "logs.html"
]);
const MASTER_ONLY_PAGES = new Set(["admin/stats.html"]);
let authGuardStarted = false;

export function getAuth() {
  return auth;
}

function currentPageName() {
  return window.location.pathname.split("/").pop() || "index.html";
}

function isPublicPage(page) {
  return PUBLIC_PAGES.has(page);
}

function currentPath() {
  return window.location.pathname.replace(/^\//, "");
}

function isApprovedProfile(profile) {
  if (!profile) {
    return false;
  }
  if (!profile.approvalStatus) {
    return true;
  }
  return profile.approvalStatus === "approved";
}

function hasBusinessRole(profile) {
  return profile?.role === "admin" || profile?.role === "seller";
}

function redirectTo(path) {
  if (window.location.pathname.endsWith(path)) {
    return;
  }
  window.location.replace(path);
}

export async function signOut(authInstance = auth) {
  const { clearNsonoSession } = await import("./auth-flow.js");
  clearNsonoSession();
  await firebaseSignOut(authInstance);
}

function startAuthGuard() {
  if (authGuardStarted) {
    return;
  }
  authGuardStarted = true;

  onAuthStateChanged(auth, async () => {
    await authPersistenceReady;
    await auth.authStateReady();

    const user = auth.currentUser;
    const page = currentPageName();
    const path = currentPath();
    const publicPage = isPublicPage(page);

    if (!user) {
      if (!publicPage) {
        const { clearNsonoSession } = await import("./auth-flow.js");
        clearNsonoSession();
        redirectTo("login.html");
      }
      return;
    }

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (!profileSnap.exists()) {
      const { isSignupFlowActive } = await import("./auth-flow.js");
      if (publicPage || isSignupFlowActive()) {
        return;
      }
      await signOut(auth);
      redirectTo("login.html");
      return;
    }

    const profile = profileSnap.data();
    const company = await getSingleCompany().catch(() => null);
    const isGeneralAdmin = isCompanyGeneralAdmin(company, user.uid);
    const approved = isApprovedProfile(profile);
    const active = profile?.isActive === true;
    const allowedRole = hasBusinessRole(profile) || isGeneralAdmin;
    const allowedBusinessAccess = approved && active && allowedRole;

    if (allowedBusinessAccess) {
      try {
        const { restoreNsonoSession } = await import("./auth-flow.js");
        await restoreNsonoSession(user.uid);
      } catch {
        /* session NSONO optionnelle */
      }
    }

    if (page === "waiting.html") {
      if (allowedBusinessAccess) {
        redirectTo("index.html");
      }
      return;
    }

    if (!allowedBusinessAccess && !publicPage) {
      redirectTo("waiting.html");
      return;
    }

    const canAccessAdminPages = profile?.role === "admin" || isGeneralAdmin;
    if (ADMIN_ONLY_PAGES.has(page) && !canAccessAdminPages) {
      redirectTo("index.html");
      return;
    }

    if (MASTER_ONLY_PAGES.has(path) && !isGeneralAdmin) {
      redirectTo("admin/admin.html");
    }
  });
}

startAuthGuard();

export { auth };

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  updatePassword,
  updateProfile,
  deleteUser,
  EmailAuthProvider,
  reauthenticateWithCredential,
  sendEmailVerification,
  reload,
  GoogleAuthProvider,
  signInWithPopup,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
  inMemoryPersistence,
  connectAuthEmulator
};

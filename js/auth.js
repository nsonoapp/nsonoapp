// auth.js — Auth lié à la même instance Firebase que Firestore (firebase.js)

import { app, db, doc, getDoc } from "./firebase.js";

import {
  getAuth as getFirebaseAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
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
const PUBLIC_PAGES = new Set(["login.html", "signup.html", "waiting.html", "404.html"]);
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

function isApprovedProfile(profile) {
  if (!profile) {
    return false;
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

function startAuthGuard() {
  if (authGuardStarted) {
    return;
  }
  authGuardStarted = true;

  onAuthStateChanged(auth, async user => {
    const page = currentPageName();
    const publicPage = isPublicPage(page);

    if (!user) {
      if (!publicPage) {
        redirectTo("login.html");
      }
      return;
    }

    const profileSnap = await getDoc(doc(db, "users", user.uid));
    if (!profileSnap.exists()) {
      await signOut(auth);
      redirectTo("login.html");
      return;
    }

    const profile = profileSnap.data();
    const approved = isApprovedProfile(profile);
    const active = profile?.isActive === true;
    const allowedRole = hasBusinessRole(profile);
    const allowedBusinessAccess = approved && active && allowedRole;

    if (page === "waiting.html") {
      if (allowedBusinessAccess) {
        redirectTo("index.html");
      }
      return;
    }

    if (!allowedBusinessAccess && !publicPage) {
      redirectTo("waiting.html");
    }
  });
}

startAuthGuard();

export { auth };

export {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
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

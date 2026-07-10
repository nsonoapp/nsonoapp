import { getAuth, onAuthStateChanged, signOut } from "./auth.js";
import { db, doc, getDoc } from "./firebase.js";
import { isAllowedRole } from "./auth-flow.js";

const auth = getAuth();
const logoutBtn = document.getElementById("logoutBtn");
const POLL_MS = 5000;

function hasBusinessAccess(profile) {
  if (!profile) {
    return false;
  }
  const approved = !profile.approvalStatus || profile.approvalStatus === "approved";
  return approved && profile.isActive === true && isAllowedRole(profile.role);
}

async function checkApprovalStatus(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    return;
  }
  if (hasBusinessAccess(snap.data())) {
    window.location.replace("index.html");
  }
}

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("login.html");
  });
}

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }
  checkApprovalStatus(user.uid);
  const intervalId = setInterval(() => {
    if (!auth.currentUser) {
      clearInterval(intervalId);
      return;
    }
    checkApprovalStatus(auth.currentUser.uid);
  }, POLL_MS);
});

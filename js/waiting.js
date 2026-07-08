import { getAuth, onAuthStateChanged, signOut } from "./auth.js";

const auth = getAuth();
const logoutBtn = document.getElementById("logoutBtn");

if (logoutBtn) {
  logoutBtn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.replace("login.html");
  });
}

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("login.html");
  }
});

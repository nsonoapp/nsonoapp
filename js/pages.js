import { getAuth, onAuthStateChanged } from "./auth.js";
import { db, doc, getDoc } from "./firebase.js";
import { canAccessAdmin, loadUserPermissions } from "../admin/js/permissions.js";

const auth = getAuth();
const adminNavCard = document.getElementById("adminNavCard");

function go(page) {
  if (!page) return;
  window.location.href = page;
}

function blockAccess() {
  document.body.replaceChildren();
  document.body.style.background = "black";

  const div = document.createElement("div");
  div.style.color = "white";
  div.style.display = "flex";
  div.style.height = "100vh";
  div.style.alignItems = "center";
  div.style.justifyContent = "center";
  div.style.fontSize = "20px";
  div.textContent = "⛔ Accès refusé";

  document.body.appendChild(div);
}

async function getUserRole(uid) {
  const snap = await getDoc(doc(db, "users", uid));
  if (!snap.exists()) {
    return null;
  }
  return snap.data().role;
}

function unlockAdminNav(permissions) {
  if (!adminNavCard) {
    return;
  }
  if (!canAccessAdmin(permissions)) {
    adminNavCard.classList.add("locked");
    return;
  }
  adminNavCard.classList.remove("locked");
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    blockAccess();
    return;
  }

  const role = await getUserRole(user.uid);

  if (!role || (role !== "admin" && role !== "seller")) {
    blockAccess();
    return;
  }

  const permissions = await loadUserPermissions(user.uid);
  unlockAdminNav(permissions);

  document.querySelectorAll(".card").forEach(card => {
    card.addEventListener("click", () => {
      if (card.classList.contains("locked")) {
        return;
      }
      go(card.dataset.page);
    });
  });
});

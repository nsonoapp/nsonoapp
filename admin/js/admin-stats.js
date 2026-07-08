import { getAuth, onAuthStateChanged } from "../../js/auth.js";
import { isMasterAdmin } from "./entity-context.js";
import { canAccessAdmin, loadUserPermissions } from "./permissions.js";

const auth = getAuth();

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    location.replace("../login.html");
    return;
  }

  const permissions = await loadUserPermissions(user.uid);
  if (!isMasterAdmin() || !canAccessAdmin(permissions)) {
    location.replace("../index.html");
    return;
  }

  const title = document.querySelector("header h1, header h3");
  if (title) {
    title.textContent = "📈 Statistiques globales";
  }

  await import("../../js/stats.js");
});

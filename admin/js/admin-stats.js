import { getAuth, onAuthStateChanged } from "../../js/auth.js";
import { db, collection, getDocs } from "../../js/firebase.js";
import { isMasterAdmin } from "./entity-context.js";
import { canAccessAdmin, loadUserPermissions } from "./permissions.js";
import { setScopeEntityOverride } from "./query-scope.js";

const auth = getAuth();

function createFilterBox() {
  const filtersGrid = document.getElementById("filtersGrid");
  if (!filtersGrid || document.getElementById("entityFilter")) {
    return null;
  }

  const box = document.createElement("div");
  box.className = "filter-box";
  const label = document.createElement("label");
  label.setAttribute("for", "entityFilter");
  label.textContent = "Entité";
  const select = document.createElement("select");
  select.id = "entityFilter";

  const optAll = document.createElement("option");
  optAll.value = "all";
  optAll.textContent = "Toutes les entités";
  select.appendChild(optAll);

  box.append(label, select);
  filtersGrid.appendChild(box);
  return select;
}

async function initEntityFilter(userId) {
  const select = createFilterBox();
  if (!select) return;

  const entitiesSnap = await getDocs(collection(db, "entities"));

  entitiesSnap.docs.forEach(entityDoc => {
    const data = entityDoc.data();
    if (data.isActive === false) {
      return;
    }
    const option = document.createElement("option");
    option.value = entityDoc.id;
    option.textContent = data.name || entityDoc.id;
    select.appendChild(option);
  });

  setScopeEntityOverride(null);
  select.addEventListener("change", () => {
    const selected = String(select.value || "all");
    setScopeEntityOverride(selected === "all" ? null : selected);
    document.getElementById("applyFiltersBtn")?.click();
  });
}

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

  if (isMasterAdmin()) {
    await initEntityFilter(user.uid);
  } else {
    setScopeEntityOverride(null);
  }

  const { initBudgetMonitor } = await import("./budget-monitor.js");
  await initBudgetMonitor();

  await import("../../js/stats.js");
});

import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "../../js/firebase.js";
import { getAuth, onAuthStateChanged } from "../../js/auth.js";
import { isMasterAdmin } from "./entity-context.js";
import { canAccessAdmin, loadUserPermissions } from "./permissions.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

const auth = getAuth();
const list = document.getElementById("adminLogsList");
const sizeSelect = document.getElementById("adminLogsPageSize");
const entitySelect = document.getElementById("adminEntityFilter");
const actionInput = document.getElementById("adminLogAction");
const userInput = document.getElementById("adminLogUser");
const startInput = document.getElementById("adminLogStart");
const endInput = document.getElementById("adminLogEnd");
const applyBtn = document.getElementById("adminApplyLogFilters");
const loadMoreBtn = document.getElementById("adminLoadMoreLogs");

let multiplier = 1;

function toStartDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toEndDate(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function safeText(value, max = 120) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function parseLimit() {
  return Number(sizeSelect?.value || 50) === 100 ? 100 : 50;
}

function formatDate(v) {
  const date = v?.toDate?.() || (v?.seconds ? new Date(v.seconds * 1000) : null);
  return date ? date.toLocaleString("fr-FR") : "-";
}

async function loadEntities() {
  if (!entitySelect || !isMasterAdmin()) return;
  const snap = await getDocs(collection(db, "entities"));
  snap.docs.forEach(entity => {
    const data = entity.data();
    if (data.isActive === false) return;
    const option = document.createElement("option");
    option.value = entity.id;
    option.textContent = data.name || entity.id;
    entitySelect.appendChild(option);
  });
}

function buildQuery() {
  const constraints = [];

  const selectedEntity = String(entitySelect?.value || "all");
  if (selectedEntity !== "all") {
    constraints.push(where("entityId", "==", selectedEntity));
  }

  const action = safeText(actionInput?.value || "", 80);
  if (action) {
    constraints.push(where("action", "==", action));
  }

  const userId = safeText(userInput?.value || "", 80);
  if (userId) {
    constraints.push(where("userId", "==", userId));
  }

  const start = toStartDate(startInput?.value || "");
  const end = toEndDate(endInput?.value || "");
  if (start) {
    constraints.push(where("createdAt", ">=", Timestamp.fromDate(start)));
  }
  if (end) {
    constraints.push(where("createdAt", "<=", Timestamp.fromDate(end)));
  }

  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(parseLimit() * multiplier));
  return query(collection(db, "logs"), ...constraints);
}

function render(rows) {
  list.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.textContent = "Aucun log trouvé.";
    empty.style.padding = "12px";
    list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach(item => {
    const row = document.createElement("div");
    row.className = "finance-item";
    const left = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = safeText(item.action || "action_unknown");
    const meta = document.createElement("small");
    meta.style.display = "block";
    meta.style.color = "#666";
    meta.textContent = `User: ${safeText(item.userId)} • Entité: ${safeText(item.entityId) || "-"}`;
    const date = document.createElement("small");
    date.style.display = "block";
    date.style.color = "#999";
    date.textContent = formatDate(item.createdAt);
    left.append(title, meta, date);
    row.appendChild(left);
    fragment.appendChild(row);
  });
  list.appendChild(fragment);
}

async function loadLogs() {
  const snap = await getDocs(buildQuery());
  const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  render(rows);
}

bindActionButton(applyBtn, async () => {
  multiplier = 1;
  await loadLogs();
});

bindActionButton(loadMoreBtn, async () => {
  multiplier += 1;
  await loadLogs();
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("../login.html");
    return;
  }

  const permissions = await loadUserPermissions(user.uid);
  if (!canAccessAdmin(permissions)) {
    location.replace("../index.html");
    return;
  }
  await loadEntities();
  await loadLogs();
});

import {
  db,
  collection,
  getDocs,
  query,
  where,
  orderBy,
  limit,
  Timestamp
} from "./firebase.js";
import { getAuth, onAuthStateChanged } from "./auth.js";
import { getEntityContext } from "./nsono-scope.js";
import { loadUserPermissions, canAccessAdmin } from "../admin/js/permissions.js";
import { bindActionButton } from "./utils/buttonManager.js";

const auth = getAuth();

const logsList = document.getElementById("logsList");
const pageSizeSelect = document.getElementById("logsPageSize");
const startDateInput = document.getElementById("logsStartDate");
const endDateInput = document.getElementById("logsEndDate");
const actionInput = document.getElementById("logsActionFilter");
const userInput = document.getElementById("logsUserFilter");
const searchInput = document.getElementById("logsSearch");
const applyBtn = document.getElementById("applyLogsFiltersBtn");
const loadMoreBtn = document.getElementById("loadMoreLogsBtn");

let currentMultiplier = 1;
let loadedRows = [];

function safeText(value, max = 160) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function toDateStart(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(0, 0, 0, 0);
  return date;
}

function toDateEnd(value) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  date.setHours(23, 59, 59, 999);
  return date;
}

function formatDate(value) {
  const date = value?.toDate?.() || (value?.seconds ? new Date(value.seconds * 1000) : null);
  return date ? date.toLocaleString("fr-FR") : "-";
}

function getLimitValue() {
  const parsed = Number(pageSizeSelect?.value || 50);
  return parsed === 100 ? 100 : 50;
}

function buildQuery() {
  const ctx = getEntityContext();
  const constraints = [];

  if (ctx.companyId) {
    constraints.push(where("companyId", "==", ctx.companyId));
  }
  if (ctx.entityId) {
    constraints.push(where("entityId", "==", ctx.entityId));
  }

  const startDate = toDateStart(startDateInput?.value || "");
  const endDate = toDateEnd(endDateInput?.value || "");
  if (startDate) {
    constraints.push(where("createdAt", ">=", Timestamp.fromDate(startDate)));
  }
  if (endDate) {
    constraints.push(where("createdAt", "<=", Timestamp.fromDate(endDate)));
  }

  const action = safeText(actionInput?.value || "", 80);
  if (action) {
    constraints.push(where("action", "==", action));
  }

  const userId = safeText(userInput?.value || "", 80);
  if (userId) {
    constraints.push(where("userId", "==", userId));
  }

  constraints.push(orderBy("createdAt", "desc"));
  constraints.push(limit(getLimitValue() * currentMultiplier));
  return query(collection(db, "logs"), ...constraints);
}

function matchesSearch(item) {
  const text = safeText(searchInput?.value || "", 80).toLowerCase();
  if (!text) return true;
  const haystack = [
    item.action,
    item.userId,
    item.role,
    JSON.stringify(item.details || {})
  ].join(" ").toLowerCase();
  return haystack.includes(text);
}

function renderRows(rows) {
  logsList.replaceChildren();
  if (!rows.length) {
    const empty = document.createElement("div");
    empty.textContent = "Aucun log trouvé.";
    empty.style.padding = "16px";
    empty.style.color = "#666";
    logsList.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach(item => {
    const row = document.createElement("div");
    row.className = "finance-item";

    const left = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = safeText(item.action || "action_unknown", 120);
    const badge = document.createElement("span");
    badge.className = "badge badge-expense";
    badge.textContent = safeText(item.role || "role?", 16);
    title.appendChild(badge);

    const sub = document.createElement("small");
    sub.style.display = "block";
    sub.style.color = "#666";
    sub.textContent = `User: ${safeText(item.userId, 80)} • Cible: ${safeText(item.targetId, 80) || "-"}`;

    const dateEl = document.createElement("small");
    dateEl.style.display = "block";
    dateEl.style.color = "#999";
    dateEl.textContent = formatDate(item.createdAt);

    left.append(title, sub, dateEl);
    row.appendChild(left);
    fragment.appendChild(row);
  });

  logsList.appendChild(fragment);
}

async function loadLogs() {
  const snap = await getDocs(buildQuery());
  loadedRows = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(matchesSearch);
  renderRows(loadedRows);
}

bindActionButton(applyBtn, async () => {
  currentMultiplier = 1;
  await loadLogs();
});

bindActionButton(loadMoreBtn, async () => {
  currentMultiplier += 1;
  await loadLogs();
});

searchInput?.addEventListener("input", () => {
  renderRows(loadedRows.filter(matchesSearch));
});

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }
  const permissions = await loadUserPermissions(user.uid);
  if (!canAccessAdmin(permissions)) {
    location.replace("404.html");
    return;
  }
  await loadLogs();
});

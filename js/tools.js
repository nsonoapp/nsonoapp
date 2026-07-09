import {
  db,
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
  writeLog
} from "./firebase.js";
import { getAuth, onAuthStateChanged } from "./auth.js";
import { bindActionButton } from "./utils/buttonManager.js";
import { loadUserPermissions, hasScope } from "../admin/js/permissions.js";
import { withEntityScope } from "./nsono-scope.js";

const auth = getAuth();
let currentUserId = null;
let allTools = [];
let allUsers = [];

const toolSelect = document.getElementById("toolSelect");
const assigneeSelect = document.getElementById("assigneeSelect");
const assignmentPosition = document.getElementById("assignmentPosition");
const assignmentFilter = document.getElementById("toolAssignmentFilter");
const searchInput = document.getElementById("toolSearchInput");
const list = document.getElementById("toolsList");

function safeText(value, max = 120) {
  return String(value || "").trim().replace(/\s+/g, " ").slice(0, max);
}

function canAccessTools(permissions) {
  return hasScope("scope_tools", permissions) || hasScope("scope_admin", permissions);
}

function formatDate(v) {
  const d = v?.toDate?.() || (v?.seconds ? new Date(v.seconds * 1000) : null);
  return d ? d.toLocaleString("fr-FR") : "-";
}

function fillToolSelect() {
  if (!toolSelect) return;
  toolSelect.replaceChildren();
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Choisir un outil";
  toolSelect.appendChild(defaultOption);

  allTools.forEach(tool => {
    const option = document.createElement("option");
    option.value = tool.id;
    option.textContent = `${tool.name || "Sans nom"} (${tool.variant || "standard"})`;
    toolSelect.appendChild(option);
  });
}

function fillAssigneeSelect() {
  if (!assigneeSelect) return;
  assigneeSelect.replaceChildren();

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.textContent = "Choisir employé";
  assigneeSelect.appendChild(defaultOption);

  allUsers.forEach(user => {
    const option = document.createElement("option");
    option.value = user.id;
    option.textContent = `${user.name || user.email || user.id} (${user.role || "user"})`;
    assigneeSelect.appendChild(option);
  });
}

function getFilteredTools() {
  const mode = assignmentFilter?.value || "all";
  const queryText = safeText(searchInput?.value || "", 80).toLowerCase();
  return allTools.filter(tool => {
    const assigned = Boolean(safeText(tool.assignedToUserId));
    if (mode === "assigned" && !assigned) return false;
    if (mode === "unassigned" && assigned) return false;

    if (!queryText) return true;
    const haystack = [
      tool.name,
      tool.variant,
      tool.assignedToName,
      tool.assignedPosition
    ].map(v => safeText(v).toLowerCase()).join(" ");
    return haystack.includes(queryText);
  });
}

function render() {
  if (!list) return;
  const rows = getFilteredTools();
  list.replaceChildren();

  if (!rows.length) {
    const empty = document.createElement("div");
    empty.textContent = "Aucun outil trouvé.";
    empty.style.padding = "14px";
    empty.style.color = "#666";
    list.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  rows.forEach(tool => {
    const item = document.createElement("div");
    item.className = "finance-item";

    const left = document.createElement("div");
    const title = document.createElement("strong");
    title.textContent = `${tool.name || "Sans nom"} ${tool.variant ? `(${tool.variant})` : ""}`;
    left.appendChild(title);

    const sub = document.createElement("small");
    const assignedTo = safeText(tool.assignedToName) || "Non affecté";
    const pos = safeText(tool.assignedPosition);
    sub.textContent = pos ? `Affecté à ${assignedTo} • Poste: ${pos}` : `Affecté à ${assignedTo}`;
    sub.style.display = "block";
    sub.style.color = safeText(tool.assignedToUserId) ? "#0B3D2E" : "#666";
    left.appendChild(sub);

    const meta = document.createElement("small");
    meta.textContent = `Maj: ${formatDate(tool.assignmentUpdatedAt)} • Stock: ${Number(tool.stock_current || 0)}`;
    meta.style.display = "block";
    meta.style.color = "#999";
    left.appendChild(meta);

    item.appendChild(left);
    fragment.appendChild(item);
  });

  list.appendChild(fragment);
}

async function loadTools() {
  const snap = await getDocs(collection(db, "products"));
  allTools = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(p => p.isActive !== false && p.stockType === "tools");
  fillToolSelect();
  render();
}

async function loadUsers() {
  const snap = await getDocs(collection(db, "users"));
  allUsers = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(u => u.isActive && u.approvalStatus === "approved");
  fillAssigneeSelect();
}

async function assignTool() {
  const toolId = safeText(toolSelect?.value || "", 80);
  const userId = safeText(assigneeSelect?.value || "", 80);
  const position = safeText(assignmentPosition?.value || "", 80);
  if (!toolId || !userId) {
    alert("Outil et employé requis.");
    return;
  }
  const user = allUsers.find(u => u.id === userId);
  if (!user) {
    alert("Employé invalide.");
    return;
  }

  const payload = withEntityScope({
    assignedToUserId: user.id,
    assignedToName: safeText(user.name || user.email || user.id, 80),
    assignedRole: safeText(user.role || "user", 30),
    assignedPosition: position || null,
    assignmentUpdatedAt: Timestamp.now(),
    assignmentUpdatedBy: currentUserId
  });
  await updateDoc(doc(db, "products", toolId), payload);
  await writeLog({
    userId: currentUserId,
    action: "tool_assign",
    targetId: toolId,
    details: {
      assignedToUserId: user.id,
      assignedPosition: position || null
    }
  });

  assignmentPosition.value = "";
  await loadTools();
}

async function clearToolAssignment() {
  const toolId = safeText(toolSelect?.value || "", 80);
  if (!toolId) {
    alert("Choisis un outil.");
    return;
  }
  await updateDoc(doc(db, "products", toolId), {
    assignedToUserId: null,
    assignedToName: null,
    assignedRole: null,
    assignedPosition: null,
    assignmentUpdatedAt: Timestamp.now(),
    assignmentUpdatedBy: currentUserId
  });
  await writeLog({
    userId: currentUserId,
    action: "tool_unassign",
    targetId: toolId
  });
  await loadTools();
}

assignmentFilter?.addEventListener("change", render);
searchInput?.addEventListener("input", render);
bindActionButton(document.getElementById("assignToolBtn"), assignTool);
bindActionButton(document.getElementById("clearAssignmentBtn"), clearToolAssignment);

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.replace("login.html");
    return;
  }
  currentUserId = user.uid;
  const permissions = await loadUserPermissions(user.uid);
  if (!canAccessTools(permissions)) {
    location.replace("404.html");
    return;
  }
  await loadUsers();
  await loadTools();
});

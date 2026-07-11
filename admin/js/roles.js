import {
  db,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  Timestamp,
  writeLog
} from "../../js/firebase.js";
import {
  guardAdminPage,
  renderContextBanner,
  notifyAdmin,
  sanitizeText,
  bindListActions,
  createTextEl,
  formatAdminDate
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { KNOWN_SCOPES } from "./admin-constants.js";
import { getEntityContext } from "./entity-context.js";
import { hasScope, clearPermissionsCache } from "./permissions.js";
import { applyEntityScope } from "./query-scope.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

let currentUserId = null;
let permissions = null;
let roles = [];
let selectedScopes = new Set();

const listEl = document.getElementById("rolesList");
const nameInput = document.getElementById("roleName");
const scopesBox = document.getElementById("scopesBox");

function renderScopeCheckboxes() {
  if (!scopesBox) {
    return;
  }
  scopesBox.replaceChildren();

  KNOWN_SCOPES.forEach(scope => {
    const label = document.createElement("label");
    label.className = "scope-chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = scope.id;
    input.checked = selectedScopes.has(scope.id);
    input.addEventListener("change", () => {
      if (input.checked) {
        selectedScopes.add(scope.id);
      } else {
        selectedScopes.delete(scope.id);
      }
    });

    const text = document.createElement("span");
    text.textContent = scope.label;

    label.append(input, text);
    scopesBox.appendChild(label);
  });
}

async function loadRoles() {
  const constraints = applyEntityScope([]);
  const snap = await getDocs(query(collection(db, ADMIN_COLLECTIONS.roles), ...constraints));
  roles = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  renderList();
}

function renderList() {
  bindListActions(listEl, roles, item => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const main = document.createElement("div");
    const title = createTextEl("strong", item.name || "Sans nom");
    const scopes = (item.scopes || []).join(", ") || "—";
    const meta = createTextEl(
      "span",
      `${scopes} • ${item.isActive === false ? "Inactif" : "Actif"} • ${formatAdminDate(item.createdAt)}`
    );
    meta.className = "admin-meta";
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (hasScope("scope_roles", permissions)) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.textContent = item.isActive === false ? "Activer" : "Désactiver";
      bindActionButton(toggleBtn, () => toggleRole(item));
      actions.appendChild(toggleBtn);
    }

    row.append(main, actions);
    return row;
  });
}

async function toggleRole(item) {
  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.roles, item.id), {
      isActive: item.isActive === false,
      updatedAt: Timestamp.now()
    });
    clearPermissionsCache();
    await writeLog({
      userId: currentUserId,
      action: "role_status_update",
      targetId: item.id,
      details: { isActive: item.isActive === false }
    });
    await loadRoles();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la mise à jour du rôle.", true);
  }
}

async function createRole() {
  const ctx = getEntityContext();
  const companyId = ctx.companyId || SINGLE_COMPANY_ID;

  const name = sanitizeText(nameInput?.value, 80);
  if (!name) {
    notifyAdmin("adminDebug", "Nom du rôle requis.", true);
    return;
  }

  const scopes = Array.from(selectedScopes);
  if (!scopes.length) {
    notifyAdmin("adminDebug", "Sélectionnez au moins un scope.", true);
    return;
  }

  try {
    const ref = await addDoc(collection(db, ADMIN_COLLECTIONS.roles), {
      companyId,
      entityId: ctx.isMasterAdmin ? null : ctx.entityId,
      name,
      scopes,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
      createdBy: currentUserId
    });

    await writeLog({
      userId: currentUserId,
      action: "role_create",
      targetId: ref.id,
      details: { name, scopes }
    });

    if (nameInput) nameInput.value = "";
    selectedScopes = new Set();
    renderScopeCheckboxes();
    notifyAdmin("adminDebug", "Rôle créé.");
    await loadRoles();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la création du rôle.", true);
  }
}

guardAdminPage("scope_roles").then(async result => {
  currentUserId = result.user.uid;
  permissions = result.permissions;
  await renderContextBanner();
  renderScopeCheckboxes();
  await loadRoles();
});

bindActionButton(document.getElementById("createRoleBtn"), createRole);

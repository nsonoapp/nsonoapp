import {
  db,
  collection,
  addDoc,
  updateDoc,
  doc,
  getDocs,
  query,
  where,
  Timestamp,
  writeLog
} from "../../js/firebase.js";
import {
  guardAdminPage,
  renderContextBanner,
  showMessage,
  sanitizeText,
  bindListActions,
  createTextEl,
  formatAdminDate
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { getEntityContext } from "./entity-context.js";
import { hasScope } from "./permissions.js";
import { applyEntityScope } from "./query-scope.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

let currentUserId = null;
let permissions = null;
let entities = [];

const listEl = document.getElementById("entitiesList");
const nameInput = document.getElementById("entityName");
const adminIdInput = document.getElementById("entityAdminId");

async function loadEntities() {
  const constraints = applyEntityScope([]);
  const snap = await getDocs(query(collection(db, ADMIN_COLLECTIONS.entities), ...constraints));
  entities = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  renderList();
}

function renderList() {
  bindListActions(listEl, entities, item => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const main = document.createElement("div");
    const title = createTextEl("strong", item.name || "Sans nom");
    const meta = createTextEl(
      "span",
      `Admin: ${item.adminId || "—"} • ${item.isActive === false ? "Inactive" : "Active"} • ${formatAdminDate(item.createdAt)}`
    );
    meta.className = "admin-meta";
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (hasScope("scope_entities", permissions)) {
      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.textContent = item.isActive === false ? "Activer" : "Désactiver";
      bindActionButton(toggleBtn, () => toggleEntity(item));
      actions.appendChild(toggleBtn);
    }

    row.append(main, actions);
    return row;
  });
}

async function toggleEntity(item) {
  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.entities, item.id), {
      isActive: item.isActive === false,
      updatedAt: Timestamp.now()
    });
    await writeLog({
      userId: currentUserId,
      action: "entity_status_update",
      targetId: item.id,
      details: { isActive: item.isActive === false }
    });
    await loadEntities();
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de la mise à jour de l'entité.", true);
  }
}

async function createEntity() {
  const ctx = getEntityContext();
  const companyId = ctx.companyId || SINGLE_COMPANY_ID;

  const name = sanitizeText(nameInput?.value, 80);
  const adminId = sanitizeText(adminIdInput?.value, 128);

  if (!name) {
    showMessage("adminDebug", "Nom d'entité requis.", true);
    return;
  }

  try {
    const ref = await addDoc(collection(db, ADMIN_COLLECTIONS.entities), {
      companyId,
      name,
      adminId: adminId || null,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });

    await writeLog({
      userId: currentUserId,
      action: "entity_create",
      targetId: ref.id,
      details: { name }
    });

    if (nameInput) nameInput.value = "";
    if (adminIdInput) adminIdInput.value = "";
    showMessage("adminDebug", "Entité créée.");
    await loadEntities();
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de la création.", true);
  }
}

guardAdminPage("scope_entities").then(async result => {
  currentUserId = result.user.uid;
  permissions = result.permissions;
  renderContextBanner();
  await loadEntities();
});

bindActionButton(document.getElementById("createEntityBtn"), createEntity);

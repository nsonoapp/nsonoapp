import {
  db,
  collection,
  addDoc,
  updateDoc,
  doc,
  setDoc,
  getDoc,
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
  formatAdminDate,
  cacheEntityName
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { getEntityContext } from "./entity-context.js";
import { hasScope } from "./permissions.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";
import { hashCompanyPassword } from "./company-auth.js";
import { APPROVAL_STATUS } from "./admin-constants.js";

let currentUserId = null;
let permissions = null;
let entities = [];
let approvedUsers = [];

const listEl = document.getElementById("entitiesList");
const nameInput = document.getElementById("entityName");
const adminSelect = document.getElementById("entityAdminSelect");
const entityPasswordInput = document.getElementById("entityPassword");
const createEntityBox = document.getElementById("createEntityBox");

const editModal = document.getElementById("entityEditModal");
const editEntityIdInput = document.getElementById("editEntityId");
const editEntityNameInput = document.getElementById("editEntityName");
const editEntityAdminSelect = document.getElementById("editEntityAdminSelect");
const editEntityPasswordInput = document.getElementById("editEntityPassword");

function fillAdminSelect(selectEl, selectedId = "") {
  if (!selectEl) {
    return;
  }
  selectEl.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "Admin entité (optionnel)";
  selectEl.appendChild(defaultOpt);

  approvedUsers.forEach(user => {
    const opt = document.createElement("option");
    opt.value = user.id;
    const label = user.name || user.email || user.id;
    opt.textContent = `${label} (${user.id.slice(0, 8)}…)`;
    if (user.id === selectedId) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

function fillEditAdminSelect(selectedId = "") {
  if (!editEntityAdminSelect) {
    return;
  }
  editEntityAdminSelect.replaceChildren();
  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = "— Aucun —";
  editEntityAdminSelect.appendChild(defaultOpt);

  approvedUsers.forEach(user => {
    const opt = document.createElement("option");
    opt.value = user.id;
    const label = user.name || user.email || user.id;
    opt.textContent = `${label} (${user.id.slice(0, 8)}…)`;
    if (user.id === selectedId) {
      opt.selected = true;
    }
    editEntityAdminSelect.appendChild(opt);
  });
}

async function loadApprovedUsers() {
  const snap = await getDocs(query(
    collection(db, ADMIN_COLLECTIONS.users),
    where("companyId", "==", SINGLE_COMPANY_ID),
    where("approvalStatus", "==", APPROVAL_STATUS.approved),
    where("isActive", "==", true)
  ));
  approvedUsers = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  fillAdminSelect(adminSelect);
}

async function loadEntities() {
  const ctx = getEntityContext();

  if (ctx.isMasterAdmin) {
    const snap = await getDocs(query(
      collection(db, ADMIN_COLLECTIONS.entities),
      where("companyId", "==", SINGLE_COMPANY_ID)
    ));
    entities = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  } else if (ctx.entityId) {
    const snap = await getDoc(doc(db, ADMIN_COLLECTIONS.entities, ctx.entityId));
    entities = snap.exists() ? [{ id: snap.id, ...snap.data() }] : [];
    if (createEntityBox) {
      createEntityBox.hidden = true;
    }
  } else {
    entities = [];
  }

  entities.forEach(item => cacheEntityName(item.id, item.name));
  renderList();
}

function adminDisplayName(adminId) {
  if (!adminId) {
    return "—";
  }
  const user = approvedUsers.find(u => u.id === adminId);
  return user ? (user.name || user.email || adminId) : adminId;
}

function renderList() {
  bindListActions(listEl, entities, item => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const main = document.createElement("div");
    const title = createTextEl("strong", item.name || "Sans nom");
    const meta = createTextEl(
      "span",
      `Admin: ${adminDisplayName(item.adminId)} • ${item.isActive === false ? "Inactive" : "Active"} • ${formatAdminDate(item.createdAt)}`
    );
    meta.className = "admin-meta";
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (hasScope("scope_entities", permissions)) {
      const editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.textContent = "Modifier";
      bindActionButton(editBtn, () => openEditModal(item));

      const toggleBtn = document.createElement("button");
      toggleBtn.type = "button";
      toggleBtn.textContent = item.isActive === false ? "Activer" : "Désactiver";
      bindActionButton(toggleBtn, () => toggleEntity(item));

      actions.append(editBtn, toggleBtn);
    }

    row.append(main, actions);
    return row;
  });
}

function openEditModal(item) {
  if (!editModal) {
    return;
  }
  if (editEntityIdInput) {
    editEntityIdInput.value = item.id;
  }
  if (editEntityNameInput) {
    editEntityNameInput.value = item.name || "";
  }
  if (editEntityPasswordInput) {
    editEntityPasswordInput.value = "";
  }
  fillEditAdminSelect(item.adminId || "");
  editModal.classList.add("show");
  editModal.setAttribute("aria-hidden", "false");
}

function closeEditModal() {
  if (!editModal) {
    return;
  }
  editModal.classList.remove("show");
  editModal.setAttribute("aria-hidden", "true");
}

async function syncEntityAdminUser(entityId, adminId, previousAdminId) {
  if (previousAdminId && previousAdminId !== adminId) {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.users, previousAdminId), {
      updatedAt: Timestamp.now()
    }).catch(() => null);
  }

  if (!adminId) {
    return;
  }

  await updateDoc(doc(db, ADMIN_COLLECTIONS.users, adminId), {
    entityId,
    companyId: SINGLE_COMPANY_ID,
    role: "admin",
    updatedAt: Timestamp.now()
  });
}

async function saveEntityEdit() {
  const entityId = editEntityIdInput?.value;
  const name = sanitizeText(editEntityNameInput?.value, 80);
  const adminId = editEntityAdminSelect?.value || null;
  const newPassword = String(editEntityPasswordInput?.value || "");

  if (!entityId || !name) {
    showMessage("adminDebug", "Nom d'entité requis.", true);
    return;
  }

  if (newPassword && newPassword.length < 6) {
    showMessage("adminDebug", "Mot de passe entité : 6 caractères minimum.", true);
    return;
  }

  const existing = entities.find(e => e.id === entityId);
  const previousAdminId = existing?.adminId || null;

  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.entities, entityId), {
      name,
      adminId,
      updatedAt: Timestamp.now()
    });

    if (newPassword) {
      const passwordHash = await hashCompanyPassword(newPassword);
      await setDoc(doc(db, ADMIN_COLLECTIONS.entitySecrets, entityId), {
        companyId: SINGLE_COMPANY_ID,
        entityId,
        passwordHash,
        updatedAt: Timestamp.now()
      });
    }

    await syncEntityAdminUser(entityId, adminId, previousAdminId);

    await writeLog({
      userId: currentUserId,
      action: "entity_update",
      targetId: entityId,
      details: { name, passwordRotated: Boolean(newPassword) }
    });

    closeEditModal();
    showMessage("adminDebug", "Entité mise à jour.");
    await loadEntities();
    await renderContextBanner();
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de la mise à jour.", true);
  }
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
  const adminId = adminSelect?.value || null;
  const entityPassword = String(entityPasswordInput?.value || "");

  if (!name) {
    showMessage("adminDebug", "Nom d'entité requis.", true);
    return;
  }

  if (entityPassword.length < 6) {
    showMessage("adminDebug", "Mot de passe entité requis (6 caractères minimum).", true);
    return;
  }

  try {
    const entityPasswordHash = await hashCompanyPassword(entityPassword);
    const ref = await addDoc(collection(db, ADMIN_COLLECTIONS.entities), {
      companyId,
      name,
      adminId: adminId || null,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await setDoc(doc(db, ADMIN_COLLECTIONS.entitySecrets, ref.id), {
      companyId,
      entityId: ref.id,
      passwordHash: entityPasswordHash,
      updatedAt: Timestamp.now()
    });

    if (adminId) {
      await syncEntityAdminUser(ref.id, adminId, null);
    }

    await writeLog({
      userId: currentUserId,
      action: "entity_create",
      targetId: ref.id,
      details: { name }
    });

    if (nameInput) {
      nameInput.value = "";
    }
    if (adminSelect) {
      adminSelect.value = "";
    }
    if (entityPasswordInput) {
      entityPasswordInput.value = "";
    }
    showMessage("adminDebug", "Entité créée.");
    await loadEntities();
    await renderContextBanner();
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de la création.", true);
  }
}

guardAdminPage("scope_entities").then(async result => {
  currentUserId = result.user.uid;
  permissions = result.permissions;
  await loadApprovedUsers();
  await renderContextBanner();
  await loadEntities();
});

bindActionButton(document.getElementById("createEntityBtn"), createEntity);
bindActionButton(document.getElementById("saveEntityEditBtn"), saveEntityEdit);
bindActionButton(document.getElementById("closeEntityEditBtn"), closeEditModal);

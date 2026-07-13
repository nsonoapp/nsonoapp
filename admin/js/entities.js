import {
  db,
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
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
  notifyAdmin,
  sanitizeText,
  bindListActions,
  createTextEl,
  formatAdminDate,
  cacheEntityName,
  createCopyButton,
  confirmDangerAction,
  confirmTripleDangerAction
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { getEntityContext, isMasterAdmin, setEntityContext } from "./entity-context.js";
import { hasScope } from "./permissions.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";
import { hashCompanyPassword, getSingleCompany, isCompanyGeneralAdmin, verifyEntityPasswordViaRules } from "./company-auth.js";
import { APPROVAL_STATUS } from "./admin-constants.js";
import { getEntitySettingsId } from "../../js/services/settingsService.js";

let currentUserId = null;
let permissions = null;
let entities = [];
let approvedAdmins = [];

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
const editEntityPasswordConfirmInput = document.getElementById("editEntityPasswordConfirm");

async function resolveMasterAccess(uid) {
  if (isMasterAdmin()) {
    return true;
  }
  const company = await getSingleCompany().catch(() => null);
  return isCompanyGeneralAdmin(company, uid);
}

function fillAdminSelect(selectEl, selectedId = "", required = false) {
  if (!selectEl) {
    return;
  }
  selectEl.replaceChildren();

  const defaultOpt = document.createElement("option");
  defaultOpt.value = "";
  defaultOpt.textContent = required
    ? "Choisir un administrateur"
    : "— Aucun —";
  selectEl.appendChild(defaultOpt);

  approvedAdmins.forEach(user => {
    const opt = document.createElement("option");
    opt.value = user.id;
    opt.textContent = user.name || user.email || user.id;
    if (user.id === selectedId) {
      opt.selected = true;
    }
    selectEl.appendChild(opt);
  });
}

function fillEditAdminSelect(selectedId = "") {
  fillAdminSelect(editEntityAdminSelect, selectedId, true);
}

function filterApprovedAdmins(docs) {
  return docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(user =>
      user.role === "admin" &&
      user.approvalStatus === APPROVAL_STATUS.approved &&
      user.isActive !== false &&
      (!user.companyId || user.companyId === SINGLE_COMPANY_ID)
    )
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

async function loadApprovedAdmins() {
  let snap;
  try {
    snap = await getDocs(query(
      collection(db, ADMIN_COLLECTIONS.users),
      where("role", "==", "admin"),
      where("approvalStatus", "==", APPROVAL_STATUS.approved)
    ));
  } catch {
    snap = await getDocs(collection(db, ADMIN_COLLECTIONS.users));
  }

  approvedAdmins = filterApprovedAdmins(snap.docs);
  fillAdminSelect(adminSelect, "", true);
}

async function loadEntities() {
  const master = await resolveMasterAccess(currentUserId);

  if (master && !isMasterAdmin()) {
    setEntityContext({
      companyId: SINGLE_COMPANY_ID,
      entityId: null,
      isMasterAdmin: true
    });
  }

  const ctx = getEntityContext();

  if (master) {
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
  const user = approvedAdmins.find(u => u.id === adminId);
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

    if (isMasterAdmin() && item.adminId) {
      const uidLine = document.createElement("div");
      uidLine.className = "admin-meta admin-uid-line";
      const uidText = createTextEl("code", item.adminId);
      uidText.className = "admin-uid-text";
      const copyBtn = createCopyButton("Copier UID", item.adminId, copied => {
        notifyAdmin("adminDebug", copied ? "UID admin copié." : "Copie impossible.", !copied);
      });
      uidLine.append(uidText, copyBtn);
      main.append(title, meta, uidLine);
    } else {
      main.append(title, meta);
    }

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

      if (isMasterAdmin()) {
        const deleteBtn = document.createElement("button");
        deleteBtn.type = "button";
        deleteBtn.className = "btn-danger";
        deleteBtn.textContent = "Supprimer";
        bindActionButton(deleteBtn, () => deleteEntity(item));
        actions.appendChild(deleteBtn);
      }
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
  if (editEntityPasswordConfirmInput) {
    editEntityPasswordConfirmInput.value = "";
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
  const newPasswordConfirm = String(editEntityPasswordConfirmInput?.value || "");

  if (!entityId || !name) {
    notifyAdmin("adminDebug", "Nom d'entité requis.", true);
    return;
  }

  if (!adminId) {
    notifyAdmin("adminDebug", "Admin entité obligatoire.", true);
    return;
  }

  if (newPassword && newPassword.length < 6) {
    notifyAdmin("adminDebug", "Mot de passe entité : 6 caractères minimum.", true);
    return;
  }

  if (newPassword && newPassword !== newPasswordConfirm) {
    notifyAdmin("adminDebug", "Les mots de passe entité ne correspondent pas.", true);
    return;
  }

  const existing = entities.find(e => e.id === entityId);
  const previousAdminId = existing?.adminId || null;

  if (newPassword) {
    const confirmed = await confirmDangerAction({
      title: "Changer le mot de passe entité",
      message: "Cette action modifie les identifiants de connexion de l'entité. Les utilisateurs devront utiliser le nouveau mot de passe.",
      confirmLabel: "Mettre à jour le mot de passe"
    });
    if (!confirmed) {
      return;
    }
  }

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

      const verified = await verifyEntityPasswordViaRules(entityId, newPassword);
      if (!verified) {
        notifyAdmin("adminDebug", "Échec vérification mot de passe entité après enregistrement.", true);
        return;
      }
    }

    await syncEntityAdminUser(entityId, adminId, previousAdminId);

    await writeLog({
      userId: currentUserId,
      action: "entity_update",
      targetId: entityId,
      details: { name, passwordRotated: Boolean(newPassword) }
    });

    closeEditModal();
    notifyAdmin("adminDebug", "Entité mise à jour.");
    await loadEntities();
    await renderContextBanner();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la mise à jour.", true);
  }
}

async function countActiveUsersForEntity(entityId) {
  const snap = await getDocs(query(
    collection(db, ADMIN_COLLECTIONS.users),
    where("entityId", "==", entityId)
  ));
  return snap.docs.filter(d => d.data().isActive !== false && d.data().approvalStatus !== APPROVAL_STATUS.rejected).length;
}

async function deleteEntity(item) {
  if (!isMasterAdmin()) {
    notifyAdmin("adminDebug", "Seul l'admin général peut supprimer une entité.", true);
    return;
  }

  if (item.isActive !== false) {
    notifyAdmin("adminDebug", "Désactivez l'entité avant de la supprimer.", true);
    return;
  }

  const activeUsers = await countActiveUsersForEntity(item.id);
  if (activeUsers > 0) {
    notifyAdmin("adminDebug", `Suppression impossible : ${activeUsers} utilisateur(s) actif(s) lié(s).`, true);
    return;
  }

  const entityName = item.name || item.id;
  const confirmed = await confirmTripleDangerAction({
    title: "Supprimer l'entité",
    message: `Vous allez supprimer définitivement l'entité « ${entityName} ».`,
    secondMessage: "Les paramètres et secrets de l'entité seront effacés. Les données métier existantes ne seront pas supprimées automatiquement.",
    confirmLabel: "Supprimer définitivement",
    nameToType: entityName
  });

  if (!confirmed) {
    return;
  }

  try {
    await deleteDoc(doc(db, ADMIN_COLLECTIONS.entities, item.id));
    await deleteDoc(doc(db, ADMIN_COLLECTIONS.entitySecrets, item.id)).catch(() => null);
    await deleteDoc(doc(db, "settings", getEntitySettingsId(item.id))).catch(() => null);

    await writeLog({
      userId: currentUserId,
      action: "entity_delete",
      targetId: item.id,
      details: { name: entityName }
    });

    notifyAdmin("adminDebug", "Entité supprimée.");
    await loadEntities();
    await renderContextBanner();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la suppression.", true);
  }
}

async function toggleEntity(item) {
  const willDeactivate = item.isActive !== false;
  const confirmed = await confirmDangerAction({
    title: willDeactivate ? "Désactiver l'entité" : "Activer l'entité",
    message: willDeactivate
      ? "Les utilisateurs de cette entité ne pourront plus se connecter avec ses identifiants tant qu'elle reste inactive."
      : "L'entité redeviendra accessible à la connexion.",
    confirmLabel: willDeactivate ? "Désactiver" : "Activer"
  });
  if (!confirmed) {
    return;
  }

  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.entities, item.id), {
      isActive: !willDeactivate,
      updatedAt: Timestamp.now()
    });
    await writeLog({
      userId: currentUserId,
      action: "entity_status_update",
      targetId: item.id,
      details: { isActive: !willDeactivate }
    });
    notifyAdmin("adminDebug", willDeactivate ? "Entité désactivée." : "Entité activée.");
    await loadEntities();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la mise à jour de l'entité.", true);
  }
}

async function createEntity() {
  const companyId = SINGLE_COMPANY_ID;

  const name = sanitizeText(nameInput?.value, 80);
  const adminId = adminSelect?.value || null;
  const entityPassword = String(entityPasswordInput?.value || "");

  if (!name) {
    notifyAdmin("adminDebug", "Nom d'entité requis.", true);
    return;
  }

  if (!adminId) {
    notifyAdmin("adminDebug", "Admin entité obligatoire.", true);
    return;
  }

  if (entityPassword.length < 6) {
    notifyAdmin("adminDebug", "Mot de passe entité requis (6 caractères minimum).", true);
    return;
  }

  if (!approvedAdmins.some(user => user.id === adminId)) {
    notifyAdmin("adminDebug", "Administrateur sélectionné invalide.", true);
    return;
  }

  try {
    const entityPasswordHash = await hashCompanyPassword(entityPassword);
    const ref = await addDoc(collection(db, ADMIN_COLLECTIONS.entities), {
      companyId,
      name,
      adminId,
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

    const verified = await verifyEntityPasswordViaRules(ref.id, entityPassword);
    if (!verified) {
      notifyAdmin("adminDebug", "Échec vérification mot de passe entité après création.", true);
      return;
    }

    await syncEntityAdminUser(ref.id, adminId, null);

    await writeLog({
      userId: currentUserId,
      action: "entity_create",
      targetId: ref.id,
      details: { name, adminId }
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
    notifyAdmin("adminDebug", "Entité créée.");
    await loadEntities();
    await renderContextBanner();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la création.", true);
  }
}

guardAdminPage("scope_entities").then(async result => {
  currentUserId = result.user.uid;
  permissions = result.permissions;
  try {
    await loadApprovedAdmins();
    if (!approvedAdmins.length) {
      notifyAdmin(
        "adminDebug",
        "Aucun administrateur approuvé disponible. Approuvez d'abord un utilisateur avec le rôle admin.",
        true
      );
    }
    await renderContextBanner();
    await loadEntities();
  } catch (err) {
    notifyAdmin("adminDebug", "Erreur chargement entités : " + (err?.message || "inconnue"), true);
  }
});

bindActionButton(document.getElementById("createEntityBtn"), createEntity);
bindActionButton(document.getElementById("saveEntityEditBtn"), saveEntityEdit);
bindActionButton(document.getElementById("closeEntityEditBtn"), closeEditModal);

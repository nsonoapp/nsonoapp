import {
  db,
  doc,
  updateDoc,
  collection,
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
  bindListActions,
  createTextEl,
  formatAdminDate,
  cacheEntityName
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { APPROVAL_STATUS } from "./admin-constants.js";
import { hasScope } from "./permissions.js";
import { applyEntityScope } from "./query-scope.js";
import { isMasterAdmin, getEntityContext } from "./entity-context.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

let currentUserId = null;
let permissions = null;
let pendingUsers = [];
let entityOptions = [];

const listEl = document.getElementById("approvalsList");

async function loadEntityOptions() {
  entityOptions = [];
  if (!isMasterAdmin()) {
    return;
  }
  const snap = await getDocs(collection(db, ADMIN_COLLECTIONS.entities));
  entityOptions = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(e => e.isActive !== false)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
  entityOptions.forEach(item => cacheEntityName(item.id, item.name));
}

function resolveEntityName(entityId) {
  if (!entityId) {
    return "—";
  }
  const match = entityOptions.find(e => e.id === entityId);
  return match?.name || entityId;
}

async function loadPendingUsers() {
  const constraints = applyEntityScope([
    where("approvalStatus", "==", APPROVAL_STATUS.pending)
  ]);
  const snap = await getDocs(query(collection(db, ADMIN_COLLECTIONS.users), ...constraints));
  pendingUsers = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0));
  renderList();
}

function renderList() {
  bindListActions(listEl, pendingUsers, item => {
    const row = document.createElement("div");
    row.className = "admin-item";

    const main = document.createElement("div");
    const title = createTextEl("strong", item.name || item.email || item.id);
    const meta = createTextEl(
      "span",
      `${item.email || "—"} • Entité: ${resolveEntityName(item.entityId)} • ${formatAdminDate(item.createdAt)}`
    );
    meta.className = "admin-meta";
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (hasScope("scope_approvals", permissions)) {
      let entitySelect = null;

      if (isMasterAdmin() && !item.entityId) {
        entitySelect = document.createElement("select");
        entitySelect.className = "admin-inline-select";
        entitySelect.setAttribute("aria-label", "Entité à assigner");

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = "Choisir entité";
        entitySelect.appendChild(placeholder);

        entityOptions.forEach(entity => {
          const opt = document.createElement("option");
          opt.value = entity.id;
          opt.textContent = entity.name || entity.id;
          entitySelect.appendChild(opt);
        });

        actions.appendChild(entitySelect);
      }

      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.textContent = "Approuver";
      bindActionButton(approveBtn, () => {
        const selectedEntityId = entitySelect?.value || item.entityId || null;
        updateApproval(item, APPROVAL_STATUS.approved, selectedEntityId);
      });

      const rejectBtn = document.createElement("button");
      rejectBtn.type = "button";
      rejectBtn.className = "btn-danger";
      rejectBtn.textContent = "Rejeter";
      bindActionButton(rejectBtn, () => updateApproval(item, APPROVAL_STATUS.rejected, item.entityId || null));

      actions.append(approveBtn, rejectBtn);
    }

    row.append(main, actions);
    return row;
  });
}

async function updateApproval(item, status, entityId = null) {
  if (status === APPROVAL_STATUS.approved) {
    const ctx = getEntityContext();
    const targetEntityId = entityId || item.entityId || null;

    if (isMasterAdmin() && !targetEntityId) {
      notifyAdmin("adminDebug", "Sélectionnez une entité avant d'approuver.", true);
      return;
    }

    if (!isMasterAdmin() && ctx.entityId && targetEntityId !== ctx.entityId) {
      notifyAdmin("adminDebug", "Vous ne pouvez approuver que les comptes de votre entité.", true);
      return;
    }

    if (!isMasterAdmin() && !targetEntityId) {
      notifyAdmin("adminDebug", "Ce compte doit être assigné par l'admin général.", true);
      return;
    }
  }

  try {
    const updatePayload = {
      approvalStatus: status,
      isActive: status === APPROVAL_STATUS.approved,
      updatedAt: Timestamp.now()
    };

    if (status === APPROVAL_STATUS.approved) {
      updatePayload.entityId = entityId || item.entityId || null;
      updatePayload.companyId = SINGLE_COMPANY_ID;
      if (item.role === "user") {
        updatePayload.role = "seller";
      }
    }

    await updateDoc(doc(db, ADMIN_COLLECTIONS.users, item.id), updatePayload);

    await writeLog({
      userId: currentUserId,
      action: status === APPROVAL_STATUS.approved ? "user_approve" : "user_reject",
      targetId: item.id,
      details: {
        email: item.email || null,
        entityId: updatePayload.entityId || null
      }
    });

    notifyAdmin("adminDebug", status === APPROVAL_STATUS.approved ? "Utilisateur approuvé." : "Utilisateur rejeté.");
    await loadPendingUsers();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors du traitement.", true);
  }
}

guardAdminPage("scope_approvals").then(async result => {
  currentUserId = result.user.uid;
  permissions = result.permissions;
  await loadEntityOptions();
  await renderContextBanner();
  await loadPendingUsers();
});

window.addEventListener("nsono:entity-view-changed", () => {
  loadPendingUsers();
});

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
  showMessage,
  bindListActions,
  createTextEl,
  formatAdminDate
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS } from "./admin-collections.js";
import { APPROVAL_STATUS } from "./admin-constants.js";
import { hasScope } from "./permissions.js";
import { applyEntityScope } from "./query-scope.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

let currentUserId = null;
let permissions = null;
let pendingUsers = [];

const listEl = document.getElementById("approvalsList");

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
      `${item.email || "—"} • Entité: ${item.entityId || "—"} • ${formatAdminDate(item.createdAt)}`
    );
    meta.className = "admin-meta";
    main.append(title, meta);

    const actions = document.createElement("div");
    actions.className = "admin-actions";

    if (hasScope("scope_approvals", permissions)) {
      const approveBtn = document.createElement("button");
      approveBtn.type = "button";
      approveBtn.textContent = "Approuver";
      bindActionButton(approveBtn, () => updateApproval(item, APPROVAL_STATUS.approved));

      const rejectBtn = document.createElement("button");
      rejectBtn.type = "button";
      rejectBtn.className = "btn-danger";
      rejectBtn.textContent = "Rejeter";
      bindActionButton(rejectBtn, () => updateApproval(item, APPROVAL_STATUS.rejected));

      actions.append(approveBtn, rejectBtn);
    }

    row.append(main, actions);
    return row;
  });
}

async function updateApproval(item, status) {
  try {
    const updatePayload = {
      approvalStatus: status,
      isActive: status === APPROVAL_STATUS.approved,
      updatedAt: Timestamp.now()
    };

    if (status === APPROVAL_STATUS.approved && item.role === "user") {
      updatePayload.role = "seller";
    }

    await updateDoc(doc(db, ADMIN_COLLECTIONS.users, item.id), updatePayload);

    await writeLog({
      userId: currentUserId,
      action: status === APPROVAL_STATUS.approved ? "user_approve" : "user_reject",
      targetId: item.id,
      details: { email: item.email || null }
    });

    showMessage("adminDebug", status === APPROVAL_STATUS.approved ? "Utilisateur approuvé." : "Utilisateur rejeté.");
    await loadPendingUsers();
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors du traitement.", true);
  }
}

guardAdminPage("scope_approvals").then(async result => {
  currentUserId = result.user.uid;
  permissions = result.permissions;
  await renderContextBanner();
  await loadPendingUsers();
});

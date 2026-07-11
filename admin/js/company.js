import {
  db,
  doc,
  getDoc,
  updateDoc,
  setDoc,
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
  sanitizeText,
  createTextEl,
  createCopyButton,
  confirmDangerAction
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { getEntityContext, isMasterAdmin } from "./entity-context.js";
import { hashCompanyPassword } from "./company-auth.js";
import { APPROVAL_STATUS } from "./admin-constants.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

const companyNameInput = document.getElementById("companyNameEdit");
const companyCodeInput = document.getElementById("companyCodeEdit");
const companyNewPasswordInput = document.getElementById("companyNewPassword");
const companyNewPasswordConfirmInput = document.getElementById("companyNewPasswordConfirm");
const masterAdminSelect = document.getElementById("masterAdminSelect");
const masterAdminIdsList = document.getElementById("masterAdminIdsList");
const entityAdminsList = document.getElementById("entityAdminsList");

let currentUserId = null;
let masterAdminCandidates = [];

function renderUidCopyList(container, rows) {
  if (!container) {
    return;
  }
  container.replaceChildren();

  if (!rows.length) {
    container.appendChild(createTextEl("p", "Aucun UID à afficher.", "admin-meta"));
    return;
  }

  rows.forEach(row => {
    if (!row.uid) {
      return;
    }
    const line = document.createElement("div");
    line.className = "admin-copy-row";

    const label = createTextEl("span", `${row.label} : `);
    const code = createTextEl("code", row.uid);
    code.className = "admin-uid-text";

    const copyBtn = createCopyButton("Copier", row.uid, copied => {
      notifyAdmin("adminDebug", copied ? "UID copié." : "Copie impossible.", !copied);
    });

    line.append(label, code, copyBtn);
    container.appendChild(line);
  });
}

async function loadMasterAdminCandidates() {
  const usersSnap = await getDocs(query(
    collection(db, ADMIN_COLLECTIONS.users),
    where("role", "==", "admin"),
    where("approvalStatus", "==", APPROVAL_STATUS.approved)
  )).catch(async () => getDocs(collection(db, ADMIN_COLLECTIONS.users)));

  const entitiesSnap = await getDocs(query(
    collection(db, ADMIN_COLLECTIONS.entities),
    where("companyId", "==", SINGLE_COMPANY_ID)
  ));

  const byId = new Map();
  usersSnap.docs.forEach(d => {
    const data = d.data();
    if (
      data.role === "admin" &&
      data.approvalStatus === APPROVAL_STATUS.approved &&
      data.isActive !== false
    ) {
      byId.set(d.id, { id: d.id, name: data.name || data.email || d.id });
    }
  });

  entitiesSnap.docs.forEach(d => {
    const data = d.data();
    if (data.adminId && !byId.has(data.adminId)) {
      byId.set(data.adminId, { id: data.adminId, name: `Admin ${data.name || d.id}` });
    }
  });

  masterAdminCandidates = Array.from(byId.values())
    .sort((a, b) => a.name.localeCompare(b.name));

  if (!masterAdminSelect) {
    return;
  }

  masterAdminSelect.replaceChildren();
  masterAdminCandidates.forEach(user => {
    const opt = document.createElement("option");
    opt.value = user.id;
    opt.textContent = user.name;
    masterAdminSelect.appendChild(opt);
  });
}

function setMasterAdminSelection(ids = []) {
  if (!masterAdminSelect) {
    return;
  }
  const selected = new Set(ids);
  Array.from(masterAdminSelect.options).forEach(opt => {
    opt.selected = selected.has(opt.value);
  });
}

async function loadCompanyForm() {
  const snap = await getDoc(doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID));
  if (!snap.exists()) {
    notifyAdmin("adminDebug", "Société non initialisée. Utilisez onboarding.", true);
    return;
  }

  const data = snap.data();
  if (companyNameInput) {
    companyNameInput.value = data.name || "";
  }
  if (companyCodeInput) {
    companyCodeInput.value = data.companyCode || "";
  }

  await loadMasterAdminCandidates();
  const ids = Array.isArray(data.masterAdminIds) ? data.masterAdminIds : [];
  setMasterAdminSelection(ids);
  renderUidCopyList(
    masterAdminIdsList,
    ids.map(id => {
      const user = masterAdminCandidates.find(u => u.id === id);
      return { label: user?.name || "Admin général", uid: id };
    })
  );
}

async function loadEntityAdminsList() {
  if (!entityAdminsList) {
    return;
  }

  const snap = await getDocs(query(
    collection(db, ADMIN_COLLECTIONS.entities),
    where("companyId", "==", SINGLE_COMPANY_ID)
  ));

  const rows = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""))
    .map(entity => ({
      label: entity.name || entity.id,
      uid: entity.adminId || ""
    }))
    .filter(row => row.uid);

  renderUidCopyList(entityAdminsList, rows);
}

async function saveCompanyInfo() {
  const name = sanitizeText(companyNameInput?.value, 80);
  const companyCode = sanitizeText(companyCodeInput?.value, 32);

  if (!name) {
    notifyAdmin("adminDebug", "Nom société requis.", true);
    return;
  }

  const confirmed = await confirmDangerAction({
    title: "Modifier les informations société",
    message: "Le changement de nom ou de code peut impacter la connexion des utilisateurs. Vérifiez que le nouveau nom/code est communiqué à votre équipe.",
    confirmLabel: "Enregistrer"
  });
  if (!confirmed) {
    return;
  }

  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID), {
      name,
      companyCode: companyCode || name.toLowerCase().replace(/\s+/g, "-").slice(0, 32),
      updatedAt: Timestamp.now()
    });
    await writeLog({
      userId: currentUserId,
      action: "company_update",
      targetId: SINGLE_COMPANY_ID,
      details: { name }
    });
    notifyAdmin("adminDebug", "Informations société enregistrées.");
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de l'enregistrement.", true);
  }
}

async function rotateCompanyPassword() {
  const password = String(companyNewPasswordInput?.value || "");
  const confirm = String(companyNewPasswordConfirmInput?.value || "");

  if (password.length < 6) {
    notifyAdmin("adminDebug", "Mot de passe requis (6 caractères minimum).", true);
    return;
  }

  if (password !== confirm) {
    notifyAdmin("adminDebug", "Les mots de passe ne correspondent pas.", true);
    return;
  }

  const confirmed = await confirmDangerAction({
    title: "Changer le mot de passe société",
    message: "Tous les utilisateurs devront utiliser le nouveau mot de passe société à la prochaine connexion. Cette action est irréversible sans connaître l'ancien mot de passe.",
    confirmLabel: "Mettre à jour le mot de passe"
  });
  if (!confirmed) {
    return;
  }

  try {
    const passwordHash = await hashCompanyPassword(password);
    await setDoc(doc(db, ADMIN_COLLECTIONS.companySecrets, SINGLE_COMPANY_ID), {
      companyId: SINGLE_COMPANY_ID,
      passwordHash,
      updatedAt: Timestamp.now()
    });
    await writeLog({
      userId: currentUserId,
      action: "company_password_rotate",
      targetId: SINGLE_COMPANY_ID
    });
    if (companyNewPasswordInput) {
      companyNewPasswordInput.value = "";
    }
    if (companyNewPasswordConfirmInput) {
      companyNewPasswordConfirmInput.value = "";
    }
    notifyAdmin("adminDebug", "Mot de passe société mis à jour.");
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de la rotation du mot de passe.", true);
  }
}

async function saveMasterAdmins() {
  const ids = masterAdminSelect
    ? Array.from(masterAdminSelect.selectedOptions).map(opt => opt.value).filter(Boolean).slice(0, 5)
    : [];

  if (!ids.length) {
    notifyAdmin("adminDebug", "Sélectionnez au moins un admin général.", true);
    return;
  }

  const confirmed = await confirmDangerAction({
    title: "Modifier les admins généraux",
    message: "Les utilisateurs sélectionnés auront un accès global à toutes les entités. Retirer un admin général limite immédiatement son périmètre.",
    confirmLabel: "Enregistrer les admins"
  });
  if (!confirmed) {
    return;
  }

  try {
    await updateDoc(doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID), {
      masterAdminIds: ids,
      masterAdminId: ids[0],
      updatedAt: Timestamp.now()
    });
    await writeLog({
      userId: currentUserId,
      action: "company_master_admins_update",
      targetId: SINGLE_COMPANY_ID,
      details: { count: ids.length }
    });
    notifyAdmin("adminDebug", "Admins généraux enregistrés.");
    await loadCompanyForm();
  } catch (err) {
    console.error(err);
    notifyAdmin("adminDebug", "Erreur lors de l'enregistrement des admins.", true);
  }
}

guardAdminPage().then(async result => {
  currentUserId = result.user.uid;

  if (!isMasterAdmin() && !getEntityContext().isMasterAdmin) {
    const companySnap = await getDoc(doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID));
    const company = companySnap.exists() ? companySnap.data() : null;
    const ids = Array.isArray(company?.masterAdminIds) ? company.masterAdminIds : [];
    if (!ids.includes(currentUserId) && company?.masterAdminId !== currentUserId) {
      location.href = "admin.html";
      return;
    }
  }

  await renderContextBanner();
  await loadCompanyForm();
  await loadEntityAdminsList();
});

bindActionButton(document.getElementById("saveCompanyInfoBtn"), saveCompanyInfo);
bindActionButton(document.getElementById("rotateCompanyPasswordBtn"), rotateCompanyPassword);
bindActionButton(document.getElementById("saveMasterAdminsBtn"), saveMasterAdmins);

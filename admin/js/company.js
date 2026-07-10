import {
  db,
  doc,
  getDoc,
  updateDoc,
  setDoc,
  Timestamp,
  writeLog
} from "../../js/firebase.js";
import {
  guardAdminPage,
  renderContextBanner,
  showMessage,
  sanitizeText
} from "./admin-shared.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { getEntityContext, isMasterAdmin } from "./entity-context.js";
import { hashCompanyPassword } from "./company-auth.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";

const companyNameInput = document.getElementById("companyNameEdit");
const companyCodeInput = document.getElementById("companyCodeEdit");
const companyNewPasswordInput = document.getElementById("companyNewPassword");
const companyNewPasswordConfirmInput = document.getElementById("companyNewPasswordConfirm");
const masterAdminIdsInput = document.getElementById("masterAdminIdsInput");

let currentUserId = null;

function parseMasterAdminIds(raw) {
  return String(raw || "")
    .split(/[\s,;]+/)
    .map(id => id.trim())
    .filter(Boolean)
    .slice(0, 5);
}

async function loadCompanyForm() {
  const snap = await getDoc(doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID));
  if (!snap.exists()) {
    showMessage("adminDebug", "Société non initialisée. Utilisez onboarding.", true);
    return;
  }

  const data = snap.data();
  if (companyNameInput) {
    companyNameInput.value = data.name || "";
  }
  if (companyCodeInput) {
    companyCodeInput.value = data.companyCode || "";
  }
  if (masterAdminIdsInput) {
    const ids = Array.isArray(data.masterAdminIds) ? data.masterAdminIds : [];
    masterAdminIdsInput.value = ids.join("\n");
  }
}

async function saveCompanyInfo() {
  const name = sanitizeText(companyNameInput?.value, 80);
  const companyCode = sanitizeText(companyCodeInput?.value, 32);

  if (!name) {
    showMessage("adminDebug", "Nom société requis.", true);
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
    showMessage("adminDebug", "Informations société enregistrées.");
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de l'enregistrement.", true);
  }
}

async function rotateCompanyPassword() {
  const password = String(companyNewPasswordInput?.value || "");
  const confirm = String(companyNewPasswordConfirmInput?.value || "");

  if (password.length < 6) {
    showMessage("adminDebug", "Mot de passe requis (6 caractères minimum).", true);
    return;
  }

  if (password !== confirm) {
    showMessage("adminDebug", "Les mots de passe ne correspondent pas.", true);
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
    showMessage("adminDebug", "Mot de passe société mis à jour.");
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de la rotation du mot de passe.", true);
  }
}

async function saveMasterAdmins() {
  const ids = parseMasterAdminIds(masterAdminIdsInput?.value);

  if (!ids.length) {
    showMessage("adminDebug", "Au moins un admin général requis.", true);
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
    showMessage("adminDebug", "Admins généraux enregistrés.");
  } catch (err) {
    console.error(err);
    showMessage("adminDebug", "Erreur lors de l'enregistrement des admins.", true);
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
});

bindActionButton(document.getElementById("saveCompanyInfoBtn"), saveCompanyInfo);
bindActionButton(document.getElementById("rotateCompanyPasswordBtn"), rotateCompanyPassword);
bindActionButton(document.getElementById("saveMasterAdminsBtn"), saveMasterAdmins);

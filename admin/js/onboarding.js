import {
  db,
  doc,
  updateDoc,
  collection,
  Timestamp,
  writeBatch,
  writeLog
} from "../../js/firebase.js";
import { getAuth, onAuthStateChanged } from "../../js/auth.js";
import {
  hashCompanyPassword,
  storeCompanySession,
  hasSingleCompany
} from "./company-auth.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";
import { setEntityContext } from "./entity-context.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { APPROVAL_STATUS } from "./admin-constants.js";
import { showMessage, sanitizeText } from "./admin-shared.js";

const auth = getAuth();

const companyNameInput = document.getElementById("companyName");
const companyCodeInput = document.getElementById("companyCode");
const companyPasswordInput = document.getElementById("companyPassword");
const entityNameInput = document.getElementById("entityName");
const onboardingForm = document.getElementById("onboardingForm");
const onboardingSubmitBtn = document.getElementById("onboardingSubmitBtn");

function lockOnboardingForm(message) {
  if (onboardingForm) {
    onboardingForm.querySelectorAll("input").forEach(input => {
      input.disabled = true;
    });
  }
  if (onboardingSubmitBtn) {
    onboardingSubmitBtn.disabled = true;
  }
  if (message) {
    showMessage("onboardingDebug", message, true);
  }
}

async function bootstrapCompany(user) {
  const name = sanitizeText(companyNameInput?.value, 80);
  const companyCode = sanitizeText(companyCodeInput?.value, 32);
  const password = String(companyPasswordInput?.value || "");
  const entityName = sanitizeText(entityNameInput?.value, 80);

  if (await hasSingleCompany()) {
    showMessage("onboardingDebug", "Une société existe déjà pour cette base. Création interdite.", true);
    lockOnboardingForm();
    return;
  }

  if (!name || !password || password.length < 6) {
    showMessage("onboardingDebug", "Nom société et mot de passe (6 car. min.) requis.", true);
    return;
  }

  if (!entityName) {
    showMessage("onboardingDebug", "Nom de la première entité requis.", true);
    return;
  }

  try {
    const passwordHash = await hashCompanyPassword(password);
    const companyRef = doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID);
    const secretRef = doc(db, ADMIN_COLLECTIONS.companySecrets, SINGLE_COMPANY_ID);
    const entityRef = doc(collection(db, ADMIN_COLLECTIONS.entities));

    const companyBatch = writeBatch(db);
    companyBatch.set(companyRef, {
      name,
      companyCode: companyCode || name.toLowerCase().replace(/\s+/g, "-").slice(0, 32),
      masterAdminId: user.uid,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await companyBatch.commit();

    const secretBatch = writeBatch(db);
    secretBatch.set(secretRef, {
      companyId: SINGLE_COMPANY_ID,
      passwordHash,
      updatedAt: Timestamp.now()
    });
    secretBatch.set(entityRef, {
      companyId: SINGLE_COMPANY_ID,
      name: entityName,
      adminId: user.uid,
      isActive: true,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now()
    });
    await secretBatch.commit();

    await updateDoc(doc(db, ADMIN_COLLECTIONS.users, user.uid), {
      companyId: SINGLE_COMPANY_ID,
      entityId: entityRef.id,
      approvalStatus: APPROVAL_STATUS.approved,
      isActive: true,
      roleIds: [],
      updatedAt: Timestamp.now()
    }).catch(() => null);

    storeCompanySession(SINGLE_COMPANY_ID, name);
    setEntityContext({
      companyId: SINGLE_COMPANY_ID,
      entityId: entityRef.id,
      isMasterAdmin: true
    });

    await writeLog({
      userId: user.uid,
      action: "company_onboarding",
      targetId: SINGLE_COMPANY_ID,
      details: { name, entityName }
    });

    showMessage("onboardingDebug", "Société unique initialisée (companies/main).");
    setTimeout(() => {
      location.href = "admin.html";
    }, 800);
  } catch (err) {
    console.error(err);
    showMessage("onboardingDebug", "Erreur lors de l'initialisation.", true);
  }
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "../login.html";
    return;
  }

  if (await hasSingleCompany()) {
    lockOnboardingForm("Cette base contient déjà la société unique. Onboarding désactivé.");
  }
});

bindActionButton(onboardingSubmitBtn, async () => {
  const user = auth.currentUser;
  if (!user) {
    showMessage("onboardingDebug", "Connectez-vous d'abord.", true);
    return;
  }
  await bootstrapCompany(user);
});

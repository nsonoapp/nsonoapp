// settings.js — admin
import {
  db,
  collection,
  getDocs,
  doc,
  getDoc,
  query,
  where,
  serverTimestamp,
  writeLog
} from "../../js/firebase.js";

import {
  getAuth,
  onAuthStateChanged
} from "../../js/auth.js";

import {
  loadSettings,
  saveSettings,
  resolveActiveSettingsId,
  getEntitySettingsId,
  getGlobalSettingsId
} from "../../js/services/settingsService.js";

import {
  isAppLocked,
  setAppLocked,
  updateData,
  deleteData,
  handleWriteError
} from "../../js/services/firebaseService.js";

import {
  canAccessAdmin,
  hasScope,
  loadUserPermissions,
  clearPermissionsCache
} from "./permissions.js";

import { isMasterAdmin, getEntityContext } from "./entity-context.js";
import { bindActionButton } from "../../js/utils/buttonManager.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";
import { createCopyButton, cacheEntityName } from "./admin-shared.js";
import { restoreNsonoSession } from "../../js/auth-flow.js";
import { getSingleCompany, isCompanyGeneralAdmin } from "./company-auth.js";

const auth = getAuth();

/* =========================
   GLOBAL
========================= */

let currentUserId = null;
let activeSettingsId = resolveActiveSettingsId();
let adminMode = "entity";
let usersEntityFilterId = "all";
let currentPermissions = null;
let entityNameMap = new Map();
let roleDefinitions = [];
let editingUser = null;

const usersCollection = collection(db, "users");

/* =========================
   DOM
========================= */

const usersTableBody =
  document.querySelector("#usersTable tbody");

const loadingState =
  document.getElementById("loadingState");

const emptyState =
  document.getElementById("emptyState");

const userEditModal = document.getElementById("userEditModal");
const editUserIdInput = document.getElementById("editUserId");
const userEditSummary = document.getElementById("userEditSummary");
const editUserEntitySelect = document.getElementById("editUserEntity");
const editUserRoleSelect = document.getElementById("editUserRole");
const editUserRoleIdsBox = document.getElementById("editUserRoleIds");

const confirmModal = document.getElementById("confirmModal");
const confirmModalTitle = document.getElementById("confirmModalTitle");
const confirmModalMessage = document.getElementById("confirmModalMessage");

let confirmResolver = null;

function showConfirmModal(title, message) {
  return new Promise((resolve) => {
    if (!confirmModal) {
      resolve(window.confirm(message));
      return;
    }

    confirmResolver = resolve;
    confirmModalTitle.textContent = title;
    confirmModalMessage.textContent = message;
    confirmModal.classList.add("show");
    confirmModal.setAttribute("aria-hidden", "false");
  });
}

function closeConfirmModal(result) {
  if (!confirmModal) return;
  confirmModal.classList.remove("show");
  confirmModal.setAttribute("aria-hidden", "true");
  if (confirmResolver) {
    confirmResolver(result);
    confirmResolver = null;
  }
}

document.getElementById("confirmModalYes")?.addEventListener("click", () => {
  closeConfirmModal(true);
});

document.getElementById("confirmModalNo")?.addEventListener("click", () => {
  closeConfirmModal(false);
});

/* =========================
   UTILS
========================= */

function sanitizeText(value, max = 80) {

  if (typeof value !== "string") {
    return "";
  }

  return value
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function sanitizeSubName(value) {
  return sanitizeText(value, 24);
}

function isEntitySettingsId(settingsId) {
  return String(settingsId || "").startsWith("entity_");
}

function persistEntitySubName(settingsId, data) {
  if (!isEntitySettingsId(settingsId)) {
    localStorage.removeItem("nsono_entitySubName");
    return;
  }
  const subName = sanitizeSubName(data?.subName);
  if (subName) {
    localStorage.setItem("nsono_entitySubName", subName);
  } else {
    localStorage.removeItem("nsono_entitySubName");
  }
}

function showLoading(show = true) {

  if (!loadingState) return;

  loadingState.style.display =
    show ? "flex" : "none";
}

function showEmpty(show = false) {

  if (!emptyState) return;

  emptyState.style.display =
    show ? "block" : "none";
}

function showMessage(message = "") {

  const existing =
    document.getElementById("debugMessage");

  if (existing) {
    existing.remove();
  }

  const div =
    document.createElement("div");

  div.id = "debugMessage";

  div.textContent = message;

  div.style.position = "fixed";
  div.style.left = "50%";
  div.style.bottom = "85px";
  div.style.transform = "translateX(-50%)";

  div.style.padding = "12px 16px";

  div.style.background = "#111";
  div.style.color = "#fff";

  div.style.borderRadius = "12px";

  div.style.fontSize = "13px";
  div.style.fontWeight = "600";

  div.style.zIndex = "999999";

  div.style.boxShadow =
    "0 4px 18px rgba(0,0,0,0.25)";

  div.style.opacity = "0";
  div.style.transition =
    "opacity .25s ease";

  document.body.appendChild(div);

  requestAnimationFrame(() => {
    div.style.opacity = "1";
  });

  setTimeout(() => {

    div.style.opacity = "0";

    setTimeout(() => {
      div.remove();
    }, 250);

  }, 2500);
}

function createButton(label, className) {

  const btn =
    document.createElement("button");

  btn.type = "button";

  btn.textContent = label;

  btn.className = className;

  return btn;
}

function createBadge(role) {

  const span =
    document.createElement("span");

  span.textContent = role;

  span.className = "role-badge";

  if (role === "admin") {
    span.classList.add("admin");
  } else {
    span.classList.add("seller");
  }

  return span;
}

/* =========================
   config 
========================= */

async function resolveConfigData() {
  const primary = await loadSettings(activeSettingsId);
  if (primary.exists && primary.data) {
    return primary.data;
  }

  if (activeSettingsId !== getGlobalSettingsId()) {
    return null;
  }

  const legacySnap = await getDoc(doc(db, "appConfig", "main"));
  if (legacySnap.exists()) {
    return legacySnap.data();
  }

  return null;
}

async function loadAppConfig() {
  try {
    let data = await resolveConfigData();

    if (!data) {
      const defaultPayload = {
        shopName: "Shop",
        shopAddress: "",
        shopPhone: "",
        currency: "Franc Congolais",
        currencySymbol: "FC",
        logoUrl: "",
        lowStockLimit: 10,
        enableOffline: true,
        enableExpiration: false,
        expirationAlertDays: 30
      };
      if (isEntitySettingsId(activeSettingsId)) {
        defaultPayload.subName = "";
      }
      await saveSettings(activeSettingsId, defaultPayload);
      data = (await loadSettings(activeSettingsId)).data;
    }

    persistEntitySubName(activeSettingsId, data);

    const scopeLabel = document.getElementById("configScopeLabel");
    if (scopeLabel) {
      if (activeSettingsId === getGlobalSettingsId()) {
        scopeLabel.textContent = "Configuration Générale (main_config) — admin général";
      } else {
        scopeLabel.textContent = `Configuration Entité (${activeSettingsId}) — admin entité`;
      }
    }

    /* =========================
       DISPLAY TABLE (READ ONLY)
    ========================= */
    document.getElementById("shopNameValue").textContent = data.shopName || "-";
    document.getElementById("shopAddressValue").textContent = data.shopAddress || "-";
    document.getElementById("shopPhoneValue").textContent = data.shopPhone || "-";
    document.getElementById("currencyValue").textContent = data.currency || "-";
    document.getElementById("currencySymbolValue").textContent = data.currencySymbol || "-";
    document.getElementById("lowStockValue").textContent = data.lowStockLimit || 0;
    document.getElementById("offlineValue").textContent = data.enableOffline ? "Activé" : "Désactivé";
    document.getElementById("expirationValue").textContent = data.enableExpiration ? "Activé" : "Désactivé";
    document.getElementById("expirationAlertValue").textContent = String(data.expirationAlertDays ?? 30);

    /* =========================
       CREATE EDIT UI (JS ONLY)
    ========================= */

    let old = document.getElementById("configEditBox");
    if (old) old.remove();

    const box = document.createElement("div");
    box.id = "configEditBox";

    box.style.marginTop = "20px";
    box.style.padding = "16px";
    box.style.border = "1px solid #ddd";
    box.style.borderRadius = "12px";
    box.style.background = "#fff";

    box.innerHTML = `
      <h3>✏️ Modifier configuration</h3>

      <label>Nom boutique</label>
      <input id="cfg_shopName" type="text">

      <label id="cfg_subNameLabel">Nom court entité (italique header)</label>
      <input id="cfg_subName" type="text" maxlength="24">

      <label>Adresse</label>
      <input id="cfg_shopAddress" type="text">

      <label>Téléphone</label>
      <input id="cfg_shopPhone" type="text">

      <label>Logo URL</label>
      <input id="cfg_logoUrl" type="text">

      <label>Devise (verrouillée)</label>
      <input id="cfg_currency" type="text">

      <label>Symbole (verrouillé)</label>
      <input id="cfg_currencySymbol" type="text" maxlength="8">

      <label>Stock faible</label>
      <input id="cfg_lowStock" type="number">

      <label>
        <input id="cfg_offline" type="checkbox">
        Mode offline
      </label>

      <label>
        <input id="cfg_enableExpiration" type="checkbox">
        Gestion expiration produits
      </label>

      <div id="cfg_expirationAlertWrap">
        <label for="cfg_expirationAlertDays">Alerte expiration (jours avant)</label>
        <input id="cfg_expirationAlertDays" type="number" min="1" step="1">
      </div>

      <button id="saveConfigBtn"
        style="
          margin-top:15px;
          padding:10px 14px;
          background:#0B3D2E;
          color:#fff;
          border:none;
          border-radius:10px;
          font-weight:700;
          cursor:pointer;
        ">
        💾 Sauvegarder
      </button>
    `;

    document.getElementById("configSection")?.appendChild(box);

    /* =========================
       PREFILL INPUTS
    ========================= */

    document.getElementById("cfg_shopName").value = data.shopName || "";
    document.getElementById("cfg_subName").value = sanitizeSubName(data.subName || "");
    document.getElementById("cfg_shopAddress").value = data.shopAddress || "";
    document.getElementById("cfg_shopPhone").value = data.shopPhone || "";
    document.getElementById("cfg_logoUrl").value = data.logoUrl || "";

    document.getElementById("cfg_currency").value = data.currency || "";
    document.getElementById("cfg_currencySymbol").value = data.currencySymbol || "";

    const isEntityScope = isEntitySettingsId(activeSettingsId);
    const hasEntityCurrency = Boolean(sanitizeText(data.currency) && sanitizeText(data.currencySymbol));
    const currencyLocked = isEntityScope && hasEntityCurrency;

    const subNameLabel = document.getElementById("cfg_subNameLabel");
    const subNameInput = document.getElementById("cfg_subName");
    if (subNameLabel) {
      subNameLabel.style.display = isEntityScope ? "block" : "none";
    }
    if (subNameInput) {
      subNameInput.style.display = isEntityScope ? "block" : "none";
    }

    const currencyInput = document.getElementById("cfg_currency");
    const currencySymbolInput = document.getElementById("cfg_currencySymbol");
    if (currencyInput) {
      currencyInput.disabled = currencyLocked;
    }
    if (currencySymbolInput) {
      currencySymbolInput.disabled = currencyLocked;
    }

    document.getElementById("cfg_lowStock").value = data.lowStockLimit ?? 10;
    document.getElementById("cfg_offline").checked = !!data.enableOffline;
    document.getElementById("cfg_enableExpiration").checked = !!data.enableExpiration;
    document.getElementById("cfg_expirationAlertDays").value = data.expirationAlertDays ?? 30;

    const expirationAlertWrap = document.getElementById("cfg_expirationAlertWrap");
    const enableExpirationInput = document.getElementById("cfg_enableExpiration");

    const syncExpirationAlertVisibility = () => {
      if (expirationAlertWrap) {
        expirationAlertWrap.style.display = enableExpirationInput?.checked ? "block" : "none";
      }
    };

    syncExpirationAlertVisibility();
    enableExpirationInput?.addEventListener("change", syncExpirationAlertVisibility);

    /* =========================
       BIND SAVE
    ========================= */

    bindActionButton(document.getElementById("saveConfigBtn"), updateAppConfig);

  } catch (err) {
    console.error(err);
    showMessage("Erreur configuration");
  }
}

  //modifer config
  async function updateAppConfig() {
  try {
    const data = await resolveConfigData();

    if (!data) {
      showMessage("Config introuvable");
      return;
    }

    const ok = await showConfirmModal(
      "Confirmation",
      "Confirmer la modification ?"
    );
    if (!ok) return;

    /* =========================
       READ INPUTS
    ========================= */

    const shopName = document.getElementById("cfg_shopName").value.trim();
    const subName = sanitizeSubName(document.getElementById("cfg_subName")?.value || "");
    const shopAddress = document.getElementById("cfg_shopAddress").value.trim();
    const shopPhone = document.getElementById("cfg_shopPhone").value.trim();
    const logoUrl = document.getElementById("cfg_logoUrl").value.trim();

    const currencyInputValue = sanitizeText(document.getElementById("cfg_currency")?.value || "", 40);
    const currencySymbolInputValue = sanitizeText(document.getElementById("cfg_currencySymbol")?.value || "", 8);
    const isEntityScope = isEntitySettingsId(activeSettingsId);

    if (isEntityScope && !subName) {
      showMessage("Nom court entité requis");
      return;
    }

    if (isEntityScope && (!currencyInputValue || !currencySymbolInputValue) && (!data.currency || !data.currencySymbol)) {
      showMessage("Devise entité requise (une seule configuration)");
      return;
    }

    const lowStockLimit = Number(document.getElementById("cfg_lowStock").value || 0);
    const enableOffline = document.getElementById("cfg_offline").checked;
    const enableExpiration = document.getElementById("cfg_enableExpiration").checked;
    const expirationAlertDays = Math.max(
      1,
      Number(document.getElementById("cfg_expirationAlertDays").value || 30)
    );

    /* =========================
       UPDATE FIREBASE
       (currency LOCKED)
    ========================= */

    const payload = {
      shopName,
      shopAddress,
      shopPhone,
      logoUrl,
      lowStockLimit,
      enableOffline,
      enableExpiration,
      expirationAlertDays,
      currency: data.currency,
      currencySymbol: data.currencySymbol
    };

    if (isEntityScope) {
      payload.subName = subName;
      if (!sanitizeText(data.currency) || !sanitizeText(data.currencySymbol)) {
        payload.currency = currencyInputValue;
        payload.currencySymbol = currencySymbolInputValue;
      }
    } else {
      payload.subName = "";
    }

    await saveSettings(activeSettingsId, payload);

    await writeLog({
      userId: currentUserId,
      action: "config_update",
      targetId: activeSettingsId,
      details: {
        shopName,
        subName: payload.subName || null,
        enableOffline,
        enableExpiration,
        expirationAlertDays
      }
    });

    showMessage("Configuration mise à jour");

    await loadAppConfig();

  } catch (err) {
    if (handleWriteError(err)) return;
    console.error(err);
    showMessage("❌ Erreur update config");
  }
}

function initLockModeUI() {
  const btn = document.getElementById("lockModeToggle");
  const status = document.getElementById("lockModeStatus");
  if (!btn || !status) return;

  const refresh = () => {
    const locked = isAppLocked();
    status.textContent = locked
      ? "Verrouillé — les écritures sont bloquées sur cet appareil."
      : "Déverrouillé — les écritures sont autorisées sur cet appareil.";
    btn.textContent = locked
      ? "Déverrouiller cet appareil"
      : "Verrouiller les écritures (local)";
  };

  refresh();
  btn.addEventListener("click", () => {
    setAppLocked(!isAppLocked());
    refresh();
  });
}

async function loadEntitySettingsSelector() {
  const wrap = document.getElementById("entitySettingsSelectWrap");
  const select = document.getElementById("entitySettingsSelect");
  if (!wrap || !select || adminMode !== "general") {
    if (wrap) {
      wrap.classList.add("field-hidden");
    }
    return;
  }

  wrap.classList.remove("field-hidden");
  select.replaceChildren();

  const globalOpt = document.createElement("option");
  globalOpt.value = getGlobalSettingsId();
  globalOpt.textContent = "Global (main_config)";
  select.appendChild(globalOpt);

  const entitiesSnap = await getDocs(collection(db, ADMIN_COLLECTIONS.entities));
  entitiesSnap.forEach(entityDoc => {
    const entity = entityDoc.data();
    const opt = document.createElement("option");
    opt.value = getEntitySettingsId(entityDoc.id);
    opt.textContent = entity.name || entityDoc.id;
    select.appendChild(opt);
  });

  select.value = activeSettingsId;
  select.addEventListener("change", async () => {
    activeSettingsId = select.value;
    await loadAppConfig();
  });
}

async function loadEntityNameMap() {
  entityNameMap = new Map();
  const snap = await getDocs(collection(db, ADMIN_COLLECTIONS.entities));
  snap.forEach(entityDoc => {
    const name = entityDoc.data().name || entityDoc.id;
    entityNameMap.set(entityDoc.id, name);
    cacheEntityName(entityDoc.id, name);
  });
}

function resolveEntityLabel(entityId) {
  if (!entityId) {
    return "— (admin général)";
  }
  return entityNameMap.get(entityId) || entityId;
}

async function loadRoleDefinitions() {
  const ctx = getEntityContext();
  let snap;
  try {
    if (adminMode === "general") {
      snap = await getDocs(collection(db, ADMIN_COLLECTIONS.roles));
    } else if (ctx.entityId) {
      snap = await getDocs(query(
        collection(db, ADMIN_COLLECTIONS.roles),
        where("entityId", "==", ctx.entityId)
      ));
    } else {
      roleDefinitions = [];
      return;
    }
  } catch {
    snap = await getDocs(collection(db, ADMIN_COLLECTIONS.roles));
  }

  roleDefinitions = snap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .filter(role => role.isActive !== false)
    .sort((a, b) => (a.name || "").localeCompare(b.name || ""));
}

function fillUserEntitySelect(selectedEntityId = "") {
  if (!editUserEntitySelect) {
    return;
  }

  editUserEntitySelect.replaceChildren();
  const ctx = getEntityContext();

  if (adminMode === "general") {
    const noneOpt = document.createElement("option");
    noneOpt.value = "";
    noneOpt.textContent = "Aucune (admin général)";
    editUserEntitySelect.appendChild(noneOpt);

    entityNameMap.forEach((name, id) => {
      const opt = document.createElement("option");
      opt.value = id;
      opt.textContent = name;
      editUserEntitySelect.appendChild(opt);
    });
    editUserEntitySelect.disabled = false;
  } else {
    const opt = document.createElement("option");
    opt.value = ctx.entityId || "";
    opt.textContent = resolveEntityLabel(ctx.entityId);
    editUserEntitySelect.appendChild(opt);
    editUserEntitySelect.disabled = true;
  }

  editUserEntitySelect.value = adminMode === "entity"
    ? (ctx.entityId || "")
    : (selectedEntityId || "");
}

function renderUserRoleIdCheckboxes(selectedRoleIds = []) {
  if (!editUserRoleIdsBox) {
    return;
  }
  editUserRoleIdsBox.replaceChildren();
  const selected = new Set(Array.isArray(selectedRoleIds) ? selectedRoleIds : []);

  if (!roleDefinitions.length) {
    const empty = document.createElement("p");
    empty.style.fontSize = "12px";
    empty.style.color = "#888";
    empty.textContent = "Aucun rôle dynamique défini.";
    editUserRoleIdsBox.appendChild(empty);
    return;
  }

  roleDefinitions.forEach(role => {
    const label = document.createElement("label");
    label.className = "scope-chip";

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = role.id;
    input.checked = selected.has(role.id);

    const text = document.createElement("span");
    text.textContent = role.name || role.id;

    label.append(input, text);
    editUserRoleIdsBox.appendChild(label);
  });
}

function openUserEditModal(user) {
  if (!userEditModal || !user) {
    return;
  }
  editingUser = user;
  if (editUserIdInput) {
    editUserIdInput.value = user.id || user.userId;
  }
  if (userEditSummary) {
    userEditSummary.textContent = `${sanitizeText(user.name || "-")} • ${sanitizeText(user.email || "-")}`;
  }
  if (editUserRoleSelect) {
    editUserRoleSelect.value = user.role === "admin" ? "admin" : "seller";
  }
  fillUserEntitySelect(user.entityId || "");
  renderUserRoleIdCheckboxes(user.roleIds || []);
  userEditModal.classList.add("show");
  userEditModal.setAttribute("aria-hidden", "false");
}

function closeUserEditModal() {
  if (!userEditModal) {
    return;
  }
  editingUser = null;
  userEditModal.classList.remove("show");
  userEditModal.setAttribute("aria-hidden", "true");
}

async function saveUserEdit() {
  if (!editingUser) {
    return;
  }

  const userId = editingUser.id || editingUser.userId;
  const ctx = getEntityContext();
  const role = editUserRoleSelect?.value === "admin" ? "admin" : "seller";
  let entityId = editUserEntitySelect?.value || null;
  if (!entityId) {
    entityId = null;
  }

  if (adminMode === "entity") {
    entityId = ctx.entityId || null;
  }

  if (!entityId && role !== "admin") {
    showMessage("Une entité est requise pour un vendeur");
    return;
  }

  const roleIds = [];
  editUserRoleIdsBox?.querySelectorAll("input[type='checkbox']:checked").forEach(input => {
    if (input.value) {
      roleIds.push(input.value);
    }
  });

  try {
    const company = await getSingleCompany().catch(() => null);
    if (!entityId && !isCompanyGeneralAdmin(company, userId) && role === "seller") {
      showMessage("Assignez une entité avant d'enregistrer");
      return;
    }

    const payload = {
      entityId,
      companyId: SINGLE_COMPANY_ID,
      role,
      roleIds,
      updatedAt: serverTimestamp()
    };

    if (editingUser.approvalStatus === "pending" && entityId) {
      payload.approvalStatus = "approved";
      payload.isActive = true;
      if (role === "user") {
        payload.role = "seller";
      }
    }

    await updateData(doc(db, "users", userId), payload);

    clearPermissionsCache();

    await writeLog({
      userId: currentUserId,
      action: editingUser.approvalStatus === "pending" ? "user_approve" : "user_profile_update",
      targetId: userId,
      details: { entityId, role: payload.role || role, roleIds }
    });

    showMessage("Utilisateur mis à jour");
    closeUserEditModal();
    await loadUsers();
  } catch (err) {
    console.error(err);
    alert("Erreur mise à jour utilisateur");
  }
}

document.getElementById("saveUserEditBtn")?.addEventListener("click", () => {
  saveUserEdit();
});
document.getElementById("cancelUserEditBtn")?.addEventListener("click", () => {
  closeUserEditModal();
});

async function loadUsersEntityFilter() {
  const wrap = document.getElementById("usersEntityFilterWrap");
  const select = document.getElementById("usersEntityFilter");
  if (!wrap || !select || adminMode !== "general") {
    wrap?.classList.add("field-hidden");
    return;
  }

  wrap.classList.remove("field-hidden");
  select.replaceChildren();

  const allOpt = document.createElement("option");
  allOpt.value = "all";
  allOpt.textContent = "Toutes les entités";
  select.appendChild(allOpt);

  const entitiesSnap = await getDocs(collection(db, ADMIN_COLLECTIONS.entities));
  entitiesSnap.forEach(entityDoc => {
    const entity = entityDoc.data();
    if (entity.isActive === false) {
      return;
    }
    const opt = document.createElement("option");
    opt.value = entityDoc.id;
    opt.textContent = entity.name || entityDoc.id;
    select.appendChild(opt);
  });

  select.value = usersEntityFilterId;
  if (select.dataset.nsonoBound === "1") {
    return;
  }
  select.dataset.nsonoBound = "1";
  select.addEventListener("change", () => {
    usersEntityFilterId = select.value || "all";
    loadUsers();
  });
}

/* =========================
   AUTH
========================= */

onAuthStateChanged(auth, async (user) => {

  if (!user) {

    window.location.href =
      "../login.html";

    return;
  }

  currentUserId = user.uid;

  try {
    await restoreNsonoSession(user.uid);

    const userRef =
      doc(db, "users", currentUserId);

    const userSnap =
      await getDoc(userRef);

    if (!userSnap.exists()) {

      alert("Utilisateur introuvable");

      return;
    }

    const userData =
      userSnap.data();

    const ctx = getEntityContext();
    const entitySettingsId = getEntitySettingsId(ctx.entityId);
    adminMode = isMasterAdmin() ? "general" : "entity";
    activeSettingsId = adminMode === "general"
      ? getGlobalSettingsId()
      : entitySettingsId;

    const permissions = await loadUserPermissions(currentUserId);
    currentPermissions = permissions;
    const canManageSettings = canAccessAdmin(permissions)
      || hasScope("scope_settings", permissions);

    if (!canManageSettings) {

      document.body.replaceChildren();

      const denied =
        document.createElement("div");

      denied.style.minHeight = "100vh";

      denied.style.display = "flex";
      denied.style.justifyContent =
        "center";
      denied.style.alignItems =
        "center";

      denied.style.background = "#111";
      denied.style.color = "#fff";

      denied.style.fontSize = "20px";
      denied.style.fontWeight = "700";

      denied.textContent =
        "⛔ Accès refusé";

      document.body.appendChild(denied);

      return;
    }

    initLockModeUI();
    await loadEntitySettingsSelector();

    if (!canAccessAdmin(permissions)) {
      document.getElementById("usersSection")?.remove();
      await loadAppConfig();
      return;
    }

    const usersSection = document.getElementById("usersSection");
    if (usersSection) {
      const usersHeading = usersSection.querySelector("p");
      if (usersHeading) {
        usersHeading.textContent = adminMode === "entity"
          ? "Gérez les utilisateurs de votre entité."
          : "Gérez les utilisateurs : entité, rôle et statut.";
      }
    }

    document.getElementById("addUserBtn")?.setAttribute("hidden", "hidden");

    await loadEntityNameMap();
    await loadRoleDefinitions();

    if (adminMode === "general") {
      await loadUsersEntityFilter();
    } else {
      document.getElementById("usersEntityFilterWrap")?.classList.add("field-hidden");
    }

    await loadUsers();
    await loadAppConfig();

  } catch (err) {

    console.error(err);

    alert(
      "Erreur chargement utilisateur"
    );
  }

});

/* =========================
   LOAD USERS
========================= */

async function loadUsers() {

  try {

    showLoading(true);  

    usersTableBody.replaceChildren();  

    const snapshot =  
      await getDocs(usersCollection);  

    if (snapshot.empty) {  

      showEmpty(true);  

      showLoading(false);  

      return;  
    }  

    showEmpty(false);

    const rows = [];
    snapshot.forEach(docSnap => rows.push({ id: docSnap.id, ...docSnap.data() }));

    const ctx = getEntityContext();
    let filteredRows = rows;

    if (adminMode === "entity" && ctx.entityId) {
      filteredRows = rows.filter(row => row.entityId === ctx.entityId);
    } else if (usersEntityFilterId !== "all") {
      filteredRows = rows.filter(row => row.entityId === usersEntityFilterId);
    }

    if (!filteredRows.length) {
      showEmpty(true);
      showLoading(false);
      return;
    }

    filteredRows.forEach((data) => {

      const userId = data.id || data.userId;
      const tr = document.createElement("tr");  

      /* ---------- NAME ---------- */  
      const nameTd = document.createElement("td");  
      nameTd.textContent = sanitizeText(data.name || "-");  

      /* ---------- EMAIL ---------- */
      const emailTd = document.createElement("td");
      emailTd.textContent = sanitizeText(data.email || "-");

      /* ---------- ENTITY ---------- */
      const entityTd = document.createElement("td");
      entityTd.textContent = resolveEntityLabel(data.entityId);

      /* ---------- ROLE ---------- */
      const roleTd = document.createElement("td");
      roleTd.appendChild(createBadge(data.role || "seller"));
      const roleIds = Array.isArray(data.roleIds) ? data.roleIds : [];
      if (roleIds.length) {
        const rolesMeta = document.createElement("div");
        rolesMeta.style.fontSize = "11px";
        rolesMeta.style.color = "#888";
        rolesMeta.textContent = `${roleIds.length} rôle(s) dyn.`;
        roleTd.appendChild(rolesMeta);
      }

      /* ---------- STATUS ---------- */  
      const statusTd = document.createElement("td");  
      const status = document.createElement("span");  
      status.className = "status-badge";  

      if (data.approvalStatus === "pending") {
        status.textContent = "En attente";
        status.classList.add("inactive");
      } else if (data.approvalStatus === "rejected") {
        status.textContent = "Refusé";
        status.classList.add("inactive");
      } else if (data.isActive === false) {  
        status.textContent = "Désactivé";  
        status.classList.add("inactive");  
      } else {  
        status.textContent = "Actif";  
        status.classList.add("active");  
      }  
      statusTd.appendChild(status);  

      /* ---------- ACTIONS ---------- */
      const actionsTd = document.createElement("td");
      actionsTd.className = "actions";

      const copyBtn = createCopyButton("Copier UID", userId, copied => {
        showMessage(copied ? "UID copié." : "Copie impossible.");
      });

      const manageBtn = createButton("Gérer", "btn-action");
      bindActionButton(manageBtn, () => openUserEditModal(data));

      /* STATUS BUTTON */
      const statusBtn = createButton(
        data.isActive === false ? "Activer" : "Désactiver",
        data.isActive === false ? "btn-success" : "btn-warning"
      );  
      bindActionButton(statusBtn, async () => {
        try {
          await updateData(doc(db, "users", userId), {
            isActive: data.isActive === false,
            updatedAt: serverTimestamp()
          });
          await writeLog({
            userId: currentUserId,
            action: "user_status_update",
            targetId: userId,
            details: { isActive: data.isActive === false }
          });
          showMessage("Utilisateur mis à jour");
          loadUsers();
        } catch (err) {
          console.error(err);
          alert("Erreur statut utilisateur");
        }
      });  

      if (data.approvalStatus === "pending" && adminMode === "general") {
        const approveBtn = createButton("Approuver", "btn-success");
        bindActionButton(approveBtn, async () => {
          openUserEditModal(data);
          showMessage("Assignez une entité puis enregistrez pour approuver");
        });
        actionsTd.appendChild(approveBtn);
      }

      /* DELETE BUTTON */  
      const deleteBtn = createButton("Supprimer", "btn-danger");  
      bindActionButton(deleteBtn, async () => {
        if (userId === currentUserId) {
          alert("Impossible de supprimer ton compte");
          return;
        }
        const confirmDelete = await showConfirmModal(
          "Supprimer utilisateur",
          "Supprimer cet utilisateur ?"
        );
        if (!confirmDelete) return;

        try {
          const metaRef = doc(db, "system", "meta");
          const metaSnap = await getDoc(metaRef);
          const currentCount = metaSnap.exists()
            ? Number(metaSnap.data().usersCount) || 0
            : 0;

          await deleteData(doc(db, "users", userId));

          if (metaSnap.exists() && currentCount > 0) {
            await updateData(metaRef, {
              usersCount: currentCount - 1
            });
          }

          await writeLog({
            userId: currentUserId,
            action: "user_delete",
            targetId: userId
          });
          showMessage("Utilisateur supprimé");
          loadUsers();
        } catch (err) {
          console.error(err);
          alert("Erreur suppression");
        }
      });  

      actionsTd.appendChild(copyBtn);
      actionsTd.appendChild(manageBtn);
      actionsTd.appendChild(statusBtn);
      actionsTd.appendChild(deleteBtn);

      tr.appendChild(nameTd);
      tr.appendChild(emailTd);
      tr.appendChild(entityTd);
      tr.appendChild(roleTd);
      tr.appendChild(statusTd);
      tr.appendChild(actionsTd);

      usersTableBody.appendChild(tr);
    });
  } catch (err) {
    console.error(err);  
    alert("Erreur chargement utilisateurs");

  } finally {
    showLoading(false);
  }

}
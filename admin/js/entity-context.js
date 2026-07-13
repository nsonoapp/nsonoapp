const STORAGE_ENTITY_ID = "nsono_entityId";
const STORAGE_IS_MASTER = "nsono_isMasterAdmin";
const STORAGE_MASTER_VIEW = "nsono_masterViewEntityId";

export function setEntityContext({ companyId, entityId = null, isMasterAdmin = false } = {}) {
  if (companyId) {
    localStorage.setItem("nsono_companyId", companyId);
  }
  if (isMasterAdmin) {
    localStorage.removeItem(STORAGE_ENTITY_ID);
  } else if (entityId) {
    localStorage.setItem(STORAGE_ENTITY_ID, entityId);
  } else {
    localStorage.removeItem(STORAGE_ENTITY_ID);
  }
  localStorage.setItem(STORAGE_IS_MASTER, isMasterAdmin ? "1" : "0");
}

export function getEntityContext() {
  return {
    companyId: localStorage.getItem("nsono_companyId") || null,
    entityId: localStorage.getItem(STORAGE_ENTITY_ID) || null,
    isMasterAdmin: localStorage.getItem(STORAGE_IS_MASTER) === "1"
  };
}

export function getMasterEntityView() {
  const value = localStorage.getItem(STORAGE_MASTER_VIEW);
  return value ? String(value).trim() : null;
}

export function setMasterEntityView(entityId = null) {
  const value = String(entityId || "").trim();
  if (value) {
    localStorage.setItem(STORAGE_MASTER_VIEW, value);
  } else {
    localStorage.removeItem(STORAGE_MASTER_VIEW);
  }
  window.dispatchEvent(new CustomEvent("nsono:entity-view-changed", {
    detail: { entityId: value || null }
  }));
}

export function getActiveEntityId() {
  const ctx = getEntityContext();
  if (ctx.isMasterAdmin) {
    return getMasterEntityView();
  }
  return ctx.entityId;
}

export function getRequiredEntityId() {
  const entityId = getActiveEntityId();
  return entityId ? String(entityId).trim() : null;
}

export function isMasterAdmin() {
  return getEntityContext().isMasterAdmin;
}

export function clearEntityContext() {
  localStorage.removeItem(STORAGE_ENTITY_ID);
  localStorage.removeItem(STORAGE_IS_MASTER);
  localStorage.removeItem(STORAGE_MASTER_VIEW);
  localStorage.removeItem("nsono_companyId");
}

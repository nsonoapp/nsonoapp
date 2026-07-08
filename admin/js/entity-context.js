const STORAGE_ENTITY_ID = "nsono_entityId";
const STORAGE_IS_MASTER = "nsono_isMasterAdmin";

export function setEntityContext({ companyId, entityId = null, isMasterAdmin = false } = {}) {
  if (companyId) {
    localStorage.setItem("nsono_companyId", companyId);
  }
  if (entityId) {
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

export function getActiveEntityId() {
  const ctx = getEntityContext();
  if (ctx.isMasterAdmin && !ctx.entityId) {
    return null;
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
}

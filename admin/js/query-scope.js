import { where } from "../../js/firebase.js";
import { getEntityContext } from "./entity-context.js";

let scopeEntityOverride = null;

export function setScopeEntityOverride(entityId = null) {
  const value = String(entityId || "").trim();
  scopeEntityOverride = value || null;
}

export function clearScopeEntityOverride() {
  scopeEntityOverride = null;
}

export function getEntityScopeConstraints(fieldName = "entityId") {
  const ctx = getEntityContext();

  if (!ctx.companyId && !ctx.isMasterAdmin) {
    return [];
  }

  const constraints = [];

  if (!ctx.isMasterAdmin && ctx.companyId) {
    constraints.push(where("companyId", "==", ctx.companyId));
  }

  if (ctx.isMasterAdmin && scopeEntityOverride) {
    constraints.push(where(fieldName, "==", scopeEntityOverride));
  } else if (!ctx.isMasterAdmin && ctx.entityId) {
    constraints.push(where(fieldName, "==", ctx.entityId));
  }

  return constraints;
}

export function applyEntityScope(baseConstraints = [], fieldName = "entityId") {
  return [...baseConstraints, ...getEntityScopeConstraints(fieldName)];
}

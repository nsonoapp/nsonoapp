import { where } from "../../js/firebase.js";
import { getEntityContext } from "./entity-context.js";

export function getEntityScopeConstraints(fieldName = "entityId") {
  const ctx = getEntityContext();

  if (!ctx.companyId) {
    return [];
  }

  const constraints = [where("companyId", "==", ctx.companyId)];

  if (!ctx.isMasterAdmin && ctx.entityId) {
    constraints.push(where(fieldName, "==", ctx.entityId));
  }

  return constraints;
}

export function applyEntityScope(baseConstraints = [], fieldName = "entityId") {
  return [...baseConstraints, ...getEntityScopeConstraints(fieldName)];
}

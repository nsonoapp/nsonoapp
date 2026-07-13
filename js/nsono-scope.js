export { getEntityScopeConstraints, applyEntityScope } from "../admin/js/query-scope.js";
export { getEntityContext, setEntityContext, isMasterAdmin, getActiveEntityId } from "../admin/js/entity-context.js";
export { SINGLE_COMPANY_ID } from "../admin/js/admin-collections.js";

import { getEntityContext, getActiveEntityId } from "../admin/js/entity-context.js";
import { SINGLE_COMPANY_ID } from "../admin/js/admin-collections.js";

export function withEntityScope(payload = {}) {
  const ctx = getEntityContext();
  const companyId = ctx.companyId || SINGLE_COMPANY_ID;

  const scoped = {
    ...payload,
    companyId
  };

  const activeEntityId = getActiveEntityId();
  if (activeEntityId) {
    scoped.entityId = activeEntityId;
  } else if (ctx.entityId) {
    scoped.entityId = ctx.entityId;
  }

  return scoped;
}

import { db, doc, getDoc, collection, query, where, getDocs } from "../../js/firebase.js";
import { ADMIN_COLLECTIONS } from "./admin-collections.js";
import { getEntityContext } from "./entity-context.js";

let cachedPermissions = {
  scopes: [],
  roleIds: [],
  loadedAt: 0
};

const CACHE_TTL_MS = 60_000;

export function clearPermissionsCache() {
  cachedPermissions = { scopes: [], roleIds: [], loadedAt: 0 };
}

function mergeScopes(roles) {
  const set = new Set();
  roles.forEach(role => {
    (role.scopes || []).forEach(scope => set.add(scope));
  });
  return Array.from(set);
}

export async function loadUserPermissions(uid) {
  if (!uid) {
    return { scopes: [], roleIds: [], profile: null };
  }

  const now = Date.now();
  if (cachedPermissions.loadedAt && now - cachedPermissions.loadedAt < CACHE_TTL_MS) {
    return cachedPermissions;
  }

  const profileSnap = await getDoc(doc(db, ADMIN_COLLECTIONS.users, uid));
  if (!profileSnap.exists()) {
    cachedPermissions = { scopes: [], roleIds: [], profile: null, loadedAt: now };
    return cachedPermissions;
  }

  const profile = { id: profileSnap.id, ...profileSnap.data() };
  const roleIds = Array.isArray(profile.roleIds) ? profile.roleIds : [];

  if (!roleIds.length) {
    const legacyScopes = profile.role === "admin"
      ? ["scope_admin", "scope_entities", "scope_roles", "scope_approvals", "scope_stats", "scope_settings"]
      : ["scope_sales"];
    cachedPermissions = { scopes: legacyScopes, roleIds: [], profile, loadedAt: now };
    return cachedPermissions;
  }

  const roles = [];
  for (const roleId of roleIds) {
    const roleSnap = await getDoc(doc(db, ADMIN_COLLECTIONS.roles, roleId));
    if (roleSnap.exists() && roleSnap.data().isActive !== false) {
      roles.push({ id: roleSnap.id, ...roleSnap.data() });
    }
  }

  const scopes = mergeScopes(roles);
  cachedPermissions = { scopes, roleIds, profile, loadedAt: now };
  return cachedPermissions;
}

export function hasScope(scope, permissions) {
  const list = permissions?.scopes || [];
  return list.includes(scope) || list.includes("scope_admin");
}

export function hasAnyScope(scopes, permissions) {
  return scopes.some(scope => hasScope(scope, permissions));
}

export function canAccessAdmin(permissions) {
  return hasAnyScope(
    ["scope_admin", "scope_entities", "scope_roles", "scope_approvals"],
    permissions
  );
}

export function assertCompanyScope(profile) {
  const ctx = getEntityContext();
  if (!ctx.companyId) {
    return true;
  }
  if (!profile?.companyId) {
    return true;
  }
  return profile.companyId === ctx.companyId;
}

import { db, doc, getDoc } from "../../js/firebase.js";
import { ADMIN_COLLECTIONS } from "./admin-collections.js";
import { getEntityContext, isMasterAdmin } from "./entity-context.js";
import { getSingleCompany, isCompanyGeneralAdmin } from "./company-auth.js";
import { KNOWN_SCOPES } from "./admin-constants.js";

let cachedPermissions = {
  scopes: [],
  roleIds: [],
  loadedAt: 0
};

const CACHE_TTL_MS = 60_000;

const LEGACY_ADMIN_SCOPES = [
  "scope_admin",
  "scope_entities",
  "scope_roles",
  "scope_approvals",
  "scope_stats",
  "scope_settings",
  "scope_sales",
  "scope_tools"
];

const LEGACY_SELLER_SCOPES = ["scope_sales"];

const MASTER_FULL_SCOPES = [
  ...KNOWN_SCOPES.map(scope => scope.id),
  "scope_tools"
];

export function clearPermissionsCache() {
  cachedPermissions = { scopes: [], roleIds: [], loadedAt: 0 };
}

function mergeScopeLists(...lists) {
  const set = new Set();
  lists.flat().forEach(scope => {
    if (scope) {
      set.add(scope);
    }
  });
  return Array.from(set);
}

function mergeScopes(roles) {
  return mergeScopeLists(
    roles.map(role => role.scopes || [])
  );
}

async function isGeneralAdminUser(uid) {
  if (!uid) {
    return false;
  }

  if (isMasterAdmin()) {
    return true;
  }

  try {
    const company = await getSingleCompany();
    return isCompanyGeneralAdmin(company, uid);
  } catch {
    return false;
  }
}

function buildLegacyScopes(profile) {
  if (profile?.role === "admin") {
    return [...LEGACY_ADMIN_SCOPES];
  }
  if (profile?.role === "seller") {
    return [...LEGACY_SELLER_SCOPES];
  }
  return [];
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

  if (await isGeneralAdminUser(uid)) {
    cachedPermissions = {
      scopes: [...MASTER_FULL_SCOPES],
      roleIds,
      profile,
      loadedAt: now
    };
    return cachedPermissions;
  }

  const legacyScopes = buildLegacyScopes(profile);

  if (!roleIds.length) {
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

  const scopes = mergeScopeLists(mergeScopes(roles), legacyScopes);
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

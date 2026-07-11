import {
  db,
  doc,
  getDoc,
  collection,
  getDocs,
  setDoc,
  deleteDoc,
  Timestamp
} from "../../js/firebase.js";
import { getAuth } from "../../js/auth.js";
import { ADMIN_COLLECTIONS, SINGLE_COMPANY_ID } from "./admin-collections.js";

const STORAGE_COMPANY_ID = "nsono_companyId";
const STORAGE_COMPANY_NAME = "nsono_companyName";

export { SINGLE_COMPANY_ID };

function normalizeLookupKey(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
}

export async function hashCompanyPassword(plainPassword) {
  const value = String(plainPassword || "");
  if (!value) {
    return "";
  }

  const encoded = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(digest))
    .map(byte => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function getSingleCompany() {
  const snap = await getDoc(doc(db, ADMIN_COLLECTIONS.companies, SINGLE_COMPANY_ID));
  if (!snap.exists()) {
    return null;
  }
  return { id: snap.id, ...snap.data() };
}

export async function hasSingleCompany() {
  const company = await getSingleCompany();
  return company !== null;
}

export async function resolveCompanyByNameOrCode(identifier) {
  const company = await getSingleCompany();
  if (!company) {
    return null;
  }

  const key = normalizeLookupKey(identifier);
  if (!key) {
    return company;
  }

  if (
    normalizeLookupKey(company.name) === key ||
    normalizeLookupKey(company.companyCode) === key
  ) {
    return company;
  }

  return null;
}

export async function resolveEntityByName(companyId, entityIdentifier) {
  const key = String(entityIdentifier || "").trim();
  const normalizedKey = normalizeLookupKey(entityIdentifier);
  if (!companyId || !key) {
    return null;
  }

  const byId = await getDoc(doc(db, ADMIN_COLLECTIONS.entities, key));
  if (byId.exists()) {
    const data = byId.data();
    if (data.companyId === companyId && data.isActive !== false) {
      return { id: byId.id, ...data };
    }
  }

  const snap = await getDocs(collection(db, ADMIN_COLLECTIONS.entities));
  for (const item of snap.docs) {
    const data = item.data();
    if (
      data.companyId === companyId &&
      data.isActive !== false &&
      normalizeLookupKey(data.name) === normalizedKey
    ) {
      return { id: item.id, ...data };
    }
  }

  return null;
}

async function cleanupAuthProbe(probeRef) {
  try {
    await deleteDoc(probeRef);
  } catch {
    /* nettoyage best-effort */
  }
}

async function probePasswordMatch(collectionName, probePayload) {
  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return { ok: false, reason: "auth_required" };
  }

  const probeRef = doc(collection(db, collectionName));

  try {
    await setDoc(probeRef, {
      ...probePayload,
      uid,
      createdAt: Timestamp.now()
    });
    await cleanupAuthProbe(probeRef);
    return { ok: true };
  } catch (err) {
    await cleanupAuthProbe(probeRef);
    const code = err?.code || "";
    if (code === "permission-denied") {
      return { ok: false, reason: "password_mismatch_or_missing_secret" };
    }
    return { ok: false, reason: "probe_failed" };
  }
}

export async function verifyCompanyPasswordViaRules(companyId, plainPassword) {
  if (companyId !== SINGLE_COMPANY_ID) {
    return false;
  }

  const passwordHash = await hashCompanyPassword(plainPassword);
  if (!passwordHash) {
    return false;
  }

  const result = await probePasswordMatch(ADMIN_COLLECTIONS.companyAuthProbes, {
    companyId: SINGLE_COMPANY_ID,
    passwordHash
  });
  return result.ok;
}

export async function verifyEntityPasswordViaRules(entityId, plainPassword) {
  const targetId = String(entityId || "").trim();
  if (!targetId) {
    return false;
  }

  const passwordHash = await hashCompanyPassword(plainPassword);
  if (!passwordHash) {
    return false;
  }

  const result = await probePasswordMatch(ADMIN_COLLECTIONS.entityAuthProbes, {
    entityId: targetId,
    passwordHash
  });
  return result.ok;
}

export function isCompanyGeneralAdmin(company, userId) {
  const uid = String(userId || "").trim();
  if (!company || !uid) {
    return false;
  }

  const masterAdminIds = Array.isArray(company.masterAdminIds)
    ? company.masterAdminIds
    : [];

  return masterAdminIds.includes(uid) || company.masterAdminId === uid;
}

export async function resolveCompanyAccess({
  companyIdentifier,
  companyPassword,
  entityIdentifier,
  entityPassword,
  userId = null
}) {
  const company = await getSingleCompany();
  if (!company) {
    return { ok: false, error: "company_not_found", company: null };
  }

  const key = String(companyIdentifier || "").trim();
  if (!key) {
    return { ok: false, error: "company_required", company: null };
  }

  const matched = await resolveCompanyByNameOrCode(key);
  if (!matched) {
    return { ok: false, error: "company_not_found", company: null };
  }

  const effectiveUserId = String(
    userId || getAuth().currentUser?.uid || ""
  ).trim();
  const isGeneralAdmin = isCompanyGeneralAdmin(matched, effectiveUserId);

  const companyPasswordValue = String(companyPassword || "");
  if (!companyPasswordValue) {
    return { ok: false, error: "company_password_required", company: null };
  }

  const companyPasswordOk = await verifyCompanyPasswordViaRules(
    SINGLE_COMPANY_ID,
    companyPasswordValue
  );
  if (!companyPasswordOk) {
    return { ok: false, error: "company_password_invalid", company: null };
  }

  if (isGeneralAdmin) {
    return {
      ok: true,
      company: matched,
      entity: null,
      isGeneralAdmin: true
    };
  }

  const entityKey = String(entityIdentifier || "").trim();
  if (!entityKey) {
    return { ok: false, error: "entity_required", company: null };
  }

  const entity = await resolveEntityByName(SINGLE_COMPANY_ID, entityKey);
  if (!entity) {
    return { ok: false, error: "entity_not_found", company: null };
  }

  const entityPasswordValue = String(entityPassword || "");
  if (!entityPasswordValue) {
    return { ok: false, error: "entity_password_required", company: null };
  }

  const entityPasswordOk = await verifyEntityPasswordViaRules(
    entity.id,
    entityPasswordValue
  );
  if (!entityPasswordOk) {
    return { ok: false, error: "entity_password_invalid", company: null };
  }

  return { ok: true, company: matched, entity, isGeneralAdmin: false };
}

export function storeCompanySession(companyId, companyName) {
  localStorage.setItem(STORAGE_COMPANY_ID, companyId);
  localStorage.setItem(STORAGE_COMPANY_NAME, companyName || "");
}

export function getStoredCompanyId() {
  return localStorage.getItem(STORAGE_COMPANY_ID) || SINGLE_COMPANY_ID;
}

export function getStoredCompanyName() {
  return localStorage.getItem(STORAGE_COMPANY_NAME) || "";
}

export function clearCompanySession() {
  localStorage.removeItem(STORAGE_COMPANY_ID);
  localStorage.removeItem(STORAGE_COMPANY_NAME);
}

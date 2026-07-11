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

  const key = String(identifier || "").trim();
  if (!key) {
    return company;
  }

  if (company.name === key || company.companyCode === key) {
    return company;
  }

  return null;
}

export async function resolveEntityByName(companyId, entityIdentifier) {
  const key = String(entityIdentifier || "").trim();
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
      String(data.name || "").trim() === key
    ) {
      return { id: item.id, ...data };
    }
  }

  return null;
}

async function hasCompanySecret() {
  const snap = await getDoc(
    doc(db, ADMIN_COLLECTIONS.companySecrets, SINGLE_COMPANY_ID)
  );
  return snap.exists();
}

async function cleanupAuthProbe(probeRef) {
  try {
    await deleteDoc(probeRef);
  } catch {
    /* nettoyage best-effort */
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

  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return false;
  }

  const probeRef = doc(collection(db, ADMIN_COLLECTIONS.companyAuthProbes));

  try {
    await setDoc(probeRef, {
      companyId: SINGLE_COMPANY_ID,
      passwordHash,
      uid,
      createdAt: Timestamp.now()
    });
    await cleanupAuthProbe(probeRef);
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H4',location:'company-auth.js:verifyCompany:ok',message:'company password probe OK',data:{hashLen:passwordHash.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return true;
  } catch (err) {
    await cleanupAuthProbe(probeRef);
    const secretSnap = await getDoc(doc(db, ADMIN_COLLECTIONS.companySecrets, SINGLE_COMPANY_ID));
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H4',location:'company-auth.js:verifyCompany:fail',message:'company password probe FAIL',data:{secretExists:secretSnap.exists(),storedLen:secretSnap.exists()?String(secretSnap.data()?.passwordHash||'').length:0,hashLen:passwordHash.length,code:err?.code||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return false;
  }
}

export async function verifyEntityPasswordViaRules(entityId, plainPassword) {
  const targetId = String(entityId || "").trim();
  if (!targetId) {
    return false;
  }

  const secretSnap = await getDoc(doc(db, ADMIN_COLLECTIONS.entitySecrets, targetId));
  const secretExists = secretSnap.exists();
  const storedLen = secretSnap.exists() ? String(secretSnap.data()?.passwordHash || "").length : 0;

  const passwordHash = await hashCompanyPassword(plainPassword);
  if (!passwordHash) {
    return false;
  }

  const auth = getAuth();
  const uid = auth.currentUser?.uid;
  if (!uid) {
    return false;
  }

  const probeRef = doc(collection(db, ADMIN_COLLECTIONS.entityAuthProbes));

  try {
    await setDoc(probeRef, {
      entityId: targetId,
      passwordHash,
      uid,
      createdAt: Timestamp.now()
    });
    await cleanupAuthProbe(probeRef);
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H3',location:'company-auth.js:verifyEntity:ok',message:'entity password probe OK',data:{entityId:targetId,secretExists,storedLen,hashLen:passwordHash.length},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return true;
  } catch (err) {
    await cleanupAuthProbe(probeRef);
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H3',location:'company-auth.js:verifyEntity:fail',message:'entity password probe FAIL',data:{entityId:targetId,secretExists,storedLen,hashLen:passwordHash.length,code:err?.code||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return false;
  }
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

  const secretExists = await hasCompanySecret();
  if (!secretExists) {
    return { ok: false, error: "company_password_invalid", company: null };
  }

  const companyPasswordOk = await verifyCompanyPasswordViaRules(
    matched.id,
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

  const entity = await resolveEntityByName(matched.id, entityKey);
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
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H3',location:'company-auth.js:resolveCompanyAccess',message:'entity password rejected at login gate',data:{entityId:entity.id,entityName:entity.name||null},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return { ok: false, error: "entity_password_invalid", company: null };
  }

  return { ok: true, company: matched, entity };
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

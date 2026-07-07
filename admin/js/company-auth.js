import {
  db,
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  limit,
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
    await deleteDoc(probeRef);
    return true;
  } catch {
    try {
      await deleteDoc(probeRef);
    } catch {
      /* sonde refusée */
    }
    return false;
  }
}

export async function resolveCompanyAccess(companyIdentifier) {
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

  return { ok: true, company: matched };
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

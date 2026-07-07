import {
  db,
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  runTransaction
} from "../firebase.js";
import { withEntityScope } from "../nsono-scope.js";

const LOCK_KEY = "appLocked";

export function isAppLocked() {
  return localStorage.getItem(LOCK_KEY) === "true";
}

export function setAppLocked(locked) {
  localStorage.setItem(LOCK_KEY, locked ? "true" : "false");
  window.dispatchEvent(new CustomEvent("nsono:lock-changed", {
    detail: { locked: locked === true }
  }));
}

export function assertWritable() {
  if (isAppLocked()) {
    const err = new Error("app_locked");
    err.code = "app_locked";
    throw err;
  }
}

export function handleWriteError(err, fallback = "Erreur lors de l'enregistrement.") {
  if (err?.code === "app_locked" || err?.message === "app_locked") {
    alert("Action bloquée sur cet appareil (mode verrouillé).");
    return true;
  }
  return false;
}

function applyScope(data, options = {}) {
  if (options.scope === false) {
    return data;
  }
  return withEntityScope(data);
}

export async function addData(collectionName, data, options = {}) {
  assertWritable();
  const payload = applyScope(data, options);
  return addDoc(collection(db, collectionName), payload);
}

export async function setData(collectionName, docId, data, options = {}) {
  assertWritable();
  const payload = applyScope(data, options);
  return setDoc(doc(db, collectionName, docId), payload, options.merge ? { merge: true } : undefined);
}

export async function updateData(docRef, data) {
  assertWritable();
  return updateDoc(docRef, data);
}

export async function deleteData(docRef) {
  assertWritable();
  return deleteDoc(docRef);
}

export async function runGuardedBatch(mutator) {
  assertWritable();
  const batch = writeBatch(db);
  await mutator(batch);
  return batch.commit();
}

export async function runGuardedTransaction(mutator) {
  assertWritable();
  return runTransaction(db, mutator);
}

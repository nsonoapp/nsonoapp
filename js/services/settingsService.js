import { db, doc, getDoc, setDoc, serverTimestamp } from "../firebase.js";
import { updateData } from "./firebaseService.js";
import { getEntityContext } from "../../admin/js/entity-context.js";
import { SINGLE_COMPANY_ID } from "../../admin/js/admin-collections.js";

const GLOBAL_SETTINGS_ID = "main_config";

export function getGlobalSettingsId() {
  return GLOBAL_SETTINGS_ID;
}

export function getEntitySettingsId(entityId) {
  return entityId ? `entity_${entityId}` : GLOBAL_SETTINGS_ID;
}

export async function loadSettings(settingsId = GLOBAL_SETTINGS_ID) {
  const ref = doc(db, "settings", settingsId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    return { id: settingsId, exists: false, data: null };
  }
  return { id: snap.id, exists: true, data: snap.data() };
}

export async function saveSettings(settingsId, payload) {
  const ref = doc(db, "settings", settingsId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    return setDoc(ref, {
      ...payload,
      companyId: SINGLE_COMPANY_ID,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  return updateData(ref, {
    ...payload,
    updatedAt: serverTimestamp()
  });
}

export function resolveActiveSettingsId() {
  const ctx = getEntityContext();
  if (ctx.isMasterAdmin) {
    return GLOBAL_SETTINGS_ID;
  }
  return getEntitySettingsId(ctx.entityId);
}

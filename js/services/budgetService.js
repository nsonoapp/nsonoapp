import { db, doc, getDoc } from "../firebase.js";

export const BUDGET_DOC_ID = "budget_monitor";

export const SPARK_LIMITS = {
  readsDaily: 50000,
  writesDaily: 20000,
  storageBytes: 1024 * 1024 * 1024
};

const WARNING_RATIO = 0.75;
const DANGER_RATIO = 0.9;

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function usageRatio(used, limit) {
  if (!limit || limit <= 0) {
    return 0;
  }
  return used / limit;
}

function levelFromRatio(ratioValue) {
  if (ratioValue >= DANGER_RATIO) {
    return "danger";
  }
  if (ratioValue >= WARNING_RATIO) {
    return "warning";
  }
  return "ok";
}

function worstLevel(...levels) {
  if (levels.includes("danger")) {
    return "danger";
  }
  if (levels.includes("warning")) {
    return "warning";
  }
  return "ok";
}

export function formatBytes(bytes) {
  const value = toNumber(bytes);
  if (value < 1024) {
    return `${Math.round(value)} o`;
  }
  if (value < 1024 * 1024) {
    return `${(value / 1024).toFixed(1)} Ko`;
  }
  if (value < 1024 * 1024 * 1024) {
    return `${(value / (1024 * 1024)).toFixed(1)} Mo`;
  }
  return `${(value / (1024 * 1024 * 1024)).toFixed(2)} Go`;
}

export function formatCount(value) {
  return new Intl.NumberFormat("fr-FR").format(Math.round(toNumber(value)));
}

export function evaluateMetricStatus(used, limit) {
  const ratioValue = usageRatio(used, limit);
  return {
    ratio: ratioValue,
    level: levelFromRatio(ratioValue),
    percent: Math.min(100, Math.round(ratioValue * 100))
  };
}

function buildStatusMessage(status) {
  if (status === "danger") {
    return "Attention : consommation proche ou au-delà des seuils du quota gratuit Firebase.";
  }
  if (status === "warning") {
    return "Surveillance recommandée : la consommation approche les limites du quota Spark.";
  }
  return "Consommation dans les limites normales du quota Spark.";
}

export async function loadBudgetMetrics() {
  const snap = await getDoc(doc(db, "system", BUDGET_DOC_ID));

  const defaults = {
    readsLimit: SPARK_LIMITS.readsDaily,
    writesLimit: SPARK_LIMITS.writesDaily,
    storageLimitBytes: SPARK_LIMITS.storageBytes
  };

  if (!snap.exists()) {
    return {
      synced: false,
      readsDaily: null,
      writesDaily: null,
      storageBytes: null,
      ...defaults,
      readsRatio: 0,
      writesRatio: 0,
      storageRatio: 0,
      readsStatus: "ok",
      writesStatus: "ok",
      storageStatus: "ok",
      status: "unsynced",
      updatedAt: null,
      source: null,
      message: "Données non synchronisées. Consultez la console Firebase pour l'usage réel."
    };
  }

  const data = snap.data();
  const readsDaily = toNumber(data.readsDaily);
  const writesDaily = toNumber(data.writesDaily);
  const storageBytes = toNumber(data.storageBytes);
  const readsLimit = toNumber(data.readsLimit) || defaults.readsLimit;
  const writesLimit = toNumber(data.writesLimit) || defaults.writesLimit;
  const storageLimitBytes = toNumber(data.storageLimitBytes) || defaults.storageLimitBytes;

  const readsRatio = usageRatio(readsDaily, readsLimit);
  const writesRatio = usageRatio(writesDaily, writesLimit);
  const storageRatio = usageRatio(storageBytes, storageLimitBytes);

  const readsStatus = levelFromRatio(readsRatio);
  const writesStatus = levelFromRatio(writesRatio);
  const storageStatus = levelFromRatio(storageRatio);
  const status = worstLevel(readsStatus, writesStatus, storageStatus);

  return {
    synced: true,
    readsDaily,
    writesDaily,
    storageBytes,
    readsLimit,
    writesLimit,
    storageLimitBytes,
    readsRatio,
    writesRatio,
    storageRatio,
    readsStatus,
    writesStatus,
    storageStatus,
    status,
    updatedAt: data.updatedAt?.toDate?.() || null,
    source: data.source || "unknown",
    message: buildStatusMessage(status)
  };
}

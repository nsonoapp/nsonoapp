import {
  loadBudgetMetrics,
  formatBytes,
  formatCount,
  evaluateMetricStatus
} from "../../js/services/budgetService.js";

const BILLING_URL = "https://console.cloud.google.com/billing";
const FIREBASE_USAGE_URL = "https://console.firebase.google.com/";
const REFRESH_MS = 5 * 60 * 1000;

let refreshTimer = null;
let helpModal = null;

function $(id) {
  return document.getElementById(id);
}

function setPanelLevel(level) {
  const panel = $("budgetPanel");
  if (!panel) {
    return;
  }
  panel.classList.remove("budget-ok", "budget-warning", "budget-danger", "budget-unsynced");
  panel.classList.add(`budget-${level}`);
}

function setCardLevel(card, level) {
  if (!card) {
    return;
  }
  card.classList.remove("budget-card-ok", "budget-card-warning", "budget-card-danger");
  card.classList.add(`budget-card-${level}`);
}

function formatUpdatedAt(date) {
  if (!date) {
    return "Dernière synchro : inconnue";
  }
  return `Dernière synchro : ${date.toLocaleString("fr-FR")}`;
}

function renderMetricCard(cardId, valueId, percentId, label, used, limit, level, formatter) {
  const card = $(cardId);
  const valueEl = $(valueId);
  const percentEl = $(percentId);
  if (!card || !valueEl || !percentEl) {
    return;
  }

  const metric = evaluateMetricStatus(used, limit);
  valueEl.textContent = `${formatter(used)} / ${formatter(limit)}`;
  percentEl.textContent = `${metric.percent}% — ${label}`;
  setCardLevel(card, level);
}

function renderUnsyncedCards() {
  const cards = [
    ["budgetReadsCard", "budgetReadsValue", "budgetReadsPercent", "Lectures"],
    ["budgetWritesCard", "budgetWritesValue", "budgetWritesPercent", "Écritures"],
    ["budgetStorageCard", "budgetStorageValue", "budgetStoragePercent", "Stockage"]
  ];

  cards.forEach(([cardId, valueId, percentId, label]) => {
    const card = $(cardId);
    const valueEl = $(valueId);
    const percentEl = $(percentId);
    if (!card || !valueEl || !percentEl) {
      return;
    }
    valueEl.textContent = "—";
    percentEl.textContent = `${label} : non synchronisé`;
    setCardLevel(card, "ok");
  });
}

function renderBudgetMetrics(metrics) {
  const alertTitle = $("budgetAlertTitle");
  const alertText = $("budgetAlertText");
  const meta = $("budgetMeta");

  if (!metrics.synced) {
    setPanelLevel("unsynced");
    if (alertTitle) {
      alertTitle.textContent = "ℹ️ Monitoring budget — données indisponibles";
    }
    if (alertText) {
      alertText.textContent = metrics.message;
    }
    renderUnsyncedCards();
    if (meta) {
      meta.textContent = "Source : console Firebase (synchronisation système non configurée).";
    }
    return;
  }

  setPanelLevel(metrics.status);

  if (alertTitle) {
    const titles = {
      ok: "✅ Quota Firebase sous contrôle",
      warning: "⚠️ Quota Firebase — surveillance requise",
      danger: "🚨 Quota Firebase — seuil critique"
    };
    alertTitle.textContent = titles[metrics.status] || titles.ok;
  }

  if (alertText) {
    alertText.textContent = metrics.message;
  }

  renderMetricCard(
    "budgetReadsCard",
    "budgetReadsValue",
    "budgetReadsPercent",
    "Lectures",
    metrics.readsDaily,
    metrics.readsLimit,
    metrics.readsStatus,
    formatCount
  );

  renderMetricCard(
    "budgetWritesCard",
    "budgetWritesValue",
    "budgetWritesPercent",
    "Écritures",
    metrics.writesDaily,
    metrics.writesLimit,
    metrics.writesStatus,
    formatCount
  );

  renderMetricCard(
    "budgetStorageCard",
    "budgetStorageValue",
    "budgetStoragePercent",
    "Stockage",
    metrics.storageBytes,
    metrics.storageLimitBytes,
    metrics.storageStatus,
    formatBytes
  );

  if (meta) {
    const sourceLabel = metrics.source === "cloud_sync"
      ? "cloud_sync"
      : metrics.source === "manual"
        ? "manuel"
        : metrics.source;
    meta.textContent = `${formatUpdatedAt(metrics.updatedAt)} — source : ${sourceLabel}`;
  }
}

function closeHelpModal() {
  if (!helpModal) {
    return;
  }
  helpModal.remove();
  helpModal = null;
  document.body.style.overflow = "";
}

function openHelpModal() {
  closeHelpModal();

  helpModal = document.createElement("div");
  helpModal.id = "budgetHelpModal";
  helpModal.className = "budget-modal-overlay";

  const dialog = document.createElement("div");
  dialog.className = "budget-modal";
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("aria-labelledby", "budgetHelpTitle");

  const title = document.createElement("h3");
  title.id = "budgetHelpTitle";
  title.textContent = "Aide — Gestion des quotas Firebase";

  const paragraphs = [
    "Ce module est informatif : il surveille reads, writes et stockage sans modifier les données métier.",
    "Les métriques officielles sont visibles dans Firebase Console > Usage, ou via Google Cloud Billing.",
    "Plan Spark (gratuit) : environ 50 000 lectures/jour, 20 000 écritures/jour, 1 Go de stockage Firestore.",
    "Si l'alerte passe en orange ou rouge, réduisez les lectures massives (stats, exports) et vérifiez la facturation.",
    "Pour une synchro automatique, un job backend (Cloud Function) pourra alimenter system/budget_monitor."
  ];

  const body = document.createElement("div");
  body.className = "budget-modal-body";
  paragraphs.forEach(text => {
    const p = document.createElement("p");
    p.textContent = text;
    body.appendChild(p);
  });

  const actions = document.createElement("div");
  actions.className = "budget-modal-actions";

  const usageBtn = document.createElement("button");
  usageBtn.type = "button";
  usageBtn.className = "action-btn secondary-btn";
  usageBtn.textContent = "Ouvrir Firebase Usage";
  usageBtn.addEventListener("click", () => {
    window.open(FIREBASE_USAGE_URL, "_blank", "noopener,noreferrer");
  });

  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "action-btn primary-btn";
  closeBtn.textContent = "Fermer";
  closeBtn.addEventListener("click", closeHelpModal);

  actions.append(usageBtn, closeBtn);
  dialog.append(title, body, actions);
  helpModal.appendChild(dialog);

  helpModal.addEventListener("click", event => {
    if (event.target === helpModal) {
      closeHelpModal();
    }
  });

  document.body.appendChild(helpModal);
  document.body.style.overflow = "hidden";
}

async function refreshBudgetMonitor() {
  try {
    const metrics = await loadBudgetMetrics();
    renderBudgetMetrics(metrics);
  } catch (err) {
    console.error("[budget-monitor] refresh error:", err);
    const alertText = $("budgetAlertText");
    if (alertText) {
      alertText.textContent = "Impossible de charger les métriques budget. Vérifiez vos droits et la console Firebase.";
    }
    setPanelLevel("unsynced");
  }
}

function bindBudgetActions() {
  const billingBtn = $("budgetBillingBtn");
  const helpBtn = $("budgetHelpBtn");

  if (billingBtn) {
    billingBtn.addEventListener("click", () => {
      window.open(BILLING_URL, "_blank", "noopener,noreferrer");
    });
  }

  if (helpBtn) {
    helpBtn.addEventListener("click", openHelpModal);
  }
}

export async function initBudgetMonitor() {
  bindBudgetActions();
  await refreshBudgetMonitor();

  if (refreshTimer) {
    clearInterval(refreshTimer);
  }
  refreshTimer = setInterval(refreshBudgetMonitor, REFRESH_MS);
}

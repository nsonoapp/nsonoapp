import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  where,
  Timestamp
} from "./firebase.js";

import { getAuth, onAuthStateChanged } from "./auth.js";
import { getAppConfig } from "./appConfig.js";
import { applyEntityScope } from "./nsono-scope.js";

const SECTION_IDS = {
  volume: "sectionVolume",
  profit: "sectionProfit",
  revenue: "sectionRevenue",
  least: "sectionLeast",
  stock: "sectionStock"
};

const rangeFilter = document.getElementById("rangeFilter");
const kpiTopCaValue = document.getElementById("kpiTopCaValue");
const kpiTopCaSub = document.getElementById("kpiTopCaSub");
const kpiTopProfitValue = document.getElementById("kpiTopProfitValue");
const kpiTopProfitSub = document.getElementById("kpiTopProfitSub");
const kpiTopMarginValue = document.getElementById("kpiTopMarginValue");
const kpiTopMarginSub = document.getElementById("kpiTopMarginSub");
const kpiRiskValue = document.getElementById("kpiRiskValue");
const kpiRiskSub = document.getElementById("kpiRiskSub");
const rankingTableBody = document.getElementById("rankingTableBody");
const rankingStatus = document.getElementById("rankingStatus");

const state = {
  currencySymbol: "FC",
  lowStockLimit: 5,
  rangeBound: false
};

const auth = getAuth();

function round2(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) {
    return 0;
  }
  return Math.round(n * 100) / 100;
}

function sanitizeText(value, max = 80) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, max);
}

function formatMoney(value) {
  return `${round2(value).toFixed(2)} ${state.currencySymbol}`;
}

function formatPercent(value) {
  return `${round2(value).toFixed(1)}%`;
}

function setStatus(text, isError = false) {
  if (!rankingStatus) {
    return;
  }
  rankingStatus.textContent = text || "";
  rankingStatus.style.color = isError ? "#ff8a8a" : "#9fd4b5";
}

function showEmpty(container, text) {
  if (!container) {
    return;
  }
  container.replaceChildren();
  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;
  container.appendChild(div);
}

async function checkUser(uid) {
  if (!uid) {
    throw new Error("UID invalide");
  }

  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists()) {
    throw new Error("Utilisateur introuvable");
  }

  const userData = userSnap.data();
  if (!userData?.isActive) {
    throw new Error("Compte désactivé");
  }
  if (userData.role !== "admin") {
    throw new Error("Accès refusé");
  }

  return userData;
}

function getDateRange(rangeKey) {
  const now = new Date();
  now.setHours(23, 59, 59, 999);

  const startDate = new Date(now);
  if (rangeKey === "today") {
    startDate.setHours(0, 0, 0, 0);
  } else if (rangeKey === "30days") {
    startDate.setDate(startDate.getDate() - 30);
    startDate.setHours(0, 0, 0, 0);
  } else {
    startDate.setDate(startDate.getDate() - 7);
    startDate.setHours(0, 0, 0, 0);
  }

  return { startDate, endDate: now };
}

async function loadActiveSaleIds(saleIds) {
  const activeSaleIds = new Set();
  const ids = [...saleIds];

  for (let i = 0; i < ids.length; i += 10) {
    const chunk = ids.slice(i, i + 10);
    await Promise.all(
      chunk.map(async saleId => {
        const saleSnap = await getDoc(doc(db, "sales", saleId));
        if (saleSnap.exists() && saleSnap.data()?.status !== "cancelled") {
          activeSaleIds.add(saleId);
        }
      })
    );
  }

  return activeSaleIds;
}

function getStockLevel(product) {
  const stockCurrent = Number(product?.stock_current || 0);
  const stockAlert = Number(
    product?.stock_alert ?? state.lowStockLimit ?? 5
  );

  if (stockCurrent <= 0) {
    return "critical";
  }
  if (stockCurrent <= stockAlert) {
    return "low";
  }
  return "ok";
}

function buildProductLabel(product) {
  const name = sanitizeText(product?.name || "Produit inconnu", 60);
  const variant = sanitizeText(product?.variant || "", 24);
  return variant ? `${name} (${variant})` : name;
}

function createMetricsFromData(productsMap, saleItems, activeSaleIds) {
  const metricsMap = new Map();
  let totalQuantity = 0;

  productsMap.forEach((product, productId) => {
    if (product?.isActive === false || product?.stockType === "tools") {
      return;
    }

    metricsMap.set(productId, {
      productId,
      name: buildProductLabel(product),
      stockCurrent: Number(product?.stock_current || 0),
      stockAlert: Number(product?.stock_alert ?? state.lowStockLimit ?? 5),
      stockLevel: getStockLevel(product),
      quantity: 0,
      revenue: 0,
      profit: 0
    });
  });

  saleItems.forEach(item => {
    const saleId = item?.saleId;
    const productId = item?.productId;

    if (!productId || !saleId || !activeSaleIds.has(saleId)) {
      return;
    }

    if (!metricsMap.has(productId)) {
      return;
    }

    const quantity = Number(item?.quantity || 0);
    const unitPrice = Number(item?.price || 0);
    const lineProfit = Number(item?.profit || 0);

    if (quantity <= 0) {
      return;
    }

    const entry = metricsMap.get(productId);
    entry.quantity += quantity;
    entry.revenue += unitPrice * quantity;
    entry.profit += lineProfit;
    totalQuantity += quantity;
  });

  const metrics = Array.from(metricsMap.values()).map(entry => {
    const revenue = round2(entry.revenue);
    const profit = round2(entry.profit);
    const quantity = entry.quantity;
    const marginRate = revenue > 0 ? round2((profit / revenue) * 100) : 0;
    const marginPerUnit = quantity > 0 ? round2(profit / quantity) : 0;
    const salesShare = totalQuantity > 0
      ? round2((quantity / totalQuantity) * 100)
      : 0;

    return {
      ...entry,
      quantity,
      revenue,
      profit,
      marginRate,
      marginPerUnit,
      salesShare
    };
  });

  return { metrics, totalQuantity };
}

function sortByQuantityDesc(list) {
  return [...list].sort((a, b) => {
    if (b.quantity !== a.quantity) {
      return b.quantity - a.quantity;
    }
    return b.profit - a.profit;
  });
}

function sortByProfitDesc(list) {
  return [...list]
    .filter(item => item.quantity > 0)
    .sort((a, b) => {
      if (b.profit !== a.profit) {
        return b.profit - a.profit;
      }
      if (b.marginRate !== a.marginRate) {
        return b.marginRate - a.marginRate;
      }
      return b.quantity - a.quantity;
    });
}

function sortByRevenueDesc(list) {
  return [...list]
    .filter(item => item.quantity > 0)
    .sort((a, b) => {
      if (b.revenue !== a.revenue) {
        return b.revenue - a.revenue;
      }
      return b.profit - a.profit;
    });
}

function sortByQuantityAsc(list) {
  return [...list]
    .filter(item => item.quantity > 0)
    .sort((a, b) => {
      if (a.quantity !== b.quantity) {
        return a.quantity - b.quantity;
      }
      return a.profit - b.profit;
    });
}

function sortByMarginDesc(list, minQuantity = 2) {
  return [...list]
    .filter(item => item.quantity >= minQuantity && item.revenue > 0)
    .sort((a, b) => {
      if (b.marginRate !== a.marginRate) {
        return b.marginRate - a.marginRate;
      }
      return b.profit - a.profit;
    });
}

function sortByStockRisk(list) {
  return [...list]
    .filter(item => item.stockLevel !== "ok")
    .sort((a, b) => {
      const weight = { critical: 2, low: 1, ok: 0 };
      if (weight[b.stockLevel] !== weight[a.stockLevel]) {
        return weight[b.stockLevel] - weight[a.stockLevel];
      }
      if (a.stockCurrent !== b.stockCurrent) {
        return a.stockCurrent - b.stockCurrent;
      }
      return b.quantity - a.quantity;
    });
}

function createStockBadge(level) {
  const badge = document.createElement("span");
  if (level === "critical") {
    badge.className = "stock-badge critical";
    badge.textContent = "Stock critique";
    return badge;
  }
  if (level === "low") {
    badge.className = "stock-badge low";
    badge.textContent = "Stock faible";
    return badge;
  }
  return null;
}

function createRankCard(item, options = {}) {
  const {
    rank = 1,
    tone = "gold",
    showMargin = true
  } = options;

  const card = document.createElement("article");
  card.className = `rank-card ${tone}`;

  const top = document.createElement("div");
  top.className = "card-top";

  const name = document.createElement("div");
  name.className = "product-name";
  name.textContent = item.name;

  const badges = document.createElement("div");
  badges.className = "card-badges";

  const rankBadge = document.createElement("span");
  rankBadge.className = `rank-badge ${tone === "low" ? "low" : "best"}`;
  rankBadge.textContent = `#${rank}`;
  badges.appendChild(rankBadge);

  const stockBadge = createStockBadge(item.stockLevel);
  if (stockBadge) {
    badges.appendChild(stockBadge);
  }

  top.append(name, badges);

  const stats = document.createElement("div");
  stats.className = "card-stats";

  const lines = [
    ["Ventes", String(item.quantity)],
    ["Part ventes", formatPercent(item.salesShare)],
    ["Chiffre d'affaires", formatMoney(item.revenue)],
    ["Bénéfice", formatMoney(item.profit)]
  ];

  if (showMargin) {
    lines.push(["Marge", formatPercent(item.marginRate)]);
    lines.push(["Marge / unité", formatMoney(item.marginPerUnit)]);
  }

  lines.push(["Stock", `${item.stockCurrent} / alerte ${item.stockAlert}`]);

  lines.forEach(([label, value]) => {
    const line = document.createElement("div");
    line.className = "stat-line";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("strong");
    valueEl.textContent = value;

    line.append(labelEl, valueEl);
    stats.appendChild(line);
  });

  const progress = document.createElement("div");
  progress.className = "progress";

  const fill = document.createElement("div");
  fill.className = `progress-fill ${tone === "low" ? "red" : "gold"}`;
  const width = tone === "low"
    ? Math.min(100, Math.max(8, (item.stockAlert - item.stockCurrent + 1) * 20))
    : Math.min(100, Math.max(8, item.salesShare));
  fill.style.width = `${width}%`;

  progress.appendChild(fill);
  card.append(top, stats, progress);
  return card;
}

function renderCards(container, items, options = {}) {
  if (!container) {
    return;
  }

  if (!items.length) {
    showEmpty(container, options.emptyText || "Aucune donnée");
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach((item, index) => {
    fragment.appendChild(
      createRankCard(item, {
        rank: index + 1,
        tone: options.tone || "gold",
        showMargin: options.showMargin !== false
      })
    );
  });

  container.replaceChildren(fragment);
}

function renderRankingTable(items) {
  if (!rankingTableBody) {
    return;
  }

  rankingTableBody.replaceChildren();

  if (!items.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 8;
    cell.className = "table-empty";
    cell.textContent = "Aucune vente sur la période sélectionnée";
    row.appendChild(cell);
    rankingTableBody.appendChild(row);
    return;
  }

  const soldItems = sortByQuantityDesc(items).filter(item => item.quantity > 0);
  const fragment = document.createDocumentFragment();

  soldItems.forEach((item, index) => {
    const row = document.createElement("tr");
    if (item.stockLevel === "critical") {
      row.classList.add("row-critical");
    } else if (item.stockLevel === "low") {
      row.classList.add("row-low");
    }

    const cells = [
      String(index + 1),
      item.name,
      String(item.quantity),
      formatMoney(item.revenue),
      formatMoney(item.profit),
      formatPercent(item.marginRate),
      `${item.stockCurrent}`,
      item.stockLevel === "critical"
        ? "Critique"
        : item.stockLevel === "low"
          ? "Faible"
          : "OK"
    ];

    cells.forEach((text, cellIndex) => {
      const td = document.createElement("td");
      td.textContent = text;
      if (cellIndex === 1) {
        td.className = "cell-name";
      }
      if (cellIndex === 7) {
        td.className = `stock-state ${item.stockLevel}`;
      }
      row.appendChild(td);
    });

    fragment.appendChild(row);
  });

  rankingTableBody.appendChild(fragment);
}

function updateKpis(metrics) {
  const sold = metrics.filter(item => item.quantity > 0);
  const topRevenue = sortByRevenueDesc(sold)[0] || null;
  const topProfit = sortByProfitDesc(sold)[0] || null;
  const topMargin = sortByMarginDesc(sold, 2)[0] || null;
  const stockRisk = sortByStockRisk(metrics)[0] || null;

  if (kpiTopCaValue && kpiTopCaSub) {
    kpiTopCaValue.textContent = topRevenue ? topRevenue.name : "—";
    kpiTopCaSub.textContent = topRevenue ? formatMoney(topRevenue.revenue) : "—";
  }

  if (kpiTopProfitValue && kpiTopProfitSub) {
    kpiTopProfitValue.textContent = topProfit ? topProfit.name : "—";
    kpiTopProfitSub.textContent = topProfit ? formatMoney(topProfit.profit) : "—";
  }

  if (kpiTopMarginValue && kpiTopMarginSub) {
    kpiTopMarginValue.textContent = topMargin ? topMargin.name : "—";
    kpiTopMarginSub.textContent = topMargin
      ? `${formatPercent(topMargin.marginRate)} • ${formatMoney(topMargin.marginPerUnit)}/u`
      : "—";
  }

  if (kpiRiskValue && kpiRiskSub) {
    kpiRiskValue.textContent = stockRisk ? stockRisk.name : "—";
    kpiRiskSub.textContent = stockRisk
      ? `stock ${stockRisk.stockCurrent}/${stockRisk.stockAlert} • ventes ${stockRisk.quantity}`
      : "Aucun stock à risque";
  }
}

function updateSectionCounts(metrics) {
  const soldCount = metrics.filter(item => item.quantity > 0).length;
  const map = {
    volumeCount: soldCount,
    profitCount: sortByProfitDesc(metrics).slice(0, 8).length,
    revenueCount: sortByRevenueDesc(metrics).slice(0, 8).length,
    leastCount: sortByQuantityAsc(metrics).slice(0, 8).length,
    stockCount: sortByStockRisk(metrics).slice(0, 8).length
  };

  Object.entries(map).forEach(([id, value]) => {
    const el = document.getElementById(id);
    if (el) {
      el.textContent = String(value);
    }
  });
}

async function loadRanking() {
  const rangeKey = String(rangeFilter?.value || "7days");
  const { startDate } = getDateRange(rangeKey);

  setStatus("Chargement du classement...");

  const [productsSnap, saleItemsSnap, config] = await Promise.all([
    getDocs(query(collection(db, "products"), ...applyEntityScope([]))),
    getDocs(
      query(
        collection(db, "sale_items"),
        ...applyEntityScope([
          where("createdAt", ">=", Timestamp.fromDate(startDate))
        ])
      )
    ),
    getAppConfig()
  ]);

  state.currencySymbol = config?.currencySymbol || "FC";
  state.lowStockLimit = Number(config?.lowStockLimit ?? 5);

  const productsMap = new Map();
  productsSnap.forEach(productDoc => {
    productsMap.set(productDoc.id, productDoc.data());
  });

  const saleItems = saleItemsSnap.docs.map(d => d.data());
  const saleIds = new Set(
    saleItems.map(item => item?.saleId).filter(Boolean)
  );

  const activeSaleIds = await loadActiveSaleIds(saleIds);
  const { metrics } = createMetricsFromData(productsMap, saleItems, activeSaleIds);

  const byVolume = sortByQuantityDesc(metrics);
  const byProfit = sortByProfitDesc(metrics).slice(0, 8);
  const byRevenue = sortByRevenueDesc(metrics).slice(0, 8);
  const byLeast = sortByQuantityAsc(metrics).slice(0, 8);
  const byStock = sortByStockRisk(metrics).slice(0, 8);

  renderRankingTable(metrics);
  renderCards(document.getElementById(SECTION_IDS.volume), byVolume.filter(i => i.quantity > 0).slice(0, 8), {
    tone: "gold",
    emptyText: "Aucune vente sur la période"
  });
  renderCards(document.getElementById(SECTION_IDS.profit), byProfit, {
    tone: "profit",
    emptyText: "Aucun bénéfice enregistré"
  });
  renderCards(document.getElementById(SECTION_IDS.revenue), byRevenue, {
    tone: "revenue",
    emptyText: "Aucun chiffre d'affaires"
  });
  renderCards(document.getElementById(SECTION_IDS.least), byLeast, {
    tone: "muted",
    emptyText: "Aucun produit peu vendu"
  });
  renderCards(document.getElementById(SECTION_IDS.stock), byStock, {
    tone: "low",
    showMargin: false,
    emptyText: "Aucun stock faible ou critique"
  });

  updateKpis(metrics);
  updateSectionCounts(metrics);
  setStatus(`Période : ${rangeKey} • ${metrics.filter(i => i.quantity > 0).length} produit(s) vendu(s)`);
}

onAuthStateChanged(auth, async user => {
  if (!user) {
    alert("Connexion requise");
    window.location.replace("login.html");
    return;
  }

  try {
    await checkUser(user.uid);

    if (!state.rangeBound) {
      rangeFilter?.addEventListener("change", () => {
        loadRanking().catch(err => {
          console.error(err);
          setStatus(err?.message || "Erreur chargement", true);
        });
      });
      state.rangeBound = true;
    }

    await loadRanking();
  } catch (err) {
    console.error(err);
    setStatus(err?.message || "Erreur", true);
    alert(err?.message || "Erreur");
  }
});

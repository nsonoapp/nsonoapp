// js/ranging.js vraie côte pro 

import {
  db,
  collection,
  getDocs,
  getDoc,
  doc,
  query,
  limit,
  where,
  Timestamp
} from "./firebase.js";

import {
  getAuth,
  onAuthStateChanged
} from "./auth.js"; // Auth

/* =========================
   DOM
========================= */

const topContainer = document.getElementById("topProducts");
const lowContainer = document.getElementById("lowProducts");
const rangeFilter = document.getElementById("rangeFilter");
const kpiTopCaValue = document.getElementById("kpiTopCaValue");
const kpiTopCaSub = document.getElementById("kpiTopCaSub");
const kpiTopProfitValue = document.getElementById("kpiTopProfitValue");
const kpiTopProfitSub = document.getElementById("kpiTopProfitSub");
const kpiRiskValue = document.getElementById("kpiRiskValue");
const kpiRiskSub = document.getElementById("kpiRiskSub");

const state = {
  productsMap: new Map(),
  renderedTopSignature: "",
  renderedLowSignature: ""
};

/* =========================
   AUTH
========================= */

const auth = getAuth();

/* =========================
   SECURITY
========================= */

async function checkUser(uid) {

  if (!uid) throw new Error("UID invalide");

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

/* =========================
   HELPERS
========================= */

function sanitizeText(value, max = 80) {
  if (typeof value !== "string") return "";
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function clearContainer(container) {
  if (container) container.replaceChildren();
}

function showEmpty(container, text) {
  if (!container) return;

  container.replaceChildren();

  const div = document.createElement("div");
  div.className = "empty";
  div.textContent = text;

  container.appendChild(div);
}

function createProgressBar(percent, type) {
  const progress = document.createElement("div");
  progress.className = "progress";

  const fill = document.createElement("div");
  fill.className = `progress-fill ${type}`;
  fill.style.width = `${Math.min(Number(percent) || 0, 100)}%`;

  progress.appendChild(fill);
  return progress;
}

/* =========================
   CARD
========================= */

function createCard(item, type = "gold", position = 1) {

  const card = document.createElement("div");
  card.className = `rank-card ${type === "gold" ? "gold" : "low"}`;

  const top = document.createElement("div");
  top.className = "card-top";

  const name = document.createElement("div");
  name.className = "product-name";
  name.textContent = sanitizeText(item.name);

  const badge = document.createElement("div");
  badge.className = `rank-badge ${type === "gold" ? "best" : "low"}`;
  badge.textContent = `#${position}`;

  top.append(name, badge);

  const stats = document.createElement("div");
  stats.className = "card-stats";

  const lines = [
    ["Ventes", item.quantity],
    ["Part des ventes", `${item.percent}%`],
    ["CA", `${item.revenue.toFixed(2)} $`]
  ];

  lines.forEach(([label, value]) => {
    const line = document.createElement("div");
    line.className = "stat-line";

    const l = document.createElement("span");
    l.textContent = label;

    const v = document.createElement("strong");
    v.textContent = value;

    line.append(l, v);
    stats.appendChild(line);
  });

  const progress = createProgressBar(item.percent, type);

  card.append(top, stats, progress);

  return card;
}

/* =========================
   LOAD RANKING
========================= */

async function loadRanking() {
  const rangeKey = String(rangeFilter?.value || "7days");
  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const startDate = new Date(now);

  if (rangeKey === "today") {
    startDate.setHours(0, 0, 0, 0);
  } else if (rangeKey === "30days") {
    startDate.setDate(startDate.getDate() - 30);
  } else {
    startDate.setDate(startDate.getDate() - 7);
  }
  startDate.setHours(0, 0, 0, 0);

  const saleItemsSnap = await getDocs(
    query(
      collection(db, "sale_items"),
      where("createdAt", ">=", Timestamp.fromDate(startDate)),
      limit(2000)
    )
  );

  if (saleItemsSnap.empty) {
    showEmpty(topContainer, "Aucune vente enregistrée");
    showEmpty(lowContainer, "Aucune donnée disponible");
    return;
  }

  const map = new Map();
  const revenueMap = new Map();
  const profitMap = new Map();
  let totalSold = 0;

  saleItemsSnap.forEach(docSnap => {
    const data = docSnap.data();
    const productId = data?.productId;
    const quantity = Number(data?.quantity || 0);
    const unitPrice = Number(data?.price || 0);
    const profit = Number(data?.profit || 0);

    if (!productId) return;

    totalSold += quantity;

    if (!map.has(productId)) {
      map.set(productId, 0);
    }
    if (!revenueMap.has(productId)) {
      revenueMap.set(productId, 0);
    }
    if (!profitMap.has(productId)) {
      profitMap.set(productId, 0);
    }

    map.set(productId, map.get(productId) + quantity);
    revenueMap.set(productId, revenueMap.get(productId) + (unitPrice * quantity));
    profitMap.set(productId, profitMap.get(productId) + profit);
  });

  if (!state.productsMap.size) {
    const productsSnap = await getDocs(collection(db, "products"));
    productsSnap.forEach(docSnap => {
      state.productsMap.set(docSnap.id, docSnap.data());
    });
  }

  const ranking = Array.from(map.entries())
    .map(([productId, quantity]) => {

      const product = state.productsMap.get(productId) || {};

      const percent = totalSold
  ? (quantity / totalSold) * 100
  : 0;

      return {
        productId,
        name: sanitizeText(product.name || "Produit inconnu"),
        quantity,
        percent: Number(percent.toFixed(1)),
        revenue: Number((revenueMap.get(productId) || 0).toFixed(2)),
        profit: Number((profitMap.get(productId) || 0).toFixed(2))
      };
    })
    .sort((a, b) => b.quantity - a.quantity);

  const topTen = ranking.slice(0, 10);

  const lowTen = ranking
  .slice(-10)
  .reverse()
  .filter(item =>
    !topTen.some(top =>
      top.productId === item.productId
    )
  );

  if (!topTen.length) {
    showEmpty(topContainer, "Top indisponible");
  } else {
    const topSignature = topTen.map(item => `${item.productId}:${item.quantity}`).join("|");
    if (state.renderedTopSignature !== topSignature) {
      state.renderedTopSignature = topSignature;
      topContainer.replaceChildren(
        ...topTen.map((item, i) =>
          createCard(item, "gold", i + 1)
        )
      );
    }
  }

  if (!lowTen.length) {
    showEmpty(lowContainer, "Classement faible indisponible");
  } else {
    const lowSignature = lowTen.map(item => `${item.productId}:${item.quantity}`).join("|");
    if (state.renderedLowSignature !== lowSignature) {
      state.renderedLowSignature = lowSignature;
      lowContainer.replaceChildren(
        ...lowTen.map((item, i) =>
          createCard(item, "red", i + 1)
        )
      );
    }
  }

  const topByRevenue = [...ranking].sort((a, b) => b.revenue - a.revenue)[0] || null;
  const topByProfit = [...ranking].sort((a, b) => b.profit - a.profit)[0] || null;

  const riskCandidate = Array.from(state.productsMap.entries())
    .map(([productId, product]) => {
      const soldQty = map.get(productId) || 0;
      const stockCurrent = Number(product?.stock_current || 0);
      const stockAlert = Number(product?.stock_alert || 0);
      const gap = Math.max(0, stockAlert - stockCurrent);
      const lowRotationPenalty = soldQty <= 1 ? 2 : 0;
      const riskScore = gap * 2 + lowRotationPenalty;
      return {
        productId,
        name: sanitizeText(product?.name || "Produit inconnu"),
        riskScore,
        stockCurrent,
        stockAlert,
        soldQty
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)[0] || null;

  if (kpiTopCaValue && kpiTopCaSub) {
    kpiTopCaValue.textContent = topByRevenue ? topByRevenue.name : "—";
    kpiTopCaSub.textContent = topByRevenue ? `${topByRevenue.revenue.toFixed(2)} $` : "—";
  }
  if (kpiTopProfitValue && kpiTopProfitSub) {
    kpiTopProfitValue.textContent = topByProfit ? topByProfit.name : "—";
    kpiTopProfitSub.textContent = topByProfit ? `${topByProfit.profit.toFixed(2)} $` : "—";
  }
  if (kpiRiskValue && kpiRiskSub) {
    kpiRiskValue.textContent = riskCandidate ? riskCandidate.name : "—";
    kpiRiskSub.textContent = riskCandidate
      ? `stock ${riskCandidate.stockCurrent}/${riskCandidate.stockAlert} • ventes ${riskCandidate.soldQty}`
      : "—";
  }
}

/* =========================
   INIT
========================= */

onAuthStateChanged(auth, async user => {

  if (!user) {
    alert("Connexion requise");
    window.location.replace("login.html");
    return;
  }

  try {
    await checkUser(user.uid);
    await loadRanking();
    rangeFilter?.addEventListener("change", loadRanking);
  } catch (err) {
    console.error(err);
    alert(err?.message || "Erreur");
  }
});

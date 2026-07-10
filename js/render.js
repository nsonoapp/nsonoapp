import {
  state,
  $,
  n,
  formatMoney,
  clearNode,
  getDate,
  loadPreviousPeriodData,
  filterActiveSales
} from "./stats.js";
import { getExpiringAlerts } from "./expiration.js";

function setText(id, text) {
  const el = $(id);
  if (el) {
    el.textContent = text;
  }
}

function getPurchaseTotal(purchase) {
  const fromDoc = n(purchase?.total_cost ?? purchase?.totalCost ?? purchase?.total);
  if (fromDoc > 0) {
    return fromDoc;
  }

  const purchaseId = purchase?.id;
  if (!purchaseId) {
    return 0;
  }

  return state.purchaseItems
    .filter(i => (i.purchaseId || i.purchase_id) === purchaseId)
    .reduce(
      (sum, i) =>
        sum + n(i.quantity) * n(i.price ?? i.unitPrice ?? i.purchase_price),
      0
    );
}

function resolveSellerName(sellerId) {
  if (!sellerId || sellerId === "__unknown__") {
    return "Vendeur inconnu";
  }

  const user = state.users.find(u =>
    u.userId === sellerId ||
    u.uid === sellerId ||
    u.id === sellerId
  );

  return user?.name || sellerId;
}

export async function render(chartApi) {
  const sales = filterActiveSales(state.sales);
  const expenses = state.expenses;
  const losses = state.losses;

  state.chartReady = true;

  window.statsData = {
    sales,
    expenses,
    debts: state.debts,
    losses,
    products: state.products,
    stockMovements: state.stockMovements,
    currency: state.currency
  };

  let previousPeriod = {
    sales: [],
    expenses: [],
    losses: []
  };

  try {
    previousPeriod = await loadPreviousPeriodData();
  } catch (error) {
    console.error("loadPreviousPeriodData:", error);
  }

  renderKPIs(
    sales,
    expenses,
    losses,
    previousPeriod.sales,
    previousPeriod.expenses,
    previousPeriod.losses
  );

  renderOperationalFinance(sales, expenses, losses);

  renderFinancialHealth(sales, expenses, losses);
  renderStockHealth();
  renderDebts();
  renderPurchases();
  renderProducts();
  renderSellers(sales, state.saleItems);
  renderAlerts();
  renderActivity();

  if (state.chartReady && chartApi?.renderChart) {
    chartApi.renderChart();
  }
}

function sumExpensesByCategory(expenses, category) {
  return expenses
    .filter(e => e.category === category)
    .reduce((s, e) => s + n(e.amount), 0);
}

const INVESTMENT_CATEGORIES = new Set(["investment", "reinvestment"]);

function getProductById(productId) {
  if (!productId) {
    return null;
  }
  return state.products.find(p => p.id === productId) || null;
}

function isToolsProduct(productId) {
  return getProductById(productId)?.stockType === "tools";
}

function isActiveExpense(expense) {
  return expense?.isSystemCorrection !== true && expense?.status !== "cancelled";
}

function isActiveLoss(loss) {
  return loss?.isSystemCorrection !== true && loss?.status !== "cancelled";
}

function getSaleItemsForSales(sales) {
  const saleIds = new Set(sales.map(s => s.id));
  return state.saleItems.filter(i => saleIds.has(i.saleId || i.sale_id));
}

function splitSaleMetricsByStockType(items) {
  const metrics = {
    sales: { revenue: 0, profit: 0, quantity: 0 },
    tools: { revenue: 0, profit: 0, quantity: 0 }
  };

  items.forEach(item => {
    const productId = item.productId || item.product_id;
    const bucket = isToolsProduct(productId) ? metrics.tools : metrics.sales;
    bucket.revenue += n(item.price) * n(item.quantity);
    bucket.profit += n(item.profit);
    bucket.quantity += n(item.quantity);
  });

  return metrics;
}

function sumPurchasesByStockType(purchases, stockType) {
  const purchaseIds = new Set(purchases.map(p => p.id));

  return state.purchaseItems
    .filter(i => purchaseIds.has(i.purchaseId || i.purchase_id))
    .filter(i => {
      const tools = isToolsProduct(i.productId || i.product_id);
      return stockType === "tools" ? tools : !tools;
    })
    .reduce(
      (sum, i) => sum + n(i.quantity) * n(i.price ?? i.unitPrice ?? i.purchase_price),
      0
    );
}

function sumInvestmentExpenses(expenses, { toolsOnly = false } = {}) {
  return expenses
    .filter(isActiveExpense)
    .filter(e => INVESTMENT_CATEGORIES.has(e.category))
    .filter(e => {
      if (!toolsOnly) {
        return true;
      }
      return isToolsProduct(e.relatedTo);
    })
    .reduce((sum, e) => sum + n(e.amount), 0);
}

function calcStockValueByStockType(stockType) {
  return state.products
    .filter(p => (stockType === "tools" ? p.stockType === "tools" : p.stockType !== "tools"))
    .reduce((sum, p) => sum + n(p.stock_current) * n(p.price_buy || p.purchase_price), 0);
}

function renderOperationalFinance(sales, expenses, losses) {
  const saleItems = getSaleItemsForSales(sales);
  const { sales: salesFlow, tools: toolsFlow } = splitSaleMetricsByStockType(saleItems);

  const operatingExpenses = expenses
    .filter(isActiveExpense)
    .filter(e => !INVESTMENT_CATEGORIES.has(e.category))
    .reduce((sum, e) => sum + n(e.amount), 0);

  const lossesTotal = losses
    .filter(isActiveLoss)
    .reduce((sum, e) => sum + n(e.amount), 0);

  const investmentOnlyTotal = sumExpensesByCategory(
    expenses.filter(isActiveExpense),
    "investment"
  );
  const reinvestmentTotal = sumExpensesByCategory(
    expenses.filter(isActiveExpense),
    "reinvestment"
  );
  const capitalExcludedTotal = investmentOnlyTotal + reinvestmentTotal;

  const toolsPurchases = sumPurchasesByStockType(state.purchases, "tools");
  const salesPurchases = sumPurchasesByStockType(state.purchases, "sales");
  const toolsStockValue = calcStockValueByStockType("tools");
  const salesStockValue = calcStockValueByStockType("sales");
  const toolsInvestExpenses = sumInvestmentExpenses(expenses, { toolsOnly: true });

  const pureOperationalBenefit =
    salesFlow.profit - operatingExpenses - lossesTotal;

  setText("opSalesRevenueValue", formatMoney(salesFlow.revenue));
  setText("opSalesGrossProfitValue", formatMoney(salesFlow.profit));
  setText("opToolsPurchaseValue", formatMoney(toolsPurchases));
  setText("opToolsStockValue", formatMoney(toolsStockValue));
  setText("opOperatingExpensesValue", formatMoney(operatingExpenses));
  setText("opPureBenefitValue", formatMoney(pureOperationalBenefit));

  const hint = $("opPureBenefitHint");
  if (hint) {
    hint.textContent =
      `${formatMoney(salesFlow.profit)} − ${formatMoney(operatingExpenses)} − ${formatMoney(lossesTotal)}`;
  }

  const breakdown = $("opFinanceBreakdown");
  if (!breakdown) {
    return;
  }

  breakdown.replaceChildren();

  const intro = document.createElement("p");
  intro.textContent =
    "Vision de rentabilité opérationnelle pure : les flux investissement et réinvestissement sont suivis à part et exclus du bénéfice opérationnel.";
  breakdown.appendChild(intro);

  const list = document.createElement("div");
  list.className = "finance-breakdown-list";

  const rows = [
    ["Achats stock vente (période)", formatMoney(salesPurchases)],
    ["Valeur stock vente actuel", formatMoney(salesStockValue)],
    ["Investissements (exclus du calcul)", formatMoney(investmentOnlyTotal)],
    ["Réinvestissements (exclus du calcul)", formatMoney(reinvestmentTotal)],
    ["Invest./réinvest. liés aux outils", formatMoney(toolsInvestExpenses)],
    ["Pertes actives", formatMoney(lossesTotal)]
  ];

  if (toolsFlow.revenue > 0 || toolsFlow.profit > 0) {
    rows.splice(2, 0,
      ["Revenus outils (anomalie vente)", formatMoney(toolsFlow.revenue)],
      ["Bénéfice outils (anomalie vente)", formatMoney(toolsFlow.profit)]
    );
  }

  rows.forEach(([label, value]) => {
    const row = document.createElement("div");
    row.className = "finance-breakdown-row";

    const labelEl = document.createElement("span");
    labelEl.textContent = label;

    const valueEl = document.createElement("span");
    valueEl.textContent = value;

    row.append(labelEl, valueEl);
    list.appendChild(row);
  });

  breakdown.appendChild(list);

  const note = document.createElement("p");
  note.style.marginTop = "10px";
  note.textContent =
    `Total invest. + réinvest. période : ${formatMoney(capitalExcludedTotal)} — non déduit du bénéfice opérationnel pur.`;
  breakdown.appendChild(note);
}

function calcPotentialMinProfit(products) {
  return products
    .filter(p => p.stockType !== "tools")
    .reduce((sum, p) => {
      const buy = n(p.price_buy);
      const minPrice = n(p.price_min) || n(p.price_sell) || buy;
      const stock = n(p.stock_current);
      return sum + Math.max(0, minPrice - buy) * stock;
    }, 0);
}

function renderFinancialHealth(sales, expenses, losses) {
  const activeExpenses = expenses.filter(isActiveExpense);
  const investmentTotal = sumExpensesByCategory(activeExpenses, "investment");
  const reinvestmentTotal = sumExpensesByCategory(activeExpenses, "reinvestment");

  const operatingExpenses = activeExpenses
    .filter(e => e.category !== "investment" && e.category !== "reinvestment")
    .reduce((s, e) => s + n(e.amount), 0);

  const expensesTotal = activeExpenses.reduce((s, e) => s + n(e.amount), 0);

  const lossesTotal =
    losses
      .filter(e => e.isSystemCorrection !== true && e.status !== "cancelled")
      .reduce((s, e) => s + n(e.amount), 0);

  const debtsTotal =
    state.debts
      .filter(e => e.status !== "paid" && e.status !== "cancelled")
      .reduce((s, e) => s + n(e.amount_remaining), 0);

  const cashReceived =
    sales.reduce((s, v) => s + n(v.amount_paid), 0);

  const purchaseTotal =
    state.purchases.reduce(
      (s, p) => s + getPurchaseTotal(p),
      0
    );

  const grossProfit =
    getSaleItemsForSales(sales).reduce((s, i) => s + n(i.profit), 0);

  const potentialMinProfit = calcPotentialMinProfit(state.products);

  const netResult =
    grossProfit
    - expensesTotal
    - lossesTotal;

  setText("expensesValue", formatMoney(operatingExpenses));
  setText("investmentValue", formatMoney(investmentTotal));
  setText("reinvestmentValue", formatMoney(reinvestmentTotal));
  setText("potentialBenefitValue", formatMoney(potentialMinProfit));
  setText("lossesValue", formatMoney(lossesTotal));
  setText("debtsValue", formatMoney(debtsTotal));
  setText("cashReceivedValue", formatMoney(cashReceived));
  setText("purchaseValue", formatMoney(purchaseTotal));
  setText("netResultValue", formatMoney(netResult));
}

function renderStockHealth() {
  const activeSales = filterActiveSales(state.sales);
  const stockValue =
    state.products.reduce((s, p) => {
      const price = n(p.price_buy || p.purchase_price);
      return s + (n(p.stock_current) * price);
    }, 0);

  const blockedStock =
    state.products.filter(p => p.offlineBlocked === true).length;

  const stockOut =
    state.products.filter(p =>
      n(p.stock_current) <= 0
    ).length;

  const activeSaleIds = new Set(activeSales.map(s => s.id));

  const soldQty =
    state.saleItems
      .filter(i => activeSaleIds.has(i.saleId || i.sale_id))
      .filter(i => !isToolsProduct(i.productId || i.product_id))
      .reduce((s, i) => s + n(i.quantity), 0);

  const stockQty =
    state.products
      .filter(p => p.stockType !== "tools")
      .reduce((s, p) => s + n(p.stock_current), 0);

  const rotation =
    stockQty > 0 ? (soldQty / stockQty).toFixed(2) : "0";

  setText("stockValue", formatMoney(stockValue));
  setText("stockRotation", rotation);
  setText("blockedStock", String(blockedStock));
  setText("stockOutCount", String(stockOut));
}

function renderDebts() {
  clearNode("topDebtorsList");

  const box = $("topDebtorsList");

  if (!box) {
    return;
  }

  const debts =
    (state.recentDebts || [])
      .filter(
        debt =>
          debt &&
          debt.status !== "cancelled" &&
          debt.status !== "paid" &&
          n(debt.amount_remaining) > 0
      );

  debts.forEach(debt => {
    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent =
      debt.name ||
      debt.customerName ||
      "Client";

    const sub = document.createElement("div");
    sub.className = "list-sub";

    const paid = n(debt.amount_paid);
    const total = n(debt.amount_total);

    sub.textContent =
      `${paid.toLocaleString()} / ${total.toLocaleString()} payé`;

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent =
      formatMoney(debt.amount_remaining || 0);

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    box.appendChild(item);
  });

  if (debts.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucune dette client";
    box.appendChild(empty);
  }
}

function renderPurchases() {
  clearNode("purchaseList");

  const box = $("purchaseList");
  if (!box) return;

  const list = state.recentPurchases || [];

  list.forEach(p => {
    const item = document.createElement("div");
    item.className = "activity-item";

    const left = document.createElement("div");
    left.className = "activity-left";

    const title = document.createElement("div");
    title.className = "activity-title";
    title.textContent = p.supplier || "Fournisseur";

    const meta = document.createElement("div");
    meta.className = "activity-meta";
    meta.textContent =
      getDate(p.createdAt)?.toLocaleString() || "";

    const value = document.createElement("div");
    value.className = "activity-price";
    value.textContent = formatMoney(getPurchaseTotal(p));

    left.appendChild(title);
    left.appendChild(meta);

    item.appendChild(left);
    item.appendChild(value);

    box.appendChild(item);
  });

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucun achat sur cette période";
    box.appendChild(empty);
  }
}

function renderKPIs(
  sales,
  expenses,
  losses,
  previousSales = [],
  previousExpenses = [],
  previousLosses = []
) {
  const saleIds = new Set(sales.map(s => s.id));

  const filteredItems =
    state.saleItems.filter(i => saleIds.has(i.saleId || i.sale_id));

  const totalSales =
    filteredItems.reduce(
      (s, i) =>
        s + (n(i.price) * n(i.quantity)),
      0
    );

  const grossProfit =
    filteredItems.reduce(
      (s, i) => s + n(i.profit),
      0
    );

  const totalExpenses =
    expenses
      .filter(isActiveExpense)
      .reduce((sum, e) => sum + n(e.amount), 0);

  const totalLossesPeriod =
    losses
      .filter(e => e.isSystemCorrection !== true && e.status !== "cancelled")
      .reduce((sum, e) => sum + n(e.amount), 0);

  const realProfit = grossProfit - totalExpenses - totalLossesPeriod;

  const basket =
    sales.length
      ? totalSales / sales.length
      : 0;

  const marginRate =
    totalSales > 0
      ? (grossProfit / totalSales) * 100
      : 0;

  const previousSaleIds = new Set(previousSales.map(s => s.id));

  const previousItems =
    state.saleItems.filter(i => previousSaleIds.has(i.saleId || i.sale_id));

  const prevSalesTotal =
    previousItems.reduce(
      (sum, i) => sum + n(i.price) * n(i.quantity),
      0
    );

  const prevGrossProfit =
    previousItems.reduce(
      (sum, i) => sum + n(i.profit),
      0
    );

  const prevExpensesTotal =
    previousExpenses
      .filter(isActiveExpense)
      .reduce((sum, e) => sum + n(e.amount), 0);

  const prevLossesTotal =
    previousLosses
      .filter(e => e.isSystemCorrection !== true && e.status !== "cancelled")
      .reduce((sum, e) => sum + n(e.amount), 0);

  const prevProfitTotal =
    prevGrossProfit - prevExpensesTotal - prevLossesTotal;

  const prevBasket =
    previousSales.length
      ? prevSalesTotal / previousSales.length
      : 0;

  const prevMargin =
    prevSalesTotal > 0
      ? (prevGrossProfit / prevSalesTotal) * 100
      : 0;

  const calcTrend = (current, previous) => {
    if (previous === null || previous === undefined) {
      return null;
    }
    if (previous <= 0) {
      return current > 0 ? null : 0;
    }
    return ((current - previous) / previous) * 100;
  };

  const salesTrendValue = calcTrend(totalSales, prevSalesTotal);
  const profitTrendValue = calcTrend(realProfit, prevProfitTotal);
  const basketTrendValue = calcTrend(basket, prevBasket);
  const marginTrendValue = calcTrend(marginRate, prevMargin);

  setText("salesValue", formatMoney(totalSales));
  setText("profitValue", formatMoney(realProfit));
  setText("basketValue", formatMoney(basket));
  setText("marginValue", `${marginRate.toFixed(1)}%`);

  const updateTrend = (id, value) => {
    const el = $(id);
    if (!el) return;

    if (value === null) {
      el.textContent = "—";
      el.className = "kpi-trend";
      return;
    }

    const v = n(value);
    const positive = v >= 0;

    el.textContent = `${positive ? "+" : ""}${v.toFixed(1)}%`;
    el.className = positive
      ? "kpi-trend trend-up"
      : "kpi-trend trend-down";
  };

  updateTrend("salesTrend", salesTrendValue);
  updateTrend("profitTrend", profitTrendValue);
  updateTrend("basketTrend", basketTrendValue);
  updateTrend("marginTrend", marginTrendValue);
}

function renderProducts() {
  clearNode("topProductsList");
  clearNode("deadProductsList");
  clearNode("criticalStockList");

  const topBox = $("topProductsList");
  const deadBox = $("deadProductsList");
  const criticalBox = $("criticalStockList");

  if (!topBox || !deadBox || !criticalBox) {
    return;
  }

  const salesMap = {};

  state.saleItems.forEach(item => {
    const productId =
      item.productId ||
      item.product_id;

    if (!productId) {
      return;
    }

    salesMap[productId] ??= 0;

    salesMap[productId] += n(
      item.quantity ||
      item.qty ||
      item.stock_out
    );
  });

  const productsWithSales = state.products.map(product => ({
    ...product,
    soldQty: salesMap[product.id] || 0
  }));

  const topProducts = [...productsWithSales]
    .filter(p => p.soldQty > 0)
    .sort((a, b) => b.soldQty - a.soldQty)
    .slice(0, 5);

  topProducts.forEach(product => {
    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = product.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Quantité vendue";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(product.soldQty);

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    topBox.appendChild(item);
  });

  const deadProducts = [...productsWithSales]
    .filter(p => p.soldQty <= 0)
    .sort((a, b) => n(b.stock_current) - n(a.stock_current))
    .slice(0, 5);

  deadProducts.forEach(product => {
    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = product.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Aucune vente";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(n(product.stock_current));

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    deadBox.appendChild(item);
  });

  const criticalProducts = state.products
    .filter(product => {
      const alertLevel = n(product.stock_alert) || 5;
      return n(product.stock_current) <= alertLevel;
    })
    .sort(
      (a, b) =>
        n(a.stock_current) -
        n(b.stock_current)
    )
    .slice(0, 5);

  criticalProducts.forEach(product => {
    const item = document.createElement("div");
    item.className = "list-item";

    const left = document.createElement("div");
    left.className = "list-left";

    const title = document.createElement("div");
    title.className = "list-title";
    title.textContent = product.name || "Produit";

    const sub = document.createElement("div");
    sub.className = "list-sub";
    sub.textContent = "Stock critique";

    const value = document.createElement("div");
    value.className = "list-value";
    value.textContent = String(n(product.stock_current));

    left.appendChild(title);
    left.appendChild(sub);

    item.appendChild(left);
    item.appendChild(value);

    criticalBox.appendChild(item);
  });
}

function renderSellers(sales, saleItems) {
  clearNode("leaderboardList");
  clearNode("weakSellerList");

  const boxTop = $("leaderboardList");
  const boxWeak = $("weakSellerList");
  if (!boxTop || !boxWeak) return;

  const SELLER_SHARE_THRESHOLD = 30;
  const map = {};
  const UNKNOWN = "__unknown__";

  const itemsBySale = {};

  saleItems.forEach(i => {
    const key = i.saleId || i.sale_id;
    if (!key) {
      return;
    }
    if (!itemsBySale[key]) {
      itemsBySale[key] = [];
    }
    itemsBySale[key].push(i);
  });

  sales.forEach(s => {
    const sellerId = s.sellerId || UNKNOWN;
    const saleKey = s.saleId || s.id;
    const items = itemsBySale[saleKey] || [];

    if (!map[sellerId]) {
      map[sellerId] = { amount: 0, saleCount: 0, unitCount: 0 };
    }

    map[sellerId].saleCount += 1;

    items.forEach(i => {
      map[sellerId].amount += n(i.price) * n(i.quantity);
      map[sellerId].unitCount += n(i.quantity);
    });
  });

  const totalSaleCount = sales.length;

  const appendEmpty = (box, message) => {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = message;
    box.appendChild(empty);
  };

  if (totalSaleCount === 0) {
    appendEmpty(boxTop, "Aucune vente sur cette période");
    appendEmpty(boxWeak, "Aucun vendeur à comparer");
    return;
  }

  const ranked = Object.entries(map)
    .filter(([, v]) => v.saleCount > 0)
    .map(([id, v]) => ({
      id,
      v,
      share: (v.saleCount / totalSaleCount) * 100
    }));

  const topSellers = ranked
    .filter(entry => entry.share >= SELLER_SHARE_THRESHOLD)
    .sort((a, b) => b.share - a.share)
    .slice(0, 5);

  const weakSellers = ranked
    .filter(entry => entry.share < SELLER_SHARE_THRESHOLD)
    .sort((a, b) => a.share - b.share)
    .slice(0, 5);

  const renderList = (box, data, badge = null) => {
    data.forEach(({ id, v, share }) => {
      const el = document.createElement("div");
      el.className = "list-item";

      const left = document.createElement("div");
      left.className = "list-left";

      const title = document.createElement("div");
      title.className = "list-title";
      title.textContent = resolveSellerName(id);

      const sub = document.createElement("div");
      sub.className = "list-sub";
      sub.textContent =
        `${v.saleCount} vente(s) • ${share.toFixed(1)}% du total`;

      const value = document.createElement("div");
      value.className = "list-value";
      value.textContent = formatMoney(v.amount);

      if (badge) {
        const tag = document.createElement("div");
        tag.className = `badge ${badge}`;
        tag.textContent = badge === "badge-green" ? "TOP" : "LOW";
        left.appendChild(tag);
      }

      left.appendChild(title);
      left.appendChild(sub);

      el.appendChild(left);
      el.appendChild(value);

      box.appendChild(el);
    });
  };

  if (topSellers.length === 0) {
    appendEmpty(boxTop, `Aucun vendeur ≥ ${SELLER_SHARE_THRESHOLD}% des ventes`);
  } else {
    renderList(boxTop, topSellers, "badge-green");
  }

  if (weakSellers.length === 0) {
    appendEmpty(boxWeak, `Aucun vendeur < ${SELLER_SHARE_THRESHOLD}% des ventes`);
  } else {
    renderList(boxWeak, weakSellers, "badge-orange");
  }
}

function renderAlerts() {
  const expenseEl = $("expenseAlertText");

  if (expenseEl) {
    const expenses = state.expenses;

    const totalExpenses = expenses.reduce(
      (sum, e) => sum + n(e.amount),
      0
    );

    const avgExpense = expenses.length
      ? totalExpenses / expenses.length
      : 0;

    const abnormalExpenses = expenses.filter(
      e => n(e.amount) > (avgExpense * 2)
    );

    expenseEl.textContent = abnormalExpenses.length
      ? `${abnormalExpenses.length} Dépense(s) supérieure(s) à la moyenne`
      : "Aucune Dépense anormale détectée";
  }

  const businessEl = $("businessAlertText");

  if (businessEl) {
    const lowStockCount = state.products.filter(
      p => n(p.stock_current) <= 5
    ).length;

    const outOfStockCount = state.products.filter(
      p => n(p.stock_current) <= 0
    ).length;

    const debtCount = state.debts.filter(
      e =>
        e.status !== "paid" &&
        n(e.amount_remaining) > 0
    ).length;

    const messages = [];

    if (outOfStockCount > 0) {
      messages.push(`${outOfStockCount} produit(s) en rupture`);
    }

    if (lowStockCount > 0) {
      messages.push(`${lowStockCount} produit(s) à réapprovisionner`);
    }

    if (debtCount > 0) {
      messages.push(`${debtCount} dette(s) à recouvrer`);
    }

    if (state.config?.enableExpiration) {
      const alertDays = state.config?.expirationAlertDays ?? 30;
      const { expiringSoonCount, expiredCount } = getExpiringAlerts(
        state.products,
        state.stockMovements,
        alertDays
      );

      if (expiringSoonCount > 0) {
        messages.push(
          `${expiringSoonCount} produit(s) expirent dans ${alertDays} jours`
        );
      }

      if (expiredCount > 0) {
        messages.push(
          `${expiredCount} lot(s) expiré(s) en stock`
        );
      }
    }

    businessEl.textContent = messages.length
      ? messages.join(" • ")
      : "Aucune opportunité particulière détectée";
  }
}

function renderActivity() {
  const box = $("recentActivityList");
  if (!box) return;

  clearNode("recentActivityList");

  const movements = state.recentStockMovements || [];

  movements.forEach(m => {
    const el = document.createElement("div");
    el.className = "activity-item";

    const left = document.createElement("div");
    left.className = "activity-left";

    const title = document.createElement("div");
    title.className = "activity-title";

    const product = state.products.find(p => p.id === m.productId);

    const typeLabel =
      m.type === "IN" ? "📥 Entrée stock" :
      m.type === "OUT" ? "📤 Sortie stock" :
      "⚙ Mouvement stock";

    const reasonLabel =
      m.reason ? ` (${m.reason})` : "";

    title.textContent =
      `${typeLabel}${reasonLabel} - ${product?.name || "Produit"}`;

    const meta = document.createElement("div");
    meta.className = "activity-meta";

    const date = getDate(m.createdAt)?.toLocaleString() || "";

    meta.textContent =
      `${date} • Qty: ${m.quantity || 0}`;

    const value = document.createElement("div");
    value.className = "activity-price";
    value.textContent = `${m.quantity || 0} pcs`;

    left.appendChild(title);
    left.appendChild(meta);

    el.appendChild(left);
    el.appendChild(value);

    box.appendChild(el);
  });

  if (movements.length === 0) {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.textContent = "Aucune activité sur cette période";
    box.appendChild(empty);
  }
}

import {
  canAccessAdmin,
  loadUserPermissions,
  hasScope
} from "../admin/js/permissions.js";
import { isMasterAdmin } from "../admin/js/entity-context.js";

const NAV_ITEMS = [
  { href: "index.html", label: "🛒 Vente", section: "metier", scopes: ["scope_sales"] },
  { href: "products.html", label: "📦 Produits", section: "metier" },
  { href: "tools.html", label: "🧰 Outils", section: "metier", scopes: ["scope_tools"] },
  { href: "ranging.html", label: "🏆 Ranking", section: "metier" },
  { href: "purchases.html", label: "📥 Achats", section: "metier" },
  { href: "vendus.html", label: "📋 Vendus", section: "metier" },
  { href: "finances.html", label: "💰 Finances", section: "metier" },
  { href: "expenses.html", label: "💸 Depenses", section: "metier" },
  { href: "debts.html", label: "🧾 Dettes", section: "metier" },
  { href: "losses.html", label: "📉 Pertes", section: "metier" },
  { href: "logs.html", label: "🧾 Logs", section: "metier", scopes: ["scope_admin"] },
  { href: "loader.html", label: "📩 Vue rapide", section: "metier" },
  { href: "help.html", label: "🤝 Aide", section: "systeme" },
  { href: "login.html", label: "🔐 Connexion", section: "systeme" }
];

const ADMIN_ITEMS = [
  { href: "admin/admin.html", label: "⚙️ Administration", admin: true },
  { href: "admin/settings.html", label: "🔧 Paramètres", admin: true },
  { href: "admin/logs.html", label: "🧾 Logs globaux", admin: true },
  { href: "stats.html", label: "📊 Stats societe", admin: true },
  { href: "admin/stats.html", label: "📈 Stats globales", master: true }
];

const DESKTOP_MQ = window.matchMedia("(min-width: 1024px)");
let drawerMqBound = false;

function getBasePath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  const depth = parts.length - 1;
  if (parts[0] === "admin") {
    return "../".repeat(depth);
  }
  return depth > 1 ? "../".repeat(depth - 1) : "";
}

function resolveHref(href) {
  const base = getBasePath();
  if (!base) {
    return href;
  }
  return `${base}${href}`;
}

function currentFile() {
  return location.pathname.split("/").pop() || "index.html";
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text) {
    el.textContent = text;
  }
  return el;
}

function canSeeItem(item, permissions, isAdmin) {
  if (!item?.scopes?.length) {
    return true;
  }
  if (isAdmin) {
    return true;
  }
  return item.scopes.some(scope => hasScope(scope, permissions));
}

function addSection(nav, title, items) {
  if (!items.length) {
    return;
  }
  nav.appendChild(createEl("div", "drawer-section-title", title));
  const current = currentFile();
  items.forEach(item => {
    const link = createEl("a", "drawer-link", item.label);
    link.href = resolveHref(item.href);
    if (item.href.endsWith(current)) {
      link.classList.add("active");
    }
    nav.appendChild(link);
  });
}

function populateDrawerNav(nav, isAdmin, isMaster, permissions) {
  nav.replaceChildren();

  addSection(
    nav,
    "Métier",
    NAV_ITEMS.filter(i => i.section === "metier" && canSeeItem(i, permissions, isAdmin))
  );
  addSection(nav, "Système", NAV_ITEMS.filter(i => i.section === "systeme"));

  if (isAdmin) {
    const adminLinks = ADMIN_ITEMS.filter(item => !item.master || isMaster);
    addSection(nav, "Admin", adminLinks);
  }
}

function setDrawerOpen(drawer, overlay, open) {
  if (!drawer) {
    return;
  }
  drawer.classList.toggle("open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  if (overlay) {
    overlay.classList.toggle("open", open);
  }
}

function applyResponsiveLayout(drawer, overlay) {
  if (!drawer) {
    return;
  }
  if (DESKTOP_MQ.matches) {
    setDrawerOpen(drawer, overlay, true);
    return;
  }
  setDrawerOpen(drawer, overlay, false);
}

function bindDrawerEvents(toggle, overlay, drawer) {
  if (!toggle || !drawer) {
    return;
  }
  if (toggle.dataset.nsonoDrawerBound === "1") {
    return;
  }
  toggle.dataset.nsonoDrawerBound = "1";

  toggle.addEventListener("click", () => {
    if (DESKTOP_MQ.matches) {
      return;
    }
    const willOpen = !drawer.classList.contains("open");
    setDrawerOpen(drawer, overlay, willOpen);
  });

  overlay?.addEventListener("click", () => {
    setDrawerOpen(drawer, overlay, false);
  });

  if (!drawerMqBound) {
    DESKTOP_MQ.addEventListener("change", () => {
      const currentDrawer = document.getElementById("nsonoDrawer");
      const currentOverlay = document.getElementById("nsonoDrawerOverlay");
      applyResponsiveLayout(currentDrawer, currentOverlay);
    });
    drawerMqBound = true;
  }
}

export function initDrawerNavigation(isAdmin, isMaster, permissions = null) {
  const drawer = document.getElementById("nsonoDrawer");
  const nav = document.getElementById("nsonoDrawerNav");
  const toggle = document.getElementById("nsonoDrawerToggle");
  const overlay = document.getElementById("nsonoDrawerOverlay");

  if (!drawer || !nav) {
    return;
  }

  populateDrawerNav(nav, isAdmin, isMaster, permissions);
  bindDrawerEvents(toggle, overlay, drawer);
  applyResponsiveLayout(drawer, overlay);
}

async function bootstrapDrawer() {
  const uid = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  const localIsAdmin = role === "admin";

  // Render immédiat pour éviter tout délai au clic hamburger.
  initDrawerNavigation(localIsAdmin, localIsAdmin, null);

  if (!uid) {
    return;
  }

  try {
    const permissions = await loadUserPermissions(uid);
    const isAdmin = canAccessAdmin(permissions);
    initDrawerNavigation(isAdmin, isMasterAdmin(), permissions);
  } catch {
    /* fallback role local */
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bootstrapDrawer);
} else {
  bootstrapDrawer();
}

import { isAppLocked } from "./services/firebaseService.js";
import { canAccessAdmin, loadUserPermissions } from "../admin/js/permissions.js";
import { isMasterAdmin } from "../admin/js/entity-context.js";

const NAV_ITEMS = [
  { href: "index.html", label: "🛒 Vente", section: "metier" },
  { href: "products.html", label: "📦 Produits", section: "metier" },
  { href: "purchases.html", label: "📥 Achats", section: "metier" },
  { href: "vendus.html", label: "📋 Vendus", section: "metier" },
  { href: "finances.html", label: "💰 Finances", section: "metier" },
  { href: "stats.html", label: "📊 Stats boutique", section: "metier" },
  { href: "loader.html", label: "📩 Vue rapide", section: "metier" },
  { href: "pages.html", label: "📂 Menu complet", section: "systeme" },
  { href: "help.html", label: "🤝 Aide", section: "systeme" }
];

const ADMIN_ITEMS = [
  { href: "admin/admin.html", label: "⚙️ Administration", admin: true },
  { href: "admin/settings.html", label: "🔧 Paramètres", admin: true },
  { href: "admin/stats.html", label: "📈 Stats globales", master: true },
  { href: "batch/batch_management.html", label: "📦 Lots", admin: true }
];

function getBasePath() {
  const parts = location.pathname.split("/").filter(Boolean);
  if (parts.length <= 1) {
    return "";
  }
  const depth = parts.length - 1;
  if (parts[0] === "admin" || parts[0] === "batch") {
    return "../".repeat(depth);
  }
  return depth > 1 ? "../".repeat(depth - 1) : "";
}

function resolveHref(href) {
  const base = getBasePath();
  if (!base) {
    return href;
  }
  if (href.startsWith("admin/") || href.startsWith("batch/")) {
    return `${base}${href}`;
  }
  return `${base}${href}`;
}

function currentFile() {
  return location.pathname.split("/").pop() || "index.html";
}

function createEl(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text) el.textContent = text;
  return el;
}

function renderLockBadge(container) {
  const badge = createEl("span", null, "🔒 Écritures verrouillées (local)");
  badge.id = "nsonoLockBadge";
  if (!isAppLocked()) {
    badge.classList.add("hidden");
  }
  container.appendChild(badge);

  window.addEventListener("nsono:lock-changed", e => {
    badge.classList.toggle("hidden", !e.detail?.locked);
  });
}

function buildDrawer(isAdmin, isMaster) {
  if (document.getElementById("nsonoDrawer")) {
    return;
  }

  const toggle = createEl("button", null, "☰");
  toggle.id = "nsonoDrawerToggle";
  toggle.type = "button";
  toggle.setAttribute("aria-label", "Ouvrir le menu");

  const overlay = createEl("div");
  overlay.id = "nsonoDrawerOverlay";

  const drawer = createEl("aside");
  drawer.id = "nsonoDrawer";

  const header = createEl("div");
  header.id = "nsonoDrawerHeader";
  header.appendChild(createEl("h2", null, "NSONO"));
  header.appendChild(createEl("p", null, "Navigation"));
  renderLockBadge(header);

  const nav = createEl("nav");
  nav.id = "nsonoDrawerNav";

  const current = currentFile();

  const addSection = (title, items) => {
    nav.appendChild(createEl("div", "drawer-section-title", title));
    items.forEach(item => {
      const a = createEl("a", "drawer-link", item.label);
      a.href = resolveHref(item.href);
      if (item.href.endsWith(current)) {
        a.classList.add("active");
      }
      nav.appendChild(a);
    });
  };

  addSection("Métier", NAV_ITEMS.filter(i => i.section === "metier"));
  addSection("Système", NAV_ITEMS.filter(i => i.section === "systeme"));

  if (isAdmin) {
    const adminLinks = ADMIN_ITEMS.filter(item => {
      if (item.master) return isMaster;
      return true;
    });
    if (adminLinks.length) {
      addSection("Admin", adminLinks);
    }
  }

  drawer.append(header, nav);
  document.body.append(toggle, overlay, drawer);
  document.body.classList.add("nsono-drawer-desktop");

  const open = () => {
    drawer.classList.add("open");
    overlay.classList.add("open");
  };

  const close = () => {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  };

  toggle.addEventListener("click", () => {
    if (drawer.classList.contains("open")) {
      close();
    } else {
      open();
    }
  });

  overlay.addEventListener("click", close);

  if (window.matchMedia("(min-width: 1024px)").matches) {
    drawer.classList.add("open");
  }
}

async function initDrawer() {
  const uid = localStorage.getItem("userId");
  const role = localStorage.getItem("userRole");
  let isAdmin = role === "admin";

  if (uid) {
    try {
      const permissions = await loadUserPermissions(uid);
      isAdmin = canAccessAdmin(permissions);
      buildDrawer(isAdmin, isMasterAdmin());
      return;
    } catch {
      /* fallback role local */
    }
  }

  buildDrawer(isAdmin, role === "admin");
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initDrawer);
} else {
  initDrawer();
}

export function refreshDrawerLockBadge() {
  const badge = document.getElementById("nsonoLockBadge");
  if (!badge) return;
  badge.classList.toggle("hidden", !isAppLocked());
}

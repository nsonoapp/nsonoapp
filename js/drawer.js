import {
  canAccessAdmin,
  loadUserPermissions
} from "../admin/js/permissions.js";
import { isMasterAdmin } from "../admin/js/entity-context.js";

const HUB_ITEM = {
  href: "index.html",
  title: "NSONO",
  subtitle: "Espace de travail",
  icon: "◆"
};

const PUBLIC_SECTIONS = [
  {
    title: "Ventes & stock",
    items: [
      { href: "index.html", label: "Vente", icon: "🛒" },
      { href: "products.html", label: "Produits", icon: "📦" },
      { href: "tools.html", label: "Outils", icon: "🧰" },
      { href: "purchases.html", label: "Achats", icon: "📥" },
      { href: "vendus.html", label: "Vendus", icon: "📋" },
      { href: "ranging.html", label: "Ranking", icon: "🏆" }
    ]
  },
  {
    title: "Finances",
    items: [
      { href: "finances.html", label: "Finances", icon: "💰" },
      { href: "expenses.html", label: "Depenses", icon: "💸" },
      { href: "debts.html", label: "Dettes", icon: "🧾" },
      { href: "losses.html", label: "Pertes", icon: "📉" }
    ]
  },
  {
    title: "Suivi",
    items: [
      { href: "logs.html", label: "Logs", icon: "🧾" },
      { href: "loader.html", label: "Vue rapide", icon: "📩" }
    ]
  },
  {
    title: "Systeme",
    items: [
      { href: "help.html", label: "Aide", icon: "🤝" },
      { href: "login.html", label: "Connexion", icon: "🔐" }
    ]
  }
];

const ADMIN_SECTION = {
  title: "Administration",
  items: [
    { href: "admin/admin.html", label: "Administration", icon: "⚙️" },
    { href: "admin/settings.html", label: "Parametres", icon: "🔧" },
    { href: "admin/logs.html", label: "Logs globaux", icon: "🧾" },
    { href: "stats.html", label: "Stats societe", icon: "📊" },
    { href: "admin/stats.html", label: "Stats globales", icon: "📈", master: true }
  ]
};

const DESKTOP_MQ = window.matchMedia("(min-width: 1024px)");
let drawerMqBound = false;
let drawerUiBound = false;

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
  if (text !== undefined && text !== null) {
    el.textContent = text;
  }
  return el;
}

function ensureDrawerStructure(drawer) {
  if (!drawer) {
    return null;
  }

  let brand = drawer.querySelector("#nsonoDrawerBrand");
  let scroll = drawer.querySelector(".drawer-scroll");
  let nav = document.getElementById("nsonoDrawerNav");
  let adminNav = document.getElementById("nsonoDrawerAdmin");

  if (brand && scroll && nav && adminNav) {
    return { brand, scroll, nav, adminNav };
  }

  drawer.replaceChildren();

  brand = createEl("div", "drawer-brand");
  brand.id = "nsonoDrawerBrand";

  scroll = createEl("div", "drawer-scroll");
  nav = createEl("nav", "drawer-nav");
  nav.id = "nsonoDrawerNav";
  nav.setAttribute("aria-label", "Navigation principale");

  adminNav = createEl("nav", "drawer-admin-slot");
  adminNav.id = "nsonoDrawerAdmin";
  adminNav.setAttribute("aria-label", "Administration");

  scroll.append(nav, adminNav);
  drawer.append(brand, scroll);

  return { brand, scroll, nav, adminNav };
}

function createDrawerItem(item, isActive) {
  const link = createEl("a", "drawer-item");
  link.href = resolveHref(item.href);

  const icon = createEl("span", "drawer-item-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.icon || "•";

  const label = createEl("span", "drawer-item-label", item.label);

  const trail = createEl("span", "drawer-item-trail");
  trail.setAttribute("aria-hidden", "true");
  trail.textContent = "›";

  if (isActive) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  link.append(icon, label, trail);
  return link;
}

function renderHub(brandEl) {
  if (!brandEl) {
    return;
  }

  brandEl.replaceChildren();

  const link = createEl("a", "drawer-brand-link");
  link.href = resolveHref(HUB_ITEM.href);

  const icon = createEl("span", "drawer-brand-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = HUB_ITEM.icon;

  const title = createEl("span", "drawer-brand-title", HUB_ITEM.title);
  const subtitle = createEl("span", "drawer-brand-subtitle", HUB_ITEM.subtitle);

  link.append(icon, title, subtitle);
  brandEl.appendChild(link);
}

function renderPublicNav(nav) {
  if (!nav) {
    return;
  }

  nav.replaceChildren();
  const current = currentFile();
  const fragment = document.createDocumentFragment();

  PUBLIC_SECTIONS.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      fragment.appendChild(createEl("hr", "drawer-divider"));
    }

    const sectionWrap = createEl("div", "drawer-section");
    sectionWrap.appendChild(createEl("div", "drawer-section-title", section.title));

    section.items.forEach(item => {
      const isActive = item.href.endsWith(current);
      sectionWrap.appendChild(createDrawerItem(item, isActive));
    });

    fragment.appendChild(sectionWrap);
  });

  nav.appendChild(fragment);
}

function renderAdminNav(adminNav, isMaster) {
  if (!adminNav) {
    return;
  }

  adminNav.replaceChildren();

  const items = ADMIN_SECTION.items.filter(item => !item.master || isMaster);
  if (!items.length) {
    return;
  }

  const fragment = document.createDocumentFragment();
  fragment.appendChild(createEl("hr", "drawer-divider"));

  const sectionWrap = createEl("div", "drawer-section");
  sectionWrap.appendChild(createEl("div", "drawer-section-title", ADMIN_SECTION.title));

  const current = currentFile();
  items.forEach(item => {
    const isActive = item.href.endsWith(current);
    sectionWrap.appendChild(createDrawerItem(item, isActive));
  });

  fragment.appendChild(sectionWrap);
  adminNav.appendChild(fragment);
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
  if (!toggle || !drawer || drawerUiBound) {
    return;
  }
  drawerUiBound = true;

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

function renderStaticDrawer() {
  const drawer = document.getElementById("nsonoDrawer");
  const toggle = document.getElementById("nsonoDrawerToggle");
  const overlay = document.getElementById("nsonoDrawerOverlay");
  const structure = ensureDrawerStructure(drawer);

  if (!structure) {
    return;
  }

  renderHub(structure.brand);
  renderPublicNav(structure.nav);
  bindDrawerEvents(toggle, overlay, drawer);
  applyResponsiveLayout(drawer, overlay);
}

async function injectAdminLinks() {
  const adminNav = document.getElementById("nsonoDrawerAdmin");
  if (!adminNav) {
    return;
  }

  const uid = localStorage.getItem("userId");
  if (!uid) {
    adminNav.replaceChildren();
    return;
  }

  try {
    const permissions = await loadUserPermissions(uid);
    if (!canAccessAdmin(permissions)) {
      adminNav.replaceChildren();
      return;
    }
    renderAdminNav(adminNav, isMasterAdmin());
  } catch {
    adminNav.replaceChildren();
  }
}

export function initDrawerNavigation() {
  renderStaticDrawer();
}

async function bootstrapDrawer() {
  renderStaticDrawer();
  await injectAdminLinks();
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", () => {
    bootstrapDrawer().catch(() => {
      /* menu public deja affiche */
    });
  });
} else {
  bootstrapDrawer().catch(() => {
    /* menu public deja affiche */
  });
}

// NAV — shell drawer + rendu public (support NSOSO* et nsono*)
const currentPage = location.pathname.split("/").pop();
const DRAWER_DESKTOP_MQ = window.matchMedia("(min-width: 1024px)");

const DRAWER_HUB_ITEM = {
  href: "index.html",
  title: "NSOSO",
  subtitle: "Espace de travail",
  icon: "◆"
};

const DRAWER_PUBLIC_VERSION = "4";

const DRAWER_PUBLIC_SECTIONS = [
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
      { href: "loader.html", label: "Vue rapide", icon: "📩" }
    ]
  },
  {
    title: "Systeme",
    items: [
      { href: "help.html", label: "Aide", icon: "🤝" },
      { href: "login.html", label: "Connexion", icon: "🔐" }
    ]
  },
  {
    title: "Administration",
    items: [
      { href: "admin/admin.html", label: "Hub administration", icon: "⚙️", adminOnly: true },
      { href: "admin/approvals.html", label: "Approbations", icon: "✅", adminOnly: true },
      { href: "admin/entities.html", label: "Entites", icon: "🏬", adminOnly: true },
      { href: "admin/roles.html", label: "Roles", icon: "👤", adminOnly: true },
      { href: "settings.html", label: "Parametres entite", icon: "🔧", adminOnly: true },
      { href: "admin/settings.html", label: "Parametres admin", icon: "🛠️", adminOnly: true },
      { href: "stats.html", label: "Stats societe", icon: "📊", adminOnly: true },
      { href: "logs.html", label: "Logs entite", icon: "📋", adminOnly: true },
      { href: "admin/logs.html", label: "Logs globaux", icon: "🧾", adminOnly: true },
      { href: "admin/company.html", label: "Societe", icon: "🏢", adminOnly: true, masterOnly: true },
      { href: "admin/stats.html", label: "Stats globales", icon: "📈", adminOnly: true, masterOnly: true }
    ]
  }
];

function setDrawerOpenState(drawer, overlay, open) {
  if (!drawer) {
    return;
  }
  drawer.classList.toggle("open", open);
  drawer.setAttribute("aria-hidden", open ? "false" : "true");
  if (overlay) {
    overlay.classList.toggle("open", open);
  }
}

function bindDrawerToggleImmediate() {
  const shell = getDrawerShell();
  const { toggle, drawer, overlay } = shell;
  if (!toggle || !drawer || toggle.dataset.nsonoDrawerBound === "1") {
    return;
  }

  toggle.dataset.nsonoDrawerBound = "1";

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    if (DRAWER_DESKTOP_MQ.matches) {
      return;
    }
    setDrawerOpenState(drawer, overlay, !drawer.classList.contains("open"));
  });

  overlay?.addEventListener("click", () => {
    setDrawerOpenState(drawer, overlay, false);
  });
}

function drawerEl(...ids) {
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el) {
      return el;
    }
  }
  return null;
}

function getDrawerShell() {
  const drawer = drawerEl("nsonoDrawer", "NSOSODrawer");
  const overlay = drawerEl("nsonoDrawerOverlay", "NSOSODrawerOverlay");
  const main = drawerEl("nsonoMain", "NSOSOMain");
  const toggle = drawerEl("nsonoDrawerToggle", "NSOSODrawerToggle");

  return {
    overlay,
    drawer,
    brand: drawerEl("nsonoDrawerBrand", "NSOSODrawerBrand"),
    nav: drawerEl("nsonoDrawerNav", "NSOSODrawerNav"),
    adminNav: drawerEl("nsonoDrawerAdmin", "NSOSODrawerAdmin"),
    main,
    toggle,
    overlayId: overlay?.id || (drawer?.id?.includes("NSOSO") ? "NSOSODrawerOverlay" : "nsonoDrawerOverlay"),
    drawerId: drawer?.id || "nsonoDrawer",
    usesLegacyIds: Boolean(drawer?.id?.startsWith("NSOSO"))
  };
}

function hasPrebuiltDrawerShell() {
  const shell = getDrawerShell();
  return Boolean(shell.drawer && shell.main);
}

function markAppShellReady() {
  document.body.classList.add("nsono-app");
  document.body.classList.add("NSOSO-app");
}

function resolveDrawerHref(href) {
  const parts = location.pathname.split("/").filter(Boolean);
  let base = "";
  if (parts.length > 1) {
    const depth = parts.length - 1;
    base = parts[0] === "admin" ? "../".repeat(depth) : (depth > 1 ? "../".repeat(depth - 1) : "");
  }
  return base ? `${base}${href}` : href;
}

function createDrawerNode(tag, className, text) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  if (text !== undefined && text !== null) {
    el.textContent = text;
  }
  return el;
}

function isDrawerItemActive(href) {
  const target = String(href || "").replace(/^\//, "");
  const path = location.pathname.replace(/^\//, "");
  return path === target || path.endsWith(`/${target}`);
}

function createDrawerPublicItem(item, isActive) {
  const link = createDrawerNode("a", "drawer-item");
  link.setAttribute("data-href", item.href);
  link.href = resolveDrawerHref(item.href);

  const icon = createDrawerNode("span", "drawer-item-icon");
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = item.icon || "•";

  const label = createDrawerNode("span", "drawer-item-label", item.label);
  const trail = createDrawerNode("span", "drawer-item-trail");
  trail.setAttribute("aria-hidden", "true");
  trail.textContent = "›";

  const active = isActive ?? isDrawerItemActive(item.href);
  if (active) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  if (item.adminOnly) {
    link.setAttribute("data-admin-only", "1");
    link.hidden = true;
  }
  if (item.masterOnly) {
    link.setAttribute("data-master-only", "1");
    link.hidden = true;
  }

  link.append(icon, label, trail);
  return link;
}

function ensureDrawerDomShell() {
  const shell = getDrawerShell();
  const drawer = shell.drawer;
  if (!drawer) {
    return null;
  }

  let brand = shell.brand;
  const scroll = drawer.querySelector(".drawer-scroll");
  let nav = shell.nav;
  let adminNav = shell.adminNav;

  if (brand && scroll && nav && adminNav) {
    return { brand, nav };
  }

  drawer.replaceChildren();

  brand = createDrawerNode("div", "drawer-brand");
  brand.id = shell.drawerId.replace("Drawer", "DrawerBrand");

  const scrollEl = createDrawerNode("div", "drawer-scroll");
  nav = createDrawerNode("nav", "drawer-nav");
  nav.id = shell.drawerId.replace("Drawer", "DrawerNav");
  nav.setAttribute("aria-label", "Navigation principale");

  adminNav = createDrawerNode("nav", "drawer-admin-slot");
  adminNav.id = shell.drawerId.replace("Drawer", "DrawerAdmin");
  adminNav.setAttribute("aria-label", "Administration");

  scrollEl.append(nav, adminNav);
  drawer.append(brand, scrollEl);

  return { brand, nav };
}

function renderDrawerPublicShell() {
  const shell = ensureDrawerDomShell();
  if (!shell) {
    return;
  }

  const current = currentPage || "index.html";

  if (shell.brand.dataset.nsonoPublicReady !== "1") {
    shell.brand.replaceChildren();

    const hubLink = createDrawerNode("a", "drawer-brand-link");
    hubLink.href = resolveDrawerHref(DRAWER_HUB_ITEM.href);

    const hubIcon = createDrawerNode("span", "drawer-brand-icon");
    hubIcon.setAttribute("aria-hidden", "true");
    hubIcon.textContent = DRAWER_HUB_ITEM.icon;

    hubLink.append(
      hubIcon,
      createDrawerNode("span", "drawer-brand-title", DRAWER_HUB_ITEM.title),
      createDrawerNode("span", "drawer-brand-subtitle", DRAWER_HUB_ITEM.subtitle)
    );

    shell.brand.appendChild(hubLink);
    shell.brand.dataset.nsonoPublicReady = "1";
  }

  if (shell.nav.dataset.nsonoPublicReady === DRAWER_PUBLIC_VERSION) {
    applyDrawerAdminLinkVisibility();
    return;
  }

  shell.nav.replaceChildren();
  const fragment = document.createDocumentFragment();

  DRAWER_PUBLIC_SECTIONS.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      fragment.appendChild(createDrawerNode("hr", "drawer-divider"));
    }

    const sectionWrap = createDrawerNode("div", "drawer-section");
    if (section.title === "Administration") {
      sectionWrap.setAttribute("data-admin-section", "1");
      sectionWrap.hidden = true;
    }
    sectionWrap.appendChild(createDrawerNode("div", "drawer-section-title", section.title));

    section.items.forEach(item => {
      sectionWrap.appendChild(createDrawerPublicItem(item));
    });

    fragment.appendChild(sectionWrap);
  });

  shell.nav.appendChild(fragment);
  shell.nav.dataset.nsonoPublicReady = DRAWER_PUBLIC_VERSION;
  applyDrawerAdminLinkVisibility();
}

async function resolveDrawerAdminAccess() {
  const role = localStorage.getItem("userRole");
  const isMasterStored = localStorage.getItem("nsono_isMasterAdmin") === "1";

  if (role === "admin") {
    return { isAdmin: true, isMaster: isMasterStored };
  }

  const uid = localStorage.getItem("userId");
  if (!uid) {
    return { isAdmin: false, isMaster: isMasterStored };
  }

  try {
    const [{ canAccessAdmin, loadUserPermissions }, { isMasterAdmin }] = await Promise.all([
      import(resolveAssetPath("admin/js/permissions.js")),
      import(resolveAssetPath("admin/js/entity-context.js"))
    ]);
    const permissions = await loadUserPermissions(uid);
    return {
      isAdmin: canAccessAdmin(permissions),
      isMaster: isMasterStored || isMasterAdmin()
    };
  } catch {
    return { isAdmin: role === "admin", isMaster: isMasterStored };
  }
}

async function applyDrawerAdminLinkVisibility() {
  const links = document.querySelectorAll(
    "#nsonoDrawerNav .drawer-item[data-admin-only='1'], #NSOSODrawerNav .drawer-item[data-admin-only='1']"
  );
  if (!links.length) {
    return;
  }

  const access = await resolveDrawerAdminAccess();
  links.forEach(link => {
    if (!access.isAdmin) {
      link.hidden = true;
      return;
    }
    const masterOnly = link.hasAttribute("data-master-only");
    link.hidden = masterOnly && !access.isMaster;
  });

  document.querySelectorAll(
    "#nsonoDrawerNav [data-admin-section='1'], #NSOSODrawerNav [data-admin-section='1']"
  ).forEach(section => {
    section.hidden = !access.isAdmin;
  });
}

function scheduleDrawerAdminVisibilityRetries() {
  let attempts = 0;
  const maxAttempts = 10;
  const tick = () => {
    applyDrawerAdminLinkVisibility();
    attempts += 1;
    if (attempts < maxAttempts) {
      window.setTimeout(tick, 600);
    }
  };
  tick();
}

function resolveAssetPath(relativePath) {
  const parts = location.pathname.split("/").filter(Boolean);
  const inAdmin = parts[0] === "admin";
  if (!inAdmin) {
    return relativePath;
  }
  const depth = parts.length - 1;
  return `${"../".repeat(depth)}${relativePath}`;
}

function ensureDrawerCriticalStyles() {
  if (document.querySelector('link[data-nsono-drawer-critical="1"]')) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = resolveAssetPath("css/drawer-critical.css");
  link.dataset.nsonoDrawerCritical = "1";
  document.head.appendChild(link);
}

function ensureDrawerStyles() {
  ensureDrawerCriticalStyles();
  if (document.querySelector('link[data-nsono-drawer-css="1"]')) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = resolveAssetPath("css/drawer.css");
  link.dataset.nsonoDrawerCss = "1";
  document.head.appendChild(link);
}

function ensureOverlayForShell(shell) {
  if (shell.overlay || !shell.drawer) {
    return shell.overlay;
  }
  const overlay = document.createElement("div");
  overlay.id = shell.overlayId;
  document.body.insertBefore(overlay, shell.drawer);
  return overlay;
}

function ensureHeaderToggle(header) {
  if (!header) {
    return null;
  }
  const existing = getDrawerShell().toggle;
  if (existing) {
    return existing;
  }
  const shell = getDrawerShell();
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = shell.usesLegacyIds ? "NSOSODrawerToggle" : "nsonoDrawerToggle";
  toggle.setAttribute("aria-label", "Ouvrir le menu");
  toggle.textContent = "☰";
  header.insertBefore(toggle, header.firstChild);
  return toggle;
}

function ensureAppShell() {
  const shell = getDrawerShell();

  if (hasPrebuiltDrawerShell()) {
    markAppShellReady();
    ensureOverlayForShell(shell);
    ensureHeaderToggle(shell.main.querySelector("header"));
    renderDrawerPublicShell();
    bindDrawerToggleImmediate();
    return;
  }

  if (document.body.classList.contains("nsono-app") || document.body.classList.contains("NSOSO-app")) {
    ensureHeaderToggle(document.querySelector("#nsonoMain header, #NSOSOMain header, header"));
    renderDrawerPublicShell();
    return;
  }

  let overlay = shell.overlay;
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "nsonoDrawerOverlay";
    document.body.appendChild(overlay);
  }

  let drawer = shell.drawer;
  if (!drawer) {
    drawer = document.createElement("aside");
    drawer.id = "nsonoDrawer";
    drawer.setAttribute("aria-hidden", "true");

    const brand = document.createElement("div");
    brand.id = "nsonoDrawerBrand";
    brand.className = "drawer-brand";

    const scroll = document.createElement("div");
    scroll.className = "drawer-scroll";

    const nav = document.createElement("nav");
    nav.id = "nsonoDrawerNav";
    nav.className = "drawer-nav";
    nav.setAttribute("aria-label", "Navigation principale");

    const adminNav = document.createElement("nav");
    adminNav.id = "nsonoDrawerAdmin";
    adminNav.className = "drawer-admin-slot";
    adminNav.setAttribute("aria-label", "Administration");

    scroll.append(nav, adminNav);
    drawer.append(brand, scroll);
    document.body.appendChild(drawer);
  }

  let main = shell.main;
  if (!main) {
    main = document.createElement("div");
    main.id = "nsonoMain";
    const movable = [];
    Array.from(document.body.childNodes).forEach(node => {
      if (node === overlay || node === drawer) {
        return;
      }
      movable.push(node);
    });
    document.body.appendChild(main);
    movable.forEach(node => main.appendChild(node));
  }

  markAppShellReady();
  ensureHeaderToggle(main.querySelector("header"));
  renderDrawerPublicShell();
  bindDrawerToggleImmediate();
}

function ensureDrawerScript() {
  return import(resolveAssetPath("js/drawer.js"))
    .then(mod => {
      if (typeof mod.initDrawerNavigation === "function") {
        mod.initDrawerNavigation();
      }
    })
    .catch(err => {
      console.warn("NSOSO drawer:", err);
    });
}

async function bootAppNavigation() {
  ensureAppShell();
  bindDrawerToggleImmediate();
  await ensureDrawerScript();
  window.dispatchEvent(new CustomEvent("nsono:drawer-shell-ready"));
}

window.addEventListener("nsono:drawer-shell-ready", () => {
  import(resolveAssetPath("js/drawer.js"))
    .then(mod => mod.initDrawerNavigation?.())
    .catch(() => {});
});

function markActiveNavItems() {
  document.querySelectorAll(".nav-item").forEach(item => {
    if (item.dataset.page === currentPage) {
      item.classList.add("active");
    }
  });
}

function ensureHeaderTitleLayout() {
  const header = document.querySelector("#nsonoMain header, #NSOSOMain header, header");
  if (!header) {
    return;
  }

  const heading = header.querySelector("h1, h2, h3, .header-title, .NSOSO-page-title, .nsono-page-title");
  if (!heading) {
    return;
  }

  if (!document.getElementById("nsonoHeaderTitleLayoutStyle")) {
    const style = document.createElement("style");
    style.id = "nsonoHeaderTitleLayoutStyle";
    style.textContent = `
header .nsono-page-title,
header .NSOSO-page-title,
header .header-title.nsono-page-title {
  margin: 0;
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}
@media (min-width: 768px) {
  header .nsono-page-title,
  header .NSOSO-page-title,
  header .header-title.nsono-page-title {
    text-align: center;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}`;
    document.head.appendChild(style);
  }

  heading.classList.add("nsono-page-title");
}

function sanitizeSubName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 24);
}

function shouldDisplaySubName() {
  return currentPage === "index.html" || currentPage === "settings.html";
}

function ensureHeaderSubName() {
  if (!shouldDisplaySubName()) {
    return;
  }

  const header = document.querySelector("#nsonoMain header, #NSOSOMain header, header");
  const heading = header?.querySelector("h1, h2, h3");
  if (!header || !heading) {
    return;
  }

  const subName = sanitizeSubName(localStorage.getItem("nsono_entitySubName"));
  if (!subName) {
    return;
  }

  if (!document.getElementById("nsonoHeaderSubNameStyle")) {
    const style = document.createElement("style");
    style.id = "nsonoHeaderSubNameStyle";
    style.textContent = `
header .nsono-subname {
  margin-left: 8px;
  font-size: 12px;
  font-style: italic;
  font-weight: 400;
  opacity: 0.9;
}`;
    document.head.appendChild(style);
  }

  let subNameEl = document.getElementById("nsonoHeaderSubName");
  if (!subNameEl) {
    subNameEl = document.createElement("span");
    subNameEl.id = "nsonoHeaderSubName";
    subNameEl.className = "nsono-subname";
    heading.appendChild(subNameEl);
  }

  subNameEl.textContent = `(${subName})`;
}

function applyRoleVisibility() {
  const role = localStorage.getItem("userRole");
  if (role === "admin") {
    return;
  }
  document.querySelectorAll(".nav-item").forEach(item => {
    const href = item.getAttribute("href") || "";
    const target = item.dataset.page || href;
    if (target.includes("stats") || target.includes("admin/") || target.includes("logs.html")) {
      item.style.display = "none";
    }
  });
}

function bindDrawerAdminVisibilityEvents() {
  window.addEventListener("nsono:session-ready", () => {
    applyDrawerAdminLinkVisibility();
  });
  window.addEventListener("nsono:drawer-shell-ready", () => {
    applyDrawerAdminLinkVisibility();
  });
  window.addEventListener("nsono:drawer-admin-visibility", () => {
    applyDrawerAdminLinkVisibility();
  });
  scheduleDrawerAdminVisibilityRetries();
}

ensureDrawerStyles();
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", bindDrawerToggleImmediate, { once: true });
} else {
  bindDrawerToggleImmediate();
}
bootAppNavigation();
markActiveNavItems();
ensureHeaderTitleLayout();
ensureHeaderSubName();
applyRoleVisibility();
bindDrawerAdminVisibilityEvents();
applyDrawerAdminLinkVisibility();

// NAV — shell drawer statique + rendu public synchrone (sans role / sans Firestore)
const currentPage = location.pathname.split("/").pop();

const DRAWER_HUB_ITEM = {
  href: "index.html",
  title: "NSOSO",
  subtitle: "Espace de travail",
  icon: "◆"
};

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

  if (isActive) {
    link.classList.add("active");
    link.setAttribute("aria-current", "page");
  }

  link.append(icon, label, trail);
  return link;
}

function ensureDrawerDomShell() {
  let drawer = document.getElementById("nsonoDrawer");
  if (!drawer) {
    return null;
  }

  let brand = document.getElementById("nsonoDrawerBrand");
  let scroll = drawer.querySelector(".drawer-scroll");
  let nav = document.getElementById("nsonoDrawerNav");
  let adminNav = document.getElementById("nsonoDrawerAdmin");

  if (brand && scroll && nav && adminNav) {
    return { brand, nav };
  }

  drawer.replaceChildren();

  brand = createDrawerNode("div", "drawer-brand");
  brand.id = "nsonoDrawerBrand";

  scroll = createDrawerNode("div", "drawer-scroll");
  nav = createDrawerNode("nav", "drawer-nav");
  nav.id = "nsonoDrawerNav";
  nav.setAttribute("aria-label", "Navigation principale");

  adminNav = createDrawerNode("nav", "drawer-admin-slot");
  adminNav.id = "nsonoDrawerAdmin";
  adminNav.setAttribute("aria-label", "Administration");

  scroll.append(nav, adminNav);
  drawer.append(brand, scroll);

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

  if (shell.nav.dataset.nsonoPublicReady === "1") {
    return;
  }

  shell.nav.replaceChildren();
  const fragment = document.createDocumentFragment();

  DRAWER_PUBLIC_SECTIONS.forEach((section, sectionIndex) => {
    if (sectionIndex > 0) {
      fragment.appendChild(createDrawerNode("hr", "drawer-divider"));
    }

    const sectionWrap = createDrawerNode("div", "drawer-section");
    sectionWrap.appendChild(createDrawerNode("div", "drawer-section-title", section.title));

    section.items.forEach(item => {
      const isActive = item.href === current;
      sectionWrap.appendChild(createDrawerPublicItem(item, isActive));
    });

    fragment.appendChild(sectionWrap);
  });

  shell.nav.appendChild(fragment);
  shell.nav.dataset.nsonoPublicReady = "1";
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

function ensureDrawerStyles() {
  if (document.querySelector('link[data-nsono-drawer-css="1"]')) {
    return;
  }
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = resolveAssetPath("css/drawer.css");
  link.dataset.nsonoDrawerCss = "1";
  document.head.appendChild(link);
}

function ensureHeaderToggle(header) {
  if (!header || document.getElementById("nsonoDrawerToggle")) {
    return;
  }
  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.id = "nsonoDrawerToggle";
  toggle.setAttribute("aria-label", "Ouvrir le menu");
  toggle.textContent = "☰";
  header.insertBefore(toggle, header.firstChild);
}

function ensureAppShell() {
  if (document.body.classList.contains("nsono-app")) {
    ensureHeaderToggle(document.querySelector("#nsonoMain header, header"));
    renderDrawerPublicShell();
    return;
  }

  let overlay = document.getElementById("nsonoDrawerOverlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "nsonoDrawerOverlay";
    document.body.appendChild(overlay);
  }

  let drawer = document.getElementById("nsonoDrawer");
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

  let main = document.getElementById("nsonoMain");
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

  document.body.classList.add("nsono-app");
  ensureHeaderToggle(main.querySelector("header"));
  renderDrawerPublicShell();
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
  await ensureDrawerScript();
  // #region agent log
  fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H5',location:'nav.js:bootAppNavigation',message:'nav boot complete',data:{hasToggle:!!document.getElementById('nsonoDrawerToggle'),hasDrawer:!!document.getElementById('nsonoDrawer'),path:location.pathname},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
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
  const header = document.querySelector("#nsonoMain header, header");
  if (!header) {
    return;
  }

  const heading = header.querySelector("h1, h2, h3, .header-title");
  if (!heading) {
    return;
  }

  if (!document.getElementById("nsonoHeaderTitleLayoutStyle")) {
    const style = document.createElement("style");
    style.id = "nsonoHeaderTitleLayoutStyle";
    style.textContent = `
header .nsono-page-title,
header .header-title.nsono-page-title {
  margin: 0;
  text-align: center;
  padding-left: 0;
  padding-right: 0;
}
@media (min-width: 768px) {
  header .nsono-page-title,
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

  const header = document.querySelector("#nsonoMain header, header");
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

ensureDrawerStyles();
bootAppNavigation();
markActiveNavItems();
ensureHeaderTitleLayout();
ensureHeaderSubName();
applyRoleVisibility();

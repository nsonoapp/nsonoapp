// NAV — shell drawer statique + marquage page active
const currentPage = location.pathname.split("/").pop();

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
}

function ensureDrawerScript() {
  if (document.querySelector('script[data-nsono-drawer="1"]')) {
    return;
  }
  const script = document.createElement("script");
  script.type = "module";
  script.src = resolveAssetPath("js/drawer.js");
  script.defer = true;
  script.dataset.nsonoDrawer = "1";
  document.body.appendChild(script);
}

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
ensureAppShell();
ensureDrawerScript();
markActiveNavItems();
ensureHeaderTitleLayout();
ensureHeaderSubName();
applyRoleVisibility();

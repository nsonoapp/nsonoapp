import { getAuth, onAuthStateChanged } from "./auth.js";

const DESKTOP_MQ = window.matchMedia("(min-width: 1024px)");
let drawerMqBound = false;
let drawerChromeRetries = 0;
const DRAWER_CHROME_MAX_RETRIES = 20;

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
  return {
    overlay: drawerEl("nsonoDrawerOverlay", "NSOSODrawerOverlay"),
    drawer: drawerEl("nsonoDrawer", "NSOSODrawer"),
    brand: drawerEl("nsonoDrawerBrand", "NSOSODrawerBrand"),
    nav: drawerEl("nsonoDrawerNav", "NSOSODrawerNav"),
    adminNav: drawerEl("nsonoDrawerAdmin", "NSOSODrawerAdmin"),
    main: drawerEl("nsonoMain", "NSOSOMain"),
    toggle: drawerEl("nsonoDrawerToggle", "NSOSODrawerToggle")
  };
}

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

function isDrawerPathActive(href) {
  const target = String(href || "").replace(/^\//, "");
  const path = location.pathname.replace(/^\//, "");
  return path === target || path.endsWith(`/${target}`);
}

function refreshPublicDrawerLinks() {
  const shell = getDrawerShell();
  const nav = shell.nav;
  const brand = shell.brand;
  if (!nav || !nav.dataset.nsonoPublicReady) {
    return;
  }

  nav.querySelectorAll(".drawer-item").forEach(link => {
    const rawHref = link.getAttribute("data-href") || link.getAttribute("href") || "";
    link.href = resolveHref(rawHref);
    const isActive = isDrawerPathActive(rawHref);
    link.classList.toggle("active", isActive);
    if (isActive) {
      link.setAttribute("aria-current", "page");
    } else {
      link.removeAttribute("aria-current");
    }
  });

  const hub = brand?.querySelector(".drawer-brand-link");
  if (hub) {
    hub.href = resolveHref("index.html");
  }
}

function initDrawerChrome() {
  const shell = getDrawerShell();
  const { drawer, toggle, overlay } = shell;

  if (!drawer) {
    return;
  }

  if (!toggle) {
    if (drawerChromeRetries < DRAWER_CHROME_MAX_RETRIES) {
      drawerChromeRetries += 1;
      requestAnimationFrame(initDrawerChrome);
    }
    return;
  }

  drawerChromeRetries = 0;
  refreshPublicDrawerLinks();
  bindDrawerEvents(toggle, overlay, drawer);
  applyResponsiveLayout(drawer, overlay);
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

  toggle.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
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
      const shell = getDrawerShell();
      applyResponsiveLayout(shell.drawer, shell.overlay);
    });
    drawerMqBound = true;
  }
}

export function syncDrawerAdminVisibility() {
  window.dispatchEvent(new CustomEvent("nsono:drawer-admin-visibility"));
}

let adminVisibilityBound = false;

function bindAdminVisibilitySync() {
  if (adminVisibilityBound) {
    syncDrawerAdminVisibility();
    return;
  }
  adminVisibilityBound = true;

  syncDrawerAdminVisibility();

  onAuthStateChanged(getAuth(), user => {
    if (!user) {
      syncDrawerAdminVisibility();
      return;
    }
    if (!localStorage.getItem("userId")) {
      localStorage.setItem("userId", user.uid);
    }
    syncDrawerAdminVisibility();
  });

  window.addEventListener("nsono:session-ready", syncDrawerAdminVisibility);
  window.addEventListener("nsono:drawer-shell-ready", syncDrawerAdminVisibility);
}

export function initDrawerNavigation() {
  initDrawerChrome();
  bindAdminVisibilitySync();
}

import { getAuth, onAuthStateChanged } from "./auth.js";

const ADMIN_SECTION = {
  title: "Administration",
  items: [
    { href: "admin/admin.html", label: "Administration", icon: "⚙️" },
    { href: "admin/company.html", label: "Societe", icon: "🏢", master: true },
    { href: "admin/entities.html", label: "Entites", icon: "🏬" },
    { href: "admin/settings.html", label: "Parametres", icon: "🔧" },
    { href: "admin/logs.html", label: "Logs globaux", icon: "🧾" },
    { href: "stats.html", label: "Stats societe", icon: "📊" },
    { href: "admin/stats.html", label: "Stats globales", icon: "📈", master: true }
  ]
};

const DESKTOP_MQ = window.matchMedia("(min-width: 1024px)");
let drawerMqBound = false;
let adminInjectionBound = false;

function resolveDrawerUid() {
  const storedUid = localStorage.getItem("userId");
  if (storedUid) {
    return storedUid;
  }
  return getAuth().currentUser?.uid || "";
}

function canShowAdminSection(permissions, canAccessAdmin) {
  if (canAccessAdmin(permissions)) {
    return true;
  }
  if (permissions?.profile?.role === "admin") {
    return true;
  }
  return localStorage.getItem("userRole") === "admin";
}

function resolveMasterFlag(isMasterAdmin) {
  if (typeof isMasterAdmin === "function") {
    return isMasterAdmin();
  }
  return localStorage.getItem("nsono_isMasterAdmin") === "1";
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
  } else {
    link.classList.remove("active");
    link.removeAttribute("aria-current");
  }

  link.append(icon, label, trail);
  return link;
}

function refreshPublicDrawerLinks() {
  const nav = document.getElementById("nsonoDrawerNav");
  const brand = document.getElementById("nsonoDrawerBrand");
  if (!nav || nav.dataset.nsonoPublicReady !== "1") {
    return;
  }

  const current = currentFile();
  nav.querySelectorAll(".drawer-item").forEach(link => {
    const rawHref = link.getAttribute("data-href") || link.getAttribute("href") || "";
    const file = rawHref.split("/").pop();
    link.href = resolveHref(file ? file : rawHref);
    const isActive = file === current;
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
  const drawer = document.getElementById("nsonoDrawer");
  const toggle = document.getElementById("nsonoDrawerToggle");
  const overlay = document.getElementById("nsonoDrawerOverlay");

  // #region agent log
  fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H5',location:'drawer.js:initDrawerChrome',message:'drawer chrome init',data:{hasDrawer:!!drawer,hasToggle:!!toggle,hasOverlay:!!overlay,toggleBound:toggle?.dataset?.nsonoDrawerBound==='1',path:location.pathname},timestamp:Date.now()})}).catch(()=>{});
  // #endregion

  if (!drawer) {
    return;
  }

  refreshPublicDrawerLinks();
  bindDrawerEvents(toggle, overlay, drawer);
  applyResponsiveLayout(drawer, overlay);
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
  if (!toggle || !drawer) {
    return;
  }
  if (toggle.dataset.nsonoDrawerBound === "1") {
    return;
  }
  toggle.dataset.nsonoDrawerBound = "1";

  toggle.addEventListener("click", () => {
    // #region agent log
    fetch('http://127.0.0.1:7701/ingest/67d75259-8610-4541-96c0-966149fbc8cd',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08c95e'},body:JSON.stringify({sessionId:'08c95e',hypothesisId:'H5',location:'drawer.js:toggleClick',message:'hamburger clicked',data:{desktop:DESKTOP_MQ.matches,drawerOpen:drawer.classList.contains('open')},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
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

function injectAdminLinks() {
  const adminNav = document.getElementById("nsonoDrawerAdmin");
  if (!adminNav) {
    return;
  }

  const uid = resolveDrawerUid();
  if (!uid) {
    return;
  }

  Promise.all([
    import("../admin/js/permissions.js"),
    import("../admin/js/entity-context.js")
  ])
    .then(([{ canAccessAdmin, loadUserPermissions }, { isMasterAdmin }]) =>
      loadUserPermissions(uid).then(permissions => ({
        canAccessAdmin,
        permissions,
        isMasterAdmin
      }))
    )
    .then(({ canAccessAdmin, permissions, isMasterAdmin }) => {
      if (!canShowAdminSection(permissions, canAccessAdmin)) {
        adminNav.replaceChildren();
        return;
      }
      renderAdminNav(adminNav, resolveMasterFlag(isMasterAdmin));
    })
    .catch(() => {
      if (localStorage.getItem("userRole") === "admin") {
        renderAdminNav(adminNav, resolveMasterFlag());
        return;
      }
      adminNav.replaceChildren();
    });
}

function bindAdminInjection() {
  if (adminInjectionBound) {
    injectAdminLinks();
    return;
  }
  adminInjectionBound = true;

  injectAdminLinks();

  onAuthStateChanged(getAuth(), user => {
    if (!user) {
      document.getElementById("nsonoDrawerAdmin")?.replaceChildren();
      return;
    }

    if (!localStorage.getItem("userId")) {
      localStorage.setItem("userId", user.uid);
    }

    injectAdminLinks();
  });

  window.addEventListener("nsono:session-ready", injectAdminLinks);
}

let drawerBootstrapped = false;

export function initDrawerNavigation() {
  initDrawerChrome();
  if (!drawerBootstrapped) {
    bindAdminInjection();
    drawerBootstrapped = true;
  }
}

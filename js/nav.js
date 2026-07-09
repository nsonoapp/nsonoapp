// NAV — marque uniquement la page active (data-page)
const currentPage =
  location.pathname.split("/").pop();

document
  .querySelectorAll(".nav-item")
  .forEach(item => {

    if (
      item.dataset.page === currentPage
    ) {
      item.classList.add("active");
    }
  });

function resolveDrawerPath() {
  const path = location.pathname.split("/").filter(Boolean);
  const inAdmin = path[0] === "admin";
  return inAdmin ? "../js/drawer.js" : "js/drawer.js";
}

function ensureDrawerLoaded() {
  if (document.querySelector('script[data-nsono-drawer="1"]')) {
    return;
  }
  const script = document.createElement("script");
  script.type = "module";
  script.src = resolveDrawerPath();
  script.defer = true;
  script.dataset.nsonoDrawer = "1";
  document.head.appendChild(script);
}

ensureDrawerLoaded();

function ensureHeaderTitleLayout() {
  const header = document.querySelector("header");
  if (!header) {
    return;
  }

  const heading = header.querySelector("h1, h2, h3");
  if (!heading) {
    return;
  }

  if (!document.getElementById("nsonoHeaderTitleLayoutStyle")) {
    const style = document.createElement("style");
    style.id = "nsonoHeaderTitleLayoutStyle";
    style.textContent = `
header .nsono-page-title {
  margin: 0;
  text-align: center;
  padding-left: 44px;
  padding-right: 44px;
}
@media (min-width: 768px) {
  header .nsono-page-title {
    position: absolute;
    left: 50%;
    transform: translateX(-50%);
    padding-left: 0;
    padding-right: 0;
    max-width: 62%;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
}`;
    document.head.appendChild(style);
  }

  if (getComputedStyle(header).position === "static" || !getComputedStyle(header).position) {
    header.style.position = "relative";
  }

  heading.classList.add("nsono-page-title");
}

ensureHeaderTitleLayout();

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

  const header = document.querySelector("header");
  const heading = header?.querySelector("h1, h2, h3");
  if (!header || !heading) {
    return;
  }

  const rawSubName = localStorage.getItem("nsono_entitySubName");
  const subName = sanitizeSubName(rawSubName);
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

ensureHeaderSubName();

function applyRoleVisibility() {
  const role = localStorage.getItem("userRole");
  if (role === "admin") {
    return;
  }
  document.querySelectorAll(".nav-item").forEach(item => {
    const href = item.getAttribute("href") || "";
    const target = item.dataset.page || href;
    if (target.includes("stats") || target.includes("admin/")) {
      item.style.display = "none";
    }
  });
}

applyRoleVisibility();

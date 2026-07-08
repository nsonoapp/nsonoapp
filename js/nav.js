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
  const inAdminOrBatch = path[0] === "admin" || path[0] === "batch";
  return inAdminOrBatch ? "../js/drawer.js" : "js/drawer.js";
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

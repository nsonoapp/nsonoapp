import { getAuth, onAuthStateChanged } from "../../js/auth.js";
import {
  loadUserPermissions,
  canAccessAdmin,
  hasScope
} from "./permissions.js";
import { getEntityContext } from "./entity-context.js";
import { getStoredCompanyName } from "./company-auth.js";

const auth = getAuth();

export function createTextEl(tag, text, className) {
  const el = document.createElement(tag);
  if (className) {
    el.className = className;
  }
  el.textContent = text ?? "";
  return el;
}

export function showMessage(boxId, text, isError = false) {
  const box = document.getElementById(boxId);
  if (!box) {
    return;
  }
  box.textContent = text || "";
  box.style.color = isError ? "#c0392b" : "#1e7e34";
}

export function sanitizeText(value, max = 120) {
  return String(value || "").trim().slice(0, max);
}

export function formatAdminDate(ts) {
  if (!ts) {
    return "—";
  }
  const date = typeof ts.toDate === "function" ? ts.toDate() : new Date(ts);
  if (Number.isNaN(date.getTime())) {
    return "—";
  }
  return date.toLocaleDateString("fr-FR");
}

export function renderContextBanner(containerId = "adminContextBanner") {
  const box = document.getElementById(containerId);
  if (!box) {
    return;
  }

  box.replaceChildren();
  const ctx = getEntityContext();
  const companyName = getStoredCompanyName() || ctx.companyId || "Société non liée";
  const entityLabel = ctx.isMasterAdmin
    ? (ctx.entityId ? `Entité : ${ctx.entityId}` : "Master Admin — toutes entités")
    : (ctx.entityId ? `Entité : ${ctx.entityId}` : "Entité non définie");

  const line = createTextEl("p", `${companyName} • ${entityLabel}`);
  line.style.margin = "0";
  line.style.fontSize = "13px";
  line.style.color = "#555";
  box.appendChild(line);
}

export function guardAdminPage(requiredScope = null) {
  return new Promise((resolve, reject) => {
    onAuthStateChanged(auth, async user => {
      if (!user) {
        location.href = "../login.html";
        return;
      }

      try {
        const permissions = await loadUserPermissions(user.uid);

        if (!canAccessAdmin(permissions)) {
          location.href = "../index.html";
          return;
        }

        if (requiredScope && !hasScope(requiredScope, permissions)) {
          location.href = "admin.html";
          return;
        }

        resolve({ user, permissions });
      } catch (err) {
        reject(err);
      }
    });
  });
}

export function bindListActions(listEl, items, renderItem) {
  listEl.replaceChildren();

  if (!items.length) {
    const empty = createTextEl("div", "Aucun élément", "admin-empty");
    listEl.appendChild(empty);
    return;
  }

  const fragment = document.createDocumentFragment();
  items.forEach(item => {
    fragment.appendChild(renderItem(item));
  });
  listEl.appendChild(fragment);
}

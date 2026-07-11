import { getAuth, onAuthStateChanged } from "../../js/auth.js";
import {
  loadUserPermissions,
  canAccessAdmin,
  hasScope
} from "./permissions.js";
import { getEntityContext } from "./entity-context.js";
import { getStoredCompanyName } from "./company-auth.js";
import { db, doc, getDoc } from "../../js/firebase.js";
import { ADMIN_COLLECTIONS } from "./admin-collections.js";

const auth = getAuth();
const entityNameCache = new Map();

export function cacheEntityName(entityId, name) {
  if (entityId && name) {
    entityNameCache.set(entityId, name);
  }
}

async function resolveEntityLabel(entityId, isMasterAdminUser) {
  if (!entityId) {
    return isMasterAdminUser ? "Master Admin — toutes entités" : "Entité non définie";
  }
  if (entityNameCache.has(entityId)) {
    return entityNameCache.get(entityId);
  }
  try {
    const snap = await getDoc(doc(db, ADMIN_COLLECTIONS.entities, entityId));
    if (snap.exists()) {
      const name = snap.data().name || entityId;
      entityNameCache.set(entityId, name);
      return name;
    }
  } catch {
    /* ignore */
  }
  return entityId;
}

export async function renderContextBanner(containerId = "adminContextBanner") {
  const box = document.getElementById(containerId);
  if (!box) {
    return;
  }

  box.replaceChildren();
  const ctx = getEntityContext();
  const companyName = getStoredCompanyName() || ctx.companyId || "Société non liée";
  const entityLabel = await resolveEntityLabel(ctx.entityId, ctx.isMasterAdmin);

  const line = createTextEl(
    "p",
    ctx.isMasterAdmin && !ctx.entityId
      ? `${companyName} • Master Admin — toutes entités`
      : `${companyName} • Entité : ${entityLabel}`
  );
  line.style.margin = "0";
  line.style.fontSize = "13px";
  line.style.color = "#555";
  box.appendChild(line);
}

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

export async function copyTextToClipboard(text) {
  const value = String(text || "").trim();
  if (!value) {
    return false;
  }

  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value);
      return true;
    }
  } catch {
    /* fallback */
  }

  const area = document.createElement("textarea");
  area.value = value;
  area.setAttribute("readonly", "readonly");
  area.style.position = "fixed";
  area.style.left = "-9999px";
  document.body.appendChild(area);
  area.select();
  const ok = document.execCommand("copy");
  area.remove();
  return ok;
}

export function createCopyButton(label, text, onCopied) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn-copy-id";
  btn.textContent = label;
  btn.addEventListener("click", async () => {
    const copied = await copyTextToClipboard(text);
    if (typeof onCopied === "function") {
      onCopied(copied);
    }
  });
  return btn;
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

const LOCK_CLASS = "nsono-btn-locked";
const STATE_KEY = Symbol("nsonoButtonLockState");

let stylesInjected = false;

function injectStyles() {
  if (stylesInjected) return;
  stylesInjected = true;

  const style = document.createElement("style");
  style.id = "nsono-button-manager-styles";
  style.textContent = `
    .nsono-btn-locked,
    button.nsono-btn-locked,
    input.nsono-btn-locked,
    .btn.nsono-btn-locked,
    .modal-save.nsono-btn-locked,
    .primary-btn.nsono-btn-locked,
    .save-btn.nsono-btn-locked,
    .btn-primary.nsono-btn-locked {
      opacity: 0.55 !important;
      cursor: not-allowed !important;
      pointer-events: none !important;
      filter: grayscale(0.35);
    }
  `;
  document.head.appendChild(style);
}

function resolveButton(target) {
  if (!target) return null;

  if (target instanceof HTMLButtonElement) {
    return target;
  }

  if (target instanceof HTMLInputElement && target.type === "submit") {
    return target;
  }

  if (target instanceof HTMLFormElement) {
    return target.querySelector('button[type="submit"], input[type="submit"]');
  }

  if (typeof target === "string") {
    return resolveButton(document.getElementById(target));
  }

  return null;
}

export function isButtonLocked(button) {
  const btn = resolveButton(button);
  return btn?.dataset?.nsonoLocked === "1";
}

export function lockButton(button, options = {}) {
  injectStyles();

  const btn = resolveButton(button);
  if (!btn || btn.dataset.nsonoLocked === "1") {
    return false;
  }

  btn[STATE_KEY] = {
    disabled: btn.disabled,
    text: btn.textContent,
    ariaDisabled: btn.getAttribute("aria-disabled"),
    ariaBusy: btn.getAttribute("aria-busy")
  };

  btn.dataset.nsonoLocked = "1";
  btn.disabled = true;
  btn.setAttribute("aria-disabled", "true");
  btn.setAttribute("aria-busy", "true");
  btn.classList.add(LOCK_CLASS);

  if (options.loadingLabel) {
    btn.textContent = options.loadingLabel;
  }

  return true;
}

export function unlockButton(button) {
  const btn = resolveButton(button);
  if (!btn) return;

  const prev = btn[STATE_KEY];

  btn.dataset.nsonoLocked = "0";
  btn.classList.remove(LOCK_CLASS);
  btn.removeAttribute("aria-busy");

  if (prev) {
    btn.disabled = prev.disabled;
    if (prev.text !== undefined) {
      btn.textContent = prev.text;
    }
    if (prev.ariaDisabled === null) {
      btn.removeAttribute("aria-disabled");
    } else {
      btn.setAttribute("aria-disabled", prev.ariaDisabled);
    }
    delete btn[STATE_KEY];
  } else {
    btn.disabled = false;
    btn.removeAttribute("aria-disabled");
  }
}

export async function withButtonLock(button, fn, options = {}) {
  if (!lockButton(button, options)) {
    return undefined;
  }

  try {
    return await fn();
  } finally {
    unlockButton(button);
  }
}

export function bindActionButton(button, handler, options = {}) {
  const btn = resolveButton(button);
  if (!btn || typeof handler !== "function") {
    return;
  }

  const eventName = options.event || "click";

  btn.addEventListener(eventName, async (event) => {
    if (isButtonLocked(btn)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      return;
    }

    if (typeof options.guard === "function") {
      const allowed = await options.guard(event);
      if (allowed === false) {
        event.preventDefault();
        return;
      }
    }

    if (options.preventDefault !== false) {
      event.preventDefault();
    }

    await withButtonLock(btn, () => handler(event), options);
  });
}

export function bindFormAction(form, handler, options = {}) {
  const formEl = form instanceof HTMLFormElement
    ? form
    : document.getElementById(form);

  if (!formEl || typeof handler !== "function") {
    return;
  }

  const submitBtn = formEl.querySelector('button[type="submit"], input[type="submit"]');

  formEl.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (submitBtn && isButtonLocked(submitBtn)) {
      return;
    }

    if (typeof options.guard === "function") {
      const allowed = await options.guard(event);
      if (allowed === false) {
        return;
      }
    }

    const lockTarget = submitBtn || formEl;
    await withButtonLock(lockTarget, () => handler(event), options);
  });
}

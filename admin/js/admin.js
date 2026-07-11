import { guardAdminPage, renderContextBanner, showMessage } from "./admin-shared.js";
import { getStoredCompanyName, hasSingleCompany } from "./company-auth.js";
import { getEntityContext } from "./entity-context.js";
import { db, collection, query, where, getDocs } from "../../js/firebase.js";
import { ADMIN_COLLECTIONS } from "./admin-collections.js";
import { APPROVAL_STATUS } from "./admin-constants.js";
import { applyEntityScope } from "./query-scope.js";

async function loadPendingCount() {
  try {
    const constraints = applyEntityScope([
      where("approvalStatus", "==", APPROVAL_STATUS.pending)
    ]);
    const snap = await getDocs(query(collection(db, ADMIN_COLLECTIONS.users), ...constraints));
    return snap.size;
  } catch {
    return 0;
  }
}

function renderPendingBadge(count) {
  const badge = document.getElementById("pendingBadge");
  if (!badge) {
    return;
  }
  badge.replaceChildren();
  if (!count) {
    return;
  }
  const span = document.createElement("span");
  span.className = "admin-badge";
  span.textContent = `${count} en attente`;
  badge.appendChild(span);
}

guardAdminPage().then(async () => {
  await renderContextBanner();
  const ctx = getEntityContext();
  const companyName = getStoredCompanyName();
  showMessage(
    "adminDebug",
    companyName
      ? `Hub Admin NSOSO — ${companyName}`
      : "Hub Admin NSOSO — configurez la société via onboarding si besoin"
  );

  const pending = await loadPendingCount();
  renderPendingBadge(pending);

  if (!ctx.companyId) {
    showMessage("adminDebug", "Aucune société en session. Utilisez onboarding.html pour initialiser.", true);
  }

  const onboardingCard = document.getElementById("onboardingNavCard");
  if (onboardingCard) {
    if (await hasSingleCompany()) {
      onboardingCard.classList.add("locked");
      onboardingCard.setAttribute("aria-hidden", "true");
    } else {
      onboardingCard.classList.remove("locked");
      onboardingCard.removeAttribute("aria-hidden");
    }
  }
});

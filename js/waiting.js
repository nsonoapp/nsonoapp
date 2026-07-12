import { getAuth, onAuthStateChanged, signOut } from "./auth.js";
import { isAllowedRole, loadUserProfile } from "./auth-flow.js";
import { bindActionButton } from "./utils/buttonManager.js";

const auth = getAuth();
const logoutBtn = document.getElementById("logoutBtn");
const loginLinkBtn = document.getElementById("loginLinkBtn");
const waitingTitleEl = document.getElementById("waitingTitle");
const waitingTextEl = document.getElementById("waitingText");
const waitingHintEl = document.getElementById("waitingHint");
const waitingBadgeEl = document.getElementById("waitingBadge");
const waitingFeedbackEl = document.getElementById("waitingFeedback");

const POLL_MS = 5000;

function showFeedback(message) {
  if (!waitingFeedbackEl) {
    if (message) {
      window.alert(message);
    }
    return;
  }
  waitingFeedbackEl.textContent = message;
  waitingFeedbackEl.hidden = !message;
}

function hasBusinessAccess(profile) {
  if (!profile) {
    return false;
  }
  const approved = !profile.approvalStatus || profile.approvalStatus === "approved";
  return approved && profile.isActive === true && isAllowedRole(profile.role);
}

function renderWaitingState(profile) {
  if (!profile) {
    return;
  }

  if (profile.approvalStatus === "rejected") {
    if (waitingTitleEl) {
      waitingTitleEl.textContent = "Compte refusé";
    }
    if (waitingTextEl) {
      waitingTextEl.textContent = "Votre demande d'accès a été refusée par un administrateur.";
    }
    if (waitingHintEl) {
      waitingHintEl.textContent = "Contactez votre responsable si vous pensez qu'il s'agit d'une erreur.";
    }
    if (waitingBadgeEl) {
      waitingBadgeEl.textContent = "Refusé";
      waitingBadgeEl.classList.add("rejected");
    }
    return;
  }

  if (profile.approvalStatus === "pending") {
    if (waitingTitleEl) {
      waitingTitleEl.textContent = "En attente d'approbation";
    }
    if (waitingTextEl) {
      waitingTextEl.textContent = "Votre compte a bien été créé. Un administrateur doit l'approuver avant l'accès à NSOSO.";
    }
    if (waitingHintEl) {
      waitingHintEl.textContent = "Actualisation automatique toutes les 5 secondes.";
    }
    if (waitingBadgeEl) {
      waitingBadgeEl.textContent = "En attente";
      waitingBadgeEl.classList.remove("rejected");
    }
    return;
  }

  if (!profile.isActive) {
    if (waitingTitleEl) {
      waitingTitleEl.textContent = "Compte désactivé";
    }
    if (waitingTextEl) {
      waitingTextEl.textContent = "Votre compte est désactivé. Contactez votre administrateur.";
    }
    if (waitingHintEl) {
      waitingHintEl.textContent = "Vous pouvez vous déconnecter et utiliser un autre compte.";
    }
    if (waitingBadgeEl) {
      waitingBadgeEl.textContent = "Inactif";
      waitingBadgeEl.classList.add("rejected");
    }
    return;
  }

  if (!isAllowedRole(profile.role)) {
    if (waitingTitleEl) {
      waitingTitleEl.textContent = "Accès non autorisé";
    }
    if (waitingTextEl) {
      waitingTextEl.textContent = "Votre compte n'a pas encore de rôle métier (vendeur ou administrateur).";
    }
    if (waitingHintEl) {
      waitingHintEl.textContent = "Demandez à votre administrateur de valider votre rôle.";
    }
    if (waitingBadgeEl) {
      waitingBadgeEl.textContent = "Rôle en attente";
      waitingBadgeEl.classList.remove("rejected");
    }
  }
}

async function checkApprovalStatus(uid) {
  const profile = await loadUserProfile(uid);
  if (!profile) {
    return;
  }
  renderWaitingState(profile);
  if (hasBusinessAccess(profile)) {
    window.location.replace("index.html");
  }
}

async function handleLogout() {
  const confirmed = window.confirm("Voulez-vous vraiment vous déconnecter ?");
  if (!confirmed) {
    return;
  }

  showFeedback("");
  try {
    await signOut(auth);
    window.location.replace("login.html");
  } catch (err) {
    console.error("[waiting] déconnexion:", err);
    showFeedback("Erreur lors de la déconnexion. Réessayez.");
  }
}

async function handleLoginLink() {
  showFeedback("");
  try {
    if (auth.currentUser) {
      await signOut(auth);
    }
    window.location.replace("login.html");
  } catch (err) {
    console.error("[waiting] retour login:", err);
    showFeedback("Impossible de revenir à la connexion. Réessayez.");
  }
}

bindActionButton(logoutBtn, handleLogout);
bindActionButton(loginLinkBtn, handleLoginLink);

onAuthStateChanged(auth, user => {
  if (!user) {
    window.location.replace("login.html");
    return;
  }

  checkApprovalStatus(user.uid);

  const intervalId = setInterval(() => {
    if (!auth.currentUser) {
      clearInterval(intervalId);
      return;
    }
    checkApprovalStatus(auth.currentUser.uid);
  }, POLL_MS);
});

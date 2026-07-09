import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  setUnauthorizedHandler,
} from "./apiClient.mjs";
import {
  safeStorageGet,
  safeStorageRemove,
  safeStorageSet,
  STORAGE_KEYS,
} from "./storage.mjs";

const GUEST_KEY = STORAGE_KEYS.GUEST_MODE;

let currentUser = null;
let isGuest = safeStorageGet(GUEST_KEY) === "1";
let authGateEl = null;
let authMessageEl = null;
let userLabelEl = null;
let signOutButtonEl = null;
let onAuthChange = null;

export function createAuthManager(config = {}) {
  authGateEl = config.authGateEl || null;
  authMessageEl = config.authMessageEl || null;
  userLabelEl = config.userLabelEl || null;
  signOutButtonEl = config.signOutButtonEl || null;
  onAuthChange = config.onAuthChange || null;

  wireAuthForms(config);
  setUnauthorizedHandler(() => {
    currentUser = null;
    notifyAuthChange();
    showAuthGate("Session expired. Sign in again.");
  });

  if (signOutButtonEl) {
    signOutButtonEl.addEventListener("click", () => {
      void handleSignOut();
    });
  }

  return {
    initialize,
    getCurrentUser: () => currentUser,
    isGuest: () => isGuest,
    isAuthenticated: () => Boolean(currentUser),
    canPlay: () => Boolean(currentUser || isGuest),
    showAuthGate,
    hideAuthGate,
    handleSignOut,
    continueAsGuest,
  };
}

async function initialize() {
  if (isGuest) {
    updateUserChrome();
    hideAuthGate();
    notifyAuthChange();
    return { guest: true };
  }

  currentUser = await fetchCurrentUser();
  updateUserChrome();

  if (currentUser) {
    hideAuthGate();
    notifyAuthChange();
    return { user: currentUser };
  }

  showAuthGate();
  return { user: null };
}

function wireAuthForms(config) {
  const signInForm = config.signInFormEl;
  const signUpForm = config.signUpFormEl;
  const guestButton = config.guestButtonEl;
  const tabButtons = config.authTabButtons || [];

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const tab = button.dataset.authTab;
      setAuthTab(tab);
    });
  }

  if (signInForm) {
    signInForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(signInForm);
      try {
        currentUser = await loginUser({
          username: String(formData.get("username") || ""),
          password: String(formData.get("password") || ""),
        });
        isGuest = false;
        safeStorageRemove(GUEST_KEY);
        setAuthMessage("");
        hideAuthGate();
        updateUserChrome();
        notifyAuthChange();
      } catch (error) {
        setAuthMessage(error.message, true);
      }
    });
  }

  if (signUpForm) {
    signUpForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const formData = new FormData(signUpForm);
      try {
        currentUser = await registerUser({
          username: String(formData.get("username") || ""),
          password: String(formData.get("password") || ""),
          displayName: String(formData.get("display_name") || ""),
          inviteCode: String(formData.get("invite_code") || ""),
        });
        isGuest = false;
        safeStorageRemove(GUEST_KEY);
        setAuthMessage("");
        hideAuthGate();
        updateUserChrome();
        notifyAuthChange();
      } catch (error) {
        setAuthMessage(error.message, true);
      }
    });
  }

  if (guestButton) {
    guestButton.addEventListener("click", () => {
      continueAsGuest();
    });
  }
}

function continueAsGuest() {
  isGuest = true;
  currentUser = null;
  safeStorageSet(GUEST_KEY, "1");
  setAuthMessage("");
  hideAuthGate();
  updateUserChrome();
  notifyAuthChange();
}

async function handleSignOut() {
  await logoutUser();
  currentUser = null;
  isGuest = false;
  safeStorageRemove(GUEST_KEY);
  updateUserChrome();
  showAuthGate("Signed out.");
  notifyAuthChange();
}

function showAuthGate(message = "") {
  if (authGateEl) {
    authGateEl.classList.remove("hidden");
  }
  if (message) {
    setAuthMessage(message);
  }
}

function hideAuthGate() {
  if (authGateEl) {
    authGateEl.classList.add("hidden");
  }
}

function setAuthTab(tab) {
  const panels = document.querySelectorAll("[data-auth-panel]");
  const tabs = document.querySelectorAll("[data-auth-tab]");

  for (const panel of panels) {
    panel.classList.toggle("hidden", panel.dataset.authPanel !== tab);
  }

  for (const button of tabs) {
    button.classList.toggle("is-active", button.dataset.authTab === tab);
  }
}

function setAuthMessage(message, isError = false) {
  if (!authMessageEl) {
    return;
  }

  authMessageEl.textContent = message;
  authMessageEl.classList.toggle("is-error", isError);
}

function updateUserChrome() {
  if (userLabelEl) {
    if (currentUser) {
      userLabelEl.textContent = currentUser.displayName || currentUser.username;
    } else if (isGuest) {
      userLabelEl.textContent = "Guest";
    } else {
      userLabelEl.textContent = "Not signed in";
    }
  }

  if (signOutButtonEl) {
    signOutButtonEl.classList.toggle("hidden", !currentUser);
  }
}

function notifyAuthChange() {
  if (onAuthChange) {
    onAuthChange({ user: currentUser, guest: isGuest });
  }
}

import {
  fetchCurrentUser,
  loginUser,
  logoutUser,
  registerUser,
  clearAuthToken,
  setUnauthorizedHandler,
} from "./apiClient.mjs";

let currentUser = null;
let authGateEl = null;
let authMessageEl = null;
let userLabelEl = null;
let signInButtonEl = null;
let signOutButtonEl = null;
let onAuthChange = null;

export function createAuthManager(config = {}) {
  authGateEl = config.authGateEl || null;
  authMessageEl = config.authMessageEl || null;
  userLabelEl = config.userLabelEl || null;
  signInButtonEl = config.signInButtonEl || null;
  signOutButtonEl = config.signOutButtonEl || null;
  onAuthChange = config.onAuthChange || null;

  wireAuthForms(config);
  setUnauthorizedHandler(() => {
    const wasSignedIn = Boolean(currentUser);
    currentUser = null;
    updateUserChrome();
    notifyAuthChange();
    if (wasSignedIn) {
      showAuthGate("Session expired. Sign in again.");
    }
  });

  if (signInButtonEl) {
    signInButtonEl.addEventListener("click", () => {
      showAuthGate();
    });
  }

  if (signOutButtonEl) {
    signOutButtonEl.addEventListener("click", () => {
      void handleSignOut();
    });
  }

  return {
    initialize,
    getCurrentUser: () => currentUser,
    isGuest: () => !currentUser,
    isAuthenticated: () => Boolean(currentUser),
    canPlay: () => true,
    showAuthGate,
    hideAuthGate,
    handleSignOut,
  };
}

async function initialize() {
  currentUser = await fetchCurrentUser();
  updateUserChrome();
  hideAuthGate();
  notifyAuthChange();
  return { user: currentUser };
}

function wireAuthForms(config) {
  const signInForm = config.signInFormEl;
  const signUpForm = config.signUpFormEl;
  const closeButton = config.authCloseButtonEl;
  const tabButtons = config.authTabButtons || [];

  for (const button of tabButtons) {
    button.addEventListener("click", () => {
      const tab = button.dataset.authTab;
      setAuthTab(tab);
    });
  }

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      hideAuthGate();
    });
  }

  if (authGateEl) {
    authGateEl.addEventListener("click", (event) => {
      if (event.target === authGateEl) {
        hideAuthGate();
      }
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
        setAuthMessage("");
        hideAuthGate();
        updateUserChrome();
        notifyAuthChange();
      } catch (error) {
        setAuthMessage(error.message, true);
      }
    });
  }
}

async function handleSignOut() {
  await logoutUser();
  currentUser = null;
  clearAuthToken();
  updateUserChrome();
  hideAuthGate();
  notifyAuthChange();
}

function showAuthGate(message = "") {
  if (authGateEl) {
    authGateEl.classList.remove("hidden");
  }
  setAuthMessage(message);
}

function hideAuthGate() {
  if (authGateEl) {
    authGateEl.classList.add("hidden");
  }
  setAuthMessage("");
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
    userLabelEl.textContent = currentUser
      ? (currentUser.displayName || currentUser.username)
      : "";
    userLabelEl.classList.toggle("hidden", !currentUser);
  }

  if (signInButtonEl) {
    signInButtonEl.classList.toggle("hidden", Boolean(currentUser));
  }

  if (signOutButtonEl) {
    signOutButtonEl.classList.toggle("hidden", !currentUser);
  }
}

function notifyAuthChange() {
  if (onAuthChange) {
    onAuthChange({ user: currentUser, guest: !currentUser });
  }
}

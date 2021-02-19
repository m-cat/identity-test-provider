import { SkynetClient } from "skynet-js";

import { fetchIdentityUsingSeed, fetchSkappPermissions, saveSkappPermissions } from "../src/identity-provider";

type ConnectedInfo = {
  seed: string;
  identity: string;
};

type SkappInfo = {
  name: string;
  domain: string;
}

const uiIdentityLoggedOut = document.getElementById("identity-logged-out")!;
const uiIdentitySignIn = document.getElementById("identity-sign-in")!;
const uiIdentitySignUp = document.getElementById("identity-sign-up")!;
const uiPermissions = document.getElementById("permissions")!;

let submitted = false;

let client = new SkynetClient();

let connectedInfo: ConnectedInfo | undefined = undefined;
let skappInfo: SkappInfo | undefined = undefined;
let bridgeWindow: Window | undefined = undefined;

// ======
// Events
// ======

// Event that is triggered when the window is closed.
window.onbeforeunload = () => {
  if (!submitted) {
    // Send a value to signify that window was closed.
    window.opener.postMessage("closed", "*");
  }

  return null;
};

window.onerror = function(error) {
  returnMessage(error);
};

// Code that runs on page load.
window.onload = () => {
  // Get parameters.

  const urlParams = new URLSearchParams(window.location.search);
  const bridgeFrameName = urlParams.get("bridgeFrameName");
  if (!bridgeFrameName) {
    returnMessage("Parameter 'bridgeFrameName' not found");
    return;
  }
  const name = urlParams.get("skappName");
  if (!name) {
    returnMessage("Parameter 'skappName' not found");
    return;
  }
  const domain = urlParams.get("skappDomain");
  if (!domain) {
    returnMessage("Parameter 'skappDomain' not found");
    return;
  }

  // Set values.

  bridgeWindow = window.opener[bridgeFrameName];
  if (!bridgeWindow) {
    returnMessage("Bridge window not found");
    return
  }
  skappInfo = { name, domain };

  // Fill out Permissions page.

  let tObj = document.getElementsByClassName("skapp-name");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = name;
  }
  tObj = document.getElementsByClassName("skapp-domain");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = domain;
  }

  // Go to Logged Out page.

  (window as any).goToLoggedOut();
};

// ============
// User Actions
// ============

// Identity

(window as any).goToLoggedOut = () => {
  setAllIdentityContainersInvisible();
  uiIdentityLoggedOut.style.display = "block";
};

(window as any).goToSignIn = () => {
  setAllIdentityContainersInvisible();
  uiIdentitySignIn.style.display = "block";
};

(window as any).goToSignUp = () => {
  setAllIdentityContainersInvisible();
  uiIdentitySignUp.style.display = "block";
};

(window as any).signIn = async () => {
  const seedValue = (<HTMLInputElement>document.getElementById("signin-passphrase-text")).value;
  connectedInfo = { seed: seedValue, identity: "" };

  handleConnectedInfo();
};

(window as any).signUp = async () => {
  const seedValue = (<HTMLInputElement>document.getElementById("signup-passphrase-text")).value;
  const usernameValue = (<HTMLInputElement>document.getElementById("username-text")).value;
  connectedInfo = { seed: seedValue, identity: usernameValue };

  handleConnectedInfo();
};

// Permissions

(window as any).deny = async () => {
  await handlePermission(false);
};

(window as any).grant = async () => {
  await handlePermission(true);
};

// ==============
// Implementation
// ==============

function goToPermissions() {
  activateUI();
  setAllIdentityContainersInvisible();
  uiPermissions.style.display = "block";
};

async function handleConnectedInfo() {
  submitted = true;
  deactivateUI();

  if (!connectedInfo) {
    returnMessage("Connected info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("Skapp info not found");
    return;
  }
  if (!bridgeWindow) {
    returnMessage("Bridge window not found");
    return;
  }

  let { seed, identity } = connectedInfo;
  if (!seed) {
    returnMessage("Seed not found");
    return;
  }
  if (!identity) {
    try {
      identity = await fetchIdentityUsingSeed(client, connectedInfo.seed);
    } catch (error) {
      returnMessage(error);
      return;
    }
  }

  const permission = await fetchSkappPermissions(client, connectedInfo, skappInfo);

  if (permission === null) {
    submitted = false;
    goToPermissions();
    return;
  } else if (permission === true) {
    if (!bridgeWindow) {
      // Send error message and close window.
      returnMessage("Could not find bridge window");
      return;
    }

    // Send the connected info to the bridge.
    bridgeWindow.postMessage({ messageType: "connectionComplete", connectedInfo }, "*");
    // Send success message to opening skapp.
    returnMessage("success");
    return;
  } else {
    returnMessage("Permission was denied");
    return;
  }
}

async function handlePermission(permission: boolean) {
  submitted = true;
  deactivateUI();

  if (!connectedInfo) {
    returnMessage("Connected info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("Skapp info not found");
    return;
  }
  if (!bridgeWindow) {
    returnMessage("Bridge window not found");
    return;
  }

  await saveSkappPermissions(client, connectedInfo, skappInfo, permission);

  if (permission) {
    // Send the connected info to the bridge.
    bridgeWindow.postMessage({ messageType: "connectionComplete", connectedInfo }, "*");
    // Send success message to opening skapp.
    returnMessage("success");
  } else {
    returnMessage("Permission was denied");
  }
}

// ================
// Helper Functions
// ================

/**
 *
 */
export function activateUI() {
  document.getElementById("darkLayer")!.style.display = "none";
}

/**
 *
 */
export function deactivateUI() {
  document.getElementById("darkLayer")!.style.display = "";
}

function returnMessage(message: string | Event) {
  window.opener.postMessage(message, "*");
  window.close();
}

/**
 *
 */
function setAllIdentityContainersInvisible() {
  uiIdentityLoggedOut.style.display = "none";
  uiIdentitySignIn.style.display = "none";
  uiIdentitySignUp.style.display = "none";
  uiPermissions.style.display = "none";
}

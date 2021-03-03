import { SkynetClient } from "skynet-js";

import { fetchIdentityUsingSeed } from "../src/identity-provider";

type ConnectionInfo = {
  seed: string;
  identity: string;
};

type SkappInfo = {
  name: string;
  domain: string;
};

const relativePermissionsUrl = "permissions.html";

const uiIdentityLoggedOut = document.getElementById("identity-logged-out")!;
const uiIdentitySignIn = document.getElementById("identity-sign-in")!;
const uiIdentitySignUp = document.getElementById("identity-sign-up")!;

let submitted = false;

let client = new SkynetClient();

let connectionInfo: ConnectionInfo | undefined = undefined;
let skappInfo: SkappInfo | undefined = undefined;

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

window.onerror = function (error) {
  returnMessage(`connector.html: ${error}`);
};

// Code that runs on page load.
window.onload = () => {
  // Get parameters.

  const urlParams = new URLSearchParams(window.location.search);
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

  skappInfo = { name, domain };

  // Go to Logged Out page.

  (window as any).goToLoggedOut();
};

// ============
// User Actions
// ============

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
  connectionInfo = { seed: seedValue, identity: "" };

  handleConnectionInfo();
};

(window as any).signUp = async () => {
  const seedValue = (<HTMLInputElement>document.getElementById("signup-passphrase-text")).value;
  const usernameValue = (<HTMLInputElement>document.getElementById("username-text")).value;
  connectionInfo = { seed: seedValue, identity: usernameValue };

  handleConnectionInfo();
};

// ==============
// Implementation
// ==============

function goToPermissions() {
  if (!connectionInfo) {
    returnMessage("Connection info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("Skapp info not found");
    return;
  }

  const permissionsUrl = `${relativePermissionsUrl}?skappName=${skappInfo.name}&skappDomain=${skappInfo.domain}&loginSeed=${connectionInfo.seed}&loginIdentity=${connectionInfo.identity}`;
  window.location.replace(permissionsUrl);
}

async function handleConnectionInfo() {
  submitted = true;
  deactivateUI();

  if (!connectionInfo) {
    returnMessage("Connection info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("Skapp info not found");
    return;
  }

  let { seed, identity } = connectionInfo;
  if (!seed) {
    returnMessage("Seed not found");
    return;
  }
  if (!identity) {
    try {
      identity = await fetchIdentityUsingSeed(client, connectionInfo.seed);
    } catch (error) {
      returnMessage(error.message);
      return;
    }
  }

  goToPermissions();
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
}

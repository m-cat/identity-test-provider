import { SkynetClient } from "skynet-js";
import { emitStorageEvent, monitorOtherListener, SkappInfo } from "skynet-interface-utils";

import { fetchIdentityUsingSeed } from "../src/identity-provider";

type ConnectionInfo = {
  seed: string;
  identity: string;
};

const relativePermissionsUrl = "permissions.html";

const uiIdentityLoggedOut = document.getElementById("identity-logged-out")!;
const uiIdentitySignIn = document.getElementById("identity-sign-in")!;
const uiIdentitySignUp = document.getElementById("identity-sign-up")!;

// Start the provider pinger in the background.
const { promise: promisePing } = monitorOtherListener("connector", "provider", 2000);

let submitted = false;

const client = new SkynetClient();

let connectionInfo: ConnectionInfo | undefined = undefined;
let skappInfo: SkappInfo | undefined = undefined;

// ======
// Events
// ======

// Event that is triggered when the window is closed.
window.onbeforeunload = () => {
  if (!submitted) {
    // Send a value to signify that window was closed.
    returnMessage("event", "closed");
  }

  return null;
};

window.onerror = function (error) {
  if (typeof error === "string") {
    returnMessage("error", error);
  } else {
    returnMessage("error", error.type);
  }
};

// Code that runs on page load.
window.onload = () => {
  // The provider pinger should run in the background and close the connector if the connection with the provider is lost.
  promisePing.catch(() => {
    returnMessage("error", "Provider timed out");
  });

  // Get parameters.

  const urlParams = new URLSearchParams(window.location.search);
  const name = urlParams.get("skappName");
  if (!name) {
    returnMessage("error", "Parameter 'skappName' not found");
    return;
  }
  const domain = urlParams.get("skappDomain");
  if (!domain) {
    returnMessage("error", "Parameter 'skappDomain' not found");
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

/**
 *
 */
async function handleConnectionInfo() {
  submitted = true;
  deactivateUI();

  if (!connectionInfo) {
    returnMessage("error", "Connection info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("error", "Skapp info not found");
    return;
  }

  const { seed } = connectionInfo;
  let { identity } = connectionInfo;
  if (!seed) {
    returnMessage("error", "Seed not found");
    return;
  }
  if (!identity) {
    try {
      identity = await fetchIdentityUsingSeed(client, connectionInfo.seed);
    } catch (error) {
      returnMessage("error", error.message);
      return;
    }
  }

  goToPermissions();
}

/**
 *
 */
function goToPermissions() {
  if (!connectionInfo) {
    returnMessage("error", "Connection info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("error", "Skapp info not found");
    return;
  }

  const permissionsUrl = `${relativePermissionsUrl}?skappName=${skappInfo.name}&skappDomain=${skappInfo.domain}&loginSeed=${connectionInfo.seed}&loginIdentity=${connectionInfo.identity}`;
  window.location.replace(permissionsUrl);
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

/**
 * @param messageKey
 * @param message
 * @param stayOpen
 * @param componentName
 */
function returnMessage(
  messageKey: "success" | "event" | "error",
  message: string,
  stayOpen = false,
  componentName?: string
) {
  let component = "connector";
  if (componentName) {
    component = componentName;
  }
  emitStorageEvent(component, messageKey, message);
  if (!stayOpen) {
    window.close();
  }
}

/**
 *
 */
function setAllIdentityContainersInvisible() {
  uiIdentityLoggedOut.style.display = "none";
  uiIdentitySignIn.style.display = "none";
  uiIdentitySignUp.style.display = "none";
}

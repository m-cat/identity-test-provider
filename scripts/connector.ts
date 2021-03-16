import { SkynetClient } from "skynet-js";
import { defaultWindowTimeout, emitStorageEvent, monitorOtherListener } from "skynet-interface-utils";

import { fetchIdentityUsingSeed } from "../src/identity-provider";
import { ConnectionInfo } from "../src";

const relativePermissionsUrl = "permissions.html";

const uiIdentityLoggedOut = document.getElementById("identity-logged-out")!;
const uiIdentitySignIn = document.getElementById("identity-sign-in")!;
const uiIdentitySignUp = document.getElementById("identity-sign-up")!;

// Start the provider pinger in the background.
const { promise: promisePing } = monitorOtherListener("connector", "provider", defaultWindowTimeout);

let submitted = false;

const client = new SkynetClient();

let connectionInfo: ConnectionInfo | undefined = undefined;
const skappInfoString: string | undefined = undefined;

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
  const skappInfoString = urlParams.get("skappInfo");
  if (!skappInfoString) {
    returnMessage("error", "Parameter 'skappInfo' not found");
    return;
  }

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
  if (!skappInfoString) {
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
  if (!skappInfoString) {
    returnMessage("error", "Skapp info not found");
    return;
  }

  const permissionsUrl = `${relativePermissionsUrl}?skappInfo=${skappInfoString}&loginSeed=${connectionInfo.seed}&loginIdentity=${connectionInfo.identity}`;
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

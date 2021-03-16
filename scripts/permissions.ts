import { SkynetClient } from "skynet-js";
import { defaultWindowTimeout, emitStorageEvent, monitorOtherListener, SkappInfo } from "skynet-interface-utils";

import { fetchSkappPermissions, saveSkappPermissions } from "../src/identity-provider";
import { ConnectionInfo } from "../src";

const uiPermissionsFetching = document.getElementById("permissions-fetching")!;
const uiPermissionsRequesting = document.getElementById("permissions-requesting")!;

// Start the provider pinger in the background.
const { promise: promisePing } = monitorOtherListener("connector", "provider", defaultWindowTimeout);

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
    window.opener.postMessage("closed", "*");
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
  const seed = urlParams.get("loginSeed");
  if (!seed) {
    returnMessage("error", "Parameter 'loginSeed' not found");
    return;
  }
  const identity = urlParams.get("loginIdentity");
  if (!identity && identity !== "") {
    returnMessage("error", "Parameter 'loginIdentity' not found");
    return;
  }

  // Set values.

  // Parse the skappInfo object.
  try {
    skappInfo = JSON.parse(skappInfoString);
  } catch (error) {
    returnMessage("error", `Could not parse 'skappInfo': ${error}`);
    return;
  }
  if (!skappInfo) {
    returnMessage("error", "Parameter 'skappInfo' was null");
    return;
  }
  connectionInfo = { seed, identity };

  // Fill out Requesting page.

  const tObj = document.getElementsByClassName("skapp-domain");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = skappInfo.domain;
  }

  // Go to Fetching Permissions page.

  goToPermissionsFetching();
};

// ============
// User Actions
// ============

(window as any).deny = async () => {
  await handlePermissions(false);
};

(window as any).grant = async () => {
  await handlePermissions(true);
};

// ==============
// Implementation
// ==============

/**
 *
 */
function goToPermissionsFetching() {
  setAllIdentityContainersInvisible();
  uiPermissionsFetching.style.display = "block";

  getPermissions();
}

/**
 *
 */
function goToPermissionsRequesting() {
  setAllIdentityContainersInvisible();
  uiPermissionsRequesting.style.display = "block";
}

/**
 *
 */
async function getPermissions() {
  if (!connectionInfo) {
    returnMessage("error", "Connection info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("error", "Skapp info not found");
    return;
  }

  const permission = await fetchSkappPermissions(client, connectionInfo, skappInfo);

  if (permission === null) {
    submitted = false;
    goToPermissionsRequesting();
    return;
  } else if (permission === true) {
    // Send the connection info to the provider.
    const result = JSON.stringify(connectionInfo);
    returnMessage("success", result, false, "connector-connection-info");
    return;
  } else {
    returnMessage("error", "Permission was denied");
    return;
  }
}

/**
 * @param permission
 */
async function handlePermissions(permission: boolean) {
  submitted = true;
  deactivateUI();

  if (!connectionInfo) {
    returnMessage("error", "Connected info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("error", "Skapp info not found");
    return;
  }

  await saveSkappPermissions(client, connectionInfo, skappInfo, permission);

  if (permission) {
    // Send the connected info to the provider.
    const result = JSON.stringify(connectionInfo);
    returnMessage("success", result, false, "connector-connection-info");
  } else {
    returnMessage("error", "Permission was denied");
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
  uiPermissionsFetching.style.display = "none";
  uiPermissionsRequesting.style.display = "none";
}

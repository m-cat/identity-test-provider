import { SkynetClient } from "skynet-js";

import { fetchSkappPermissions, saveSkappPermissions } from "../src/identity-provider";

type ConnectionInfo = {
  seed: string;
  identity: string;
};

type SkappInfo = {
  name: string;
  domain: string;
};

const uiPermissionsFetching = document.getElementById("permissions-fetching")!;
const uiPermissionsRequesting = document.getElementById("permissions-requesting")!;

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
  returnMessage(`permissions.html: ${error}`);
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
  const seed = urlParams.get("loginSeed");
  if (!seed) {
    returnMessage("Parameter 'loginSeed' not found");
    return;
  }
  const identity = urlParams.get("loginIdentity");
  if (!identity) {
    returnMessage("Parameter 'loginIdentity' not found");
    return;
  }

  // Set values.

  skappInfo = { name, domain };
  connectionInfo = { seed, identity };

  // Fill out Requesting page.

  let tObj = document.getElementsByClassName("skapp-name");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = name;
  }
  tObj = document.getElementsByClassName("skapp-domain");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = domain;
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

function goToPermissionsFetching() {
  setAllIdentityContainersInvisible();
  uiPermissionsFetching.style.display = "block";

  getPermissions();
}

function goToPermissionsRequesting() {
  setAllIdentityContainersInvisible();
  uiPermissionsRequesting.style.display = "block";
}

async function getPermissions() {
  if (!connectionInfo) {
    returnMessage("Connection info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("Skapp info not found");
    return;
  }

  const permission = await fetchSkappPermissions(client, connectionInfo, skappInfo);

  if (permission === null) {
    submitted = false;
    goToPermissionsRequesting();
    return;
  } else if (permission === true) {
    // Send the connected info to the provider.
    window.localStorage.setItem("receivedConnectionInfo", JSON.stringify(connectionInfo));
    // Send success message to opening skapp.
    returnMessage("success");
    return;
  } else {
    returnMessage("Permission was denied");
    return;
  }
}

async function handlePermissions(permission: boolean) {
  submitted = true;
  deactivateUI();

  if (!connectionInfo) {
    returnMessage("Connected info not found");
    return;
  }
  if (!skappInfo) {
    returnMessage("Skapp info not found");
    return;
  }

  await saveSkappPermissions(client, connectionInfo, skappInfo, permission);

  if (permission) {
    // Send the connected info to the provider.
    window.localStorage.setItem("receivedConnectionInfo", JSON.stringify(connectionInfo));
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

function setAllIdentityContainersInvisible() {
  uiPermissionsFetching.style.display = "none";
  uiPermissionsRequesting.style.display = "none";
}

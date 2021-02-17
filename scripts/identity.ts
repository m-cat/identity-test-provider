const uiIdentityLoggedOut = document.getElementById("identity-logged-out")!;
const uiIdentitySignIn = document.getElementById("identity-sign-in")!;
const uiIdentitySignUp = document.getElementById("identity-sign-up")!;

let submittedIdentity = false;

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

(window as any).signIn = () => {
  const seedValue = (<HTMLInputElement>document.getElementById("signin-passphrase-text")).value;

  // Send the value back to queryUserForConnection().
  const connectedInfo = { seed: seedValue, identity: "" };
  window.opener.postMessage(connectedInfo, location.origin);

  // Close this window.
  submittedIdentity = true;
  window.close();
};

(window as any).signUp = () => {
  const seedValue = (<HTMLInputElement>document.getElementById("signup-passphrase-text")).value;
  const usernameValue = (<HTMLInputElement>document.getElementById("username-text")).value;

  // Send the values back to queryUserForConnection().
  const connectedInfo = { seed: seedValue, identity: usernameValue };
  window.opener.postMessage(connectedInfo, location.origin);

  // Close this window.
  submittedIdentity = true;
  window.close();
};

/**
 *
 */
function setAllIdentityContainersInvisible() {
  uiIdentityLoggedOut.style.display = "none";
  uiIdentitySignIn.style.display = "none";
  uiIdentitySignUp.style.display = "none";
}

// Event that is triggered when the window is closed.
window.onbeforeunload = () => {
  if (!submittedIdentity) {
    // Send a value to signify that window was closed.
    window.opener.postMessage("closed", location.origin);
  }

  return null;
};

// Code that runs on page load.
window.onload = () => {
  (window as any).goToLoggedOut();
};

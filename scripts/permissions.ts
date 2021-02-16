let submittedPermissions = false;

(window as any).deny = () => {
  // Send the value back to queryUserForSkappPermission().
  window.opener.postMessage("deny", location.origin);

  // Close this window.
  submittedPermissions = true;
  window.close();
};

(window as any).grant = () => {
  // Send the value back to queryUserForSkappPermission().
  window.opener.postMessage("grant", location.origin);

  // Close this window.
  submittedPermissions = true;
  window.close();
};

// Event that is triggered when the window is closed.
window.onbeforeunload = () => {
  if (!submittedPermissions) {
    // Send a blank value to signify that window was closed.
    window.opener.postMessage("", location.origin);
  }

  return null;
};

// Code that runs on page load.
window.onload = () => {
  // Set the skapp-name and skapp-domain text values from the query parameters.
  const urlParams = new URLSearchParams(window.location.search);
  const name = urlParams.get("name");
  const domain = urlParams.get("domain");

  let tObj = document.getElementsByClassName("skapp-name");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = name;
  }
  tObj = document.getElementsByClassName("skapp-domain");
  for (let i = 0; i < tObj.length; i++) {
    tObj[i].textContent = domain;
  }
};

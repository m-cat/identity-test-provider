import { Provider } from "./provider";
import type { Interface } from "./provider";

export class IdentityProvider extends Provider {
  static providerInterface: Interface = {
    identity: ["string"],
    isLoggedIn: ["bool"],
    login: [],
    logout: [],
  };

  constructor() {
    super(IdentityProvider.providerInterface);
  }
}

// ===============
// START EXECUTION
// ===============

if (typeof Storage == "undefined") {
  throw new Error("Browser does not support web storage");
}

// Launch the provider.
new IdentityProvider();

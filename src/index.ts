import { IdentityProvider } from "./identity-provider";

export type ConnectionInfo = {
  seed: string;
  identity: string;
};

// ===============
// START EXECUTION
// ===============

// Launch the provider.
new IdentityProvider();

import { deriveChildSeed, genKeyPairFromSeed, SkynetClient } from "skynet-js";

import {
  loginKey,
  providerName,
  providerUrl,
  relativeConnectorPath,
  connectorName,
  connectorH,
  connectorW,
} from "./consts";
import { Provider, ProviderMetadata, SkappInfo } from "./provider";
import type { Interface } from "./provider";

type ConnectedInfo = {
  seed: string;
  identity: string;
};

export async function fetchSkappPermissions(client: SkynetClient, connectedInfo: ConnectedInfo, skappInfo: SkappInfo): Promise<boolean | null> {
  const childSeed = deriveChildSeed(connectedInfo.seed, providerUrl);
  const { publicKey } = genKeyPairFromSeed(childSeed);

  try {
    const { data } = await client.db.getJSON(publicKey, skappInfo.domain);
    if (!data || !data.permission) {
      return null;
    }
    if (typeof data.permission !== "boolean") {
      return null;
    }

    return data.permission;
  } catch (error) {
    return null;
  }
}

export async function saveSkappPermissions(
  client: SkynetClient,
  connectedInfo: ConnectedInfo,
  skappInfo: SkappInfo,
  permission: boolean
): Promise<void> {
  const childSeed = deriveChildSeed(connectedInfo.seed, providerUrl);
  const { privateKey } = genKeyPairFromSeed(childSeed);
  return client.db.setJSON(privateKey, skappInfo.domain, { permission });
}

export class IdentityProvider extends Provider<ConnectedInfo> {
  static providerInterface: Interface = {
    identity: ["string"],
    isLoggedIn: ["bool"],
    login: [],
    logout: [],
  };
  static metadata: ProviderMetadata = {
    name: providerName,
    url: providerUrl,

    relativeConnectorPath,
    connectorName,
    connectorW,
    connectorH,
  };

  connectedInfo?: ConnectedInfo;

  // ===========
  // Constructor
  // ===========

  constructor() {
    super(IdentityProvider.providerInterface, IdentityProvider.metadata);
  }

  // =========================
  // Required Provider Methods
  // =========================

  protected async clearConnectedInfo(): Promise<void> {
    this.connectedInfo = undefined;

    if (!localStorage) {
      console.log("WARNING: localStorage disabled");
      return;
    }

    localStorage.removeItem(loginKey);
  }

  protected async fetchConnectedInfo(): Promise<ConnectedInfo | null> {
    if (!localStorage) {
      console.log("WARNING: localStorage disabled");
      return null;
    }

    const seed = localStorage.getItem(loginKey);
    if (!seed) {
      return null;
    }

    // Identity should have been set when creating the seed.
    const identity = await this.fetchIdentityUsingSeed(seed);

    const connectedInfo = { seed, identity };
    this.connectedInfo = connectedInfo;
    return connectedInfo;
  }

  /**
   * Saves the seed and identity for the user. If the identity was not provided, we will look it up and return it.
   *
   * @param connectedInfo
   */
  protected async saveConnectedInfo(connectedInfo: ConnectedInfo): Promise<ConnectedInfo> {
    // Empty identity means the user signed in.
    if (connectedInfo.identity === "") {
      connectedInfo.identity = await this.fetchIdentityUsingSeed(connectedInfo.seed);
    } else {
      await this.saveIdentityUsingSeed(connectedInfo.identity, connectedInfo.seed);
    }

    // Save the seed in local storage.
    if (!localStorage) {
      console.log("WARNING: localStorage disabled");
    } else {
      localStorage.setItem(loginKey, connectedInfo.seed);
    }

    this.connectedInfo = connectedInfo;
    return connectedInfo;
  }

  protected async fetchSkappPermissions(connectedInfo: ConnectedInfo, skappInfo: SkappInfo): Promise<boolean | null> {
    return fetchSkappPermissions(this.client, connectedInfo, skappInfo);
  }

  protected async saveSkappPermissions(
    connectedInfo: ConnectedInfo,
    skappInfo: SkappInfo,
    permission: boolean
  ): Promise<void> {
    return saveSkappPermissions(this.client, connectedInfo, skappInfo, permission);
  }

  // =================
  // Interface Methods
  // =================

  protected async identity(): Promise<string> {
    if (!this.connectedInfo) {
      throw new Error("Provider does not have connection info");
    }

    return this.connectedInfo.identity;
  }

  // ================
  // Internal Methods
  // ================

  protected async fetchIdentityUsingSeed(seed: string): Promise<string> {
    const { publicKey } = genKeyPairFromSeed(seed);
    const { data } = await this.client.db.getJSON(publicKey, providerUrl, { timeout: 10 });
    if (!data) {
      throw new Error("Login info not found for given seed");
    }
    if (!data.identity || typeof data.identity !== "string") {
      throw new Error("Identity not found for given seed");
    }
    return data.identity;
  }

  protected async saveIdentityUsingSeed(identity: string, seed: string): Promise<void> {
    const { privateKey } = genKeyPairFromSeed(seed);
    return this.client.db.setJSON(privateKey, providerUrl, { identity });
  }
}

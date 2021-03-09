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
import type { ProviderMetadata, SkappInfo } from "skynet-interface-utils";
import { Provider } from "skynet-provider-utils";

const providerInterface = {
  name: "IdentityProvider",
  version: "0.0.1",
  methods: {
    identity: {
      parameters: [],
      returnType: "string",
    },
    getJSON: {
      parameters: [
        {
          name: "dataKey",
          type: "string",
        },
        {
          name: "customOptions",
          type: "object",
          optional: true,
        }
      ],
      returnType: "object",
    },
  },
};

type ConnectionInfo = {
  seed: string;
  identity: string;
};

export async function fetchIdentityUsingSeed(client: SkynetClient, seed: string): Promise<string> {
  const { publicKey } = genKeyPairFromSeed(seed);
  const { data } = await client.db.getJSON(publicKey, providerUrl, { timeout: 2 });
  if (!data) {
    throw new Error("Login info not found for given seed");
  }
  if (!data.identity || typeof data.identity !== "string") {
    throw new Error("Identity not found for given seed");
  }
  return data.identity;
}

export async function fetchSkappPermissions(
  client: SkynetClient,
  connectionInfo: ConnectionInfo,
  skappInfo: SkappInfo
): Promise<boolean | null> {
  const childSeed = deriveChildSeed(connectionInfo.seed, providerUrl);
  const { publicKey } = genKeyPairFromSeed(childSeed);

  try {
    const { data } = await client.db.getJSON(publicKey, skappInfo.domain, { timeout: 2 });
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
  connectionInfo: ConnectionInfo,
  skappInfo: SkappInfo,
  permission: boolean
): Promise<void> {
  const childSeed = deriveChildSeed(connectionInfo.seed, providerUrl);
  const { privateKey } = genKeyPairFromSeed(childSeed);
  return client.db.setJSON(privateKey, skappInfo.domain, { permission });
}

export class IdentityProvider extends Provider<ConnectionInfo> {
  static metadata: ProviderMetadata = {
    providerInterface,

    name: providerName,
    url: providerUrl,

    relativeConnectorPath,
    connectorName,
    connectorW,
    connectorH,
  };

  connectionInfo?: ConnectionInfo;
  client: SkynetClient;

  // ===========
  // Constructor
  // ===========

  constructor() {
    super(IdentityProvider.metadata);

    // Initialize the Skynet client.

    this.client = new SkynetClient();
  }

  // =================
  // Interface Methods
  // =================

  methods = {
    identity: async(): Promise<string> => {
      if (!this.connectionInfo) {
        throw new Error("Provider does not have connection info");
      }

      return this.connectionInfo.identity;
    }
  }

  // =========================
  // Required Provider Methods
  // =========================

  protected async clearConnectionInfo(): Promise<void> {
    this.connectionInfo = undefined;

    if (!localStorage) {
      console.log("WARNING: localStorage disabled");
      return;
    }

    localStorage.removeItem(loginKey);
  }

  protected async fetchConnectionInfo(): Promise<ConnectionInfo | null> {
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

    const connectionInfo = { seed, identity };
    this.connectionInfo = connectionInfo;
    return connectionInfo;
  }

  /**
   * Saves the seed and identity for the user. If the identity was not provided, we will look it up and return it.
   *
   * @param connectionInfo
   */
  protected async saveConnectionInfo(connectionInfo: ConnectionInfo): Promise<ConnectionInfo> {
    // Empty identity means the user signed in.
    if (connectionInfo.identity === "") {
      connectionInfo.identity = await this.fetchIdentityUsingSeed(connectionInfo.seed);
    } else {
      await this.saveIdentityUsingSeed(connectionInfo.identity, connectionInfo.seed);
    }

    // Save the seed in local storage.
    if (!localStorage) {
      console.log("WARNING: localStorage disabled");
    } else {
      localStorage.setItem(loginKey, connectionInfo.seed);
    }

    this.connectionInfo = connectionInfo;
    return connectionInfo;
  }

  protected async fetchSkappPermissions(connectionInfo: ConnectionInfo, skappInfo: SkappInfo): Promise<boolean | null> {
    return fetchSkappPermissions(this.client, connectionInfo, skappInfo);
  }

  protected async saveSkappPermissions(
    connectionInfo: ConnectionInfo,
    skappInfo: SkappInfo,
    permission: boolean
  ): Promise<void> {
    return saveSkappPermissions(this.client, connectionInfo, skappInfo, permission);
  }

  // ================
  // Internal Methods
  // ================

  protected async fetchIdentityUsingSeed(seed: string): Promise<string> {
    return fetchIdentityUsingSeed(this.client, seed);
  }

  protected async saveIdentityUsingSeed(identity: string, seed: string): Promise<void> {
    const { privateKey } = genKeyPairFromSeed(seed);
    return this.client.db.setJSON(privateKey, providerUrl, { identity });
  }
}

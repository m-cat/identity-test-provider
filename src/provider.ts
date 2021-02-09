import { connectToParent } from "penpal";
import { Connection } from "penpal/lib/types";
import { SkynetClient, deriveChildSeed, genKeyPairFromSeed } from "skynet-js";

export type Interface = Record<string, Array<string>>;

const providerUrl = location.hostname;
const providerName = "identity-test-name";

const loginKey = "login";

type ProviderInfo = {
  providerInterface: Interface | null;
  isProviderConnected: boolean;
  isProviderLoaded: boolean;
  metadata: ProviderMetadata | null;
};

type ProviderMetadata = {
  name: string;
  domain: string;
};

class SkappInfo {
  name: string;
  domain: string;
}

export class Provider {
  parentConnection: Connection;
  client: SkynetClient;

  providerInfo: ProviderInfo;

  constructor(providerInterface: Interface) {
    // Set the provider info.

    this.providerInfo = {
      providerInterface,
      isProviderLoaded: true,
      isProviderConnected: false,
      metadata: {
        name: providerName,
        domain: providerUrl,
      },
    };

    // Enable communication with parent skapp.

    const connection = connectToParent({
      methods: {
        callInterface: this.callInterface,
        connectSilently: this.connectSilently,
        connectWithInput: this.connectWithInput,
        disconnect: this.disconnect,
      },
      timeout: 5_000,
    });
    this.parentConnection = connection;

    // Initialize the Skynet client.
    this.client = new SkynetClient();
  }

  // ===================
  // Public Provider API
  // ===================

  protected async callInterface(method: string): Promise<unknown> {
    if (!this.providerInfo.isProviderConnected) {
      throw new Error("Provider not connected, cannot access interface");
    }
    if (!this.providerInfo.providerInterface) {
      throw new Error("Provider interface not present. Possible logic bug");
    }

    if (method in this.providerInfo.providerInterface) {
      return this[method]();
    } else {
      throw new Error(
        `Unsupported method for this provider interface. Method: '${method}', Interface: ${this.providerInfo.providerInterface}`
      );
    }
  }

  /**
   * Tries to connect to the provider, connecting even if the user isn't already logged in to the provider (as opposed to connectSilently()).
   */
  protected async connectWithInput(skappInfo: SkappInfo): Promise<[Interface, ProviderMetadata]> {
    // Check if user is connected already.

    let connectedSeed = this.getConnectedSeed();
    if (!connectedSeed) {
      connectedSeed = this.queryUserForSeed();
      if (!connectedSeed) {
        throw new Error("could not get a stored seed or a seed from the user");
      }
      this.saveConnectedSeed(connectedSeed);
    }

    // Check if skapp is permissioned.

    if (!await this.checkSkappPermissions(connectedSeed, skappInfo)) {
      const permission = this.queryUserForSkappPermission(skappInfo);
      if (!permission) {
        throw new Error("could not get stored permissions or permissions from the user");
      }
      this.saveSkappPermissions(connectedSeed, skappInfo);
    }

    return [this.providerInfo.providerInterface!, this.providerInfo.metadata!];
  }

  protected async disconnect(): Promise<void> {
    this.clearConnectedSeed();
    this.providerInfo.isProviderConnected = false;
  }

  /**
   * Tries to connect to the provider, only connecting if the user is already logged in to the provider (as opposed to connectWithInput()).
   */
  protected async connectSilently(skappInfo: SkappInfo): Promise<[Interface, ProviderMetadata]> {
    // Check if user is connected already.

    const connectedSeed = this.getConnectedSeed();
    if (!connectedSeed) {
      throw new Error("not connected");
    }

    // Check if skapp is permissioned.

    if (!this.checkSkappPermissions(connectedSeed, skappInfo)) {
      throw new Error("skapp not permissioned");
    }

    return [this.providerInfo.providerInterface!, this.providerInfo.metadata!];
  }

  // =========================
  // Internal Provider Methods
  // =========================

  protected async checkSkappPermissions(connectedSeed: string, skappInfo: SkappInfo): Promise<boolean> {
    const childSeed = deriveChildSeed(connectedSeed, skappInfo.domain);
    const { publicKey } = genKeyPairFromSeed(childSeed);
    const { permission } = await this.client.db.getJSON(publicKey, providerUrl);
    return permission === skappInfo.domain;
  }

  protected clearConnectedSeed(): void {
    localStorage.removeItem(loginKey);
  }

  protected getConnectedSeed(): string | null {
    return localStorage.getItem(loginKey);
  }

  protected saveConnectedSeed(connectedSeed: string): void {
    localStorage.setItem(loginKey, connectedSeed);
  }

  protected async saveSkappPermissions(connectedSeed: string, skappInfo: SkappInfo): Promise<void> {
    const childSeed = deriveChildSeed(connectedSeed, skappInfo.domain);
    const { privateKey } = genKeyPairFromSeed(childSeed);
    return this.client.db.setJSON(privateKey, providerUrl, { permission: skappInfo.domain });
  }
}

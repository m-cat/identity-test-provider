import { connectToParent } from "penpal";
import { Connection } from "penpal/lib/types";
import { SkynetClient, deriveChildSeed, genKeyPairFromSeed } from "skynet-js";
import { popupCenter } from "./utils";

export type Interface = Record<string, Array<string>>;

const providerUrl = location.hostname;
const providerName = "identity-test-name";
const uiW = 500;
const uiH = 400;

const loginKey = "login";

type ProviderInfo = {
  providerInterface: Interface;
  isProviderConnected: boolean;
  isProviderLoaded: boolean;
  metadata: ProviderMetadata;
};

type ProviderMetadata = {
  name: string;
  domain: string;
};

class SkappInfo {
  name: string;
  domain: string;

  constructor(name: string) {
    this.name = name;
    this.domain = location.hostname;
  }
}

export class Provider {
  providerInfo: ProviderInfo;

  protected parentConnection: Connection;
  protected client: SkynetClient;

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
        getMetadata: this.getMetadata,
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
      // TODO: Unignore
      // @ts-ignore
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
  protected async connectWithInput(skappInfo: SkappInfo): Promise<Interface> {
    // Check if user is connected already.

    let connectedSeed = this.getConnectedSeed();
    if (!connectedSeed) {
      connectedSeed = await this.queryUserForSeed();
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

    return this.providerInfo.providerInterface;
  }

  protected async disconnect(): Promise<void> {
    this.clearConnectedSeed();
    this.providerInfo.isProviderConnected = false;
  }

  /**
   * Tries to connect to the provider, only connecting if the user is already logged in to the provider (as opposed to connectWithInput()).
   */
  protected async connectSilently(skappInfo: SkappInfo): Promise<Interface> {
    // Check if user is connected already.

    const connectedSeed = this.getConnectedSeed();
    if (!connectedSeed) {
      throw new Error("not connected");
    }

    // Check if skapp is permissioned.

    if (!this.checkSkappPermissions(connectedSeed, skappInfo)) {
      throw new Error("skapp not permissioned");
    }

    return this.providerInfo.providerInterface;
  }

  protected async getMetadata(): Promise<ProviderMetadata> {
    return this.providerInfo.metadata;
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

  // TODO: should check periodically if window is still open.
  /**
   * Creates window with login UI and waits for a response.
   */
  protected async queryUserForSeed(): Promise<string> {
    // Set the ui URL.
    const identityUiUrl = "identity.html";

    const promise: Promise<string> = new Promise((resolve, reject) => {
      // Register a message listener.
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin)
          return;

        window.removeEventListener("message", handleMessage);

        // Resolve or reject the promise.
        if (event.data === "") {
          reject(new Error("did not get a seed"));
        }
        resolve(event.data);
      };

      window.addEventListener("message", handleMessage);
    });

    // Open the ui.
    const newWindow = popupCenter(identityUiUrl, providerName, uiW, uiH);

    return promise;
  }

  // TODO: should check periodically if window is still open.
  /**
   * Creates window with permissions UI and waits for a response.
   */
  protected async queryUserForSkappPermission(skappInfo: SkappInfo): Promise<boolean> {
    // Set the ui URL.
    const permissionsUiUrl = `permissions.html?name=${skappInfo.name}&domain=${skappInfo.domain}`;

    const promise: Promise<boolean> = new Promise((resolve, reject) => {
      // Register a message listener.
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin)
          return;

        window.removeEventListener("message", handleMessage);

        // Resolve or reject the promise.
        if (event.data === "grant") {
          resolve(true);
        } else if (event.data === "deny") {
          resolve(false);
        }
        // If window closed, don't deny the permission -- fail the operation instead.
        reject(new Error("permissions were neither granted nor denied"));
      };

      window.addEventListener("message", handleMessage);
    });

    // Open the ui.
    const newWindow = popupCenter(permissionsUiUrl, providerName, uiW, uiH);

    return promise;
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

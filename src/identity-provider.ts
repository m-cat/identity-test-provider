import { deriveChildSeed, genKeyPairFromSeed } from "skynet-js";

import { loginKey, providerName, providerUrl, uiH, uiW } from "./consts";
import { Provider, SkappInfo } from "./provider";
import type { Interface } from "./provider";
import { popupCenter } from "./utils";

type ConnectedInfo = {
  seed: string;
  identity: string;
};

export class IdentityProvider extends Provider<ConnectedInfo> {
  static providerInterface: Interface = {
    identity: ["string"],
    isLoggedIn: ["bool"],
    login: [],
    logout: [],
  };

  connectedInfo?: ConnectedInfo;

  // ===========
  // Constructor
  // ===========

  constructor() {
    super(IdentityProvider.providerInterface);
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
    const childSeed = deriveChildSeed(connectedInfo.seed, skappInfo.domain);
    const { publicKey } = genKeyPairFromSeed(childSeed);

    try {
      const { data } = await this.client.db.getJSON(publicKey, providerUrl);
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

  protected async saveSkappPermissions(
    connectedInfo: ConnectedInfo,
    skappInfo: SkappInfo,
    permission: boolean
  ): Promise<void> {
    const childSeed = deriveChildSeed(connectedInfo.seed, skappInfo.domain);
    const { privateKey } = genKeyPairFromSeed(childSeed);
    return this.client.db.setJSON(privateKey, providerUrl, { permission });
  }

  // TODO: should check periodically if window is still open.
  /**
   * Creates window with login UI and waits for a response.
   */
  protected async queryUserForConnection(): Promise<ConnectedInfo | null> {
    // Set the ui URL.
    const identityUiUrl = "identity.html";

    const promise: Promise<ConnectedInfo | null> = new Promise((resolve, reject) => {
      // Register a message listener.
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin) return;

        window.removeEventListener("message", handleMessage);

        // Resolve or reject the promise.
        if (!event.data) {
          reject(new Error("Invalid data returned"));
        }
        if (event.data === "closed") {
          resolve(null);
        }
        const { seed } = event.data;
        if (!seed) {
          reject(new Error("Invalid seed returned"));
        }
        if (seed === "") {
          // TODO: Form should prevent sending an empty seed.
          reject(new Error("No seed returned"));
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
   *
   * @param skappInfo
   */
  protected async queryUserForSkappPermission(skappInfo: SkappInfo): Promise<boolean> {
    // Set the ui URL.
    const permissionsUiUrl = `permissions.html?name=${skappInfo.name}&domain=${skappInfo.domain}`;

    const promise: Promise<boolean> = new Promise((resolve, reject) => {
      // Register a message listener.
      const handleMessage = (event: MessageEvent) => {
        if (event.origin !== location.origin) return;

        window.removeEventListener("message", handleMessage);

        // If window closed, don't deny the permission -- fail the operation instead.
        if (!event.data || event.data === "") {
          reject(new Error("permissions were neither granted nor denied"));
        }

        // Resolve or reject the promise.
        if (event.data === "grant") {
          resolve(true);
        } else if (event.data === "deny") {
          resolve(false);
        }
        reject(new Error("permissions were neither granted nor denied"));
      };

      window.addEventListener("message", handleMessage);
    });

    // Open the ui.
    const newWindow = popupCenter(permissionsUiUrl, providerName, uiW, uiH);

    return promise;
  }

  // =================
  // Interface Methods
  // =================

  protected async identity(): Promise<string> {
    if (!this.connectedInfo) {
      throw new Error("provider does not have connection info");
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

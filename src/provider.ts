/**
 * Generic provider code.
 */

import { ChildHandshake, WindowMessenger } from "post-me";
import type { Connection } from "post-me";
import { SkynetClient } from "skynet-js";

import { providerName, providerUrl, relativeConnectUrl } from "./consts";

export type Interface = Record<string, Array<string>>;

type ProviderStatus = {
  providerInterface: Interface;
  isProviderConnected: boolean;
  isProviderLoaded: boolean;
  metadata: ProviderMetadata;
};

type ProviderMetadata = {
  name: string;
  domain: string;
  relativeConnectUrl: string;
};

export class SkappInfo {
  name: string;
  domain: string;

  constructor(name: string) {
    this.name = name;
    this.domain = location.hostname;
  }
}

export abstract class Provider<T> {
  providerStatus: ProviderStatus;

  protected parentConnection: Promise<Connection>;
  protected client: SkynetClient;

  constructor(providerInterface: Interface) {
    if (typeof Storage == "undefined") {
      throw new Error("Browser does not support web storage");
    }

    // Set the provider info.

    this.providerStatus = {
      providerInterface,
      isProviderLoaded: true,
      isProviderConnected: false,
      metadata: {
        name: providerName,
        domain: providerUrl,
        relativeConnectUrl,
      },
    };

    // Enable communication with parent skapp.

    const methods = {
        callInterface: (method: string) => this.callInterface(method),
        connectSilently: (skappInfo: SkappInfo) => this.connectSilently(skappInfo),
        connectWithInput: (skappInfo: SkappInfo) => this.connectWithInput(skappInfo),
        disconnect: () => this.disconnect(),
        getMetadata: () => this.getMetadata(),
    };
    const messenger = new WindowMessenger({
      localWindow: window,
      remoteWindow: window.parent,
      remoteOrigin: "*",
    });
    this.parentConnection = ChildHandshake(messenger, methods);

    // Initialize the Skynet client.
    this.client = new SkynetClient();
  }

  // ===================
  // Public Provider API
  // ===================

  protected async callInterface(method: string): Promise<unknown> {
    if (!this.providerStatus.isProviderConnected) {
      throw new Error("Provider not connected, cannot access interface");
    }
    if (!this.providerStatus.providerInterface) {
      throw new Error("Provider interface not present. Possible logic bug");
    }

    if (!(method in this.providerStatus.providerInterface)) {
      throw new Error(
        `Unsupported method for this provider interface. Method: '${method}'`
      );
    }
    // @ts-expect-error TS doesn't like this.
    if (!this[method]) {
      throw new Error(
        `Unimplemented interface method. Method: '${method}'`
      );
    }
    // @ts-expect-error TS doesn't like this.
    return this[method]();
  }

  /**
   * Tries to connect to the provider, only connecting if the user is already logged in to the provider (as opposed to connectWithInput()).
   */
  protected async connectSilently(skappInfo: SkappInfo): Promise<Interface> {
    // Check if user is connected already.

    const connectedInfo = await this.fetchConnectedInfo();
    if (!connectedInfo) {
      throw new Error("not connected");
    }

    // Check if skapp is permissioned.

    if (!await this.fetchSkappPermissions(connectedInfo, skappInfo)) {
      throw new Error("skapp not permissioned");
    }

    this.providerStatus.isProviderConnected = true;
    return this.providerStatus.providerInterface;
  }

  /**
   * Tries to connect to the provider, connecting even if the user isn't already logged in to the provider (as opposed to connectSilently()).
   */
  protected async connectWithInput(skappInfo: SkappInfo): Promise<Interface> {
    // Check if user is connected already.

    let connectedInfo = await this.fetchConnectedInfo();
    if (!connectedInfo) {
      connectedInfo = await this.queryUserForConnection();
      if (!connectedInfo) {
        return this.providerStatus.providerInterface;
      }
      connectedInfo = await this.saveConnectedInfo(connectedInfo);
    }

    // Check if skapp is permissioned.

    let permission = await this.fetchSkappPermissions(connectedInfo, skappInfo);
    if (!permission) {
      permission = await this.queryUserForSkappPermission(skappInfo);
      await this.saveSkappPermissions(connectedInfo, skappInfo, permission);
    }

      if (!permission) {
        return this.providerStatus.providerInterface;
      }

    this.providerStatus.isProviderConnected = true;
    return this.providerStatus.providerInterface;
  }

  protected async disconnect(): Promise<void> {
    await this.clearConnectedInfo();
    this.providerStatus.isProviderConnected = false;
  }

  protected async getMetadata(): Promise<ProviderMetadata> {
    return this.providerStatus.metadata;
  }

  // =========================
  // Required Provider Methods
  // =========================

  protected abstract clearConnectedInfo(): Promise<void>;

  protected abstract fetchConnectedInfo(): Promise<T | null>;

  protected abstract saveConnectedInfo(connectedInfo: T): Promise<T>;

  protected abstract queryUserForConnection(): Promise<T | null>;

  protected abstract fetchSkappPermissions(connectedInfo: T, skappInfo: SkappInfo): Promise<boolean | null>;

  protected abstract saveSkappPermissions(connectedInfo: T, skappInfo: SkappInfo, permission: boolean): Promise<void>;

  protected abstract queryUserForSkappPermission(skappInfo: SkappInfo): Promise<boolean>;
}

/**
 * Generic provider code.
 */

import { ChildHandshake, WindowMessenger } from "post-me";
import type { Connection } from "post-me";
import { SkynetClient } from "skynet-js";

export type Interface = Record<string, Array<string>>;

export type ProviderMetadata = {
  name: string;
  url: string;

  relativeConnectorPath: string;
  connectorName: string;
  connectorW: number;
  connectorH: number;
};

export type SkappInfo = {
  name: string;
  domain: string;
};

export abstract class Provider<T> {
  isProviderConnected: boolean;
  metadata: ProviderMetadata;
  providerInterface: Interface;

  protected client: SkynetClient;
  protected connectionInfoListener?: EventListener;
  protected parentConnection: Promise<Connection>;

  constructor(providerInterface: Interface, metadata: ProviderMetadata) {
    if (typeof Storage == "undefined") {
      throw new Error("Browser does not support web storage");
    }

    // Set the provider info.

    this.providerInterface = providerInterface;
    this.isProviderConnected = false;
    this.metadata = metadata;

    // Enable communication with parent skapp.

    const methods = {
      callInterface: (method: string) => this.callInterface(method),
      connectSilently: (skappInfo: SkappInfo) => this.connectSilently(skappInfo),
      disconnect: () => this.disconnect(),
    };
    const messenger = new WindowMessenger({
      localWindow: window,
      remoteWindow: window.parent,
      remoteOrigin: "*",
    });
    this.parentConnection = ChildHandshake(messenger, methods);

    // Register listener for connected info from the connector.

    const listener = this.connectionCompleteListener;
    window.addEventListener("message", listener);
    // @ts-expect-error TS is wrong here as far as I can tell.
    this.connectionInfoListener = listener;

    // Initialize the Skynet client.

    this.client = new SkynetClient();
  }

  // ===================
  // Public Provider API
  // ===================

  protected async callInterface(method: string): Promise<unknown> {
    if (!this.isProviderConnected) {
      throw new Error("Provider not connected, cannot access interface");
    }
    if (!this.providerInterface) {
      throw new Error("Provider interface not present. Possible logic bug");
    }

    if (!(method in this.providerInterface)) {
      throw new Error(`Unsupported method for this provider interface. Method: '${method}'`);
    }
    // @ts-expect-error TS doesn't like this.
    if (!this[method]) {
      throw new Error(`Unimplemented interface method. Method: '${method}'`);
    }
    // @ts-expect-error TS doesn't like this.
    return this[method]();
  }

  /**
   * Tries to connect to the provider, only connecting if the user is already logged in to the provider (as opposed to connectWithInput()).
   */
  protected async connectSilently(skappInfo: SkappInfo): Promise<Interface | null> {
    // Check if user is connected already.

    const connectionInfo = await this.fetchConnectionInfo();
    if (!connectionInfo) {
      return null;
    }

    // Check if skapp is permissioned.

    if (!(await this.fetchSkappPermissions(connectionInfo, skappInfo))) {
      return null;
    }

    this.isProviderConnected = true;
    return this.providerInterface;
  }

  protected async disconnect(): Promise<void> {
    await this.clearConnectionInfo();
    this.isProviderConnected = false;

    // Unregister the connected info listener.
    if (this.connectionInfoListener) {
      window.removeEventListener("message", this.connectionInfoListener);
    }
  }

  //=================
  // Internal Methods
  // ================

  protected async connectionCompleteListener(event: MessageEvent) {
    const parentConnection = await this.parentConnection;

    // Only consider messages from the provider domain.
    if (event.origin !== this.metadata.url) return;

    if (!event.data) {
      return;
    }

    // The message must be of type "connectionComplete".
    if (event.data.messageType !== "connectionComplete") {
      return;
    }

    // Finish connecting and get the interface.
    const receivedConnectionInfo = event.data.connectionInfo;
    await this.connectWithInput(receivedConnectionInfo);

    // Send connectionComplete with interface back up to the bridge.
    const localHandle = parentConnection.localHandle();
    localHandle.emit("connectionComplete", { providerInterface: this.providerInterface, metadata: this.metadata });
  }

  /**
   * Completes a connection to the provider initiated in the connector. Triggered after receiving connection info from the connector.
   */
  protected async connectWithInput(connectionInfo: T) {
    // TODO: Validate the connectionInfo using required abstract function and send an error if invalid.

    // Save the connected info.
    await this.saveConnectionInfo(connectionInfo);

    this.isProviderConnected = true;
  }

  // =========================
  // Required Provider Methods
  // =========================

  protected abstract clearConnectionInfo(): Promise<void>;

  protected abstract fetchConnectionInfo(): Promise<T | null>;

  protected abstract fetchSkappPermissions(connectionInfo: T, skappInfo: SkappInfo): Promise<boolean | null>;

  protected abstract saveConnectionInfo(connectionInfo: T): Promise<T>;
}

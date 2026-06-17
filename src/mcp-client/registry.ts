/**
 * IMPL: lifecycle management for all backend MCP clients.
 *
 * Holds the connected clients plus their definitions, and supports runtime
 * hot add/remove/update used by the config watcher. Tool discovery is cached
 * per client so the router and health checker can read it cheaply.
 */
import { EventEmitter } from "node:events";
import type { Logger } from "../logging/logger.js";
import type { MCPDefinition } from "../config/types.js";
import { MCPNotFoundError } from "../utils/errors.js";
import { createMCPClient } from "./factory.js";
import { OAuthStore } from "./oauth-store.js";
import { MorphOAuthProvider } from "./oauth-provider.js";
import type { ClientStatus, MCPClient, Tool } from "./types.js";

export interface MCPStatusSummary {
  name: string;
  enabled: boolean;
  status: ClientStatus | "disabled";
  transport: MCPDefinition["transport"]["type"];
  toolCount: number;
  latencyMs?: number;
  lastPing?: string;
  lastError?: string;
  oauthNeeded?: boolean;
  oauthUrl?: string;
  oauthHasToken?: boolean;
}

interface Entry {
  definition: MCPDefinition;
  client?: MCPClient;
  tools: Tool[];
  latencyMs?: number;
  lastPing?: string;
}

export type RegistryEvent =
  | "connected"
  | "disconnected"
  | "error"
  | "toolListChanged";

export class MCPClientRegistry extends EventEmitter {
  private readonly entries = new Map<string, Entry>();
  private readonly oauthProviders = new Map<string, MorphOAuthProvider>();

  constructor(
    private readonly logger: Logger,
    readonly oauthStore?: OAuthStore,
    private readonly oauthBaseUrl?: string,
  ) {
    super();
  }

  /** Create+connect every enabled definition. Failures are logged, not thrown. */
  async initialize(definitions: MCPDefinition[]): Promise<void> {
    await Promise.all(
      definitions.map((def) => this.add(def).catch(() => undefined)),
    );
  }

  async add(definition: MCPDefinition): Promise<void> {
    if (this.entries.has(definition.name)) {
      throw new Error(`MCP "${definition.name}" already registered`);
    }
    const entry: Entry = { definition, tools: [] };
    this.entries.set(definition.name, entry);
    if (!definition.enabled) {
      this.logger.info({ mcp: definition.name }, "registered (disabled)");
      return;
    }
    await this.startEntry(entry);
  }

  private async startEntry(entry: Entry): Promise<void> {
    const authProvider = this.getOrCreateAuthProvider(entry.definition);
    const client = createMCPClient(entry.definition, {
      logger: this.logger,
      authProvider,
    });
    entry.client = client;
    client.on("disconnected", () =>
      this.emit("disconnected", entry.definition.name),
    );
    client.on("error", (err) => this.emit("error", entry.definition.name, err));
    try {
      await client.connect();
      entry.tools = await client.listTools();
      this.emit("connected", entry.definition.name);
      this.emit("toolListChanged", entry.definition.name);
    } catch (err) {
      this.logger.error(
        { mcp: entry.definition.name, err: (err as Error).message },
        "failed to start MCP",
      );
      throw err;
    }
  }

  async connect(name: string): Promise<void> {
    const entry = this.require(name);
    if (entry.client?.getStatus() === "connected") return;
    await entry.client?.disconnect();
    entry.client = undefined;
    entry.tools = [];
    await this.startEntry(entry);
  }

  async disconnect(name: string): Promise<void> {
    const entry = this.require(name);
    await entry.client?.disconnect();
    entry.client = undefined;
    entry.tools = [];
  }

  async remove(name: string): Promise<void> {
    const entry = this.require(name);
    await entry.client?.disconnect();
    this.entries.delete(name);
  }

  /** Reconnect with a new definition (used by hot-reload). */
  async update(name: string, definition: MCPDefinition): Promise<void> {
    await this.remove(name);
    await this.add(definition);
  }

  async disconnectAll(): Promise<void> {
    await Promise.all(
      [...this.entries.values()].map((e) =>
        e.client
          ? e.client.disconnect().catch(() => undefined)
          : Promise.resolve(),
      ),
    );
  }

  /** Refresh cached tools and record ping latency for an entry. */
  async refreshTools(name: string): Promise<Tool[]> {
    const entry = this.require(name);
    if (!entry.client || entry.client.getStatus() !== "connected")
      return entry.tools;
    const started = performance.now();
    const tools = await entry.client.listTools();
    entry.latencyMs = Math.round(performance.now() - started);
    entry.lastPing = new Date().toISOString();
    const changed = tools.length !== entry.tools.length;
    entry.tools = tools;
    if (changed) this.emit("toolListChanged", name);
    return tools;
  }

  getClient(name: string): MCPClient | undefined {
    return this.entries.get(name)?.client;
  }

  getConnectedClients(): Map<string, MCPClient> {
    const map = new Map<string, MCPClient>();
    for (const [name, entry] of this.entries) {
      if (entry.client?.getStatus() === "connected")
        map.set(name, entry.client);
    }
    return map;
  }

  getTools(name: string): Tool[] {
    return this.entries.get(name)?.tools ?? [];
  }

  has(name: string): boolean {
    return this.entries.has(name);
  }

  getDefinitions(): MCPDefinition[] {
    return [...this.entries.values()].map((e) => e.definition);
  }

  getDefinition(name: string): MCPDefinition | undefined {
    return this.entries.get(name)?.definition;
  }

  getStatusSummary(): MCPStatusSummary[] {
    return [...this.entries.values()].map((entry) => {
      const { definition, client } = entry;
      return {
        name: definition.name,
        enabled: definition.enabled,
        status: !definition.enabled
          ? "disabled"
          : (client?.getStatus() ?? "disconnected"),
        transport: definition.transport.type,
        toolCount: entry.tools.length,
        latencyMs: entry.latencyMs,
        lastPing: entry.lastPing,
        lastError: client?.getLastError(),
        oauthNeeded: client?.needsOAuth?.() ?? false,
        oauthUrl: client?.getAuthorizationUrl?.(),
        oauthHasToken: client?.hasOAuthToken?.() ?? false,
      };
    });
  }

  private require(name: string): Entry {
    const entry = this.entries.get(name);
    if (!entry) throw new MCPNotFoundError(name);
    return entry;
  }

  private getOrCreateAuthProvider(
    def: MCPDefinition,
  ): MorphOAuthProvider | undefined {
    if (def.transport.type !== "http") return undefined;
    if (!this.oauthStore || !this.oauthBaseUrl) return undefined;
    let provider = this.oauthProviders.get(def.name);
    if (!provider) {
      provider = new MorphOAuthProvider(
        def.name,
        this.oauthStore,
        this.oauthBaseUrl,
      );
      this.oauthProviders.set(def.name, provider);
    }
    return provider;
  }

  getOAuthProvider(name: string): MorphOAuthProvider | undefined {
    return this.oauthProviders.get(name);
  }

  needsOAuth(name: string): boolean {
    const client = this.getClient(name);
    return client?.needsOAuth?.() ?? false;
  }

  getOAuthUrl(name: string): string | undefined {
    const client = this.getClient(name);
    return client?.getAuthorizationUrl?.();
  }

  hasOAuthToken(name: string): boolean {
    const client = this.getClient(name);
    return client?.hasOAuthToken?.() ?? false;
  }

  async finishOAuth(name: string, authorizationCode: string): Promise<void> {
    const client = this.getClient(name);
    if (!client?.finishOAuth)
      throw new Error(`OAuth not available for MCP "${name}"`);
    await client.finishOAuth(authorizationCode);
  }
}

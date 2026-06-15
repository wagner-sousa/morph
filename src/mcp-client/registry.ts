/**
 * IMPL: lifecycle management for all backend MCP clients.
 *
 * Holds the connected clients plus their definitions, and supports runtime
 * hot add/remove/update used by the config watcher. Tool discovery is cached
 * per client so the router and health checker can read it cheaply.
 */
import { EventEmitter } from 'node:events';
import type { Logger } from '../logging/logger.js';
import type { MCPDefinition } from '../config/types.js';
import { MCPNotFoundError } from '../utils/errors.js';
import { createMCPClient } from './factory.js';
import type { ClientStatus, MCPClient, Tool } from './types.js';

export interface MCPStatusSummary {
  name: string;
  enabled: boolean;
  status: ClientStatus | 'disabled';
  transport: MCPDefinition['transport']['type'];
  toolCount: number;
  latencyMs?: number;
  lastPing?: string;
  lastError?: string;
}

interface Entry {
  definition: MCPDefinition;
  client?: MCPClient;
  tools: Tool[];
  latencyMs?: number;
  lastPing?: string;
}

export type RegistryEvent = 'connected' | 'disconnected' | 'error' | 'toolListChanged';

export class MCPClientRegistry extends EventEmitter {
  private readonly entries = new Map<string, Entry>();

  constructor(private readonly logger: Logger) {
    super();
  }

  /** Create+connect every enabled definition. Failures are logged, not thrown. */
  async initialize(definitions: MCPDefinition[]): Promise<void> {
    await Promise.all(definitions.map((def) => this.add(def).catch(() => undefined)));
  }

  async add(definition: MCPDefinition): Promise<void> {
    if (this.entries.has(definition.name)) {
      throw new Error(`MCP "${definition.name}" already registered`);
    }
    const entry: Entry = { definition, tools: [] };
    this.entries.set(definition.name, entry);
    if (!definition.enabled) {
      this.logger.info({ mcp: definition.name }, 'registered (disabled)');
      return;
    }
    await this.startEntry(entry);
  }

  private async startEntry(entry: Entry): Promise<void> {
    const client = createMCPClient(entry.definition, { logger: this.logger });
    entry.client = client;
    client.on('disconnected', () => this.emit('disconnected', entry.definition.name));
    client.on('error', (err) => this.emit('error', entry.definition.name, err));
    try {
      await client.connect();
      entry.tools = await client.listTools();
      this.emit('connected', entry.definition.name);
      this.emit('toolListChanged', entry.definition.name);
    } catch (err) {
      this.logger.error(
        { mcp: entry.definition.name, err: (err as Error).message },
        'failed to start MCP',
      );
      throw err;
    }
  }

  async connect(name: string): Promise<void> {
    const entry = this.require(name);
    if (entry.client?.getStatus() === 'connected') return;
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
      [...this.entries.values()].map((e) => e.client?.disconnect().catch(() => undefined)),
    );
  }

  /** Refresh cached tools and record ping latency for an entry. */
  async refreshTools(name: string): Promise<Tool[]> {
    const entry = this.require(name);
    if (!entry.client || entry.client.getStatus() !== 'connected') return entry.tools;
    const started = performance.now();
    const tools = await entry.client.listTools();
    entry.latencyMs = Math.round(performance.now() - started);
    entry.lastPing = new Date().toISOString();
    const changed = tools.length !== entry.tools.length;
    entry.tools = tools;
    if (changed) this.emit('toolListChanged', name);
    return tools;
  }

  getClient(name: string): MCPClient | undefined {
    return this.entries.get(name)?.client;
  }

  getConnectedClients(): Map<string, MCPClient> {
    const map = new Map<string, MCPClient>();
    for (const [name, entry] of this.entries) {
      if (entry.client?.getStatus() === 'connected') map.set(name, entry.client);
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

  getStatusSummary(): MCPStatusSummary[] {
    return [...this.entries.values()].map((entry) => {
      const { definition, client } = entry;
      return {
        name: definition.name,
        enabled: definition.enabled,
        status: !definition.enabled ? 'disabled' : (client?.getStatus() ?? 'disconnected'),
        transport: definition.transport.type,
        toolCount: entry.tools.length,
        latencyMs: entry.latencyMs,
        lastPing: entry.lastPing,
        lastError: client?.getLastError(),
      };
    });
  }

  private require(name: string): Entry {
    const entry = this.entries.get(name);
    if (!entry) throw new MCPNotFoundError(name);
    return entry;
  }
}

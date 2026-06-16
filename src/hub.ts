/**
 * IMPL: the Hub coordinates every component — it is the heart of MORPH.
 *
 * It owns the registry, router, TOON converter, health checker, metrics and
 * stores, exposes the unified tool list to the agent-facing MCP server, routes
 * tool calls to backends, converts results to TOON, and applies config
 * hot-reloads.
 */
import { EventEmitter } from 'node:events';
import { resolve as resolvePath } from 'node:path';
import type { Logger } from './logging/logger.js';
import { LogStore } from './logging/store.js';
import { Metrics } from './metrics.js';
import { Store } from './persistence/store.js';
import { MCPClientRegistry } from './mcp-client/registry.js';
import { OAuthStore } from './mcp-client/oauth-store.js';
import { Router } from './router/index.js';
import { ToonConverter } from './toon/converter.js';
import { HealthChecker } from './health/checker.js';
import { getVersionInfo } from './utils/version.js';
import { ConfigWatcher } from './config/watcher.js';
import {
  BUILTIN_TOOLS,
  BUILTIN_TOOL_NAMES,
  isBuiltinTool,
} from './mcp-server/builtin-tools.js';
import type { CallToolResult, Tool } from './mcp-client/types.js';
import type { MorphConfig, MCPDefinition } from './config/types.js';

export interface HubOptions {
  config: MorphConfig;
  configPath: string;
  logger: Logger;
  dataDir?: string;
}

export class Hub extends EventEmitter {
  private config: MorphConfig;
  private readonly configPath: string;
  readonly logger: Logger;
  readonly registry: MCPClientRegistry;
  readonly router: Router;
  readonly converter: ToonConverter;
  readonly health: HealthChecker;
  readonly metrics: Metrics;
  readonly logs: LogStore;
  readonly store: Store;
  readonly oauthStore: OAuthStore;
  private readonly watcher = new ConfigWatcher();
  private readonly startedAt = Date.now();
  private readonly inFlight = new Set<Promise<unknown>>();
  private dataDir: string;

  constructor(options: HubOptions) {
    super();
    this.config = options.config;
    this.configPath = resolvePath(options.configPath);
    this.logger = options.logger;
    this.dataDir = resolvePath(options.dataDir ?? './data');
    this.oauthStore = new OAuthStore(this.dataDir);
    const publicUrl = options.config.webUi?.publicUrl ?? `http://localhost:${options.config.webUi?.port ?? 3101}`;
    this.registry = new MCPClientRegistry(this.logger, this.oauthStore, publicUrl);
    this.router = new Router(this.logger);
    this.converter = new ToonConverter(this.config.toon);
    this.metrics = new Metrics();
    this.logs = new LogStore();
    this.store = new Store(resolvePath(this.dataDir, 'morph.db'));
    this.health = new HealthChecker(this.registry, this.config.health, this.logger);

    this.registry.on('toolListChanged', () => this.rebuildRouter());
    this.registry.on('connected', (name) => this.emit('mcp:connected', name));
    this.registry.on('disconnected', (name) => this.emit('mcp:disconnected', name));
    this.registry.on('error', (name, err) => this.emit('mcp:error', name, err));
  }

  getConfig(): MorphConfig {
    return this.config;
  }

  async start(): Promise<void> {
    await this.oauthStore.load();
    await this.registry.initialize(this.config.mcpServers);
    this.rebuildRouter();
    this.health.start();
    if (this.config.morph.logLevel) {
      this.watcher.on('change', (cfg) => void this.applyConfig(cfg));
      this.watcher.on('error', (err) =>
        this.logger.error({ err: err.message }, 'config reload failed; keeping current config'),
      );
      this.watcher.watch(this.configPath);
    }
    this.logger.info('hub started');
  }

  private rebuildRouter(): void {
    const toolsByMcp = new Map<string, Tool[]>();
    const aliasesByMcp = new Map<string, Record<string, string> | undefined>();
    for (const def of this.registry.getDefinitions()) {
      if (this.registry.getClient(def.name)?.getStatus() === 'connected') {
        toolsByMcp.set(def.name, this.registry.getTools(def.name));
        aliasesByMcp.set(def.name, def.aliases);
      }
    }
    this.router.buildRoutes({
      toolsByMcp,
      aliasesByMcp,
      allowConflicts: this.config.morph.allowConflicts,
    });
    this.emit('tools:changed');
  }

  /** Full tool list exposed to the agent (backend + built-ins). */
  getAllTools(): Tool[] {
    return [...this.router.getAllTools(), ...BUILTIN_TOOLS];
  }

  /** Route a tool call, convert the result, and record metrics. */
  async callTool(name: string, args: unknown): Promise<CallToolResult> {
    const promise = this.executeCall(name, args);
    this.inFlight.add(promise);
    try {
      return await promise;
    } finally {
      this.inFlight.delete(promise);
    }
  }

  private async executeCall(name: string, args: unknown): Promise<CallToolResult> {
    if (isBuiltinTool(name)) return this.callBuiltin(name);

    const { mcpName, originalName } = this.router.resolve(name);
    const client = this.registry.getClient(mcpName);
    if (!client) {
      throw new Error(`MCP "${mcpName}" is not available`);
    }

    const started = performance.now();
    let success = true;
    let tokensSaved = 0;
    let savingsPercent = 0;
    try {
      const raw = await client.callTool(originalName, args);
      const conversion = this.converter.convertResult(raw);
      if (conversion.savings) {
        tokensSaved = conversion.savings.originalTokens - conversion.savings.toonTokens;
        savingsPercent = conversion.savings.percent;
      }
      return conversion.result;
    } catch (err) {
      success = false;
      throw err;
    } finally {
      const durationMs = Math.round(performance.now() - started);
      this.metrics.record({ mcpName, toolName: name, durationMs, tokensSaved, success }, savingsPercent);
      this.store.recordCall(mcpName, name, durationMs, tokensSaved);
      const entry = this.logs.append({
        mcpName,
        toolName: name,
        level: success ? 'info' : 'error',
        message: success ? 'tool call succeeded' : 'tool call failed',
        durationMs,
        tokensSaved,
      });
      this.store.appendLog(entry);
      this.emit('tool:called', name, mcpName, durationMs);
    }
  }

  private callBuiltin(name: string): CallToolResult {
    const json = (data: unknown): CallToolResult => ({
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
    });
    switch (name) {
      case BUILTIN_TOOL_NAMES.status:
        return json(this.getStatus());
      case BUILTIN_TOOL_NAMES.toonStats:
        return json(this.metrics.snapshot());
      case BUILTIN_TOOL_NAMES.reloadConfig:
        void this.reloadFromDisk();
        return json({ ok: true, message: 'config reload triggered' });
      default:
        throw new Error(`unknown built-in tool: ${name}`);
    }
  }

  getStatus(): {
    version: string;
    uptimeMs: number;
    mcps: ReturnType<MCPClientRegistry['getStatusSummary']>;
    toolCount: number;
  } {
    return {
      version: getVersionInfo().version,
      uptimeMs: Date.now() - this.startedAt,
      mcps: this.registry.getStatusSummary(),
      toolCount: this.router.getAllTools().length,
    };
  }

  async reloadFromDisk(): Promise<void> {
    const { loadConfig } = await import('./config/loader.js');
    const cfg = await loadConfig(this.configPath);
    await this.applyConfig(cfg);
  }

  /** Persist current config to disk (preserves $schema if present). */
  async saveConfig(): Promise<void> {
    const { saveConfig: persist } = await import('./config/loader.js');
    const schemaRef = (this.config as Record<string, unknown>).$schema as string | undefined;
    await persist(this.configPath, this.config, schemaRef);
  }

  /** Diff old vs new config and apply changes without a full restart. */
  async applyConfig(next: MorphConfig): Promise<void> {
    const prev = this.config;
    this.config = next;
    this.converter.setOptions(next.toon);
    this.health.setConfig(next.health);

    const prevByName = new Map(prev.mcpServers.map((d) => [d.name, d]));
    const nextByName = new Map(next.mcpServers.map((d) => [d.name, d]));

    for (const name of prevByName.keys()) {
      if (!nextByName.has(name)) await this.safe(() => this.registry.remove(name));
    }
    for (const [name, def] of nextByName) {
      if (!prevByName.has(name)) {
        await this.safe(() => this.registry.add(def));
      } else if (changed(prevByName.get(name)!, def)) {
        await this.safe(() => this.registry.update(name, def));
      }
    }
    this.rebuildRouter();
    this.emit('config:reloaded');
    this.logger.info('config hot-reloaded');
  }

  private async safe(fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
    } catch (err) {
      this.logger.error({ err: (err as Error).message }, 'error applying config change');
    }
  }

  async drainInFlightCalls(): Promise<void> {
    await Promise.allSettled([...this.inFlight]);
  }

  async stop(): Promise<void> {
    this.health.stop();
    await this.watcher.stop();
    await this.drainInFlightCalls();
    await this.registry.disconnectAll();
    this.store.close();
  }
}

/** True if a definition change requires reconnecting the client. */
function changed(a: MCPDefinition, b: MCPDefinition): boolean {
  return JSON.stringify(a) !== JSON.stringify(b);
}

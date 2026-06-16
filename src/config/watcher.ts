/**
 * IMPL: watches morph.json and emits validated configs on change (debounced).
 *
 * The watcher only reports *valid* new configs. On a parse/validation failure
 * it emits an `error` and keeps silent about the config so callers can retain
 * the last-known-good one. Diffing/applying changes is the Hub's job.
 */
import { EventEmitter } from 'node:events';
import { resolve as resolvePath } from 'node:path';
import chokidar, { type FSWatcher } from 'chokidar';
import { loadConfig } from './loader.js';
import type { MorphConfig } from './types.js';

export interface ConfigWatcherEvents {
  change: (config: MorphConfig) => void;
  error: (error: Error) => void;
}

export class ConfigWatcher extends EventEmitter {
  private watcher?: FSWatcher;
  private timer?: NodeJS.Timeout;

  constructor(private readonly debounceMs = 300) {
    super();
  }

  private morphPath = '';
  private mcpPath = '';

  /** Watch both the morph.json and .mcp.json files; a change to either reloads. */
  watch(morphPath: string, mcpPath: string): void {
    this.morphPath = resolvePath(morphPath);
    this.mcpPath = resolvePath(mcpPath);
    this.watcher = chokidar.watch([this.morphPath, this.mcpPath], {
      ignoreInitial: true,
      awaitWriteFinish: { stabilityThreshold: 200, pollInterval: 50 },
    });
    this.watcher.on('add', () => this.schedule());
    this.watcher.on('change', () => this.schedule());
    this.watcher.on('unlink', () => this.schedule());
    this.watcher.on('error', (err) => this.emit('error', err as Error));
  }

  private schedule(): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.reload(), this.debounceMs);
  }

  private async reload(): Promise<void> {
    try {
      const config = await loadConfig(this.morphPath, this.mcpPath);
      this.emit('change', config);
    } catch (err) {
      this.emit('error', err as Error);
    }
  }

  async stop(): Promise<void> {
    if (this.timer) clearTimeout(this.timer);
    await this.watcher?.close();
    this.watcher = undefined;
  }
}

export interface ConfigWatcher {
  on<E extends keyof ConfigWatcherEvents>(event: E, listener: ConfigWatcherEvents[E]): this;
  emit<E extends keyof ConfigWatcherEvents>(
    event: E,
    ...args: Parameters<ConfigWatcherEvents[E]>
  ): boolean;
}

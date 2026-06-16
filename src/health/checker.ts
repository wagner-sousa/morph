/**
 * IMPL: periodically pings each connected backend MCP via a cached listTools
 * call, refreshing latency/tool-count and surfacing status changes.
 */
import type { Logger } from "../logging/logger.js";
import type { HealthConfig } from "../config/types.js";
import type { MCPClientRegistry } from "../mcp-client/registry.js";

export class HealthChecker {
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly registry: MCPClientRegistry,
    private config: HealthConfig,
    private readonly logger: Logger,
  ) {}

  start(): void {
    this.stop();
    this.timer = setInterval(() => void this.runOnce(), this.config.intervalMs);
    this.logger.info(
      { intervalMs: this.config.intervalMs },
      "health checker started",
    );
  }

  setConfig(config: HealthConfig): void {
    this.config = config;
    if (this.running) this.start();
  }

  async runOnce(): Promise<void> {
    this.running = true;
    const clients = this.registry.getConnectedClients();
    await Promise.all(
      [...clients.keys()].map(async (name) => {
        try {
          await this.withTimeout(
            this.registry.refreshTools(name),
            this.config.timeoutMs,
          );
        } catch (err) {
          this.logger.warn(
            { mcp: name, err: (err as Error).message },
            "health check failed",
          );
        }
      }),
    );
  }

  private withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => {
          reject(new Error(`health check timed out after ${String(ms)}ms`));
        }, ms),
      ),
    ]);
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.running = false;
  }
}

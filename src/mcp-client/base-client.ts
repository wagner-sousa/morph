/**
 * IMPL: shared MCP client behaviour. The three transports differ only in how
 * they build the SDK transport object, so the lifecycle, retry, tool listing,
 * and tool calling all live here.
 */
import { EventEmitter } from 'node:events';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { CallToolResultSchema } from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from '../logging/logger.js';
import { getVersionInfo } from '../utils/version.js';
import { retry } from '../utils/retry.js';
import type {
  CallToolResult,
  ClientEvent,
  ClientOptions,
  ClientStatus,
  MCPClient,
  Tool,
} from './types.js';

export abstract class BaseMCPClient extends EventEmitter implements MCPClient {
  protected client?: Client;
  protected transport?: Transport;
  private status: ClientStatus = 'disconnected';
  private lastError?: string;
  protected readonly logger: Logger;
  protected readonly maxRetries: number;

  constructor(
    readonly name: string,
    options: ClientOptions,
  ) {
    super();
    this.logger = options.logger.child({ mcp: name });
    this.maxRetries = options.maxRetries ?? 3;
  }

  /** Build the concrete SDK transport (stdio/http/sse). */
  protected abstract createTransport(): Transport;

  async connect(): Promise<void> {
    if (this.status === 'connected') return;
    this.setStatus('connecting');
    const version = getVersionInfo();

    try {
      await retry(
        async () => {
          this.transport = this.createTransport();
          this.client = new Client(
            { name: `morph-proxy/${this.name}`, version: version.version },
            { capabilities: {} },
          );
          this.transport.onclose = () => this.handleClose();
          await this.client.connect(this.transport);
        },
        {
          retries: this.maxRetries,
          onAttempt: (attempt, err, delay) =>
            this.logger.warn(
              { attempt, delay, err: (err as Error).message },
              'connect attempt failed, retrying',
            ),
        },
      );
      this.lastError = undefined;
      this.setStatus('connected');
      this.emit('connected');
      this.logger.info('connected');
    } catch (err) {
      this.lastError = (err as Error).message;
      this.setStatus('error');
      this.emit('error', err);
      throw err;
    }
  }

  private handleClose(): void {
    if (this.status === 'disconnected') return;
    this.setStatus('disconnected');
    this.emit('disconnected');
    this.logger.warn('transport closed');
  }

  async disconnect(): Promise<void> {
    this.setStatus('disconnected');
    try {
      await this.client?.close();
    } catch (err) {
      this.logger.debug({ err: (err as Error).message }, 'error during disconnect');
    } finally {
      this.client = undefined;
      this.transport = undefined;
    }
  }

  async listTools(): Promise<Tool[]> {
    const client = this.requireClient();
    const result = await client.listTools();
    return result.tools;
  }

  async callTool(name: string, args: unknown): Promise<CallToolResult> {
    const client = this.requireClient();
    const result = await client.callTool(
      { name, arguments: (args as Record<string, unknown>) ?? {} },
      CallToolResultSchema,
    );
    return result as CallToolResult;
  }

  getStatus(): ClientStatus {
    return this.status;
  }

  getLastError(): string | undefined {
    return this.lastError;
  }

  override on(event: ClientEvent, handler: (...args: unknown[]) => void): this {
    return super.on(event, handler);
  }

  override off(event: ClientEvent, handler: (...args: unknown[]) => void): this {
    return super.off(event, handler);
  }

  private requireClient(): Client {
    if (!this.client || this.status !== 'connected') {
      throw new Error(`MCP "${this.name}" is not connected (status: ${this.status})`);
    }
    return this.client;
  }

  private setStatus(status: ClientStatus): void {
    this.status = status;
  }
}

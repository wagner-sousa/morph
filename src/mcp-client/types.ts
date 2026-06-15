/**
 * SPEC: the MCPClient contract every transport (stdio/HTTP/SSE) must satisfy.
 */
import type { Tool, CallToolResult } from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from '../logging/logger.js';

export type { Tool, CallToolResult };

export type ClientStatus = 'connected' | 'connecting' | 'disconnected' | 'error';

export type ClientEvent = 'connected' | 'disconnected' | 'error' | 'toolListChanged';

export interface ClientOptions {
  logger: Logger;
  /** Max connection attempts before giving up (default 3). */
  maxRetries?: number;
}

export interface MCPClient {
  readonly name: string;
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  listTools(): Promise<Tool[]>;
  callTool(name: string, args: unknown): Promise<CallToolResult>;
  getStatus(): ClientStatus;
  getLastError(): string | undefined;
  on(event: ClientEvent, handler: (...args: unknown[]) => void): void;
  off(event: ClientEvent, handler: (...args: unknown[]) => void): void;
}

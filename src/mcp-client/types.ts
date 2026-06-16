/**
 * SPEC: the MCPClient contract every transport (stdio/HTTP/SSE) must satisfy.
 */
import type { Tool, CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { OAuthClientProvider } from "@modelcontextprotocol/sdk/client/auth.js";
import type { Logger } from "../logging/logger.js";

export type { Tool, CallToolResult };

export type ClientStatus =
  | "connected"
  | "connecting"
  | "disconnected"
  | "error";

export type ClientEvent =
  | "connected"
  | "disconnected"
  | "error"
  | "toolListChanged";

export interface ClientOptions {
  logger: Logger;
  /** Max connection attempts before giving up (default 3). */
  maxRetries?: number;
  /** OAuth client provider for HTTP transport (used by Streamable HTTP). */
  authProvider?: OAuthClientProvider;
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
  /** Whether OAuth authorization is required (HTTP transport only). */
  needsOAuth?(): boolean;
  /** The authorization URL the user must visit (HTTP OAuth). */
  getAuthorizationUrl?(): string | undefined;
  /** Whether OAuth tokens are already stored. */
  hasOAuthToken?(): boolean;
  /** Complete OAuth with the authorization code (HTTP transport only). */
  finishOAuth?(authorizationCode: string): Promise<void>;
}

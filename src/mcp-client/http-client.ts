/**
 * IMPL: backend MCP client over Streamable HTTP.
 */
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import { auth } from '@modelcontextprotocol/sdk/client/auth.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import type { OAuthClientProvider } from '@modelcontextprotocol/sdk/client/auth.js';
import { BaseMCPClient } from './base-client.js';
import type { ClientOptions } from './types.js';
import type { HttpTransport } from '../config/types.js';

type OAuthProviderExtended = OAuthClientProvider & {
  getAuthorizationUrl?(): string | undefined;
  hasTokens?(): boolean;
};

export class HttpMCPClient extends BaseMCPClient {
  constructor(
    name: string,
    private readonly config: HttpTransport,
    options: ClientOptions,
  ) {
    super(name, options);
  }

  protected createTransport(): Transport {
    const headers: Record<string, string> = { ...(this.config.headers ?? {}) };
    if (this.config.apiKey && !headers.Authorization) {
      headers.Authorization = `Bearer ${this.config.apiKey}`;
    }
    return new StreamableHTTPClientTransport(new URL(this.config.url), {
      requestInit: { headers },
      authProvider: this.authProvider,
    });
  }

  private getHttpTransport(): StreamableHTTPClientTransport | undefined {
    return this.transport instanceof StreamableHTTPClientTransport
      ? this.transport
      : undefined;
  }

  async finishOAuth(authorizationCode: string): Promise<void> {
    const transport = this.getHttpTransport();
    if (!transport) {
      await this.exchangeCode(authorizationCode);
      return;
    }
    await transport.finishAuth(authorizationCode);
  }

  private async exchangeCode(authorizationCode: string): Promise<void> {
    const result = await auth(this.authProvider!, {
      serverUrl: this.config.url,
      authorizationCode,
    });
    if (result !== 'AUTHORIZED') throw new Error('OAuth authorization failed');
  }

  needsOAuth(): boolean {
    if (!this.authProvider) return false;
    const lastError = this.getLastError();
    if (!lastError) return false;
    // OAuth needed when HTTP transport gets a 401 or "Unauthorized" error
    return this.getStatus() === 'error'
      && (lastError.includes('401') || lastError.includes('Unauthorized') || lastError.includes('unauthorized'));
  }

  getAuthorizationUrl(): string | undefined {
    if (!this.authProvider) return undefined;
    return (this.authProvider as OAuthProviderExtended).getAuthorizationUrl?.();
  }

  hasOAuthToken(): boolean {
    if (!this.authProvider) return false;
    return !!(this.authProvider as OAuthProviderExtended).hasTokens?.();
  }
}

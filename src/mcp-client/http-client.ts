/**
 * IMPL: backend MCP client over Streamable HTTP.
 */
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { BaseMCPClient } from './base-client.js';
import type { ClientOptions } from './types.js';
import type { HttpTransport } from '../config/types.js';

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
    });
  }
}

/**
 * IMPL: backend MCP client over SSE (legacy remote transport).
 */
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import { BaseMCPClient } from './base-client.js';
import type { ClientOptions } from './types.js';
import type { SseTransport } from '../config/types.js';

export class SseMCPClient extends BaseMCPClient {
  constructor(
    name: string,
    private readonly config: SseTransport,
    options: ClientOptions,
  ) {
    super(name, options);
  }

  protected createTransport(): Transport {
    const headers = this.config.headers ?? {};
    return new SSEClientTransport(new URL(this.config.url), {
      requestInit: { headers },
      eventSourceInit: {
        // Inject auth headers onto the EventSource fetch as well.
        fetch: (url, init) =>
          fetch(url, { ...init, headers: { ...(init?.headers ?? {}), ...headers } }),
      },
    });
  }
}

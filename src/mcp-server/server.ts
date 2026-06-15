/**
 * IMPL: the MCP server the AI agent connects to.
 *
 * Aggregates all backend tools (plus MORPH built-ins) for `tools/list`, and
 * routes `tools/call` through the Hub (which converts results to TOON).
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import type { Logger } from '../logging/logger.js';
import { getVersionInfo } from '../utils/version.js';
import type { Hub } from '../hub.js';

export class MorphMCPServer {
  private readonly server: Server;
  private transport?: Transport;

  constructor(
    private readonly hub: Hub,
    private readonly logger: Logger,
  ) {
    const version = getVersionInfo();
    this.server = new Server(
      { name: 'morph', version: version.version },
      { capabilities: { tools: { listChanged: true } } },
    );
    this.registerHandlers();

    // Notify the agent when the aggregated tool set changes.
    this.hub.on('tools:changed', () => {
      this.server.sendToolListChanged().catch(() => undefined);
    });
  }

  private registerHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: this.hub.getAllTools(),
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await this.hub.callTool(name, args);
      } catch (err) {
        this.logger.error({ tool: name, err: (err as Error).message }, 'tool call error');
        // Surface as an MCP tool error rather than a protocol error.
        return {
          isError: true,
          content: [{ type: 'text' as const, text: `MORPH error: ${(err as Error).message}` }],
        };
      }
    });
  }

  /** Connect over stdio (default agent transport). */
  async listenStdio(): Promise<void> {
    this.transport = new StdioServerTransport();
    await this.server.connect(this.transport);
    this.logger.info('agent-facing MCP server listening on stdio');
  }

  async connect(transport: Transport): Promise<void> {
    this.transport = transport;
    await this.server.connect(transport);
  }

  async close(): Promise<void> {
    await this.server.close();
  }
}

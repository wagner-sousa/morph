/**
 * IMPL: the MCP server the AI agent connects to.
 *
 * Aggregates all backend tools (plus MORPH built-ins) for `tools/list`, and
 * routes `tools/call` through the Hub (which converts results to TOON).
 */
// MORPH is a proxy/aggregator that registers raw JSON-RPC handlers and serves a
// dynamic, hub-owned tool list — exactly the "advanced use case" the SDK keeps
// the low-level `Server` for. The high-level `McpServer` manages tools
// individually and does not fit this pattern, hence the `no-deprecated`
// disables on the `Server` usages below.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import type { Logger } from "../logging/logger.js";
import { getVersionInfo } from "../utils/version.js";
import type { Hub } from "../hub.js";

const SUPPORTED_PROTOCOL_VERSIONS = [
  "2025-11-25",
  "2025-06-18",
  "2025-03-26",
  "2024-11-05",
  "2024-10-07",
];
const LATEST_PROTOCOL_VERSION = "2025-11-25";

export class MorphMCPServer {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private readonly servers: Server[] = [];

  constructor(
    private readonly hub: Hub,
    private readonly logger: Logger,
  ) {
    this.servers.push(this.createServer());
  }

  // eslint-disable-next-line @typescript-eslint/no-deprecated
  private createServer(): Server {
    const version = getVersionInfo();
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const server = new Server(
      { name: "morph", version: version.version },
      { capabilities: { tools: { listChanged: true } } },
    );

    server.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: this.hub.getAllTools(),
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      try {
        return await this.hub.callTool(name, args);
      } catch (err) {
        this.logger.error(
          { tool: name, err: (err as Error).message },
          "tool call error",
        );
        return {
          isError: true,
          content: [
            {
              type: "text" as const,
              text: `MORPH error: ${(err as Error).message}`,
            },
          ],
        };
      }
    });

    this.hub.on("tools:changed", () => {
      server.sendToolListChanged().catch(() => undefined);
    });

    return server;
  }

  async listenStdio(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.servers[0].connect(transport);
    this.logger.info("agent-facing MCP server listening on stdio");
  }

  createDirectHandler(): (
    body: unknown,
  ) => Promise<{ status: number; body: string }> {
    return async (body: unknown) => {
      try {
        if (!body || typeof body !== "object") {
          return {
            status: 400,
            body: JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32700, message: "Parse error" },
              id: null,
            }),
          };
        }
        const msg = body as Record<string, unknown>;
        if (msg.jsonrpc !== "2.0") {
          return {
            status: 400,
            body: JSON.stringify({
              jsonrpc: "2.0",
              error: { code: -32600, message: "Invalid Request" },
              id: msg.id ?? null,
            }),
          };
        }

        if (msg.method === "initialize") {
          const version = getVersionInfo();
          const params = msg.params as Record<string, unknown> | undefined;
          const requestedVersion =
            typeof params?.protocolVersion === "string"
              ? params.protocolVersion
              : "";
          const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(
            requestedVersion,
          )
            ? requestedVersion
            : LATEST_PROTOCOL_VERSION;
          return {
            status: 200,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                protocolVersion,
                capabilities: { tools: { listChanged: true } },
                serverInfo: { name: "morph", version: version.version },
              },
            }),
          };
        }

        if (
          typeof msg.method === "string" &&
          msg.method.startsWith("notifications/")
        ) {
          return { status: 202, body: "" };
        }

        if (msg.method === "tools/list") {
          return {
            status: 200,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: { tools: this.hub.getAllTools() },
            }),
          };
        }

        if (msg.method === "tools/call") {
          const params = msg.params as
            | { name?: string; arguments?: Record<string, unknown> }
            | undefined;
          if (!params?.name) {
            return {
              status: 400,
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                error: {
                  code: -32602,
                  message: "Invalid params: name is required",
                },
              }),
            };
          }
          try {
            const result = await this.hub.callTool(
              params.name,
              params.arguments,
            );
            return {
              status: 200,
              body: JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }),
            };
          } catch (err) {
            this.logger.error(
              { tool: params.name, err: (err as Error).message },
              "tool call error",
            );
            return {
              status: 200,
              body: JSON.stringify({
                jsonrpc: "2.0",
                id: msg.id,
                result: {
                  isError: true,
                  content: [
                    {
                      type: "text",
                      text: `MORPH error: ${(err as Error).message}`,
                    },
                  ],
                },
              }),
            };
          }
        }

        return {
          status: 400,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id ?? null,
            error: {
              code: -32601,
              message: `Method not found: ${String(msg.method)}`,
            },
          }),
        };
      } catch (err) {
        return {
          status: 500,
          body: JSON.stringify({
            jsonrpc: "2.0",
            error: {
              code: -32603,
              message: `Internal error: ${(err as Error).message}`,
            },
            id: null,
          }),
        };
      }
    };
  }

  async close(): Promise<void> {
    await Promise.all(this.servers.map((s) => s.close()));
  }

  /** Create a JSON-RPC handler scoped to a single backend MCP's tools. */
  createPerMcpDirectHandler(
    mcpName: string,
  ): (body: unknown) => Promise<{ status: number; body: string }> {
    return async (body: unknown) => {
      if (!body || typeof body !== "object") {
        return {
          status: 400,
          body: JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32700, message: "Parse error" },
            id: null,
          }),
        };
      }
      const msg = body as Record<string, unknown>;
      if (msg.jsonrpc !== "2.0") {
        return {
          status: 400,
          body: JSON.stringify({
            jsonrpc: "2.0",
            error: { code: -32600, message: "Invalid Request" },
            id: msg.id ?? null,
          }),
        };
      }
      if (msg.method === "initialize") {
        const version = getVersionInfo();
        return {
          status: 200,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: {
              protocolVersion: LATEST_PROTOCOL_VERSION,
              capabilities: { tools: { listChanged: true } },
              serverInfo: {
                name: `morph-${mcpName}`,
                version: version.version,
              },
            },
          }),
        };
      }
      if (
        typeof msg.method === "string" &&
        msg.method.startsWith("notifications/")
      ) {
        return { status: 202, body: "" };
      }
      if (msg.method === "tools/list") {
        const tools = this.hub.registry.getTools(mcpName);
        return {
          status: 200,
          body: JSON.stringify({
            jsonrpc: "2.0",
            id: msg.id,
            result: { tools },
          }),
        };
      }
      if (msg.method === "tools/call") {
        const params = msg.params as
          | { name?: string; arguments?: Record<string, unknown> }
          | undefined;
        if (!params?.name) {
          return {
            status: 400,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              error: {
                code: -32602,
                message: "Invalid params: name is required",
              },
            }),
          };
        }
        try {
          const result = await this.hub.callTool(params.name, params.arguments);
          return {
            status: 200,
            body: JSON.stringify({ jsonrpc: "2.0", id: msg.id, result }),
          };
        } catch (err) {
          return {
            status: 200,
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: msg.id,
              result: {
                isError: true,
                content: [
                  {
                    type: "text",
                    text: `MORPH error: ${(err as Error).message}`,
                  },
                ],
              },
            }),
          };
        }
      }
      return {
        status: 400,
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: msg.id ?? null,
          error: {
            code: -32601,
            message: `Method not found: ${String(msg.method)}`,
          },
        }),
      };
    };
  }
}

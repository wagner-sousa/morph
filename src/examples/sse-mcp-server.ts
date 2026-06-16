#!/usr/bin/env node
import http from "node:http";
import { URL } from "node:url";
// Example server intentionally demonstrates the legacy SSE transport and the
// low-level `Server` API; the `no-deprecated` disables below are deliberate.
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.env.SSE_MCP_PORT ?? 3201);

// eslint-disable-next-line @typescript-eslint/no-deprecated
const transports = new Map<string, SSEServerTransport>();

function createMcpServer(name: string) {
  // eslint-disable-next-line @typescript-eslint/no-deprecated
  const server = new Server(
    { name, version: "1.0.0" },
    { capabilities: { tools: {} } },
  );

  server.setRequestHandler(ListToolsRequestSchema, () => ({
    tools: [
      {
        name: "ping",
        description: "Health check — returns pong",
        inputSchema: { type: "object", properties: {} },
      },
      {
        name: "users",
        description:
          "Return a list of demo users (uniform array — ideal for TOON)",
        inputSchema: {
          type: "object",
          properties: {
            count: {
              type: "number",
              description: "How many users (default 25)",
            },
          },
        },
      },
      {
        name: "echo",
        description: "Echo back the given arguments",
        inputSchema: { type: "object", properties: {} },
      },
    ],
  }));

  server.setRequestHandler(CallToolRequestSchema, (req) => {
    const { name: tool, arguments: args } = req.params;
    switch (tool) {
      case "ping":
        return { content: [{ type: "text", text: "pong" }] };
      case "echo":
        return {
          content: [{ type: "text", text: JSON.stringify(args ?? {}) }],
        };
      case "users": {
        const count = Math.max(
          1,
          Math.min(500, (args as { count?: number } | undefined)?.count ?? 25),
        );
        const roles = ["admin", "editor", "viewer"];
        const users = Array.from({ length: count }, (_, i) => ({
          id: i + 1,
          name: `User ${String(i + 1)}`,
          email: `user${String(i + 1)}@example.com`,
          role: roles[i % roles.length],
          active: i % 4 !== 0,
        }));
        return { content: [{ type: "text", text: JSON.stringify(users) }] };
      }
      default:
        return {
          isError: true,
          content: [{ type: "text", text: `unknown tool ${name}` }],
        };
    }
  });

  return server;
}

const app = http.createServer((req, res) => {
  void handleRequest(req, res);
});

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const url = new URL(
    req.url ?? "/",
    `http://${req.headers.host ?? "localhost"}`,
  );

  if (req.method === "GET" && url.pathname === "/sse") {
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const transport = new SSEServerTransport("/mcp", res);
    transports.set(transport.sessionId, transport);
    res.on("close", () => transports.delete(transport.sessionId));
    const mcpServer = createMcpServer("demo-sse");
    await mcpServer.connect(transport);
    return;
  }

  if (req.method === "POST" && url.pathname === "/mcp") {
    const sessionId = url.searchParams.get("sessionId") ?? "";
    const transport = transports.get(sessionId);
    if (!transport) {
      res.writeHead(404).end("SSE connection not found");
      return;
    }
    const buffers: Buffer[] = [];
    for await (const chunk of req) buffers.push(chunk as Buffer);
    const body: unknown = JSON.parse(Buffer.concat(buffers).toString());
    await transport.handlePostMessage(req, res, body);
    return;
  }

  res.writeHead(404).end("Not Found");
}

app.listen(PORT, () => {
  console.error(`SSE MCP server listening on port ${String(PORT)}`);
});

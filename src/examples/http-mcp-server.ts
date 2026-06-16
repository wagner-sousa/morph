#!/usr/bin/env node
import http from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";

const PORT = Number(process.env.HTTP_MCP_PORT ?? 3200);

const toolDefs = [
  {
    name: "ping",
    description: "Health check — returns pong",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "users",
    description: "Return a list of demo users (uniform array — ideal for TOON)",
    inputSchema: {
      type: "object",
      properties: {
        count: { type: "number", description: "How many users (default 25)" },
      },
    },
  },
  {
    name: "echo",
    description: "Echo back the given arguments",
    inputSchema: { type: "object", properties: {} },
  },
];

function callTool(tool: string, args: Record<string, unknown>) {
  switch (tool) {
    case "ping":
      return { content: [{ type: "text", text: "pong" }] };
    case "echo":
      return { content: [{ type: "text", text: JSON.stringify(args) }] };
    case "users": {
      const count = Math.max(
        1,
        Math.min(500, (args as { count?: number }).count ?? 25),
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
        content: [{ type: "text", text: `unknown tool ${tool}` }],
      };
  }
}

const app = http.createServer((req, res) => {
  void handleRequest(req, res);
});

async function handleRequest(
  req: http.IncomingMessage,
  res: http.ServerResponse,
): Promise<void> {
  const path = (req.url ?? "").split("?")[0];
  if (path !== "/mcp") {
    res.writeHead(405).end("Method Not Allowed");
    return;
  }
  try {
    const buffers: Buffer[] = [];
    if (req.method === "POST") {
      for await (const chunk of req) buffers.push(chunk as Buffer);
    }
    const body: unknown =
      buffers.length > 0
        ? JSON.parse(Buffer.concat(buffers).toString())
        : undefined;

    // Example server uses the low-level `Server` API on purpose.
    // eslint-disable-next-line @typescript-eslint/no-deprecated
    const srv = new Server(
      { name: "demo-http", version: "1.0.0" },
      { capabilities: { tools: {} } },
    );
    srv.setRequestHandler(ListToolsRequestSchema, () => ({
      tools: toolDefs,
    }));
    srv.setRequestHandler(CallToolRequestSchema, (r) => {
      const { name, arguments: args } = r.params;
      return callTool(name, args ?? {});
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await srv.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error("HTTP MCP server error:", err);
    if (!res.headersSent) res.writeHead(500).end("Internal Server Error");
  }
}

app.listen(PORT, () => {
  console.error(`HTTP MCP server listening on port ${String(PORT)}`);
});

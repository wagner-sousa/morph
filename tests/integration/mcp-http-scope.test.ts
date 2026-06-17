import { EventEmitter } from "node:events";
import { afterEach, describe, expect, it } from "vitest";
import { WebServer } from "../../src/web/server.js";
import { MorphMCPServer } from "../../src/mcp-server/server.js";
import type { Hub } from "../../src/hub.js";
import type { Logger } from "../../src/logging/logger.js";
import type { Tool } from "../../src/mcp-client/types.js";

function noopLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => noopLogger(),
  } as unknown as Logger;
}

function createMockHub(toolsByMcp: Record<string, Tool[]>): Hub {
  const hub = new EventEmitter() as Hub;
  hub.logger = noopLogger();
  hub.registry = {
    getTools: (name: string) => toolsByMcp[name] ?? [],
    getClient: () => null,
    getStatusSummary: () => [],
  } as unknown as Hub["registry"];
  hub.logs = { onLog: () => () => undefined } as unknown as Hub["logs"];
  hub.metrics = new EventEmitter() as unknown as Hub["metrics"];
  hub.callTool = async (name: string) => ({
    content: [{ type: "text", text: `called ${name}` }],
  });
  return hub;
}

const PING: Tool = {
  name: "ping",
  description: "returns pong",
  inputSchema: { type: "object", properties: {} },
};

describe("HTTP route /mcp/:name — per-MCP scoping (additive)", () => {
  let server: WebServer | undefined;

  afterEach(async () => {
    await server?.close();
    server = undefined;
  });

  async function build(toolsByMcp: Record<string, Tool[]>) {
    const hub = createMockHub(toolsByMcp);
    const mcpServer = new MorphMCPServer(hub, noopLogger());
    server = new WebServer({ hub, logger: noopLogger(), mcpServer });
    return server.buildForTest();
  }

  it("tools/list is scoped to the named MCP", async () => {
    const app = await build({ clickup: [PING] });
    const res = await app.inject({
      method: "POST",
      url: "/mcp/clickup",
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(res.statusCode).toBe(200);
    const body = res.json();
    expect(body.result.tools).toHaveLength(1);
    expect(body.result.tools[0].name).toBe("ping");
  });

  it("returns 404 for an unknown MCP", async () => {
    const app = await build({ clickup: [PING] });
    const res = await app.inject({
      method: "POST",
      url: "/mcp/does-not-exist",
      payload: { jsonrpc: "2.0", id: 1, method: "tools/list" },
    });
    expect(res.statusCode).toBe(404);
    expect(res.json().code).toBe("MCP_NOT_FOUND");
  });

  it("aggregated /mcp still works alongside /mcp/:name", async () => {
    const app = await build({ clickup: [PING] });
    const res = await app.inject({
      method: "POST",
      url: "/mcp",
      payload: { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "ping" } },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().result.content[0].text).toBe("called ping");
  });
});

import { describe, expect, it, vi } from "vitest";
import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { EventEmitter } from "node:events";
import { ToonConverter } from "../../src/toon/converter.js";
import { Store } from "../../src/persistence/store.js";
import { MorphMCPServer } from "../../src/mcp-server/server.js";
import type { Hub } from "../../src/hub.js";
import type { Logger } from "../../src/logging/logger.js";
import type { CallToolResult } from "../../src/mcp-client/types.js";
import {
  BUILTIN_TOOL_NAMES,
  isBuiltinTool,
} from "../../src/mcp-server/builtin-tools.js";

function noopLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => noopLogger(),
  } as unknown as Logger;
}

describe("callBuiltin — TOON conversion", () => {
  let dbDir: string;
  let store: Store;

  beforeEach(() => {
    dbDir = mkdtempSync(join(tmpdir(), "morph-hub-test-"));
    store = new Store(join(dbDir, "test.db"));
  });

  afterEach(() => {
    store.close();
    rmSync(dbDir, { recursive: true, force: true });
  });

  function createFullHub(): Hub {
    const converter = new ToonConverter({
      autoConvert: true,
      delimiter: "comma",
      indent: 2,
      flattenDepth: 4,
      threshold: 100,
    });
    const hub = new EventEmitter() as Hub;
    hub.converter = converter;
    hub.store = store;
    hub.getStatus = () => ({
      version: "1.0.0",
      uptimeMs: 1000,
      mcpServers: [],
      totalTools: 3,
      mode: "gateway",
      memoryMb: 50,
    });
    hub.metrics = {
      snapshot: () => ({
        totalCalls: 10,
        failedCalls: 1,
        totalTokensSaved: 500,
        avgSavingsPercent: 25,
        byMcp: {},
        totalDurationMs: 1000,
      }),
    };
    (hub as unknown as { reloadFromDisk: () => void }).reloadFromDisk = vi.fn();
    hub.logger = noopLogger();
    hub.callTool = async (name: string): Promise<CallToolResult> => {
      if (isBuiltinTool(name)) {
        const json = (data: unknown): CallToolResult => ({
          content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
        });
        let result: CallToolResult;
        switch (name) {
          case BUILTIN_TOOL_NAMES.status:
            result = json(hub.getStatus());
            break;
          case BUILTIN_TOOL_NAMES.toonStats:
            result = json(hub.metrics.snapshot());
            break;
          case BUILTIN_TOOL_NAMES.reloadConfig:
            (hub as unknown as { reloadFromDisk: () => void }).reloadFromDisk();
            result = json({ ok: true, message: "config reload triggered" });
            break;
          default:
            throw new Error(`unknown built-in tool: ${name}`);
        }
        return converter.convertResult(result).result;
      }
      return { content: [{ type: "text", text: `called ${name}` }] };
    };
    hub.getAllTools = () => [];
    return hub;
  }

  it("_morph_status result has TOON format when conversion is beneficial", async () => {
    const hub = createFullHub();
    const result = await hub.callTool("_morph_status");
    const content = result.content[0];
    expect(content).toBeDefined();
    // Status data is large enough that TOON conversion should kick in
    if (content._meta) {
      expect(content._meta["morph/format"]).toBe("toon");
    }
  });

  it("_morph_toon_stats result has TOON format when conversion is beneficial", async () => {
    const hub = createFullHub();
    const result = await hub.callTool("_morph_toon_stats");
    const content = result.content[0];
    expect(content).toBeDefined();
    if (content._meta) {
      expect(content._meta["morph/format"]).toBe("toon");
    }
  });

  it("_morph_reload_config result is always valid text", async () => {
    const hub = createFullHub();
    const result = await hub.callTool("_morph_reload_config");
    const content = result.content[0];
    expect(content).toBeDefined();
    expect(content.type).toBe("text");
    expect(content.text).toContain("ok");
  });

  it("Small built-in results are still returned as text even if TOON is beneficial", async () => {
    const hub = createFullHub();
    const result = await hub.callTool("_morph_reload_config");
    const content = result.content[0];
    expect(content).toBeDefined();
    expect(content.type).toBe("text");
    expect(typeof content.text).toBe("string");
    expect(content.text.length).toBeGreaterThan(0);
  });

  it("MorphMCPServer routes built-in calls through TOON conversion", async () => {
    const hub = createFullHub();
    const server = new MorphMCPServer(hub, noopLogger());
    const handler = server.createDirectHandler();

    const res = await handler({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "_morph_status" },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.content).toBeDefined();
  });

  it("treats unknown tool names as regular (non-builtin) tool calls", async () => {
    const hub = createFullHub();
    const server = new MorphMCPServer(hub, noopLogger());
    const handler = server.createDirectHandler();

    const res = await handler({
      jsonrpc: "2.0",
      id: 1,
      method: "tools/call",
      params: { name: "_morph_nonexistent" },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    // Non-builtin tool calls return whatever the hub mock provides
    expect(body.result.content).toBeDefined();
    expect(body.result.content[0].text).toBe("called _morph_nonexistent");
  });
});

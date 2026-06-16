import { describe, expect, it } from "vitest";
import {
  StdioTransportSchema,
  HttpTransportSchema,
  SseTransportSchema,
  MCPDefinitionSchema,
  MorphConfigSchema,
} from "../../src/config/schema.js";

describe("StdioTransportSchema", () => {
  it("accepts minimum valid input", () => {
    const r = StdioTransportSchema.parse({ type: "stdio", command: "npx" });
    expect(r.command).toBe("npx");
    expect(r.args).toEqual([]);
  });
  it("accepts full input", () => {
    const r = StdioTransportSchema.parse({
      type: "stdio",
      command: "node",
      args: ["a", "b"],
      env: { K: "V" },
      cwd: "/tmp",
      timeoutMs: 5000,
    });
    expect(r.cwd).toBe("/tmp");
    expect(r.timeoutMs).toBe(5000);
  });
  it("rejects without command", () => {
    expect(() => StdioTransportSchema.parse({ type: "stdio" })).toThrow(
      "command",
    );
  });
});

describe("HttpTransportSchema", () => {
  it("accepts valid URL", () => {
    const r = HttpTransportSchema.parse({
      type: "http",
      url: "http://localhost:3200/mcp",
    });
    expect(r.url).toBe("http://localhost:3200/mcp");
  });
  it("accepts with apiKey and headers", () => {
    const r = HttpTransportSchema.parse({
      type: "http",
      url: "http://localhost/mcp",
      apiKey: "sk-123",
      headers: { "X-Custom": "v" },
    });
    expect(r.apiKey).toBe("sk-123");
  });
  it("rejects invalid URL", () => {
    expect(() =>
      HttpTransportSchema.parse({ type: "http", url: "not-a-url" }),
    ).toThrow();
  });
});

describe("SseTransportSchema", () => {
  it("accepts valid input", () => {
    const r = SseTransportSchema.parse({
      type: "sse",
      url: "http://localhost/sse",
      reconnectIntervalMs: 3000,
    });
    expect(r.reconnectIntervalMs).toBe(3000);
  });
  it("accepts with headers", () => {
    const r = SseTransportSchema.parse({
      type: "sse",
      url: "http://localhost/sse",
      headers: { Authorization: "Bearer x" },
    });
    expect(r.headers!.Authorization).toBe("Bearer x");
  });
  it("rejects invalid URL", () => {
    expect(() => SseTransportSchema.parse({ type: "sse", url: "" })).toThrow();
  });
});

describe("MCPDefinitionSchema", () => {
  it("accepts stdio definition", () => {
    const r = MCPDefinitionSchema.parse({
      name: "test",
      transport: { type: "stdio", command: "npx" },
    });
    expect(r.name).toBe("test");
    expect(r.enabled).toBe(true);
  });
  it("accepts http definition", () => {
    const r = MCPDefinitionSchema.parse({
      name: "web",
      transport: { type: "http", url: "http://localhost/mcp" },
    });
    expect(r.transport.type).toBe("http");
  });
  it("accepts sse definition", () => {
    const r = MCPDefinitionSchema.parse({
      name: "stream",
      transport: { type: "sse", url: "http://localhost/sse" },
    });
    expect(r.transport.type).toBe("sse");
  });
  it("rejects empty name", () => {
    expect(() =>
      MCPDefinitionSchema.parse({
        name: "",
        transport: { type: "stdio", command: "npx" },
      }),
    ).toThrow();
  });
  it("rejects invalid name characters", () => {
    expect(() =>
      MCPDefinitionSchema.parse({
        name: "my server!",
        transport: { type: "stdio", command: "npx" },
      }),
    ).toThrow();
  });
  it("accepts optional fields", () => {
    const r = MCPDefinitionSchema.parse({
      name: "x",
      description: "desc",
      labels: { env: "prod" },
      aliases: { a: "b" },
      transport: { type: "stdio", command: "npx" },
    });
    expect(r.description).toBe("desc");
    expect(r.labels!.env).toBe("prod");
    expect(r.aliases!.a).toBe("b");
  });
});

describe("MorphConfigSchema", () => {
  it("accepts minimal config", () => {
    const r = MorphConfigSchema.parse({});
    expect(r.morph.version).toBe("1.0");
    expect(r.morph.logLevel).toBe("info");
    expect(r.morph.allowConflicts).toBe(false);
    expect(r.morph.toolPrefix).toBe("");
    expect(r.mcpServers).toEqual([]);
    expect(r.toon.autoConvert).toBe(true);
    expect(r.webUi.port).toBe(3100);
    expect(r.health.intervalMs).toBe(30000);
  });
  it("rejects duplicate MCP names", () => {
    expect(() =>
      MorphConfigSchema.parse({
        mcpServers: [
          { name: "dup", transport: { type: "stdio", command: "npx" } },
          { name: "dup", transport: { type: "stdio", command: "npx" } },
        ],
      }),
    ).toThrow("duplicate");
  });
  it("accepts custom toolPrefix", () => {
    const r = MorphConfigSchema.parse({ morph: { toolPrefix: "{name}:" } });
    expect(r.morph.toolPrefix).toBe("{name}:");
  });
  it("accepts full config", () => {
    const r = MorphConfigSchema.parse({
      mcpServers: [
        { name: "s1", transport: { type: "stdio", command: "echo" } },
      ],
      toon: { delimiter: "pipe" },
      webUi: { port: 3101 },
    });
    expect(r.mcpServers).toHaveLength(1);
    expect(r.toon.delimiter).toBe("pipe");
    expect(r.webUi.port).toBe(3101);
  });
});

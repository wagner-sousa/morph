import { describe, expect, it } from "vitest";
import {
  MCPDefinitionSchema,
  MorphConfigSchema,
  StdioTransportSchema,
  HttpTransportSchema,
  SseTransportSchema,
} from "../../src/config/schema.js";

describe("POST /api/mcps — schema validation (contract tests)", () => {
  it("accepts a valid stdio definition", () => {
    const payload = {
      name: "my-server",
      enabled: true,
      transport: {
        type: "stdio",
        command: "npx",
        args: ["-y", "some-package"],
      },
    };
    const parsed = MCPDefinitionSchema.parse(payload);
    expect(parsed.name).toBe("my-server");
    expect(parsed.transport).toEqual({
      type: "stdio",
      command: "npx",
      args: ["-y", "some-package"],
    });
  });

  it("accepts a valid http definition", () => {
    const payload = {
      name: "web-api",
      enabled: true,
      transport: { type: "http", url: "http://localhost:8000/mcp" },
    };
    const parsed = MCPDefinitionSchema.parse(payload);
    expect(parsed.transport).toEqual({
      type: "http",
      url: "http://localhost:8000/mcp",
    });
  });

  it("accepts a valid sse definition", () => {
    const payload = {
      name: "stream-api",
      enabled: true,
      transport: { type: "sse", url: "http://localhost:8000/events" },
    };
    const parsed = MCPDefinitionSchema.parse(payload);
    expect(parsed.transport).toEqual({
      type: "sse",
      url: "http://localhost:8000/events",
    });
  });

  it("reacts transport as plain string (the bug!)", () => {
    const payload = {
      name: "broken",
      enabled: true,
      transport: "http",
    };
    // @ts-expect-error — omitting type guard tests that the schema rejects string transport
    const fn = () => MCPDefinitionSchema.parse(payload);
    expect(fn).toThrow("Expected object, received string");
  });

  it("requetes command for stdio transport", () => {
    const payload = {
      name: "no-command",
      enabled: true,
      transport: { type: "stdio" },
    };
    const fn = () => MCPDefinitionSchema.parse(payload);
    expect(fn).toThrow("command");
  });

  it("requetes url for http transport", () => {
    const payload = {
      name: "no-url",
      enabled: true,
      transport: { type: "http" },
    };
    const fn = () => MCPDefinitionSchema.parse(payload);
    expect(fn).toThrow("url");
  });

  it("requetes url for sse transport", () => {
    const payload = {
      name: "no-url-sse",
      enabled: true,
      transport: { type: "sse" },
    };
    const fn = () => MCPDefinitionSchema.parse(payload);
    expect(fn).toThrow("url");
  });

  it("rejects empty name", () => {
    const payload = {
      name: "",
      enabled: true,
      transport: { type: "stdio", command: "npx" },
    };
    const fn = () => MCPDefinitionSchema.parse(payload);
    expect(fn).toThrow();
  });

  it("rejects invalid name characters", () => {
    const payload = {
      name: "my server!",
      enabled: true,
      transport: { type: "stdio", command: "npx" },
    };
    const fn = () => MCPDefinitionSchema.parse(payload);
    expect(fn).toThrow();
  });

  it("rejects duplicate names via superRefine", () => {
    const cfg = {
      mcpServers: [
        {
          name: "dup",
          enabled: true,
          transport: { type: "stdio", command: "npx" },
        },
        {
          name: "dup",
          enabled: true,
          transport: { type: "stdio", command: "npx" },
        },
      ],
    };
    const fn = () => MorphConfigSchema.parse(cfg);
    expect(fn).toThrow("duplicate");
  });

  it("applies defaults for optional fields", () => {
    const payload = {
      name: "minimal",
      transport: { type: "stdio", command: "npx" },
    };
    const parsed = MCPDefinitionSchema.parse(payload);
    expect(parsed.enabled).toBe(true);
    expect(parsed.transport).toHaveProperty("args");
    expect(parsed.transport.args).toEqual([]);
  });

  it("accepts stdio transport with all optional fields", () => {
    const payload = StdioTransportSchema.parse({
      type: "stdio",
      command: "npx",
      args: ["-y", "pkg"],
      env: { KEY: "val" },
      cwd: "/tmp",
      timeoutMs: 30000,
    });
    expect(payload.timeoutMs).toBe(30000);
  });

  it("accepts http transport with headers and apiKey", () => {
    const payload = HttpTransportSchema.parse({
      type: "http",
      url: "http://api.example.com/mcp",
      headers: { Authorization: "Bearer token" },
      apiKey: "sk-123",
    });
    expect(payload.apiKey).toBe("sk-123");
  });

  it("accepts sse transport with reconnect interval", () => {
    const payload = SseTransportSchema.parse({
      type: "sse",
      url: "http://api.example.com/events",
      reconnectIntervalMs: 5000,
    });
    expect(payload.reconnectIntervalMs).toBe(5000);
  });
});

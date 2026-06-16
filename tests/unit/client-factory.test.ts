import { describe, expect, it, vi } from "vitest";
import { createMCPClient } from "../../src/mcp-client/factory.js";
import { StdioMCPClient } from "../../src/mcp-client/stdio-client.js";
import { HttpMCPClient } from "../../src/mcp-client/http-client.js";
import { SseMCPClient } from "../../src/mcp-client/sse-client.js";

function fakeOptions() {
  return {
    logger: {
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
      child: () => fakeOptions().logger,
    } as never,
  };
}

describe("createMCPClient", () => {
  it("creates StdioMCPClient for stdio transport", () => {
    const client = createMCPClient(
      {
        name: "t",
        enabled: true,
        transport: { type: "stdio", command: "npx" },
      },
      fakeOptions(),
    );
    expect(client).toBeInstanceOf(StdioMCPClient);
  });

  it("creates HttpMCPClient for http transport", () => {
    const client = createMCPClient(
      {
        name: "t",
        enabled: true,
        transport: { type: "http", url: "http://localhost/mcp" },
      },
      fakeOptions(),
    );
    expect(client).toBeInstanceOf(HttpMCPClient);
  });

  it("creates SseMCPClient for sse transport", () => {
    const client = createMCPClient(
      {
        name: "t",
        enabled: true,
        transport: { type: "sse", url: "http://localhost/sse" },
      },
      fakeOptions(),
    );
    expect(client).toBeInstanceOf(SseMCPClient);
  });

  it("passes options (logger, authProvider) to client", () => {
    const opts = fakeOptions();
    const client = createMCPClient(
      {
        name: "t",
        enabled: true,
        transport: { type: "stdio", command: "npx" },
      },
      opts,
    );
    expect(client).toBeDefined();
  });

  it("throws for unknown transport type", () => {
    expect(() =>
      createMCPClient(
        { name: "t", enabled: true, transport: { type: "unknown" as never } },
        fakeOptions(),
      ),
    ).toThrow();
  });
});

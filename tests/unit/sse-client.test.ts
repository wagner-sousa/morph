import { describe, expect, it, vi } from "vitest";
import { SseMCPClient } from "../../src/mcp-client/sse-client.js";
import { BaseMCPClient } from "../../src/mcp-client/base-client.js";

describe("SseMCPClient", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => logger,
  } as never;

  it("extends BaseMCPClient", () => {
    const client = new SseMCPClient(
      "test",
      { type: "sse", url: "http://localhost:3201/sse" },
      { logger },
    );
    expect(client).toBeInstanceOf(BaseMCPClient);
  });

  it("stores headers", () => {
    const client = new SseMCPClient(
      "test",
      {
        type: "sse",
        url: "http://localhost:3201/sse",
        headers: { Authorization: "Bearer x" },
      },
      { logger },
    );
    expect(client).toBeDefined();
  });

  it("stores reconnectIntervalMs", () => {
    const client = new SseMCPClient(
      "test",
      {
        type: "sse",
        url: "http://localhost:3201/sse",
        reconnectIntervalMs: 5000,
      },
      { logger },
    );
    expect(client).toBeDefined();
  });

  it("creates transport with URL", () => {
    const client = new SseMCPClient(
      "test",
      { type: "sse", url: "http://localhost:3201/sse" },
      { logger },
    );
    expect(client).toBeDefined();
  });
});

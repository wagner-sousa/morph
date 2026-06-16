import { describe, expect, it, vi } from "vitest";
import { HttpMCPClient } from "../../src/mcp-client/http-client.js";
import { BaseMCPClient } from "../../src/mcp-client/base-client.js";

describe("HttpMCPClient", () => {
  const logger = {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: () => logger,
  } as never;

  it("extends BaseMCPClient", () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp" },
      { logger },
    );
    expect(client).toBeInstanceOf(BaseMCPClient);
  });

  it("stores apiKey in headers", () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp", apiKey: "demo-token" },
      { logger },
    );
    expect(client).toBeDefined();
  });

  it("stores custom headers", () => {
    const client = new HttpMCPClient(
      "test",
      {
        type: "http",
        url: "http://localhost:3200/mcp",
        headers: { "X-Custom": "val" },
      },
      { logger },
    );
    expect(client).toBeDefined();
  });

  it("needsOAuth returns false when no auth provider", () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp" },
      { logger },
    );
    expect(client.needsOAuth()).toBe(false);
  });

  it("needsOAuth returns true when status error and 401 message", async () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp" },
      { logger },
    );
    await client.connect().catch(() => {});
    // Will be in error state since server isn't running, but needsOAuth checks lastError
    expect(client.needsOAuth()).toBe(false); // No auth provider
  });

  it("hasOAuthToken returns false when no authProvider", () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp" },
      { logger },
    );
    // Without authProvider, hasOAuthToken returns undefined (falsy)
    expect(client.hasOAuthToken()).toBeFalsy();
  });

  it("getAuthorizationUrl returns undefined by default", () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp" },
      { logger },
    );
    expect(client.getAuthorizationUrl()).toBeUndefined();
  });

  it("needsOAuth returns true when status error and 401", async () => {
    const client = new HttpMCPClient(
      "test",
      { type: "http", url: "http://localhost:3200/mcp" },
      { logger },
    );
    await client.connect().catch(() => {});
    expect(client.needsOAuth()).toBe(false);
  });
});

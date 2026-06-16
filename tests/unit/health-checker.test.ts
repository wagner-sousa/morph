import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { HealthChecker } from "../../src/health/checker.js";
import { createLogger } from "../../src/logging/logger.js";
import type { MCPClientRegistry } from "../../src/mcp-client/registry.js";

const logger = createLogger("error", false);

function mockRegistry(): MCPClientRegistry {
  return {
    getConnectedClients: vi.fn().mockReturnValue(new Map()),
    refreshTools: vi.fn().mockResolvedValue([]),
  } as unknown as MCPClientRegistry;
}

describe("HealthChecker", () => {
  let registry: MCPClientRegistry;
  let checker: HealthChecker;

  beforeEach(() => {
    registry = mockRegistry();
    checker = new HealthChecker(
      registry,
      { intervalMs: 5000, timeoutMs: 1000, maxRetries: 3 },
      logger,
    );
  });

  afterEach(() => {
    checker.stop();
  });

  it("starts and stops without error", () => {
    expect(() => {
      checker.start();
    }).not.toThrow();
    expect(() => {
      checker.stop();
    }).not.toThrow();
  });

  it("calls refreshTools on connected clients", async () => {
    const refresh = vi.fn().mockResolvedValue([]);
    registry.getConnectedClients = vi
      .fn()
      .mockReturnValue(new Map([["fs", { getStatus: () => "connected" }]]));
    registry.refreshTools = refresh;
    await checker.runOnce();
    expect(refresh).toHaveBeenCalledWith("fs");
  });

  it("does not fail when no clients are connected", async () => {
    await expect(checker.runOnce()).resolves.toBeUndefined();
  });

  it("updates config and restarts interval", () => {
    checker.start();
    expect(() => {
      checker.setConfig({ intervalMs: 10000, timeoutMs: 2000, maxRetries: 5 });
    }).not.toThrow();
    checker.stop();
  });
});

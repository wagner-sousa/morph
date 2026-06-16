import { describe, expect, it, vi } from "vitest";
import { registerOAuthRoutes } from "../../src/web/oauth-routes.js";

describe("registerOAuthRoutes", () => {
  const mockHub = () => ({
    registry: {
      getOAuthProvider: vi.fn(),
      getDefinitions: vi.fn().mockReturnValue([]),
      needsOAuth: vi.fn(),
      getOAuthUrl: vi.fn(),
      hasOAuthToken: vi.fn(),
      finishOAuth: vi.fn(),
      reconnect: vi.fn(),
    },
    logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  });

  it("registers 3 routes (status, start, callback)", () => {
    const app = { get: vi.fn() };
    registerOAuthRoutes(app as never, mockHub() as never);
    expect(app.get).toHaveBeenCalledTimes(3);
    const paths = app.get.mock.calls.map((c: unknown[]) => c[0]);
    expect(paths).toContain("/api/mcps/:name/oauth/status");
    expect(paths).toContain("/api/mcps/:name/oauth/start");
    expect(paths).toContain("/api/mcps/:name/oauth/callback");
  });

  it("does not throw", () => {
    expect(() => {
      registerOAuthRoutes({ get: vi.fn() } as never, mockHub() as never);
    }).not.toThrow();
  });
});

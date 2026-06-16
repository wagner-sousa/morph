import { mkdtempSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { OAuthStore } from "../../src/mcp-client/oauth-store.js";

let dataDir: string;
let store: OAuthStore;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), "morph-oauth-test-"));
  store = new OAuthStore(dataDir);
});

afterEach(() => {
  rmSync(dataDir, { recursive: true, force: true });
});

describe("OAuthStore", () => {
  it("returns undefined for unknown MCP", () => {
    expect(store.get("nonexistent")).toBeUndefined();
  });

  it("persists data across store instances", async () => {
    await store.set("fs", { authorizationUrl: "http://auth/url" });
    const store2 = new OAuthStore(dataDir);
    await store2.load();
    expect(store2.get("fs")?.authorizationUrl).toBe("http://auth/url");
  });

  it("sets and gets tokens", async () => {
    const tokens = { accessToken: "abc", tokenType: "bearer" } as const;
    await store.set("fs", { tokens });
    const retrieved = store.get("fs");
    expect(retrieved?.tokens?.accessToken).toBe("abc");
  });

  it("merges data on repeated sets", async () => {
    await store.set("fs", { authorizationUrl: "http://auth/url" });
    await store.set("fs", { codeVerifier: "verifier123" });
    const retrieved = store.get("fs");
    expect(retrieved?.authorizationUrl).toBe("http://auth/url");
    expect(retrieved?.codeVerifier).toBe("verifier123");
  });

  it("deletes an entry", async () => {
    await store.set("fs", { authorizationUrl: "http://auth/url" });
    await store.delete("fs");
    expect(store.get("fs")).toBeUndefined();
  });

  it("clearPending removes codeVerifier and authorizationUrl", async () => {
    await store.set("fs", {
      authorizationUrl: "http://auth/url",
      codeVerifier: "verifier123",
      tokens: { accessToken: "abc", tokenType: "bearer" } as const,
    });
    await store.clearPending("fs");
    const retrieved = store.get("fs");
    expect(retrieved?.codeVerifier).toBeUndefined();
    expect(retrieved?.authorizationUrl).toBeUndefined();
    expect(retrieved?.tokens?.accessToken).toBe("abc");
  });

  it("handles empty store gracefully", async () => {
    await store.load();
    expect(store.get("any")).toBeUndefined();
  });
});

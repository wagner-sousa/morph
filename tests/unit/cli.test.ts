import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

describe("index.ts — CLI entrypoint", () => {
  it("exists and contains main function", () => {
    const indexPath = resolve(import.meta.dirname, "../../src/index.ts");
    expect(existsSync(indexPath)).toBe(true);
    const content = readFileSync(indexPath, "utf-8");
    expect(content).toContain("main");
  });
});

describe("healthcheck.ts", () => {
  it("exists and contains expected code", () => {
    const healthcheckPath = resolve(
      import.meta.dirname,
      "../../src/healthcheck.ts",
    );
    expect(existsSync(healthcheckPath)).toBe(true);
    const content = readFileSync(healthcheckPath, "utf-8");
    expect(content).toContain("3100");
    expect(content).toContain("fetch");
  });
});

describe("getVersionInfo", () => {
  it("returns version info", async () => {
    const { getVersionInfo } = await import("../../src/utils/version.js");
    const info = getVersionInfo();
    expect(info.name).toBe("morph");
    expect(info.version).toBeTruthy();
  });

  it("caches result across calls", async () => {
    const { getVersionInfo } = await import("../../src/utils/version.js");
    const a = getVersionInfo();
    const b = getVersionInfo();
    expect(a).toBe(b);
  });
});

describe("retry", () => {
  it("retries on failure", async () => {
    const { retry } = await import("../../src/utils/retry.js");
    let calls = 0;
    const fn = vi.fn(async () => {
      calls++;
      if (calls < 3) throw new Error("fail");
      return "ok";
    });
    const result = await retry(fn, { retries: 3, factor: 0 });
    expect(result).toBe("ok");
    expect(calls).toBe(3);
  });

  it("throws RetryAbortedError when all retries exhausted", async () => {
    const { retry } = await import("../../src/utils/retry.js");
    const fn = vi.fn(async () => {
      throw new Error("always fail");
    });
    await expect(retry(fn, { retries: 1, factor: 0 })).rejects.toThrow(
      "always fail",
    );
  });

  it("sleep resolves after timeout", async () => {
    const { sleep } = await import("../../src/utils/retry.js");
    const start = Date.now();
    await sleep(50);
    expect(Date.now() - start).toBeGreaterThanOrEqual(45);
  });

  it("calls onAttempt callback", async () => {
    const { retry } = await import("../../src/utils/retry.js");
    const onAttempt = vi.fn();
    const fn = vi.fn(async () => {
      throw new Error("fail");
    });
    await retry(fn, { retries: 2, factor: 0, onAttempt }).catch(() => {});
    expect(onAttempt).toHaveBeenCalledTimes(2);
  });
});

import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createLogger } from "../../src/logging/logger.js";

describe("createLogger", () => {
  it("returns an object with log methods", () => {
    const logger = createLogger("info", false);
    expect(typeof logger.info).toBe("function");
    expect(typeof logger.warn).toBe("function");
    expect(typeof logger.error).toBe("function");
    expect(typeof logger.debug).toBe("function");
    expect(typeof logger.child).toBe("function");
  });

  it("child returns a logger", () => {
    const logger = createLogger("info", false);
    const child = logger.child({ module: "test" });
    expect(typeof child.info).toBe("function");
  });

  it("logging at error level works", () => {
    const logger = createLogger("error", false);
    expect(() => {
      logger.error("test");
    }).not.toThrow();
  });

  describe("file logging", () => {
    let dir: string;
    beforeEach(() => {
      dir = mkdtempSync(join(tmpdir(), "morph-log-"));
    });
    afterEach(() => {
      rmSync(dir, { recursive: true, force: true });
    });

    it("creates the log dir and writes JSON to the file", () => {
      const path = join(dir, "nested", "morph.log");
      const logger = createLogger("info", false, { path });
      logger.info({ hello: "world" }, "file-log-test");
      expect(existsSync(path)).toBe(true);
      const content = readFileSync(path, "utf8");
      expect(content).toContain("file-log-test");
      expect(content).toContain('"hello":"world"');
    });

    it("keeps stdout untouched in file mode (MCP stdio safety)", () => {
      const path = join(dir, "morph.log");
      const writes: string[] = [];
      const orig = process.stdout.write.bind(process.stdout);
      // @ts-expect-error test override
      process.stdout.write = (chunk: string) => {
        writes.push(chunk);
        return true;
      };
      try {
        const logger = createLogger("info", false, { path });
        logger.info("should not hit stdout");
      } finally {
        process.stdout.write = orig;
      }
      expect(writes.join("")).not.toContain("should not hit stdout");
    });
  });
});

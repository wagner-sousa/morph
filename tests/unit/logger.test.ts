import { describe, expect, it } from "vitest";
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
});

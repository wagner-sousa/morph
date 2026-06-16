import { describe, expect, it } from "vitest";
import {
  MorphError,
  ConfigError,
  EnvResolutionError,
  MCPNotFoundError,
  ToolNotFoundError,
  ConflictError,
} from "../../src/utils/errors.js";

describe("MorphError", () => {
  it("has code and message", () => {
    const err = new MorphError("TEST_CODE", "test message");
    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.name).toBe("MorphError");
  });

  it("accepts optional details", () => {
    const err = new MorphError("DETAILED", "msg", { key: "val" });
    expect(err.details).toEqual({ key: "val" });
  });

  it("is instanceof Error", () => {
    expect(new MorphError("X", "m")).toBeInstanceOf(Error);
  });
});

describe("ConfigError", () => {
  it("extends MorphError with CONFIG_ERROR code", () => {
    const err = new ConfigError("bad config");
    expect(err).toBeInstanceOf(MorphError);
    expect(err.code).toBe("INVALID_CONFIG");
    expect(err.message).toBe("bad config");
  });
});

describe("EnvResolutionError", () => {
  it("extends MorphError with ENV_MISSING code and missing array", () => {
    const err = new EnvResolutionError("env vars missing: KEY1, KEY2", [
      "KEY1",
      "KEY2",
    ]);
    expect(err).toBeInstanceOf(MorphError);
    expect(err.code).toBe("ENV_MISSING");
    expect(err.missing).toEqual(["KEY1", "KEY2"]);
    expect(err.message).toContain("KEY1");
    expect(err.message).toContain("KEY2");
  });
});

describe("MCPNotFoundError", () => {
  it("extends MorphError with MCP_NOT_FOUND code", () => {
    const err = new MCPNotFoundError("my-mcp");
    expect(err).toBeInstanceOf(MorphError);
    expect(err.code).toBe("MCP_NOT_FOUND");
    expect(err.message).toContain("my-mcp");
  });
});

describe("ToolNotFoundError", () => {
  it("extends MorphError with TOOL_NOT_FOUND code", () => {
    const err = new ToolNotFoundError("my-tool");
    expect(err).toBeInstanceOf(MorphError);
    expect(err.code).toBe("TOOL_NOT_FOUND");
    expect(err.message).toContain("my-tool");
  });
});

describe("ConflictError", () => {
  it("extends MorphError with CONFLICT code", () => {
    const err = new ConflictError("name conflict");
    expect(err).toBeInstanceOf(MorphError);
    expect(err.code).toBe("CONFLICT");
  });
});

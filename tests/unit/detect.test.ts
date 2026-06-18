import { describe, expect, it } from "vitest";
import { detectContentType } from "../../src/content/detect.js";

describe("detectContentType", () => {
  it("detects JSON objects and arrays", () => {
    expect(detectContentType('{"a":1}')).toBe("json");
    expect(detectContentType("  [1, 2, 3] ")).toBe("json");
  });

  it("does not treat invalid JSON as json", () => {
    expect(detectContentType("{not valid")).not.toBe("json");
  });

  it("detects markdown headings, fences, lists, tables and links", () => {
    expect(detectContentType("# Title\nbody")).toBe("markdown");
    expect(detectContentType("```js\ncode\n```")).toBe("markdown");
    expect(detectContentType("- one\n- two")).toBe("markdown");
    expect(detectContentType("1. one\n2. two")).toBe("markdown");
    expect(detectContentType("| a | b |\n| - | - |")).toBe("markdown");
    expect(detectContentType("see [docs](https://x.dev)")).toBe("markdown");
  });

  it("falls back to text", () => {
    expect(detectContentType("just a plain sentence.")).toBe("text");
    expect(detectContentType("")).toBe("text");
    expect(detectContentType("   ")).toBe("text");
  });

  it("prefers json over markdown when both could match", () => {
    // A JSON array whose strings contain markdown-ish chars is still JSON.
    expect(detectContentType('["# not a heading"]')).toBe("json");
  });
});

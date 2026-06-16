import { describe, expect, it } from "vitest";
import { estimateTokens, estimateSavings } from "../../src/toon/stats.js";

describe("estimateTokens", () => {
  it("returns 0 for empty string", () => {
    expect(estimateTokens("")).toBe(0);
  });
  it("returns 1 for single char", () => {
    expect(estimateTokens("a")).toBe(1);
  });
  it("returns 1 for 4 chars", () => {
    expect(estimateTokens("abcd")).toBe(1);
  });
  it("returns 2 for 5 chars", () => {
    expect(estimateTokens("abcde")).toBe(2);
  });
  it("handles whitespace", () => {
    expect(estimateTokens("  ")).toBe(1);
  });
  it("handles non-ASCII", () => {
    expect(estimateTokens("áéíóú")).toBe(2);
  });
});

describe("estimateSavings", () => {
  it("returns zero savings for identical strings", () => {
    const s = estimateSavings("hello", "hello");
    expect(s.originalTokens).toBe(2);
    expect(s.toonTokens).toBe(2);
    expect(s.percent).toBe(0);
    expect(s.originalBytes).toBe(5);
    expect(s.toonBytes).toBe(5);
  });

  it("returns positive savings when TOON is smaller", () => {
    const s = estimateSavings('{"a":1,"b":2}', "{a:1,b:2}");
    expect(s.originalTokens).toBe(4);
    expect(s.toonTokens).toBe(3);
    expect(s.percent).toBeGreaterThan(0);
  });

  it("returns negative savings when TOON is larger", () => {
    const s = estimateSavings("ab", "abcdefgh");
    expect(s.originalTokens).toBe(1);
    expect(s.toonTokens).toBe(2);
    expect(s.percent).toBeLessThan(0);
  });

  it("handles empty original", () => {
    const s = estimateSavings("", "a");
    expect(s.originalTokens).toBe(0);
    expect(s.percent).toBe(0);
  });
});

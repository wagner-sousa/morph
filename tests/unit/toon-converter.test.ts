import { describe, expect, it } from "vitest";
import { ToonConverter } from "../../src/toon/converter.js";
import { validateConfig } from "../../src/config/loader.js";
import type { CallToolResult } from "../../src/mcp-client/types.js";

const toonOptions = validateConfig({ mcpServers: [] }).toon;

function textResult(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

describe("ToonConverter", () => {
  const converter = new ToonConverter(toonOptions);

  it("converts a large uniform JSON array and reports savings", () => {
    const rows = Array.from({ length: 30 }, (_, i) => ({
      id: i,
      name: `n${i}`,
      active: true,
    }));
    const { result, converted, savings } = converter.convertResult(
      textResult(JSON.stringify(rows)),
    );
    expect(converted).toBe(true);
    expect(savings!.percent).toBeGreaterThan(0);
    const item = result.content[0] as {
      text: string;
      _meta?: Record<string, unknown>;
    };
    expect(item._meta?.["morph/format"]).toBe("toon");
    // round-trips back to the original data
    expect(converter.decode(item.text)).toEqual(rows);
  });

  it("converts valid JSON even for small payloads", () => {
    const { converted, savings } = converter.convertResult(
      textResult('{"a":1}'),
    );
    expect(converted).toBe(true);
    expect(savings!.percent).toBeGreaterThan(0);
  });

  it("passes through non-JSON text untouched", () => {
    const longText = "x".repeat(300);
    const { result, converted } = converter.convertResult(textResult(longText));
    expect(converted).toBe(false);
    expect((result.content[0] as { text: string }).text).toBe(longText);
  });

  it("leaves non-text content alone", () => {
    const res: CallToolResult = {
      content: [{ type: "image", data: "abc", mimeType: "image/png" }],
    };
    const { converted } = converter.convertResult(res);
    expect(converted).toBe(false);
  });

  it("keeps JSON when TOON would be larger (dynamic guard)", () => {
    const nonUniform = [{ a: 1 }, { b: 2, c: 3 }, { d: "long string here" }];
    const json = JSON.stringify(nonUniform);
    const { converted, result } = converter.convertResult(textResult(json));
    expect(converted).toBe(false);
    expect((result.content[0] as { text: string }).text).toBe(json);
  });

  it("convertForced encodes TOON even when larger than JSON", () => {
    const nonUniform = [{ a: 1 }, { b: 2, c: 3 }, { d: "long string here" }];
    const json = JSON.stringify(nonUniform);
    // dynamic keeps JSON...
    expect(converter.convertResult(textResult(json)).converted).toBe(false);
    // ...but forced mode converts and round-trips.
    const { converted, result } = converter.convertForced(textResult(json));
    expect(converted).toBe(true);
    const item = result.content[0] as { text: string };
    expect(converter.decode(item.text)).toEqual(nonUniform);
  });
});

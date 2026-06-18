/**
 * IMPL: wraps @toon-format/toon to intercept and convert MCP tool results.
 *
 * Only text content that parses as JSON and that the optimizer approves is
 * converted. Non-text content (images, etc.) and non-JSON text pass through
 * untouched. Converted items keep the original byte/token accounting in
 * `_meta` so the agent and the Web UI can see the savings.
 */
import { decode, encode, DELIMITERS } from "@toon-format/toon";
import type { CallToolResult } from "../mcp-client/types.js";
import type { ToonOptions } from "../config/types.js";
import { estimateSavings, type TokenSavings } from "./stats.js";

export interface ConversionResult {
  result: CallToolResult;
  savings?: TokenSavings;
  converted: boolean;
}

export class ToonConverter {
  constructor(private options: ToonOptions) {}

  setOptions(options: ToonOptions): void {
    this.options = options;
  }

  encode(data: unknown): string {
    return encode(data, {
      indent: this.options.indent,
      delimiter: DELIMITERS[this.options.delimiter],
      keyFolding: this.options.flattenDepth > 0 ? "safe" : "off",
    });
  }

  decode(toon: string): unknown {
    return decode(toon);
  }

  private isJson(text: string): unknown {
    const trimmed = text.trim();
    if (!trimmed || !"[{".includes(trimmed[0])) return undefined;
    try {
      return JSON.parse(trimmed);
    } catch {
      return undefined;
    }
  }

  /**
   * Convert a CallToolResult's JSON text content to TOON where beneficial.
   * Returns the (possibly unchanged) result plus aggregate savings.
   */
  convertResult(result: CallToolResult): ConversionResult {
    return this.convert(result, false);
  }

  /**
   * Like {@link convertResult} but forces TOON encoding even when the result is
   * larger than the original JSON (used by outputMode "toon"). Savings may be
   * negative in that case.
   */
  convertForced(result: CallToolResult): ConversionResult {
    return this.convert(result, true);
  }

  private convert(result: CallToolResult, force: boolean): ConversionResult {
    if (!Array.isArray(result.content)) return { result, converted: false };

    const totals = { original: 0, toon: 0, converted: 0 };

    const content = result.content.map((item) => {
      if (item.type !== "text" || typeof item.text !== "string") return item;
      const parsed = this.isJson(item.text);
      if (parsed === undefined) return item;

      let toon: string;
      try {
        toon = this.encode(parsed);
      } catch {
        return item; // never let conversion break a real response
      }
      // Guard: if TOON ended up larger, keep the original JSON (unless forced).
      if (!force && toon.length >= item.text.length) return item;

      const savings = estimateSavings(item.text, toon);
      totals.original += savings.originalTokens;
      totals.toon += savings.toonTokens;
      totals.converted += 1;

      return {
        ...item,
        text: toon,
        _meta: {
          "morph/format": "toon",
          "morph/originalTokens": savings.originalTokens,
          "morph/toonTokens": savings.toonTokens,
          "morph/savingsPercent": savings.percent,
        },
      };
    });

    if (totals.converted === 0) return { result, converted: false };

    return {
      result: { ...result, content },
      converted: true,
      savings: estimateSavingsFromTotals(totals.original, totals.toon),
    };
  }
}

function estimateSavingsFromTotals(
  originalTokens: number,
  toonTokens: number,
): TokenSavings {
  const percent =
    originalTokens === 0
      ? 0
      : ((originalTokens - toonTokens) / originalTokens) * 100;
  return {
    originalBytes: originalTokens * 4,
    toonBytes: toonTokens * 4,
    originalTokens,
    toonTokens,
    percent: Math.round(percent * 10) / 10,
  };
}

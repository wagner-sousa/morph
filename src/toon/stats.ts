/**
 * IMPL: token-savings estimation for JSON → TOON conversion.
 *
 * Uses the common ~4-chars-per-token heuristic. This is an estimate for
 * dashboards, not billing — exact tokenisation depends on the model.
 */
export interface TokenSavings {
  originalBytes: number;
  toonBytes: number;
  originalTokens: number;
  toonTokens: number;
  /** Percentage saved, e.g. 42.5 (negative if TOON was larger). */
  percent: number;
}

const CHARS_PER_TOKEN = 4;

export function estimateTokens(text: string): number {
  return Math.ceil(text.length / CHARS_PER_TOKEN);
}

export function estimateSavings(original: string, toon: string): TokenSavings {
  const originalTokens = estimateTokens(original);
  const toonTokens = estimateTokens(toon);
  const percent =
    originalTokens === 0
      ? 0
      : ((originalTokens - toonTokens) / originalTokens) * 100;
  return {
    originalBytes: original.length,
    toonBytes: toon.length,
    originalTokens,
    toonTokens,
    percent: Math.round(percent * 10) / 10,
  };
}

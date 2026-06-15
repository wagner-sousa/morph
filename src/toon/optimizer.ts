/**
 * IMPL: decides whether a given JSON payload is worth converting to TOON.
 *
 * TOON shines on uniform arrays of objects; it adds little on tiny or deeply
 * nested payloads. We use cheap structural heuristics plus a size threshold.
 *
 * Decision table (from PLAN.md §7.5):
 *   Uniform array of objects  → 30–60% savings  → Convert
 *   Deeply nested (≥4 levels) →  0–15% savings  → May skip
 *   Small (<threshold)        →  Minimal         → Skip
 *   Non-uniform / mixed       → 15–30% savings  → Convert
 */
import type { ToonOptions } from '../config/types.js';

export interface OptimizerDecision {
  convert: boolean;
  reason: string;
}

export function maxDepth(value: unknown, current = 1): number {
  if (Array.isArray(value)) {
    let max = current;
    for (const item of value) max = Math.max(max, maxDepth(item, current + 1));
    return max;
  }
  if (value !== null && typeof value === 'object') {
    let max = current;
    for (const v of Object.values(value)) max = Math.max(max, maxDepth(v, current + 1));
    return max;
  }
  return current;
}

/**
 * Check if an array consists entirely of plain objects sharing the same keys.
 * Empty arrays and non-array values return false.
 */
export function isUniformArray(value: unknown): boolean {
  if (!Array.isArray(value) || value.length === 0) return false;
  const firstKeys = keysOf(value[0]);
  if (firstKeys === null) return false;
  for (let i = 1; i < value.length; i++) {
    const k = keysOf(value[i]);
    if (k === null || k.length !== firstKeys.length || !k.every((key) => firstKeys.includes(key))) {
      return false;
    }
  }
  return true;
}

function keysOf(v: unknown): string[] | null {
  if (v === null || typeof v !== 'object' || Array.isArray(v)) return null;
  return Object.keys(v).sort();
}

export function decideConvert(
  rawText: string,
  parsed: unknown,
  options: ToonOptions,
): OptimizerDecision {
  if (rawText.length < options.threshold) {
    return { convert: false, reason: 'below size threshold' };
  }
  // Primitive scalars never benefit.
  if (parsed === null || typeof parsed !== 'object') {
    return { convert: false, reason: 'not an object or array' };
  }
  // Deeply nested (>=4 levels) — minimal TOON benefit, skip to avoid overhead.
  if (maxDepth(parsed) >= 4) {
    return { convert: false, reason: 'deeply nested, TOON benefit minimal' };
  }
  // Uniform arrays get the highest benefit.
  if (isUniformArray(parsed)) {
    return { convert: true, reason: 'uniform array — high TOON benefit' };
  }
  // Fall through to convert — non-uniform / mixed still benefit.
  return { convert: true, reason: 'eligible' };
}

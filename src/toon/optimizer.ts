/**
 * IMPL: decides whether a given JSON payload is worth converting to TOON.
 *
 * TOON shines on uniform arrays of objects; it adds little on tiny or deeply
 * nested payloads. We use cheap structural heuristics plus a size threshold.
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
  return { convert: true, reason: 'eligible' };
}

/**
 * IMPL: per-tool response field projection.
 *
 * Applies an include/exclude field selection to a parsed JSON value before it
 * is converted to TOON. Field paths use dot-notation and traverse arrays
 * element-wise, so "tasks.id" against `{ tasks: [{id, name}, ...] }` keeps only
 * each task's `id`.
 *
 *   include → keep only the listed paths
 *   exclude → drop the listed paths, keep everything else
 *
 * Selecting a non-existent path is a no-op for that path.
 */

export interface FieldSelection {
  mode: "include" | "exclude";
  fields: string[];
}

type Json = unknown;

function isPlainObject(v: Json): v is Record<string, Json> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** Remove a single dot-path from a node in place, recursing into arrays. */
function removePath(node: Json, segments: string[]): void {
  if (segments.length === 0) return;
  if (Array.isArray(node)) {
    for (const el of node) removePath(el, segments);
    return;
  }
  if (!isPlainObject(node)) return;
  const [head, ...rest] = segments;
  if (!(head in node)) return;
  if (rest.length === 0) {
    delete node[head];
  } else {
    removePath(node[head], rest);
  }
}

/** Build a projected copy of `node` keeping only the given dot-paths. */
function includeNode(node: Json, paths: string[][]): Json {
  if (Array.isArray(node)) {
    return node.map((el) => includeNode(el, paths));
  }
  if (!isPlainObject(node)) return node;

  const byHead = new Map<string, { whole: boolean; rests: string[][] }>();
  for (const segs of paths) {
    if (segs.length === 0) continue;
    const [head, ...rest] = segs;
    if (!(head in node)) continue;
    const slot = byHead.get(head) ?? { whole: false, rests: [] };
    if (rest.length === 0) slot.whole = true;
    else slot.rests.push(rest);
    byHead.set(head, slot);
  }

  const out: Record<string, Json> = {};
  for (const [head, { whole, rests }] of byHead) {
    out[head] = whole ? node[head] : includeNode(node[head], rests);
  }
  return out;
}

/**
 * Apply a field selection to a parsed JSON value. Returns a new value; the
 * input is not mutated. Returns the input unchanged when there are no fields.
 */
export function applyFieldSelection(input: Json, sel: FieldSelection): Json {
  if (!sel.fields.length) return input;
  const paths = sel.fields.map((f) => f.split("."));

  if (sel.mode === "exclude") {
    const clone = structuredClone(input);
    for (const segs of paths) removePath(clone, segs);
    return clone;
  }
  return includeNode(input, paths);
}

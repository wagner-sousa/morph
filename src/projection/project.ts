/**
 * IMPL: per-tool response field projection.
 *
 * Applies an include/exclude field selection to a parsed JSON value before it
 * is converted to TOON. Field paths are written in JSONPath (RFC 9535-style),
 * so "$.tasks[*].id" against `{ tasks: [{id, name}, ...] }` keeps only each
 * task's `id`.
 *
 *   include → keep only the nodes matched by the listed expressions
 *   exclude → drop the matched nodes, keep everything else
 *
 * An expression that matches nothing (or is syntactically invalid) is a no-op.
 */

import { JSONPath } from "jsonpath-plus";

export interface FieldSelection {
  mode: "include" | "exclude";
  fields: string[];
}

type Json = unknown;

/** Decode a single RFC 6901 JSON Pointer reference token. */
function decodeToken(token: string): string {
  return token.replace(/~1/g, "/").replace(/~0/g, "~");
}

/** Split a JSON Pointer (e.g. "/tasks/0/id") into its decoded segments. */
function pointerSegments(pointer: string): string[] {
  if (pointer === "" || pointer === "/") return [];
  return pointer.split("/").slice(1).map(decodeToken);
}

/**
 * Resolve a JSONPath expression against `input` to the JSON Pointers of every
 * matched node. Invalid expressions resolve to no matches rather than throwing.
 */
function matchedPointers(input: Json, expr: string): string[] {
  try {
    const res = JSONPath({
      path: expr,
      json: input as object,
      resultType: "pointer",
      wrap: true,
    });
    return Array.isArray(res) ? (res as string[]) : [];
  } catch {
    return [];
  }
}

const isIndex = (seg: string): boolean => /^\d+$/.test(seg);

/** Read the value at a pointer's segments, or undefined if the path breaks. */
function getAt(root: Json, segments: string[]): Json {
  let cur: Json = root;
  for (const seg of segments) {
    if (Array.isArray(cur)) cur = cur[Number(seg)];
    else if (typeof cur === "object" && cur !== null)
      cur = (cur as Record<string, Json>)[seg];
    else return undefined;
  }
  return cur;
}

/** Set `value` at a pointer's segments, creating objects/arrays as needed. */
function setAt(root: Record<string, Json> | Json[], segments: string[], value: Json): void {
  let cur: Record<string, Json> | Json[] = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    const nextIsIndex = isIndex(segments[i + 1]);
    const key: string | number = Array.isArray(cur) ? Number(seg) : seg;
    let child = (cur as Record<string | number, Json>)[key];
    if (child === undefined || child === null) {
      child = nextIsIndex ? [] : {};
      (cur as Record<string | number, Json>)[key] = child;
    }
    cur = child as Record<string, Json> | Json[];
  }
  const last = segments[segments.length - 1];
  (cur as Record<string | number, Json>)[Array.isArray(cur) ? Number(last) : last] = value;
}

/** Delete the node at a pointer's segments (splices arrays to avoid holes). */
function deleteAt(root: Json, segments: string[]): void {
  if (segments.length === 0) return;
  let cur: Json = root;
  for (let i = 0; i < segments.length - 1; i++) {
    const seg = segments[i];
    if (Array.isArray(cur)) cur = cur[Number(seg)];
    else if (typeof cur === "object" && cur !== null)
      cur = (cur as Record<string, Json>)[seg];
    else return;
  }
  const last = segments[segments.length - 1];
  if (Array.isArray(cur)) cur.splice(Number(last), 1);
  else if (typeof cur === "object" && cur !== null)
    delete (cur as Record<string, Json>)[last];
}

/** Descending order so that deleting later array indices never shifts earlier ones. */
function compareSegmentsDesc(a: string[], b: string[]): number {
  const len = Math.max(a.length, b.length);
  for (let i = 0; i < len; i++) {
    const sa = a[i];
    const sb = b[i];
    if (sa === undefined) return 1;
    if (sb === undefined) return -1;
    if (isIndex(sa) && isIndex(sb)) {
      const diff = Number(sb) - Number(sa);
      if (diff !== 0) return diff;
    } else if (sa !== sb) {
      return sa < sb ? 1 : -1;
    }
  }
  return 0;
}

/**
 * Apply a field selection to a parsed JSON value. Returns a new value; the
 * input is not mutated. Returns the input unchanged when there are no fields.
 */
export function applyFieldSelection(input: Json, sel: FieldSelection): Json {
  if (!sel.fields.length) return input;

  const pointers = sel.fields.flatMap((expr) => matchedPointers(input, expr));

  if (sel.mode === "exclude") {
    const clone = structuredClone(input);
    const segs = pointers.map(pointerSegments).filter((s) => s.length > 0);
    segs.sort(compareSegmentsDesc);
    for (const s of segs) deleteAt(clone, s);
    return clone;
  }

  // include: rebuild a copy holding only the matched nodes.
  const out: Record<string, Json> | Json[] = Array.isArray(input) ? [] : {};
  for (const pointer of pointers) {
    const segments = pointerSegments(pointer);
    if (segments.length === 0) return structuredClone(input);
    setAt(out, segments, structuredClone(getAt(input, segments)));
  }
  return out;
}

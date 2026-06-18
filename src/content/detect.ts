/**
 * IMPL: lightweight content-type detection for MCP tool responses.
 *
 * The gateway emits either TOON (when conversion happened) or the original
 * content. To surface the *real* type of a non-converted response, we classify
 * the raw text as JSON, Markdown or plain text using cheap heuristics — no
 * parser/renderer dependency.
 *
 *   json     → parses as a JSON object/array
 *   markdown → carries common Markdown markers (headings, fences, lists,
 *              tables, links)
 *   text     → anything else
 */

export type ContentType = "json" | "markdown" | "text";

/** True when the text parses as a JSON object/array (same rule as the TOON converter). */
function looksLikeJson(trimmed: string): boolean {
  if (!trimmed || !"[{".includes(trimmed[0])) return false;
  try {
    JSON.parse(trimmed);
    return true;
  } catch {
    return false;
  }
}

const MARKDOWN_PATTERNS: RegExp[] = [
  /^#{1,6}\s+\S/m, // ATX headings
  /```/, // fenced code blocks
  /^\s*[-*+]\s+\S/m, // unordered lists
  /^\s*\d+\.\s+\S/m, // ordered lists
  /^\s*>\s+\S/m, // blockquotes
  /^.*\|.*\|.*$/m, // table-ish rows
  /\[[^\]]+\]\([^)]+\)/, // links
  /\*\*[^*]+\*\*/, // bold
];

function looksLikeMarkdown(text: string): boolean {
  return MARKDOWN_PATTERNS.some((re) => re.test(text));
}

/** Classify a raw response string as json / markdown / text. */
export function detectContentType(text: string): ContentType {
  const trimmed = text.trim();
  if (!trimmed) return "text";
  if (looksLikeJson(trimmed)) return "json";
  if (looksLikeMarkdown(trimmed)) return "markdown";
  return "text";
}

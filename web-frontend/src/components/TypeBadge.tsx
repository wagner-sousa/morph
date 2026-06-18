import { type LogEntry } from "../lib/api";
import { cn } from "../lib/utils";

export type UnifiedType = "toon" | "json" | "markdown" | "text";

/**
 * The unified return type shown to the user: TOON when conversion happened,
 * otherwise the detected source content type (json/markdown/text).
 */
export function unifiedType(
  log: Pick<LogEntry, "outputFormat" | "contentType">,
): UnifiedType {
  if (log.outputFormat === "toon") return "toon";
  return (log.contentType ?? "json") as UnifiedType;
}

/** Tailwind classes per type (shared with the dashboard charts). */
export const TYPE_CLASSES: Record<UnifiedType, string> = {
  toon: "bg-green-600/20 text-green-400",
  json: "bg-morph-panel text-morph-text",
  markdown: "bg-indigo-600/20 text-indigo-300",
  text: "bg-yellow-600/20 text-yellow-400",
};

/** Hex colors per type, for recharts cells/legends. */
export const TYPE_COLORS: Record<string, string> = {
  toon: "#14b8a6",
  json: "#64748b",
  markdown: "#818cf8",
  text: "#eab308",
};

export function TypeBadge({
  type,
  className,
}: {
  type: UnifiedType;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-transparent px-2.5 py-0.5 text-xs font-semibold",
        TYPE_CLASSES[type],
        className,
      )}
    >
      {type.toUpperCase()}
    </span>
  );
}

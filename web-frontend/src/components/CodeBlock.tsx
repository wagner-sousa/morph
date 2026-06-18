import { type ReactNode } from "react";

/**
 * Renders content the way a fenced code block looks in Markdown: a small header
 * bar with the language/type label and a monospace, scrollable body.
 */
export function CodeBlock({
  language,
  children,
}: {
  language?: string;
  children: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-md border border-morph-border">
      {language && (
        <div className="border-b border-morph-border bg-morph-bg px-3 py-1 font-mono text-[11px] uppercase tracking-wide text-morph-muted">
          {language}
        </div>
      )}
      <pre className="max-h-96 overflow-auto whitespace-pre-wrap break-words bg-morph-bg-alt p-3 font-mono text-xs">
        {children}
      </pre>
    </div>
  );
}

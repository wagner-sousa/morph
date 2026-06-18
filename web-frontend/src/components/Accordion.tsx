import { type ReactNode, useState } from "react";
import { ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

export interface AccordionItem {
  id: string;
  header: ReactNode;
  body: ReactNode;
}

/**
 * Single-open accordion: clicking a header opens it and closes any other.
 * Closed by default unless `defaultOpenId` is given.
 */
export function Accordion({
  items,
  defaultOpenId = null,
}: {
  items: AccordionItem[];
  defaultOpenId?: string | null;
}) {
  const [openId, setOpenId] = useState<string | null>(defaultOpenId);

  return (
    <div className="space-y-2">
      {items.map((item) => {
        const isOpen = openId === item.id;
        return (
          <div key={item.id} className="rounded-md border border-morph-border">
            <button
              type="button"
              onClick={() => setOpenId(isOpen ? null : item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center gap-2 p-3 text-left"
            >
              <ChevronRight
                className={cn(
                  "h-4 w-4 shrink-0 text-morph-muted transition-transform",
                  isOpen && "rotate-90",
                )}
              />
              <div className="min-w-0 flex-1">{item.header}</div>
            </button>
            {isOpen && <div className="px-3 pb-3">{item.body}</div>}
          </div>
        );
      })}
    </div>
  );
}

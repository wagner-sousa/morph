import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { type FieldSelection, type MCPStatus, api } from "../lib/api";
import { useUpdateMcp } from "../hooks/useMcps";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Select } from "./ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "./ui/tabs";

interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
}

interface ToolCardProps {
  tool: ToolInfo;
}

function ToolCardToon({ tool }: ToolCardProps) {
  const schema = tool.inputSchema;
  const props = schema?.properties as
    | Record<string, { type?: string; description?: string }>
    | undefined;
  const required = (schema?.required as string[] | undefined) ?? [];

  return (
    <div className="rounded-md border border-morph-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-sm font-semibold">{tool.name}</code>
        {tool.description && (
          <span className="text-xs text-morph-muted truncate">
            {tool.description}
          </span>
        )}
      </div>
      {props && Object.keys(props).length > 0 && (
        <div className="space-y-1 text-xs font-mono">
          {Object.entries(props).map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="text-morph-accent">{key}</span>
              <span className="text-morph-muted">{val.type ?? "any"}</span>
              {required.includes(key) && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">
                  required
                </Badge>
              )}
              {val.description && (
                <span className="text-morph-muted truncate">
                  {val.description}
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ToolCardJson({ tool }: ToolCardProps) {
  return (
    <div className="rounded-md border border-morph-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-sm font-semibold">{tool.name}</code>
        {tool.description && (
          <span className="text-xs text-morph-muted">{tool.description}</span>
        )}
      </div>
      {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
        <pre className="max-h-60 overflow-auto whitespace-pre-wrap break-all rounded bg-morph-bg p-2 text-xs">
          {JSON.stringify(tool.inputSchema, null, 2)}
        </pre>
      )}
    </div>
  );
}

/** Local editor state per tool: projection mode + one field path per line. */
interface FieldDraft {
  mode: "include" | "exclude";
  text: string;
}

function ToolFieldsEditor({
  mcpName,
  tools,
}: {
  mcpName: string;
  tools: ToolInfo[];
}) {
  const updateMcp = useUpdateMcp();
  const { data: config, isLoading } = useQuery({
    queryKey: ["mcp-config", mcpName],
    queryFn: () => api.mcpConfig(mcpName),
  });
  const [drafts, setDrafts] = useState<Record<string, FieldDraft>>({});

  useEffect(() => {
    if (!config) return;
    const initial: Record<string, FieldDraft> = {};
    for (const tool of tools) {
      const sel = config.fieldSelection?.[tool.name];
      initial[tool.name] = {
        mode: sel?.mode ?? "include",
        text: sel?.fields.join("\n") ?? "",
      };
    }
    setDrafts(initial);
  }, [config, tools]);

  const setDraft = (name: string, patch: Partial<FieldDraft>) =>
    setDrafts((d) => ({ ...d, [name]: { ...d[name], ...patch } }));

  const handleSave = async () => {
    if (!config) return;
    const fieldSelection: Record<string, FieldSelection> = {};
    for (const [name, draft] of Object.entries(drafts)) {
      const fields = draft.text
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean);
      if (fields.length) fieldSelection[name] = { mode: draft.mode, fields };
    }
    try {
      await updateMcp.mutateAsync({
        name: mcpName,
        cfg: {
          ...config,
          fieldSelection:
            Object.keys(fieldSelection).length > 0 ? fieldSelection : undefined,
        },
      });
      toast.success(`Saved field selection for "${mcpName}"`);
    } catch {
      toast.error(`Failed to save field selection for "${mcpName}"`);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-morph-muted" />
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-0 flex-1">
      <p className="text-xs text-morph-muted pb-3">
        Project each tool&apos;s JSON response before TOON conversion. Use
        dot-notation for nested/array paths (e.g. <code>tasks.id</code>). One
        path per line. Empty = no projection.
      </p>
      <div className="flex-1 min-h-0 overflow-y-auto space-y-3 pr-1">
        {tools.map((tool) => (
          <div
            key={tool.name}
            className="rounded-md border border-morph-border p-3 space-y-2"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 space-y-0.5">
                <code className="text-sm font-semibold">{tool.name}</code>
                {tool.description && (
                  <p className="text-xs text-morph-muted">{tool.description}</p>
                )}
              </div>
              <Select
                className="w-32 shrink-0"
                value={drafts[tool.name]?.mode ?? "include"}
                onChange={(e) =>
                  setDraft(tool.name, {
                    mode: e.target.value as "include" | "exclude",
                  })
                }
                options={[
                  { value: "include", label: "Include" },
                  { value: "exclude", label: "Exclude" },
                ]}
              />
            </div>
            <textarea
              className="flex min-h-[60px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-xs font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
              value={drafts[tool.name]?.text ?? ""}
              onChange={(e) => setDraft(tool.name, { text: e.target.value })}
              placeholder={"id\nname\ndata.items.title"}
            />
          </div>
        ))}
      </div>
      <div className="border-t border-morph-border pt-3 mt-3">
        <Button onClick={() => void handleSave()} disabled={updateMcp.isPending}>
          {updateMcp.isPending ? "Saving..." : "Save field selection"}
        </Button>
      </div>
    </div>
  );
}

export function MCPToolsModal({
  mcp,
  open,
  onOpenChange,
}: {
  mcp: MCPStatus | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const { data: tools, isLoading } = useQuery({
    queryKey: ["mcp-tools", mcp?.name],
    queryFn: () => api.tools(mcp?.name ?? "") as unknown as Promise<ToolInfo[]>,
    enabled: !!mcp && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Tools — {mcp?.name}</DialogTitle>
        </DialogHeader>
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-morph-muted" />
          </div>
        ) : !tools || tools.length === 0 ? (
          <p className="text-sm text-morph-muted">No tools available.</p>
        ) : (
          <Tabs defaultValue="toon" className="flex-1 flex flex-col min-h-0">
            <TabsList className="self-start">
              <TabsTrigger value="toon">TOON</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="fields">Fields</TabsTrigger>
            </TabsList>
            <TabsContent
              value="toon"
              className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1"
            >
              {tools.map((tool) => (
                <ToolCardToon key={tool.name} tool={tool} />
              ))}
            </TabsContent>
            <TabsContent
              value="json"
              className="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1"
            >
              {tools.map((tool) => (
                <ToolCardJson key={tool.name} tool={tool} />
              ))}
            </TabsContent>
            <TabsContent
              value="fields"
              className="flex-1 min-h-0 flex flex-col overflow-hidden"
            >
              {mcp && <ToolFieldsEditor mcpName={mcp.name} tools={tools} />}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

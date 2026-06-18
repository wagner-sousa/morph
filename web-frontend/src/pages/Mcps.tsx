import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";
import {
  api,
  type MCPConfig,
  type MCPStatus,
  type MCPTransport,
} from "../lib/api";
import {
  useAddMcp,
  useDeleteMcp,
  useMcps,
  useRestartMcp,
  useUpdateMcp,
} from "../hooks/useMcps";
import { MCPCard } from "../components/MCPCard";
import { MCPToolsModal } from "../components/MCPToolsModal";
import { Button } from "../components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../components/ui/dialog";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { zodResolver } from "@hookform/resolvers/zod";
import { Controller, useForm } from "react-hook-form";
import { z } from "zod";

const mcpSchema = z.object({
  name: z.string().min(1, "Name is required"),
  description: z.string().optional(),
  transport: z.enum(["stdio", "http", "sse"]),
  command: z.string().optional(),
  args: z.string().optional(),
  url: z.string().optional(),
  env: z.string().optional(),
  headers: z.string().optional(),
  labels: z.string().optional(),
  aliases: z.string().optional(),
  cwd: z.string().optional(),
  timeoutMs: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  apiKey: z.string().optional(),
  reconnectIntervalMs: z.preprocess(
    (v) => (v === "" || v == null ? undefined : v),
    z.coerce.number().int().positive().optional(),
  ),
  enabled: z.boolean().default(true),
});

type MCPForm = z.infer<typeof mcpSchema>;

const defaultValues: MCPForm = {
  name: "",
  description: "",
  transport: "stdio",
  command: "",
  args: "",
  url: "",
  env: "",
  headers: "",
  labels: "",
  aliases: "",
  cwd: "",
  timeoutMs: undefined,
  apiKey: "",
  reconnectIntervalMs: undefined,
  enabled: true,
};

function parseLines(text: string): Record<string, string> {
  return Object.fromEntries(
    text
      .split("\n")
      .map((l) => l.trim())
      .filter(Boolean)
      .map((l) => {
        const i = l.indexOf("=");
        return i === -1 ? [l, ""] : [l.slice(0, i), l.slice(i + 1)];
      }),
  );
}

function joinLines(obj?: Record<string, string>): string {
  return obj
    ? Object.entries(obj)
        .map(([k, v]) => `${k}=${v}`)
        .join("\n")
    : "";
}

function MCPFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
  oauthPending,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: MCPForm;
  onSubmit: (data: MCPForm) => Promise<void>;
  oauthPending: string | null;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    control,
    formState: { errors, isSubmitting },
  } = useForm<MCPForm>({
    resolver: zodResolver(mcpSchema),
    defaultValues: initial ?? defaultValues,
  });

  const transport = watch("transport");

  useEffect(() => {
    if (open) reset(initial ?? defaultValues);
  }, [open, initial, reset]);

  const handleFormSubmit = async (data: MCPForm) => {
    if (oauthPending) return;
    await onSubmit(data);
    onOpenChange(false);
    reset(initial ?? defaultValues);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <form
          onSubmit={(e) => {
            void handleSubmit(handleFormSubmit)(e);
          }}
        >
          <DialogHeader>
            <DialogTitle>{initial ? "Edit MCP" : "Add MCP"}</DialogTitle>
            <DialogDescription>
              {oauthPending
                ? "Waiting for OAuth authorization in your browser..."
                : "Configure an MCP server backend."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register("name")} placeholder="my-server" />
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Input
                id="description"
                {...register("description")}
                placeholder="What this MCP does"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport">Transport</Label>
              <Select
                id="transport"
                {...register("transport")}
                options={[
                  { value: "stdio", label: "STDIO" },
                  { value: "http", label: "HTTP" },
                  { value: "sse", label: "SSE" },
                ]}
              />
            </div>
            {transport === "stdio" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="command">Command *</Label>
                  <Input
                    id="command"
                    {...register("command")}
                    placeholder="npx"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="args">Arguments</Label>
                  <Input
                    id="args"
                    {...register("args")}
                    placeholder="-y @modelcontextprotocol/server-filesystem /path"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cwd">Working Directory (cwd)</Label>
                  <Input
                    id="cwd"
                    {...register("cwd")}
                    placeholder="/opt/mcp-server"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env">Environment Variables</Label>
                  <textarea
                    id="env"
                    className="flex min-h-[80px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                    {...register("env")}
                    placeholder={
                      "STRIPE_API_KEY=sk_test_...\nOPENAI_API_KEY=sk-..."
                    }
                  />
                  <p className="text-xs text-morph-muted">
                    One KEY=VALUE per line
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeoutMs">Timeout (ms)</Label>
                  <Input
                    id="timeoutMs"
                    type="number"
                    {...register("timeoutMs")}
                    placeholder="30000"
                  />
                </div>
              </>
            )}
            {transport === "http" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    {...register("url")}
                    placeholder="http://..."
                  />
                  <p className="text-xs text-morph-muted">
                    Running in Docker? <code>localhost</code> refers to the
                    MORPH container itself. To reach a service published on the
                    host machine, use <code>host.docker.internal</code> (e.g.{" "}
                    <code>http://host.docker.internal:9121/mcp</code>).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="apiKey">API Key</Label>
                  <Input
                    id="apiKey"
                    {...register("apiKey")}
                    placeholder="sk-..."
                    type="password"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headers">Headers</Label>
                  <textarea
                    id="headers"
                    className="flex min-h-[80px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                    {...register("headers")}
                    placeholder={
                      "Authorization=Bearer sk_test_...\nX-Custom=value"
                    }
                  />
                  <p className="text-xs text-morph-muted">
                    One Header=Value per line
                  </p>
                </div>
              </>
            )}
            {transport === "sse" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">URL *</Label>
                  <Input
                    id="url"
                    {...register("url")}
                    placeholder="http://..."
                  />
                  <p className="text-xs text-morph-muted">
                    Running in Docker? <code>localhost</code> refers to the
                    MORPH container itself. To reach a service published on the
                    host machine, use <code>host.docker.internal</code> (e.g.{" "}
                    <code>http://host.docker.internal:9121/mcp</code>).
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headers">Headers</Label>
                  <textarea
                    id="headers"
                    className="flex min-h-[80px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                    {...register("headers")}
                    placeholder={
                      "Authorization=Bearer sk_test_...\nX-Custom=value"
                    }
                  />
                  <p className="text-xs text-morph-muted">
                    One Header=Value per line
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reconnectIntervalMs">
                    Reconnect Interval (ms)
                  </Label>
                  <Input
                    id="reconnectIntervalMs"
                    type="number"
                    {...register("reconnectIntervalMs")}
                    placeholder="5000"
                  />
                </div>
              </>
            )}
            <div className="space-y-2">
              <Label htmlFor="labels">Labels</Label>
              <textarea
                id="labels"
                className="flex min-h-[60px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                {...register("labels")}
                placeholder={"team=engineering\ntype=production"}
              />
              <p className="text-xs text-morph-muted">One KEY=VALUE per line</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="aliases">Aliases (tool renames)</Label>
              <textarea
                id="aliases"
                className="flex min-h-[60px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                {...register("aliases")}
                placeholder={"read_file=fs_read\nwrite_file=fs_write"}
              />
              <p className="text-xs text-morph-muted">
                One original_name=alias per line
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Controller
                name="enabled"
                control={control}
                render={({ field }) => (
                  <Switch
                    id="enabled"
                    checked={field.value}
                    onCheckedChange={field.onChange}
                  />
                )}
              />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
          {oauthPending && (
            <div className="flex items-center justify-center gap-2 py-2 text-sm text-morph-muted">
              <Loader2 className="h-4 w-4 animate-spin" />
              Authorizing... Complete the OAuth flow in the popup window.
            </div>
          )}
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting || !!oauthPending}>
              {isSubmitting
                ? "Saving..."
                : oauthPending
                  ? "Waiting..."
                  : initial
                    ? "Save"
                    : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function buildTransport(data: MCPForm): MCPTransport {
  if (data.transport === "stdio") {
    const transport: MCPTransport = {
      type: "stdio",
      command: data.command ?? "",
      args: data.args ? data.args.split(/\s+/) : [],
    };
    if (data.env) transport.env = parseLines(data.env);
    if (data.cwd) transport.cwd = data.cwd;
    if (data.timeoutMs) transport.timeoutMs = data.timeoutMs;
    return transport;
  }
  const base = { type: data.transport, url: data.url ?? "" };
  if (data.headers)
    (base as Record<string, unknown>).headers = parseLines(data.headers);
  if (data.transport === "http" && data.apiKey)
    (base as Record<string, unknown>).apiKey = data.apiKey;
  if (data.transport === "sse" && data.reconnectIntervalMs)
    (base as Record<string, unknown>).reconnectIntervalMs =
      data.reconnectIntervalMs;
  return base;
}

export function Mcps() {
  const { data: mcps, isLoading } = useMcps();
  const addMcp = useAddMcp();
  const deleteMcp = useDeleteMcp();
  const restartMcp = useRestartMcp();
  const updateMcp = useUpdateMcp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MCPForm | null>(null);
  // Carried across an edit so saving via the main dialog doesn't drop the
  // per-tool field selection (which is edited in the Tools modal).
  const [editingFieldSelection, setEditingFieldSelection] = useState<
    MCPConfig["fieldSelection"]
  >(undefined);
  const [oauthAdding, setOauthAdding] = useState<string | null>(null);
  const [toolsMcp, setToolsMcp] = useState<MCPStatus | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      const data = e.data as { type?: string } | null;
      if (data?.type === "mcp-oauth") setOauthAdding(null);
    };
    window.addEventListener("message", handler);
    return () => {
      window.removeEventListener("message", handler);
    };
  }, []);

  const handleAdd = async (data: MCPForm) => {
    const transport = buildTransport(data);
    const name = data.name;
    const payload: MCPConfig = {
      name,
      enabled: data.enabled,
      transport,
      ...(data.description ? { description: data.description } : {}),
      ...(data.labels ? { labels: parseLines(data.labels) } : {}),
      ...(data.aliases ? { aliases: parseLines(data.aliases) } : {}),
    };
    // Open the popup synchronously, while we still hold the user's gesture
    // (transient activation). Browsers block window.open from setTimeout/async
    // callbacks. We navigate it to the OAuth URL once known, or close it.
    const popup = window.open("about:blank", "oauth", "width=600,height=700");

    try {
      await addMcp.mutateAsync(payload);
      toast.success(`Added MCP "${name}"`);
    } catch {
      toast.error(`Failed to add MCP "${name}"`);
      popup?.close();
      return;
    }

    const oauthStatus = await api.oauthStatus(name).catch(() => null);
    if (!oauthStatus?.oauthNeeded || !oauthStatus.oauthUrl) {
      popup?.close();
      return;
    }

    if (!popup) {
      toast.error(
        `Popup blocked. Allow popups for this site, then edit "${name}" to authorize.`,
      );
      return;
    }

    popup.location.href = oauthStatus.oauthUrl;
    setOauthAdding(name);
    await new Promise<void>((resolve) => {
      const timer = setInterval(() => {
        void (async () => {
          if (popup.closed) {
            clearInterval(timer);
            setOauthAdding(null);
            resolve();
            return;
          }
          const status = await api.oauthStatus(name).catch(() => null);
          if (status?.authorized || status?.oauthHasToken) {
            clearInterval(timer);
            popup.close();
            setOauthAdding(null);
            resolve();
          }
        })();
      }, 1000);
      setTimeout(() => {
        clearInterval(timer);
        setOauthAdding(null);
        resolve();
      }, 120000);
    });
  };

  const handleDelete = async (name: string) => {
    await deleteMcp.mutateAsync(name);
    toast.success(`Deleted MCP "${name}"`);
  };

  const handleEditClick = async (name: string) => {
    const cfg = await api.mcpConfig(name);
    if (!cfg) {
      toast.error(`Config not found for "${name}"`);
      return;
    }
    const t = cfg.transport;
    const form: MCPForm = {
      name: cfg.name,
      description: cfg.description ?? "",
      transport: t.type,
      command: t.type === "stdio" ? (t as { command: string }).command : "",
      args:
        t.type === "stdio"
          ? ((t as { args?: string[] }).args ?? []).join(" ")
          : "",
      url: t.type !== "stdio" ? t.url : "",
      env:
        t.type === "stdio"
          ? joinLines((t as { env?: Record<string, string> }).env)
          : "",
      headers:
        t.type !== "stdio"
          ? joinLines((t as { headers?: Record<string, string> }).headers)
          : "",
      labels: joinLines(cfg.labels),
      aliases: joinLines(cfg.aliases),
      cwd: t.type === "stdio" ? ((t as { cwd?: string }).cwd ?? "") : "",
      timeoutMs:
        t.type === "stdio"
          ? (t as { timeoutMs?: number }).timeoutMs
          : undefined,
      apiKey:
        t.type === "http" ? ((t as { apiKey?: string }).apiKey ?? "") : "",
      reconnectIntervalMs:
        t.type === "sse"
          ? (t as { reconnectIntervalMs?: number }).reconnectIntervalMs
          : undefined,
      enabled: cfg.enabled,
    };
    setEditingFieldSelection(cfg.fieldSelection);
    setEditingConfig(form);
    setDialogOpen(true);
  };

  const handleUpdate = async (data: MCPForm) => {
    if (!editingConfig) return;
    const transport = buildTransport(data);
    try {
      await updateMcp.mutateAsync({
        name: editingConfig.name,
        cfg: {
          name: data.name,
          enabled: data.enabled,
          transport,
          ...(data.description ? { description: data.description } : {}),
          ...(data.labels ? { labels: parseLines(data.labels) } : {}),
          ...(data.aliases ? { aliases: parseLines(data.aliases) } : {}),
          ...(editingFieldSelection
            ? { fieldSelection: editingFieldSelection }
            : {}),
        },
      });
      toast.success(`Updated MCP "${data.name}"`);
    } catch {
      toast.error(`Failed to update MCP "${data.name}"`);
    }
  };

  if (isLoading) {
    return <div className="text-morph-muted">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MCP Servers</h1>
        <Button
          onClick={() => {
            setEditingConfig(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="h-4 w-4" /> Add MCP
        </Button>
      </div>

      <MCPFormDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditingConfig(null);
        }}
        initial={editingConfig ?? undefined}
        onSubmit={editingConfig ? handleUpdate : handleAdd}
        oauthPending={oauthAdding}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mcps?.map((m) => (
          <MCPCard
            key={m.name}
            mcp={m}
            onDelete={(name) => {
              void handleDelete(name);
            }}
            onRestart={(name) => {
              void restartMcp.mutateAsync(name);
            }}
            onTools={() => {
              setToolsMcp(m);
            }}
            onEdit={(name) => {
              void handleEditClick(name);
            }}
          />
        ))}
        {mcps?.length === 0 && (
          <p className="text-sm text-morph-muted col-span-full">
            No MCP servers configured. Click "Add MCP" to get started.
          </p>
        )}
      </div>

      <MCPToolsModal
        mcp={toolsMcp}
        open={!!toolsMcp}
        onOpenChange={(v) => {
          if (!v) setToolsMcp(null);
        }}
      />
    </div>
  );
}

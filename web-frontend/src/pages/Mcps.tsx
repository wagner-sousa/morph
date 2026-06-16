import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Plus } from 'lucide-react';
import { api, type MCPConfig, type MCPTransport } from '../lib/api';
import { useAddMcp, useDeleteMcp, useMcps, useRestartMcp, useUpdateMcp } from '../hooks/useMcps';
import { MCPCard } from '../components/MCPCard';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';

const mcpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  transport: z.enum(['stdio', 'http', 'sse']),
  command: z.string().optional(),
  args: z.string().optional(),
  url: z.string().optional(),
  env: z.string().optional(),
  headers: z.string().optional(),
  enabled: z.boolean().default(true),
});

type MCPForm = z.infer<typeof mcpSchema>;

const defaultValues: MCPForm = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  env: '',
  headers: '',
  enabled: true,
};

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

  const transport = watch('transport');

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
      <DialogContent>
        <form onSubmit={handleSubmit(handleFormSubmit)}>
          <DialogHeader>
            <DialogTitle>{initial ? 'Edit MCP' : 'Add MCP'}</DialogTitle>
            <DialogDescription>
              {oauthPending
                ? 'Waiting for OAuth authorization in your browser...'
                : 'Configure an MCP server backend.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input id="name" {...register('name')} placeholder="my-server" />
              {errors.name && (
                <p className="text-xs text-red-400">{errors.name.message}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="transport">Transport</Label>
              <Select
                id="transport"
                {...register('transport')}
                options={[
                  { value: 'stdio', label: 'STDIO' },
                  { value: 'http', label: 'HTTP' },
                  { value: 'sse', label: 'SSE' },
                ]}
              />
            </div>
            {transport === 'stdio' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="command">Command</Label>
                  <Input id="command" {...register('command')} placeholder="npx" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="args">Arguments</Label>
                  <Input id="args" {...register('args')} placeholder="-y @modelcontextprotocol/server-filesystem /path" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="env">Environment Variables</Label>
                  <textarea
                    id="env"
                    className="flex min-h-[80px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                    {...register('env')}
                    placeholder={"STRIPE_API_KEY=sk_test_...\nOPENAI_API_KEY=sk-..."}
                  />
                  <p className="text-xs text-morph-muted">One KEY=VALUE per line</p>
                </div>
              </>
            )}
            {transport !== 'stdio' && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="url">URL</Label>
                  <Input id="url" {...register('url')} placeholder="http://..." />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="headers">Headers</Label>
                  <textarea
                    id="headers"
                    className="flex min-h-[80px] w-full rounded-md border border-morph-border bg-morph-bg px-3 py-2 text-sm font-mono text-morph-text shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-morph-accent"
                    {...register('headers')}
                    placeholder={"Authorization=Bearer sk_test_...\nX-Custom=value"}
                  />
                  <p className="text-xs text-morph-muted">One Header=Value per line</p>
                </div>
              </>
            )}
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
              {isSubmitting ? 'Adding...' : oauthPending ? 'Waiting...' : (initial ? 'Save' : 'Add')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function Mcps() {
  const { data: mcps, isLoading } = useMcps();
  const addMcp = useAddMcp();
  const deleteMcp = useDeleteMcp();
  const restartMcp = useRestartMcp();
  const updateMcp = useUpdateMcp();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingConfig, setEditingConfig] = useState<MCPForm | null>(null);
  const [oauthAdding, setOauthAdding] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'mcp-oauth') {
        setOauthAdding(null);
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, []);

  const handleAdd = async (data: MCPForm) => {
    const transport: MCPTransport =
      data.transport === 'stdio'
        ? {
            type: 'stdio',
            command: data.command!,
            args: data.args ? data.args.split(/\s+/) : [],
            ...(data.env
              ? {
                  env: Object.fromEntries(
                    data.env
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((l) => {
                        const i = l.indexOf('=');
                        return i === -1 ? [l, ''] : [l.slice(0, i), l.slice(i + 1)];
                      }),
                  ),
                }
              : {}),
          }
        : {
            type: data.transport as 'http' | 'sse',
            url: data.url!,
            ...(data.headers
              ? {
                  headers: Object.fromEntries(
                    data.headers
                      .split('\n')
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .map((l) => {
                        const i = l.indexOf('=');
                        return i === -1 ? [l, ''] : [l.slice(0, i), l.slice(i + 1)];
                      }),
                  ),
                }
              : {}),
          };
    const name = data.name;
    const payload: MCPConfig = { name, enabled: data.enabled, transport };
    try {
      await addMcp.mutateAsync(payload);
      toast.success(`Added MCP "${name}"`);
    } catch {
      toast.error(`Failed to add MCP "${name}"`);
      return;
    }
    await new Promise<void>((resolve) => {
      setTimeout(async () => {
        const oauthStatus = await api.oauthStatus(name).catch(() => null);
        if (oauthStatus?.oauthNeeded && oauthStatus.oauthUrl) {
          setOauthAdding(name);
          const popup = window.open(oauthStatus.oauthUrl, 'oauth', 'width=600,height=700');
          if (popup) {
            const timer = setInterval(async () => {
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
            }, 1000);
            setTimeout(() => { clearInterval(timer); setOauthAdding(null); resolve(); }, 120000);
            return;
          }
          setOauthAdding(null);
        }
        resolve();
      }, 1000);
    });
  };

  const handleDelete = async (name: string) => {
    await deleteMcp.mutateAsync(name);
    toast.success(`Deleted MCP "${name}"`);
  };

  const handleEditClick = async (name: string) => {
    const cfg = await api.mcpConfig(name);
    if (!cfg) { toast.error(`Config not found for "${name}"`); return; }
    const form: MCPForm = {
      name: cfg.name,
      transport: cfg.transport.type,
      command: cfg.transport.type === 'stdio' ? cfg.transport.command : '',
      args: cfg.transport.type === 'stdio' ? cfg.transport.args?.join(' ') ?? '' : '',
      url: cfg.transport.type !== 'stdio' ? cfg.transport.url : '',
      env: cfg.transport.type === 'stdio' && 'env' in cfg.transport
        ? Object.entries((cfg.transport as { env?: Record<string, string> }).env ?? {}).map(([k, v]) => `${k}=${v}`).join('\n')
        : '',
      headers: cfg.transport.type !== 'stdio' && 'headers' in cfg.transport
        ? Object.entries((cfg.transport as { headers?: Record<string, string> }).headers ?? {}).map(([k, v]) => `${k}=${v}`).join('\n')
        : '',
      enabled: cfg.enabled,
    };
    setEditingConfig(form);
    setDialogOpen(true);
  };

  const handleUpdate = async (data: MCPForm) => {
    if (!editingConfig) return;
    const transport: MCPTransport =
      data.transport === 'stdio'
        ? {
            type: 'stdio',
            command: data.command!,
            args: data.args ? data.args.split(/\s+/) : [],
            ...(data.env
              ? {
                  env: Object.fromEntries(
                    data.env.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                      const i = l.indexOf('=');
                      return i === -1 ? [l, ''] : [l.slice(0, i), l.slice(i + 1)];
                    }),
                  ),
                }
              : {}),
          }
        : {
            type: data.transport as 'http' | 'sse',
            url: data.url!,
            ...(data.headers
              ? {
                  headers: Object.fromEntries(
                    data.headers.split('\n').map((l) => l.trim()).filter(Boolean).map((l) => {
                      const i = l.indexOf('=');
                      return i === -1 ? [l, ''] : [l.slice(0, i), l.slice(i + 1)];
                    }),
                  ),
                }
              : {}),
          };
    try {
      await updateMcp.mutateAsync({ name: editingConfig.name, cfg: { name: data.name, enabled: data.enabled, transport } });
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
          <Button onClick={() => { setEditingConfig(null); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" />
            Add MCP
          </Button>
      </div>

      <MCPFormDialog
        open={dialogOpen}
        onOpenChange={(v) => { setDialogOpen(v); if (!v) setEditingConfig(null); }}
        initial={editingConfig ?? undefined}
        onSubmit={editingConfig ? handleUpdate : handleAdd}
        oauthPending={oauthAdding}
      />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mcps?.map((m) => (
          <MCPCard key={m.name} mcp={m} onDelete={handleDelete} onRestart={(name) => restartMcp.mutateAsync(name)} onTools={() => {}} onEdit={handleEditClick} />
        ))}
        {mcps?.length === 0 && (
          <p className="text-sm text-morph-muted col-span-full">
            No MCP servers configured. Click "Add MCP" to get started.
          </p>
        )}
      </div>
    </div>
  );
}

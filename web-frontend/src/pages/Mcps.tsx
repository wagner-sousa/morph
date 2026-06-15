import { useState } from 'react';
import { Plus } from 'lucide-react';
import { type MCPConfig } from '../lib/api';
import { useAddMcp, useDeleteMcp, useMcps } from '../hooks/useMcps';
import { MCPCard } from '../components/MCPCard';
import { Button } from '../components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '../components/ui/dialog';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Switch } from '../components/ui/switch';
import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const mcpSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  transport: z.enum(['stdio', 'http', 'sse']),
  command: z.string().optional(),
  args: z.string().optional(),
  url: z.string().optional(),
  enabled: z.boolean().default(true),
});

type MCPForm = z.infer<typeof mcpSchema>;

const defaultValues: MCPForm = {
  name: '',
  transport: 'stdio',
  command: '',
  args: '',
  url: '',
  enabled: true,
};

function MCPFormDialog({
  open,
  onOpenChange,
  initial,
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initial?: MCPForm;
  onSubmit: (data: MCPForm) => Promise<void>;
}) {
  const {
    register,
    handleSubmit,
    watch,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<MCPForm>({
    resolver: zodResolver(mcpSchema),
    defaultValues: initial ?? defaultValues,
  });

  const transport = watch('transport');

  const handleFormSubmit = async (data: MCPForm) => {
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
              Configure an MCP server backend.
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
              </>
            )}
            {transport !== 'stdio' && (
              <div className="space-y-2">
                <Label htmlFor="url">URL</Label>
                <Input id="url" {...register('url')} placeholder="http://..." />
              </div>
            )}
            <div className="flex items-center gap-2">
              <Switch id="enabled" {...register('enabled')} />
              <Label htmlFor="enabled">Enabled</Label>
            </div>
          </div>
          <DialogFooter>
            <Button type="submit" disabled={isSubmitting}>
              {initial ? 'Save' : 'Add'}
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
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleAdd = async (data: MCPForm) => {
    const payload: MCPConfig = {
      name: data.name,
      transport: data.transport,
      enabled: data.enabled,
      command: data.command || undefined,
      args: data.args ? data.args.split(/\s+/) : undefined,
      url: data.url || undefined,
    };
    await addMcp.mutateAsync(payload);
  };

  const handleDelete = async (name: string) => {
    if (confirm(`Delete MCP "${name}"?`)) {
      await deleteMcp.mutateAsync(name);
    }
  };

  if (isLoading) {
    return <div className="text-morph-muted">Loading...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">MCP Servers</h1>
        <DialogTrigger asChild>
          <Button onClick={() => setDialogOpen(true)}>
            <Plus className="h-4 w-4" />
            Add MCP
          </Button>
        </DialogTrigger>
      </div>

      <MCPFormDialog open={dialogOpen} onOpenChange={setDialogOpen} onSubmit={handleAdd} />

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {mcps?.map((m) => (
          <div key={m.name} className="relative group">
            <MCPCard mcp={m} />
            <Button
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
              onClick={() => handleDelete(m.name)}
            >
              Delete
            </Button>
          </div>
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

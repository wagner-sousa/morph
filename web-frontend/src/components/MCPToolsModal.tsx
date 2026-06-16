import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { type MCPStatus, api } from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';

interface ToolInfo {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
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
  const { data: tools, isLoading } = useQuery<ToolInfo[]>({
    queryKey: ['mcp-tools', mcp?.name],
    queryFn: () => api.tools(mcp!.name),
    enabled: !!mcp && open,
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
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
          <div className="space-y-4">
            {tools.map((tool) => (
              <div key={tool.name} className="rounded-md border border-morph-border p-3 space-y-2">
                <div className="flex items-center gap-2">
                  <code className="text-sm font-semibold">{tool.name}</code>
                  {tool.description && (
                    <span className="text-xs text-morph-muted">{tool.description}</span>
                  )}
                </div>
                {tool.inputSchema && Object.keys(tool.inputSchema).length > 0 && (
                  <pre className="text-xs bg-morph-bg p-2 rounded overflow-x-auto">
                    {JSON.stringify(tool.inputSchema, null, 2)}
                  </pre>
                )}
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

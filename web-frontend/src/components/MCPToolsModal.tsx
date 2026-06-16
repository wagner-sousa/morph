import { useQuery } from '@tanstack/react-query';
import { Loader2 } from 'lucide-react';
import { type MCPStatus, api } from '../lib/api';
import { Badge } from './ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from './ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';

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
  const props = schema?.properties as Record<string, { type?: string; description?: string }> | undefined;
  const required = (schema?.required as string[]) ?? [];

  return (
    <div className="rounded-md border border-morph-border p-3 space-y-2">
      <div className="flex items-center gap-2">
        <code className="text-sm font-semibold">{tool.name}</code>
        {tool.description && (
          <span className="text-xs text-morph-muted truncate">{tool.description}</span>
        )}
      </div>
      {props && Object.keys(props).length > 0 && (
        <div className="space-y-1 text-xs font-mono">
          {Object.entries(props).map(([key, val]) => (
            <div key={key} className="flex gap-2">
              <span className="text-morph-accent">{key}</span>
              <span className="text-morph-muted">{val?.type ?? 'any'}</span>
              {required.includes(key) && (
                <Badge variant="secondary" className="text-[10px] px-1 py-0">required</Badge>
              )}
              {val?.description && (
                <span className="text-morph-muted truncate">{val.description}</span>
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
    queryKey: ['mcp-tools', mcp?.name],
    queryFn: () => api.tools(mcp!.name) as unknown as Promise<ToolInfo[]>,
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
          <Tabs defaultValue="toon" className="flex-1 flex flex-col">
            <TabsList className="self-start">
              <TabsTrigger value="toon">TOON</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            <TabsContent value="toon" className="flex-1 overflow-y-auto space-y-4 pr-1">
              {tools.map((tool) => (
                <ToolCardToon key={tool.name} tool={tool} />
              ))}
            </TabsContent>
            <TabsContent value="json" className="flex-1 overflow-y-auto space-y-4 pr-1">
              {tools.map((tool) => (
                <ToolCardJson key={tool.name} tool={tool} />
              ))}
            </TabsContent>
          </Tabs>
        )}
      </DialogContent>
    </Dialog>
  );
}

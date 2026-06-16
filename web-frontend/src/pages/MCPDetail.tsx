import { useParams, useRouter } from '@tanstack/react-router';
import { ArrowLeft, RefreshCw, Trash2 } from 'lucide-react';
import { useDeleteMcp, useMcp, useRestartMcp } from '../hooks/useMcps';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function MCPDetail() {
  const { name } = useParams({ from: '/mcps/$name' });
  const router = useRouter();
  const { data: mcp, isLoading } = useMcp(name);
  const restart = useRestartMcp();
  const del = useDeleteMcp();

  const handleDelete = async () => {
    if (confirm(`Delete MCP "${name}"?`)) {
      await del.mutateAsync(name);
      router.navigate({ to: '/mcps' });
    }
  };

  if (isLoading) {
    return <div className="text-morph-muted">Loading...</div>;
  }

  if (!mcp) {
    return <div className="text-morph-muted">MCP not found.</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => router.navigate({ to: '/mcps' })}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-2xl font-bold">{mcp.name}</h1>
        <Badge
          variant={
            mcp.status === 'connected'
              ? 'success'
              : mcp.status === 'connecting'
                ? 'warning'
                : 'destructive'
          }
        >
          {mcp.status}
        </Badge>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-morph-muted">Transport</span>
              <span>{mcp.transport}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Tools</span>
              <span>{mcp.toolCount}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Latency</span>
              <span>{mcp.latencyMs != null ? `${mcp.latencyMs}ms` : '—'}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Enabled</span>
              <span>{mcp.enabled ? 'Yes' : 'No'}</span>
            </div>
            {mcp.lastError && (
              <div className="text-red-400 text-xs mt-2">Last error: {mcp.lastError}</div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button
              className="w-full"
              variant="outline"
              onClick={() => restart.mutateAsync(mcp.name)}
              disabled={restart.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              Restart
            </Button>
            <Button
              className="w-full"
              variant="destructive"
              onClick={handleDelete}
              disabled={del.isPending}
            >
              <Trash2 className="h-4 w-4" />
              Delete
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

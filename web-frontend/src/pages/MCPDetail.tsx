import { useParams, useRouter } from '@tanstack/react-router';
import { ArrowLeft, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { api } from '../lib/api';
import { useDeleteMcp, useMcp, useRestartMcp } from '../hooks/useMcps';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function MCPDetail() {
  const { name } = useParams({ from: '/mcps/$name' });
  const router = useRouter();
  const { data: mcp, isLoading, refetch } = useMcp(name);
  const restart = useRestartMcp();
  const del = useDeleteMcp();
  const [oauthMsg, setOauthMsg] = useState<string | null>(() => {
    const params = new URLSearchParams(window.location.search);
    const oauth = params.get('oauth');
    if (oauth === 'success' || oauth === 'error' || oauth === 'denied') {
      setTimeout(() => {
        const url = new URL(window.location.href);
        url.searchParams.delete('oauth');
        window.history.replaceState({}, '', url.toString());
      }, 100);
      return oauth;
    }
    return null;
  });

  useEffect(() => {
    if (oauthMsg) {
      setTimeout(() => refetch(), 1000);
    }
  }, [oauthMsg, refetch]);

  const handleDelete = async () => {
    await del.mutateAsync(name);
    toast.success(`Deleted MCP "${name}"`);
    router.navigate({ to: '/mcps' });
  };

  const handleOAuth = async () => {
    try {
      const result = await api.oauthStart(name);
      if (result.authorizationUrl) window.open(result.authorizationUrl, '_blank');
    } catch { }
  };

  if (isLoading) {
    return <div className="text-morph-muted">Loading...</div>;
  }

  if (!mcp) {
    return <div className="text-morph-muted">MCP not found.</div>;
  }

  const needsOAuth = mcp.oauthNeeded && !mcp.oauthHasToken;

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

      {oauthMsg === 'success' && (
        <div className="p-3 rounded-md bg-green-500/10 text-green-400 text-sm">
          OAuth authorization successful! Reconnecting...
        </div>
      )}
      {oauthMsg === 'error' && (
        <div className="p-3 rounded-md bg-red-500/10 text-red-400 text-sm">
          OAuth authorization failed. Please try again.
        </div>
      )}
      {oauthMsg === 'denied' && (
        <div className="p-3 rounded-md bg-yellow-500/10 text-yellow-400 text-sm">
          OAuth authorization was denied.
        </div>
      )}

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
            <div className="flex justify-between">
              <span className="text-morph-muted">OAuth</span>
              <span>{mcp.oauthHasToken ? 'Authorized' : needsOAuth ? 'Required' : 'N/A'}</span>
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
              onClick={() => { restart.mutateAsync(mcp.name); toast.success(`Restarted MCP "${mcp.name}"`); }}
              disabled={restart.isPending}
            >
              <RefreshCw className="h-4 w-4" />
              Restart
            </Button>
            {needsOAuth && (
              <Button className="w-full" variant="default" onClick={handleOAuth}>
                <Shield className="h-4 w-4" />
                Authorize with OAuth
              </Button>
            )}
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

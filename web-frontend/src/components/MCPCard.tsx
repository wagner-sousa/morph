import { Link } from '@tanstack/react-router';
import { RefreshCw, Shield } from 'lucide-react';
import { type MCPStatus, api } from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';

const statusVariant = (s: string) => {
  switch (s) {
    case 'connected': return 'success' as const;
    case 'connecting': return 'warning' as const;
    case 'disabled': return 'secondary' as const;
    default: return 'destructive' as const;
  }
};

export function MCPCard({ mcp }: { mcp: MCPStatus }) {
  const needsOAuth = mcp.oauthNeeded && !mcp.oauthHasToken;

  const handleOAuth = async () => {
    try {
      const result = await api.oauthStart(mcp.name);
      if (result.authorizationUrl) window.open(result.authorizationUrl, '_blank');
    } catch { }
  };

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between space-y-0 pb-2">
        <Link to="/mcps/$name" params={{ name: mcp.name }} className="hover:underline">
          <CardTitle className="text-sm">{mcp.name}</CardTitle>
        </Link>
        <Badge variant={statusVariant(mcp.status)}>{mcp.status}</Badge>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-morph-muted space-y-1">
          <div>Transport: {mcp.transport}</div>
          <div>Tools: {mcp.toolCount}</div>
          <div>Latency: {mcp.latencyMs != null ? `${mcp.latencyMs}ms` : '—'}</div>
          {mcp.lastError && <div className="text-red-400">Error: {mcp.lastError}</div>}
        </div>
        <div className="flex gap-2 mt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void api.restartMcp(mcp.name)}
          >
            <RefreshCw className="h-3 w-3" />
            Restart
          </Button>
          {needsOAuth && (
            <Button variant="outline" size="sm" onClick={handleOAuth}>
              <Shield className="h-3 w-3" />
              Authorize
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

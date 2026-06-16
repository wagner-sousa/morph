import { Link } from '@tanstack/react-router';
import { List, RefreshCw, Shield, Trash2 } from 'lucide-react';
import { type MCPStatus, api } from '../lib/api';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Tooltip, TooltipContent, TooltipTrigger } from './ui/tooltip';

const statusVariant = (s: string) => {
  switch (s) {
    case 'connected': return 'success' as const;
    case 'connecting': return 'warning' as const;
    case 'disabled': return 'secondary' as const;
    default: return 'destructive' as const;
  }
};

interface MCPCardProps {
  mcp: MCPStatus;
  onDelete?: (name: string) => void;
  onRestart?: (name: string) => void;
  onTools?: (name: string) => void;
  onEdit?: (name: string) => void;
}

export function MCPCard({ mcp, onDelete, onRestart, onTools, onEdit }: MCPCardProps) {
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
      <CardContent className="flex flex-col h-full">
        <div className="flex-1 text-xs text-morph-muted space-y-1 cursor-pointer" onClick={() => onEdit?.(mcp.name)}>
          <div>Transport: {mcp.transport}</div>
          <div>Tools: {mcp.toolCount}</div>
          <div>Latency: {mcp.latencyMs != null ? `${mcp.latencyMs}ms` : '—'}</div>
          {mcp.lastError && <div className="text-red-400">Error: {mcp.lastError}</div>}
        </div>
        <div className="flex items-center gap-1 pt-3 border-t border-morph-border mt-3">
          {onRestart && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onRestart(mcp.name)}>
                  <RefreshCw className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Restart</TooltipContent>
            </Tooltip>
          )}
          {onTools && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onTools(mcp.name)}>
                  <List className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>View Tools</TooltipContent>
            </Tooltip>
          )}
          {needsOAuth && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleOAuth}>
                  <Shield className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Authorize</TooltipContent>
            </Tooltip>
          )}
          {onDelete && (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button variant="ghost" size="icon" className="h-7 w-7 ml-auto text-red-400 hover:text-red-300" onClick={() => onDelete(mcp.name)}>
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>Delete</TooltipContent>
            </Tooltip>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

import { useQuery } from '@tanstack/react-query';
import { useParams, Link } from '@tanstack/react-router';
import { api } from '../lib/api';
import { Badge } from '../components/ui/badge';
import { Button } from '../components/ui/button';

function levelVariant(lvl: string) {
  switch (lvl) {
    case 'error': return 'destructive' as const;
    case 'warn': return 'warning' as const;
    default: return 'secondary' as const;
  }
}

export function LogDetail() {
  const { id } = useParams({ from: '/logs/$id' });
  const { data, isLoading, error } = useQuery({
    queryKey: ['log', id],
    queryFn: () => api.log(Number(id)),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error || !data) return <div className="p-6 text-red-500">Log not found.</div>;

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/logs">
          <Button variant="outline" size="sm">&larr; Back</Button>
        </Link>
        <h1 className="text-2xl font-bold">Log #{data.id}</h1>
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-md border border-morph-border p-4">
        <div><span className="text-morph-muted">MCP:</span> {data.mcpName}</div>
        <div><span className="text-morph-muted">Tool:</span> <code className="font-mono text-xs">{data.toolName}</code></div>
        <div><span className="text-morph-muted">Level:</span> <Badge variant={levelVariant(data.level)}>{data.level}</Badge></div>
        <div><span className="text-morph-muted">Time:</span> {new Date(data.createdAt).toLocaleString()}</div>
        <div><span className="text-morph-muted">Duration:</span> {data.durationMs != null ? `${data.durationMs}ms` : '\u2014'}</div>
        <div><span className="text-morph-muted">Tokens Saved:</span> {data.tokensSaved ?? '\u2014'}</div>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Message</h2>
        <pre className="whitespace-pre-wrap rounded-md bg-morph-bg-alt p-3 text-sm">{data.message}</pre>
      </div>

      {data.inputJson && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Input</h2>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-morph-bg-alt p-3 font-mono text-xs">{data.inputJson}</pre>
        </div>
      )}

      {data.outputText && (
        <div>
          <h2 className="mb-2 text-lg font-semibold">Output</h2>
          <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded-md bg-morph-bg-alt p-3 font-mono text-xs">{data.outputText}</pre>
        </div>
      )}
    </div>
  );
}

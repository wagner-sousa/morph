import { useEffect, useState } from 'react';
import { type LogEntry, type MCPStatus, type Stats, api } from '../lib/api';
import { useWebSocket, type WsMessage } from '../lib/ws';
import { LogStream } from '../components/LogStream';
import { TOONStats } from '../components/TOONStats';
import { MCPCard } from '../components/MCPCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/card';

export function Dashboard() {
  const [mcps, setMcps] = useState<MCPStatus[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [version, setVersion] = useState('');

  const refresh = async () => {
    try {
      const [m, s, l, v] = await Promise.all([
        api.mcps(),
        api.stats(),
        api.logs(),
        api.version(),
      ]);
      setMcps(m);
      setStats(s);
      setLogs(l);
      setVersion(v.version);
    } catch {
      /* backend not ready */
    }
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, []);

  const onWs = (msg: WsMessage) => {
    if (msg.channel === 'stats') setStats(msg.data as Stats);
    if (msg.channel === 'logs') setLogs((prev) => [msg.data as LogEntry, ...prev].slice(0, 50));
    if (msg.channel === 'health') void refresh();
  };
  useWebSocket(onWs);

  const online = mcps.filter((m) => m.status === 'connected').length;
  const tools = mcps.reduce((n, m) => n + m.toolCount, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-sm text-morph-muted">v{version}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">MCPs Online</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {online}/{mcps.length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">Tools</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{tools}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">Total Calls</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats?.totalCalls ?? 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">Tokens Saved</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalTokensSaved ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-morph-muted mt-1">
              avg {stats?.avgSavingsPercent ?? 0}% savings
            </p>
          </CardContent>
        </Card>
      </div>

      <TOONStats stats={stats ?? undefined} />

      <section>
        <h2 className="text-lg font-semibold mb-3">MCP Servers</h2>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {mcps.map((m) => (
            <MCPCard key={m.name} mcp={m} />
          ))}
          {mcps.length === 0 && (
            <p className="text-sm text-morph-muted col-span-full">No MCP servers configured.</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent Calls</h2>
        <LogStream initial={logs} />
      </section>
    </div>
  );
}

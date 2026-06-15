import { useCallback, useEffect, useState } from 'react';
import { api, type LogEntry, type MCPStatus, type Stats } from './api.ts';
import { useWebSocket, type WsMessage } from './useWebSocket.ts';

const statusDot = (s: string) =>
  s === 'connected' ? '🟢' : s === 'connecting' ? '🟡' : s === 'disabled' ? '⚪' : '🔴';

export function App() {
  const [mcps, setMcps] = useState<MCPStatus[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [version, setVersion] = useState('');

  const refresh = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void refresh();
    const t = setInterval(refresh, 5000);
    return () => clearInterval(t);
  }, [refresh]);

  const onWs = useCallback((msg: WsMessage) => {
    if (msg.channel === 'stats') setStats(msg.data as Stats);
    if (msg.channel === 'logs') setLogs((prev) => [msg.data as LogEntry, ...prev].slice(0, 50));
    if (msg.channel === 'health') void refresh();
  }, [refresh]);

  const live = useWebSocket(onWs);

  const online = mcps.filter((m) => m.status === 'connected').length;
  const tools = mcps.reduce((n, m) => n + m.toolCount, 0);

  return (
    <div className="app">
      <header>
        <h1>MORPH ◆ Studio</h1>
        <span className="meta">
          v{version} · {live ? '🟢 live' : '🔴 offline'}
        </span>
      </header>

      <section className="cards">
        <Card label="MCPs" value={`${online}/${mcps.length} online`} />
        <Card label="Tools" value={String(tools)} />
        <Card label="Calls" value={String(stats?.totalCalls ?? 0)} />
        <Card
          label="Tokens Saved"
          value={`${(stats?.totalTokensSaved ?? 0).toLocaleString()} 🎯`}
          sub={stats ? `avg ${stats.avgSavingsPercent}%` : undefined}
        />
      </section>

      <section className="panel">
        <h2>MCP Status</h2>
        <table>
          <tbody>
            {mcps.map((m) => (
              <tr key={m.name}>
                <td>{statusDot(m.status)} {m.name}</td>
                <td>{m.transport}</td>
                <td>{m.toolCount} tools</td>
                <td>{m.latencyMs != null ? `${m.latencyMs}ms` : '—'}</td>
                <td>
                  <button onClick={() => void api.restart(m.name).then(refresh)}>restart</button>
                </td>
              </tr>
            ))}
            {mcps.length === 0 && <tr><td>No MCP servers configured.</td></tr>}
          </tbody>
        </table>
      </section>

      <section className="panel">
        <h2>Recent Calls</h2>
        <table>
          <tbody>
            {logs.map((l) => (
              <tr key={l.id}>
                <td>{new Date(l.createdAt).toLocaleTimeString()}</td>
                <td>{l.toolName}</td>
                <td>{l.level === 'error' ? '❌' : '✅'}</td>
                <td>{l.durationMs ?? 0}ms</td>
                <td>{l.tokensSaved ? `${l.tokensSaved} tok` : '—'}</td>
              </tr>
            ))}
            {logs.length === 0 && <tr><td>No calls yet.</td></tr>}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card">
      <div className="card-label">{label}</div>
      <div className="card-value">{value}</div>
      {sub && <div className="card-sub">{sub}</div>}
    </div>
  );
}

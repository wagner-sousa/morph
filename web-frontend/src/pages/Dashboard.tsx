import { useEffect, useState } from "react";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { type MCPStatus, type Stats, api } from "../lib/api";
import { useWebSocket, type WsMessage } from "../lib/ws";
import { TOONStats } from "../components/TOONStats";
import { OutputFormatStats } from "../components/OutputFormatStats";
import { TokensByType } from "../components/TokensByType";
import { CallsByTool } from "../components/CallsByTool";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const MCP_COLORS = ["#5eead4", "#14b8a6", "#0d9488", "#2dd4bf", "#0f766e"];

type TokensByTypeRow = { type: string; tokens: number; calls: number };
type CallsByToolRow = {
  mcp: string;
  tool: string;
  calls: number;
  tokensIn: number;
  tokensSaved: number;
};

export function Dashboard() {
  const [mcps, setMcps] = useState<MCPStatus[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [version, setVersion] = useState("");
  const [totalizers, setTotalizers] = useState<{
    tokensSaved: number;
    avgPercent: number;
  } | null>(null);
  const [tokensByType, setTokensByType] = useState<TokensByTypeRow[]>([]);
  const [callsByTool, setCallsByTool] = useState<CallsByToolRow[]>([]);

  const refresh = async () => {
    const [m, s, v, t, tt, ct] = await Promise.allSettled([
      api.mcps(),
      api.stats(),
      api.version(),
      api.callTotalizers(),
      api.tokensByType(),
      api.callsByTool(),
    ]);
    if (m.status === "fulfilled") setMcps(m.value);
    if (s.status === "fulfilled") setStats(s.value);
    if (v.status === "fulfilled") setVersion(v.value.version);
    if (t.status === "fulfilled") setTotalizers(t.value);
    if (tt.status === "fulfilled") setTokensByType(tt.value);
    if (ct.status === "fulfilled") setCallsByTool(ct.value);
  };

  useEffect(() => {
    void refresh();
    const t = setInterval(() => {
      void refresh();
    }, 5000);
    return () => {
      clearInterval(t);
    };
  }, []);

  const onWs = (msg: WsMessage) => {
    if (msg.channel === "stats") setStats(msg.data as Stats);
    if (msg.channel === "health") void refresh();
  };
  useWebSocket(onWs);

  const online = mcps.filter((m) => m.status === "connected").length;
  const tools = mcps.reduce((n, m) => n + m.toolCount, 0);

  const callsByMcp = stats
    ? Object.entries(stats.byMcp).map(([name, s]) => ({
        name,
        value: s.calls,
      }))
    : [];

  return (
    <div className="space-y-6">
      <div className="flex items-baseline justify-between">
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <span className="text-sm text-morph-muted">v{version}</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">
              MCPs
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <div className="text-2xl font-bold">
                  {online}/{mcps.length}
                </div>
                <p className="text-xs text-morph-muted mt-1">online</p>
              </div>
              <div>
                <div className="text-2xl font-bold">{tools}</div>
                <p className="text-xs text-morph-muted mt-1">tools</p>
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {stats?.totalCalls ?? 0}
                </div>
                <p className="text-xs text-morph-muted mt-1">calls</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <TokensByType
          data={tokensByType}
          tokensSaved={totalizers?.tokensSaved}
          savingsPercent={totalizers?.avgPercent}
        />
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TOONStats stats={stats ?? undefined} />
        <OutputFormatStats data={tokensByType} />
        <Card>
          <CardHeader>
            <CardTitle>Calls by MCP</CardTitle>
          </CardHeader>
          <CardContent>
            {callsByMcp.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={callsByMcp}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${String(name)} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {callsByMcp.map((_, i) => (
                      <Cell key={i} fill={MCP_COLORS[i % MCP_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "#161b22",
                      border: "1px solid #2a2f3a",
                      borderRadius: "8px",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <p className="text-sm text-morph-muted">No data yet.</p>
            )}
          </CardContent>
        </Card>
        <CallsByTool data={callsByTool} />
      </div>
    </div>
  );
}

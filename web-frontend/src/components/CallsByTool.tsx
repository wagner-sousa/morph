import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/**
 * Per MCP+tool: calls (line, right axis) vs tokens received and tokens saved
 * (bars, left axis). Fed by /api/calls/by-tool.
 */
export function CallsByTool({
  data,
}: {
  data:
    | Array<{
        mcp: string;
        tool: string;
        calls: number;
        tokensIn: number;
        tokensSaved: number;
      }>
    | undefined;
}) {
  const rows = (data ?? []).map((d) => ({
    name: `${d.mcp} · ${d.tool}`,
    calls: d.calls,
    tokensIn: d.tokensIn,
    tokensSaved: d.tokensSaved,
  }));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Calls × Tokens by MCP / Tool</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length > 0 ? (
          <ResponsiveContainer width="100%" height={280}>
            <ComposedChart
              data={rows}
              margin={{ top: 8, right: 8, bottom: 40, left: 8 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
              <XAxis
                dataKey="name"
                tick={{ fill: "#8b949e", fontSize: 11 }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={50}
              />
              <YAxis
                yAxisId="tokens"
                tick={{ fill: "#8b949e", fontSize: 12 }}
              />
              <YAxis
                yAxisId="calls"
                orientation="right"
                tick={{ fill: "#8b949e", fontSize: 12 }}
              />
              <Tooltip
                contentStyle={{
                  background: "#161b22",
                  border: "1px solid #2a2f3a",
                  borderRadius: "8px",
                }}
              />
              <Legend />
              <Bar
                yAxisId="tokens"
                dataKey="tokensIn"
                name="Tokens in"
                fill="#64748b"
                radius={[4, 4, 0, 0]}
              />
              <Bar
                yAxisId="tokens"
                dataKey="tokensSaved"
                name="Tokens saved"
                fill="#14b8a6"
                radius={[4, 4, 0, 0]}
              />
              <Line
                yAxisId="calls"
                type="monotone"
                dataKey="calls"
                name="Calls"
                stroke="#818cf8"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </ComposedChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-morph-muted">No data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

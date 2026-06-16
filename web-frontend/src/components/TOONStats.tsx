import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { type Stats } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const COLORS = ["#5eead4", "#14b8a6", "#0d9488", "#2dd4bf", "#5eead4"];

export function TOONStats({ stats }: { stats: Stats | undefined }) {
  const data = stats
    ? Object.entries(stats.byMcp).map(([name, s]) => ({
        name,
        calls: s.calls,
        tokensSaved: s.tokensSaved,
      }))
    : [];

  return (
    <Card>
      <CardHeader>
        <CardTitle>TOON Savings by MCP</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          {(stats?.totalTokensSaved ?? 0).toLocaleString()}{" "}
          <span className="text-sm font-normal text-morph-muted">
            tokens saved (avg {stats?.avgSavingsPercent ?? 0}%)
          </span>
        </div>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2a2f3a" />
              <XAxis dataKey="name" tick={{ fill: "#8b949e", fontSize: 12 }} />
              <YAxis tick={{ fill: "#8b949e", fontSize: 12 }} />
              <Tooltip
                contentStyle={{
                  background: "#161b22",
                  border: "1px solid #2a2f3a",
                  borderRadius: "8px",
                }}
              />
              <Bar dataKey="tokensSaved" radius={[4, 4, 0, 0]}>
                {data.map((_, i) => (
                  <Cell key={i} fill={COLORS[i % COLORS.length]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-morph-muted">No data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

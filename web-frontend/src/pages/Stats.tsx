import { useStats } from "../hooks/useStats";
import { TOONStats } from "../components/TOONStats";
import { OutputFormatStats } from "../components/OutputFormatStats";
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

const COLORS = ["#5eead4", "#14b8a6", "#0d9488", "#2dd4bf", "#5eead4"];

export function Stats() {
  const { data: stats, isLoading } = useStats();

  if (isLoading) {
    return <div className="text-morph-muted">Loading...</div>;
  }

  const pieData = stats
    ? Object.entries(stats.byMcp).map(([name, s]) => ({
        name,
        value: s.calls,
      }))
    : [];

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Statistics</h1>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <TOONStats stats={stats} />

        <OutputFormatStats stats={stats} />

        <Card>
          <CardHeader>
            <CardTitle>Calls by MCP</CardTitle>
          </CardHeader>
          <CardContent>
            {pieData.length > 0 ? (
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    outerRadius={80}
                    dataKey="value"
                    label={({ name, percent }) =>
                      `${String(name)} ${((percent ?? 0) * 100).toFixed(0)}%`
                    }
                  >
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
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
      </div>

      {stats && (
        <Card>
          <CardHeader>
            <CardTitle>Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-morph-muted">Total Calls</span>
              <span>{stats.totalCalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Failed Calls</span>
              <span>{stats.failedCalls}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Success Rate</span>
              <span>
                {stats.totalCalls > 0
                  ? `${((1 - stats.failedCalls / stats.totalCalls) * 100).toFixed(1)}%`
                  : "—"}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Total Tokens Saved</span>
              <span>{stats.totalTokensSaved.toLocaleString()}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-morph-muted">Avg Savings</span>
              <span>{stats.avgSavingsPercent}%</span>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

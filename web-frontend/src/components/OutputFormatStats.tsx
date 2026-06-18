import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { TYPE_COLORS } from "./TypeBadge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/**
 * Distribution of every output type we produced (toon/json/markdown/text…),
 * by call count. Fed by /api/calls/tokens-by-type.
 */
export function OutputFormatStats({
  data,
}: {
  data: Array<{ type: string; calls: number }> | undefined;
}) {
  const slices = (data ?? []).filter((d) => d.calls > 0);
  const total = slices.reduce((n, d) => n + d.calls, 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Output Format</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          {total.toLocaleString()}{" "}
          <span className="text-sm font-normal text-morph-muted">
            respostas em {slices.length} tipo(s)
          </span>
        </div>
        {slices.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={slices}
                dataKey="calls"
                nameKey="type"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
                label={({ name }) => String(name).toUpperCase()}
              >
                {slices.map((d) => (
                  <Cell key={d.type} fill={TYPE_COLORS[d.type] ?? "#64748b"} />
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
  );
}

import {
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { type Stats } from "../lib/api";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

const COLORS: Record<string, string> = {
  JSON: "#64748b",
  TOON: "#14b8a6",
};

export function OutputFormatStats({ stats }: { stats: Stats | undefined }) {
  const fmt = stats?.byOutputFormat ?? { json: 0, toon: 0 };
  const data = [
    { name: "JSON", value: fmt.json },
    { name: "TOON", value: fmt.toon },
  ].filter((d) => d.value > 0);
  const total = fmt.json + fmt.toon;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Output Format (JSON × TOON)</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-2">
          {fmt.toon.toLocaleString()}{" "}
          <span className="text-sm font-normal text-morph-muted">
            de {total.toLocaleString()} respostas em TOON
          </span>
        </div>
        {data.length > 0 ? (
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={data}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {data.map((d) => (
                  <Cell key={d.name} fill={COLORS[d.name]} />
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

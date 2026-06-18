import { TYPE_COLORS } from "./TypeBadge";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";

/**
 * Emitted-token totals broken down by return type, with the overall savings
 * on top. Fed by /api/calls/tokens-by-type and /api/calls/totalizers.
 */
export function TokensByType({
  data,
  tokensSaved,
  savingsPercent,
}: {
  data: Array<{ type: string; tokens: number }> | undefined;
  tokensSaved?: number;
  savingsPercent?: number;
}) {
  const rows = (data ?? []).filter((d) => d.tokens > 0);
  const max = Math.max(1, ...rows.map((d) => d.tokens));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tokens by type</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold mb-3">
          {(tokensSaved ?? 0).toLocaleString()}{" "}
          <span className="text-sm font-normal text-morph-muted">
            tokens saved ({savingsPercent ?? 0}%)
          </span>
        </div>
        {rows.length > 0 ? (
          <div className="space-y-2">
            {rows.map((d) => (
              <div key={d.type}>
                <div className="flex justify-between text-xs text-morph-muted">
                  <span className="uppercase">{d.type}</span>
                  <span>{d.tokens.toLocaleString()}</span>
                </div>
                <div className="h-2 rounded bg-morph-bg">
                  <div
                    className="h-2 rounded"
                    style={{
                      width: `${String((d.tokens / max) * 100)}%`,
                      background: TYPE_COLORS[d.type] ?? "#64748b",
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-morph-muted">No data yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

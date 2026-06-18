import { useQuery } from "@tanstack/react-query";
import { useParams, Link } from "@tanstack/react-router";
import { api } from "../lib/api";
import { Accordion, type AccordionItem } from "../components/Accordion";
import { CodeBlock } from "../components/CodeBlock";
import { TypeBadge, unifiedType } from "../components/TypeBadge";
import { Badge } from "../components/ui/badge";
import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "../components/ui/card";

function levelVariant(lvl: string) {
  switch (lvl) {
    case "error":
      return "destructive" as const;
    case "warn":
      return "warning" as const;
    default:
      return "secondary" as const;
  }
}

function estimateTokens(s?: string): number {
  if (!s) return 0;
  return Math.ceil(s.length / 4);
}

function formatJson(s?: string): string {
  if (!s) return "—";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
}

function parseSelection(
  s?: string,
): { mode: string; fields: string[] } | null {
  if (!s) return null;
  try {
    const parsed = JSON.parse(s) as { mode: string; fields: string[] };
    if (parsed && Array.isArray(parsed.fields)) return parsed;
    return null;
  } catch {
    return null;
  }
}

export function LogDetail() {
  const { id } = useParams({ from: "/logs/$id" });
  const { data, isLoading, error } = useQuery({
    queryKey: ["log", id],
    queryFn: () => api.log(Number(id)),
  });

  if (isLoading) return <div className="p-6">Loading...</div>;
  if (error || !data)
    return <div className="p-6 text-red-500">Log not found.</div>;

  const jsonTokens = data.originalTokens ?? estimateTokens(data.rawOutput);
  const toonTokens = data.toonTokens ?? estimateTokens(data.outputText);
  const selection = parseSelection(data.selectedFields);
  const savedTokens = jsonTokens - toonTokens;
  const savingsPct =
    jsonTokens > 0 ? ((savedTokens / jsonTokens) * 100).toFixed(1) : "0.0";
  const type = unifiedType(data);

  // Content sections as a single-open accordion, closed by default.
  const contentItems: AccordionItem[] = [
    {
      id: "received",
      header: (
        <span className="text-sm font-semibold">
          JSON recebido{" "}
          <span className="font-normal text-morph-muted">(do backend)</span>
        </span>
      ),
      body: (
        <CodeBlock language={data.contentType ?? "json"}>
          {formatJson(data.rawOutput)}
        </CodeBlock>
      ),
    },
  ];
  if (selection) {
    contentItems.push({
      id: "mapped",
      header: (
        <span className="text-sm font-semibold">
          Mapeado{" "}
          <span className="font-normal text-morph-muted">
            (após seleção de campos)
          </span>
        </span>
      ),
      body: <CodeBlock language="json">{formatJson(data.mappedOutput)}</CodeBlock>,
    });
  }
  contentItems.push({
    id: "output",
    header: (
      <span className="flex items-center gap-2 text-sm font-semibold">
        Saída para o agente <TypeBadge type={type} />
      </span>
    ),
    body: (
      <>
        {data.outputFormat !== "toon" && (
          <p className="mb-2 text-sm text-morph-muted">
            TOON não aplicado — o JSON foi mantido por ser menor ou por os dados
            não serem tabulares.
          </p>
        )}
        <CodeBlock language={type}>{data.outputText ?? "—"}</CodeBlock>
      </>
    ),
  });

  return (
    <div className="space-y-6 p-6">
      <div className="flex items-center gap-3">
        <Link to="/logs">
          <Button variant="outline" size="sm">
            &larr; Back
          </Button>
        </Link>
        <h1 className="text-2xl font-bold">Log #{data.id}</h1>
        <TypeBadge type={type} />
      </div>

      <div className="grid grid-cols-2 gap-4 rounded-md border border-morph-border p-4">
        <div>
          <span className="text-morph-muted">MCP:</span> {data.mcpName}
        </div>
        <div>
          <span className="text-morph-muted">Tool:</span>{" "}
          <code className="font-mono text-xs">{data.toolName}</code>
        </div>
        <div>
          <span className="text-morph-muted">Level:</span>{" "}
          <Badge variant={levelVariant(data.level)}>{data.level}</Badge>
        </div>
        <div>
          <span className="text-morph-muted">Time:</span>{" "}
          {new Date(data.createdAt).toLocaleString()}
        </div>
        <div>
          <span className="text-morph-muted">Duration (total):</span>{" "}
          {data.durationMs != null ? `${String(data.durationMs)}ms` : "—"}
        </div>
        <div>
          <span className="text-morph-muted">Overhead MORPH:</span>{" "}
          {data.morphOverheadMs != null
            ? `${String(data.morphOverheadMs)}ms`
            : "—"}
        </div>
        <div>
          <span className="text-morph-muted">Tokens Saved:</span>{" "}
          {data.tokensSaved ?? "—"}
        </div>
      </div>

      {selection && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="flex items-center gap-2 text-base">
              Campos mapeados
              <Badge variant="secondary">{selection.fields.length}</Badge>
              <Badge variant="outline">{selection.mode}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 font-mono text-xs">
              {selection.fields.map((f) => (
                <li key={f}>{f}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <div>
        <h2 className="mb-2 text-lg font-semibold">Message</h2>
        <pre className="whitespace-pre-wrap rounded-md bg-morph-bg-alt p-3 text-sm">
          {data.message}
        </pre>
      </div>

      <div>
        <h2 className="mb-2 text-lg font-semibold">Conteúdo</h2>
        <Accordion items={contentItems} />
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">
              JSON Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{jsonTokens}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">
              TOON Tokens
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{toonTokens}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-morph-muted font-normal">
              Economia
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {savedTokens}{" "}
              <span className="text-sm font-normal text-morph-muted">
                ({savingsPct}%)
              </span>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

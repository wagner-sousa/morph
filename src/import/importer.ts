/**
 * IMPL: import MCP configs from other tools (Claude Desktop, VS Code).
 *
 * Both tools use a near-identical shape; morph's .mcp.json adopts the Claude
 * keyed-object format, so importing from Claude is essentially a passthrough and
 * VS Code only needs its `servers` key renamed to `mcpServers`. Literal secrets
 * are never copied — only `${...}` references — and VS Code `${input:...}`
 * placeholders are surfaced as warnings to map to env vars.
 */

export type ImportFormat = "claude" | "vscode" | "auto";
export type DetectedFormat = Exclude<ImportFormat, "auto">;

export interface ImportWarning {
  type: "input_secret" | "unknown_format" | "conflict" | "skipped";
  message: string;
  serverName?: string;
}

/** A normalized server entry, in .mcp.json (Claude-style) shape. */
export interface McpServerEntry {
  type?: "stdio" | "http" | "sse";
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

export interface ImportResult {
  detectedFormat: DetectedFormat;
  /** Servers as a keyed object, ready to merge into .mcp.json. */
  servers: Record<string, McpServerEntry>;
  warnings: ImportWarning[];
  unresolvedSecrets: string[];
  stats: {
    total: number;
    imported: number;
    skipped: number;
    hasConflicts: boolean;
  };
}

interface RawServer {
  type?: string;
  command?: string;
  args?: string[];
  env?: Record<string, string>;
  url?: string;
  headers?: Record<string, string>;
}

const INPUT_PATTERN = /\$\{input:([^}]+)\}/g;

export function detectFormat(raw: Record<string, unknown>): DetectedFormat {
  if (raw.servers && typeof raw.servers === "object") return "vscode";
  if (raw.mcpServers && typeof raw.mcpServers === "object") return "claude";
  throw new Error(
    'unrecognised config format (no "mcpServers" or "servers" key)',
  );
}

function getRawServers(
  raw: Record<string, unknown>,
  format: DetectedFormat,
): Record<string, RawServer> {
  const key = format === "vscode" ? "servers" : "mcpServers";
  return (raw[key] as Record<string, RawServer> | undefined) ?? {};
}

function collectSecrets(
  server: RawServer,
  warnings: ImportWarning[],
  unresolved: Set<string>,
  name: string,
): void {
  const blob = JSON.stringify(server);
  for (const m of blob.matchAll(INPUT_PATTERN)) {
    unresolved.add(m[0]);
    warnings.push({
      type: "input_secret",
      serverName: name,
      message: `VS Code input "${m[1]}" detected — map it to an env var in .env`,
    });
  }
}

function normalize(server: RawServer): McpServerEntry {
  if (server.url && (server.type === "http" || server.type === "sse")) {
    return { type: server.type, url: server.url, headers: server.headers };
  }
  // Everything else becomes stdio (the default).
  return { command: server.command, args: server.args, env: server.env };
}

export function importConfig(
  raw: Record<string, unknown>,
  format: ImportFormat = "auto",
): ImportResult {
  const detected = format === "auto" ? detectFormat(raw) : format;
  const rawServers = getRawServers(raw, detected);
  const warnings: ImportWarning[] = [];
  const unresolved = new Set<string>();
  const servers: Record<string, McpServerEntry> = {};
  let skipped = 0;

  for (const [name, server] of Object.entries(rawServers)) {
    collectSecrets(server, warnings, unresolved, name);
    const normalized = normalize(server);
    const isStdio = !normalized.type || normalized.type === "stdio";
    if (isStdio && !normalized.command) {
      skipped++;
      warnings.push({
        type: "skipped",
        serverName: name,
        message: "no command/url — skipped",
      });
      continue;
    }
    servers[name] = normalized;
  }

  return {
    detectedFormat: detected,
    servers,
    warnings,
    unresolvedSecrets: [...unresolved],
    stats: {
      total: Object.keys(rawServers).length,
      imported: Object.keys(servers).length,
      skipped,
      hasConflicts: false,
    },
  };
}

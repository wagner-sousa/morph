import { ofetch } from "ofetch";

export interface StdioTransport {
  type: "stdio";
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
}

export interface HttpTransport {
  type: "http";
  url: string;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface SseTransport {
  type: "sse";
  url: string;
  headers?: Record<string, string>;
  reconnectIntervalMs?: number;
}

export type MCPTransport = StdioTransport | HttpTransport | SseTransport;

export interface FieldSelection {
  mode: "include" | "exclude";
  fields: string[];
}

export interface MCPConfig {
  name: string;
  enabled: boolean;
  description?: string;
  labels?: Record<string, string>;
  aliases?: Record<string, string>;
  /** Per-tool response field projection, keyed by backend tool name. */
  fieldSelection?: Record<string, FieldSelection>;
  transport: MCPTransport;
}

export interface MCPStatus {
  name: string;
  enabled: boolean;
  status: string;
  transport: string;
  toolCount: number;
  latencyMs?: number;
  lastError?: string;
  oauthNeeded?: boolean;
  oauthUrl?: string;
  oauthHasToken?: boolean;
}

export interface OAuthStatus {
  name: string;
  transport: string;
  oauthNeeded: boolean;
  oauthUrl: string | null;
  oauthHasToken: boolean;
  authorized: boolean;
}

export interface Stats {
  totalCalls: number;
  failedCalls: number;
  totalTokensSaved: number;
  avgSavingsPercent: number;
  byMcp: Record<string, { calls: number; tokensSaved: number }>;
}

export interface LogEntry {
  id: number;
  mcpName: string;
  toolName: string;
  level: string;
  message: string;
  inputJson?: string;
  outputText?: string;
  rawOutput?: string;
  mappedOutput?: string;
  selectedFields?: string;
  originalTokens?: number;
  toonTokens?: number;
  durationMs?: number;
  tokensSaved?: number;
  outputFormat?: "json" | "toon";
  createdAt: string;
}

export interface VersionInfo {
  name: string;
  version: string;
}

const fetch = ofetch.create({ baseURL: "/api" });

export const api = {
  mcps: () => fetch<MCPStatus[]>("/mcps"),
  mcp: (name: string) => fetch<MCPStatus>(`/mcps/${encodeURIComponent(name)}`),
  addMcp: (cfg: MCPConfig) =>
    fetch<{ name: string }>("/mcps", { method: "POST", body: cfg }),
  updateMcp: (name: string, cfg: Partial<MCPConfig>) =>
    fetch<{ name: string }>(`/mcps/${encodeURIComponent(name)}`, {
      method: "PUT",
      body: cfg,
    }),
  deleteMcp: (name: string) =>
    fetch<unknown>(`/mcps/${encodeURIComponent(name)}`, { method: "DELETE" }),
  restartMcp: (name: string) =>
    fetch<unknown>(`/mcps/${encodeURIComponent(name)}/restart`, {
      method: "POST",
    }),
  tools: (name: string) =>
    fetch<Record<string, unknown>[]>(`/mcps/${encodeURIComponent(name)}/tools`),
  stats: () => fetch<Stats>("/stats"),
  logs: (limit = 50, outputFormat?: "json" | "toon") =>
    fetch<LogEntry[]>(
      `/logs?limit=${String(limit)}${
        outputFormat ? `&outputFormat=${outputFormat}` : ""
      }`,
    ),
  log: (id: number) => fetch<LogEntry>(`/logs/${String(id)}`),
  version: () => fetch<VersionInfo>("/version"),
  config: () => fetch<{ mcpServers: MCPConfig[] }>("/config"),
  mcpConfig: async (name: string) => {
    const cfg = await fetch<{ mcpServers: MCPConfig[] }>("/config");
    return cfg.mcpServers.find((m) => m.name === name) ?? null;
  },
  updateConfig: (cfg: Record<string, unknown>) =>
    fetch<unknown>("/config", { method: "PUT", body: cfg }),
  oauthStatus: (name: string) =>
    fetch<OAuthStatus>(`/mcps/${encodeURIComponent(name)}/oauth/status`),
  oauthStart: (name: string) =>
    fetch<{ authorized: boolean; authorizationUrl?: string }>(
      `/mcps/${encodeURIComponent(name)}/oauth/start`,
    ),
  oauthCallback: (name: string, code: string) =>
    fetch<unknown>(
      `/mcps/${encodeURIComponent(name)}/oauth/callback?code=${encodeURIComponent(code)}`,
    ),
  callTotals: (since?: string) =>
    fetch<{ calls: number; tokensSaved: number; durationMs: number }>(
      `/calls/totals${since ? `?since=${since}` : ""}`,
    ),
  callTotalizers: () =>
    fetch<{
      jsonTokens: number;
      toonTokens: number;
      tokensSaved: number;
      avgPercent: number;
    }>("/calls/totalizers"),
};

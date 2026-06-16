import { ofetch } from 'ofetch';

export interface StdioTransport {
  type: 'stdio';
  command: string;
  args?: string[];
  env?: Record<string, string>;
  cwd?: string;
  timeoutMs?: number;
}

export interface HttpTransport {
  type: 'http';
  url: string;
  headers?: Record<string, string>;
  apiKey?: string;
}

export interface SseTransport {
  type: 'sse';
  url: string;
  headers?: Record<string, string>;
  reconnectIntervalMs?: number;
}

export type MCPTransport = StdioTransport | HttpTransport | SseTransport;

export interface MCPConfig {
  name: string;
  enabled: boolean;
  description?: string;
  labels?: Record<string, string>;
  aliases?: Record<string, string>;
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
  durationMs?: number;
  tokensSaved?: number;
  createdAt: string;
}

export interface VersionInfo {
  name: string;
  version: string;
}

const fetch = ofetch.create({ baseURL: '/api' });

export const api = {
  mcps: () => fetch<MCPStatus[]>('/mcps'),
  mcp: (name: string) => fetch<MCPStatus>(`/mcps/${encodeURIComponent(name)}`),
  addMcp: (cfg: MCPConfig) => fetch<{ name: string }>('/mcps', { method: 'POST', body: cfg }),
  updateMcp: (name: string, cfg: Partial<MCPConfig>) =>
    fetch<{ name: string }>(`/mcps/${encodeURIComponent(name)}`, { method: 'PUT', body: cfg }),
  deleteMcp: (name: string) => fetch<void>(`/mcps/${encodeURIComponent(name)}`, { method: 'DELETE' }),
  restartMcp: (name: string) =>
    fetch<void>(`/mcps/${encodeURIComponent(name)}/restart`, { method: 'POST' }),
  tools: (name: string) => fetch<unknown[]>(`/mcps/${encodeURIComponent(name)}/tools`),
  stats: () => fetch<Stats>('/stats'),
  logs: (limit = 50) => fetch<LogEntry[]>(`/logs?limit=${limit}`),
  version: () => fetch<VersionInfo>('/version'),
  config: () => fetch<{ mcps: MCPConfig[] }>('/config'),
  mcpConfig: async (name: string) => {
    const cfg = await fetch<{ mcps: MCPConfig[] }>('/config');
    return cfg.mcps.find((m) => m.name === name) ?? null;
  },
  updateConfig: (cfg: { mcps: MCPConfig[] }) =>
    fetch<void>('/config', { method: 'PUT', body: cfg }),
  oauthStatus: (name: string) =>
    fetch<OAuthStatus>(`/mcps/${encodeURIComponent(name)}/oauth/status`),
  oauthStart: (name: string) =>
    fetch<{ authorized: boolean; authorizationUrl?: string }>(`/mcps/${encodeURIComponent(name)}/oauth/start`),
  oauthCallback: (name: string, code: string) =>
    fetch<void>(`/mcps/${encodeURIComponent(name)}/oauth/callback?code=${encodeURIComponent(code)}`),
  callTotals: (since?: string) => fetch<{ calls: number; tokensSaved: number; durationMs: number }>(`/calls/totals${since ? `?since=${since}` : ''}`),
};

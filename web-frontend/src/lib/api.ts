import { ofetch } from 'ofetch';

export interface MCPConfig {
  name: string;
  transport: 'stdio' | 'http' | 'sse';
  enabled: boolean;
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

export interface MCPStatus {
  name: string;
  enabled: boolean;
  status: string;
  transport: string;
  toolCount: number;
  latencyMs?: number;
  lastError?: string;
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
  stats: () => fetch<Stats>('/stats'),
  logs: (limit = 50) => fetch<LogEntry[]>(`/logs?limit=${limit}`),
  version: () => fetch<VersionInfo>('/version'),
  config: () => fetch<{ mcps: MCPConfig[] }>('/config'),
  updateConfig: (cfg: { mcps: MCPConfig[] }) =>
    fetch<void>('/config', { method: 'PUT', body: cfg }),
};

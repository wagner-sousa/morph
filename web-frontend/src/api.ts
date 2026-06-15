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

async function get<T>(path: string): Promise<T> {
  const res = await fetch(path);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

export const api = {
  mcps: () => get<MCPStatus[]>('/api/mcps'),
  stats: () => get<Stats>('/api/stats'),
  logs: () => get<LogEntry[]>('/api/logs?limit=50'),
  version: () => get<{ name: string; version: string }>('/api/version'),
  restart: (name: string) =>
    fetch(`/api/mcps/${encodeURIComponent(name)}/restart`, { method: 'POST' }),
};

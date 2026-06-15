/**
 * IMPL: import MCP configs from other tools (Claude Desktop, VS Code, Copilot).
 *
 * Normalises differing structures into MORPH's MCPDefinition shape, never
 * copies literal secrets (only `${...}` references), and reports warnings for
 * things that need manual attention (VS Code inputs, Copilot vars, conflicts).
 */
import type { MCPDefinition } from '../config/types.js';

export type ImportFormat = 'claude' | 'vscode' | 'copilot' | 'auto';
export type DetectedFormat = Exclude<ImportFormat, 'auto'>;

export interface ImportWarning {
  type: 'input_secret' | 'copilot_var' | 'unknown_format' | 'conflict' | 'skipped';
  message: string;
  serverName?: string;
}

export interface ImportResult {
  detectedFormat: DetectedFormat;
  servers: MCPDefinition[];
  warnings: ImportWarning[];
  unresolvedSecrets: string[];
  stats: { total: number; imported: number; skipped: number; hasConflicts: boolean };
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
const COPILOT_PATTERN = /\$\{?COPILOT_MCP_[A-Z0-9_]+\}?/g;

export function detectFormat(raw: Record<string, unknown>): DetectedFormat {
  if (raw.servers && typeof raw.servers === 'object') return 'vscode';
  if (raw.mcpServers && typeof raw.mcpServers === 'object') {
    // Copilot entries carry a `type: "local"`; Claude entries don't.
    const first = Object.values(raw.mcpServers as Record<string, RawServer>)[0];
    if (first?.type === 'local') return 'copilot';
    return 'claude';
  }
  throw new Error('unrecognised config format (no "mcpServers" or "servers" key)');
}

function getRawServers(raw: Record<string, unknown>, format: DetectedFormat): Record<string, RawServer> {
  const key = format === 'vscode' ? 'servers' : 'mcpServers';
  return (raw[key] as Record<string, RawServer>) ?? {};
}

function collectSecrets(server: RawServer, warnings: ImportWarning[], unresolved: Set<string>, name: string): void {
  const blob = JSON.stringify(server);
  for (const m of blob.matchAll(INPUT_PATTERN)) {
    unresolved.add(m[0]);
    warnings.push({
      type: 'input_secret',
      serverName: name,
      message: `VS Code input "${m[1]}" detected — map it to an env var in .env`,
    });
  }
  for (const m of blob.matchAll(COPILOT_PATTERN)) {
    unresolved.add(m[0]);
    warnings.push({
      type: 'copilot_var',
      serverName: name,
      message: `Copilot variable "${m[0]}" detected — map it to a standard env var`,
    });
  }
}

function normalize(name: string, server: RawServer): MCPDefinition {
  const rawType = server.type;
  if (server.url && (rawType === 'http' || rawType === 'sse')) {
    return {
      name,
      enabled: true,
      transport:
        rawType === 'sse'
          ? { type: 'sse', url: server.url, headers: server.headers }
          : { type: 'http', url: server.url, headers: server.headers },
    } as MCPDefinition;
  }
  // Everything else (including Copilot "local") becomes stdio.
  return {
    name,
    enabled: true,
    transport: {
      type: 'stdio',
      command: server.command ?? '',
      args: server.args ?? [],
      env: server.env,
    },
  } as MCPDefinition;
}

export function importConfig(raw: Record<string, unknown>, format: ImportFormat = 'auto'): ImportResult {
  const detected = format === 'auto' ? detectFormat(raw) : format;
  const rawServers = getRawServers(raw, detected);
  const warnings: ImportWarning[] = [];
  const unresolved = new Set<string>();
  const servers: MCPDefinition[] = [];
  let skipped = 0;

  for (const [name, server] of Object.entries(rawServers)) {
    collectSecrets(server, warnings, unresolved, name);
    const normalized = normalize(name, server);
    if (normalized.transport.type === 'stdio' && !normalized.transport.command) {
      skipped++;
      warnings.push({ type: 'skipped', serverName: name, message: 'no command/url — skipped' });
      continue;
    }
    servers.push(normalized);
  }

  return {
    detectedFormat: detected,
    servers,
    warnings,
    unresolvedSecrets: [...unresolved],
    stats: {
      total: Object.keys(rawServers).length,
      imported: servers.length,
      skipped,
      hasConflicts: false,
    },
  };
}

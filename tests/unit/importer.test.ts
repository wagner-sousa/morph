import { describe, expect, it, vi } from 'vitest';
import { detectFormat, importConfig } from '../../src/import/importer.js';

describe('detectFormat', () => {
  it('detects Claude Desktop format', () => {
    expect(detectFormat({ mcpServers: { fs: { command: 'npx' } } })).toBe('claude');
  });

  it('detects VS Code format', () => {
    expect(detectFormat({ servers: { gh: { type: 'stdio', command: 'npx' } } })).toBe('vscode');
  });

  it('detects Copilot format', () => {
    expect(detectFormat({ mcpServers: { x: { type: 'local', command: 'npx' } } })).toBe('copilot');
  });

  it('throws for unrecognized format', () => {
    expect(() => detectFormat({})).toThrow('unrecognised');
  });
});

describe('importConfig', () => {
  it('imports Claude Desktop format', () => {
    const res = importConfig({ mcpServers: { fs: { command: 'npx', args: ['-y', 'srv'] } } });
    expect(res.detectedFormat).toBe('claude');
    expect(res.servers).toHaveLength(1);
    expect(res.servers[0].name).toBe('fs');
    expect(res.stats.imported).toBe(1);
  });

  it('imports VS Code with input secret warnings', () => {
    const res = importConfig({ servers: { gh: { type: 'stdio', command: 'npx', env: { TOKEN: '${input:gh-token}' } } } });
    expect(res.detectedFormat).toBe('vscode');
    expect(res.unresolvedSecrets).toContain('${input:gh-token}');
    expect(res.warnings.some((w) => w.type === 'input_secret')).toBe(true);
  });

  it('maps Copilot local to stdio', () => {
    const res = importConfig({ mcpServers: { x: { type: 'local', command: 'npx', args: ['srv'] } } });
    expect(res.detectedFormat).toBe('copilot');
    expect(res.servers[0].transport.type).toBe('stdio');
  });

  it('skips entries without command', () => {
    const res = importConfig({ mcpServers: { broken: {} } });
    expect(res.stats.skipped).toBe(1);
    expect(res.servers).toHaveLength(0);
  });

  it('imports HTTP server from Claude config', () => {
    const res = importConfig({ mcpServers: { api: { type: 'http', url: 'http://localhost/mcp' } } });
    expect(res.servers[0].transport.type).toBe('http');
  });

  it('imports SSE server from Claude config', () => {
    const res = importConfig({ mcpServers: { stream: { type: 'sse', url: 'http://localhost/sse' } } });
    expect(res.servers[0].transport.type).toBe('sse');
  });

  it('detects Copilot $COPILOT_MCP_* variables', () => {
    const res = importConfig({ mcpServers: { x: { command: 'npx', env: { KEY: '$COPILOT_MCP_KEY' } } } });
    expect(res.unresolvedSecrets).toContain('$COPILOT_MCP_KEY');
  });

  it('accepts explicit format (no auto-detect)', () => {
    const res = importConfig({ servers: {} }, 'vscode');
    expect(res.detectedFormat).toBe('vscode');
    expect(res.servers).toHaveLength(0);
  });

  it('returns correct stats for mixed results', () => {
    const res = importConfig({ mcpServers: { good: { command: 'npx' }, bad: {} } });
    expect(res.stats.total).toBe(2);
    expect(res.stats.imported).toBe(1);
    expect(res.stats.skipped).toBe(1);
  });

  it('handles env vars without secrets', () => {
    const res = importConfig({ mcpServers: { api: { command: 'npx', env: { KEY: 'plain-value' } } } });
    expect(res.servers).toHaveLength(1);
    expect(res.unresolvedSecrets).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { detectFormat, importConfig } from '../../src/import/importer.js';

describe('config importer', () => {
  it('detects and normalises Claude Desktop format', () => {
    const raw = { mcpServers: { fs: { command: 'npx', args: ['-y', '@mcp/server'] } } };
    expect(detectFormat(raw)).toBe('claude');
    const res = importConfig(raw);
    expect(res.servers[0]).toMatchObject({
      name: 'fs',
      transport: { type: 'stdio', command: 'npx', args: ['-y', '@mcp/server'] },
    });
  });

  it('detects VS Code format and warns about ${input:} secrets', () => {
    const raw = {
      servers: {
        gh: { type: 'stdio', command: 'npx', args: ['srv'], env: { TOKEN: '${input:gh-token}' } },
      },
    };
    expect(detectFormat(raw)).toBe('vscode');
    const res = importConfig(raw);
    expect(res.unresolvedSecrets).toContain('${input:gh-token}');
    expect(res.warnings.some((w) => w.type === 'input_secret')).toBe(true);
  });

  it('maps Copilot "local" type to stdio', () => {
    const raw = { mcpServers: { x: { type: 'local', command: 'npx', args: ['srv'] } } };
    expect(detectFormat(raw)).toBe('copilot');
    const res = importConfig(raw);
    expect(res.servers[0].transport.type).toBe('stdio');
  });

  it('skips entries with no command/url', () => {
    const raw = { mcpServers: { broken: {} } };
    const res = importConfig(raw);
    expect(res.stats.skipped).toBe(1);
    expect(res.servers).toHaveLength(0);
  });
});

import { describe, expect, it } from 'vitest';
import { parseConfig, validateConfig } from '../../src/config/loader.js';
import { ConfigError } from '../../src/utils/errors.js';

const minimal = {
  mcpServers: [
    { name: 'fs', transport: { type: 'stdio', command: 'node', args: ['s.js'] } },
  ],
};

/** Build the two on-disk JSON strings (morph.json + .mcp.json). */
function texts(mcpServers: Record<string, unknown> = {}, morph: Record<string, unknown> = {}) {
  return [JSON.stringify(morph), JSON.stringify({ mcpServers })] as const;
}

describe('config loader', () => {
  it('applies defaults for omitted sections', () => {
    const cfg = validateConfig(minimal);
    expect(cfg.toon.autoConvert).toBe(true);
    expect(cfg.toon.delimiter).toBe('comma');
    expect(cfg.webUi.port).toBe(3100);
    expect(cfg.health.intervalMs).toBe(30000);
    expect(cfg.mcpServers[0].enabled).toBe(true);
  });

  it('merges morph.json and .mcp.json into one config', () => {
    const [m, mcp] = texts({ fs: { command: 'node', args: ['s.js'] } });
    const cfg = parseConfig(m, mcp);
    expect(cfg.mcpServers).toHaveLength(1);
    expect(cfg.mcpServers[0].name).toBe('fs');
    expect(cfg.mcpServers[0].transport.type).toBe('stdio');
  });

  it('treats a missing .mcp.json as no servers', () => {
    const cfg = parseConfig('{}', undefined);
    expect(cfg.mcpServers).toEqual([]);
  });

  it('infers http/sse transports from the entry fields', () => {
    const [m, mcp] = texts({
      api: { type: 'http', url: 'https://x/mcp' },
      stream: { type: 'sse', url: 'https://x/sse' },
    });
    const cfg = parseConfig(m, mcp);
    const byName = Object.fromEntries(cfg.mcpServers.map((s) => [s.name, s.transport.type]));
    expect(byName).toEqual({ api: 'http', stream: 'sse' });
  });

  it('rejects duplicate MCP names in the merged config', () => {
    const dup = {
      mcpServers: [
        { name: 'a', transport: { type: 'stdio', command: 'x' } },
        { name: 'a', transport: { type: 'stdio', command: 'y' } },
      ],
    };
    expect(() => validateConfig(dup)).toThrowError(ConfigError);
  });

  it('requires command for stdio and url for http', () => {
    const [m, badStdio] = texts({ a: {} });
    expect(() => parseConfig(m, badStdio)).toThrowError(ConfigError);
    const [, badHttp] = texts({ a: { type: 'http', url: 'not-a-url' } });
    expect(() => parseConfig(m, badHttp)).toThrowError(ConfigError);
  });

  it('resolves env vars when parsing JSON text', () => {
    const [m, mcp] = texts({ k: { type: 'http', url: 'https://x/mcp', apiKey: '${MY_KEY}' } });
    const cfg = parseConfig(m, mcp, { env: { MY_KEY: 'abc' } });
    const t = cfg.mcpServers[0].transport;
    expect(t.type === 'http' && t.apiKey).toBe('abc');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseConfig('{ not json', undefined)).toThrowError(ConfigError);
    expect(() => parseConfig('{}', '{ not json')).toThrowError(ConfigError);
  });

  it('does not require env vars for disabled MCP servers', () => {
    const [m, mcp] = texts({
      off: { enabled: false, command: 'npx', args: ['--key=${MISSING_SECRET}'] },
    });
    const cfg = parseConfig(m, mcp, { env: {} });
    const t = cfg.mcpServers[0].transport;
    // placeholder is left intact rather than blocking startup
    expect(t.type === 'stdio' && t.args).toContain('--key=${MISSING_SECRET}');
  });

  it('still requires env vars for enabled MCP servers', () => {
    const [m, mcp] = texts({ on: { enabled: true, command: '${MISSING_CMD}' } });
    expect(() => parseConfig(m, mcp, { env: {} })).toThrow(/MISSING_CMD/);
  });
});

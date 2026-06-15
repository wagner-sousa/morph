import { describe, expect, it } from 'vitest';
import { parseConfig, validateConfig } from '../../src/config/loader.js';
import { ConfigError } from '../../src/utils/errors.js';

const minimal = {
  mcpServers: [
    { name: 'fs', transport: { type: 'stdio', command: 'node', args: ['s.js'] } },
  ],
};

describe('config loader', () => {
  it('applies defaults for omitted sections', () => {
    const cfg = validateConfig(minimal);
    expect(cfg.toon.autoConvert).toBe(true);
    expect(cfg.toon.delimiter).toBe('comma');
    expect(cfg.webUi.port).toBe(3100);
    expect(cfg.health.intervalMs).toBe(30000);
    expect(cfg.mcpServers[0].enabled).toBe(true);
  });

  it('rejects duplicate MCP names', () => {
    const dup = {
      mcpServers: [
        { name: 'a', transport: { type: 'stdio', command: 'x' } },
        { name: 'a', transport: { type: 'stdio', command: 'y' } },
      ],
    };
    expect(() => validateConfig(dup)).toThrowError(ConfigError);
  });

  it('requires command for stdio and url for http', () => {
    expect(() =>
      validateConfig({ mcpServers: [{ name: 'a', transport: { type: 'stdio' } }] }),
    ).toThrowError(ConfigError);
    expect(() =>
      validateConfig({ mcpServers: [{ name: 'a', transport: { type: 'http', url: 'not-a-url' } }] }),
    ).toThrowError(ConfigError);
  });

  it('resolves env vars when parsing JSON text', () => {
    const json = JSON.stringify({
      mcpServers: [
        { name: 'k', transport: { type: 'http', url: 'https://x/mcp', apiKey: '${MY_KEY}' } },
      ],
    });
    const cfg = parseConfig(json, { env: { MY_KEY: 'abc' } });
    const t = cfg.mcpServers[0].transport;
    expect(t.type === 'http' && t.apiKey).toBe('abc');
  });

  it('throws on invalid JSON', () => {
    expect(() => parseConfig('{ not json')).toThrowError(ConfigError);
  });

  it('does not require env vars for disabled MCP servers', () => {
    const json = JSON.stringify({
      mcpServers: [
        {
          name: 'off',
          enabled: false,
          transport: { type: 'stdio', command: 'npx', args: ['--key=${MISSING_SECRET}'] },
        },
      ],
    });
    const cfg = parseConfig(json, { env: {} });
    const t = cfg.mcpServers[0].transport;
    // placeholder is left intact rather than blocking startup
    expect(t.type === 'stdio' && t.args).toContain('--key=${MISSING_SECRET}');
  });

  it('still requires env vars for enabled MCP servers', () => {
    const json = JSON.stringify({
      mcpServers: [
        { name: 'on', enabled: true, transport: { type: 'stdio', command: '${MISSING_CMD}' } },
      ],
    });
    expect(() => parseConfig(json, { env: {} })).toThrow(/MISSING_CMD/);
  });
});

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

describe('dedicated MORPH_* env overrides', () => {
  it('overrides each morph.json setting from its env var', () => {
    const [m, mcp] = texts({});
    const cfg = parseConfig(m, mcp, {
      env: {
        MORPH_LOG_LEVEL: 'debug',
        MORPH_ALLOW_CONFLICTS: 'true',
        MORPH_TOOL_PREFIX: '{name}_',
        MORPH_WEB_ENABLED: 'false',
        MORPH_WEB_HOST: '127.0.0.1',
        MORPH_WEB_PORT: '4000',
        MORPH_WEB_PUBLIC_URL: 'http://example.com',
        MORPH_TOON_AUTO_CONVERT: 'no',
        MORPH_TOON_DELIMITER: 'tab',
        MORPH_TOON_INDENT: '4',
        MORPH_TOON_FLATTEN_DEPTH: '2',
        MORPH_TOON_THRESHOLD: '50',
        MORPH_HEALTH_INTERVAL_MS: '1000',
        MORPH_HEALTH_TIMEOUT_MS: '2000',
        MORPH_HEALTH_MAX_RETRIES: '7',
      },
    });
    expect(cfg.morph.logLevel).toBe('debug');
    expect(cfg.morph.allowConflicts).toBe(true);
    expect(cfg.morph.toolPrefix).toBe('{name}_');
    expect(cfg.webUi.enabled).toBe(false);
    expect(cfg.webUi.host).toBe('127.0.0.1');
    expect(cfg.webUi.port).toBe(4000);
    expect(cfg.webUi.publicUrl).toBe('http://example.com');
    expect(cfg.toon.autoConvert).toBe(false);
    expect(cfg.toon.delimiter).toBe('tab');
    expect(cfg.toon.indent).toBe(4);
    expect(cfg.toon.flattenDepth).toBe(2);
    expect(cfg.toon.threshold).toBe(50);
    expect(cfg.health.intervalMs).toBe(1000);
    expect(cfg.health.timeoutMs).toBe(2000);
    expect(cfg.health.maxRetries).toBe(7);
  });

  it('env wins over the JSON value, JSON wins over default', () => {
    const [m, mcp] = texts({}, { webUi: { port: 5000 }, morph: { logLevel: 'warn' } });
    // JSON value when no env override
    expect(parseConfig(m, mcp, { env: {} }).webUi.port).toBe(5000);
    expect(parseConfig(m, mcp, { env: {} }).morph.logLevel).toBe('warn');
    // env overrides the JSON value
    const cfg = parseConfig(m, mcp, { env: { MORPH_WEB_PORT: '6000' } });
    expect(cfg.webUi.port).toBe(6000);
    expect(cfg.morph.logLevel).toBe('warn');
  });

  it('accepts common boolean spellings', () => {
    const [m, mcp] = texts({});
    for (const v of ['true', '1', 'yes', 'on']) {
      expect(parseConfig(m, mcp, { env: { MORPH_WEB_ENABLED: v } }).webUi.enabled).toBe(true);
    }
    for (const v of ['false', '0', 'no', 'off']) {
      expect(parseConfig(m, mcp, { env: { MORPH_WEB_ENABLED: v } }).webUi.enabled).toBe(false);
    }
  });

  it('ignores empty-string env vars', () => {
    const [m, mcp] = texts({}, { webUi: { port: 5000 } });
    expect(parseConfig(m, mcp, { env: { MORPH_WEB_PORT: '' } }).webUi.port).toBe(5000);
  });

  it('rejects invalid boolean, integer and enum env values', () => {
    const [m, mcp] = texts({});
    expect(() => parseConfig(m, mcp, { env: { MORPH_WEB_ENABLED: 'maybe' } })).toThrowError(ConfigError);
    expect(() => parseConfig(m, mcp, { env: { MORPH_WEB_PORT: 'abc' } })).toThrowError(ConfigError);
    expect(() => parseConfig(m, mcp, { env: { MORPH_TOON_DELIMITER: 'xml' } })).toThrowError(ConfigError);
  });

  it('does not apply dedicated overrides to .mcp.json servers', () => {
    const [m, mcp] = texts({ api: { type: 'http', url: 'https://x/mcp' } });
    const cfg = parseConfig(m, mcp, { env: { MORPH_WEB_HOST: '10.0.0.1' } });
    // server entries are untouched by MORPH_* overrides
    expect(cfg.mcpServers[0].transport.type).toBe('http');
    expect(cfg.webUi.host).toBe('10.0.0.1');
  });
});

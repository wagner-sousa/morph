import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resolvePaths, resolveMcpConfigPath } from '../../src/config/paths.js';

let dir: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'morph-paths-'));
});
afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('resolvePaths', () => {
  it('defaults the data dir to ./data and derives log dir from it', () => {
    const p = resolvePaths({ env: {} });
    expect(p.dataDir).toBe(resolve('./data'));
    expect(p.logDir).toBe(resolve('./data/logs'));
  });

  it('roots everything under a custom MORPH_DATA_DIR', () => {
    const p = resolvePaths({ env: { MORPH_DATA_DIR: dir } });
    expect(p.dataDir).toBe(resolve(dir));
    expect(p.logDir).toBe(resolve(dir, 'logs'));
  });

  it('lets MORPH_LOG_DIR override the derived log dir', () => {
    const p = resolvePaths({ env: { MORPH_DATA_DIR: dir, MORPH_LOG_DIR: '/var/log/morph' } });
    expect(p.logDir).toBe(resolve('/var/log/morph'));
  });

  it('prefers <dataDir>/morph.json when it exists', () => {
    writeFileSync(join(dir, 'morph.json'), '{}');
    const p = resolvePaths({ env: { MORPH_DATA_DIR: dir } });
    expect(p.configPath).toBe(resolve(dir, 'morph.json'));
    expect(p.mcpPath).toBe(resolve(dir, '.mcp.json'));
  });

  it('falls back to ./morph.json when none in the data dir', () => {
    const p = resolvePaths({ env: { MORPH_DATA_DIR: dir } });
    expect(p.configPath).toBe(resolve('./morph.json'));
  });

  it('honors an explicit --config flag over the data dir', () => {
    writeFileSync(join(dir, 'morph.json'), '{}');
    const custom = join(dir, 'custom.json');
    const p = resolvePaths({ env: { MORPH_DATA_DIR: dir }, configFlag: custom });
    expect(p.configPath).toBe(resolve(custom));
  });

  it('honors MORPH_CONFIG env over the data dir', () => {
    const custom = join(dir, 'env-config.json');
    const p = resolvePaths({ env: { MORPH_DATA_DIR: dir, MORPH_CONFIG: custom } });
    expect(p.configPath).toBe(resolve(custom));
  });
});

describe('resolveMcpConfigPath', () => {
  it('derives a sibling from the config name suffix', () => {
    expect(resolveMcpConfigPath('/x/morph.json')).toBe(resolve('/x/.mcp.json'));
    expect(resolveMcpConfigPath('/x/morph.demo.json')).toBe(resolve('/x/.mcp.demo.json'));
  });

  it('honors an explicit override', () => {
    expect(resolveMcpConfigPath('/x/morph.json', '/y/servers.json')).toBe(resolve('/y/servers.json'));
  });
});

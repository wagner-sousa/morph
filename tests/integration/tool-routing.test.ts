import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import { MCPClientRegistry } from '../../src/mcp-client/registry.js';
import { Router } from '../../src/router/index.js';
import { ToonConverter } from '../../src/toon/converter.js';
import { createLogger } from '../../src/logging/logger.js';
import { validateConfig } from '../../src/config/loader.js';
import type { MCPDefinition } from '../../src/config/types.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, '../fixtures/test-mcp-server.ts');
const tsxBin = resolve(process.cwd(), 'node_modules/.bin/tsx');
const logger = createLogger('error', false);

function def(name: string): MCPDefinition {
  return {
    name,
    enabled: true,
    transport: { type: 'stdio', command: tsxBin, args: [fixture] },
  } as MCPDefinition;
}

describe('end-to-end tool routing over stdio', () => {
  const registry = new MCPClientRegistry(logger);
  const router = new Router(logger);

  beforeAll(async () => {
    await registry.initialize([def('alpha'), def('beta')]);
    const toolsByMcp = new Map(
      [...registry.getConnectedClients().keys()].map((n) => [n, registry.getTools(n)]),
    );
    router.buildRoutes({
      toolsByMcp,
      aliasesByMcp: new Map([['alpha', undefined], ['beta', undefined]]),
      allowConflicts: false,
    });
  }, 30000);

  afterAll(async () => {
    await registry.disconnectAll();
  });

  it('discovers tools from both backends', () => {
    expect(registry.getTools('alpha').map((t) => t.name)).toContain('echo');
    expect(registry.getConnectedClients().size).toBe(2);
  });

  it('namespaces conflicting tools across MCPs', () => {
    expect(router.has('echo')).toBe(false);
    expect(router.resolve('alpha_echo')).toEqual({ mcpName: 'alpha', originalName: 'echo' });
  });

  it('routes a call to the correct backend and echoes args', async () => {
    const { mcpName, originalName } = router.resolve('beta_echo');
    const client = registry.getClient(mcpName)!;
    const result = await client.callTool(originalName, { hello: 'world' });
    const text = (result.content[0] as { text: string }).text;
    expect(JSON.parse(text)).toEqual({ hello: 'world' });
  });

  it('converts a large_json response to TOON with savings', async () => {
    const converter = new ToonConverter(validateConfig({ mcpServers: [] }).toon);
    const { mcpName, originalName } = router.resolve('alpha_large_json');
    const raw = await registry.getClient(mcpName)!.callTool(originalName, {});
    const { converted, savings } = converter.convertResult(raw);
    expect(converted).toBe(true);
    expect(savings!.percent).toBeGreaterThan(0);
  });

  it('forwards backend tool errors', async () => {
    const { mcpName, originalName } = router.resolve('alpha_fail');
    const result = await registry.getClient(mcpName)!.callTool(originalName, {});
    expect(result.isError).toBe(true);
  });
});

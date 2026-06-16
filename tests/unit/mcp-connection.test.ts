import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MCPClientRegistry } from '../../src/mcp-client/registry.js';
import { createLogger } from '../../src/logging/logger.js';
import type { MCPDefinition } from '../../src/config/types.js';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = resolve(here, '../fixtures/test-mcp-server.ts');
const tsxBin = resolve(process.cwd(), 'node_modules/.bin/tsx');
const logger = createLogger('error', false);

describe('MCP Connection Tests', () => {
  let registry: MCPClientRegistry;

  beforeEach(() => {
    registry = new MCPClientRegistry(logger);
  });

  afterEach(async () => {
    await registry.disconnectAll();
  });

  function createDemoMcp(name: string): MCPDefinition {
    return {
      name,
      enabled: true,
      description: `Demo MCP - ${name}`,
      transport: {
        type: 'stdio',
        command: tsxBin,
        args: [fixture],
      },
    } as MCPDefinition;
  }

  afterAll(async () => {
    // cleanup any remaining connections
  });

  it('connects to a single STDIO MCP', async () => {
    const mcp = createDemoMcp('test-single');
    await registry.initialize([mcp]);
    
    const connected = registry.getConnectedClients();
    expect(connected.size).toBe(1);
    expect(connected.has('test-single')).toBe(true);
  });

  it('discovers tools from connected MCP', async () => {
    const mcp = createDemoMcp('test-tools');
    await registry.initialize([mcp]);
    
    const tools = registry.getTools('test-tools');
    expect(tools.length).toBeGreaterThan(0);
    expect(tools.some((t) => t.name === 'echo')).toBe(true);
  });

  it('calls a tool and receives a response', async () => {
    const mcp = createDemoMcp('test-call');
    await registry.initialize([mcp]);
    
    const client = registry.getClient('test-call');
    expect(client).toBeDefined();
    
    const result = await client!.callTool('echo', { message: 'hello' });
    expect(result.isError).not.toBe(true);
    expect(result.content.length).toBeGreaterThan(0);
    
    const text = (result.content[0] as { text?: string }).text;
    expect(text).toBeDefined();
  });

  it('handles multiple MCPs simultaneously', async () => {
    const mcps = [
      createDemoMcp('alpha'),
      createDemoMcp('beta'),
      createDemoMcp('gamma'),
    ];
    
    await registry.initialize(mcps);
    
    const connected = registry.getConnectedClients();
    expect(connected.size).toBe(3);
    
    // Verify each MCP is accessible
    for (const name of ['alpha', 'beta', 'gamma']) {
      const client = registry.getClient(name);
      expect(client).toBeDefined();
      
      const tools = registry.getTools(name);
      expect(tools.length).toBeGreaterThan(0);
    }
  });

  it('gracefully handles connection failures', async () => {
    const invalidMcp: MCPDefinition = {
      name: 'invalid-server',
      enabled: true,
      transport: {
        type: 'stdio',
        command: 'nonexistent-command-xyz',
        args: [],
      },
    } as MCPDefinition;

    await registry.initialize([invalidMcp]);
    // Invalid servers are not connected but initialize doesn't throw
    expect(registry.getConnectedClients().has('invalid-server')).toBe(false);
  });

  it('disconnects cleanly from all MCPs', async () => {
    const mcps = [
      createDemoMcp('clean-alpha'),
      createDemoMcp('clean-beta'),
    ];
    
    await registry.initialize(mcps);
    expect(registry.getConnectedClients().size).toBe(2);
    
    await registry.disconnectAll();
    expect(registry.getConnectedClients().size).toBe(0);
  });
});

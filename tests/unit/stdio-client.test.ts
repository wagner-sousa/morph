import { describe, expect, it, vi } from 'vitest';
import { StdioMCPClient } from '../../src/mcp-client/stdio-client.js';
import { BaseMCPClient } from '../../src/mcp-client/base-client.js';

describe('StdioMCPClient', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger } as never;

  it('extends BaseMCPClient', () => {
    const client = new StdioMCPClient('test', { type: 'stdio', command: 'node', args: ['-e', 'console.log()'] }, { logger });
    expect(client).toBeInstanceOf(BaseMCPClient);
  });

  it('creates with cwd and env', () => {
    const client = new StdioMCPClient('test', {
      type: 'stdio',
      command: 'node',
      args: ['server.js'],
      env: { NODE_ENV: 'production' },
      cwd: '/opt/server',
      timeoutMs: 30000,
    }, { logger });
    expect(client).toBeDefined();
  });

  it('creates with minimal config', () => {
    const client = new StdioMCPClient('test', { type: 'stdio', command: 'npx' }, { logger });
    expect(client).toBeDefined();
  });

  it('disconnect does not throw when not connected', async () => {
    const client = new StdioMCPClient('test', { type: 'stdio', command: 'node', args: ['-e', 'console.log()'] }, { logger });
    await expect(client.disconnect()).resolves.toBeUndefined();
  });
});

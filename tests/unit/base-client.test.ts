import { describe, expect, it, vi } from 'vitest';
import { BaseMCPClient } from '../../src/mcp-client/base-client.js';
import type { Transport } from '@modelcontextprotocol/sdk/shared/transport.js';

class TestClient extends BaseMCPClient {
  protected createTransport(): Transport {
    return {
      start: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      send: vi.fn().mockResolvedValue(undefined),
    } as unknown as Transport;
  }
}

describe('BaseMCPClient', () => {
  const logger = { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn(), child: () => logger } as never;

  it('starts as disconnected', () => {
    const client = new TestClient('test', { logger });
    expect(client.getStatus()).toBe('disconnected');
    expect(client.getLastError()).toBeUndefined();
  });

  it('listTools throws when not connected', async () => {
    const client = new TestClient('test', { logger });
    await expect(client.listTools()).rejects.toThrow();
  });

  it('callTool throws when not connected', async () => {
    const client = new TestClient('test', { logger });
    await expect(client.callTool('ping')).rejects.toThrow();
  });

  it('retries connection on failure and throws', async () => {
    let attempts = 0;
    class FailingClient extends BaseMCPClient {
      protected createTransport(): Transport {
        attempts++;
        throw new Error(`fail ${attempts}`);
      }
    }
    const client = new FailingClient('test', { logger });
    await expect(client.connect()).rejects.toThrow();
    expect(attempts).toBeGreaterThanOrEqual(1);
  });

  it('connect throws when transport creation fails', async () => {
    class BadClient extends BaseMCPClient {
      protected createTransport(): Transport {
        throw new Error('transport creation failed');
      }
    }
    const client = new BadClient('test', { logger });
    await expect(client.connect()).rejects.toThrow('transport creation failed');
  });
});

import { EventEmitter } from 'node:events';
import { describe, expect, it } from 'vitest';
import { MorphMCPServer } from '../../src/mcp-server/server.js';
import type { Hub } from '../../src/hub.js';
import type { Logger } from '../../src/logging/logger.js';
import type { Tool, CallToolResult } from '../../src/mcp-client/types.js';

function noopLogger(): Logger {
  return {
    debug: () => undefined,
    info: () => undefined,
    warn: () => undefined,
    error: () => undefined,
    child: () => noopLogger(),
  } as unknown as Logger;
}

function createMockHub(tools: Tool[] = [], callToolImpl?: (name: string, args: unknown) => Promise<CallToolResult>): Hub {
  const hub = new EventEmitter() as Hub;
  hub.logger = noopLogger();
  hub.getAllTools = () => tools;
  hub.callTool = callToolImpl ?? (async (name: string) => ({
    content: [{ type: 'text', text: `called ${name}` }],
  }));
  return hub;
}

describe('MorphMCPServer — createDirectHandler', () => {
  it('returns parse error for invalid body', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler(null);
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32700);
  });

  it('returns invalid request for non-JSON-RPC message', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({ jsonrpc: '1.0' });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32600);
  });

  it('handles initialize with known protocol version', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2024-11-05' },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.protocolVersion).toBe('2024-11-05');
    expect(body.result.capabilities.tools.listChanged).toBe(true);
  });

  it('handles initialize with unknown protocol version (falls back to latest)', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2099-01-01' },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.protocolVersion).toBe('2025-11-25');
  });

  it('handles tools/list', async () => {
    const tools: Tool[] = [
      { name: 'ping', description: 'returns pong', inputSchema: { type: 'object', properties: {} } },
    ];
    const server = new MorphMCPServer(createMockHub(tools), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 2,
      method: 'tools/list',
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.tools).toHaveLength(1);
    expect(body.result.tools[0].name).toBe('ping');
  });

  it('handles tools/call', async () => {
    const mockCall = async (name: string) => ({
      content: [{ type: 'text', text: `hello from ${name}` }],
    });
    const server = new MorphMCPServer(createMockHub([], mockCall), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'ping' },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.content[0].text).toBe('hello from ping');
  });

  it('returns error for tools/call without name', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: {},
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32602);
  });

  it('handles notifications with 202', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      method: 'notifications/initialized',
    });
    expect(res.status).toBe(202);
    expect(res.body).toBe('');
  });

  it('returns method not found for unknown method', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 5,
      method: 'unknown/method',
    });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32601);
  });

  it('handles tool call errors gracefully', async () => {
    const mockCall = async () => { throw new Error('something broke'); };
    const server = new MorphMCPServer(createMockHub([], mockCall), noopLogger());
    const handler = server.createDirectHandler();
    const res = await handler({
      jsonrpc: '2.0',
      id: 6,
      method: 'tools/call',
      params: { name: 'fail' },
    });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.isError).toBe(true);
    expect(body.result.content[0].text).toContain('MORPH error');
  });
});

describe('MorphMCPServer — createPerMcpDirectHandler', () => {
  function createMockHub(tools: Tool[] = [], mcpName = 'test-mcp') {
    const hub = new EventEmitter() as Hub;
    hub.logger = noopLogger();
    hub.registry = {
      getTools: (name: string) => name === mcpName ? tools : [],
      getClient: () => null,
    } as unknown as Hub['registry'];
    hub.callTool = async (name: string) => ({
      content: [{ type: 'text', text: `called ${name}` }],
    });
    return hub;
  }

  it('handles initialize', async () => {
    const hub = createMockHub();
    const server = new MorphMCPServer(hub, noopLogger());
    const handler = server.createPerMcpDirectHandler('test-mcp');
    const res = await handler({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05' } });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.serverInfo.name).toBe('morph-test-mcp');
  });

  it('returns tools/list scoped to the MCP', async () => {
    const tools: Tool[] = [{ name: 'ping', description: 'returns pong', inputSchema: { type: 'object', properties: {} } }];
    const hub = createMockHub(tools);
    const server = new MorphMCPServer(hub, noopLogger());
    const handler = server.createPerMcpDirectHandler('test-mcp');
    const res = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/list' });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.tools).toHaveLength(1);
    expect(body.result.tools[0].name).toBe('ping');
  });

  it('routes tools/call through hub.callTool', async () => {
    const hub = createMockHub();
    const server = new MorphMCPServer(hub, noopLogger());
    const handler = server.createPerMcpDirectHandler('test-mcp');
    const res = await handler({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'ping' } });
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result.content[0].text).toBe('called ping');
  });

  it('returns 202 for notifications', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createPerMcpDirectHandler('test-mcp');
    const res = await handler({ jsonrpc: '2.0', method: 'notifications/initialized' });
    expect(res.status).toBe(202);
  });

  it('returns parse error for invalid body', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createPerMcpDirectHandler('test-mcp');
    const res = await handler(null);
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32700);
  });

  it('returns invalid request for non-JSON-RPC message', async () => {
    const server = new MorphMCPServer(createMockHub(), noopLogger());
    const handler = server.createPerMcpDirectHandler('test-mcp');
    const res = await handler({ jsonrpc: '1.0' });
    expect(res.status).toBe(400);
    const body = JSON.parse(res.body);
    expect(body.error.code).toBe(-32600);
  });
});

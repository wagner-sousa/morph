#!/usr/bin/env node
import http from 'node:http';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const PORT = Number(process.env.HTTP_MCP_PORT ?? 3200);

const server = new Server({ name: 'demo-http', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'ping', description: 'Health check — returns pong', inputSchema: { type: 'object', properties: {} } },
    {
      name: 'users',
      description: 'Return a list of demo users (uniform array — ideal for TOON)',
      inputSchema: {
        type: 'object',
        properties: { count: { type: 'number', description: 'How many users (default 25)' } },
      },
    },
    { name: 'echo', description: 'Echo back the given arguments', inputSchema: { type: 'object', properties: {} } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  switch (name) {
    case 'ping':
      return { content: [{ type: 'text', text: 'pong' }] };
    case 'echo':
      return { content: [{ type: 'text', text: JSON.stringify(args ?? {}) }] };
    case 'users': {
      const count = Math.max(1, Math.min(500, Number((args as { count?: number })?.count ?? 25)));
      const roles = ['admin', 'editor', 'viewer'];
      const users = Array.from({ length: count }, (_, i) => ({
        id: i + 1,
        name: `User ${i + 1}`,
        email: `user${i + 1}@example.com`,
        role: roles[i % roles.length],
        active: i % 4 !== 0,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(users) }] };
    }
    default:
      return { isError: true, content: [{ type: 'text', text: `unknown tool ${name}` }] };
  }
});

const transport = new StreamableHTTPServerTransport({
  sessionIdGenerator: () => crypto.randomUUID(),
});
await server.connect(transport);

const app = http.createServer(async (req, res) => {
  if (req.method === 'POST' && req.url === '/mcp') {
    const buffers: Buffer[] = [];
    for await (const chunk of req) buffers.push(chunk);
    const body = JSON.parse(Buffer.concat(buffers).toString());
    await transport.handleRequest(req, res, body);
  } else if (req.method === 'GET' && req.url === '/mcp') {
    await transport.handleRequest(req, res);
  } else {
    res.writeHead(405).end('Method Not Allowed');
  }
});

app.listen(PORT, () => {
  console.error(`HTTP MCP server listening on port ${PORT}`);
});

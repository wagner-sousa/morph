#!/usr/bin/env node
/**
 * A self-contained example MCP server that runs fully offline (it only needs
 * the MCP SDK, already bundled in node_modules). Useful for trying MORPH end to
 * end without downloading any external server.
 *
 * Referenced by morph.demo.json as:
 *   { "type": "stdio", "command": "node", "args": ["dist/examples/demo-mcp-server.js"] }
 *
 * Tools:
 *   ping     — returns "pong"
 *   users    — returns a uniform array of user objects (great TOON candidate)
 *   echo     — returns the arguments it was given
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'demo', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'ping', description: 'Health check — returns pong', inputSchema: { type: 'object' } },
    {
      name: 'users',
      description: 'Return a list of demo users (uniform array — ideal for TOON)',
      inputSchema: {
        type: 'object',
        properties: { count: { type: 'number', description: 'How many users (default 25)' } },
      },
    },
    { name: 'echo', description: 'Echo back the given arguments', inputSchema: { type: 'object' } },
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

await server.connect(new StdioServerTransport());

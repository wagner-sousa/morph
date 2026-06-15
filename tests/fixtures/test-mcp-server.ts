/**
 * A minimal real MCP server used by integration tests. Spawned over stdio.
 *
 * Tools:
 *   echo        — returns its arguments as JSON text
 *   fail        — returns an MCP tool error
 *   delay       — waits `ms` then echoes (latency simulation)
 *   large_json  — returns a uniform array of objects (ideal TOON candidate)
 */
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';

const server = new Server({ name: 'test-mcp', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'echo', description: 'Echo args', inputSchema: { type: 'object' } },
    { name: 'fail', description: 'Always fails', inputSchema: { type: 'object' } },
    { name: 'delay', description: 'Delay then echo', inputSchema: { type: 'object' } },
    { name: 'large_json', description: 'Large uniform JSON', inputSchema: { type: 'object' } },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args } = req.params;
  switch (name) {
    case 'echo':
      return { content: [{ type: 'text', text: JSON.stringify(args ?? {}) }] };
    case 'fail':
      return { isError: true, content: [{ type: 'text', text: 'intentional failure' }] };
    case 'delay': {
      const ms = Number((args as { ms?: number })?.ms ?? 10);
      await new Promise((r) => setTimeout(r, ms));
      return { content: [{ type: 'text', text: JSON.stringify(args ?? {}) }] };
    }
    case 'large_json': {
      const rows = Array.from({ length: 50 }, (_, i) => ({
        id: i,
        name: `item-${i}`,
        active: i % 2 === 0,
        score: i * 1.5,
      }));
      return { content: [{ type: 'text', text: JSON.stringify(rows) }] };
    }
    default:
      return { isError: true, content: [{ type: 'text', text: `unknown tool ${name}` }] };
  }
});

await server.connect(new StdioServerTransport());

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';

const basePath = process.argv.find((a) => a.startsWith('--base-path='))?.split('=')[1] ?? '/tmp/demo';
const demoMode = process.env.DEMO_MODE === 'true';

if (!existsSync(basePath)) mkdirSync(basePath, { recursive: true });

function prefix(msg: string) {
  return demoMode ? `[DEMO] ${msg}` : msg;
}

const server = new Server({ name: 'demo-params', version: '1.0.0' }, { capabilities: { tools: {} } });

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    {
      name: 'read',
      description: prefix('Read file contents'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from base directory' },
          encoding: { type: 'string', description: 'File encoding (utf-8, base64)', default: 'utf-8' },
          maxSize: { type: 'number', description: 'Maximum bytes to read', default: 65536 },
        },
        required: ['path'],
      },
    },
    {
      name: 'write',
      description: prefix('Write content to a file'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from base directory' },
          content: { type: 'string', description: 'Content to write' },
          append: { type: 'boolean', description: 'Append instead of overwrite', default: false },
        },
        required: ['path', 'content'],
      },
    },
    {
      name: 'list',
      description: prefix('List directory contents'),
      inputSchema: {
        type: 'object',
        properties: {
          dir: { type: 'string', description: 'Relative directory path from base' },
          pattern: { type: 'string', description: 'Glob-style filter (e.g. *.txt, data-*)' },
          recursive: { type: 'boolean', description: 'List recursively', default: false },
        },
        required: ['dir'],
      },
    },
    {
      name: 'stats',
      description: prefix('Get file or directory metadata'),
      inputSchema: {
        type: 'object',
        properties: {
          path: { type: 'string', description: 'Relative path from base directory' },
        },
        required: ['path'],
      },
    },
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name: tool, arguments: args } = req.params;
  const opts = (args ?? {}) as Record<string, unknown>;

  try {
    switch (tool) {
      case 'read': {
        const relPath = opts.path as string;
        const fullPath = join(basePath, relPath);
        if (!fullPath.startsWith(basePath)) throw new Error('Path traversal denied');
        const encoding = (opts.encoding as string) ?? 'utf-8';
        const maxSize = (opts.maxSize as number) ?? 65536;
        const content = readFileSync(fullPath, { encoding: encoding as BufferEncoding });
        const truncated = content.length > maxSize ? content.slice(0, maxSize) + '\n... [truncated]' : content;
        return { content: [{ type: 'text', text: prefix(truncated) }] };
      }
      case 'write': {
        const relPath = opts.path as string;
        const fullPath = join(basePath, relPath);
        if (!fullPath.startsWith(basePath)) throw new Error('Path traversal denied');
        mkdirSync(dirname(fullPath), { recursive: true });
        const content = opts.content as string;
        const append = (opts.append as boolean) ?? false;
        if (append) writeFileSync(fullPath, content, { flag: 'as' });
        else writeFileSync(fullPath, content);
        return { content: [{ type: 'text', text: prefix(`Written ${content.length} bytes to ${relPath}`) }] };
      }
      case 'list': {
        const relDir = opts.dir as string;
        const fullDir = join(basePath, relDir);
        if (!fullDir.startsWith(basePath)) throw new Error('Path traversal denied');
        const recursive = (opts.recursive as boolean) ?? false;
        const entries: string[] = [];
        if (recursive) {
          const walk = (dir: string) => {
            for (const entry of readdirSync(dir, { withFileTypes: true })) {
              const p = join(dir, entry.name);
              entries.push(p.slice(basePath.length + 1));
              if (entry.isDirectory()) walk(p);
            }
          };
          walk(fullDir);
        } else {
          for (const entry of readdirSync(fullDir, { withFileTypes: true })) {
            entries.push(entry.name + (entry.isDirectory() ? '/' : ''));
          }
        }
        const pattern = opts.pattern as string | undefined;
        const filtered = pattern ? entries.filter((e) => {
          const re = new RegExp('^' + pattern.replace(/\*/g, '.*').replace(/\?/g, '.') + '$');
          return re.test(e);
        }) : entries;
        return { content: [{ type: 'text', text: prefix(JSON.stringify(filtered, null, 2)) }] };
      }
      case 'stats': {
        const relPath = opts.path as string;
        const fullPath = join(basePath, relPath);
        if (!fullPath.startsWith(basePath)) throw new Error('Path traversal denied');
        const s = statSync(fullPath);
        return {
          content: [{
            type: 'text',
            text: prefix(JSON.stringify({
              path: relPath,
              size: s.size,
              isDirectory: s.isDirectory(),
              isFile: s.isFile(),
              created: s.birthtime.toISOString(),
              modified: s.mtime.toISOString(),
            }, null, 2)),
          }],
        };
      }
      default:
        return { isError: true, content: [{ type: 'text', text: `unknown tool ${tool}` }] };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { isError: true, content: [{ type: 'text', text: prefix(`Error: ${msg}`) }] };
  }
});

await server.connect(new StdioServerTransport());

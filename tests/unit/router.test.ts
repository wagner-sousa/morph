import { describe, expect, it } from 'vitest';
import { Router } from '../../src/router/index.js';
import { createLogger } from '../../src/logging/logger.js';
import { ToolNotFoundError } from '../../src/utils/errors.js';
import type { Tool } from '../../src/mcp-client/types.js';

const logger = createLogger('error', false);
const tool = (name: string): Tool => ({ name, description: name, inputSchema: { type: 'object' } });

function build(opts: {
  toolsByMcp: Record<string, string[]>;
  aliases?: Record<string, Record<string, string>>;
  allowConflicts?: boolean;
}): Router {
  const router = new Router(logger);
  router.buildRoutes({
    toolsByMcp: new Map(Object.entries(opts.toolsByMcp).map(([k, v]) => [k, v.map(tool)])),
    aliasesByMcp: new Map(Object.entries(opts.aliases ?? {})),
    allowConflicts: opts.allowConflicts ?? false,
  });
  return router;
}

describe('Router', () => {
  it('routes non-conflicting tools by their original name', () => {
    const r = build({ toolsByMcp: { fs: ['read_file'], clickup: ['create_task'] } });
    expect(r.resolve('read_file')).toEqual({ mcpName: 'fs', originalName: 'read_file' });
    expect(r.resolve('create_task')).toEqual({ mcpName: 'clickup', originalName: 'create_task' });
    expect(r.getAllTools().map((t) => t.name).sort()).toEqual(['create_task', 'read_file']);
  });

  it('auto-prefixes conflicting tool names', () => {
    const r = build({ toolsByMcp: { fs: ['read_file'], clickup: ['read_file'] } });
    expect(r.has('read_file')).toBe(false);
    expect(r.resolve('fs_read_file')).toEqual({ mcpName: 'fs', originalName: 'read_file' });
    expect(r.resolve('clickup_read_file')).toEqual({ mcpName: 'clickup', originalName: 'read_file' });
  });

  it('honours user aliases', () => {
    const r = build({
      toolsByMcp: { fs: ['read_file'] },
      aliases: { fs: { read_file: 'fs_read' } },
    });
    expect(r.resolve('fs_read')).toEqual({ mcpName: 'fs', originalName: 'read_file' });
  });

  it('last wins when allowConflicts is true', () => {
    const r = build({ toolsByMcp: { a: ['x'], b: ['x'] }, allowConflicts: true });
    expect(r.resolve('x')).toEqual({ mcpName: 'b', originalName: 'x' });
  });

  it('throws ToolNotFoundError for unknown tools', () => {
    const r = build({ toolsByMcp: { a: ['x'] } });
    expect(() => r.resolve('nope')).toThrowError(ToolNotFoundError);
  });
});

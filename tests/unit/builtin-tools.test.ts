import { describe, expect, it } from 'vitest';
import { isBuiltinTool, BUILTIN_TOOL_NAMES, BUILTIN_TOOLS } from '../../src/mcp-server/builtin-tools.js';

describe('isBuiltinTool', () => {
  it('returns true for _morph_status', () => expect(isBuiltinTool('_morph_status')).toBe(true));
  it('returns true for _morph_toon_stats', () => expect(isBuiltinTool('_morph_toon_stats')).toBe(true));
  it('returns true for _morph_reload_config', () => expect(isBuiltinTool('_morph_reload_config')).toBe(true));
  it('returns false for regular tool names', () => expect(isBuiltinTool('get_balance')).toBe(false));
  it('returns false for empty string', () => expect(isBuiltinTool('')).toBe(false));
});

describe('BUILTIN_TOOL_NAMES', () => {
  it('has status, toonStats, reloadConfig', () => {
    expect(BUILTIN_TOOL_NAMES.status).toBe('_morph_status');
    expect(BUILTIN_TOOL_NAMES.toonStats).toBe('_morph_toon_stats');
    expect(BUILTIN_TOOL_NAMES.reloadConfig).toBe('_morph_reload_config');
  });
});

describe('BUILTIN_TOOLS', () => {
  it('contains 3 tools', () => expect(BUILTIN_TOOLS).toHaveLength(3));
  it('each tool has name, description, inputSchema', () => {
    for (const t of BUILTIN_TOOLS) {
      expect(t.name).toBeTruthy();
      expect(t.description).toBeTruthy();
      expect(t.inputSchema).toBeDefined();
    }
  });
});

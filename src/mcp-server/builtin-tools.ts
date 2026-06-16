/**
 * SPEC: MORPH's own built-in tools, exposed to the agent alongside backend
 * tools. They use the `_morph_` prefix to avoid clashing with backend tools.
 */
import type { Tool } from "../mcp-client/types.js";

export const BUILTIN_TOOL_NAMES = {
  status: "_morph_status",
  toonStats: "_morph_toon_stats",
  reloadConfig: "_morph_reload_config",
} as const;

export const BUILTIN_TOOLS: Tool[] = [
  {
    name: BUILTIN_TOOL_NAMES.status,
    description:
      "Get MORPH status: connected MCP servers, total tools, and uptime.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: BUILTIN_TOOL_NAMES.toonStats,
    description:
      "Get aggregate TOON token-savings statistics for this session.",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
  {
    name: BUILTIN_TOOL_NAMES.reloadConfig,
    description:
      "Force a reload of morph.json (hot-reload backend MCP servers).",
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
  },
];

export function isBuiltinTool(name: string): boolean {
  return (Object.values(BUILTIN_TOOL_NAMES) as string[]).includes(name);
}

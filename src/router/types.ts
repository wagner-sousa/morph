/**
 * SPEC: routing contract — tool name (as exposed to the agent) → backend MCP.
 */
import type { Tool } from "../mcp-client/types.js";

export interface RouteEntry {
  /** Name exposed to the agent (possibly namespaced or aliased). */
  toolName: string;
  /** Original tool name on the backend. */
  originalName: string;
  /** Backend MCP identifier. */
  mcpName: string;
}

export interface ResolvedRoute {
  mcpName: string;
  originalName: string;
}

export interface RouterInput {
  /** MCP name → tools discovered from that MCP. */
  toolsByMcp: Map<string, Tool[]>;
  /** MCP name → optional alias map (originalName → exposedName). */
  aliasesByMcp: Map<string, Record<string, string> | undefined>;
  /** When true, on conflict the last MCP wins (otherwise auto-prefix). */
  allowConflicts: boolean;
}

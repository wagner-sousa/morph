/**
 * IMPL: the Router maps agent-facing tool names to backend MCP clients.
 *
 * Conflict resolution (when two MCPs expose the same tool name):
 *   1. user alias (explicit `aliases` in config) is always honoured;
 *   2. otherwise non-aliased conflicts are auto-prefixed as `${mcp}_${tool}`;
 *   3. if `allowConflicts` is set, the last MCP wins and a warning is logged.
 */
import type { Logger } from '../logging/logger.js';
import { ToolNotFoundError } from '../utils/errors.js';
import type { Tool } from '../mcp-client/types.js';
import type { ResolvedRoute, RouteEntry, RouterInput } from './types.js';

interface Candidate {
  mcpName: string;
  originalName: string;
  desiredName: string;
  aliased: boolean;
  tool: Tool;
}

export class Router {
  private routes = new Map<string, RouteEntry>();
  private toolDefs = new Map<string, Tool>();

  constructor(private readonly logger: Logger) {}

  buildRoutes(input: RouterInput): void {
    this.routes.clear();
    this.toolDefs.clear();

    const candidates: Candidate[] = [];
    for (const [mcpName, tools] of input.toolsByMcp) {
      const aliases = input.aliasesByMcp.get(mcpName) ?? {};
      for (const tool of tools) {
        const aliased = Object.prototype.hasOwnProperty.call(aliases, tool.name);
        candidates.push({
          mcpName,
          originalName: tool.name,
          desiredName: aliased ? aliases[tool.name] : tool.name,
          aliased,
          tool,
        });
      }
    }

    // Group by desired exposed name to detect conflicts.
    const groups = new Map<string, Candidate[]>();
    for (const c of candidates) {
      const list = groups.get(c.desiredName);
      if (list) list.push(c);
      else groups.set(c.desiredName, [c]);
    }

    for (const [desiredName, group] of groups) {
      if (group.length === 1) {
        this.register(desiredName, group[0]);
        continue;
      }
      if (input.allowConflicts) {
        const winner = group[group.length - 1];
        this.logger.warn(
          { tool: desiredName, mcps: group.map((g) => g.mcpName) },
          'tool name conflict — last MCP wins (allowConflicts)',
        );
        this.register(desiredName, winner);
        continue;
      }
      // Auto-prefix everything in the conflicting group.
      this.logger.warn(
        { tool: desiredName, mcps: group.map((g) => g.mcpName) },
        'tool name conflict — auto-prefixing with MCP name',
      );
      for (const c of group) {
        let exposed = `${c.mcpName}_${c.originalName}`;
        let i = 2;
        while (this.routes.has(exposed)) exposed = `${c.mcpName}_${c.originalName}_${i++}`;
        this.register(exposed, c);
      }
    }

    this.logger.info({ tools: this.routes.size }, 'routes built');
  }

  private register(exposedName: string, c: Candidate): void {
    this.routes.set(exposedName, {
      toolName: exposedName,
      originalName: c.originalName,
      mcpName: c.mcpName,
    });
    this.toolDefs.set(exposedName, { ...c.tool, name: exposedName });
  }

  resolve(toolName: string): ResolvedRoute {
    const route = this.routes.get(toolName);
    if (!route) throw new ToolNotFoundError(toolName);
    return { mcpName: route.mcpName, originalName: route.originalName };
  }

  has(toolName: string): boolean {
    return this.routes.has(toolName);
  }

  getAllTools(): Tool[] {
    return [...this.toolDefs.values()];
  }

  getRouteTable(): RouteEntry[] {
    return [...this.routes.values()];
  }
}

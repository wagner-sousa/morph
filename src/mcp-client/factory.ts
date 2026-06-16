/**
 * IMPL: creates the right MCP client for a definition's transport type.
 */
import type { MCPDefinition } from "../config/types.js";
import { StdioMCPClient } from "./stdio-client.js";
import { HttpMCPClient } from "./http-client.js";
import { SseMCPClient } from "./sse-client.js";
import type { ClientOptions, MCPClient } from "./types.js";

export function createMCPClient(
  definition: MCPDefinition,
  options: ClientOptions,
): MCPClient {
  const { transport } = definition;
  switch (transport.type) {
    case "stdio":
      return new StdioMCPClient(definition.name, transport, options);
    case "http":
      return new HttpMCPClient(definition.name, transport, options);
    case "sse":
      return new SseMCPClient(definition.name, transport, options);
    default: {
      const exhaustive: never = transport;
      throw new Error(`unknown transport type: ${JSON.stringify(exhaustive)}`);
    }
  }
}

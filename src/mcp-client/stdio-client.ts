/**
 * IMPL: backend MCP client over stdio (spawns a child process).
 */
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { BaseMCPClient } from "./base-client.js";
import type { ClientOptions } from "./types.js";
import type { StdioTransport } from "../config/types.js";

export class StdioMCPClient extends BaseMCPClient {
  constructor(
    name: string,
    private readonly config: StdioTransport,
    options: ClientOptions,
  ) {
    super(name, options);
  }

  protected createTransport(): Transport {
    return new StdioClientTransport({
      command: this.config.command,
      args: this.config.args,
      // Child inherits MORPH's env plus any per-server overrides.
      env: { ...filterEnv(process.env), ...(this.config.env ?? {}) },
      cwd: this.config.cwd,
      stderr: "inherit",
    });
  }
}

/** Drop undefined values so the type matches Record<string,string>. */
function filterEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(env)) if (v !== undefined) out[k] = v;
  return out;
}

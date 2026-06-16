/**
 * IMPL: resolves the on-disk paths MORPH uses, all rooted at a single data dir.
 *
 * A single folder (default ./data, overridable with MORPH_DATA_DIR) holds the
 * SQLite DB, OAuth sessions, optional log files, and — when present — the
 * config files. This keeps Docker usage to one volume mount.
 *
 * Resolution precedence for the config files:
 *   explicit flag / env  >  ${dataDir}/morph.json  >  ./morph.json
 */
import { existsSync } from "node:fs";
import { resolve as resolvePath, dirname, basename } from "node:path";

export interface ResolvePathsInput {
  /** Explicit morph.json path (CLI --config). */
  configFlag?: string;
  /** Explicit .mcp.json path (CLI --mcp-config). */
  mcpFlag?: string;
  env?: NodeJS.ProcessEnv;
}

export interface ResolvedPaths {
  /** Single root directory for all persisted data. */
  dataDir: string;
  /** Absolute path to morph.json. */
  configPath: string;
  /** Absolute path to .mcp.json (sibling of the config). */
  mcpPath: string;
  /** Directory for optional file logs. */
  logDir: string;
}

/**
 * Derive the .mcp.json path: explicit flag/env wins, otherwise a sibling of the
 * morph config — `morph<suffix>.json` → `.mcp<suffix>.json` in the same folder.
 */
export function resolveMcpConfigPath(
  configPath: string,
  explicit?: string,
): string {
  if (explicit) return resolvePath(explicit);
  const dir = dirname(configPath);
  const base = basename(configPath);
  const m = base.match(/^morph(.*)\.json$/);
  const sibling = m ? `.mcp${m[1]}.json` : ".mcp.json";
  return resolvePath(dir, sibling);
}

/** Resolve all data/config/log paths from flags + environment. */
export function resolvePaths(input: ResolvePathsInput = {}): ResolvedPaths {
  const env = input.env ?? process.env;
  const dataDir = resolvePath(env.MORPH_DATA_DIR ?? "./data");

  // Config: explicit flag/env wins; else prefer ${dataDir}/morph.json, then ./morph.json.
  const explicitConfig = input.configFlag ?? env.MORPH_CONFIG;
  let configPath: string;
  if (explicitConfig) {
    configPath = resolvePath(explicitConfig);
  } else {
    const inData = resolvePath(dataDir, "morph.json");
    configPath = existsSync(inData) ? inData : resolvePath("./morph.json");
  }

  const mcpPath = resolveMcpConfigPath(
    configPath,
    input.mcpFlag ?? env.MORPH_MCP_CONFIG,
  );
  const logDir = resolvePath(env.MORPH_LOG_DIR ?? resolvePath(dataDir, "logs"));

  return { dataDir, configPath, mcpPath, logDir };
}

/**
 * IMPL: loads morph.json + .mcp.json, resolves ${ENV_VAR} references, merges
 * and validates with zod.
 *
 * Configuration is split across two files:
 *   - morph.json → morph/toon/webUi/health settings
 *   - .mcp.json  → MCP servers (Claude-style keyed object)
 * They are read independently and merged into a single MorphConfig.
 */
import { readFile, writeFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { z } from "zod";
import { ConfigError } from "../utils/errors.js";
import { resolveEnvVars } from "../utils/env.js";
import {
  fromMcpDefinitions,
  McpFileSchema,
  MorphConfigSchema,
  MorphFileSchema,
  toMcpDefinitions,
} from "./schema.js";
import type { MorphConfig } from "./types.js";

export interface LoadOptions {
  /** Resolve ${ENV_VAR} references against process.env (default true). */
  resolveEnv?: boolean;
  env?: NodeJS.ProcessEnv;
}

/** Format zod issues into a readable, multi-line message. */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join(".") : "(root)";
      return `  • ${path}: ${issue.message}`;
    })
    .join("\n");
}

function parseWith<S extends z.ZodTypeAny>(
  schema: S,
  raw: unknown,
  label: string,
): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(
      `invalid ${label}:\n${formatZodError(result.error)}`,
      result.error.issues,
    );
  }
  return result.data as z.infer<S>;
}

/** Validate an already-merged object against the in-memory config schema. */
export function validateConfig(raw: unknown): MorphConfig {
  return parseWith(MorphConfigSchema, raw, "configuration");
}

/** Coerce a `${VAR}`-style env string to boolean. Throws on unrecognized values. */
function envBool(name: string, raw: string): boolean {
  const v = raw.trim().toLowerCase();
  if (["true", "1", "yes", "on"].includes(v)) return true;
  if (["false", "0", "no", "off"].includes(v)) return false;
  throw new ConfigError(
    `invalid boolean for ${name}: "${raw}" (use true/false)`,
  );
}

/** Coerce an env string to integer. Throws when not a finite integer. */
function envInt(name: string, raw: string): number {
  const n = Number(raw);
  if (!Number.isInteger(n))
    throw new ConfigError(`invalid integer for ${name}: "${raw}"`);
  return n;
}

/**
 * Apply dedicated `MORPH_*` environment overrides onto a merged config.
 *
 * Precedence: these win over JSON values but are themselves overridden by CLI
 * flags (applied later in index.ts). Only variables that are *set* take effect.
 * The result is re-validated so invalid enum/range values fail with a clear
 * message instead of silently corrupting the config.
 *
 * Note: `.mcp.json` servers are intentionally not covered here — their dynamic,
 * per-server shape is parameterized via `${VAR}` interpolation instead.
 */
export function applyEnvOverrides(
  config: MorphConfig,
  env: NodeJS.ProcessEnv,
): MorphConfig {
  const next: MorphConfig = {
    ...config,
    morph: { ...config.morph },
    toon: { ...config.toon },
    webUi: { ...config.webUi },
    health: { ...config.health },
  };

  const set = (name: string, apply: (raw: string) => void): void => {
    const raw = env[name];
    if (raw !== undefined && raw !== "") apply(raw);
  };

  // morph.*
  set(
    "MORPH_LOG_LEVEL",
    (v) => (next.morph.logLevel = v as MorphConfig["morph"]["logLevel"]),
  );
  set(
    "MORPH_ALLOW_CONFLICTS",
    (v) => (next.morph.allowConflicts = envBool("MORPH_ALLOW_CONFLICTS", v)),
  );
  set("MORPH_TOOL_PREFIX", (v) => (next.morph.toolPrefix = v));

  // webUi.*
  set(
    "MORPH_WEB_ENABLED",
    (v) => (next.webUi.enabled = envBool("MORPH_WEB_ENABLED", v)),
  );
  set("MORPH_WEB_HOST", (v) => (next.webUi.host = v));
  set("MORPH_WEB_PORT", (v) => (next.webUi.port = envInt("MORPH_WEB_PORT", v)));
  set("MORPH_WEB_PUBLIC_URL", (v) => (next.webUi.publicUrl = v));

  // toon.*
  set(
    "MORPH_TOON_AUTO_CONVERT",
    (v) => (next.toon.autoConvert = envBool("MORPH_TOON_AUTO_CONVERT", v)),
  );
  set(
    "MORPH_TOON_DELIMITER",
    (v) => (next.toon.delimiter = v as MorphConfig["toon"]["delimiter"]),
  );
  set(
    "MORPH_TOON_INDENT",
    (v) => (next.toon.indent = envInt("MORPH_TOON_INDENT", v)),
  );
  set(
    "MORPH_TOON_FLATTEN_DEPTH",
    (v) => (next.toon.flattenDepth = envInt("MORPH_TOON_FLATTEN_DEPTH", v)),
  );
  set(
    "MORPH_TOON_THRESHOLD",
    (v) => (next.toon.threshold = envInt("MORPH_TOON_THRESHOLD", v)),
  );

  // health.*
  set(
    "MORPH_HEALTH_INTERVAL_MS",
    (v) => (next.health.intervalMs = envInt("MORPH_HEALTH_INTERVAL_MS", v)),
  );
  set(
    "MORPH_HEALTH_TIMEOUT_MS",
    (v) => (next.health.timeoutMs = envInt("MORPH_HEALTH_TIMEOUT_MS", v)),
  );
  set(
    "MORPH_HEALTH_MAX_RETRIES",
    (v) => (next.health.maxRetries = envInt("MORPH_HEALTH_MAX_RETRIES", v)),
  );

  // Re-validate so bad enum/range values (e.g. an unknown delimiter) fail loudly.
  return validateConfig(next);
}

/**
 * Resolve ${ENV_VAR} references across the .mcp.json server map. Missing
 * variables are only fatal for *enabled* servers — placeholders inside disabled
 * servers are left intact so they never block startup.
 */
function resolveMcpEnv(
  servers: Record<string, Record<string, unknown>>,
  env?: NodeJS.ProcessEnv,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [name, server] of Object.entries(servers)) {
    out[name] = resolveEnvVars(server, {
      env,
      strict: server.enabled !== false,
    });
  }
  return out;
}

/** Parse the two config JSON strings into a single validated MorphConfig. */
export function parseConfig(
  morphText: string,
  mcpText: string | undefined,
  options: LoadOptions = {},
): MorphConfig {
  let morphRaw: unknown;
  try {
    morphRaw = JSON.parse(morphText);
  } catch (err) {
    throw new ConfigError(
      `morph.json is not valid JSON: ${(err as Error).message}`,
    );
  }

  let mcpRaw: unknown = { mcpServers: {} };
  if (mcpText !== undefined) {
    try {
      mcpRaw = JSON.parse(mcpText);
    } catch (err) {
      throw new ConfigError(
        `.mcp.json is not valid JSON: ${(err as Error).message}`,
      );
    }
  }

  const resolveEnv = options.resolveEnv !== false;
  const morphResolved = resolveEnv
    ? resolveEnvVars(morphRaw, { env: options.env })
    : morphRaw;
  const morphFile = parseWith(MorphFileSchema, morphResolved, "morph.json");

  const mcpFile = parseWith(McpFileSchema, mcpRaw, ".mcp.json");
  type Entry = z.infer<typeof McpFileSchema>["mcpServers"][string];
  const serversRecord = mcpFile.mcpServers;
  const serversResolved = resolveEnv
    ? (resolveMcpEnv(serversRecord, options.env) as Record<string, Entry>)
    : serversRecord;

  const merged = validateConfig({
    ...morphFile,
    mcpServers: toMcpDefinitions(serversResolved),
  });
  return resolveEnv
    ? applyEnvOverrides(merged, options.env ?? process.env)
    : merged;
}

export interface SaveOptions {
  /** $schema reference to write into morph.json (default ./schema.json). */
  morphSchemaRef?: string;
  /** $schema reference to write into .mcp.json (default ./mcp.schema.json). */
  mcpSchemaRef?: string;
}

/** Persist the merged config back to its two files (morph.json + .mcp.json). */
export async function saveConfig(
  morphPath: string,
  mcpPath: string,
  config: MorphConfig,
  options: SaveOptions = {},
): Promise<void> {
  const { mcpServers, $schema, ...morph } = config;
  const morphFile = {
    $schema: options.morphSchemaRef ?? $schema ?? "./schema.json",
    ...morph,
  };
  const mcpFile = {
    $schema: options.mcpSchemaRef ?? "./mcp.schema.json",
    mcpServers: fromMcpDefinitions(mcpServers),
  };
  await writeFile(
    resolvePath(morphPath),
    JSON.stringify(morphFile, null, 2) + "\n",
  );
  await writeFile(
    resolvePath(mcpPath),
    JSON.stringify(mcpFile, null, 2) + "\n",
  );
}

async function readOptional(absolute: string): Promise<string | undefined> {
  try {
    return await readFile(absolute, "utf8");
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === "ENOENT") return undefined;
    throw new ConfigError(`cannot read ${absolute}: ${(err as Error).message}`);
  }
}

/** Read morph.json and .mcp.json from disk and merge into a validated config. */
export async function loadConfig(
  morphPath: string,
  mcpPath: string,
  options: LoadOptions = {},
): Promise<MorphConfig> {
  const morphAbs = resolvePath(morphPath);
  let morphText: string;
  try {
    morphText = await readFile(morphAbs, "utf8");
  } catch (err) {
    throw new ConfigError(
      `cannot read config file at ${morphAbs}: ${(err as Error).message}`,
    );
  }
  const mcpText = await readOptional(resolvePath(mcpPath));
  return parseConfig(morphText, mcpText, options);
}

/**
 * IMPL: loads morph.json, resolves ${ENV_VAR} references, validates with zod.
 */
import { readFile } from "node:fs/promises";
import { resolve as resolvePath } from "node:path";
import { z } from "zod";
import { ConfigError } from "../utils/errors.js";
import { resolveEnvVars } from "../utils/env.js";
import { MorphConfigSchema } from "./schema.js";
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

/** Validate an already-parsed object against the schema. */
export function validateConfig(raw: unknown): MorphConfig {
  const result = MorphConfigSchema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(
      `invalid configuration:\n${formatZodError(result.error)}`,
      result.error.issues,
    );
  }
  return result.data;
}

/**
 * Resolve ${ENV_VAR} references across the config. Missing variables are only
 * fatal for the global config and for *enabled* MCP servers — placeholders
 * inside disabled servers are left intact so they never block startup.
 */
function resolveConfigEnv(raw: unknown, env?: NodeJS.ProcessEnv): unknown {
  if (
    raw &&
    typeof raw === "object" &&
    Array.isArray((raw as { mcpServers?: unknown }).mcpServers)
  ) {
    const obj = raw as Record<string, unknown> & {
      mcpServers: Array<Record<string, unknown>>;
    };
    const servers = obj.mcpServers.map((server) =>
      resolveEnvVars(server, { env, strict: server.enabled !== false }),
    );
    const rest = resolveEnvVars(
      { ...obj, mcpServers: [] },
      { env, strict: true },
    );
    return { ...rest, mcpServers: servers };
  }
  return resolveEnvVars(raw, { env });
}

/** Parse a JSON string into a validated config (env already resolved or not). */
export function parseConfig(
  jsonText: string,
  options: LoadOptions = {},
): MorphConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonText);
  } catch (err) {
    throw new ConfigError(
      `config is not valid JSON: ${(err as Error).message}`,
    );
  }

  const resolved =
    options.resolveEnv === false
      ? parsed
      : resolveConfigEnv(parsed, options.env);

  return validateConfig(resolved);
}

/** Serialize and persist a config back to disk, preserving `$schema` if present. */
export async function saveConfig(
  path: string,
  config: MorphConfig,
  schemaRef?: string,
): Promise<void> {
  const { writeFile } = await import("node:fs/promises");
  const obj = config as Record<string, unknown>;
  if (schemaRef) obj.$schema = schemaRef;
  await writeFile(resolvePath(path), JSON.stringify(obj, null, 2) + "\n");
}

/** Read and validate morph.json from disk. */
export async function loadConfig(
  path: string,
  options: LoadOptions = {},
): Promise<MorphConfig> {
  const absolute = resolvePath(path);
  let text: string;
  try {
    text = await readFile(absolute, "utf8");
  } catch (err) {
    throw new ConfigError(
      `cannot read config file at ${absolute}: ${(err as Error).message}`,
    );
  }
  return parseConfig(text, options);
}

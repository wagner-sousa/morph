/**
 * IMPL: loads morph.json + .mcp.json, resolves ${ENV_VAR} references, merges
 * and validates with zod.
 *
 * Configuration is split across two files:
 *   - morph.json → morph/toon/webUi/health settings
 *   - .mcp.json  → MCP servers (Claude-style keyed object)
 * They are read independently and merged into a single MorphConfig.
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve as resolvePath } from 'node:path';
import { z } from 'zod';
import { ConfigError } from '../utils/errors.js';
import { resolveEnvVars } from '../utils/env.js';
import {
  fromMcpDefinitions,
  McpFileSchema,
  MorphConfigSchema,
  MorphFileSchema,
  toMcpDefinitions,
} from './schema.js';
import type { MorphConfig } from './types.js';

export interface LoadOptions {
  /** Resolve ${ENV_VAR} references against process.env (default true). */
  resolveEnv?: boolean;
  env?: NodeJS.ProcessEnv;
}

/** Format zod issues into a readable, multi-line message. */
function formatZodError(error: z.ZodError): string {
  return error.issues
    .map((issue) => {
      const path = issue.path.length ? issue.path.join('.') : '(root)';
      return `  • ${path}: ${issue.message}`;
    })
    .join('\n');
}

function parseWith<S extends z.ZodTypeAny>(schema: S, raw: unknown, label: string): z.infer<S> {
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ConfigError(`invalid ${label}:\n${formatZodError(result.error)}`, result.error.issues);
  }
  return result.data;
}

/** Validate an already-merged object against the in-memory config schema. */
export function validateConfig(raw: unknown): MorphConfig {
  return parseWith(MorphConfigSchema, raw, 'configuration');
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
    out[name] = resolveEnvVars(server, { env, strict: server?.enabled !== false });
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
    throw new ConfigError(`morph.json is not valid JSON: ${(err as Error).message}`);
  }

  let mcpRaw: unknown = { mcpServers: {} };
  if (mcpText !== undefined) {
    try {
      mcpRaw = JSON.parse(mcpText);
    } catch (err) {
      throw new ConfigError(`.mcp.json is not valid JSON: ${(err as Error).message}`);
    }
  }

  const resolveEnv = options.resolveEnv !== false;
  const morphResolved = resolveEnv ? resolveEnvVars(morphRaw, { env: options.env }) : morphRaw;
  const morphFile = parseWith(MorphFileSchema, morphResolved, 'morph.json');

  const mcpFile = parseWith(McpFileSchema, mcpRaw, '.mcp.json');
  type Entry = z.infer<typeof McpFileSchema>['mcpServers'][string];
  const serversRecord = (mcpFile.mcpServers ?? {}) as Record<string, Entry>;
  const serversResolved = resolveEnv
    ? (resolveMcpEnv(
        serversRecord as Record<string, Record<string, unknown>>,
        options.env,
      ) as Record<string, Entry>)
    : serversRecord;

  return validateConfig({ ...morphFile, mcpServers: toMcpDefinitions(serversResolved) });
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
  const morphFile = { $schema: options.morphSchemaRef ?? $schema ?? './schema.json', ...morph };
  const mcpFile = {
    $schema: options.mcpSchemaRef ?? './mcp.schema.json',
    mcpServers: fromMcpDefinitions(mcpServers),
  };
  await writeFile(resolvePath(morphPath), JSON.stringify(morphFile, null, 2) + '\n');
  await writeFile(resolvePath(mcpPath), JSON.stringify(mcpFile, null, 2) + '\n');
}

async function readOptional(absolute: string): Promise<string | undefined> {
  try {
    return await readFile(absolute, 'utf8');
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code;
    if (code === 'ENOENT') return undefined;
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
    morphText = await readFile(morphAbs, 'utf8');
  } catch (err) {
    throw new ConfigError(`cannot read config file at ${morphAbs}: ${(err as Error).message}`);
  }
  const mcpText = await readOptional(resolvePath(mcpPath));
  return parseConfig(morphText, mcpText, options);
}

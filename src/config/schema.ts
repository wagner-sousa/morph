/**
 * SPEC: executable zod schemas for morph.json and .mcp.json.
 *
 * This is the single source of truth for configuration structure. The
 * TypeScript types in {@link ./types.ts} are inferred from these schemas.
 *
 * Configuration now lives in two files:
 *   - morph.json  → morph/toon/webUi/health settings ({@link MorphFileSchema})
 *   - .mcp.json   → MCP servers, Claude-style keyed object ({@link McpFileSchema})
 *
 * At load time the two are merged into the in-memory {@link MorphConfigSchema}.
 */
import { z } from "zod";

export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const;
export const DELIMITER_NAMES = ["comma", "tab", "pipe"] as const;

const NameSchema = z
  .string()
  .min(1, "name must not be empty")
  .regex(
    /^[a-zA-Z0-9_.-]+$/,
    "name may only contain letters, numbers, ., _ and -",
  );

export const StdioTransportSchema = z.object({
  type: z.literal("stdio"),
  command: z.string().min(1, "stdio transport requires a command"),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const HttpTransportSchema = z.object({
  type: z.literal("http"),
  url: z.string().url("http transport requires a valid url"),
  headers: z.record(z.string()).optional(),
  apiKey: z.string().optional(),
});

export const SseTransportSchema = z.object({
  type: z.literal("sse"),
  url: z.string().url("sse transport requires a valid url"),
  headers: z.record(z.string()).optional(),
  reconnectIntervalMs: z.number().int().positive().optional(),
});

export const TransportSchema = z.discriminatedUnion("type", [
  StdioTransportSchema,
  HttpTransportSchema,
  SseTransportSchema,
]);

/**
 * Per-tool projection applied to a tool's JSON response before TOON conversion.
 * `include` keeps only the listed paths; `exclude` removes them. Paths use
 * dot-notation and traverse arrays element-wise (e.g. "tasks.id").
 */
export const FieldSelectionSchema = z.object({
  mode: z.enum(["include", "exclude"]),
  fields: z.array(z.string().min(1)).min(1),
});

/** Map of backend tool name → its field selection. */
export const FieldSelectionMapSchema = z.record(FieldSelectionSchema);

/** Internal MCP server representation (post-merge, with explicit transport). */
export const MCPDefinitionSchema = z.object({
  name: NameSchema,
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  labels: z.record(z.string()).optional(),
  /** Rename a backend tool as exposed to the agent: { "read_file": "fs_read" }. */
  aliases: z.record(z.string()).optional(),
  /** Per-tool response field projection (keyed by backend tool name). */
  fieldSelection: FieldSelectionMapSchema.optional(),
  transport: TransportSchema,
});

/**
 * A single server entry as written in .mcp.json (Claude-style, flat). The
 * transport is inferred from the fields: a `url` with `type: http|sse` becomes
 * that transport, anything else is stdio. `type` defaults to "stdio".
 */
export const McpServerEntrySchema = z
  .object({
    type: z.enum(["stdio", "http", "sse"]).optional(),
    command: z.string().optional(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
    cwd: z.string().optional(),
    timeoutMs: z.number().int().positive().optional(),
    url: z.string().optional(),
    headers: z.record(z.string()).optional(),
    apiKey: z.string().optional(),
    reconnectIntervalMs: z.number().int().positive().optional(),
    // morph extensions:
    enabled: z.boolean().optional(),
    description: z.string().optional(),
    labels: z.record(z.string()).optional(),
    aliases: z.record(z.string()).optional(),
    fieldSelection: FieldSelectionMapSchema.optional(),
  })
  .superRefine((entry, ctx) => {
    const type = entry.type ?? "stdio";
    if (type === "stdio" && !entry.command) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "stdio server requires a command",
      });
    }
    if ((type === "http" || type === "sse") && !entry.url) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: `${type} server requires a url`,
      });
    }
  });

/** Shape of the .mcp.json file on disk. */
export const McpFileSchema = z.object({
  $schema: z.string().optional(),
  mcpServers: z.record(NameSchema, McpServerEntrySchema).default({}),
});

export const ToonOptionsSchema = z
  .object({
    autoConvert: z.boolean().default(true),
    delimiter: z.enum(DELIMITER_NAMES).default("comma"),
    indent: z.number().int().min(0).max(8).default(2),
    flattenDepth: z.number().int().min(0).default(4),
    threshold: z.number().int().min(0).default(100),
  })
  .default({});

export const WebUiSchema = z
  .object({
    enabled: z.boolean().default(true),
    host: z.string().default("0.0.0.0"),
    port: z.number().int().min(1).max(65535).default(3100),
    publicUrl: z.string().url().optional(),
    auth: z
      .object({
        username: z.string(),
        passwordHash: z.string(),
      })
      .optional(),
  })
  .default({});

export const HealthSchema = z
  .object({
    intervalMs: z.number().int().positive().default(30000),
    timeoutMs: z.number().int().positive().default(5000),
    maxRetries: z.number().int().min(0).default(3),
  })
  .default({});

export const MorphSettingsSchema = z
  .object({
    version: z.string().default("1.0"),
    logLevel: z.enum(LOG_LEVELS).default("info"),
    /** When true, last-registered tool wins on name conflicts (logged). */
    allowConflicts: z.boolean().default(false),
    /** Template for prefixing exposed tool names. "{name}" is replaced with the MCP name.
     *  Empty string = no prefix (only prefix on conflicts, current default).
     *  Examples: "{name}_" → stripe_get_balance, "{name}:" → stripe:get_balance. */
    toolPrefix: z.string().default(""),
  })
  .default({});

/** Shape of the morph.json file on disk (no MCP servers). */
export const MorphFileSchema = z.object({
  $schema: z.string().optional(),
  morph: MorphSettingsSchema,
  toon: ToonOptionsSchema,
  webUi: WebUiSchema,
  health: HealthSchema,
});

/**
 * In-memory merged configuration: the morph.json settings plus the MCP servers
 * resolved from .mcp.json. This is what the rest of the codebase consumes.
 */
export const MorphConfigSchema = z
  .object({
    $schema: z.string().optional(),
    morph: MorphSettingsSchema,
    mcpServers: z.array(MCPDefinitionSchema).default([]),
    toon: ToonOptionsSchema,
    webUi: WebUiSchema,
    health: HealthSchema,
  })
  .superRefine((cfg, ctx) => {
    const seen = new Set<string>();
    for (const [i, server] of cfg.mcpServers.entries()) {
      if (seen.has(server.name)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate MCP name: "${server.name}"`,
          path: ["mcpServers", i, "name"],
        });
      }
      seen.add(server.name);
    }
  });

/** Convert internal MCPDefinition[] back into a .mcp.json keyed server object. */
export function fromMcpDefinitions(
  defs: Array<z.infer<typeof MCPDefinitionSchema>>,
): Record<string, z.infer<typeof McpServerEntrySchema>> {
  const out: Record<string, z.infer<typeof McpServerEntrySchema>> = {};
  for (const def of defs) {
    const entry: z.infer<typeof McpServerEntrySchema> = {};
    if (!def.enabled) entry.enabled = false;
    if (def.description) entry.description = def.description;
    if (def.labels) entry.labels = def.labels;
    if (def.aliases) entry.aliases = def.aliases;
    if (def.fieldSelection) entry.fieldSelection = def.fieldSelection;
    const t = def.transport;
    if (t.type === "http") {
      entry.type = "http";
      entry.url = t.url;
      if (t.headers) entry.headers = t.headers;
      if (t.apiKey) entry.apiKey = t.apiKey;
    } else if (t.type === "sse") {
      entry.type = "sse";
      entry.url = t.url;
      if (t.headers) entry.headers = t.headers;
      if (t.reconnectIntervalMs)
        entry.reconnectIntervalMs = t.reconnectIntervalMs;
    } else {
      entry.command = t.command;
      if (t.args.length) entry.args = t.args;
      if (t.env) entry.env = t.env;
      if (t.cwd) entry.cwd = t.cwd;
      if (t.timeoutMs) entry.timeoutMs = t.timeoutMs;
    }
    out[def.name] = entry;
  }
  return out;
}

/** Convert a .mcp.json keyed server object into internal MCPDefinition[]. */
export function toMcpDefinitions(
  servers: Record<string, z.infer<typeof McpServerEntrySchema>>,
): Array<z.infer<typeof MCPDefinitionSchema>> {
  return Object.entries(servers).map(([name, entry]) => {
    const type = entry.type ?? "stdio";
    const base = {
      name,
      enabled: entry.enabled ?? true,
      description: entry.description,
      labels: entry.labels,
      aliases: entry.aliases,
      fieldSelection: entry.fieldSelection,
    };
    if (type === "http") {
      return {
        ...base,
        transport: {
          type: "http" as const,
          url: entry.url ?? "",
          headers: entry.headers,
          apiKey: entry.apiKey,
        },
      };
    }
    if (type === "sse") {
      return {
        ...base,
        transport: {
          type: "sse" as const,
          url: entry.url ?? "",
          headers: entry.headers,
          reconnectIntervalMs: entry.reconnectIntervalMs,
        },
      };
    }
    return {
      ...base,
      transport: {
        type: "stdio" as const,
        command: entry.command ?? "",
        args: entry.args ?? [],
        env: entry.env,
        cwd: entry.cwd,
        timeoutMs: entry.timeoutMs,
      },
    };
  });
}

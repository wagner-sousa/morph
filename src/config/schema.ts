/**
 * SPEC: executable zod schema for morph.json.
 *
 * This is the single source of truth for configuration structure. The
 * TypeScript types in {@link ./types.ts} are inferred from these schemas.
 */
import { z } from 'zod';

export const LOG_LEVELS = ['debug', 'info', 'warn', 'error'] as const;
export const DELIMITER_NAMES = ['comma', 'tab', 'pipe'] as const;

const NameSchema = z
  .string()
  .min(1, 'name must not be empty')
  .regex(/^[a-zA-Z0-9_.-]+$/, 'name may only contain letters, numbers, ., _ and -');

export const StdioTransportSchema = z.object({
  type: z.literal('stdio'),
  command: z.string().min(1, 'stdio transport requires a command'),
  args: z.array(z.string()).default([]),
  env: z.record(z.string()).optional(),
  cwd: z.string().optional(),
  timeoutMs: z.number().int().positive().optional(),
});

export const HttpTransportSchema = z.object({
  type: z.literal('http'),
  url: z.string().url('http transport requires a valid url'),
  headers: z.record(z.string()).optional(),
  apiKey: z.string().optional(),
});

export const SseTransportSchema = z.object({
  type: z.literal('sse'),
  url: z.string().url('sse transport requires a valid url'),
  headers: z.record(z.string()).optional(),
  reconnectIntervalMs: z.number().int().positive().optional(),
});

export const TransportSchema = z.discriminatedUnion('type', [
  StdioTransportSchema,
  HttpTransportSchema,
  SseTransportSchema,
]);

export const MCPDefinitionSchema = z.object({
  name: NameSchema,
  enabled: z.boolean().default(true),
  description: z.string().optional(),
  labels: z.record(z.string()).optional(),
  /** Rename a backend tool as exposed to the agent: { "read_file": "fs_read" }. */
  aliases: z.record(z.string()).optional(),
  transport: TransportSchema,
});

export const ToonOptionsSchema = z
  .object({
    autoConvert: z.boolean().default(true),
    delimiter: z.enum(DELIMITER_NAMES).default('comma'),
    indent: z.number().int().min(0).max(8).default(2),
    flattenDepth: z.number().int().min(0).default(4),
    threshold: z.number().int().min(0).default(100),
  })
  .default({});

export const WebUiSchema = z
  .object({
    enabled: z.boolean().default(true),
    host: z.string().default('0.0.0.0'),
    port: z.number().int().min(1).max(65535).default(3100),
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

export const MorphConfigSchema = z
  .object({
    $schema: z.string().optional(),
    morph: z
      .object({
        version: z.string().default('1.0'),
        logLevel: z.enum(LOG_LEVELS).default('info'),
        /** When true, last-registered tool wins on name conflicts (logged). */
        allowConflicts: z.boolean().default(false),
      })
      .default({}),
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
          path: ['mcpServers', i, 'name'],
        });
      }
      seen.add(server.name);
    }
  });

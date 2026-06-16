/**
 * SPEC: configuration TypeScript types, inferred from the zod schema.
 *
 * Per SDD, the zod schema in {@link ./schema.ts} is the executable contract;
 * these types are the compile-time view of the same contract.
 */
import type { z } from "zod";
import type {
  HealthSchema,
  HttpTransportSchema,
  MCPDefinitionSchema,
  MorphConfigSchema,
  SseTransportSchema,
  StdioTransportSchema,
  ToonOptionsSchema,
  TransportSchema,
  WebUiSchema,
} from "./schema.js";

export type MorphConfig = z.infer<typeof MorphConfigSchema>;
export type MCPDefinition = z.infer<typeof MCPDefinitionSchema>;
export type Transport = z.infer<typeof TransportSchema>;
export type StdioTransport = z.infer<typeof StdioTransportSchema>;
export type HttpTransport = z.infer<typeof HttpTransportSchema>;
export type SseTransport = z.infer<typeof SseTransportSchema>;
export type ToonOptions = z.infer<typeof ToonOptionsSchema>;
export type WebUiConfig = z.infer<typeof WebUiSchema>;
export type HealthConfig = z.infer<typeof HealthSchema>;

export type TransportType = Transport["type"];
export type LogLevel = MorphConfig["morph"]["logLevel"];

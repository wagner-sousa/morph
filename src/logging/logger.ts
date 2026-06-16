/**
 * IMPL: Pino structured logger factory.
 *
 * IMPORTANT: when MORPH speaks MCP to an agent over stdio, stdout is reserved
 * for the protocol. The logger therefore writes to stderr (fd 2).
 */
import pino, { type Logger } from "pino";
import type { LogLevel } from "../config/types.js";

export type { Logger };

export function createLogger(
  level: LogLevel = "info",
  pretty = process.stdout.isTTY,
): Logger {
  const options: pino.LoggerOptions = { level };
  if (pretty) {
    const transport = pino.transport({
      target: "pino-pretty",
      options: {
        destination: 2,
        colorize: true,
        translateTime: "SYS:HH:MM:ss",
      },
    }) as pino.DestinationStream;
    return pino(options, transport);
  }
  // Plain JSON to stderr so stdout stays clean for the MCP stdio transport.
  return pino(options, pino.destination(2));
}

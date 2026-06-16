/**
 * IMPL: Pino structured logger factory.
 *
 * IMPORTANT: when MORPH speaks MCP to an agent over stdio, stdout is reserved
 * for the protocol. The logger therefore writes to stderr (fd 2).
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import pino, { type Logger } from 'pino';
import type { LogLevel } from '../config/types.js';

export type { Logger };

export interface FileLogOptions {
  /** Absolute path to the JSON log file (e.g. ${dataDir}/logs/morph.log). */
  path: string;
}

/**
 * Build a Pino logger. Output always goes to stderr (fd 2) so stdout stays
 * clean for the MCP stdio transport. When `file` is provided, logs are *also*
 * appended to that file as JSON via a multistream — never touching fd 1.
 */
export function createLogger(
  level: LogLevel = 'info',
  pretty = process.stdout.isTTY,
  file?: FileLogOptions,
): Logger {
  const options: pino.LoggerOptions = { level };

  if (file) {
    mkdirSync(dirname(file.path), { recursive: true });
    // Sync destinations: stderr stays clean for MCP stdio, and the file is
    // flushed deterministically (no async worker touching fd 1).
    const streams: pino.StreamEntry[] = [
      { level, stream: pino.destination({ dest: 2, sync: true }) },
      { level, stream: pino.destination({ dest: file.path, sync: true }) },
    ];
    return pino({ level }, pino.multistream(streams));
  }

  if (pretty) {
    return pino(
      options,
      pino.transport({
        target: 'pino-pretty',
        options: { destination: 2, colorize: true, translateTime: 'SYS:HH:MM:ss' },
      }),
    );
  }
  // Plain JSON to stderr so stdout stays clean for the MCP stdio transport.
  return pino(options, pino.destination(2));
}

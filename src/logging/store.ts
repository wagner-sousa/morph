/**
 * SPEC + IMPL: in-memory circular log store with live subscription.
 *
 * Holds the most recent N call/log entries for the Web UI. Durable history is
 * persisted separately by the SQLite store; this is the hot buffer that backs
 * `/api/logs` and the realtime log stream.
 */
import { EventEmitter } from 'node:events';

export type LogLevelName = 'debug' | 'info' | 'warn' | 'error';

export interface LogEntry {
  id: number;
  mcpName: string;
  toolName: string;
  level: LogLevelName;
  message: string;
  inputJson?: string;
  outputText?: string;
  rawOutput?: string;
  originalTokens?: number;
  toonTokens?: number;
  durationMs?: number;
  tokensSaved?: number;
  createdAt: string; // ISO 8601
}

export interface LogFilter {
  mcp?: string;
  level?: LogLevelName;
  since?: string; // ISO 8601
  limit?: number;
}

export class LogStore extends EventEmitter {
  private readonly buffer: LogEntry[] = [];
  private nextId = 1;

  constructor(private readonly capacity = 1000) {
    super();
    this.setMaxListeners(0);
  }

  append(entry: Omit<LogEntry, 'id' | 'createdAt'> & { createdAt?: string }): LogEntry {
    const full: LogEntry = {
      id: this.nextId++,
      createdAt: entry.createdAt ?? new Date().toISOString(),
      mcpName: entry.mcpName,
      toolName: entry.toolName,
      level: entry.level,
      message: entry.message,
      durationMs: entry.durationMs,
      tokensSaved: entry.tokensSaved,
    };
    this.buffer.push(full);
    if (this.buffer.length > this.capacity) this.buffer.shift();
    this.emit('log', full);
    return full;
  }

  query(filter: LogFilter = {}): LogEntry[] {
    let entries = this.buffer;
    if (filter.mcp) entries = entries.filter((e) => e.mcpName === filter.mcp);
    if (filter.level) entries = entries.filter((e) => e.level === filter.level);
    if (filter.since) {
      const since = Date.parse(filter.since);
      entries = entries.filter((e) => Date.parse(e.createdAt) >= since);
    }
    const limit = filter.limit ?? 200;
    return entries.slice(-limit).reverse();
  }

  onLog(handler: (entry: LogEntry) => void): () => void {
    this.on('log', handler);
    return () => this.off('log', handler);
  }
}

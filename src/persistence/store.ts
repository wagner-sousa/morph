/**
 * IMPL: SQLite-backed durable store for logs and call stats (better-sqlite3).
 *
 * Synchronous by nature; methods are exposed as async to keep a stable
 * contract and allow a future swap of backend.
 */
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';
import Database from 'better-sqlite3';
import type { LogEntry, LogFilter } from '../logging/store.js';

export interface PersistedStats {
  totalCalls: number;
  totalTokensSaved: number;
  totalDurationMs: number;
}

export class Store {
  private readonly db: Database.Database;

  constructor(filePath: string) {
    mkdirSync(dirname(filePath), { recursive: true });
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.migrate();
  }

  private migrate(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mcp_name TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        level TEXT NOT NULL DEFAULT 'info',
        message TEXT NOT NULL,
        input_json TEXT,
        output_text TEXT,
        duration_ms INTEGER,
        tokens_saved INTEGER,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_logs_created ON logs(created_at);
      CREATE INDEX IF NOT EXISTS idx_logs_mcp ON logs(mcp_name);

      CREATE TABLE IF NOT EXISTS calls (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        mcp_name TEXT NOT NULL,
        tool_name TEXT NOT NULL,
        duration_ms INTEGER NOT NULL DEFAULT 0,
        tokens_saved INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE INDEX IF NOT EXISTS idx_calls_created ON calls(created_at);
    `);
    // Migration: add columns to existing tables (ignore if already present).
    try { this.db.exec(`ALTER TABLE logs ADD COLUMN input_json TEXT`); } catch { /* column exists */ }
    try { this.db.exec(`ALTER TABLE logs ADD COLUMN output_text TEXT`); } catch { /* column exists */ }
    try { this.db.exec(`ALTER TABLE logs ADD COLUMN raw_output TEXT`); } catch { /* column exists */ }
    try { this.db.exec(`ALTER TABLE logs ADD COLUMN original_tokens INTEGER`); } catch { /* column exists */ }
    try { this.db.exec(`ALTER TABLE logs ADD COLUMN toon_tokens INTEGER`); } catch { /* column exists */ }
  }

  appendLog(entry: Pick<LogEntry, 'mcpName' | 'toolName' | 'level' | 'message'> & Partial<LogEntry>): void {
    this.db
      .prepare(
        `INSERT INTO logs (mcp_name, tool_name, level, message, input_json, output_text, raw_output, original_tokens, toon_tokens, duration_ms, tokens_saved, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, datetime('now')))`,
      )
      .run(
        entry.mcpName,
        entry.toolName,
        entry.level,
        entry.message,
        entry.inputJson ?? null,
        entry.outputText ?? null,
        entry.rawOutput ?? null,
        entry.originalTokens ?? null,
        entry.toonTokens ?? null,
        entry.durationMs ?? null,
        entry.tokensSaved ?? null,
        entry.createdAt ?? null,
      );
  }

  queryLogs(filter: LogFilter = {}): LogEntry[] {
    const clauses: string[] = [];
    const params: unknown[] = [];
    if (filter.mcp) {
      clauses.push('mcp_name = ?');
      params.push(filter.mcp);
    }
    if (filter.level) {
      clauses.push('level = ?');
      params.push(filter.level);
    }
    if (filter.since) {
      clauses.push('created_at >= ?');
      params.push(filter.since);
    }
    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
    const limit = filter.limit ?? 200;
    const rows = this.db
      .prepare(`SELECT * FROM logs ${where} ORDER BY id DESC LIMIT ?`)
      .all(...params, limit) as Array<Record<string, unknown>>;
    return rows.map((r) => ({
      id: r.id as number,
      mcpName: r.mcp_name as string,
      toolName: r.tool_name as string,
      level: r.level as LogEntry['level'],
      message: r.message as string,
      inputJson: (r.input_json as string) ?? undefined,
      outputText: (r.output_text as string) ?? undefined,
      rawOutput: (r.raw_output as string) ?? undefined,
      originalTokens: (r.original_tokens as number) ?? undefined,
      toonTokens: (r.toon_tokens as number) ?? undefined,
      durationMs: (r.duration_ms as number) ?? undefined,
      tokensSaved: (r.tokens_saved as number) ?? undefined,
      createdAt: r.created_at as string,
    }));
  }

  recordCall(mcpName: string, toolName: string, durationMs: number, tokensSaved: number): void {
    this.db
      .prepare(
        `INSERT INTO calls (mcp_name, tool_name, duration_ms, tokens_saved) VALUES (?, ?, ?, ?)`,
      )
      .run(mcpName, toolName, durationMs, tokensSaved);
  }

  getStats(since?: string): PersistedStats {
    const where = since ? 'WHERE created_at >= ?' : '';
    const params = since ? [since] : [];
    const row = this.db
      .prepare(
        `SELECT COUNT(*) AS totalCalls,
                COALESCE(SUM(tokens_saved), 0) AS totalTokensSaved,
                COALESCE(SUM(duration_ms), 0) AS totalDurationMs
         FROM calls ${where}`,
      )
      .get(...params) as PersistedStats;
    return row;
  }

  /** Time-series savings, bucketed per hour, for the stats charts. */
  getSavingsHistory(since: string): Array<{ bucket: string; tokensSaved: number; calls: number }> {
    return this.db
      .prepare(
        `SELECT strftime('%Y-%m-%dT%H:00:00Z', created_at) AS bucket,
                COALESCE(SUM(tokens_saved), 0) AS tokensSaved,
                COUNT(*) AS calls
         FROM calls WHERE created_at >= ?
         GROUP BY bucket ORDER BY bucket`,
      )
      .all(since) as Array<{ bucket: string; tokensSaved: number; calls: number }>;
  }

  getLog(id: number): LogEntry | undefined {
    const row = this.db.prepare(`SELECT * FROM logs WHERE id = ?`).get(id) as Record<string, unknown> | undefined;
    if (!row) return undefined;
    return {
      id: row.id as number,
      mcpName: row.mcp_name as string,
      toolName: row.tool_name as string,
      level: row.level as LogEntry['level'],
      message: row.message as string,
      inputJson: (row.input_json as string) ?? undefined,
      outputText: (row.output_text as string) ?? undefined,
      rawOutput: (row.raw_output as string) ?? undefined,
      originalTokens: (row.original_tokens as number) ?? undefined,
      toonTokens: (row.toon_tokens as number) ?? undefined,
      durationMs: (row.duration_ms as number) ?? undefined,
      tokensSaved: (row.tokens_saved as number) ?? undefined,
      createdAt: row.created_at as string,
    };
  }

  getCallTotals(since?: string): { calls: number; tokensSaved: number; durationMs: number } {
    const where = since ? 'WHERE created_at >= ?' : '';
    const params = since ? [since] : [];
    return this.db
      .prepare(
        `SELECT COUNT(*) AS calls, COALESCE(SUM(tokens_saved), 0) AS tokensSaved, COALESCE(SUM(duration_ms), 0) AS durationMs
         FROM calls ${where}`,
      )
      .get(...params) as { calls: number; tokensSaved: number; durationMs: number };
  }

  getTotalizers(): { jsonTokens: number; toonTokens: number; tokensSaved: number; avgPercent: number } {
    return this.db
      .prepare(`SELECT
        COALESCE(SUM(original_tokens), 0) AS jsonTokens,
        COALESCE(SUM(toon_tokens), 0) AS toonTokens,
        COALESCE(SUM(original_tokens - toon_tokens), 0) AS tokensSaved,
        CASE WHEN SUM(original_tokens) > 0
          THEN ROUND(((SUM(original_tokens) - SUM(toon_tokens)) * 100.0 / SUM(original_tokens)), 1)
          ELSE 0 END AS avgPercent
      FROM logs`)
      .get() as { jsonTokens: number; toonTokens: number; tokensSaved: number; avgPercent: number };
  }

  close(): void {
    this.db.close();
  }
}

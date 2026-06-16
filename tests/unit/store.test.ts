import { mkdtempSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { rmSync } from 'node:fs';
import { describe, expect, it, beforeEach, afterEach } from 'vitest';
import { Store } from '../../src/persistence/store.js';

let dbDir: string;
let store: Store;

beforeEach(() => {
  dbDir = mkdtempSync(join(tmpdir(), 'morph-store-test-'));
  store = new Store(join(dbDir, 'test.db'));
});

afterEach(() => {
  store.close();
  rmSync(dbDir, { recursive: true, force: true });
});

describe('Store', () => {
  it('appends and queries logs', () => {
    store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'ok' });
    store.appendLog({ mcpName: 'fs', toolName: 'write', level: 'error', message: 'fail' });
    const all = store.queryLogs();
    expect(all).toHaveLength(2);
    expect(all[0].level).toBe('error');
  });

  it('filters logs by mcp name', () => {
    store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'ok' });
    store.appendLog({ mcpName: 'clickup', toolName: 'list', level: 'info', message: 'done' });
    const filtered = store.queryLogs({ mcp: 'fs' });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].mcpName).toBe('fs');
  });

  it('filters logs by level', () => {
    store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'ok' });
    store.appendLog({ mcpName: 'fs', toolName: 'write', level: 'error', message: 'fail' });
    const errors = store.queryLogs({ level: 'error' });
    expect(errors).toHaveLength(1);
  });

  it('records and retrieves call stats', () => {
    store.recordCall('fs', 'read', 100, 50);
    store.recordCall('fs', 'write', 200, 30);
    const stats = store.getStats();
    expect(stats.totalCalls).toBe(2);
    expect(stats.totalTokensSaved).toBe(80);
    expect(stats.totalDurationMs).toBe(300);
  });

  it('records call and returns savings history', () => {
    store.recordCall('fs', 'read', 100, 50);
    const history = store.getSavingsHistory(new Date(0).toISOString());
    expect(history.length).toBeGreaterThanOrEqual(1);
    expect(history[0].tokensSaved).toBe(50);
    expect(history[0].calls).toBe(1);
  });

  it('limits log results', () => {
    for (let i = 0; i < 10; i++) {
      store.appendLog({ mcpName: 'fs', toolName: 't', level: 'info', message: `m${i}` });
    }
    const limited = store.queryLogs({ limit: 3 });
    expect(limited).toHaveLength(3);
  });

  it('stores and retrieves input_json / output_text', () => {
    store.appendLog({
      mcpName: 'fs',
      toolName: 'read',
      level: 'info',
      message: 'ok',
      inputJson: JSON.stringify({ path: '/tmp' }),
      outputText: JSON.stringify({ content: 'done' }),
    });
    const logs = store.queryLogs();
    expect(logs[0].inputJson).toBe(JSON.stringify({ path: '/tmp' }));
    expect(logs[0].outputText).toBe(JSON.stringify({ content: 'done' }));
  });

  it('getLog returns a single log entry by id', () => {
    store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'entry' });
    const id = store.queryLogs()[0].id;
    const entry = store.getLog(id);
    expect(entry).toBeDefined();
    expect(entry!.message).toBe('entry');
  });

  it('getLog returns undefined for non-existent id', () => {
    const entry = store.getLog(99999);
    expect(entry).toBeUndefined();
  });

  it('getCallTotals returns aggregate stats', () => {
    store.recordCall('fs', 'read', 100, 50);
    store.recordCall('fs', 'write', 200, 30);
    const totals = store.getCallTotals();
    expect(totals.calls).toBe(2);
    expect(totals.tokensSaved).toBe(80);
    expect(totals.durationMs).toBe(300);
  });

  it('getCallTotals respects since filter', () => {
    store.recordCall('fs', 'read', 100, 50);
    const totals = store.getCallTotals(new Date(Date.now() + 86_400_000).toISOString()); // future
    expect(totals.calls).toBe(0);
    expect(totals.tokensSaved).toBe(0);
  });

  it('stores and retrieves raw_output, original_tokens, toon_tokens via appendLog', () => {
    store.appendLog({
      mcpName: 'fs',
      toolName: 'read',
      level: 'info',
      message: 'ok',
      rawOutput: '{"result":"data"}',
      originalTokens: 10,
      toonTokens: 3,
    });
    const logs = store.queryLogs();
    expect(logs[0].rawOutput).toBe('{"result":"data"}');
    expect(logs[0].originalTokens).toBe(10);
    expect(logs[0].toonTokens).toBe(3);
  });

  it('getLog returns new fields (rawOutput, originalTokens, toonTokens)', () => {
    store.appendLog({
      mcpName: 'fs',
      toolName: 'read',
      level: 'info',
      message: 'entry',
      rawOutput: '{"x":1}',
      originalTokens: 5,
      toonTokens: 2,
    });
    const log = store.getLog(store.queryLogs()[0].id);
    expect(log?.rawOutput).toBe('{"x":1}');
    expect(log?.originalTokens).toBe(5);
    expect(log?.toonTokens).toBe(2);
  });

  it('new fields are undefined when not provided', () => {
    store.appendLog({ mcpName: 'fs', toolName: 't', level: 'info', message: 'no extras' });
    const log = store.queryLogs()[0];
    expect(log.rawOutput).toBeUndefined();
    expect(log.originalTokens).toBeUndefined();
    expect(log.toonTokens).toBeUndefined();
  });

  it('getTotalizers returns zeros for empty store', () => {
    const t = store.getTotalizers();
    expect(t.jsonTokens).toBe(0);
    expect(t.toonTokens).toBe(0);
    expect(t.tokensSaved).toBe(0);
    expect(t.avgPercent).toBe(0);
  });

  it('getTotalizers returns aggregated values across logs', () => {
    store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'ok', originalTokens: 100, toonTokens: 30 });
    store.appendLog({ mcpName: 'fs', toolName: 'write', level: 'info', message: 'ok', originalTokens: 200, toonTokens: 50 });
    const t = store.getTotalizers();
    expect(t.jsonTokens).toBe(300);
    expect(t.toonTokens).toBe(80);
    expect(t.tokensSaved).toBe(220);
    expect(t.avgPercent).toBeGreaterThan(70);
    expect(t.avgPercent).toBeLessThan(75);
  });

  it('appendLog returns the auto-generated SQLite row id', () => {
    const id1 = store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'first' });
    const id2 = store.appendLog({ mcpName: 'fs', toolName: 'write', level: 'info', message: 'second' });
    expect(typeof id1).toBe('number');
    expect(id2).toBe(id1 + 1);
    // The log stored via getLog should match the returned id
    const log1 = store.getLog(id1);
    expect(log1).toBeDefined();
    expect(log1!.message).toBe('first');
    const log2 = store.getLog(id2);
    expect(log2).toBeDefined();
    expect(log2!.message).toBe('second');
  });

  it('getLog with wrong id returns undefined (cross-store ID mismatch regression)', () => {
    // Simulate scenario: LogStore has id=X but SQLite has different row for that id
    const id = store.appendLog({ mcpName: 'fs', toolName: 'read', level: 'info', message: 'correct' });
    const log = store.getLog(id);
    expect(log).toBeDefined();
    expect(log!.message).toBe('correct');
    // Wrong id should not match
    const wrong = store.getLog(id + 999);
    expect(wrong).toBeUndefined();
  });
});

import { describe, expect, it } from "vitest";
import { LogStore } from "../../src/logging/store.js";

describe("LogStore", () => {
  it("auto-assigns sequential IDs when no id is provided", () => {
    const store = new LogStore();
    const e1 = store.append({
      mcpName: "fs",
      toolName: "read",
      level: "info",
      message: "a",
    });
    const e2 = store.append({
      mcpName: "fs",
      toolName: "write",
      level: "info",
      message: "b",
    });
    expect(e1.id).toBe(1);
    expect(e2.id).toBe(2);
  });

  it("accepts a custom id via the id field", () => {
    const store = new LogStore();
    const entry = store.append({
      id: 42,
      mcpName: "fs",
      toolName: "read",
      level: "info",
      message: "custom",
    });
    expect(entry.id).toBe(42);
  });

  it("uses the provided id and does not increment nextId for it", () => {
    const store = new LogStore();
    store.append({
      id: 100,
      mcpName: "fs",
      toolName: "read",
      level: "info",
      message: "custom",
    });
    // Next auto-assigned id should still start from 1
    const e2 = store.append({
      mcpName: "fs",
      toolName: "write",
      level: "info",
      message: "after custom",
    });
    expect(e2.id).toBe(1);
  });

  it("query returns the entry with the correct id", () => {
    const store = new LogStore();
    store.append({
      id: 99,
      mcpName: "fs",
      toolName: "read",
      level: "info",
      message: "data",
    });
    const logs = store.query();
    expect(logs[0].id).toBe(99);
    expect(logs[0].message).toBe("data");
  });

  it("preserves all optional fields when provided", () => {
    const store = new LogStore();
    const entry = store.append({
      id: 1,
      mcpName: "fs",
      toolName: "read",
      level: "info",
      message: "ok",
      inputJson: '{"path":"/tmp"}',
      outputText: '{"result":"done"}',
      rawOutput: '{"result":"raw"}',
      originalTokens: 100,
      toonTokens: 30,
      durationMs: 50,
      tokensSaved: 70,
    });
    expect(entry.inputJson).toBe('{"path":"/tmp"}');
    expect(entry.outputText).toBe('{"result":"done"}');
    expect(entry.rawOutput).toBe('{"result":"raw"}');
    expect(entry.originalTokens).toBe(100);
    expect(entry.toonTokens).toBe(30);
    expect(entry.durationMs).toBe(50);
    expect(entry.tokensSaved).toBe(70);
  });
});

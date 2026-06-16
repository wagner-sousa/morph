import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { Metrics } from "../../src/metrics.js";

describe("Metrics", () => {
  let metrics: Metrics;

  beforeEach(() => {
    metrics = new Metrics();
  });
  afterEach(() => {
    metrics.removeAllListeners();
  });

  it("starts with zero calls", () => {
    const snap = metrics.snapshot();
    expect(snap.totalCalls).toBe(0);
    expect(snap.totalTokensSaved).toBe(0);
    expect(snap.failedCalls).toBe(0);
  });

  it("records a successful call", () => {
    metrics.record(
      {
        mcpName: "fs",
        toolName: "read",
        durationMs: 100,
        tokensSaved: 50,
        success: true,
      },
      25,
    );
    const snap = metrics.snapshot();
    expect(snap.totalCalls).toBe(1);
    expect(snap.totalTokensSaved).toBe(50);
    expect(snap.failedCalls).toBe(0);
  });

  it("records multiple calls and aggregates", () => {
    metrics.record(
      {
        mcpName: "fs",
        toolName: "read",
        durationMs: 100,
        tokensSaved: 50,
        success: true,
      },
      25,
    );
    metrics.record(
      {
        mcpName: "fs",
        toolName: "write",
        durationMs: 200,
        tokensSaved: 30,
        success: true,
      },
      15,
    );
    metrics.record(
      {
        mcpName: "db",
        toolName: "query",
        durationMs: 50,
        tokensSaved: 0,
        success: false,
      },
      0,
    );
    const snap = metrics.snapshot();
    expect(snap.totalCalls).toBe(3);
    expect(snap.failedCalls).toBe(1);
    expect(snap.totalTokensSaved).toBe(80);
  });

  it("groups by MCP in snapshot", () => {
    metrics.record(
      {
        mcpName: "fs",
        toolName: "read",
        durationMs: 100,
        tokensSaved: 50,
        success: true,
      },
      25,
    );
    metrics.record(
      {
        mcpName: "db",
        toolName: "write",
        durationMs: 50,
        tokensSaved: 10,
        success: true,
      },
      10,
    );
    const snap = metrics.snapshot();
    expect(Object.keys(snap.byMcp)).toEqual(["fs", "db"]);
    expect(snap.byMcp.fs.calls).toBe(1);
    expect(snap.byMcp.fs.tokensSaved).toBe(50);
  });

  it("calculates avgSavingsPercent", () => {
    metrics.record(
      {
        mcpName: "fs",
        toolName: "read",
        durationMs: 100,
        tokensSaved: 50,
        success: true,
      },
      25,
    );
    metrics.record(
      {
        mcpName: "fs",
        toolName: "write",
        durationMs: 200,
        tokensSaved: 30,
        success: true,
      },
      15,
    );
    const snap = metrics.snapshot();
    expect(snap.avgSavingsPercent).toBe(20);
  });

  it("emits update event on record", () => {
    const handler = vi.fn();
    metrics.on("update", handler);
    metrics.record(
      {
        mcpName: "fs",
        toolName: "read",
        durationMs: 10,
        tokensSaved: 5,
        success: true,
      },
      10,
    );
    expect(handler).toHaveBeenCalledTimes(1);
  });
});

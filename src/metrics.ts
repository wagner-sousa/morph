/**
 * IMPL: live, in-memory aggregate metrics for the dashboard.
 *
 * Durable, queryable history lives in the SQLite store; this is the cheap
 * running tally that powers `/api/stats` and the realtime `stats` channel.
 */
import { EventEmitter } from "node:events";

export interface CallRecord {
  mcpName: string;
  toolName: string;
  durationMs: number;
  tokensSaved: number;
  success: boolean;
  /** Format actually emitted for this call: "json" | "toon". */
  outputFormat?: "json" | "toon";
}

export interface AggregatedStats {
  totalCalls: number;
  failedCalls: number;
  totalTokensSaved: number;
  avgSavingsPercent: number;
  byMcp: Record<string, { calls: number; tokensSaved: number }>;
}

export class Metrics extends EventEmitter {
  private totalCalls = 0;
  private failedCalls = 0;
  private totalTokensSaved = 0;
  private savingsPercentSum = 0;
  private convertedCalls = 0;
  private readonly byOutputFormat = { json: 0, toon: 0 };
  private readonly byMcp = new Map<
    string,
    { calls: number; tokensSaved: number }
  >();

  record(rec: CallRecord, savingsPercent = 0): void {
    this.totalCalls++;
    if (!rec.success) this.failedCalls++;
    this.totalTokensSaved += rec.tokensSaved;
    if (rec.tokensSaved > 0) {
      this.savingsPercentSum += savingsPercent;
      this.convertedCalls++;
    }
    if (rec.outputFormat === "toon") this.byOutputFormat.toon++;
    else if (rec.outputFormat === "json") this.byOutputFormat.json++;
    const entry = this.byMcp.get(rec.mcpName) ?? { calls: 0, tokensSaved: 0 };
    entry.calls++;
    entry.tokensSaved += rec.tokensSaved;
    this.byMcp.set(rec.mcpName, entry);
    this.emit("update", this.snapshot());
  }

  snapshot(): AggregatedStats {
    return {
      totalCalls: this.totalCalls,
      failedCalls: this.failedCalls,
      totalTokensSaved: this.totalTokensSaved,
      avgSavingsPercent:
        this.convertedCalls === 0
          ? 0
          : Math.round((this.savingsPercentSum / this.convertedCalls) * 10) /
            10,
      byMcp: Object.fromEntries(this.byMcp),
    };
  }
}

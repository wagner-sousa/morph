import { describe, expect, it } from "vitest";
import {
  MCPDefinitionSchema,
  fromMcpDefinitions,
  toMcpDefinitions,
} from "../../src/config/schema.js";

describe("fieldSelection — schema + round-trip", () => {
  it("accepts a definition with per-tool fieldSelection", () => {
    const parsed = MCPDefinitionSchema.parse({
      name: "clickup",
      transport: { type: "http", url: "https://mcp.clickup.com/mcp" },
      fieldSelection: {
        list_tasks: { mode: "include", fields: ["tasks.id", "tasks.name"] },
        get_task: { mode: "exclude", fields: ["raw_payload"] },
      },
    });
    expect(parsed.fieldSelection?.list_tasks.mode).toBe("include");
    expect(parsed.fieldSelection?.get_task.fields).toEqual(["raw_payload"]);
  });

  it("rejects an invalid mode", () => {
    const fn = () =>
      MCPDefinitionSchema.parse({
        name: "x",
        transport: { type: "http", url: "https://e.com/mcp" },
        fieldSelection: { t: { mode: "drop", fields: ["a"] } },
      });
    expect(fn).toThrow();
  });

  it("rejects empty fields array", () => {
    const fn = () =>
      MCPDefinitionSchema.parse({
        name: "x",
        transport: { type: "http", url: "https://e.com/mcp" },
        fieldSelection: { t: { mode: "include", fields: [] } },
      });
    expect(fn).toThrow();
  });

  it("survives a to/from .mcp.json round-trip", () => {
    const def = MCPDefinitionSchema.parse({
      name: "clickup",
      transport: { type: "http", url: "https://mcp.clickup.com/mcp" },
      fieldSelection: {
        list_tasks: { mode: "include", fields: ["tasks.id"] },
      },
    });
    const entries = fromMcpDefinitions([def]);
    expect(entries.clickup.fieldSelection).toEqual(def.fieldSelection);
    const back = toMcpDefinitions(entries);
    expect(back[0].fieldSelection).toEqual(def.fieldSelection);
  });
});

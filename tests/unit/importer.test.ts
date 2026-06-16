import { describe, expect, it } from "vitest";
import { detectFormat, importConfig } from "../../src/import/importer.js";

describe("detectFormat", () => {
  it("detects Claude Desktop format", () => {
    expect(detectFormat({ mcpServers: { fs: { command: "npx" } } })).toBe(
      "claude",
    );
  });

  it("detects VS Code format", () => {
    expect(
      detectFormat({ servers: { gh: { type: "stdio", command: "npx" } } }),
    ).toBe("vscode");
  });

  it("throws for unrecognized format", () => {
    expect(() => detectFormat({})).toThrow("unrecognised");
  });
});

describe("importConfig", () => {
  it("imports Claude Desktop format as a keyed object", () => {
    const res = importConfig({
      mcpServers: { fs: { command: "npx", args: ["-y", "srv"] } },
    });
    expect(res.detectedFormat).toBe("claude");
    expect(Object.keys(res.servers)).toEqual(["fs"]);
    expect(res.servers.fs.command).toBe("npx");
    expect(res.stats.imported).toBe(1);
  });

  it("imports VS Code with input secret warnings", () => {
    const res = importConfig({
      servers: {
        gh: {
          type: "stdio",
          command: "npx",
          env: { TOKEN: "${input:gh-token}" },
        },
      },
    });
    expect(res.detectedFormat).toBe("vscode");
    expect(res.unresolvedSecrets).toContain("${input:gh-token}");
    expect(res.warnings.some((w) => w.type === "input_secret")).toBe(true);
  });

  it("skips entries without command", () => {
    const res = importConfig({ mcpServers: { broken: {} } });
    expect(res.stats.skipped).toBe(1);
    expect(Object.keys(res.servers)).toHaveLength(0);
  });

  it("imports HTTP server from Claude config", () => {
    const res = importConfig({
      mcpServers: { api: { type: "http", url: "http://localhost/mcp" } },
    });
    expect(res.servers.api.type).toBe("http");
  });

  it("imports SSE server from Claude config", () => {
    const res = importConfig({
      mcpServers: { stream: { type: "sse", url: "http://localhost/sse" } },
    });
    expect(res.servers.stream.type).toBe("sse");
  });

  it("accepts explicit format (no auto-detect)", () => {
    const res = importConfig({ servers: {} }, "vscode");
    expect(res.detectedFormat).toBe("vscode");
    expect(Object.keys(res.servers)).toHaveLength(0);
  });

  it("returns correct stats for mixed results", () => {
    const res = importConfig({
      mcpServers: { good: { command: "npx" }, bad: {} },
    });
    expect(res.stats.total).toBe(2);
    expect(res.stats.imported).toBe(1);
    expect(res.stats.skipped).toBe(1);
  });

  it("handles env vars without secrets", () => {
    const res = importConfig({
      mcpServers: { api: { command: "npx", env: { KEY: "plain-value" } } },
    });
    expect(Object.keys(res.servers)).toHaveLength(1);
    expect(res.unresolvedSecrets).toHaveLength(0);
  });
});

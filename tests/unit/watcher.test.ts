import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { ConfigWatcher } from "../../src/config/watcher.js";

vi.mock("chokidar", () => ({
  default: { watch: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })) },
  watch: vi.fn(() => ({ on: vi.fn(), close: vi.fn() })),
}));

describe("ConfigWatcher", () => {
  let watcher: ConfigWatcher;
  let changeHandler: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    watcher = new ConfigWatcher();
    changeHandler = vi.fn();
    watcher.on("change", changeHandler);
  });

  afterEach(() => {
    watcher.stop();
  });

  it("watch sets up the file watcher", () => {
    expect(() => {
      watcher.watch("/tmp/morph.json", "/tmp/.mcp.json");
    }).not.toThrow();
  });

  it("stop does not throw when not watching", () => {
    expect(() => watcher.stop()).not.toThrow();
  });

  it("stop after watch does not throw", () => {
    watcher.watch("/tmp/morph.json", "/tmp/.mcp.json");
    expect(() => watcher.stop()).not.toThrow();
  });

  it("can be stopped multiple times", () => {
    watcher.watch("/tmp/morph.json", "/tmp/.mcp.json");
    watcher.stop();
    expect(() => watcher.stop()).not.toThrow();
  });
});

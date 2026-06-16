import { describe, expect, it, beforeAll, afterAll } from "vitest";
import { spawn, type ChildProcess } from "node:child_process";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, "../../src/examples");
const tsxBin = join(__dirname, "../../node_modules/.bin/tsx");

function jsonRpcRequest(method: string, params?: unknown, id = 1) {
  return JSON.stringify({ jsonrpc: "2.0", id, method, params });
}

function fetchPost(
  url: string,
  body: string,
  headers?: Record<string, string>,
): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const opts: http.RequestOptions = {
      hostname: u.hostname,
      port: Number(u.port),
      path: u.pathname + (u.search || ""),
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/event-stream",
        "Content-Length": Buffer.byteLength(body),
        ...headers,
      },
    };
    const req = http.request(opts, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => {
        resolve({
          status: res.statusCode ?? 500,
          body: Buffer.concat(chunks).toString(),
        });
      });
    });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

function fetchGet(url: string): Promise<{ status: number; body: string }> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    http
      .get(u.href, (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (c: Buffer) => chunks.push(c));
        res.on("end", () => {
          resolve({
            status: res.statusCode ?? 500,
            body: Buffer.concat(chunks).toString(),
          });
        });
      })
      .on("error", reject);
  });
}

async function sseSession(
  url: string,
): Promise<{ sessionId: string; close: () => void }> {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      let data = "";
      res.on("data", (chunk: Buffer) => {
        data += chunk.toString();
        const match = data.match(/sessionId=([a-zA-Z0-9-]+)/);
        if (match) {
          res.pause();
          resolve({
            sessionId: match[1],
            close: () => req.destroy(),
          });
        }
      });
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error("SSE session timeout"));
    });
  });
}

function spawnStdio(
  script: string,
  args: string[] = [],
  env?: Record<string, string>,
): ChildProcess {
  const proc = spawn(tsxBin, [join(srcDir, script), ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, ...env },
  });
  return proc;
}

async function stdioRequest(proc: ChildProcess, req: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const onData = (data: Buffer) => {
      const text = data.toString();
      proc.stdout?.removeListener("data", onData);
      resolve(text);
    };
    proc.stdout?.on("data", onData);
    proc.stdin?.write(req + "\n");
    const timeout = setTimeout(() => {
      proc.stdout?.removeListener("data", onData);
      reject(new Error("timeout"));
    }, 5000);
    proc.stdout?.on("data", () => {
      clearTimeout(timeout);
    });
  });
}

async function waitForPort(port: number, timeoutMs = 5000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      await fetchPost(
        `http://localhost:${port}/mcp`,
        jsonRpcRequest("initialize", { protocolVersion: "2024-11-05" }),
      );
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 200));
    }
  }
  throw new Error(`Port ${port} did not become available`);
}

describe("demo-mcp-server (STDIO)", () => {
  let proc: ChildProcess | undefined;

  afterAll(() => {
    proc?.kill();
  });

  it("responds to tools/list and tools/call", async () => {
    proc = spawnStdio("demo-mcp-server.js");
    const initRes = await stdioRequest(
      proc,
      jsonRpcRequest("initialize", { protocolVersion: "2024-11-05" }),
    );
    expect(initRes).toContain('"jsonrpc":"2.0"');
    expect(initRes).toContain('"id":1');

    const listRes = await stdioRequest(proc, jsonRpcRequest("tools/list"));
    expect(listRes).toContain('"name":"ping"');
    expect(listRes).toContain('"name":"users"');
    expect(listRes).toContain('"name":"echo"');

    const callRes = await stdioRequest(
      proc,
      jsonRpcRequest("tools/call", { name: "ping" }),
    );
    expect(callRes).toContain("pong");
  });
});

describe("http-mcp-server", () => {
  let proc: ChildProcess | undefined;

  beforeAll(async () => {
    proc = spawnStdio("http-mcp-server.js", [], { HTTP_MCP_PORT: "3200" });
    await waitForPort(3200);
  });

  afterAll(() => {
    proc?.kill();
  });

  it("responds to tools/call(ping) with pong", async () => {
    const res = await fetchPost(
      "http://localhost:3200/mcp",
      jsonRpcRequest("tools/call", { name: "ping" }),
    );
    const body = JSON.parse(res.body);
    expect(body.result?.content?.[0]?.text).toBe("pong");
  });
});

describe("sse-mcp-server", () => {
  let proc: ChildProcess | undefined;
  let sessionClose: (() => void) | null = null;

  beforeAll(async () => {
    proc = spawnStdio("sse-mcp-server.js", [], { SSE_MCP_PORT: "3201" });
    await waitForPort(3201);
  });

  afterAll(() => {
    sessionClose?.();
    proc?.kill();
  });

  it("starts and accepts SSE connections", async () => {
    const session = await sseSession("http://localhost:3201/sse");
    sessionClose = session.close;
    expect(session.sessionId).toBeTruthy();
    // Verify the POST endpoint accepts requests with the session
    const ack = await fetchPost(
      `http://localhost:3201/mcp?sessionId=${session.sessionId}`,
      jsonRpcRequest("notifications/initialized"),
    );
    expect([200, 202]).toContain(ack.status);
  });
});

describe("oauth-mcp-server", () => {
  let proc: ChildProcess | undefined;

  beforeAll(async () => {
    proc = spawnStdio("oauth-mcp-server.js", [], { OAUTH_MCP_PORT: "3202" });
    await waitForPort(3202);
  });

  afterAll(() => {
    proc?.kill();
  });

  it("rejects requests without token with 401", async () => {
    const res = await fetchPost(
      "http://localhost:3202/mcp",
      jsonRpcRequest("tools/call", { name: "ping" }),
    );
    expect(res.status).toBe(401);
    const body = JSON.parse(res.body);
    expect(body.error).toBe("unauthorized");
  });

  it("accepts requests with Bearer demo-token", async () => {
    const res = await fetchPost(
      "http://localhost:3202/mcp",
      jsonRpcRequest("tools/call", { name: "ping" }),
      { Authorization: "Bearer demo-token" },
    );
    expect(res.status).toBe(200);
    const body = JSON.parse(res.body);
    expect(body.result?.content?.[0]?.text).toBe("pong");
  });

  it("exposes OAuth metadata at /.well-known/oauth-authorization-server", async () => {
    const res = await fetchGet(
      "http://localhost:3202/.well-known/oauth-authorization-server",
    );
    expect(res.status).toBe(200);
    const meta = JSON.parse(res.body);
    expect(meta.issuer).toContain("localhost:3202");
    expect(meta.authorization_endpoint).toContain("/authorize");
    expect(meta.token_endpoint).toContain("/token");
  });
});

describe("param-mcp-server", () => {
  let proc: ChildProcess | undefined;

  afterAll(() => {
    proc?.kill();
  });

  it("lists tools with inputSchema parameters", async () => {
    proc = spawnStdio(
      "param-mcp-server.js",
      ["--base-path", "/tmp/demo-test"],
      { DEMO_MODE: "true" },
    );
    await stdioRequest(
      proc,
      jsonRpcRequest("initialize", { protocolVersion: "2024-11-05" }),
    );
    const listRes = await stdioRequest(proc, jsonRpcRequest("tools/list"));
    expect(listRes).toContain('"name":"read"');
    expect(listRes).toContain('"name":"write"');
    expect(listRes).toContain('"name":"list"');
    expect(listRes).toContain('"name":"stats"');
    expect(listRes).toContain('"required":["path"]');
  });

  it("prepends [DEMO] prefix when DEMO_MODE=true", async () => {
    proc = spawnStdio(
      "param-mcp-server.js",
      ["--base-path", "/tmp/demo-test"],
      { DEMO_MODE: "true" },
    );
    await stdioRequest(
      proc,
      jsonRpcRequest("initialize", { protocolVersion: "2024-11-05" }),
    );
    // write a test file
    await stdioRequest(
      proc,
      jsonRpcRequest("tools/call", {
        name: "write",
        arguments: { path: "hello.txt", content: "world" },
      }),
    );
    const readRes = await stdioRequest(
      proc,
      jsonRpcRequest("tools/call", {
        name: "read",
        arguments: { path: "hello.txt" },
      }),
    );
    expect(readRes).toContain("[DEMO]");
    expect(readRes).toContain("world");
  });
});

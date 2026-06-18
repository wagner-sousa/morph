/**
 * IMPL: the Web UI REST API + realtime WebSocket, served by Fastify.
 *
 * Mirrors the API reference in PLAN.md §11.3. Realtime updates are pushed over
 * `/ws` (channels: logs/health/stats/config); `/api/logs/stream` is an SSE
 * fallback. The built frontend (Morph Studio) is served from ./public.
 */
import { existsSync } from "node:fs";
import { resolve as resolvePath } from "node:path";
import { timingSafeEqual } from "node:crypto";
import Fastify, {
  type FastifyInstance,
  type FastifyReply,
  type FastifyRequest,
} from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import websocket from "@fastify/websocket";
import fastifyStatic from "@fastify/static";
import type { Logger } from "../logging/logger.js";
import { getVersionInfo } from "../utils/version.js";
import { MorphError } from "../utils/errors.js";
import { registerOAuthRoutes } from "./oauth-routes.js";
import { importConfig } from "../import/importer.js";
import type { Hub } from "../hub.js";
import type { MorphMCPServer } from "../mcp-server/server.js";

export interface WebServerOptions {
  hub: Hub;
  logger: Logger;
  mcpServer?: MorphMCPServer;
  publicDir?: string;
}

interface WsClient {
  send: (data: string) => void;
}

/** Minimal surface of the `ws` WebSocket we use (the `ws` package ships no types). */
interface WsSocket {
  send: (data: string) => void;
  on: (event: "message" | "close", listener: (data: Buffer) => void) => void;
}

export class WebServer {
  private readonly app: FastifyInstance;
  private readonly clients = new Set<WsClient>();

  constructor(private readonly options: WebServerOptions) {
    this.app = Fastify({ logger: false });
  }

  private auth = async (
    req: FastifyRequest,
    reply: FastifyReply,
  ): Promise<void> => {
    const user = process.env.MORPH_WEB_USERNAME;
    const pass = process.env.MORPH_WEB_PASSWORD;
    if (!user) return; // auth disabled
    const header = req.headers.authorization ?? "";
    const [scheme, encoded] = header.split(" ");
    if (scheme === "Basic" && encoded) {
      const [u, p] = Buffer.from(encoded, "base64").toString().split(":");
      if (safeEqual(u, user) && safeEqual(p, pass ?? "")) return;
    }
    reply
      .code(401)
      .header("WWW-Authenticate", "Basic")
      .send({ error: "Unauthorized", code: "UNAUTHORIZED" });
  };

  private async configure(): Promise<void> {
    const { logger } = this.options;
    const isProd = process.env.NODE_ENV === "production";

    await this.app.register(cors, {
      origin: isProd
        ? process.env.CORS_ORIGIN || false
        : ["http://localhost:5173", "http://127.0.0.1:5173"],
    });
    await this.app.register(multipart);
    await this.app.register(websocket);

    this.app.setErrorHandler((err: Error, _req, reply) => {
      if (err instanceof MorphError) {
        const status = STATUS_BY_CODE[err.code] ?? 500;
        reply
          .code(status)
          .send({ error: err.message, code: err.code, details: err.details });
        return;
      }
      logger.error({ err: err.message }, "web request failed");
      reply.code(500).send({ error: err.message, code: "INTERNAL_ERROR" });
    });

    this.app.addHook("preHandler", async (req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws"))
        await this.auth(req, reply);
    });

    this.registerRoutes();
    this.registerWebSocket();
    this.bridgeEvents();
    await this.registerStatic();
  }

  private registerRoutes(): void {
    const { hub } = this.options;
    const app = this.app;

    app.get("/api/version", () => getVersionInfo());
    app.get("/api/health", () => hub.registry.getStatusSummary());
    app.get("/api/mcps", () => hub.registry.getStatusSummary());

    app.get("/api/mcps/:name", (req) => {
      const { name } = req.params as { name: string };
      const summary = hub.registry
        .getStatusSummary()
        .find((m) => m.name === name);
      if (!summary)
        throw new MorphError("MCP_NOT_FOUND", `MCP "${name}" not found`);
      return { ...summary, tools: hub.registry.getTools(name) };
    });

    app.get("/api/mcps/:name/tools", (req) => {
      const { name } = req.params as { name: string };
      return hub.registry.getTools(name);
    });

    app.post("/api/mcps/:name/restart", async (req) => {
      const { name } = req.params as { name: string };
      await hub.registry.disconnect(name);
      await hub.registry.connect(name);
      return { ok: true };
    });

    registerOAuthRoutes(app, hub);

    app.get("/api/logs/:id", (req) => {
      const { id } = req.params as { id: string };
      const log = hub.store.getLog(Number(id));
      if (!log) throw new MorphError("NOT_FOUND", `Log ${id} not found`);
      return log;
    });

    app.get("/api/calls/totals", (req) => {
      const q = req.query as { since?: string };
      return hub.store.getCallTotals(q.since);
    });

    app.get("/api/calls/totalizers", () => hub.store.getTotalizers());

    app.get("/api/logs", (req) => {
      const q = req.query as Record<string, string | undefined>;
      return hub.logs.query({
        mcp: q.mcp,
        level: q.level as never,
        since: q.since,
        limit: q.limit ? Number(q.limit) : undefined,
        outputFormat: q.outputFormat as "json" | "toon" | undefined,
      });
    });

    app.get("/api/stats", () => hub.metrics.snapshot());
    app.get("/api/stats/toon", () => hub.metrics.snapshot());
    app.get("/api/stats/toon/history", (req) => {
      const q = req.query as { since?: string };
      const since =
        q.since ?? new Date(Date.now() - 24 * 3600_000).toISOString();
      return hub.store.getSavingsHistory(since);
    });

    app.get("/api/config", () => hub.getConfig());

    app.post("/api/mcp/:name", async (req, reply) => {
      const { name } = req.params as { name: string };
      const tools = hub.registry.getTools(name);
      if (tools.length === 0)
        throw new MorphError("MCP_NOT_FOUND", `MCP "${name}" not found`);
      if (!this.options.mcpServer)
        throw new MorphError("SERVER_ERROR", "MCP server not available");
      const handler = this.options.mcpServer.createPerMcpDirectHandler(name);
      const result = await handler(req.body);
      reply.code(result.status).send(result.body);
    });

    app.post("/api/config/import", async (req) => {
      const body = (await this.readImportBody(req)) as Record<string, unknown>;
      return importConfig(body);
    });

    app.post("/api/mcps", async (req, reply) => {
      const def = req.body as Record<string, unknown>;
      const { MCPDefinitionSchema } = await import("../config/schema.js");
      const parsed = MCPDefinitionSchema.parse(def);
      let cfg = hub.getConfig();
      if (cfg.mcpServers.some((s) => s.name === parsed.name)) {
        throw new MorphError(
          "ALREADY_EXISTS",
          `MCP "${parsed.name}" already exists`,
        );
      }
      cfg = { ...cfg, mcpServers: [...cfg.mcpServers, parsed] };
      await hub.applyConfig(cfg);
      await hub.saveConfig();
      reply.code(201);
      return { ok: true, name: parsed.name };
    });

    app.put("/api/mcps/:name", async (req) => {
      const { name } = req.params as { name: string };
      const def = req.body as Record<string, unknown>;
      const { MCPDefinitionSchema } = await import("../config/schema.js");
      const parsed = MCPDefinitionSchema.parse(def);
      if (parsed.name !== name) {
        throw new MorphError(
          "INVALID_INPUT",
          "name in body must match URL parameter",
        );
      }
      const cfg = hub.getConfig();
      const idx = cfg.mcpServers.findIndex((s) => s.name === name);
      if (idx === -1)
        throw new MorphError("MCP_NOT_FOUND", `MCP "${name}" not found`);
      const next = { ...cfg, mcpServers: cfg.mcpServers.with(idx, parsed) };
      await hub.applyConfig(next);
      await hub.saveConfig();
      return { ok: true, name };
    });

    app.delete("/api/mcps/:name", async (req, reply) => {
      const { name } = req.params as { name: string };
      const cfg = hub.getConfig();
      const idx = cfg.mcpServers.findIndex((s) => s.name === name);
      if (idx === -1)
        throw new MorphError("MCP_NOT_FOUND", `MCP "${name}" not found`);
      const next = { ...cfg, mcpServers: cfg.mcpServers.toSpliced(idx, 1) };
      await hub.applyConfig(next);
      await hub.saveConfig();
      reply.code(204);
    });

    app.put("/api/config", async (req) => {
      const { validateConfig } = await import("../config/loader.js");
      const validated = validateConfig(req.body);
      await hub.applyConfig(validated);
      await hub.saveConfig();
      return { ok: true };
    });

    app.post("/api/config/reload", async () => {
      await hub.reloadFromDisk();
      return { ok: true };
    });

    // SSE fallback for log streaming.
    app.get("/api/logs/stream", (req, reply) => {
      reply.raw.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      });
      const off = hub.logs.onLog((entry) =>
        reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`),
      );
      req.raw.on("close", off);
    });

    // MCP protocol over HTTP (direct JSON-RPC handler).
    const mcpServer = this.options.mcpServer;
    const mcpHandler = mcpServer?.createDirectHandler();
    if (mcpServer && mcpHandler) {
      app.post("/mcp", async (request, reply) => {
        const body = request.body;
        const { status, body: json } = await mcpHandler(body);
        return reply.status(status).type("application/json").send(json);
      });

      app.get("/mcp", (request, reply) => {
        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const keepAlive = setInterval(
          () => res.write(": keepalive\n\n"),
          15000,
        );
        request.raw.on("close", () => {
          clearInterval(keepAlive);
        });
      });

      // Per-MCP scoped endpoint: same protocol as /mcp but limited to a single
      // backend's tools. Additive — the aggregated /mcp above is unchanged.
      app.post("/mcp/:name", async (request, reply) => {
        const { name } = request.params as { name: string };
        if (hub.registry.getTools(name).length === 0)
          throw new MorphError("MCP_NOT_FOUND", `MCP "${name}" not found`);
        const handler = mcpServer.createPerMcpDirectHandler(name);
        const { status, body } = await handler(request.body);
        return reply.status(status).type("application/json").send(body);
      });

      app.get("/mcp/:name", (request, reply) => {
        const { name } = request.params as { name: string };
        if (hub.registry.getTools(name).length === 0)
          throw new MorphError("MCP_NOT_FOUND", `MCP "${name}" not found`);
        reply.hijack();
        const res = reply.raw;
        res.writeHead(200, {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          Connection: "keep-alive",
        });
        const keepAlive = setInterval(
          () => res.write(": keepalive\n\n"),
          15000,
        );
        request.raw.on("close", () => {
          clearInterval(keepAlive);
        });
      });
    }
  }

  private async readImportBody(req: FastifyRequest): Promise<unknown> {
    if (req.isMultipart()) {
      const file = await req.file();
      const buf = await file?.toBuffer();
      return JSON.parse(buf?.toString("utf8") ?? "{}");
    }
    return req.body;
  }

  private registerWebSocket(): void {
    this.app.get("/ws", { websocket: true }, (socket: WsSocket) => {
      const client: WsClient = {
        send: (d) => {
          socket.send(d);
        },
      };
      this.clients.add(client);
      socket.on("message", (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString()) as { channel?: unknown };
          if (msg.channel === "ping") {
            client.send(
              JSON.stringify({
                channel: "ping",
                event: "pong",
                data: {},
                timestamp: new Date().toISOString(),
              }),
            );
          }
        } catch {
          /* ignore malformed frames */
        }
      });
      socket.on("close", () => this.clients.delete(client));
    });
  }

  private broadcast(channel: string, event: string, data: unknown): void {
    const payload = JSON.stringify({
      channel,
      event,
      data,
      timestamp: new Date().toISOString(),
    });
    for (const client of this.clients) {
      try {
        client.send(payload);
      } catch {
        this.clients.delete(client);
      }
    }
  }

  private bridgeEvents(): void {
    const { hub } = this.options;
    hub.logs.onLog((entry) => {
      this.broadcast("logs", "tool_call", entry);
    });
    hub.metrics.on("update", (stats: unknown) => {
      this.broadcast("stats", "savings_update", stats);
    });
    hub.on("mcp:connected", (name: string) => {
      this.broadcast("health", "connected", { name });
    });
    hub.on("mcp:disconnected", (name: string) => {
      this.broadcast("health", "disconnected", { name });
    });
    hub.on("config:reloaded", () => {
      this.broadcast("config", "reloaded", hub.getConfig());
    });
  }

  private async registerStatic(): Promise<void> {
    const publicDir = resolvePath(this.options.publicDir ?? "./public");
    if (!existsSync(publicDir)) return;
    await this.app.register(fastifyStatic, { root: publicDir });
    // SPA fallback: serve index.html for unknown non-API routes.
    this.app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith("/api") || req.url.startsWith("/ws")) {
        reply.code(404).send({ error: "not found", code: "NOT_FOUND" });
        return;
      }
      reply.sendFile("index.html");
    });
  }

  async start(host: string, port: number): Promise<void> {
    await this.configure();
    await this.app.listen({ host, port });
    this.options.logger.info({ host, port }, "web UI listening");
  }

  async close(): Promise<void> {
    await this.app.close();
  }

  /** Test seam: configure all routes without binding a port. */
  async buildForTest(): Promise<FastifyInstance> {
    await this.configure();
    await this.app.ready();
    return this.app;
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  NOT_FOUND: 404,
  VALIDATION_ERROR: 422,
  INVALID_CONFIG: 422,
  MCP_NOT_FOUND: 404,
  TOOL_NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_EXISTS: 409,
  ADDED: 201,
  UNAUTHORIZED: 401,
  ENV_MISSING: 422,
};

function safeEqual(a: string | undefined, b: string): boolean {
  if (a === undefined) return false;
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

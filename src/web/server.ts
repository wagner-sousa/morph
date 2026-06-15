/**
 * IMPL: the Web UI REST API + realtime WebSocket, served by Fastify.
 *
 * Mirrors the API reference in PLAN.md §11.3. Realtime updates are pushed over
 * `/ws` (channels: logs/health/stats/config); `/api/logs/stream` is an SSE
 * fallback. The built frontend (Morph Studio) is served from ./public.
 */
import { existsSync } from 'node:fs';
import { resolve as resolvePath } from 'node:path';
import { timingSafeEqual } from 'node:crypto';
import Fastify, { type FastifyInstance, type FastifyReply, type FastifyRequest } from 'fastify';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import websocket from '@fastify/websocket';
import fastifyStatic from '@fastify/static';
import type { Logger } from '../logging/logger.js';
import { getVersionInfo } from '../utils/version.js';
import { MorphError } from '../utils/errors.js';
import { importConfig } from '../import/importer.js';
import type { Hub } from '../hub.js';

export interface WebServerOptions {
  hub: Hub;
  logger: Logger;
  publicDir?: string;
}

interface WsClient {
  send: (data: string) => void;
}

export class WebServer {
  private readonly app: FastifyInstance;
  private readonly clients = new Set<WsClient>();

  constructor(private readonly options: WebServerOptions) {
    this.app = Fastify({ logger: false });
  }

  private auth = async (req: FastifyRequest, reply: FastifyReply): Promise<void> => {
    const user = process.env.MORPH_WEB_USERNAME;
    const pass = process.env.MORPH_WEB_PASSWORD;
    if (!user) return; // auth disabled
    const header = req.headers.authorization ?? '';
    const [scheme, encoded] = header.split(' ');
    if (scheme === 'Basic' && encoded) {
      const [u, p] = Buffer.from(encoded, 'base64').toString().split(':');
      if (safeEqual(u, user) && safeEqual(p, pass ?? '')) return;
    }
    reply.code(401).header('WWW-Authenticate', 'Basic').send({ error: 'Unauthorized', code: 'UNAUTHORIZED' });
  };

  private async configure(): Promise<void> {
    const { logger } = this.options;
    const isProd = process.env.NODE_ENV === 'production';

    await this.app.register(cors, {
      origin: isProd
        ? process.env.CORS_ORIGIN || false
        : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    });
    await this.app.register(multipart);
    await this.app.register(websocket);

    this.app.setErrorHandler((err: Error, _req, reply) => {
      if (err instanceof MorphError) {
        const status = STATUS_BY_CODE[err.code] ?? 500;
        reply.code(status).send({ error: err.message, code: err.code, details: err.details });
        return;
      }
      logger.error({ err: err.message }, 'web request failed');
      reply.code(500).send({ error: err.message, code: 'INTERNAL_ERROR' });
    });

    this.app.addHook('preHandler', async (req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/ws')) await this.auth(req, reply);
    });

    this.registerRoutes();
    this.registerWebSocket();
    this.bridgeEvents();
    await this.registerStatic();
  }

  private registerRoutes(): void {
    const { hub } = this.options;
    const app = this.app;

    app.get('/api/version', async () => getVersionInfo());
    app.get('/api/health', async () => hub.registry.getStatusSummary());
    app.get('/api/mcps', async () => hub.registry.getStatusSummary());

    app.get('/api/mcps/:name', async (req) => {
      const { name } = req.params as { name: string };
      const summary = hub.registry.getStatusSummary().find((m) => m.name === name);
      if (!summary) throw new MorphError('MCP_NOT_FOUND', `MCP "${name}" not found`);
      return { ...summary, tools: hub.registry.getTools(name) };
    });

    app.get('/api/mcps/:name/tools', async (req) => {
      const { name } = req.params as { name: string };
      return hub.registry.getTools(name);
    });

    app.post('/api/mcps/:name/restart', async (req) => {
      const { name } = req.params as { name: string };
      await hub.registry.disconnect(name);
      await hub.registry.connect(name);
      return { ok: true };
    });

    app.get('/api/logs', async (req) => {
      const q = req.query as Record<string, string | undefined>;
      return hub.logs.query({
        mcp: q.mcp,
        level: q.level as never,
        since: q.since,
        limit: q.limit ? Number(q.limit) : undefined,
      });
    });

    app.get('/api/stats', async () => hub.metrics.snapshot());
    app.get('/api/stats/toon', async () => hub.metrics.snapshot());
    app.get('/api/stats/toon/history', async (req) => {
      const q = req.query as { since?: string };
      const since = q.since ?? new Date(Date.now() - 24 * 3600_000).toISOString();
      return hub.store.getSavingsHistory(since);
    });

    app.get('/api/config', async () => hub.getConfig());

    app.post('/api/config/import', async (req) => {
      const body = (await this.readImportBody(req)) as Record<string, unknown>;
      return importConfig(body);
    });

    app.post('/api/config/reload', async () => {
      await hub.reloadFromDisk();
      return { ok: true };
    });

    // SSE fallback for log streaming.
    app.get('/api/logs/stream', (req, reply) => {
      reply.raw.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      const off = hub.logs.onLog((entry) => reply.raw.write(`data: ${JSON.stringify(entry)}\n\n`));
      req.raw.on('close', off);
    });
  }

  private async readImportBody(req: FastifyRequest): Promise<unknown> {
    if (req.isMultipart()) {
      const file = await req.file();
      const buf = await file?.toBuffer();
      return JSON.parse(buf?.toString('utf8') ?? '{}');
    }
    return req.body;
  }

  private registerWebSocket(): void {
    this.app.get('/ws', { websocket: true }, (socket) => {
      const client: WsClient = { send: (d) => socket.send(d) };
      this.clients.add(client);
      socket.on('message', (raw: Buffer) => {
        try {
          const msg = JSON.parse(raw.toString());
          if (msg.channel === 'ping') {
            client.send(JSON.stringify({ channel: 'ping', event: 'pong', data: {}, timestamp: new Date().toISOString() }));
          }
        } catch {
          /* ignore malformed frames */
        }
      });
      socket.on('close', () => this.clients.delete(client));
    });
  }

  private broadcast(channel: string, event: string, data: unknown): void {
    const payload = JSON.stringify({ channel, event, data, timestamp: new Date().toISOString() });
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
    hub.logs.onLog((entry) => this.broadcast('logs', 'tool_call', entry));
    hub.metrics.on('update', (stats) => this.broadcast('stats', 'savings_update', stats));
    hub.on('mcp:connected', (name) => this.broadcast('health', 'connected', { name }));
    hub.on('mcp:disconnected', (name) => this.broadcast('health', 'disconnected', { name }));
    hub.on('config:reloaded', () => this.broadcast('config', 'reloaded', hub.getConfig()));
  }

  private async registerStatic(): Promise<void> {
    const publicDir = resolvePath(this.options.publicDir ?? './public');
    if (!existsSync(publicDir)) return;
    await this.app.register(fastifyStatic, { root: publicDir });
    // SPA fallback: serve index.html for unknown non-API routes.
    this.app.setNotFoundHandler((req, reply) => {
      if (req.url.startsWith('/api') || req.url.startsWith('/ws')) {
        reply.code(404).send({ error: 'not found', code: 'NOT_FOUND' });
        return;
      }
      reply.sendFile('index.html');
    });
  }

  async start(host: string, port: number): Promise<void> {
    await this.configure();
    await this.app.listen({ host, port });
    this.options.logger.info({ host, port }, 'web UI listening');
  }

  async close(): Promise<void> {
    await this.app.close();
  }
}

const STATUS_BY_CODE: Record<string, number> = {
  INVALID_INPUT: 400,
  VALIDATION_ERROR: 422,
  INVALID_CONFIG: 422,
  MCP_NOT_FOUND: 404,
  TOOL_NOT_FOUND: 404,
  CONFLICT: 409,
  ALREADY_EXISTS: 409,
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

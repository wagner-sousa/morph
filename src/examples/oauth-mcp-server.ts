import http from 'node:http';
import { URL } from 'node:url';
import crypto from 'node:crypto';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';

const PORT = Number(process.env.OAUTH_MCP_PORT ?? 3202);
const DEMO_TOKEN = 'demo-token';

const toolDefs = [
  { name: 'ping', description: 'Health check — returns pong', inputSchema: { type: 'object', properties: {} } },
  { name: 'echo', description: 'Echo back the given arguments', inputSchema: { type: 'object', properties: {} } },
  { name: 'time', description: 'Returns current server time', inputSchema: { type: 'object', properties: {} } },
  {
    name: 'whoami',
    description: 'Returns information about the authenticated client',
    inputSchema: { type: 'object', properties: {} },
  },
];

function authorizeUrl(path: string) {
  return `http://localhost:${PORT}${path}`;
}

// Store registered clients and their pending auth codes
const clients = new Map<string, string>(); // client_id -> client_secret

const OAUTH_META = {
  issuer: authorizeUrl(''),
  authorization_endpoint: authorizeUrl('/authorize'),
  token_endpoint: authorizeUrl('/token'),
  registration_endpoint: authorizeUrl('/register'),
  response_types_supported: ['code'],
  grant_types_supported: ['authorization_code'],
  code_challenge_methods_supported: ['S256'],
  token_endpoint_auth_methods_supported: ['client_secret_basic', 'client_secret_post', 'none'],
};

function authenticate(req: http.IncomingMessage): boolean {
  const auth = req.headers.authorization;
  if (!auth) return false;
  const [scheme, token] = auth.split(/\s+/);
  return scheme?.toLowerCase() === 'bearer' && token === DEMO_TOKEN;
}

function callTool(tool: string, args: Record<string, unknown>) {
  switch (tool) {
    case 'ping':
      return { content: [{ type: 'text', text: 'pong' }] };
    case 'echo':
      return { content: [{ type: 'text', text: JSON.stringify(args ?? {}) }] };
    case 'time':
      return { content: [{ type: 'text', text: new Date().toISOString() }] };
    case 'whoami':
      return { content: [{ type: 'text', text: JSON.stringify({ client: 'demo', tokenType: 'bearer', authenticated: true }) }] };
    default:
      return { isError: true, content: [{ type: 'text', text: `unknown tool ${tool}` }] };
  }
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

const app = http.createServer(async (req, res) => {
  const url = new URL(req.url!, `http://${req.headers.host ?? 'localhost'}`);
  const path = url.pathname;

  // OAuth metadata endpoint
  if (req.method === 'GET' && path === '/.well-known/oauth-authorization-server') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(OAUTH_META));
    return;
  }

  // OAuth client registration (Dynamic Client Registration)
  if (req.method === 'POST' && path === '/register') {
    const body = await readBody(req);
    const clientId = crypto.randomUUID();
    const clientSecret = crypto.randomUUID();
    clients.set(clientId, clientSecret);
    res.writeHead(201, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      client_id_issued_at: Math.floor(Date.now() / 1000),
      client_secret_expires_at: 0,
      redirect_uris: body ? (JSON.parse(body).redirect_uris ?? [authorizeUrl('/callback')]) : [authorizeUrl('/callback')],
    }));
    return;
  }

  // OAuth authorize endpoint (mock)
  if (req.method === 'GET' && path === '/authorize') {
    const redirectUri = url.searchParams.get('redirect_uri') ?? '';
    const state = url.searchParams.get('state') ?? '';
    const code = 'demo-auth-code';
    const redirectUrl = new URL(redirectUri);
    redirectUrl.searchParams.set('code', code);
    if (state) redirectUrl.searchParams.set('state', state);
    res.writeHead(302, { Location: redirectUrl.toString() });
    res.end();
    return;
  }

  // OAuth token endpoint (mock)
  if (req.method === 'POST' && path === '/token') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({
      access_token: DEMO_TOKEN,
      token_type: 'bearer',
      expires_in: 3600,
      scope: '',
    }));
    return;
  }

  // MCP endpoint
  if (path !== '/mcp') {
    res.writeHead(404).end('Not Found');
    return;
  }

  if (!authenticate(req)) {
    res.writeHead(401, {
      'WWW-Authenticate': `Bearer realm="demo-mcp", error="invalid_token"`,
      'Content-Type': 'application/json',
    });
    res.end(JSON.stringify({
      error: 'unauthorized',
      message: 'Use Bearer token: ' + DEMO_TOKEN,
    }));
    return;
  }

  try {
    const body = req.method === 'POST' ? JSON.parse(await readBody(req)) : undefined;

    const srv = new Server({ name: 'demo-http-oauth', version: '1.0.0' }, { capabilities: { tools: {} } });
    srv.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: toolDefs }));
    srv.setRequestHandler(CallToolRequestSchema, async (r) => {
      const { name, arguments: args } = r.params;
      return callTool(name, args ?? {});
    });

    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    });
    await srv.connect(transport);
    await transport.handleRequest(req, res, body);
  } catch (err) {
    console.error('OAuth MCP server error:', err);
    if (!res.headersSent) res.writeHead(500).end('Internal Server Error');
  }
});

app.listen(PORT, () => {
  console.error(`OAuth demo MCP server listening on port ${PORT}`);
});

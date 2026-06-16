# MORPH

**MCP Optimized Response Protocol Handler** — v2.0

TOON (Token-Oriented Object Notation) is a compact data format that cuts token usage by 30–60% compared to JSON. MORPH is a **gateway proxy** that sits between your AI agents and your MCP servers, automatically converting JSON responses to TOON — no MCP changes required.

```mermaid
graph LR
    Agent[AI Agent] -- MCP stdio/HTTP --> MORPH
    MORPH -- stdio --> M1[MCP Server A]
    MORPH -- HTTP --> M2[MCP Server B]
    MORPH -- SSE --> M3[MCP Server C]
    MORPH -.-> UI[Web UI :3101]
    UI -.-> DB[(SQLite)]
```

## Features

- **Single entry point** — One MCP config for all your servers
- **Automatic TOON conversion** — JSON → TOON on every response, saving 30–60% tokens
- **Multi-transport** — Connect MCPs via stdio, HTTP, or SSE
- **OAuth support** — Built-in OAuth client provider for HTTP MCPs with Dynamic Client Registration
- **Config hot-reload** — Edit `morph.json` or `.mcp.json` without restarting
- **Import existing configs** — Migrate from Claude Desktop or VS Code
- **Web UI (Morph Studio)** — Dashboard, logs, stats, MCP management, TOON savings charts
- **Real-time** — WebSocket for live logs, health, and metrics
- **SQLite persistence** — Call history, token savings, time-series stats
- **Docker-native** — Volume-based config, transport selection via `MORPH_TRANSPORT`
- **124+ tests** — Unit, integration, and connection tests

## Quick Start (Docker)

```bash
# Clone and build
git clone https://github.com/wagner-sousa/morph.git
cd morph

# Start the full dev stack
docker compose -f docker-compose.dev.yml up -d

# Services:
#   Backend (MORPH API)     → http://localhost:3101
#   Frontend (Morph Studio) → http://localhost:5173
#   Demo MCP servers        → ports 3200-3202
```

Open `http://localhost:5173` for the Web UI.

## Demo MCP Servers

MORPH ships with 5 demo MCP servers for testing:

```mermaid
graph LR
    subgraph "MORPH Dev Stack"
        BE[Backend API :3101]
        FE[Frontend :5173]
    end
    subgraph "Demo MCP Servers"
        STDIO[demo-stdio]
        HTTP[demo-http :3200]
        OAUTH[demo-http-oauth :3202]
        SSE[demo-sse :3201]
        PARAMS[demo-stdio-params]
    end
    BE --> STDIO & HTTP & OAUTH & SSE & PARAMS
```

| Name                | Transport    | Port | Tools                    |
| ------------------- | ------------ | ---- | ------------------------ |
| `demo-stdio`        | STDIO        | —    | ping, users, echo        |
| `demo-http`         | HTTP         | 3200 | ping, users, echo        |
| `demo-http-oauth`   | HTTP + OAuth | 3202 | ping, echo, time, whoami |
| `demo-sse`          | SSE          | 3201 | ping, users, echo        |
| `demo-stdio-params` | STDIO        | —    | read, write, list, stats |

Start them with:

```bash
docker compose -f docker-compose.dev.yml up -d mcp-test-servers
```

## Configuration

MORPH is configured via two files:

- **`morph.json`** — MORPH settings only (toon / webUi / health / logging):

```json
{
  "morph": { "logLevel": "info" },
  "toon": { "autoConvert": true },
  "webUi": { "enabled": true, "port": 3101 }
}
```

- **`.mcp.json`** — your MCP servers, in the standard Claude/`.mcp.json` keyed
  format. A `.mcp.json` from Claude or VS Code can be dropped in as-is:

```json
{
  "mcpServers": {
    "my-server": {
      "command": "npx",
      "args": ["-y", "@org/mcp-server"],
      "env": { "API_KEY": "${MY_API_KEY}" }
    },
    "my-api": { "type": "http", "url": "https://example.com/mcp" }
  }
}
```

Both files are **local** (git-ignored, like `.env`). Start from the committed
templates:

```bash
cp morph.example.json morph.json
cp .mcp.example.json .mcp.json
```

By default `.mcp.json` is looked up next to `morph.json`; override with
`--mcp-config <path>` or `MORPH_MCP_CONFIG`. Optional per-server morph fields
(`enabled`, `description`, `aliases`, `labels`) may be added but are never
required. Import from another tool with `morph import --from <file>` (Claude and
VS Code formats). The committed `*.demo.json` files power the `docker-compose.dev.yml`
demo stack.

See [Configuration](https://wagner-sousa.github.io/morph/02-usage/010_configuration/) for the complete reference.

### Configuration via environment (Docker)

Every `morph.json` setting can be overridden by a dedicated `MORPH_*` variable —
no need to edit the JSON in a container. Precedence:

```text
CLI flag  >  MORPH_* env var  >  morph.json value  >  built-in default
```

`.mcp.json` server secrets stay as `${VAR}` placeholders (resolved from env).
Copy `.env.example` to `.env` to see every variable; the most common:

| Variable | morph.json field | Default |
|----------|------------------|---------|
| `MORPH_LOG_LEVEL` | `morph.logLevel` | `info` |
| `MORPH_WEB_ENABLED` / `MORPH_WEB_HOST` / `MORPH_WEB_PORT` | `webUi.*` | `true` / `0.0.0.0` / `3100` |
| `MORPH_TOON_AUTO_CONVERT` / `MORPH_TOON_DELIMITER` / `MORPH_TOON_INDENT` / `MORPH_TOON_FLATTEN_DEPTH` / `MORPH_TOON_THRESHOLD` | `toon.*` | see schema |
| `MORPH_HEALTH_INTERVAL_MS` / `MORPH_HEALTH_TIMEOUT_MS` / `MORPH_HEALTH_MAX_RETRIES` | `health.*` | `30000` / `5000` / `3` |
| `MORPH_ALLOW_CONFLICTS` / `MORPH_TOOL_PREFIX` | `morph.*` | `false` / `` |

### Single data folder

All persisted state lives under one directory (default `./data`, set by
`MORPH_DATA_DIR`) so Docker needs a single volume:

```text
./data/
├── morph.json    # config (fallback: ./morph.json)
├── .mcp.json     # servers (fallback: ./.mcp.json)
├── morph.db      # SQLite (+ -wal, -shm) and oauth-sessions.json
└── logs/morph.log   # only when MORPH_LOG_FILE is set
```

`docker-compose.yml` mounts `./data:/app/data` and runs the container as the
host `UID:GID` (set in `.env`, default `1000:1000`) so files in `./data` stay
owned by your user. Create the folder before the first `up`: `mkdir -p data`.

## Agent Setup

Add MORPH as the **only** MCP server in your agent config:

```json
{
  "mcpServers": {
    "morph": {
      "command": "docker",
      "args": [
        "run",
        "-i",
        "--rm",
        "-v",
        "/path/to/config:/config:ro",
        "-e",
        "MORPH_CONFIG=/config/morph.json",
        "-e",
        "MORPH_MCP_CONFIG=/config/.mcp.json",
        "-e",
        "MORPH_TRANSPORT=stdio",
        "morph:latest"
      ]
    }
  }
}
```

## Web UI (Morph Studio)

| Route       | Page                                                        |
| ----------- | ----------------------------------------------------------- |
| `/`         | Dashboard — status, calls/min, TOON savings, totalizers     |
| `/mcps`     | MCP CRUD — add, edit, remove, toggle servers (inline modal) |
| `/logs`     | Call history with search and level filter                   |
| `/logs/:id` | Log detail — JSON original vs TOON, token savings           |
| `/stats`    | TOON savings charts (bar, pie)                              |
| `/settings` | Global config, import                                       |

Real-time updates via WebSocket at `ws://<host>/ws`.

## Architecture

```mermaid
flowchart TB
    Agent[AI Agent] -->|tools/list tools/call| Server[Agent-facing MCP Server]
    Server --> Hub[Hub Coordinator]
    Hub --> Router[Router]
    Hub --> Converter[TOON Converter]
    Hub --> Registry[MCP Client Registry]
    Registry --> Stdio[STDIO Client]
    Registry --> Http[HTTP Client]
    Registry --> Sse[SSE Client]
    Registry --> OAuth[OAuth Provider]
    Hub --> Web[Web API :3101]
    Web --> FE[Morph Studio :5173]
    Hub --> Metrics[Metrics]
    Hub --> Logs[LogStore]
    Hub --> SQL[(SQLite)]
```

See [Architecture](https://wagner-sousa.github.io/morph/01-about/030_architecture/) for details.

## Development

```bash
# Dev stack (hot-reload)
docker compose -f docker-compose.dev.yml up -d

# Run tests
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm test"

# Build
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run build"
```

See [Development Guide](https://wagner-sousa.github.io/morph/03-development/000_development/).

## Releasing

Releases are **fully automated** via [semantic-release](https://semantic-release.gitbook.io/).
There is no manual version bump — the version is derived from the commit messages.

- Commits must follow [Conventional Commits](https://www.conventionalcommits.org/): `fix:` → patch, `feat:` → minor, `feat!:`/`BREAKING CHANGE:` → major.
- On every push to `main`, the [Release workflow](.github/workflows/release.yml) runs the test suite and then `semantic-release`, which:
  1. computes the next version, updates `CHANGELOG.md` and both `package.json` files (root + `web-frontend`);
  2. commits them back (`chore(release): … [skip ci]`) and pushes the `vX.Y.Z` git tag;
  3. creates the GitHub Release.
- The new tag triggers the [Docker workflow](.github/workflows/docker.yml), which builds and publishes `ghcr.io/<repo>:X.Y.Z`, `:X.Y` and `:latest` to GHCR.

**One-time setup:** create a repository secret `RELEASE_TOKEN` (a PAT with `repo` + `workflow` scope). It is required so the tag pushed by the release job triggers the Docker workflow — a tag pushed with the default `GITHUB_TOKEN` would not.

Preview the next release without publishing: `npx semantic-release --dry-run`.

## Documentation

- [Architecture](https://wagner-sousa.github.io/morph/01-about/030_architecture/) — components, layers, data flow
- [Configuration](https://wagner-sousa.github.io/morph/02-usage/010_configuration/) — every `morph.json` field with examples
- [Development Guide](https://wagner-sousa.github.io/morph/03-development/000_development/) — SDD workflow, layout, testing

## License

MIT

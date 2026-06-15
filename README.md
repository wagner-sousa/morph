# MORPH

**MCP Optimized Response Protocol Handler**

TOON (Token-Oriented Object Notation) is a compact data format that cuts token usage by 30–60% compared to JSON — but there's a catch: every MCP developer must implement TOON support individually, and most haven't. So the format that could save you tokens remains unusable.

MORPH solves this. Instead of waiting for each MCP to support TOON, MORPH is a **hub** that sits between your AI agents and your MCP servers. It calls the MCPs itself, receives their JSON responses, and **converts them to TOON automatically** — no MCP changes required. Agents connect only to MORPH, never to individual MCPs.

It also provides a web UI for visualizing activity and configuring which MCPs are active — all from a single place.

## Features

- **Single entry point** — One MCP config for all your servers
- **Automatic TOON conversion** — JSON → TOON on every response, saving 30–60% tokens
- **Multi-transport** — Connect MCPs via stdio, HTTP, or SSE
- **Config hot-reload** — Edit `morph.json` without restarting
- **Import existing configs** — Migrate from Claude Desktop, VS Code, or GitHub Copilot
- **Web UI** — Dashboard, logs, stats, MCP management, TOON savings charts
- **Real-time** — WebSocket for live logs, health, and metrics
- **Docker-native** — Volume-based config, transport selection via `MORPH_TRANSPORT`

## Quick Start (Docker)

```bash
# Create config directory
mkdir -p my-mcp-config

# Create morph.json
cat > my-mcp-config/morph.json << 'EOF'
{
  "mcpServers": [
    {
      "name": "filesystem",
      "enabled": true,
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@modelcontextprotocol/server-filesystem", "/data"]
      }
    }
  ],
  "toon": { "autoConvert": true },
  "webUi": { "enabled": true, "port": 3100 }
}
EOF

# Run MORPH
docker run -i --rm \
  -v ./my-mcp-config:/config:ro \
  -e MORPH_CONFIG=/config/morph.json \
  -p 3100:3100 \
  morph:latest
```

Open `http://localhost:3100` for the Web UI.

## Configuration

MORPH is configured via a single `morph.json` file (version-controlled) and an optional `.env` file (secrets, gitignored).

### morph.json

```json
{
  "mcpServers": [
    {
      "name": "clickup",
      "enabled": true,
      "transport": {
        "type": "stdio",
        "command": "npx",
        "args": ["-y", "@anthropic/mcp-clickup", "--api-key=${CLICKUP_API_KEY}"]
      }
    },
    {
      "name": "brightdata",
      "enabled": true,
      "transport": {
        "type": "http",
        "url": "https://api.brightdata.com/mcp",
        "headers": { "Authorization": "Bearer ${BRIGHTDATA_API_KEY}" }
      }
    }
  ],
  "toon": {
    "autoConvert": true,
    "delimiter": "comma",
    "indent": 2
  },
  "webUi": {
    "enabled": true,
    "port": 3100
  }
}
```

### .env (not versioned)

```bash
CLICKUP_API_KEY=pk_xxxx
BRIGHTDATA_API_KEY=bd_xxxx
MORPH_WEB_USERNAME=admin          # optional, enables Basic Auth
MORPH_WEB_PASSWORD=secure_pass    # optional
```

### Import Existing Configs

```bash
# Claude Desktop
morph import --from ~/.config/Claude/claude_desktop_config.json

# VS Code workspace
morph import --from .vscode/mcp.json --merge ./morph.json

# GitHub Copilot CLI
morph import --from ~/.copilot/mcp-config.json --dry-run
```

## Agent Setup

Add MORPH as the **only** MCP server in your agent config:

```json
{
  "mcpServers": {
    "morph": {
      "command": "docker",
      "args": [
        "run", "-i", "--rm",
        "-v", "/path/to/config:/config:ro",
        "-e", "MORPH_CONFIG=/config/morph.json",
        "-e", "MORPH_TRANSPORT=stdio",
        "-p", "3100:3100",
        "morph:latest"
      ]
    }
  }
}
```

For remote agents, use `MORPH_TRANSPORT=http` and connect to `ws://host:3100/mcp`.

## Web UI (Morph Studio)

| Route | Page |
|-------|------|
| `/` | Dashboard — status, calls/min, TOON savings |
| `/mcps` | MCP CRUD — add, edit, remove, toggle servers |
| `/mcps/:name` | MCP details + tools |
| `/logs` | Call history with search and filter |
| `/stats` | TOON savings charts (line, bar, pie) |
| `/settings` | Global config, export/import |

Real-time updates via WebSocket at `ws://host:3100/ws`.

## Architecture

```
Agent ──MCP──▶ MORPH ──stdio/HTTP/SSE──▶ MCP Server A
                                           MCP Server B
              │                            MCP Server C
              └── Web UI (port 3100)
```

MORPH is an MCP server that proxies to other MCP servers. It:
1. Discovers all tools from backend MCPs
2. Exposes them as a unified list to the agent
3. Routes `tools/call` to the correct backend
4. Converts JSON responses to TOON automatically

## Development

```bash
# Clone and install
git clone https://github.com/your-org/morph.git
cd morph
npm install

# Run in dev mode (hot reload)
npm run dev -- --config ./morph.json

# Run tests
npm test
```

## License

MIT

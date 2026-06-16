# Quick Start

Get MORPH running in under 2 minutes.

## Prerequisites

- [Docker](https://docs.docker.com/get-docker/) (Compose v2)
- [Git](https://git-scm.com/)

## Clone and Run

```bash
git clone https://github.com/wagner-sousa/morph.git
cd morph
docker compose -f docker-compose.dev.yml up -d
```

This starts four services:

| Service            | Purpose                             | Port        |
| ------------------ | ----------------------------------- | ----------- |
| `morph`            | MORPH backend API (hot-reload)      | `3101`      |
| `morph-studio`     | Web UI frontend (Vite dev server)   | `5173`      |
| `mcp-test-servers` | 3 demo MCP servers (HTTP/SSE/OAuth) | `3200-3202` |

## Access the Web UI

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

You should see:

- **Dashboard** — connected MCPs, tool counts, uptime
- **MCP Servers** — all configured backend MCPs with status
- **Logs** — real-time stream of tool calls
- **Stats** — TOON token savings charts

## Make Your First Tool Call

MORPH is pre-configured with 5 demo MCP servers. Use any AI agent that supports MCP:

```bash
# Example: connect via stdio (see agent-setup.md for details)
# In Claude Desktop:
# Add to claude_desktop_config.json:
```

```json
{
  "mcpServers": {
    "morph": {
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "morph.json:/app/morph.json:ro",
        "-v",
        "morph_data:/app/data",
        "ghcr.io/wagner-sousa/morph:latest",
        "morph",
        "start",
        "--transport",
        "stdio"
      ]
    }
  }
}
```

Open Claude Desktop and try:

> _"List your tools"_

Claude will see tools from all 5 demo servers, including:

- `ping` — returns `"pong"`
- `users` — returns user objects (great for TOON savings)
- `echo` — echoes back arguments
- `read`, `write`, `list`, `stats` — file operations (demo-stdio-params)

## View Logs and Stats

### Live logs (terminal)

```bash
docker compose -f docker-compose.dev.yml logs -f morph
```

### API endpoints

```bash
# All MCP servers status
curl http://localhost:3101/api/mcps

# Live tool-call log stream (SSE)
curl -N http://localhost:3101/api/logs/stream

# TOON token savings stats
curl http://localhost:3101/api/stats/toon

# Aggregate call totals
curl http://localhost:3101/api/calls/totals
```

### Web UI

The Morph Studio dashboard provides real-time visualizations of all metrics, logs, and MCP connection status — no terminal needed.

## What's Next

- [Configuration](010_configuration.md) — understand the full `morph.json` schema
- [Agent Setup](020_agent-setup.md) — connect Claude Desktop, VS Code, or CLI agents
- [Transports](030_transports.md) — deep dive into STDIO, HTTP, and SSE

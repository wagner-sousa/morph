# Connecting AI Agents

MORPH works with any MCP-compatible AI agent. Here is how to connect the most common tools.

## Claude Desktop

Add a new MCP server to your `claude_desktop_config.json`:

**Linux:**

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
        "/path/to/morph.json:/app/morph.json:ro",
        "-v",
        "/path/to/data:/app/data",
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

**macOS:**

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
        "$HOME/.morph/morph.json:/app/morph.json:ro",
        "-v",
        "$HOME/.morph/data:/app/data",
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

**Windows:**

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
        "C:\\Users\\You\\.morph\\morph.json:/app/morph.json:ro",
        "-v",
        "C:\\Users\\You\\.morph\\data:/app/data",
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

Restart Claude Desktop. All MCP tools from your configured servers will appear in Claude's tool list, each prefixed with the MCP server name (e.g., `demo-stdio_ping`, `demo-http_users`).

## VS Code / Cursor

### VS Code (mcp.json)

Add to `.vscode/mcp.json` in your workspace:

```json
{
  "servers": {
    "morph": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "${workspaceFolder}/morph.json:/app/morph.json:ro",
        "-v",
        "${workspaceFolder}/data:/app/data",
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

VS Code will discover and expose all MCP tools automatically.

### Cursor

Cursor uses the same `mcp.json` format as VS Code. Place the file at `.cursor/mcp.json` or `.vscode/mcp.json`:

```json
{
  "servers": {
    "morph": {
      "type": "stdio",
      "command": "docker",
      "args": [
        "run",
        "--rm",
        "-i",
        "-v",
        "${workspaceFolder}/morph.json:/app/morph.json:ro",
        "-v",
        "${workspaceFolder}/data:/app/data",
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

## CLI Usage

### OpenCode

```bash
# Run MORPH as a Docker container and connect OpenCode
opencode --mcp '{
  "mcpServers": {
    "morph": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "$PWD/morph.json:/app/morph.json:ro",
        "-v", "$PWD/data:/app/data",
        "ghcr.io/wagner-sousa/morph:latest",
        "morph", "start", "--transport", "stdio"
      ]
    }
  }
}'
```

### Claude Code

```bash
claude --mcp '{
  "mcpServers": {
    "morph": {
      "command": "docker",
      "args": [
        "run", "--rm", "-i",
        "-v", "$PWD/morph.json:/app/morph.json:ro",
        "-v", "$PWD/data:/app/data",
        "ghcr.io/wagner-sousa/morph:latest",
        "morph", "start", "--transport", "stdio"
      ]
    }
  }
}'
```

## Docker Options

The `--transport` flag controls how MORPH talks to the agent:

| Transport | Flag                | Use Case                                    |
| --------- | ------------------- | ------------------------------------------- |
| STDIO     | `--transport stdio` | Claude Desktop, VS Code, Cursor, CLI agents |
| HTTP      | `--transport http`  | Remote agents, Web UI (MORPH Studio)        |

### Named MCP scoping

Use `--mcp <name>` to expose only a single backend MCP's tools:

```bash
docker run --rm -i \
  -v "$PWD/morph.json:/app/morph.json:ro" \
  ghcr.io/wagner-sousa/morph:latest \
  morph start --transport stdio --mcp demo-stdio
```

This is useful for sandboxing or when an agent should only access specific servers.

### Production deployment

```bash
docker run -d --restart unless-stopped \
  --name morph \
  -p 3101:3100 \
  -v /etc/morph/morph.json:/app/morph.json:ro \
  -v /var/morph/data:/app/data \
  -e MORPH_TRANSPORT=http \
  -e NODE_ENV=production \
  ghcr.io/wagner-sousa/morph:latest
```

## Importing Agent Configs

MORPH can import existing MCP configurations from other tools:

```bash
# Import from Claude Desktop
morph import --from ~/.config/Claude/claude_desktop_config.json

# Import from VS Code workspace
morph import --from .vscode/mcp.json --merge ./.mcp.json

# Preview without writing
morph import --from other/.mcp.json --dry-run
```

See the [Configuration](010_configuration.md#importing-existing-configs) page for details.

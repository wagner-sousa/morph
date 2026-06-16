# About MORPH

MORPH is a **gateway proxy** that unifies multiple MCP servers behind a single endpoint. It converts JSON responses to TOON automatically, saving 30–60% on token usage.

## Why MORPH?

Without MORPH, your AI agent needs a separate MCP connection for every backend server:

```mermaid
flowchart LR
    A[Agent] -->|MCP| B[Server A]
    A -->|MCP| C[Server B]
    A -->|MCP| D[Server C]
```

With MORPH:

```mermaid
flowchart LR
    A[Agent] -->|Single MCP| M[MORPH]
    M --> B[Server A]
    M --> C[Server B]
    M --> D[Server C]
```

## Key Benefits

| Benefit                    | Description                                   |
| -------------------------- | --------------------------------------------- |
| **Token savings**          | TOON conversion cuts 30–60% of tokens vs JSON |
| **Single endpoint**        | No per-server MCP configuration needed        |
| **Centralized monitoring** | Dashboard, logs, stats in one place           |
| **Transport agnostic**     | Mix stdio, HTTP, SSE servers freely           |
| **Live config updates**    | Edit morph.json without restarting            |

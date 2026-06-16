<!-- SPECKIT START -->
For additional context about technologies to be used, project structure,
shell commands, and other important information, read the current plan
<!-- SPECKIT END -->

# AGENTS.md

This file is the single source of guidance for any coding agent (Claude Code, Copilot, etc.) working with code in this repository.

## What MORPH is

MORPH (MCP Optimized Response Protocol Handler) is a **gateway proxy** that sits between AI agents and backend MCP servers. Agents connect to MORPH as a single MCP server; MORPH aggregates the tools of all configured backends and converts every JSON tool result into [TOON](https://www.npmjs.com/package/@toon-format/toon) (Token-Oriented Object Notation) to cut token usage 30–60%. Backends are reached over stdio, HTTP, or SSE (with optional OAuth).

## Commands

Everything is expected to run in Docker; no local Node toolchain is assumed (engine: Node >=22, ESM).

```bash
# Test / typecheck / build (one-off in a clean container)
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm test"
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run typecheck"
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run build"

# Regenerate schema.json + mcp.schema.json from the zod schemas (run after editing src/config/schema.ts)
docker run --rm -v "$PWD":/app -w /app node:22 sh -c "npm install && npm run gen:schema"

# Dev stack with hot-reload: backend :3101, Morph Studio :5173, demo MCPs :3200-3202
docker compose -f docker-compose.dev.yml up -d
docker compose -f docker-compose.dev.yml logs -f morph
docker compose -f docker-compose.dev.yml down -v   # full reset incl. volumes
```

If you have a local toolchain, the underlying npm scripts are: `npm run dev` (tsx watch), `npm test` (vitest), `npm run build` (tsc → `dist/`), `npm run typecheck`, `npm run gen:schema`.

```bash
# Run a single test file / single test by name
npx vitest run tests/unit/router.test.ts
npx vitest run -t "auto-prefixes conflicting tool names"
```

> `node_modules`/`dist` created inside the container are owned by root. Reclaim: `docker run --rm -v "$PWD":/app -w /app node:22 chown -R "$(id -u):$(id -g)" /app/node_modules /app/dist`.

## Development workflow (SDD)

This repo follows **Specification-Driven Development**: write the contract first (`src/config/schema.ts` zod schema → `src/config/types.ts` inferred types), then a failing test, then the implementation. Source files are tagged with `SPEC:` (contracts) and `IMPL:` (implementations) header comments — preserve that distinction. The zod schema is the executable source of truth; `schema.json`/`mcp.schema.json` are **generated** — never hand-edit them, run `gen:schema`.

### Spec Kit (governance layer)

On top of the SDD-Zod loop, MORPH uses **[GitHub Spec Kit](https://github.com/github/spec-kit)** to give each feature a versioned specification. Project principles are codified in [.specify/memory/constitution.md](.specify/memory/constitution.md) (Principles I–V: zod-first, SPEC/IMPL, test-first, Docker/ESM, token savings); every `plan.md` must pass its Constitution Check gate. For **new features**, drive the flow with the installed skills: `/speckit-constitution → /speckit-specify → /speckit-plan → /speckit-tasks → /speckit-implement`. Each feature lives in `specs/NNN-feature/` (`spec.md`/`plan.md`/`tasks.md`, plus `data-model.md` when config is involved). The Spec Kit sits *above* the zod contract — the spec describes the feature, the zod schema remains the executable contract it references. v2.0 is documented retroactively in [specs/](specs/) (`001`–`010`).

## Architecture

The runtime is a star around the **Hub** ([src/hub.ts](src/hub.ts)), which owns and wires every component. Request path:

```
AI Agent → MorphMCPServer → Hub → Router → MCPClientRegistry → backend client (stdio/http/sse)
                                  → ToonConverter (result JSON → TOON)
```

- **[src/index.ts](src/index.ts)** — CLI entry (`start`, `import` commands), bootstrap, graceful shutdown. Hand-rolled flag parser.
- **[src/hub.ts](src/hub.ts)** — the coordinator. Owns registry, router, converter, health checker, metrics, log store, SQLite store, OAuth store, and the config watcher. Exposes the unified tool list and executes `tools/call` (route → call backend → convert → record).
- **[src/mcp-server/](src/mcp-server/)** — the agent-facing MCP server. `server.ts` aggregates backend tools + MORPH built-ins for `tools/list`; `builtin-tools.ts` defines MORPH's own tools.
- **[src/mcp-client/](src/mcp-client/)** — backend clients. `factory.ts` builds a client per transport; `registry.ts` tracks them; `base-client.ts` is the shared base; `oauth-provider.ts`/`oauth-store.ts` handle OAuth (Dynamic Client Registration). Types live in `types.ts`.
- **[src/router/](src/router/)** — maps agent-facing tool names to `(backend, tool)`. **Conflict resolution order** (when two backends expose the same tool name): explicit `aliases` → global `toolPrefix` → auto-prefix conflicts as `${mcp}_${tool}` → if `allowConflicts`, last-wins with a warning.
- **[src/toon/](src/toon/)** — `converter.ts` (JSON→TOON), `optimizer.ts`, `stats.ts` (token savings). Conversion is gated by `toon.threshold` and `toon.autoConvert`.
- **[src/config/](src/config/)** — `schema.ts` (zod, the contract), `types.ts` (inferred), `loader.ts` (load + `${ENV}` resolution), `watcher.ts` (chokidar hot-reload).
- **[src/web/](src/web/)** — Fastify API + WebSocket (`/ws`) on :3101, serving Morph Studio. `oauth-routes.ts` handles the OAuth callback flow.
- **[src/persistence/store.ts](src/persistence/store.ts)** — better-sqlite3: call history + time-series stats. **[src/logging/](src/logging/)** — pino logger + in-memory log store. **[src/metrics.ts](src/metrics.ts)** — live aggregates.
- **[src/examples/](src/examples/)** — five demo MCP servers (stdio, http, sse, oauth, param) used by the dev stack and tests; not part of the gateway itself.

## Configuration (two files)

Config is split into two hot-reloadable files, each with a generated JSON schema:

- **morph.json** (schema: `schema.json`) — gateway behavior: `morph` (version, logLevel, allowConflicts), `toon` (autoConvert, delimiter, indent, flattenDepth, threshold), `webUi`, `health`.
- **.mcp.json** (schema: `mcp.schema.json`) — the backend MCP servers, in Claude Desktop / VS Code style (`mcpServers` map keyed by name; `command`/`args`/`env` for stdio, `type` + `url` + optional `apiKey` for http/sse). `${VAR}` placeholders are resolved from env at load.

`morph.json` and `.mcp.json` are **local instance config** (git-ignored, like `.env`); the committed `morph.example.json` / `.mcp.example.json` are templates to copy. The `.demo` variants (`morph.demo.json`, `.mcp.demo.json`) are committed and power the demo/dev stack (`docker-compose.dev.yml`). `morph import` migrates configs from Claude Desktop or VS Code ([src/import/importer.ts](src/import/importer.ts)).

## Testing

Vitest, tests in `tests/unit/` and `tests/integration/`. There is generally one test file per source module — when adding or changing a module, update its sibling test. Demo servers are exercised via tsx (not compiled `dist/`).

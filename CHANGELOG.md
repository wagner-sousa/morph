# Changelog

All notable changes to **MORPH** are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

This changelog was reconstructed retroactively from the git history and segmented
into the two milestones that the project went through.

## [2.0.0] - 2026-06-16

Morph Studio overhaul, OAuth support and multi-MCP capabilities.

### Added
- Morph Studio rebuilt with Tailwind v4, shadcn/ui and TanStack Router.
- Settings page with a full form covering every configuration section.
- MCP management UI: MCPCard with icon actions/tooltips, MCPToolsModal (tools list with description + inputSchema, TOON/JSON toggle), full MCP edit form.
- LogDetail page with a split JSON | TOON view and per-call token-savings indicators.
- Dashboard totalizers widget backed by `GET /api/calls/totalizers`.
- OAuth end to end: backend routes (status/start/callback), mcp-client OAuth store/provider/registry integration with configurable `publicUrl`, and OAuth UI flow.
- Per-MCP direct JSON-RPC handler exposed at `GET /api/mcp/:name` (initialize / tools/list / tools/call over HTTP & SSE).
- `toolPrefix` config — template-based prefix applied to all exposed tool names.
- Configuration split into `morph.json` and `.mcp.json`, treated as local instance config.
- Toast system (sonner) wired into the Studio layout.
- GitHub Actions CI workflows.
- MkDocs documentation site (Material theme) with Mermaid diagrams.
- Demo MCP servers (oauth, param) and example `morph.json`.

### Changed
- TOON conversion is now forced on all MCP tool results (bypasses the autoConvert gate).
- Store gained `raw_output`, `original_tokens` and `toon_tokens` columns; logs persist input JSON and output text.
- Documentation updated to v2.0 with examples per transport type.

### Fixed
- Synchronized IDs between `LogStore` and the SQLite `Store`.
- Tool calls that fail before the try/finally (router not found, MCP unavailable) are now logged.
- Numerous frontend fixes (import paths, TS errors, MCPCard layout, log-stream navigation).
- Full test suite stabilized — 252 tests, 100% source-file coverage.

## [1.0.0] - 2026-06-15

Initial MCP gateway core.

### Added
- Project scaffolding and Docker setup.
- Configuration layer: loader, zod schema, environment resolution and utilities.
- MCP client layer: stdio / HTTP / SSE backend clients with factory and registry.
- Router with tool conflict resolution and TOON (Token-Oriented Object Notation) conversion.
- Hub coordinator and agent-facing MCP server with health checks and persistence.
- REST API (Fastify) with WebSocket support and Morph Studio static serving.
- CLI entry point with `start` / `import` commands and graceful shutdown.
- Config import from Claude, VS Code and Copilot.
- Initial Morph Studio frontend (Vite + React).
- Documentation guides (architecture, configuration, development) and LICENSE.

[2.0.0]: https://github.com/wagner-sousa/morph/compare/v1.0.0...v2.0.0
[1.0.0]: https://github.com/wagner-sousa/morph/releases/tag/v1.0.0

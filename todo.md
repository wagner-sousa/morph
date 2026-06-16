# MORPH — To Do & Improvements

## 🔴 Critical

- [ ] **OAuth `postMessage` uses wildcard origin** — `src/web/oauth-routes.ts` sends `window.opener.postMessage({...}, "*")`. Restrict target origin to the app's actual origin instead of `"*"` to prevent leakage to other windows.
- [ ] **`getTotalizers()` full table scan** — No index on `original_tokens` / `toon_tokens` columns. Add index to speed up aggregation queries: `CREATE INDEX IF NOT EXISTS idx_logs_tokens ON logs(original_tokens, toon_tokens)`.

## 🔴 High

- [ ] **Dockerfile npm cache invalidation** — `COPY package.json tsconfig.json ./` in a single layer. Separate into two COPYs:
  ```dockerfile
  COPY package.json ./
  RUN npm install --no-audit --no-fund
  COPY tsconfig.json ./
  ```
- [ ] **`toolPrefix` undocumented** — The `morph.toolPrefix` config field exists in code and tests but is not listed in `docs/CONFIGURATION.md` or the `morph` table in `README.md`.
- [ ] **`--mcp` flag undocumented** — The CLI `--mcp <name>` flag exists in code (`src/index.ts`) but is not mentioned in any documentation.
- [ ] **Settings form undocumented** — The new Settings UI with sections for General, TOON, Web UI, Health is not documented anywhere.
- [ ] **No `node_modules` caching in CI** — `npm ci` runs 3 times independently (typecheck, test, build jobs). Add `actions/cache` to share dependencies between jobs.
- [ ] **`schema.json` out of sync** — Regenerate with `npm run gen:schema` — missing `toolPrefix` and `publicUrl` fields.

## 🟡 Medium

- [ ] **5 instances of silently swallowed async errors** — `.catch(() => {})` or `void` operator suppresses errors without logging:
  - `src/mcp-server/server.ts:55` — `sendToolListChanged().catch(() => undefined)`
  - `src/mcp-client/registry.ts:55` — `this.add(def).catch(() => undefined)`
  - `src/mcp-client/registry.ts:124` — `disconnect().catch(() => undefined)`
  - `src/web/oauth-routes.ts:58,90` — `.catch(() => {})` during OAuth reconnect
  - `src/hub.ts:290` — `void this.reloadFromDisk()`
- [ ] **No rate limiting** — No throttling on any API endpoint (`POST /api/mcps`, `POST /api/config/update`, etc.).
- [ ] **No CSRF protection** — Mutating endpoints lack CSRF tokens.
- [ ] **`src/utils/retry.ts` lacks dedicated tests** — Only tested indirectly via `tests/unit/base-client.test.ts`. Should have its own test file for edge cases (abort signal, zero retries, etc.).
- [ ] **`src/healthcheck.ts` lacks tests** — Docker HEALTHCHECK probe (12 lines) has no test coverage.
- [ ] **Frontend: `toast.tsx` is dead code** — `src/components/ui/toast.tsx` exists but the app uses `sonner` for toasts.
- [ ] **Frontend tsconfig missing strict flags** — `noFallthroughCasesInSwitch` and `forceConsistentCasingInFileNames` are not set in `web-frontend/tsconfig.json`.
- [ ] **`parseLines` truncates values containing `=`** — The helper in `Mcps.tsx` splits on first `=`, so `HEADER=Bearer abc==` becomes `Bearer ` instead of `Bearer abc==`.
- [ ] **No `unhandledRejection` handler** — The process has no global `process.on('unhandledRejection')` handler, which could cause silent crashes.
- [ ] **No request body size limits** — Fastify has no configured `bodyLimit`, allowing arbitrarily large payloads.

## 🟢 Low

- [ ] **Batch tool call execution** — Marked as "active" in PLAN.md roadmap but not implemented.
- [ ] **Log export (JSON/CSV)** — Short-term roadmap item not implemented.
- [ ] **Prometheus metrics endpoint** — Medium-term roadmap item not implemented.
- [ ] **Web UI Auth configuration page** — Auth is currently env-var only; no UI for configuring `MORPH_WEB_USERNAME`/`MORPH_WEB_PASSWORD`.
- [ ] **Multi-user support & API keys** — Medium-term roadmap item not started.
- [ ] **Update PLAN.md** — Test count is outdated (claims 124 tests / 16 files, actual is 252 tests / 31 files). CI pipeline diagram doesn't match actual `ci.yml`.
- [ ] **Add `.gitattributes`** — No file for consistent line endings across contributors.
- [ ] **Add `CODEOWNERS`** — No file for automatic pull request review assignments.

## ✅ Completed Features (for reference)

- toolPrefix config (`{name}_`, `{name}:`, etc.)
- Per-MCP servers (`POST /api/mcp/:name`)
- Settings form (General, TOON, Web UI, Health sections)
- 100% source file test coverage (31 files, 252 tests)
- GitHub Actions CI (typecheck → test → build) + Docker (build & push to GHCR)
- Mermaid diagrams in all markdown documentation
- Demo MCP servers for all 3 transports + OAuth + params
- TOON/JSON toggle in MCP tools modal
- Log detail split view (JSON original | TOON output)
- SQLite + LogStore ID synchronization
- OAuth flow with Dynamic Client Registration

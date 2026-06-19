# Feature Specification: Docker-First Build, Dev Stack & CI/CD

**Feature Branch**: `010-docker-ci`

**Created**: 2026-06-16

**Status**: Implemented

**Input**: User description: "Package MORPH so a contributor builds, tests, and runs the entire gateway plus Morph Studio and demo MCP servers in Docker with no local Node toolchain; every push to main is automatically linted, type-checked, tested, built, and shipped as a GHCR image; and releases are versioned automatically from Conventional Commits."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Run everything in Docker, no local toolchain (Priority: P1)

A new contributor clones the repo on a machine with only Docker installed. They run a
single Compose command and get the MORPH backend, the Morph Studio web UI, and the demo
MCP servers all running with hot-reload, without installing Node, npm, or any build tools
locally. They can equally build the production image and run it the same way.

**Why this priority**: Docker-First (Constitution Principle IV) is the foundation. If a
contributor cannot build/test/run in a clean container, nothing else in this feature is
reachable. This story is the MVP.

**Independent Test**: On a host with only Docker, run `docker compose -f docker-compose.dev.yml up`
and confirm the backend, Studio, and demo MCPs come up and respond on their ports; and
build the production image with `docker compose build` and run it.

**Acceptance Scenarios**:

1. **Given** a host with only Docker installed, **When** the contributor runs the dev
   Compose stack, **Then** the backend serves on `:3101`, Morph Studio on `:5173`, and the
   demo MCP servers on `:3200-3202`, with source edits hot-reloaded.
2. **Given** the repository, **When** the contributor builds the production image, **Then**
   a multi-stage build produces a lean `node:22` runtime image bundling the compiled
   backend and the built Studio static assets, with a working `HEALTHCHECK`.
3. **Given** the production image, **When** it is run via `docker-compose.yml`, **Then** all
   runtime behavior is driven by environment variables and a single `./data` folder is the
   only writable mount.

---

### User Story 2 - Pushes to main are automatically validated and shipped (Priority: P2)

A maintainer merges to `main`. CI automatically lints and format-checks, type-checks, runs
the test suite, builds the backend and the frontend, and then builds and pushes a Docker
image to GitHub Container Registry (GHCR). A failure at any stage stops the pipeline before
an image is published.

**Why this priority**: Continuous validation and delivery keep `main` always shippable, but
it depends on the Docker build (P1) existing first.

**Independent Test**: Push a commit to `main` (or open a PR) and confirm the CI workflow
runs the staged jobs in order and that a GHCR image appears only when all gates pass.

**Acceptance Scenarios**:

1. **Given** a push or PR to `main`, **When** CI runs, **Then** the stages execute in order
   lint/format → typecheck → test → build, and a later stage runs only if every prior stage
   succeeded.
2. **Given** a lint, type, or test failure, **When** CI runs, **Then** the pipeline fails
   and no image is pushed.
3. **Given** an all-green run on `main` (or a release tag), **When** the Docker workflow
   runs, **Then** an image is built and pushed to GHCR tagged by branch, short SHA, and —
   on tags — semantic version and `latest`.

---

### User Story 3 - Releases are versioned automatically (Priority: P3)

Maintainers write Conventional Commits. On push to `main`, semantic-release derives the
next version, prepends the changelog, and pushes a `vX.Y.Z` tag, which in turn triggers a
versioned, `latest`-tagged image build. No human edits version numbers or changelogs.

**Why this priority**: Automated versioning is a quality-of-life layer on top of an already
working CI/CD pipeline (P2).

**Independent Test**: Land a `feat:`/`fix:` commit on `main` and confirm a new version tag
and CHANGELOG entry are produced automatically and a versioned image is published.

**Acceptance Scenarios**:

1. **Given** Conventional Commits on `main`, **When** the release runs, **Then** the next
   semantic version is computed and a `vX.Y.Z` tag is pushed.
2. **Given** a release, **When** it completes, **Then** the CHANGELOG is updated and
   `web-frontend/package.json` is version-synced in the same release commit.
3. **Given** a pushed version tag, **When** the Docker workflow reacts to it, **Then** a
   `{{version}}`, `{{major}}.{{minor}}`, and `latest` image is published to GHCR.

### Edge Cases

- A non-release commit (e.g. `docs:`/`chore:`) on `main` produces no new version or image
  version bump.
- A `${ENV}` placeholder referenced by config but absent at runtime resolves to empty; the
  single `./data` folder must exist and be writable for the SQLite savings history.
- A failing healthcheck marks the container unhealthy so orchestrators do not route to it.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The system MUST build entirely inside `node:22` containers with no local Node
  toolchain required for build, test, or codegen.
- **FR-002**: The production image MUST use a multi-stage build: a frontend stage that
  builds Morph Studio, a backend stage that compiles TypeScript and prunes dev
  dependencies, and a lean runtime stage bundling both.
- **FR-003**: The runtime image MUST default to the stdio MCP transport, expose the HTTP
  port, and define a container `HEALTHCHECK`.
- **FR-004**: A development Compose stack MUST run the backend (`:3101`), Morph Studio
  (`:5173`), and demo MCP servers (`:3200-3202`) with hot-reload via mounted source.
- **FR-005**: All runtime configuration MUST be parametrized via environment variables, and
  persistent state MUST live in a single `./data` folder mounted into the container.
- **FR-006**: CI MUST run on every push and pull request to `main` as ordered gates:
  lint/format → typecheck → test → build (backend + frontend), where each stage runs only
  if the previous one passed.
- **FR-007**: On `main` and on version tags, the system MUST build and push a Docker image
  to GHCR with tags derived from branch, short SHA, semantic version, and `latest`.
- **FR-008**: A push that fails any CI gate MUST NOT result in a published image.
- **FR-009**: The system MUST automate versioning via semantic-release from Conventional
  Commits, prepending the CHANGELOG, syncing the frontend version, and pushing a `vX.Y.Z`
  tag that triggers the versioned image build.
- **FR-010**: The documentation site MUST build and deploy to GitHub Pages when docs
  sources change, independently of the application CI.

### Key Entities *(include if feature involves data)*

- **Production image**: The multi-stage `node:22` runtime artifact bundling the compiled
  backend, pruned `node_modules`, and built Studio static assets; carries a healthcheck and
  stdio-default transport.
- **Dev stack**: The Compose-defined set of services — `morph` backend, `morph-studio`,
  and `mcp-test-servers` — wired with mounted source, shared `node_modules` volumes, and
  hot-reload.
- **CI pipeline stage**: A discrete gate (lint/format, typecheck, test, build, docker) with
  an explicit dependency on the prior stage; the unit of pass/fail in the pipeline.
- **Release**: The semantic-release-produced version + changelog + tag, derived from
  Conventional Commits, that drives versioned image publication.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A contributor with only Docker installed can bring up the full dev stack and
  reach all three service groups (backend, Studio, demo MCPs) in a single command.
- **SC-002**: The full test suite runs to green inside a clean `node:22` container with no
  host Node installation.
- **SC-003**: 100% of pushes to `main` that pass all gates produce a GHCR image, and 100%
  that fail any gate produce none.
- **SC-004**: Every release-worthy commit on `main` results in an automatically computed
  version tag, a CHANGELOG entry, and a versioned `latest` image with zero manual version
  edits.
- **SC-005**: CI stages always execute in the fixed order (lint/format → typecheck → test →
  build → docker) so a cheap gate fails fast before expensive ones.

## Assumptions

- Contributors and CI runners have Docker (and, in CI, Buildx/QEMU) available.
- The repository uses Conventional Commits so semantic-release can derive versions.
- A `RELEASE_TOKEN` PAT is configured so a release tag can trigger the downstream Docker
  workflow, and `GITHUB_TOKEN` has `packages: write` for GHCR pushes.
- Backend MCP servers may need `python3`, `git`, and `npx`, which the runtime image provides.

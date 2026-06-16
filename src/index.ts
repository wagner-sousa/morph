#!/usr/bin/env node
/**
 * IMPL: CLI entry point + server bootstrap + graceful shutdown.
 *
 * Commands:
 *   start   start the MORPH hub (default)
 *   import  import MCP configs from other tools
 */
import { readFile, writeFile } from 'node:fs/promises';
import { resolve as resolvePath, dirname, basename } from 'node:path';
import { createLogger } from './logging/logger.js';
import { loadConfig } from './config/loader.js';
import { getVersionInfo } from './utils/version.js';
import { Hub } from './hub.js';
import { MorphMCPServer } from './mcp-server/server.js';
import { WebServer } from './web/server.js';
import { importConfig, type ImportFormat } from './import/importer.js';
import type { LogLevel } from './config/types.js';

interface Flags {
  [key: string]: string | boolean;
}

function parseFlags(argv: string[]): { positional: string[]; flags: Flags } {
  const positional: string[] = [];
  const flags: Flags = {};
  const alias: Record<string, string> = { c: 'config', p: 'port' };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg.startsWith('--') || arg.startsWith('-')) {
      let key = arg.replace(/^-+/, '');
      key = alias[key] ?? key;
      const next = argv[i + 1];
      if (next && !next.startsWith('-')) {
        flags[key] = next;
        i++;
      } else {
        flags[key] = true;
      }
    } else {
      positional.push(arg);
    }
  }
  return { positional, flags };
}

const HELP = `MORPH — MCP Optimized Response Protocol Handler

Usage: morph <command> [options]

Commands:
  start                 Start the MORPH hub (default)
  import                Import MCP configs from other tools

Options (start):
  --config, -c <path>   Path to morph.json (default: ./morph.json or $MORPH_CONFIG)
  --mcp-config <path>   Path to .mcp.json (default: sibling of morph.json or $MORPH_MCP_CONFIG)
  --port, -p <port>     Web UI port (overrides config)
  --transport <type>    Agent transport: stdio | http (default: stdio)
  --log-level <level>   debug | info | warn | error
  --mcp <name>          Start a stdio server scoped to a single MCP's tools
  --validate            Validate config and exit
  --version             Show version
  --help                Show help

Options (import):
  --from <path>         Config file to import (required)
  --format <format>     claude | vscode | auto (default)
  --merge <path>        Merge result into an existing .mcp.json
  --dry-run             Print result without writing
`;

/**
 * Derive the .mcp.json path: explicit flag/env wins, otherwise a sibling of the
 * morph config — `morph<suffix>.json` → `.mcp<suffix>.json` in the same folder.
 */
function resolveMcpConfigPath(flags: Flags, configPath: string): string {
  const explicit = (flags['mcp-config'] as string) ?? process.env.MORPH_MCP_CONFIG;
  if (explicit) return resolvePath(explicit);
  const dir = dirname(configPath);
  const base = basename(configPath);
  const m = base.match(/^morph(.*)\.json$/);
  const sibling = m ? `.mcp${m[1]}.json` : '.mcp.json';
  return resolvePath(dir, sibling);
}

async function runStart(flags: Flags): Promise<void> {
  const configPath = resolvePath(
    (flags.config as string) ?? process.env.MORPH_CONFIG ?? './morph.json',
  );
  const mcpPath = resolveMcpConfigPath(flags, configPath);

  if (flags.validate) {
    await loadConfig(configPath, mcpPath);
    process.stderr.write('config is valid\n');
    return;
  }

  const config = await loadConfig(configPath, mcpPath);
  if (flags['log-level']) config.morph.logLevel = flags['log-level'] as LogLevel;
  if (flags.port) config.webUi.port = Number(flags.port);

  const logger = createLogger(config.morph.logLevel, false);
  const dataDir = process.env.MORPH_DATA_DIR ?? './data';

  const hub = new Hub({ config, configPath, mcpPath, logger, dataDir });
  await hub.start();

  const mcpServer = new MorphMCPServer(hub, logger);
  const transport = (flags.transport as string) ?? process.env.MORPH_TRANSPORT ?? 'stdio';

  if (flags.mcp) {
    const mcpName = flags.mcp as string;
    logger.info({ mcp: mcpName }, 'per-MCP mode: tools available via /api/mcp/:name');
  }

  if (transport === 'stdio') {
    await mcpServer.listenStdio();
  } else {
    logger.warn({ transport }, 'non-stdio agent transport: web UI is up; connect agents via stdio');
  }

  let webServer: WebServer | undefined;
  if (config.webUi.enabled) {
    webServer = new WebServer({ hub, logger, mcpServer });
    await webServer.start(config.webUi.host, config.webUi.port);
  }

  const shutdownTimeout = Number(process.env.MORPH_SHUTDOWN_TIMEOUT ?? 10_000);
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    logger.info({ signal }, 'graceful shutdown started');
    try {
      await mcpServer.close();
      await Promise.race([hub.drainInFlightCalls(), delay(shutdownTimeout)]);
      await webServer?.close();
      await hub.stop();
      logger.info('shutdown complete');
    } catch (err) {
      logger.error({ err: (err as Error).message }, 'error during shutdown');
    }
    process.exit(0);
  };

  process.on('SIGTERM', () => void shutdown('SIGTERM'));
  process.on('SIGINT', () => void shutdown('SIGINT'));

  logger.info(
    { webUi: config.webUi.enabled ? `http://${config.webUi.host}:${config.webUi.port}` : 'disabled' },
    'MORPH ready',
  );
}

async function runImport(flags: Flags): Promise<void> {
  const from = flags.from as string;
  if (!from) throw new Error('import requires --from <path>');
  const raw = JSON.parse(await readFile(resolvePath(from), 'utf8'));
  const result = importConfig(raw, (flags.format as ImportFormat) ?? 'auto');

  process.stderr.write(
    `Detected: ${result.detectedFormat} — imported ${result.stats.imported}/${result.stats.total} (skipped ${result.stats.skipped})\n`,
  );
  for (const w of result.warnings) process.stderr.write(`  [WARN] ${w.message}\n`);

  const imported = result.servers;
  if (flags['dry-run']) {
    process.stdout.write(JSON.stringify({ mcpServers: imported }, null, 2) + '\n');
    return;
  }

  const target = (flags.merge as string) ?? (flags.config as string) ?? './.mcp.json';
  const targetPath = resolvePath(target);
  let base: { $schema?: string; mcpServers?: Record<string, unknown> } = { mcpServers: {} };
  try {
    base = JSON.parse(await readFile(targetPath, 'utf8'));
  } catch {
    // start fresh
  }
  const existing = base.mcpServers ?? {};
  let added = 0;
  for (const [name, entry] of Object.entries(imported)) {
    if (!(name in existing)) {
      existing[name] = entry;
      added++;
    }
  }
  base.mcpServers = existing;
  await writeFile(targetPath, JSON.stringify(base, null, 2) + '\n');
  process.stderr.write(`Wrote ${added} server(s) to ${targetPath}\n`);
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

async function main(): Promise<void> {
  const { positional, flags } = parseFlags(process.argv.slice(2));
  const command = positional[0] ?? 'start';

  if (flags.help) {
    process.stdout.write(HELP);
    return;
  }
  if (flags.version) {
    process.stdout.write(getVersionInfo().version + '\n');
    return;
  }

  switch (command) {
    case 'start':
      await runStart(flags);
      break;
    case 'import':
      await runImport(flags);
      break;
    default:
      process.stderr.write(`unknown command: ${command}\n\n${HELP}`);
      process.exit(1);
  }
}

main().catch((err) => {
  process.stderr.write(`fatal: ${(err as Error).message}\n`);
  process.exit(1);
});

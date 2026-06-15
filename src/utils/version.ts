/**
 * IMPL: version info derived from package.json.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

export interface VersionInfo {
  name: string;
  version: string;
  node: string;
}

let cached: VersionInfo | undefined;

export function getVersionInfo(): VersionInfo {
  if (cached) return cached;
  let name = 'morph';
  let version = '0.0.0';
  try {
    // dist/utils/version.js -> ../../package.json
    const here = dirname(fileURLToPath(import.meta.url));
    const pkgPath = join(here, '..', '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { name?: string; version?: string };
    name = pkg.name ?? name;
    version = pkg.version ?? version;
  } catch {
    // fall back to defaults (e.g. when run from an unusual layout)
  }
  cached = { name, version, node: process.version };
  return cached;
}

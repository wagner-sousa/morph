/**
 * IMPL: resolves `${ENV_VAR}` interpolation in config strings.
 *
 * All string values in morph.json may reference environment variables using
 * `${VAR_NAME}` syntax. This module walks an arbitrary JSON value and replaces
 * those references with values from `process.env`, collecting any that are
 * missing so the loader can fail with a single clear error.
 */
import { EnvResolutionError } from './errors.js';

const ENV_PATTERN = /\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g;

export interface ResolveOptions {
  env?: NodeJS.ProcessEnv;
  /** Throw if any referenced variable is undefined (default true). */
  strict?: boolean;
}

/** Replace `${VAR}` references in a single string. Records misses. */
export function resolveString(
  value: string,
  env: NodeJS.ProcessEnv,
  missing: Set<string>,
): string {
  return value.replace(ENV_PATTERN, (_match, name: string) => {
    const resolved = env[name];
    if (resolved === undefined) {
      missing.add(name);
      return `\${${name}}`;
    }
    return resolved;
  });
}

/**
 * Deep-resolve `${VAR}` references in any JSON-like value (objects, arrays,
 * strings). Returns a new value; the input is not mutated.
 *
 * @throws {EnvResolutionError} when strict and a referenced var is missing.
 */
export function resolveEnvVars<T>(value: T, options: ResolveOptions = {}): T {
  const env = options.env ?? process.env;
  const strict = options.strict ?? true;
  const missing = new Set<string>();

  const walk = (node: unknown): unknown => {
    if (typeof node === 'string') {
      return resolveString(node, env, missing);
    }
    if (Array.isArray(node)) {
      return node.map(walk);
    }
    if (node !== null && typeof node === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(node)) {
        out[k] = walk(v);
      }
      return out;
    }
    return node;
  };

  const result = walk(value) as T;

  if (strict && missing.size > 0) {
    const names = [...missing].sort();
    throw new EnvResolutionError(
      `missing required environment variable(s): ${names.join(', ')}`,
      names,
    );
  }

  return result;
}

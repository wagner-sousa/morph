import { describe, expect, it } from 'vitest';
import { resolveEnvVars } from '../../src/utils/env.js';
import { EnvResolutionError } from '../../src/utils/errors.js';

describe('resolveEnvVars', () => {
  const env = { API_KEY: 'secret', HOST: 'example.com' };

  it('resolves a simple ${VAR} in a string', () => {
    expect(resolveEnvVars('Bearer ${API_KEY}', { env })).toBe('Bearer secret');
  });

  it('resolves nested values in objects and arrays', () => {
    const input = {
      url: 'https://${HOST}/mcp',
      args: ['--key=${API_KEY}', 'static'],
      headers: { Authorization: 'Bearer ${API_KEY}' },
    };
    expect(resolveEnvVars(input, { env })).toEqual({
      url: 'https://example.com/mcp',
      args: ['--key=secret', 'static'],
      headers: { Authorization: 'Bearer secret' },
    });
  });

  it('throws EnvResolutionError listing all missing vars in strict mode', () => {
    expect(() => resolveEnvVars('${MISSING_A}-${MISSING_B}', { env })).toThrowError(
      EnvResolutionError,
    );
    try {
      resolveEnvVars('${MISSING_A}-${MISSING_B}', { env });
    } catch (err) {
      expect((err as EnvResolutionError).missing).toEqual(['MISSING_A', 'MISSING_B']);
    }
  });

  it('leaves placeholders untouched in non-strict mode', () => {
    expect(resolveEnvVars('${MISSING}', { env, strict: false })).toBe('${MISSING}');
  });

  it('does not mutate non-string primitives', () => {
    expect(resolveEnvVars({ n: 5, b: true, x: null }, { env })).toEqual({ n: 5, b: true, x: null });
  });
});

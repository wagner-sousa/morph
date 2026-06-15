import { describe, expect, it } from 'vitest';
import { decideConvert, isUniformArray, maxDepth } from '../../src/toon/optimizer.js';
import { validateConfig } from '../../src/config/loader.js';

const options = validateConfig({ mcpServers: [] }).toon;

describe('isUniformArray', () => {
  it('returns true for uniform objects', () => {
    const data = [
      { id: 1, name: 'a' },
      { id: 2, name: 'b' },
    ];
    expect(isUniformArray(data)).toBe(true);
  });

  it('returns false for non-uniform keys', () => {
    const data = [
      { id: 1, name: 'a' },
      { id: 2, extra: 'x' },
    ];
    expect(isUniformArray(data)).toBe(false);
  });

  it('returns false for primitives', () => {
    expect(isUniformArray([1, 2, 3])).toBe(false);
  });

  it('returns false for empty array', () => {
    expect(isUniformArray([])).toBe(false);
  });

  it('returns false for non-array values', () => {
    expect(isUniformArray({})).toBe(false);
    expect(isUniformArray(null)).toBe(false);
    expect(isUniformArray('str')).toBe(false);
  });
});

describe('maxDepth', () => {
  it('returns 2 for flat objects (root + value level)', () => {
    expect(maxDepth({ a: 1, b: 2 })).toBe(2);
  });

  it('returns 5 for nested arrays', () => {
    const data = { a: [{ b: { c: 1 } }] };
    expect(maxDepth(data)).toBe(5);
  });

  it('returns 5 for deeply nested object with 4 levels', () => {
    const data = { a: { b: { c: { d: 1 } } } };
    expect(maxDepth(data)).toBe(5);
  });

  it('handles null', () => {
    expect(maxDepth(null)).toBe(1);
  });

  it('handles arrays at root', () => {
    expect(maxDepth([{ a: { b: 1 } }])).toBe(4);
  });
});

describe('decideConvert', () => {
  it('skips content below threshold', () => {
    const { convert, reason } = decideConvert('{"a":1}', { a: 1 }, options);
    expect(convert).toBe(false);
    expect(reason).toContain('threshold');
  });

  it('skips primitive scalars', () => {
    const { convert } = decideConvert('"hello"'.repeat(50), 'hello', options);
    expect(convert).toBe(false);
  });

  it('skips deeply nested objects', () => {
    const deep = {
      a: { b: { c: { d: { e: { f: { g: 1 } } } } } },
      padding: 'x'.repeat(200),
    };
    const text = JSON.stringify(deep);
    const { convert, reason } = decideConvert(text, deep, { ...options, threshold: 1 });
    expect(convert).toBe(false);
    expect(reason).toContain('deeply nested');
  });

  it('converts moderately nested uniform arrays', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i, nested: { val: i } }));
    const text = JSON.stringify(data);
    const { convert } = decideConvert(text, data, { ...options, threshold: 1 });
    expect(convert).toBe(true);
  });

  it('converts uniform arrays (highest benefit)', () => {
    const data = Array.from({ length: 20 }, (_, i) => ({ id: i, name: `n${i}` }));
    const text = JSON.stringify(data);
    const { convert, reason } = decideConvert(text, data, { ...options, threshold: 1 });
    expect(convert).toBe(true);
    expect(reason).toContain('uniform');
  });

  it('converts non-uniform mixed data', () => {
    const data = {
      users: [{ id: 1, name: 'x' }, { id: 2, name: 'y' }],
      meta: { count: 2, source: 'test', extra: 'padding'.repeat(30) },
    };
    const text = JSON.stringify(data);
    const { convert } = decideConvert(text, data, { ...options, threshold: 1 });
    expect(convert).toBe(true);
  });
});

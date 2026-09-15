// D-75 and D-77: the AC hash algorithm and its input join, pinned so neither can drift silently —
// the value is written into ticket files that outlive the release, so a change must fail loudly.
import { describe, expect, it } from 'vitest';
import type { ScenarioRef } from '../src/index.js';
import { acHash, hashInput } from '../src/gate/hash.js';

const NUL = '\u0000';
const sc = (acTag: string | undefined, steps: string[], tags: string[] = []): ScenarioRef => ({
  name: 'S',
  keyword: 'Scenario',
  line: 1,
  tags,
  ...(acTag === undefined ? {} : { acTag }),
  steps,
});

const HASH = /^fnv1a64:[0-9a-f]{16}$/;

describe('hashInput (D-77)', () => {
  it('sorts by the numeric part of the tag, then joins tag and steps with U+0000', () => {
    const two = sc('ac-2', ['A', 'B']);
    const one = sc('ac-1', ['C']);
    expect(hashInput([two, one])).toBe(['ac-1', 'C', 'ac-2', 'A', 'B'].join(NUL));
    // Ten sorts after two: the numeric part decides, never the string.
    expect(hashInput([sc('ac-10', ['X']), two])).toBe(['ac-2', 'A', 'B', 'ac-10', 'X'].join(NUL));
  });

  it('an untagged scenario contributes nothing (it is already lint.ac-tag-missing, an error)', () => {
    const two = sc('ac-2', ['A', 'B']);
    const one = sc('ac-1', ['C']);
    expect(hashInput([two, sc(undefined, ['D']), one])).toBe(hashInput([two, one]));
  });

  it('no tag other than @ac-n is in the input, so adding @test: or @ui changes nothing (D-69)', () => {
    const one = sc('ac-1', ['C'], ['@ac-1']);
    expect(hashInput([{ ...one, tags: ['@ac-1', '@test:x', '@ui'] }])).toBe(hashInput([one]));
  });

  it('leaves its input array untouched', () => {
    const scenarios = [sc('ac-2', ['A']), sc('ac-1', ['C'])];
    const before = structuredClone(scenarios);
    hashInput(scenarios);
    expect(scenarios).toEqual(before);
  });
});

describe('acHash (D-75)', () => {
  it('is fnv1a64: plus exactly 16 lowercase hex digits, or undefined without a tagged scenario', () => {
    expect(acHash([sc('ac-1', ['x'])])).toMatch(HASH);
    expect(acHash([])).toBeUndefined();
    expect(acHash([sc(undefined, ['x'])])).toBeUndefined();
  });

  it('pins two FNV-1a 64 vectors as literals so the algorithm cannot drift', () => {
    // Offset basis 0xcbf29ce484222325, prime 0x100000001b3, masked to 64 bits after every multiply.
    // An empty hash input folds no bytes, so the result is the offset basis itself.
    expect(acHash([sc('', [])])).toBe('fnv1a64:cbf29ce484222325');
    // The ASCII string 'ac-1' (a tagged scenario with no steps). Checked against the published
    // FNV-1a 64 vectors for '', 'a', and 'foobar' before being written down.
    expect(acHash([sc('ac-1', [])])).toBe('fnv1a64:064b7f83f43e5e93');
  });

  it('hashes the UTF-8 bytes, so diacritics change the value', () => {
    const vi = acHash([sc('ac-1', ['họ thấy bảng điều khiển'])]);
    const stripped = acHash([sc('ac-1', ['ho thay bang dieu khien'])]);
    expect(vi).toMatch(HASH);
    expect(vi).not.toBe(stripped);
  });

  it('is stable under a whole-scenario reorder and under a new @test: tag, but not under a tag swap (D-77)', () => {
    const one = sc('ac-1', ['C'], ['@ac-1']);
    const two = sc('ac-2', ['A', 'B'], ['@ac-2']);
    const base = acHash([one, two]);
    expect(base).toMatch(HASH);
    expect(acHash([two, one])).toBe(base);
    expect(acHash([{ ...one, tags: [...one.tags, '@test:a-b'] }, two])).toBe(base);
    expect(acHash([{ ...one, acTag: 'ac-2' }, { ...two, acTag: 'ac-1' }])).not.toBe(base);
  });
});

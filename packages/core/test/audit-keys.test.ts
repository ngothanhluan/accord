// Phase 8.1 G3b (D-08 group 2): the config keys each release added, with their defaults, and the pure function that picks the ones a repository has not set.
import { expect, it } from 'vitest';
import { CONFIG_KEYS, newKeys, resolveKeyPath, setKeysOf } from '../src/index.js';

const PLAIN = /^\d+\.\d+\.\d+$/;

it('risk:regression every config-keys row names a schema key and a plain version (D-08)', () => {
  expect(CONFIG_KEYS.length).toBeGreaterThanOrEqual(5);
  for (const row of CONFIG_KEYS) {
    expect(resolveKeyPath(row.key), row.key).toBeDefined();
    expect(row.since, row.key).toMatch(PLAIN);
    expect(row.default.trim(), row.key).not.toBe('');
  }
  expect(new Set(CONFIG_KEYS.map((r) => r.key)).size).toBe(CONFIG_KEYS.length);
});

it('risk:complex-branching newKeys returns the rows newer than the pin or equal to the running version that are not set (D-08)', () => {
  const rows = [
    { key: 'a.old', since: '1.0.0', default: 'x' },
    { key: 'a.mid', since: '1.1.0', default: 'x' },
    { key: 'a.new', since: '1.2.0', default: 'x' },
  ];
  // pinned 1.0.0, running 1.1.0: both later rows are news; the one equal to the running version counts
  expect(newKeys(rows, '1.0.0', '1.1.0', []).map((r) => r.key)).toEqual(['a.mid', 'a.new']);
  // pinned and running 1.1.0: the row of the running version counts, the older one does not
  expect(newKeys(rows, '1.1.0', '1.1.0', []).map((r) => r.key)).toEqual(['a.mid', 'a.new']);
  // a key the config sets is not news
  expect(newKeys(rows, '1.0.0', '1.1.0', ['a.mid']).map((r) => r.key)).toEqual(['a.new']);
  // a pin that is not a plain version gives no news rather than all of them
  expect(newKeys(rows, undefined, '1.1.0', [])).toEqual([]);
});

it('risk:parsing setKeysOf lists every dotted path a config sets (D-08)', () => {
  const keys = setKeysOf({ accord: '1.0.0', commits: { message: { preset: 'conventional' }, subjects: { people: 'p: {id}' } }, roles: ['ba'] });
  expect(keys).toEqual(expect.arrayContaining(['accord', 'commits', 'commits.message', 'commits.message.preset', 'commits.subjects.people', 'roles']));
  expect(keys).not.toContain('commits.pr');
  expect(setKeysOf(undefined)).toEqual([]);
});

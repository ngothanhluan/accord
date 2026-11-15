// ST-LN-50 D-11 (t2-ac-9): the pure writers `accord config` goes through. Text in, text out: every other byte of
// config.yml survives an edit, and a text that does not parse gives undefined rather than a guess.
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { parse } from 'yaml';
import { appendConfigList, loadConfig, parseValue, resolveKeyPath, setConfigValue, unsetConfigValue } from '../src/index.js';

// This repository's own config: comments, a quoted "14", a flow list and flow maps, as a team's file would have.
const REPO = readFileSync(new URL('../../../accord/config.yml', import.meta.url), 'utf8').replace(/\r\n/g, '\n');
const crlf = (s: string): string => s.replace(/\n/g, '\r\n');
const BOM = String.fromCharCode(0xfeff);

const SMALL = [
  '# top comment',
  'accord: "1.0.0" # pinned',
  'profile: maintain',
  'tracker:',
  '  adapter: none',
  'design:',
  '  tokens: ""',
  'roles: [ba, dev]',
  'runtimes: [claude]',
  'stale_days: "14"',
  'legacy_ids: [ASK-1, BASE-1] # old ids',
  '',
].join('\n');

it('risk:data-loss a config edit keeps every other byte (ST-LN-50 t2-ac-9)', () => {
  const next = setConfigValue(REPO, ['git', 'merge'], 'rebase');
  expect(next).toBeDefined();
  // every line of the original is still there, in place; the new key is appended as a block
  const lines = REPO.split('\n');
  expect((next as string).split('\n').slice(0, lines.length - 1)).toEqual(lines.slice(0, -1));
  expect(next).toBe(REPO + 'git:\n  merge: rebase\n');
  expect(next).toContain('stale_days: "14"');
  expect(next).toContain('legacy_ids: [ASK-1, BASE-1, IDS-1, README-1, REFS-1, SHOW-1, STALE-1, TAGS-1, VID-1]');
  for (const comment of REPO.split('\n').filter((l) => l.trimStart().startsWith('#'))) expect(next, comment).toContain(comment);

  // an existing scalar changes in place: quoting, trailing comment and neighbours stay
  expect(setConfigValue(SMALL, ['stale_days'], '30')).toBe(SMALL.replace('"14"', '"30"'));
  expect(setConfigValue(SMALL, ['profile'], 'build')).toBe(SMALL.replace('maintain', 'build'));
  expect(setConfigValue(SMALL, ['accord'], '1.0.1')).toBe(SMALL.replace('"1.0.0"', '"1.0.1"'));
  // a numeric-looking string stays a string, quoted
  expect(setConfigValue(SMALL, ['tests', 'report'], '2')).toContain('tests:\n  report: "2"\n');
  // a list replaces in flow style, unpadded, and keeps its trailing comment
  expect(setConfigValue(SMALL, ['legacy_ids'], ['A-1', 'B-2'])).toBe(SMALL.replace('[ASK-1, BASE-1] # old ids', '[A-1, B-2] # old ids'));

  // a repeated set gives the same bytes
  const once = setConfigValue(SMALL, ['git', 'merge'], 'rebase') as string;
  expect(setConfigValue(once, ['git', 'merge'], 'rebase')).toBe(once);

  // CRLF and a BOM are kept as the input has them
  const crlfNext = setConfigValue(crlf(SMALL), ['git', 'merge'], 'rebase') as string;
  expect(crlfNext).toBe(crlf(SMALL + 'git:\n  merge: rebase\n'));
  expect(crlfNext.replace(/\r\n/g, '')).not.toMatch(/[\r\n]/);
  expect(setConfigValue(BOM + SMALL, ['git', 'merge'], 'rebase')).toBe(BOM + SMALL + 'git:\n  merge: rebase\n');

  // the result still passes the schema
  expect(loadConfig('accord/config.yml', next as string).findings).toEqual([]);
});

it('risk:data-loss blank lines, padded flow maps and a closing comment stay where they are (ST-LN-50 t2-ac-9)', () => {
  const text = ['# top', 'accord: "1.0.0"', '', 'profile: maintain', 'tracker: { adapter: none }', '', 'models:', '  planner: { model: opus, effort: high }', '', 'stale_days: "14"', '# closing', ''].join('\n');
  expect(setConfigValue(text, ['profile'], 'build')).toBe(text.replace('maintain', 'build'));
  expect(setConfigValue(text, ['stale_days'], '20')).toBe(text.replace('"14"', '"20"'));
  expect(setConfigValue(text, ['git', 'merge'], 'squash')).toBe(text.replace('# closing\n', 'git:\n  merge: squash\n# closing\n'));
  // a key takes the blank line before it along, as yaml's own model does
  expect(unsetConfigValue(text, ['models', 'planner'])).toBe(text.replace('models:\n  planner: { model: opus, effort: high }\n\n', ''));
  expect(unsetConfigValue(text, ['profile'])).toBe(text.replace('\nprofile: maintain\n', ''));
});

it('risk:data-loss an indentation the splice cannot match falls back to the whole document, which says the same (ST-LN-50 t2-ac-9)', () => {
  const text = ['accord: "1.0.0"', 'git:', '    merge: rebase', 'stale_days: "14"', ''].join('\n');
  const next = setConfigValue(text, ['git', 'sync'], 'make sync') as string;
  expect(parse(next)).toEqual({ accord: '1.0.0', git: { merge: 'rebase', sync: 'make sync' }, stale_days: '14' });
  expect(next).toContain('stale_days: "14"');
});

it('risk:data-loss unsetConfigValue removes the key and an emptied parent (ST-LN-50 t2-ac-9)', () => {
  const withGit = setConfigValue(SMALL, ['git', 'merge'], 'rebase') as string;
  expect(unsetConfigValue(withGit, ['git', 'merge'])).toBe(SMALL);
  expect(unsetConfigValue(SMALL, ['stale_days'])).toBe(SMALL.replace('stale_days: "14"\n', ''));
  // a parent that still holds another key stays
  const two = setConfigValue(withGit, ['git', 'sync'], 'make sync') as string;
  expect(unsetConfigValue(two, ['git', 'merge'])).toBe(SMALL + 'git:\n  sync: make sync\n');
  // a key that is not there leaves the text exactly as it was
  expect(unsetConfigValue(SMALL, ['git', 'merge'])).toBe(SMALL);
  expect(unsetConfigValue(SMALL, ['nosuch'])).toBe(SMALL);
  // CRLF survives
  expect(unsetConfigValue(crlf(withGit), ['git', 'merge'])).toBe(crlf(SMALL));
  // the people table of this repository goes with its only entry
  const gone = unsetConfigValue(REPO, ['people', 'ngothanhluan@hotmail.com']) as string;
  expect(gone).not.toContain('people:');
  expect(gone).toContain('legacy_ids:');
});

it('risk:data-loss appendConfigList adds the missing items in order and never twice (ST-LN-50 t2-ac-9)', () => {
  expect(appendConfigList(SMALL, ['legacy_ids'], ['FEAT-1'])).toBe(SMALL.replace('[ASK-1, BASE-1] # old ids', '[ASK-1, BASE-1, FEAT-1] # old ids'));
  expect(appendConfigList(SMALL, ['legacy_ids'], ['BASE-1', 'Z-1', 'Y-2', 'Z-1'])).toBe(
    SMALL.replace('[ASK-1, BASE-1] # old ids', '[ASK-1, BASE-1, Z-1, Y-2] # old ids'),
  );
  expect(appendConfigList(SMALL, ['legacy_ids'], ['ASK-1'])).toBe(SMALL);
  // a missing list is created
  expect(appendConfigList(SMALL.replace(/legacy_ids.*\n/, ''), ['legacy_ids'], ['A-1', 'B-2'])).toBe(
    SMALL.replace(/legacy_ids.*\n/, '') + 'legacy_ids: [A-1, B-2]\n',
  );
  // something that is not a list there is refused, as is a text that does not parse
  expect(appendConfigList(SMALL, ['profile'], ['A-1'])).toBeUndefined();
  expect(appendConfigList('a: [', ['legacy_ids'], ['A-1'])).toBeUndefined();
});

it('risk:parsing a text that does not parse is never rewritten (ST-LN-50 t2-ac-9)', () => {
  const broken = 'accord: "1.0.0"\nroles: [ba,\n';
  expect(setConfigValue(broken, ['git', 'merge'], 'rebase')).toBeUndefined();
  expect(unsetConfigValue(broken, ['git', 'merge'])).toBeUndefined();
  expect(setConfigValue('- a\n- b\n', ['git', 'merge'], 'rebase')).toBeUndefined();
  expect(setConfigValue('', ['git', 'merge'], 'rebase')).toBeUndefined();
});

it('risk:parsing a key path is resolved against the schema (ST-LN-50 t2-ac-9)', () => {
  expect(resolveKeyPath('git.merge')).toEqual(['git', 'merge']);
  expect(resolveKeyPath('profile')).toEqual(['profile']);
  expect(resolveKeyPath('git')).toEqual(['git']);
  expect(resolveKeyPath('ids.types.story')).toEqual(['ids', 'types', 'story']);
  expect(resolveKeyPath('legacy_ids')).toEqual(['legacy_ids']);
  // under a map keyed by pattern or by anything, the rest of the path is one key, dots and all
  expect(resolveKeyPath('people.dev@example.com')).toEqual(['people', 'dev@example.com']);
  expect(resolveKeyPath('people.first.last@example.com')).toEqual(['people', 'first.last@example.com']);
  expect(resolveKeyPath('sensitive.interface')).toEqual(['sensitive', 'interface']);
  expect(resolveKeyPath('models.executor')).toEqual(['models', 'executor']);
  expect(resolveKeyPath('models.executor.effort')).toEqual(['models', 'executor', 'effort']);
  expect(resolveKeyPath('models.reviewer.final.model')).toEqual(['models', 'reviewer.final', 'model']);
  // unknown keys, empty segments and a path below a scalar or a list are not keys
  for (const bad of ['nosuch.key', 'nosuch', 'git.nosuch', 'git.merge.deep', 'profile.x', 'legacy_ids.0', 'git.', '.git', 'git..merge', '', 'models.nosuch', 'models.executor.nosuch', '__proto__.x']) {
    expect(resolveKeyPath(bad), bad).toBeUndefined();
  }
});

it('risk:parsing a value that starts with [ or { is a YAML flow collection, any other value a string (ST-LN-50 t2-ac-9)', () => {
  expect(parseValue('[A-1, B-2]')).toEqual(['A-1', 'B-2']);
  expect(parseValue('{ model: sonnet, effort: high }')).toEqual({ model: 'sonnet', effort: 'high' });
  expect(parseValue('["a b", c]')).toEqual(['a b', 'c']);
  expect(parseValue('[]')).toEqual([]);
  // numerics stay strings (STACK Decision 2), inside a flow collection too
  expect(parseValue('14')).toBe('14');
  expect(parseValue('1e3')).toBe('1e3');
  expect(parseValue('true')).toBe('true');
  expect(parseValue('{ n: 0123 }')).toEqual({ n: '0123' });
  expect(parseValue('make sync [fast]')).toBe('make sync [fast]');
  expect(parseValue('')).toBe('');
  // a flow collection that does not parse throws rather than becoming a string
  expect(() => parseValue('[a, b')).toThrow(/flow|bracket|\]|parse/i);
});

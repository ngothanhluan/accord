// D-147 layer 1: the shipped examples under `examples/` are held to a passing verdict by the same
// `npm test` run that guards the fixtures, so an example that drifts below the gates — or a gate rule
// that moves under the example — goes red locally rather than at a reader's first attempt (T-07-29).
//
// No golden here, deliberately. A golden pins the exact finding list, which would have to be
// regenerated every time the example prose is improved, and would train whoever maintains it to
// regenerate rather than read. The claim is narrower and more durable: the verdict is `pass`, and no
// lint finding over the example is an error.
import { beforeAll, describe, expect, it } from 'vitest';
import { gateDone, gateReady, lintSnapshot, loadSnapshot } from '../src/index.js';
import type { Finding, GateResult, RepoSnapshot, SnapshotInput } from '../src/index.js';
import { deniedNames } from '../../../test/helpers/denied.js';
import { readDir } from './helpers/fixture.js';

interface Row {
  name: string;
  dir: string; // under `examples/`
  ticket: string;
}

// One row per example. Every case below is generated from this table, so a second profile is one row.
const CASES: Row[] = [
  { name: 'build', dir: 'build', ticket: 'SIGNUP-1' },
  { name: 'maintain', dir: 'maintain', ticket: 'EXPORT-1' },
];

// A-21: the examples carry the literal short sha `1234567`, which is this commit's abbreviation — the
// same constant `gate.test.ts:26` uses. A file on disk cannot carry host facts, so `git` is spread onto
// the SnapshotInput here exactly as `gate.test.ts:113` does.
const COMMIT = '1234567890abcdef1234567890abcdef12345678';
const DEV = 'dev@example.test';
const REVIEWER = 'reviewer@example.test';
// Derived from the row, never written as a path literal, so a second row needs no edit here.
const gitFor = (row: Row) => ({
  commit: COMMIT,
  authors: { [COMMIT]: DEV, ['accord/tickets/' + row.ticket + '/verification.md']: REVIEWER },
});

/** The findings themselves in the assertion message, so a RED names the rule rather than only the verdict. */
const why = (result: GateResult): string =>
  `${result.gate} on ${result.ticket}:\n` +
  result.findings.map((f) => `  ${f.level} ${f.rule} ${f.file}${f.line === undefined ? '' : ':' + f.line} | ${f.reason}`).join('\n');

const errorsIn = (findings: readonly Finding[]): Finding[] => findings.filter((f) => f.level === 'error');

for (const row of CASES) {
  describe('example ' + row.name, () => {
    let input: SnapshotInput;
    let snapshot: RepoSnapshot;
    // Read inside the hook, never at collection time, so a `-t` filter never walks the other example.
    beforeAll(() => {
      // `test/` -> `core/` -> `packages/` -> the repository root, where D-145 puts `examples/`.
      input = readDir(new URL('../../../examples/' + row.dir + '/', import.meta.url));
      snapshot = loadSnapshot({ ...input, git: gitFor(row) });
    });

    // Guard the guard, before any gate runs: a deleted or emptied example must fail here, with a
    // message naming what is missing, rather than later as an unreadable `gate.ticket-unknown` verdict.
    it('was read, and holds a config and the ticket the table names', () => {
      expect(input.tree.length, 'examples/' + row.dir + ' read as an empty directory').toBeGreaterThan(0);
      expect(input.tree).toContain('accord/config.yml');
      expect(input.tree).toContain('accord/tickets/' + row.ticket + '.md');
    });

    it('passes gate ready', () => {
      const result = gateReady(snapshot, row.ticket);
      expect(result.verdict, why(result)).toBe('pass');
    });

    it('passes gate done', () => {
      const result = gateDone(snapshot, row.ticket);
      expect(result.verdict, why(result)).toBe('pass');
    });

    it('carries no error-level lint finding', () => {
      const errors = errorsIn(lintSnapshot(snapshot).findings);
      expect(errors.map((f) => `${f.level} ${f.rule} ${f.file} | ${f.reason}`)).toEqual([]);
    });

    it('reports every path forward-slash, on any host (D-51)', () => {
      const paths = lintSnapshot(snapshot).findings.map((f) => f.file);
      expect(paths.filter((p) => p.includes('\\'))).toEqual([]);
      expect(input.tree.filter((p) => p.includes('\\'))).toEqual([]);
    });

    // The example prose is a shipped text surface like any other, so it reads the one list rather than
    // declaring a second one (the CLAUDE.md "no other tools named" constraint).
    it('names no other tool, plugin, harness, or planning system', () => {
      expect(deniedNames(Object.entries(input.files).map(([path, text]) => ({ path, text })))).toEqual([]);
    });
  });
}

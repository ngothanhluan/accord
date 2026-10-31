// Spec §10: changed paths that no task of the plan declares.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, undeclaredFiles } from '../src/index.js';
import type { BranchFact } from '../src/model/snapshot.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const snap = (plan?: string) => {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    ...(plan === undefined ? {} : { 'accord/tickets/T-1/plan.md': plan }),
  };
  return loadSnapshot({ files, tree: Object.keys(files).sort() });
};
const CHANGED = ['src/export.ts', 'src/extra.ts', 'docs/x.md', 'accord/tickets/T-1.md', 'accord/tickets/T-1/ledger.md'];

describe('undeclaredFiles', () => {
  it('lists changed paths no task names, sorted, without the ticket records', () => {
    expect(undeclaredFiles(snap(PLAN), 'T-1', CHANGED)).toEqual(['docs/x.md', 'src/extra.ts']);
  });

  it('a directory token declares what it contains; a (new) path is declared', () => {
    expect(undeclaredFiles(snap(PLAN.replace(/files: src\/export.ts/g, 'files: src/')), 'T-1', CHANGED)).toEqual(['docs/x.md']);
    expect(undeclaredFiles(snap(PLAN.replace('files: src/export.ts', 'files: src/extra.ts (new)')), 'T-1', ['src/extra.ts'])).toEqual([]);
  });

  it('is undefined for a ticket without a plan', () => {
    expect(undeclaredFiles(snap(), 'T-1', CHANGED)).toBeUndefined();
  });
});

it('risk:complex-branching undeclared files leave out a listed research record the branch adds and keep a changed or non markdown one', () => {
  const NEW = 'accord/research/2026-10-30-new.md';
  const OLD = 'accord/research/2026-10-29-old.md';
  const TS = 'accord/research/2026-10-30-x.test.ts';
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ['research: ["' + NEW + '", "' + OLD + '", "' + TS + '"]'] }),
    'accord/tickets/T-1/plan.md': PLAN,
  };
  const load = (branchFacts?: Record<string, BranchFact>) =>
    loadSnapshot({ files, tree: Object.keys(files).sort(), ...(branchFacts === undefined ? {} : { branchFacts }) });
  const facts: Record<string, BranchFact> = {
    'T-1': {
      base: 'b'.repeat(40),
      changes: [
        { path: NEW, kind: 'added', lines: 5 },
        { path: OLD, kind: 'modified', lines: 2 },
        { path: TS, kind: 'added', lines: 4 },
      ],
      synced: [],
    },
  };
  const changed = [NEW, OLD, TS, 'src/export.ts'];
  expect(undeclaredFiles(load(facts), 'T-1', changed)).toEqual([OLD, TS]);
  expect(undeclaredFiles(load(), 'T-1', changed)).toEqual([OLD, NEW, TS]);
});

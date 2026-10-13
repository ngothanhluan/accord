// Spec §10: changed paths that no task of the plan declares.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, undeclaredFiles } from '../src/index.js';
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

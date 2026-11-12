// ST-LN-91 91d-ac-1: `accord gate ready` on real git reads the cut-off pin at the ticket's claim commit (D-15).
import { expect, it } from 'vitest';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

interface Found { rule: string; level: string; reason?: string; file?: string }
const findings = async (repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['gate', 'ready', 'T-1', '--json'], repo);
  return { code: r.code, found: JSON.parse(r.out).findings as Found[] };
};
const missing = (all: Found[]): Found[] => all.filter((f) => f.rule === 'gate.discuss-missing');
// The pin the rule reads is the one at the claim commit, so the CONFIG pin of the running CLI (the running version) never decides.
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

it('risk:complex-branching accord gate ready reads the claim pin from git (ST-LN-91 91d-ac-1)', async () => {
  // (a) the claim commit holds the cut-off pin; HEAD holds the running version's pin, so the CLI's own pin check passes.
  const a = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    await run(['approve', 'T-1'], a);
    writeFiles(a, { 'accord/config.yml': pinned('0.4.1') });
    commitMsg(a, 'claim: T-1');
    // A file too: at a release CONFIG equals the cut-off pin, and a commit that restores it alone would be empty.
    writeFiles(a, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
    commitAll(a);
    const got = await findings(a);
    expect(got.code).toBe(1);
    const f = missing(got.found);
    expect(f).toHaveLength(1);
    expect(f[0].file).toBe('accord/tickets/T-1/discuss.md');
  } finally {
    cleanup(a);
  }

  // (b) the claim commit holds 0.4.0: the ticket was claimed under the old rules, whatever HEAD pins now.
  const b = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    await run(['approve', 'T-1'], b);
    writeFiles(b, { 'accord/config.yml': pinned('0.4.0') });
    commitMsg(b, 'claim: T-1');
    // HEAD holds the running version's pin, so the CLI's own pin check passes whatever release runs the test.
    writeFiles(b, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
    commitAll(b);
    expect(missing((await findings(b)).found)).toEqual([]);
  } finally {
    cleanup(b);
  }
});

it('risk:complex-branching gate ready falls back to the commit that added the ticket when there is no claim commit (ST-LN-91 91d-ac-1)', async () => {
  // (a) no `claim:` commit: the commit that added the ticket holds the cut-off pin; HEAD holds the running version's pin.
  const a = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    await run(['approve', 'T-1'], a);
    writeFiles(a, { 'accord/config.yml': pinned('0.4.1') });
    commitAll(a, 'add T-1');
    writeFiles(a, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
    commitAll(a);
    const got = await findings(a);
    expect(got.code).toBe(1);
    expect(missing(got.found)).toHaveLength(1);
  } finally {
    cleanup(a);
  }

  // (b) main's tip holds the cut-off pin; a branch from it lowers the pin in its claim commit: caught through the merge base.
  const b = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    await run(['approve', 'T-1'], b);
    writeFiles(b, { 'accord/config.yml': pinned('0.4.1') });
    commitAll(b, 'add T-1');
    gitRun(b, 'branch', '-M', 'main');
    gitRun(b, 'switch', '-q', '-c', 't/T-1');
    writeFiles(b, { 'accord/config.yml': pinned('0.4.0') });
    commitMsg(b, 'claim: T-1');
    writeFiles(b, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
    commitAll(b);
    expect(missing((await findings(b)).found)).toHaveLength(1);
  } finally {
    cleanup(b);
  }
});

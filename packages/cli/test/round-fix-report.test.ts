// Phase 8.5 D-19, R-6, R-10, R-11 (8.5-ac-7): `accord round` refuses a review fix recorded `fixed in <sha>` with a `checked:` mark when no executor fix report under
// `.accord-reports/<id>/` lists those places, for a ticket claimed at or after 0.13.0 outside lane S. Real files and real git; the CLI runs as 0.13.0 so HEAD's pin can be 0.13.0 while
// a ticket was claimed under 0.12.2.
import { mkdirSync, symlinkSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { LANE_S_BODY, laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.13.0' } };
});

const REVIEW = 'accord/tickets/T-1/review.md';
const FOLDER = '.accord-reports/T-1';
const LINE = 'places checked: 1: src/a.ts:3\n';

/** A ticket claimed under `claimPin`, one code commit and a fix commit, review.md round 1 with finding 1.1 `fixed in <the fix commit> — checked: src/a.ts:3`. */
function fixed(claimPin: string, o: { lane?: 'S' } = {}): string {
  const ticket = o.lane === 'S' ? laneTicket('T-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }) : laneTicket('T-1');
  const klass = o.lane === 'S' ? '' : ' [patch]';
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin), 'accord/tickets/T-1.md': ticket });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  // the pin back to the running version in a commit of its own, so the round's package (from the next commit on) holds no config change
  writeFiles(repo, { 'accord/config.yml': pinned('0.13.0') });
  const base = commitMsg(repo, 'pin', undefined, true);
  writeFiles(repo, {
    'src/a.ts': 'export const a = 1;\n',
    ...(o.lane === 'S' ? {} : { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) }),
  });
  const code = commitMsg(repo, 'code');
  writeFiles(repo, { 'src/a.ts': 'export const a = 2;\n' });
  const fix = commitMsg(repo, 'the fix');
  writeFiles(repo, { [REVIEW]: `Round record: 2\n\n## Round 1 head ${code}\n\nMust 1${klass}: the export drops a row — src/a.ts:1 — fixed in ${fix} — checked: src/a.ts:3\n\nSecurity: no pattern matched\n` });
  commitMsg(repo, 'T-1 round 1');
  return repo;
}

const report = (repo: string, name: string, text: string): void => {
  mkdirSync(join(repo, FOLDER), { recursive: true });
  writeFileSync(join(repo, FOLDER, name), text);
};

it('risk:regression accord round refuses a fix with no executor fix report and passes with one (8.5-ac-7 D-19 R-6)', async () => {
  const repo = fixed('0.13.0');
  try {
    const refused = await run(['round', 'T-1'], repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('refused:');
    expect(refused.out).toContain('finding 1');
    expect(refused.out).toContain('accord brief T-1 --fix');

    // a report whose line names other places is no cover
    report(repo, 'fix-1.md', 'places checked: 1: src/other.ts:9\n');
    expect((await run(['round', 'T-1'], repo)).code).toBe(1);

    // a later fix report holding the line covers it, the earlier one stays
    report(repo, 'fix-2.md', 'DONE\n' + LINE);
    const next = await run(['round', 'T-1'], repo);
    expect(next.out).toContain('Round: 2 of');
    expect(next.code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a ticket claimed before the cut-off and a lane S ticket are never refused for a fix report (8.5-ac-7 D-19 R-11)', async () => {
  const older = fixed('0.12.2');
  try {
    const r = await run(['round', 'T-1'], older);
    expect(r.out).not.toContain('accord brief');
    expect(r.out).toContain('Round: 2 of');
  } finally {
    cleanup(older);
  }
  const laneS = fixed('0.13.0', { lane: 'S' });
  try {
    const r = await run(['round', 'T-1'], laneS);
    expect(r.out).not.toContain('accord brief');
  } finally {
    cleanup(laneS);
  }
}, 120_000);

it('risk:security the fix report read follows no link and is bounded (8.5-ac-7 D-19)', async () => {
  const repo = fixed('0.13.0');
  try {
    // a folder named like a report is no report
    mkdirSync(join(repo, FOLDER, 'fix-1.md'), { recursive: true });
    expect((await run(['round', 'T-1'], repo)).out).toContain('refused:');
  } finally {
    cleanup(repo);
  }

  const big = fixed('0.13.0');
  try {
    // one byte over 64 KiB is not read, however good its first line is
    report(big, 'fix-1.md', LINE + 'x'.repeat(65536 + 1 - LINE.length));
    const r = await run(['round', 'T-1'], big);
    expect(r.code).toBe(1);
    expect(r.out).toContain('accord brief T-1 --fix');
    // exactly 64 KiB is read
    report(big, 'fix-1.md', LINE + 'x'.repeat(65536 - LINE.length));
    expect((await run(['round', 'T-1'], big)).code).toBe(0);
  } finally {
    cleanup(big);
  }
}, 120_000);

it.skipIf(process.platform === 'win32')('risk:security a linked fix report and a linked report folder read as no report (8.5-ac-7 D-19)', async () => {
  const repo = fixed('0.13.0');
  const target = fixed('0.13.0');
  try {
    mkdirSync(join(target, FOLDER), { recursive: true });
    writeFileSync(join(target, FOLDER, 'real.md'), LINE);
    mkdirSync(join(repo, FOLDER), { recursive: true });
    symlinkSync(join(target, FOLDER, 'real.md'), join(repo, FOLDER, 'fix-1.md'));
    expect((await run(['round', 'T-1'], repo)).out).toContain('refused:');

    cleanup(repo);
    const again = fixed('0.13.0');
    try {
      mkdirSync(join(again, '.accord-reports'), { recursive: true });
      writeFileSync(join(target, FOLDER, 'fix-1.md'), LINE);
      symlinkSync(join(target, FOLDER), join(again, FOLDER));
      expect((await run(['round', 'T-1'], again)).out).toContain('refused:');
    } finally {
      cleanup(again);
    }
  } finally {
    cleanup(target);
  }
}, 120_000);

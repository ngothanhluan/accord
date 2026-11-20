// Phase 8.1 G4b (D-17, 8.1-ac-13): `accord gate done` refuses a slop hit of the ticket's cumulative diff that is neither fixed nor justified in the last `## Round` of review.md. Real git in tmp
// sandboxes; nothing here reaches the real origin.
import { afterEach, expect, it } from 'vitest';
import { SLOP_FROM } from '@accord-dev/accord-core';
import { claimedUnder, cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const RULE = 'gate.slop-unresolved';
const REVIEW = 'accord/tickets/T-1/review.md';
const BASE = 'export const a = 1;\n';
const SLOPPY = 'export const a = 1;\nexport function f() {\n  try { x(); } catch {}\n}\n';
const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', ...lines].join('\n')}\n`;

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/**
 * A lane M ticket T-1 on its own branch, claimed under `pin`: the base commit is on the default ref, the claim commit starts the branch, the plan's baseline is the base, `code` is committed on
 * top, then (`fix`, when given) a later commit, and review.md, headed by the last code commit, is committed last.
 */
function ticket(o: { pin?: string; code?: Record<string, string>; fix?: Record<string, string>; config?: string; review?: (head: string) => string; extra?: Record<string, string> }): { repo: string; head: string } {
  const repo = makeEmptyRepo();
  repos.push(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, { 'accord/config.yml': o.config ?? CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/a.ts': BASE, ...o.extra });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  claimedUnder(repo, o.pin ?? SLOP_FROM);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), 'src/a.ts': SLOPPY, ...o.code });
  let head = commitMsg(repo, 'code');
  if (o.fix !== undefined) {
    writeFiles(repo, o.fix);
    head = commitMsg(repo, 'fix');
  }
  writeFiles(repo, { [REVIEW]: (o.review ?? ((h) => record(h)))(head) });
  commitMsg(repo, 'round 1');
  return { repo, head };
}

interface Found { rule: string; level: string; file?: string; line?: number; reason: string }
async function slop(repo: string): Promise<Found[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === RULE);
}

it('risk:complex-branching gate done refuses an unresolved slop hit and passes once it is justified (8.1-ac-13)', async () => {
  const t = ticket({});
  const refused = await slop(t.repo);
  expect(refused).toHaveLength(1);
  expect(refused[0]).toMatchObject({ level: 'error', file: REVIEW });
  // the refusal prints the line to write, with the hit's current kind, path and line
  expect(refused[0].reason).toContain('slop:empty-catch src/a.ts:3 is neither fixed nor justified');
  expect(refused[0].reason).toContain('"slop:empty-catch src/a.ts:3 — <reason>"');
  // two runs on the same commit print the same bytes
  const first = await run(['gate', 'done', 'T-1', '--json'], t.repo);
  expect((await run(['gate', 'done', 'T-1', '--json'], t.repo)).out).toBe(first.out);

  // the last round names the hit; a list marker is allowed
  writeFiles(t.repo, { [REVIEW]: record(t.head, '- slop:empty-catch src/a.ts:3 — the error is logged by the caller') });
  commitMsg(t.repo, 'slop justified');
  expect(await slop(t.repo)).toEqual([]);
}, 180_000);

it('risk:regression a fixed slop hit needs no line and an old ticket is not affected (8.1-ac-13)', async () => {
  // a later commit removes the empty catch before the final round: the hit is gone from the cumulative diff
  const fixed = ticket({ fix: { 'src/a.ts': 'export const a = 1;\nexport function f() {\n  x();\n}\n' } });
  expect(await slop(fixed.repo)).toEqual([]);

  // the same unresolved hit under a ticket claimed before the cut-off: no finding
  const old = ticket({ pin: '0.8.0' });
  expect(await slop(old.repo)).toEqual([]);
}, 180_000);

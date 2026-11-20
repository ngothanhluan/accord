// Phase 8.1 G4a (D-14, D-15, D-20): `accord review-package` prints `## Slop`, the hits of the ticket's cumulative diff, one `slop:<kind> <path>:<line>` each.
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

function identity(repo: string): void {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
}

/** The `## Slop` section of a package, heading included. */
const slopSection = (out: string): string => {
  const at = out.indexOf('## Slop');
  const next = out.indexOf('\n## ', at + 1);
  return at < 0 ? '' : out.slice(at, next < 0 ? undefined : next).trimEnd();
};

/** A lane M ticket T-1 on its own branch, the plan's baseline the commit before the plan; `code` is committed on top of the plan. */
function ticketRepo(base: Record<string, string>, code: Record<string, string>): string {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), ...base });
    const baseSha = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', baseSha) });
    commitMsg(repo, 'plan');
    writeFiles(repo, code);
    commitMsg(repo, 'code');
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

it('risk:complex-branching review-package lists a slop hit with its file and line (8.1-ac-12)', async () => {
  const repo = ticketRepo({ 'src/a.ts': 'export const a = 1;\n' }, { 'src/a.ts': 'export const a = 1;\nexport function f() {\n  try { x(); } catch {}\n}\n' });
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(out.code).toBe(0);
    const section = slopSection(out.out);
    expect(section).toMatch(/^## Slop\n\n- slop:empty-catch src\/a\.ts:3 — \S/);
    expect(out.out.indexOf('## Slop')).toBeGreaterThan(out.out.indexOf('## Security triggers'));
    expect(out.out.indexOf('## Slop')).toBeLessThan(out.out.indexOf('## Stat'));
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching review-package prints none when no pattern matched (8.1-ac-12)', async () => {
  const repo = ticketRepo({ 'src/a.ts': 'export const a = 1;\n' }, { 'src/a.ts': 'export const a = 2;\n' });
  try {
    const out = await run(['review-package', 'T-1'], repo);
    expect(out.err).toBe('');
    expect(slopSection(out.out)).toBe('## Slop\n\n(none: no pattern matched)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

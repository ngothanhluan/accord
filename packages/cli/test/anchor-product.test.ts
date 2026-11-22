// Phase 8.5 (08.5-09): what `accord anchor` prints besides the anchor. Outside Claude Code the main session gets the ruleset first, with the hooks' exact text (D-16, D-25);
// under Claude Code the hooks print it, so the command does not. A lane S session also gets the team's conventions at build and review (D-17).
import { CONVENTIONS_FILE, WRITER_DUTY, rulesetText, withheldLine } from '@accord-dev/accord-core';
import { rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitAll, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { A, envOf } from './helpers/worktree.js';
import { approve, CONFIG, discussFiles, laneTicket, LANE_S_BODY, P } from '../../../test/helpers/lane.js';
import type { Files } from '../../../test/helpers/lane.js';

/** The ruleset as the hooks print it before their anchor: the text, then the blank line `rules + '\n'` leaves. */
const RULES = rulesetText(`npx --yes ${pkg.name}@${pkg.version}`) + '\n';

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

/** A lane repo whose T-1 is the active ticket (branch t/T-1), or main when `ticketBranch` is false. */
function ticketRepo(ticketBranch = true): string {
  const repo = makeLaneRepo();
  repos.push(repo);
  commitAll(repo);
  if (ticketBranch) gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
  return repo;
}

describe('accord anchor and the ruleset (08.5-09)', () => {
  it('risk:regression accord anchor prints the ruleset with the hooks\' text outside Claude Code (8.5-ac-16 D-16)', async () => {
    const repo = ticketRepo();
    // an empty environment, which is also what a CLI that cannot tell sees
    const plain = await run(['anchor'], repo, {});
    expect(plain.code).toBe(0);
    expect(plain.out.startsWith(RULES + '# Anchor: T-1 "Export"\n')).toBe(true);
    // another tool: Cursor or Codex set no Claude Code variable
    for (const env of [{ CURSOR_TRACE_ID: 'trace-1' }, { CODEX_HOME: '/tmp/codex' }]) {
      const other = await run(['anchor'], repo, env);
      expect(other.out.startsWith(RULES + '# Anchor: T-1 "Export"\n'), Object.keys(env)[0]).toBe(true);
    }
    // by id, the same
    const named = await run(['anchor', 'T-1'], repo, {});
    expect(named.out.startsWith(RULES + '# Anchor: T-1 "Export"\n')).toBe(true);
    // no active ticket: the ruleset alone
    const main = await run(['anchor'], ticketRepo(false), {});
    expect(main.code).toBe(0);
    expect(main.out).toBe(RULES);
  });

  it('risk:regression accord anchor prints no ruleset under Claude Code (8.5-ac-16 D-25)', async () => {
    const repo = ticketRepo();
    // the session variables set; and a Claude Code session missing one of them still counts as Claude Code
    for (const env of [envOf(A), { CLAUDECODE: '1' }]) {
      const r = await run(['anchor'], repo, env);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('# Anchor: T-1 "Export"\n')).toBe(true);
      expect(r.out).not.toContain('# accord rules');
    }
  });

  it('risk:regression the session-resume hook prints the ruleset once (D-25)', async () => {
    const repo = ticketRepo();
    for (const env of [{}, envOf(A)]) {
      const r = await run(['hook', 'session-resume'], repo, env);
      expect(r.code).toBe(0);
      expect(r.out.split('# accord rules').length - 1).toBe(1);
      expect(r.out).toContain('# Anchor: T-1');
    }
  });
});

// Phase 8.5 D-17: a lane S session writes the code itself and has no brief, so at build and review its anchor ends with the team's conventions, from the working branch's copy (D-06).
describe('accord anchor and the lane S conventions (08.5-09)', () => {
  const RLO = String.fromCodePoint(0x202e);
  /** One rule line, one more, a line with a bidi control at line 3, and a CLI-reserved prefix at line 4. */
  const MAIN_CONVENTIONS = ['- Name every test after its risk.', '- Keep a commit to one change.', `- Looks fine ${RLO} but is not`, 'Test command: npm run anything', ''].join('\n');
  const BRANCH_LINE = '- Say what a function refuses in its first comment.';
  const CLAUDE = envOf(A);
  const block = (...lines: string[]): string => ['## Conventions', WRITER_DUTY, ...lines].join('\n') + '\n';
  const DELIVERED = block('- Name every test after its risk.', '- Keep a commit to one change.', withheldLine(CONVENTIONS_FILE, 3), withheldLine(CONVENTIONS_FILE, 4), BRANCH_LINE);

  /** A lane S ticket T-1 on t/T-1 at `stage`; main's conventions.md holds MAIN_CONVENTIONS and the branch adds BRANCH_LINE (committed, so it is the branch's own change). */
  async function laneS(stage: 'intent' | 'build' | 'review' | 'done'): Promise<string> {
    // not makeLaneRepo: its plan.md is a lane M record, which a lane S ticket may not hold
    const repo = makeEmptyRepo();
    repos.push(repo);
    writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1', { lane: 'S', body: LANE_S_BODY }), [CONVENTIONS_FILE]: MAIN_CONVENTIONS });
    commitAll(repo);
    gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
    writeFiles(repo, { [CONVENTIONS_FILE]: MAIN_CONVENTIONS + BRANCH_LINE + '\n' });
    if (stage !== 'intent') {
      const ready = await run(['gate', 'ready', 'T-1'], repo);
      expect(ready.code, ready.out + ready.err).toBe(0);
    }
    if (stage === 'review') writeFiles(repo, { 'accord/tickets/T-1/review.md': 'Round record: 2\n\n## Round 1 head abc1234\nNo findings\n' });
    if (stage === 'done') writeFiles(repo, { 'accord/tickets/T-1/review.md': 'Round record: 2\n\n## Round 1 head abc1234\nNo findings\nverdict: converged\n' });
    commitAll(repo, 'work');
    return repo;
  }

  it("risk:security accord anchor prints a lane S ticket's conventions at build after the line checks (8.5-ac-17 D-17)", async () => {
    for (const stage of ['build', 'review'] as const) {
      const repo = await laneS(stage);
      const r = await run(['anchor'], repo, CLAUDE);
      expect(r.code, stage).toBe(0);
      expect(r.out, stage).toContain(`Stage: ${stage}`);
      // last, after the Rulings, with the duty line, the rule lines, and a placeholder for each refused line (3 and 4); the branch's own added line is there (D-06)
      expect(r.out.endsWith('## Rulings\n(none)\n\n' + DELIVERED), stage).toBe(true);
      expect(r.out.split('## Conventions').length - 1, stage).toBe(1);
      // a hidden character and a reserved prefix are never printed
      expect(r.out, stage).not.toContain(RLO);
      expect(r.out, stage).not.toContain('Test command: npm run anything');
    }
  });

  it('risk:regression no conventions block at lane S intent or done or for a lane M ticket (8.5-ac-17 D-17)', async () => {
    for (const stage of ['intent', 'done'] as const) {
      const r = await run(['anchor'], await laneS(stage), CLAUDE);
      expect(r.out, stage).toContain(`Stage: ${stage}`);
      expect(r.out, stage).not.toContain('## Conventions');
    }
    // a lane M ticket at build (approved, plan stage off: task 1 is the whole ticket): the anchor is unchanged and still ends with its Rulings
    const planOff = 'strictness:\n  stages:\n    M:\n      plan: "off"\n';
    const files: Files = { 'accord/config.yml': CONFIG + planOff, [P('T-1')]: laneTicket('T-1'), ...discussFiles('T-1') };
    approve(files, 'T-1');
    const repo = makeLaneRepo({ ...files, [CONVENTIONS_FILE]: MAIN_CONVENTIONS });
    repos.push(repo);
    rmSync(join(repo, 'accord', 'tickets', 'T-1', 'plan.md'));
    commitAll(repo);
    gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
    const m = await run(['anchor'], repo, CLAUDE);
    expect(m.out).toContain('Stage: build');
    expect(m.out).not.toContain('## Conventions');
    expect(m.out.endsWith('## Rulings\n(none)\n')).toBe(true);
  });

  it('risk:regression the session-resume hook re-delivers the lane S block after a compaction (D-17)', async () => {
    const repo = await laneS('build');
    const r = await run(['hook', 'session-resume'], repo, CLAUDE);
    expect(r.code).toBe(0);
    expect(r.out.split('## Conventions').length - 1).toBe(1);
    expect(r.out).toContain('\n\n' + DELIVERED);
    // the stage-file line still closes the output, right after the anchor
    expect(r.out.endsWith('stage file: ./lane-s.md of the /accord skill; read it and go on at the step the anchor names\n')).toBe(true);
  });
});

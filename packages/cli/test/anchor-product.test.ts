// Phase 8.5 (08.5-09): what `accord anchor` prints besides the anchor. Outside Claude Code the main session gets the ruleset first, with the hooks' exact text (D-16, D-25);
// under Claude Code the hooks print it, so the command does not. A lane S session also gets the team's conventions at build and review (D-17).
import { rulesetText } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitAll, gitRun, makeLaneRepo, run } from './helpers/repo.js';
import { A, envOf } from './helpers/worktree.js';

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

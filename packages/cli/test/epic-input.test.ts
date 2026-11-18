// ST-LN-28 D-13: the epic's Vetoes and Decisions reach a story's anchor and the SubagentStart hook, built by the CLI from the default branch.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';

const VETOES = ['- No new dependency.', '- No emoji.'];
const D1 = '- D-01 One cart — "one cart per user"';
const D2 = '- D-02 Guest checkout stays — "guests must be able to pay"';

function epic(id: string, decisions: string[]): string {
  const body = ['## Intent', 'Group the checkout stories.', '', '## Vetoes', ...VETOES, '', '## Decisions', ...decisions, '', '## Corrections', ''].join('\n');
  return laneTicket(id, { lane: 'L', body }).replace('type: story', 'type: epic').replace('title: "Export"', 'title: "Checkout epic"');
}
const BLOCK = (decisions: string[]): string => ['## Epic E-1 "Checkout epic"', '### Vetoes', ...VETOES, '### Decisions', ...decisions, '### Epic lessons', '(none)'].join('\n');

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

/**
 * E-1 holds both Decisions on the default branch; S-1 (parent E-1) is on its own branch t/S-1, whose working tree holds an older E-1 with one Decision.
 * No origin: the default ref is the local main (or master) branch.
 */
function storyRepo(): string {
  const repo = makeLaneRepo({ 'accord/tickets/E-1.md': epic('E-1', [D1, D2]), 'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "E-1"'] }) });
  repos.push(repo);
  commitAll(repo, 'main');
  gitRun(repo, 'checkout', '-q', '-b', 't/S-1');
  writeFiles(repo, { 'accord/tickets/E-1.md': epic('E-1', [D1]) });
  commitAll(repo, 'older epic copy on the story branch');
  return repo;
}

describe('accord anchor and the epic', () => {
  it('ac-8 accord anchor prints a story\'s epic rules (ST-LN-28 7-ac-8)', async () => {
    const repo = storyRepo();
    // on the story's branch: the epic block, from the default branch's copy, after Corrections and before Research and Rulings
    const here = await run(['anchor'], repo);
    expect(here.code).toBe(0);
    expect(here.out).toContain('# Anchor: S-1');
    expect(here.out).toContain('## Corrections\n(none)\n\n' + BLOCK([D1, D2]) + '\n\n## Rulings\n(none)\n');
    // by id from the same checkout
    const named = await run(['anchor', 'S-1'], repo);
    expect(named.out).toBe(here.out);
    // a ticket without parent: the anchor is unchanged
    const plain = await run(['anchor', 'T-1'], repo);
    expect(plain.code).toBe(0);
    expect(plain.out).not.toContain('Epic');
    expect(plain.out.endsWith('## Corrections\n(none)\n\n## Rulings\n(none)\n')).toBe(true);
  });

  it('ac-8 a story whose parent is no epic gets one line in its anchor (ST-LN-28 7-ac-8)', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "T-1"'] }) });
    repos.push(repo);
    commitAll(repo, 'main');
    const r = await run(['anchor', 'S-1'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toContain('\n\nparent T-1 is not an epic in this clone\n\n## Rulings');
    expect(r.out).not.toContain('### Vetoes');
  });
});

/**
 * The group-6 story as a linked worktree: E-1 holds both Decisions on main; the worktree of S-1 (branch t/S-1) holds an older E-1 with one. T-1 has no parent and its own worktree.
 * `repo` is the main checkout, which stays on its default branch, as the hook is launched from there.
 */
function worktrees(): { repo: string; story: string; plain: string } {
  const repo = makeLaneRepo({ 'accord/tickets/E-1.md': epic('E-1', [D1, D2]), 'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "E-1"'] }) });
  repos.push(repo);
  commitAll(repo, 'main');
  const story = repo + '-s-1';
  const plain = repo + '-t-1';
  repos.push(story, plain);
  gitRun(repo, 'worktree', 'add', '-q', '-b', 't/S-1', story);
  gitRun(repo, 'worktree', 'add', '-q', '-b', 't/T-1', plain);
  writeFiles(story, { 'accord/tickets/E-1.md': epic('E-1', [D1]) });
  commitAll(story, 'older epic copy on the story branch');
  return { repo, story, plain };
}

/** `accord hook subagent-start` launched in `repo` for the subagent `agent` working in `cwd`; the additionalContext it prints. */
async function contextOf(repo: string, input: string): Promise<{ context: string; err: string }> {
  const r = await run(['hook', 'subagent-start'], repo, {}, input);
  expect(r.code).toBe(0);
  const out = JSON.parse(r.out) as { hookSpecificOutput: { hookEventName: string; additionalContext: string } };
  expect(out.hookSpecificOutput.hookEventName).toBe('SubagentStart');
  return { context: out.hookSpecificOutput.additionalContext, err: r.err };
}
const asked = (agent: string, cwd: string): string => JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: agent, cwd });

describe('accord hook subagent-start and the epic', () => {
  it('ac-8 the scout planner critic and reviewer of a story receive its epic rules (ST-LN-28 7-ac-8)', async () => {
    const { repo, story, plain } = worktrees();
    const alone = (await contextOf(repo, '')).context;
    expect(alone.startsWith('# accord rules')).toBe(true);
    expect(alone).not.toContain('## Epic');
    for (const agent of ['accord-scout', 'accord-planner', 'accord-critic', 'accord-reviewer', 'accord-final-reviewer']) {
      const { context, err } = await contextOf(repo, asked(agent, story));
      expect(err).toBe('');
      // the ruleset first, then the epic block from the default branch's copy
      expect(context, agent).toBe([alone, BLOCK([D1, D2])].join('\n\n'));
    }
    // the other roles, a ticket with no parent, the main checkout and unreadable input keep the ruleset alone
    for (const agent of ['accord-executor', 'accord-auditor', 'accord-verifier', 'accord-debugger', 'accord-researcher']) {
      expect((await contextOf(repo, asked(agent, story))).context, agent).toBe(alone);
    }
    expect((await contextOf(repo, asked('accord-planner', plain))).context).toBe(alone);
    expect((await contextOf(repo, asked('accord-planner', repo))).context).toBe(alone);
    expect((await contextOf(repo, JSON.stringify({ cwd: story }))).context).toBe(alone);
    expect((await contextOf(repo, 'not json')).context).toBe(alone);
    // a folder git cannot read fails open to the ruleset, with one line on stderr
    const lost = await contextOf(repo, asked('accord-planner', repo + '-missing'));
    expect(lost.context).toBe(alone);
    expect(lost.err.trimEnd().split(/\r?\n/)).toHaveLength(1);
    expect(lost.err).toContain('accord hook subagent-start');
  });
});

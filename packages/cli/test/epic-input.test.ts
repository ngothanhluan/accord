// ST-LN-28 D-13: the epic's Vetoes and Decisions reach a story's anchor and the SubagentStart hook, built by the CLI from the default branch.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';
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
  it('risk:complex-branching accord anchor prints a story\'s epic rules (ST-LN-28 7-ac-8)', async () => {
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

  it('risk:complex-branching a story whose parent is no epic gets one line in its anchor (ST-LN-28 7-ac-8)', async () => {
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
  it('risk:complex-branching the scout planner critic and reviewer of a story receive its epic rules (ST-LN-28 7-ac-8)', async () => {
    const { repo, story, plain } = worktrees();
    const alone = (await contextOf(repo, '')).context;
    expect(alone.startsWith('# accord rules')).toBe(true);
    expect(alone).not.toContain('## Epic');
    for (const agent of ['accord-scout', 'accord-planner', 'accord-critic', 'accord-reviewer', 'accord-final-reviewer', 'accord-judge']) {
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

const ROLES = ['accord-scout', 'accord-planner', 'accord-critic', 'accord-reviewer', 'accord-final-reviewer', 'accord-judge'];
const L1 = '- Lesson: keep CSV columns stable — "keep the CSV columns stable"';
const L3A = '- Lesson: quote every field — "always quote"';
const L3B = '- Lesson: sort by id — "ids in order"';
const ledger = (lines: string[]): string => ['## Rulings', '(none)', '', '## Epic lessons', ...lines, ''].join('\n');
/** The block with its `### Epic lessons` part holding `lines`. */
const WITH_LESSONS = (lines: string[]): string => [...BLOCK([D1, D2]).split('\n').slice(0, -1), ...lines].join('\n');

describe('lessons across the stories of an epic', () => {
  it('risk:complex-branching a lesson from one story reaches its sibling once that story is on the default branch (ST-LN-28 7-ac-10)', async () => {
    const story = (id: string): string => laneTicket(id, { frontmatter: ['parent: "E-1"'] });
    const repo = makeLaneRepo({
      'accord/tickets/E-1.md': epic('E-1', [D1, D2]),
      'accord/tickets/S-1.md': story('S-1'),
      'accord/tickets/S-2.md': story('S-2'),
      'accord/tickets/S-3.md': story('S-3'),
    });
    repos.push(repo);
    commitAll(repo, 'main');
    const trunk = gitRun(repo, 'rev-parse', '--abbrev-ref', 'HEAD').trim();
    const second = repo + '-s-2';
    const first = repo + '-s-1';
    repos.push(second, first);
    gitRun(repo, 'worktree', 'add', '-q', '-b', 't/S-2', second);
    gitRun(repo, 'worktree', 'add', '-q', '-b', 't/S-1', first);
    // S-1 records its lesson in its own ledger, on its own branch: the only path that commit changes
    writeFiles(first, { 'accord/tickets/S-1/ledger.md': ledger([L1]) });
    commitAll(first, 'S-1 lesson');
    expect(gitRun(repo, 'diff', '--name-only', trunk + '...t/S-1').trim().split(/\r?\n/)).toEqual(['accord/tickets/S-1/ledger.md']);

    const contextOf = async (agent: string): Promise<string> => {
      const r = await run(['hook', 'subagent-start'], repo, {}, JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: agent, cwd: second }));
      expect(r.code).toBe(0);
      return (JSON.parse(r.out) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    };

    // before the merge: nothing under Epic lessons, in the anchor and in the hook context
    const before = await run(['anchor'], second);
    expect(before.out).toContain('\n\n' + WITH_LESSONS(['(none)']) + '\n\n## Rulings');
    expect((await contextOf('accord-planner')).endsWith(BLOCK([D1, D2]))).toBe(true);

    // S-1's branch is merged, and S-3, which reached the default branch with two lessons, joins it
    mergeMsg(repo, 't/S-1', 'merge S-1');
    writeFiles(repo, { 'accord/tickets/S-3/ledger.md': ledger([L3A, L3B]) });
    commitAll(repo, 'S-3 lessons');

    const lines = [`- S-1: ${L1}`, `- S-3: ${L3A}`, `- S-3: ${L3B}`];
    const after = await run(['anchor'], second);
    expect(after.code).toBe(0);
    expect(after.out).toContain('\n\n' + WITH_LESSONS(lines) + '\n\n## Rulings');
    for (const agent of ROLES) expect((await contextOf(agent)).endsWith(WITH_LESSONS(lines)), agent).toBe(true);
    // the other roles keep the ruleset alone; a ticket with no parent is unchanged
    expect((await contextOf('accord-executor')).includes('Epic lessons')).toBe(false);
    expect((await run(['anchor', 'T-1'], repo)).out).not.toContain('Epic lessons');
  });
});

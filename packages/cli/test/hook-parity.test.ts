// Phase 8.5 D-18, 8.5-ac-13: the SubagentStart hook (Claude Code, no skill step) and the CLI-written files every tool reads (`accord related <id> --for planner --out`) say the same ruleset and
// epic rules, because both are built from `rulesetText` and `epicBlock` by one core assembly (`subagentContext`, `productBlocks`). The hook's own bytes are unchanged; the CLI file wraps the
// same bodies with its duty lines.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { EPIC_DUTY, rulesetText } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';

const VETOES = ['- No new dependency.', '- No emoji.'];
const D1 = '- D-01 One cart — "one cart per user"';
const D2 = '- D-02 Guest checkout stays — "guests must be able to pay"';
const LESSON = '- Lesson: quote every field — "always quote"';
const epicTicket = laneTicket('E-1', { lane: 'L', body: ['## Intent', 'Group the checkout stories.', '', '## Vetoes', ...VETOES, '', '## Decisions', D1, D2, '', '## Corrections', ''].join('\n') })
  .replace('type: story', 'type: epic')
  .replace('title: "Export"', 'title: "Checkout epic"');
/** The epic block as `epicBlock` builds it for S-1: the epic's Vetoes and Decisions, and the lesson the merged sibling S-3 recorded. */
const EPIC = ['## Epic E-1 "Checkout epic"', '### Vetoes', ...VETOES, '### Decisions', D1, D2, '### Epic lessons', `- S-3: ${LESSON}`].join('\n');
/** The ruleset text with the invocation the hook prints, ending with its one newline. */
const RULES = rulesetText(`npx --yes ${pkg.name}@${pkg.version}`);

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

/** E-1 and the sibling story S-3 (with its Epic lesson) on main; story S-1 (parent E-1) in its own worktree on t/S-1. `repo` stays on main, where the hook is launched. */
function storyWorktree(): { repo: string; story: string } {
  const repo = makeLaneRepo({
    'accord/tickets/E-1.md': epicTicket,
    'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "E-1"'] }),
    'accord/tickets/S-3.md': laneTicket('S-3', { frontmatter: ['parent: "E-1"'] }),
    'accord/tickets/S-3/ledger.md': ['## Rulings', '(none)', '', '## Epic lessons', LESSON, ''].join('\n'),
  });
  repos.push(repo);
  commitAll(repo, 'main');
  const story = repo + '-s-1';
  repos.push(story);
  gitRun(repo, 'worktree', 'add', '-q', '-b', 't/S-1', story);
  writeFiles(story, { 'src/s1.ts': 'export const s1 = 1;\n' });
  commitAll(story, 'story work');
  return { repo, story };
}

describe('the hook and the CLI files carry one ruleset and one epic block (08.5-09)', () => {
  it('risk:regression the hook and the planner file carry the same ruleset and epic block from one function (8.5-ac-13 D-18)', async () => {
    const { repo, story } = storyWorktree();
    // the hook, launched in the main checkout for a planner working in the story's worktree
    const hook = await run(['hook', 'subagent-start'], repo, {}, JSON.stringify({ hook_event_name: 'SubagentStart', agent_type: 'accord-planner', cwd: story }));
    expect(hook.code).toBe(0);
    expect(hook.err).toBe('');
    const context = (JSON.parse(hook.out) as { hookSpecificOutput: { additionalContext: string } }).hookSpecificOutput.additionalContext;
    // the ruleset's own final newline, then two more: two blank lines before the block, the bytes epic-input.test.ts asserts as [alone, BLOCK].join('\n\n')
    expect(context).toBe(RULES + '\n\n' + EPIC);
    // the file every tool reads, written by the CLI
    const out = await run(['related', 'S-1', '--for', 'planner', '--out', 'planner-input.md'], story);
    expect(out.code, out.err).toBe(0);
    const path = /^file: (.+)\n$/.exec(out.out)?.[1];
    expect(path).toBeDefined();
    const file = readFileSync(path as string, 'utf8');
    // its first block is the ruleset without the trailing newline; the epic block follows unbroken with one newline and the duty line
    expect(file.startsWith(RULES.replace(/\n+$/, '') + '\n\n')).toBe(true);
    expect(file).toContain(EPIC + '\n' + EPIC_DUTY);
    const version = (text: string): string => text.split(pkg.version).join('<version>');
    await expect(['--- hook subagent-start, accord-planner ---', version(context), '--- accord related S-1 --for planner --out ---', version(file)].join('\n')).toMatchFileSnapshot('./__golden__/hook-parity.txt');
  });

  it('risk:regression one source builds both texts (D-18)', () => {
    const src = (name: string): string => readFileSync(fileURLToPath(new URL(`../src/commands/${name}`, import.meta.url)), 'utf8');
    const hook = src('hook.ts');
    const related = src('related.ts');
    expect(hook).toContain('subagentContext(');
    expect(hook).toContain('cliRuleset(');
    expect(related).toContain('productBlocks(');
    expect(related).toContain('cliRuleset(');
    // neither builds the ruleset or the joined epic block another way
    expect(hook).not.toContain('rulesetText(');
    expect(hook).not.toContain("'\\n\\n' + block");
    expect(related).not.toContain('rulesetText(');
  });
});

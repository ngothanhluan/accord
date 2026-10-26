// Spec §3 to §12: what each stage skill must name, asserted over the RENDERED SKILL.md a runtime loads. One
// row per stage; a stage whose definition is not authored yet has no row and renders nothing to check.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { agentTargets, installedName, skillDirs, skillTargets, STAGES } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config: AccordConfig = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude'],
};

const REQUIRED: Record<string, readonly string[]> = {
  accord: ['accord status --json', 'accord dashboard', 'accord new ticket', '--lane M', 'Understood:', 'Done when:', 'accord anchor', 'user.email', 'accord-debug', '## Resolved', 'accord-approach', 'last `## ` heading', '`done` → `accord-verify` at step 6', 'push it (the pushed branch is the claim)', 'claim: <id>', 'accord new ticket --type', './ids.md', './lane-s.md', '--lane S --worktree'],
  intent: ['accord anchor', 'accord-scout', 'accord-auditor', '0.2', '## Corrections', '## Open questions', 'D-01', 'accord-approach', 'top-level parts', 'smallest version', 'commit `accord/tickets/<id>.md`'],
  approach: ['accord anchor', 'accord-architect', 'accord-critic', '## Approach', 'accord approve', 'accord gate ready', 'accord-plan', 'ladder order', 'text only', 'not yet ruled out', 'three concrete failure scenarios', 'undone', 'back to step 3', 'Commit `accord/tickets/<id>.md`', 'Decisions, and Corrections as written', 'approved_hash:'],
  plan: ['accord anchor', 'accord-planner', 'baseline:', 'covers:', 'verify:', 'accord gate plan', 'plan_hash:', 'accord-critic', 'three revision rounds', 'fewest Must', 'tests.full', 'accord-build', 'plan: <id> ready', 'Only the first', '**Re-plan**', '`baseline:` never changes', 'highest existing number', 'step 7 does not re-run', 'since the last `plan: <id> ready`'],
  build: ['accord anchor', 'accord brief', 'accord-executor', 'tests.affected', 'accord task-done', 'BLOCKED: context', 'change note', 'accord approve', 'accord-plan', 'accord-review', 'plan: <id> ready', 'accord-debug', 'git status --porcelain'],
  review: ['accord anchor', 'accord review-package', 'accord-reviewer', 'accord-final-reviewer', 'Must', 'Should', 'Nice', 'patch', 'plan-gap', 'intent-gap', 'round 3', 'Undeclared files', 'five', 'fix_round_tier_up', 'verdict: converged', 'verdict: accepted-by-owner', 'accord-verify'],
  verify: ['accord anchor', 'tests.full', 'accord-verifier', 'verification.md', 'try this', 'cost if wrong', 'verified:', 'accord gate done'],
  debug: ['accord anchor', 'accord-debugger', 'debug.md', 'hypothes', 'measurement', 'cheapest probe', 'parallel', 'reproduction', 'three', '## Resolved', '## Episode <n>', 'last `## ` heading', 'its step 3 for the task that entered debug'],
};

const files = skillTargets(config);

describe('stage skills name what the spec requires', () => {
  for (const [stage, phrases] of Object.entries(REQUIRED)) {
    it(`${stage} names every required phrase`, () => {
      const text = files.find((f) => f.path === '.claude/skills/' + installedName(stage) + '/SKILL.md')?.text ?? '';
      expect(text.length, stage + '/SKILL.md is missing from the render output').toBeGreaterThan(0);
      expect(phrases.filter((p) => !text.includes(p))).toEqual([]);
    });
  }
});

it('ac-4 the plan skill asks the owner before it creates the tests baseline', () => {
  const read = (p: string) => files.find((f) => f.path === p)?.text ?? '';
  const skill = read('.claude/skills/accord-plan/SKILL.md');
  const ref = read('.claude/skills/accord-plan/baseline.md');
  expect(skill.length, 'accord-plan/SKILL.md is missing').toBeGreaterThan(0);
  expect(ref.length, 'accord-plan/baseline.md is missing').toBeGreaterThan(0);
  const from = skill.indexOf('7. **Baseline tests.**');
  const to = skill.indexOf('8. **Finish.**');
  expect(from).toBeGreaterThanOrEqual(0);
  expect(to).toBeGreaterThan(from);
  const step7 = skill.slice(from, to);
  expect(step7).toContain('./baseline.md');
  expect(step7).toContain('`accord/tests-baseline.txt`');
  const ask = 'ask the owner before running `accord tests baseline`';
  const decided = 'after the owner has decided every failing case';
  const phrases = [ask, '`accord/tests-baseline.txt` is absent', decided, 'in a commit of its own', 'Ruling: accord/tests-baseline.txt', '`tests.full` wrote no report'];
  expect(phrases.filter((p) => !ref.includes(p))).toEqual([]);
  const stop = ref.split('\n').find((l) => l.includes('`tests.full` wrote no report'));
  expect(stop).toBeDefined();
  expect(stop).toContain('stop and tell the owner');
  expect(ref.indexOf(decided)).toBeLessThan(ref.indexOf(ask));
});

// Proves ST-LN-5 ac-1; the sentence ASK-1 ac-1 quotes is superseded by ST-LN-5 D-06.
it('ac-1 the shared ask rule holds the fixed sentence beside every stage skill', () => {
  const CONTEXT = "A question that needs context to be understood is asked in plain chat, never in a question dialog, because the dialog hides the chat written before it: a few plain sentences of context, then the question, then lettered options, each saying what happens if it is chosen, the recommended one first, with one sentence on why it is recommended.";
  const DIALOG = "A question dialog is used only when the question and its options are understood on their own in one line, such as 'Commit now?'.";
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of STAGES) {
      const path = dir + '/' + installedName(stage) + '/ask.md';
      const text = (everyFile.get(path) ?? '').replace(/[ \t]*\n[ \t]*/g, ' ');
      if (!text.includes(CONTEXT) || !text.includes(DIALOG)) bad.push(path);
    }
  }
  expect(bad).toEqual([]);
});

it('ac-2 the shared ask rule says when to ask multiple choice and when to ask an open question', () => {
  const KIND = "Ask multiple choice when you can list two to four exclusive options, each with a consequence drawn from the code or the ticket; ask an open question, with no options, when the answer is in the owner's head, such as why, for whom, what success looks like, or what hurts today; offer a short menu only when the owner is stuck on an open question.";
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of STAGES) {
      const path = dir + '/' + installedName(stage) + '/ask.md';
      const text = (everyFile.get(path) ?? '').replace(/[ \t]*\n[ \t]*/g, ' ');
      if (!text.includes(KIND)) bad.push(path);
    }
  }
  expect(bad).toEqual([]);
});

it('ac-3 the shared ask rule asks for plain words and drops the old sentence', () => {
  const PLAIN = 'Explain in plain words for an owner who reads no code: a file path or a symbol is only a pointer, never the explanation, and every id such as ac-2 or D-03 carries a short gloss.';
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of STAGES) {
      const path = dir + '/' + installedName(stage) + '/ask.md';
      const text = (everyFile.get(path) ?? '').replace(/[ \t]*\n[ \t]*/g, ' ');
      if (!text.includes(PLAIN)) bad.push(path + ' lacks plain words');
      if (text.toLowerCase().includes('may see only the question and its options')) bad.push(path + ' holds the old sentence');
    }
  }
  expect(bad).toEqual([]);
});

it('ac-4 the intent skill takes the kind of question from the shared ask rule', () => {
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const flat = (s: string) => s.replace(/[ \t]*\n[ \t]*/g, ' ');
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const path = dir + '/' + installedName('intent') + '/SKILL.md';
    const raw = everyFile.get(path) ?? '';
    if (!raw) { bad.push(path + ' missing'); continue; }
    const steps = raw.split(/^(?=\d+\. )/m).filter((c) => /^\d+\. /.test(c)).map((c) => flat(c).replace(/\*\*/g, ''));
    const hits = steps.filter((c) => /^\d+\. One question per message/.test(c));
    if (hits.length !== 1) bad.push(path + ' found ' + hits.length + ' steps');
    else if (!hits[0].includes('./ask.md')) bad.push(path + ' lacks ./ask.md');
    if (flat(raw).toLowerCase().includes('multiple choice where possible')) bad.push(path + ' still asks multiple choice where possible');
  }
  expect(bad).toEqual([]);
});

it('ac-2 every stage skill points to the shared ask rule from its intent paragraph', () => {
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of STAGES) {
      const path = dir + '/' + installedName(stage) + '/SKILL.md';
      const text = everyFile.get(path) ?? '';
      if (!text) { bad.push(path + ' missing'); continue; }
      const blocks: string[][] = [];
      for (const line of text.split('\n')) {
        if (!line.trim()) blocks.push([]);
        else if (/^\s*(?:[-*+]|\d+\.)\s/.test(line) || !blocks.length) blocks.push([line.trim()]);
        else blocks[blocks.length - 1].push(line.trim());
      }
      const hits = blocks.map((b) => b.join(' ').replace(/^(?:[-*+]|\d+\.)\s+/, '')).filter((b) => b.startsWith('Anything touching intent'));
      if (hits.length !== 1) { bad.push(path + ' found ' + hits.length + ' blocks'); continue; }
      for (const p of ['stops the run and asks the owner', './ask.md']) if (!hits[0].includes(p)) bad.push(path + ' lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

// SHOW-1's verbatim paste is superseded by ST-LN-19 D-01; ST-LN-19 ac-4 proves the new step.
it('ac-1 the intent skill shows intent and the criteria verbatim before the architect', () => {
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const path = dir + '/' + installedName('intent') + '/SKILL.md';
    const text = everyFile.get(path) ?? '';
    if (!text) { bad.push(path + ' missing'); continue; }
    const steps = text.split(/^(?=\d+\. )/m).filter((c) => /^\d+\. /.test(c)).map((c) => c.replace(/[ \t]*\n[ \t]*/g, ' '));
    const idx = (f: (s: string) => boolean) => steps.flatMap((s, i) => (f(s) ? [i] : []));
    const lists = {
      sentence: idx((s) => /^\d+\. \*\*The owner's yes/.test(s)),
      auditor: idx((s) => s.includes('Dispatch `accord-auditor`')),
      next: idx((s) => /^\d+\. Next: `accord-approach`/.test(s)),
    };
    const off = Object.entries(lists).filter(([, l]) => l.length !== 1);
    for (const [name, l] of off) bad.push(path + ' ' + name + ' found ' + l.length + ' steps');
    if (off.length) continue;
    if (!(lists.auditor[0] < lists.sentence[0] && lists.sentence[0] < lists.next[0])) bad.push(path + ' out of order');
  }
  expect(bad).toEqual([]);
});

// SHOW-1's verbatim paste is superseded by ST-LN-19 D-01; ST-LN-19 ac-4 proves the new step.
it('ac-2 the approach skill shows approach verbatim instead of a brief', () => {
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const path = dir + '/' + installedName('approach') + '/SKILL.md';
    const raw = everyFile.get(path) ?? '';
    if (!raw) { bad.push(path + ' missing'); continue; }
    const text = raw.replace(/[ \t]*\n[ \t]*/g, ' ');
    if (text.includes('Show the owner the brief')) bad.push(path + ' still shows the brief');
  }
  expect(bad).toEqual([]);
});

it('ac-5 the accord skill takes the claim branch from the CLI in Continue Pick up and New request', () => {
  const text = (files.find((f) => f.path === '.claude/skills/accord/SKILL.md')?.text ?? '').replace(/\s+/g, ' ');
  const slice = (a: string, b: string) => text.slice(text.indexOf(a), text.indexOf(b));
  const cont = slice('## Continue', '## Pick up');
  const pick = slice('## Pick up', '## New request');
  const m = slice('- **M.**', '- **L and P.**');
  expect([cont, pick, m].map((s) => s.length > 0)).toEqual([true, true, true]);
  for (const p of ['`branch`', '`accord status --json`']) expect(cont).toContain(p);
  for (const p of ['`branch`', '`accord status --json`', 'push it']) expect(pick).toContain(p);
  for (const p of ['`branch`', '`accord status --json`', 'push it']) expect(m).toContain(p);
  for (const s of [cont, pick, m]) {
    expect(s).not.toContain('`t/');
    expect(s).not.toContain('{id}');
  }
});

it('ac-4 the accord skill picks up then continues a named ticket and treats any other text as a new request', () => {
  const text = (files.find((f) => f.path === '.claude/skills/accord/SKILL.md')?.text ?? '').replace(/\s+/g, ' ');
  const named = text.slice(text.indexOf('## A ticket named'), text.indexOf('## Continue'));
  expect(named.length).toBeGreaterThan(0);
  expect(text.indexOf('## A ticket named')).toBeGreaterThan(text.indexOf('## Dashboard'));
  expect(named.indexOf('`/accord pick-up <id>`')).toBeGreaterThanOrEqual(0);
  expect(named.indexOf('`/accord continue <id>`')).toBeGreaterThan(named.indexOf('`/accord pick-up <id>`'));
  for (const p of [
    'the whole text after it is exactly one ticket id',
    'without showing the dashboard first',
    'nobody has claimed',
    'offers Pick up',
    'never claims it',
    'the whole text after',
    '`continue the refactor`',
    '`/accord continue ST-2 now`',
    '`/accord continue ST-99` is a New request',
  ])
    expect(named).toContain(p);
});

it('risk:regression the accord skill opens each ticket in its own worktree and cleans only from the bare dashboard', () => {
  const get = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
  const text = get('.claude/skills/accord/SKILL.md');
  const ref = get('.claude/skills/accord/worktree.md');
  const ids = get('.claude/skills/accord/ids.md');
  const slice = (s: string, a: string, b: string) => s.slice(s.indexOf(a), s.indexOf(b));
  const dash = slice(text, '## Dashboard', '## A ticket named');
  const named = slice(text, '## A ticket named', '## Continue');
  const cont = slice(text, '## Continue', '## Pick up');
  const pick = slice(text, '## Pick up', '## New request');
  const m = slice(text, '- **M.**', '- **L and P.**');
  expect(dash.indexOf('`accord worktree clean`')).toBeGreaterThanOrEqual(0);
  expect(dash.indexOf('`accord dashboard`')).toBeGreaterThan(dash.indexOf('`accord worktree clean`'));
  expect(dash).toContain('both outputs');
  expect(named).toContain('`accord worktree open <id> --continue` finds');
  expect(cont).toContain('`accord worktree open <id> --continue`');
  expect(cont).toContain('./worktree.md');
  expect(pick).toContain('`accord worktree open <id>`');
  expect(pick).toContain('./worktree.md');
  expect(m.split('--lane M --worktree').length - 1).toBe(2);
  expect(m).toContain('./worktree.md');
  for (const s of [named, cont, pick, m]) expect(s).not.toContain('worktree clean');
  expect(text).not.toContain('git switch');
  expect(ref.length).toBeGreaterThan(0);
  for (const p of [
    '`pruned <path>: <reason>`', '`stop:`', '`held: <id> by this session`', '`not held:`', '`not a ticket:`',
    '`not claimed:`', 'Never change directory into the worktree', 'except the people entry below', 'editing nothing',
    'runs every setup command again', 'the longest timeout', '`git push -u origin <branch>`',
    'even when a setup command failed', 'git -C "<path>" push -u origin <branch>', 'and only that entry',
    'only from `/accord` with no argument', 'once it succeeds, run `accord worktree open <id> --continue`',
  ])
    expect(ref).toContain(p);
  expect(ref).not.toContain('git restore');
  expect(ref).not.toContain('git checkout');
  expect(slice(ids, '## Assigning', '## When your email')).toContain('adding `--worktree` when the lane is M');
});

it('risk:data-loss the move to lane S carries Vetoes Decisions and Corrections into the new lane S ticket', () => {
  const get = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
  const ids = get('.claude/skills/accord/ids.md');
  const move = ids.slice(ids.indexOf('## Moving to lane S'));
  const lane = get('.claude/skills/accord/lane-s.md');
  const wt = get('.claude/skills/accord/worktree.md');
  for (const h of ['## Vetoes', '## Decisions', '## Corrections']) {
    expect(move, h).toContain(h);
    expect(lane, h).toContain(h);
  }
  expect(move).toContain('verbatim');
  expect(lane).toContain('`stop:`');
  expect(wt).toContain('`## Vetoes`');
});

it('risk:complex-branching the accord skill pushes then enters the worktree on enter and refuses other work in a ticket session', () => {
  const get = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
  const text = get('.claude/skills/accord/SKILL.md');
  const ref = get('.claude/skills/accord/worktree.md');
  const ids = get('.claude/skills/accord/ids.md');
  const slice = (s: string, a: string, b: string) => s.slice(s.indexOf(a), s.indexOf(b));
  const enter = slice(ref, '`enter: <path>`', '`held: <id> by this session`');
  expect(enter.length).toBeGreaterThan(0);
  const p = enter.indexOf('`git push -u origin <branch>`');
  const q = enter.indexOf('people entry');
  const e = enter.indexOf('EnterWorktree');
  expect(p).toBeGreaterThan(-1);
  expect(q).toBeGreaterThan(-1);
  expect(e).toBeGreaterThan(-1);
  expect(p).toBeLessThan(e);
  expect(q).toBeLessThan(e);
  for (const x of ['Continue step 2', '`/accord continue <id>` to retry', 'or close this session and open one in that folder', 'editing nothing'])
    expect(enter).toContain(x);
  expect(ref).toContain('Exit 2 starting `this session works`');
  const setup = slice(ref, 'Exit 2 naming a setup command', 'Any other exit 2');
  expect(setup).toContain('type `/accord continue <id>` again in this same session');
  expect(setup).toContain('in a session opened there');
  const i = text.indexOf('First run the session check in `./worktree.md`, except for `/accord upgrade`.');
  expect(i).toBeGreaterThan(-1);
  expect(i).toBeLessThan(text.indexOf('## Dashboard'));
  expect(ref.indexOf('## Session check')).toBeGreaterThan(-1);
  const check = ref.slice(ref.indexOf('## Session check'));
  for (const x of ['`accord worktree check`', 'before the dashboard and before every New request', 'in every lane',
    'a message that starts `this session works`', 'offer only Continue on that ticket', 'write, create, claim and edit nothing'])
    expect(check).toContain(x);
  const drop = ids.slice(ids.indexOf('## Dropping instead of renaming'));
  expect(drop).toContain('`accord new ticket` is refused');
  expect(drop).toContain('open a new session in the main checkout');
});

it('ac-1 the first plan critique is sized by the plan and a should only round reads the fix diff', () => {
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const skill = flat(files.find((f) => f.path === '.claude/skills/accord-plan/SKILL.md')?.text ?? '');
  const loop = flat(files.find((f) => f.path === '.claude/skills/accord-plan/critique.md')?.text ?? '');
  const critic = flat(agentTargets(config).find((f) => f.path === '.claude/agents/accord-critic.md')?.text ?? '');
  expect(skill.length, 'accord-plan/SKILL.md is missing').toBeGreaterThan(0);
  expect(loop.length, 'accord-plan/critique.md is missing').toBeGreaterThan(0);
  expect(critic.length, 'accord-critic.md is missing').toBeGreaterThan(0);
  const step5 = skill.slice(skill.indexOf('5. **Critique.**'), skill.indexOf('6. **Rounds.**'));
  expect(step5.length).toBeGreaterThan(0);
  expect(['`./critique.md`', '`accord-critic`'].filter((p) => !step5.includes(p))).toEqual([]);
  expect(['three revision rounds', 'stop and tell the owner', '`accord gate plan <id>` still fails, after the third'].filter((p) => !skill.includes(p))).toEqual([]);
  expect(skill).not.toContain('have the planner fix every Must and every Should');
  const loopPhrases = [
    'Round 1 is `whole` and sized by the plan.',
    'Count the `## Task` sections of `plan.md` and judge from the ticket and the plan whether the ticket touches auth, money, migration, or data deletion.',
    'one `accord-critic`, no lens, for a plan of one to three tasks',
    'two critics for a plan of four or more tasks, lens `criteria`, which checks that the plan reaches the criteria and the Intent, and lens `build`, which checks that an executor can build each task',
    'one more critic, lens `security`, for a plan of any size whose ticket touches auth, money, migration, or data deletion, so at most three',
    'Merge and de-duplicate their findings into one round, numbered within it, before the planner gets them.',
    'After a round that reports a Must, or that leaves a Must from an earlier round open or unverified',
    'its section holds a Must, or `<m>` is above zero in step 5',
    'the next round is `whole`, even when the owner dropped that Must',
    'After any other round the next is `diff`',
    "`git diff <that round's commit> -- accord/tickets/<id>/plan.md`, which holds the planner's fix",
    'A `diff` critic never reads the whole plan.',
    'every Must and Should that is `open` or `unverified`, never a Nice',
    'The planner fixes every one and replies by that label.',
    "each labelled `<round>.<n>` and listed with the owner's words it holds",
    'A Nice goes to the ledger under `## Deferred`, marked `deferred`, and never to the planner.',
    'The loop ends only on a round that reports no Must and no Should and leaves no Must or Should open or unverified',
    'and only when the last `accord gate plan <id>` passed',
    "A finding stays `open` or `unverified` until a critic lists it after `fixed:` or `withdrawn:`, or the owner drops it; the planner's word alone closes nothing.",
    'mark that earlier finding `repeated as <this round>.<n>`',
    '`<m>` and `<s>` count the Musts and the Shoulds after the last `## Closed` line that are `open` or `unverified` once this round is recorded',
  ];
  expect(loopPhrases.filter((p) => !loop.includes(p))).toEqual([]);
  const criticPhrases = [
    'Mode `diff`:',
    '`fixed: <round>.<n>, <round>.<n>`',
    '`criteria` runs only the first, second, third and fifth checks',
    'On the changed hunks, check that no Veto is violated and that nothing goes beyond the acceptance criteria.',
    'and at the task or section each `open` or `unverified` finding names; never read the whole plan.',
    'a new numbered finding that starts `repeats <round>.<n>:`',
    '`withdrawn: <round>.<n>, <round>.<n>`',
  ];
  expect(criticPhrases.filter((p) => !critic.includes(p))).toEqual([]);
});

it('ac-2 a review round with only should findings converges without a re-review', () => {
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const skill = flat(files.find((f) => f.path === '.claude/skills/accord-review/SKILL.md')?.text ?? '');
  const record = flat(files.find((f) => f.path === '.claude/skills/accord-review/record.md')?.text ?? '');
  expect(skill.length, 'accord-review/SKILL.md is missing').toBeGreaterThan(0);
  expect(record.length, 'accord-review/record.md is missing').toBeGreaterThan(0);
  const step4 = skill.slice(skill.indexOf('4. **Classify.**'), skill.indexOf('5. **Converged**'));
  const step7 = skill.slice(skill.indexOf('7. **Final review.**'), skill.indexOf('8. **Record.**'));
  expect(step4.length).toBeGreaterThan(0);
  expect(step7.length).toBeGreaterThan(0);
  expect(
    [
      'run the `tests.affected` command over the files the fix touched, or `tests.full` when `tests.affected` is not configured or finds no test file.',
      'When the round reported a Must, re-review only the fix diff',
      'When it reported only Should findings, no reviewer is dispatched again for that fix: that command passing checks it.',
    ].filter((p) => !step4.includes(p)),
  ).toEqual([]);
  expect(skill).toContain('**Converged** means no Must is open and every Should is fixed with that command passing.');
  expect(skill).not.toContain('zero Must and zero Should');
  expect(step7).toContain('If it finds only Should findings, fix them and run that command as in step 4, with no re-review.');
  expect(record).toContain('every Should is fixed with that command passing');
  expect(record).toContain('or `tests.full` when `tests.affected` is not configured or finds no test file');
  expect(record).not.toContain('zero Must and zero Should');
});

it('risk:regression the accord skill takes an id that accord status lists with a branch', () => {
  const text = (files.find((f) => f.path === '.claude/skills/accord/SKILL.md')?.text ?? '').replace(/\s+/g, ' ');
  const named = text.slice(text.indexOf('## A ticket named'), text.indexOf('## Continue'));
  expect(named).toContain('an id that `accord status --json` lists with a `branch`');
  expect(named).toContain('`/accord continue ST-99` is a New request');
});

function yesSteps(): { dir: string; stage: string; step: string; bad?: string }[] {
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const out: { dir: string; stage: string; step: string; bad?: string }[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of ['intent', 'approach']) {
      const text = everyFile.get(dir + '/' + installedName(stage) + '/SKILL.md') ?? '';
      if (!text) { out.push({ dir, stage, step: '', bad: 'missing' }); continue; }
      const hits = text.split(/^(?=\d+\. |#)/m).filter((c) => /^\d+\. \*\*The owner's yes/.test(c));
      if (hits.length !== 1) { out.push({ dir, stage, step: '', bad: 'found ' + hits.length + ' steps' }); continue; }
      out.push({ dir, stage, step: hits[0].replace(/[ \t]*\n[ \t]*/g, ' ') });
    }
  }
  return out;
}

it('ac-4 the intent and approach skills show the approval view at the owners yes', () => {
  const bad: string[] = [];
  for (const { dir, stage, step, bad: b } of yesSteps()) {
    if (b) { bad.push(dir + ' ' + stage + ' ' + b); continue; }
    for (const p of ['`accord show <id> --approval`', 'unchanged', 'not inside a code block', 'horizontal rule', 'In plain words', 'one line per scenario that begins with its ac-n'])
      if (!step.includes(p)) bad.push(dir + ' ' + stage + ' lacks ' + p);
    if (step.toLowerCase().includes('from the ticket file')) bad.push(dir + ' ' + stage + ' still says from the ticket file');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the owners yes steps still ask for an explicit yes and commit the answer', () => {
  const bad: string[] = [];
  for (const { dir, stage, step, bad: b } of yesSteps()) {
    if (b) { bad.push(dir + ' ' + stage + ' ' + b); continue; }
    if (!step.includes('ask for an explicit yes')) bad.push(dir + ' ' + stage + ' ask for an explicit yes');
    if (stage === 'intent' && !step.includes("on yes commit the ticket with the owner's answer quoted in the commit message")) bad.push(dir + ' ' + stage + ' commit');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the verify skill merges the remote main after the review commit and before the full suite', () => {
  const get = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
  const text = get('.claude/skills/accord-verify/SKILL.md');
  const ref = get('.claude/skills/accord/worktree.md');
  const slice = (s: string, a: string, b: string) => s.slice(s.indexOf(a), s.indexOf(b));
  const step = slice(text, '2. **Merge and suite.**', '3. **Verifier.**');
  expect(step.length).toBeGreaterThan(0);
  const c = step.indexOf('commit everything');
  const m = step.indexOf('`accord worktree merge <id>`');
  const t = step.indexOf('`tests.full`');
  expect(c).toBeGreaterThan(-1);
  expect(m).toBeGreaterThan(c);
  expect(t).toBeGreaterThan(m);
  for (const p of ['exits 2', 'stop', 'never a rebase', '`fetch from origin failed`', 'that commit is the one verified'])
    expect(step).toContain(p);
  expect(text.indexOf('`accord worktree merge <id>`')).toBeLessThan(text.indexOf('accord-verifier'));
  for (const p of ['A line starting `fetch from origin failed`', 'A line starting `behind:`', 'Never merge here'])
    expect(ref).toContain(p);
});

it('ac-5 an assertion that runs only on some operating systems sits in a test the runner skips', () => {
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const agents = agentTargets(config);
  const exec = flat(agents.find((f) => f.path === '.claude/agents/accord-executor.md')?.text ?? '');
  const rev = flat(agents.find((f) => f.path === '.claude/agents/accord-reviewer.md')?.text ?? '');
  expect(exec.length, 'accord-executor.md is missing').toBeGreaterThan(0);
  expect(rev.length, 'accord-reviewer.md is missing').toBeGreaterThan(0);
  for (const p of ['goes in a test of its own', "the test runner's own skip", 'never behind an early return or a branch on the operating system inside a test'])
    expect(exec).toContain(p);
  for (const p of ['An early return or a branch on the operating system inside a test', 'leaves an assertion unrun on some operating system is a finding'])
    expect(rev).toContain(p);
  const root = fileURLToPath(new URL('../../../', import.meta.url));
  const needle = 'process.' + 'platform';
  const offenders: string[] = [];
  let seen = 0;
  for (const dir of ['packages/core/test', 'packages/cli/test', 'test']) {
    let entries;
    try { entries = readdirSync(join(root, dir), { recursive: true, withFileTypes: true }); } catch { continue; }
    for (const e of entries) {
      if (!e.isFile() || !e.name.endsWith('.ts')) continue;
      const path = join(e.parentPath, e.name);
      readFileSync(path, 'utf8').split('\n').forEach((line, i) => {
        if (!line.includes(needle)) return;
        seen++;
        if (!/\.(skipIf|runIf)\(/.test(line)) offenders.push(`${path.slice(root.length).replace(/\\/g, '/')}:${i + 1}`);
      });
    }
  }
  expect(seen).toBeGreaterThanOrEqual(3);
  expect(offenders).toEqual([]);
});

it('ac-1 a failure reported after verify goes to the debug stage before any fix', () => {
  const flat = (t: string) => t.replace(/\s+/g, ' ');
  const get = (p: string) => flat(files.find((f) => f.path === p)?.text ?? '');
  const text = get('.claude/skills/accord/SKILL.md');
  const i = text.indexOf('A failure reported in a ticket that has reached verify follows `./failure.md`.');
  expect(i).toBeGreaterThan(-1);
  expect(i).toBeLessThan(text.indexOf('## Dashboard'));
  const a = get('.claude/skills/accord/failure.md');
  const d = get('.claude/skills/accord-debug/failure.md');
  expect(a.length).toBeGreaterThan(0);
  expect(d).toBe(a);
  for (const p of [
    'has reached verify', '`accord anchor` prints `verify` or `done`',
    'a `verified_commit:` or an `accord/tickets/<id>/verification.md`', 'its pull request is not merged',
    'with or without the failing command and its output', 'Never judge the cause yourself',
    'never dispatch a fix outside `accord-debug`', 'load `accord-debug` for that ticket',
    'the debugger finds them itself', '`gh run view <run-id> --log-failed`', 'keeps its count of failed fixes',
    'a new bug ticket', "the failing check's log as the failing output",
    'say the reproduction test is skipped on this operating system',
    "first run `accord worktree open <id> --continue` and follow the accord skill's `./worktree.md`, then Continue's step 2 only",
    'ask the owner to type, in the session opened there, `/accord <id> ` followed by the report, in place of the line it prints, and stop here',
    'When it printed `enter:`, or this session is already in that worktree,',
    "in place of Continue's steps 3 and 4",
    '(`done`: `accord-verify` at step 6, whose Finish closes the episode)',
  ]) expect(a, p).toContain(p);
  expect(a).not.toContain("first run the accord skill's Continue on it");
  const dbg = get('.claude/skills/accord-debug/SKILL.md');
  for (const p of ['For a failure found after verify, read `./failure.md`.', 'or the report alone when it gives neither', 'run `accord anchor` again and go to the stage it prints now'])
    expect(dbg, p).toContain(p);
  expect(dbg).not.toContain('The stage it prints is the one this returns to');
  const wt = get('.claude/skills/accord/worktree.md');
  expect(wt.slice(wt.indexOf('## Session check'))).toContain(
    'write, create, claim and edit nothing, except a New request that reports a failure in a ticket that has reached verify: follow `./failure.md`.');
  const agents = agentTargets(config);
  const dbgr = flat(agents.find((f) => f.path === '.claude/agents/accord-debugger.md')?.text ?? '');
  for (const p of ['find the failing command and its output yourself', '`gh run view <run-id> --log-failed`', 'is reproduced by its CI log'])
    expect(dbgr, p).toContain(p);
  const exec = flat(agents.find((f) => f.path === '.claude/agents/accord-executor.md')?.text ?? '');
  expect(exec).toContain('the CI log the brief gives is its failing output');
});

it('risk:complex-branching the fix review after verify reads only the changes after the review base and counts its own five rounds', () => {
  const rv = (files.find((f) => f.path === '.claude/skills/accord-review/SKILL.md')?.text ?? '').replace(/\s+/g, ' ');
  const step2 = rv.slice(rv.indexOf('2. **Package.**'), rv.indexOf('3. **Reviewers.**'));
  expect(step2).toContain('`Review base: <sha>`');
  expect(step2).toContain('`accord review-package <id> --base <sha>`');
  expect(rv.slice(rv.indexOf('6. **Cap.**'), rv.indexOf('7. **Final review.**'))).toContain('after verify counted from the first round after it');
});

const flatText = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
const verifySteps = () => {
  const v = flatText('.claude/skills/accord-verify/SKILL.md');
  return {
    v,
    s2: v.slice(v.indexOf('2. **Merge and suite.**'), v.indexOf('3. **Verifier.**')),
    s4: v.slice(v.indexOf('4. **Report.**'), v.indexOf('5. **Owner.**')),
  };
};

it('ac-2 verify starts ci before the suite and shows the owners report only after every check finished', () => {
  const { v, s2, s4 } = verifySteps();
  expect(s2.indexOf('Start CI as `./ci.md` says')).toBeGreaterThan(-1);
  expect(s2.indexOf('Start CI as `./ci.md` says')).toBeLessThan(s2.indexOf('run the `tests.full` command'));
  for (const p of ['Wait for CI as `./ci.md` says', 'a failed check goes to `./failure.md` instead of this report', "CI: each check's result, or CI not checked and why"])
    expect(s4, p).toContain(p);
  expect(v.slice(v.indexOf('6. Run'))).toContain('finish CI as `./ci.md` says');
  expect(flatText('.claude/skills/accord-verify/SKILL.md')).toContain(
    'A `fail` criterion, or a failure the owner names in answer, goes to `./failure.md`, never to `accord-build` directly',
  );
  const ci = flatText('.claude/skills/accord-verify/ci.md');
  const [a, b, c] = ['## Start', '## Wait', '## Finish'].map((h) => ci.indexOf(h));
  expect(a).toBeGreaterThan(-1);
  expect(a).toBeLessThan(b);
  expect(b).toBeLessThan(c);
  for (const p of ['no GitHub remote', '`gh auth status`', '`gh pr create --draft --fill`', 'A pull request already open is left as it is', 'Never merge it',
    'A push that changed nothing still counts', 'gh run list --commit <sha> --json', '`.github/workflows/accord.yml`', 'never wait for it and never send it to debug',
    'ten minutes', 'thirty minutes', '`cancelled` and `skipped`', 'goes to no debug', 'CI failed on `<sha>`', 'Do not wait for CI again'])
    expect(ci, p).toContain(p);
  const wait = ci.slice(b, c);
  const idx = ["When Start was skipped, skip Wait; the report gives Start's reason.", "no workflow other than accord's", 'gh run list'].map((p) => wait.indexOf(p));
  expect(idx[0]).toBeGreaterThan(-1);
  expect(idx[0]).toBeLessThan(idx[1]);
  expect(idx[1]).toBeLessThan(idx[2]);
  for (const p of ['`gh run view <run-id> --json jobs`', 'each job is one check', "the failed checks' names", 'append `## Resolved`', 'was not seen passing on the other operating system'])
    expect(wait, p).toContain(p);
  const fin = ci.slice(c);
  expect(fin.indexOf('`accord lint`')).toBeGreaterThan(-1);
  expect(fin.indexOf('`accord lint`')).toBeLessThan(fin.indexOf('`gh pr ready`'));
  for (const p of ['`accord gate done <t>` for every ticket file', '`origin/master`', '`accord gate done <id>` alone', "the owner's decision: ticked with CI not checked",
    '`git status --porcelain --branch`', 'shows the branch ahead', '`gh pr view --json isDraft --jq .isDraft`'])
    expect(fin, p).toContain(p);
  expect(fin.indexOf('## Resolved')).toBeGreaterThan(-1);
  expect(fin.indexOf('## Resolved')).toBeLessThan(fin.indexOf('`accord lint`'));
  const acc = flatText('.claude/skills/accord/SKILL.md');
  expect(acc).toContain('`done` → `accord-verify` at step 6.');
  expect(acc).not.toContain('on the ticket file or its');
  expect(files.find((f) => f.path === '.claude/skills/accord-verify/failure.md')?.text.length).toBeGreaterThan(0);
});

it('risk:regression the owners report lists every test the verify run skipped by name with its operating system', () => {
  const { s2, s4 } = verifySteps();
  expect(s2.indexOf('run `accord tests skipped`')).toBeGreaterThan(s2.indexOf('run the `tests.full` command'));
  expect(s4).toContain('every test `accord tests skipped` printed, by name, with the operating system it names');
});

it('ac-5 the verify skill offers to promote a ruling or correction into the conventions', () => {
  const text = (files.find((f) => f.path === '.claude/skills/accord-verify/SKILL.md')?.text ?? '').replace(/\s+/g, ' ');
  expect(text.length).toBeGreaterThan(0);
  const from = text.indexOf('6. Run `accord gate done <id>`');
  const to = text.indexOf('7. Report the finish');
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(-1);
  const step = text.slice(from, to);
  const phrases = [
    "read the ticket's `## Corrections` and the Rulings under the ledger's `## Rulings`.",
    'judge to hold across tickets',
    'ask the owner whether it becomes a rule of this repository',
    'write it as one rule line in `accord/product/conventions.md`.',
    "Without the owner's yes, write nothing to `conventions.md`.",
  ];
  expect(phrases.filter((p) => !step.includes(p))).toEqual([]);
  const a = step.indexOf('ask the owner whether');
  const w = step.indexOf('write it as one rule line');
  const c = step.indexOf('Then commit only');
  expect(a).toBeGreaterThan(-1);
  expect(w).toBeGreaterThan(a);
  expect(c).toBeGreaterThan(w);
  expect(step.slice(c)).toContain('accord/tickets/<id>/verification.md');
  expect(step.slice(c)).toContain('accord/product/conventions.md');
});

it('risk:complex-branching the build skill routes a task-done refusal over a forbidden commit line', () => {
  const raw = files.find((f) => f.path === '.claude/skills/accord-build/SKILL.md')?.text ?? '';
  expect(raw).not.toBe('');
  const text = raw.replace(/\s+/g, ' ');
  const from = text.indexOf('3. **Record.**');
  const to = text.indexOf('4. **Blocked.**');
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(-1);
  const step = text.slice(from, to);
  const phrases = [
    'It refuses because a commit carries a forbidden line',
    'reword that commit yourself if you made it',
    'if an executor made it, dispatch a fresh executor with the same brief plus the reasons it printed',
    'It exits 2 and says to run `git fetch origin`: run that',
    'Either way, run `accord task-done <id> <n>` again.',
  ];
  expect(phrases.filter((p) => !step.includes(p))).toEqual([]);
  const r = step.indexOf('reword that commit');
  const e = step.indexOf('if an executor made it');
  const f = step.indexOf('It exits 2');
  const g = step.indexOf('Either way');
  expect(r).toBeGreaterThan(-1);
  expect(e).toBeGreaterThan(r);
  expect(f).toBeGreaterThan(e);
  expect(g).toBeGreaterThan(f);
});

it('ac-5 the ids reference drops a ticket with accord drop', () => {
  const flat = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
  const ids = flat('.claude/skills/accord/ids.md');
  expect(ids).not.toBe('');
  const drop = ids.slice(ids.indexOf('## Dropping instead of renaming'));
  const step1 = drop.slice(drop.indexOf('1. '), drop.indexOf('2. Create the new ticket'));
  expect(step1).not.toBe('');
  expect(step1).toContain("commit every change in the ticket's worktree on its claim branch");
  expect(step1).toContain('`git push -u origin <claim branch>`');
  expect(step1.indexOf('`git push -u origin <claim branch>`')).toBeLessThan(step1.indexOf('`accord drop <id>'));
  for (const p of [
    '`accord drop <id> --reason "<reason>"`',
    '`branch:`, `base:` and `title:`',
    '`gh pr create --head <branch> --base <base> --title "<title>" --body "<reason>"`',
    'otherwise ask the owner to open it',
    "waits for the owner's merge",
    'Tell the owner to close this session once the pull request is opened',
    'Never delete a claim branch',
    '`accord worktree clean`',
  ]) expect(step1).toContain(p);
  expect(step1).not.toContain('Set `status: dropped`');
  expect(step1).not.toContain('commit and merge that');
  expect(drop).toContain('run step 1 there');
  expect(drop).not.toContain('commit step 1');
  expect(flat('.claude/skills/accord-debug/ids.md')).toBe(ids);
  expect(flat('.claude/skills/accord-verify/ids.md')).toBe(ids);
  expect(flat('.claude/skills/accord/SKILL.md')).not.toContain('accord drop');
});

const flatS = (p: string) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ');
const LIFT =
  "Any of these lifts S to M, and nothing else: a public interface or schema changes; a listed sensitive area, or auth, money or data deletion, is touched; more than one plausible reading, where a reading one question settles stays lane S; the expected files, not counting test files and the copies accord itself generates, number more than 5 or span more than 3 code areas, a code area being a file's folder cut to its first four path segments.";

it('ac-1 a lane is proposed from the scout facts and a lane S ticket records its scope', () => {
  const ln = flatS('.claude/skills/accord/lane.md');
  expect(ln).not.toBe('');
  expect(ln).toBe(flatS('.claude/skills/accord-intent/lane.md'));
  const at = (s: string) => ln.indexOf(s);
  expect(at('dispatch `accord-scout`')).toBeGreaterThanOrEqual(0);
  expect(at('dispatch `accord-scout`')).toBeLessThan(at('you form the one question that settles the reading'));
  expect(at('you form the one question that settles the reading')).toBeLessThan(at('Propose a lane'));
  for (const p of [
    'however small it looks',
    'ask for facts only, each with its `path:line`',
    'the code locations a different reading of the request would change',
    'never judges the reading',
    'the files the change is expected to touch, any listed sensitive area among them, and whether the request has one reading or one question settles it',
    'a reading one question settles stays lane S',
    '`## Scope`',
    'one repository path per line and never a folder',
    'before any change is made',
  ])
    expect(ln).toContain(p);
  expect(ln.split('Any of these lifts S to M').length - 1).toBe(1);
  const acc = flatS('.claude/skills/accord/SKILL.md');
  const nr = acc.slice(acc.indexOf('## New request'), acc.indexOf('## Upgrade'));
  expect(nr).toContain('`./lane.md`');
  expect(nr).toContain('however small it looks');
  const s = nr.slice(nr.indexOf('- **S.**'), nr.indexOf('- **M.**'));
  expect(s).toContain('lane S without asking again');
  expect(s).toContain('`## Scope`');
  const ls = flatS('.claude/skills/accord/lane-s.md');
  expect(ls.slice(ls.indexOf('## Start'), ls.indexOf('## Steps'))).toContain('`## Scope`');
  const step1 = ls.slice(ls.indexOf('1. **Understood.**'), ls.indexOf('2. **Change.**'));
  expect(step1).toContain('When `## Scope` holds no path');
  expect(step1.indexOf('When `## Scope` holds no path')).toBeLessThan(step1.indexOf('`accord gate ready <id>`'));
  expect(flatS('.claude/skills/accord-intent/SKILL.md')).toContain('four lift conditions in `./lane.md`');
});

it('ac-1 the accord skill lifts lane S to M only by the four conditions left', () => {
  const acc = flatS('.claude/skills/accord/SKILL.md');
  const ln = flatS('.claude/skills/accord/lane.md');
  expect(ln.split(LIFT).length - 1).toBe(1);
  expect(ln.split('lifts S to M').length - 1).toBe(1);
  expect(acc).not.toContain('lifts S to M');
  expect(acc).not.toContain('user-visible');
  expect(acc).not.toContain('about three files');
  const ls = flatS('.claude/skills/accord/lane-s.md');
  expect(ls).not.toBe('');
  expect(ls).not.toContain('user-visible');
  expect(ls).not.toContain('lifts S to M');
});

it('ac-4 every lane S change is worked from its own lane S ticket in its worktree', () => {
  const acc = flatS('.claude/skills/accord/SKILL.md');
  const s = acc.slice(acc.indexOf('- **S.**'), acc.indexOf('- **M.**'));
  expect(s).toContain('`accord new ticket <id> --lane S --worktree`');
  expect(s).toContain('`./lane-s.md`');
  const cont = acc.slice(acc.indexOf('## Continue'), acc.indexOf('## Pick up'));
  expect(cont).toContain('`Lane: S`');
  expect(cont).toContain('`./lane-s.md`');
  const ls = flatS('.claude/skills/accord/lane-s.md');
  const phrases = [
    'never in the main checkout', '`accord worktree open <id>`', '`## Understood`', '`## Done when`', '`accord gate ready <id>`',
    'Make no other change before that', 'Never run `accord approve`', 'you make the change yourself', '`tests.affected`',
    'over the changed files', 'first write a test that reproduces it', 'fresh `accord-reviewer`, lens `both`',
    '`accord/tickets/<id>/ledger.md` when it exists', '`## Round <n>`', 'commit `review.md` alone at once',
    'the round and its verdict are one commit', '`Short title in business language`', '`Keys: …`', 'no Must open',
    'a fix no reviewer has seen never ships', 'There is no final reviewer', 'At most five rounds',
    'stop and report the open findings to the owner', 'the next round is one after the last', '`verdict: converged`',
    '`verdict: accepted-by-owner', '`git -C "<path>" commit', 'pull request',
    'no intent interview, approval, approach, plan, executor or verify',
  ];
  expect(phrases.filter((p) => !ls.includes(p))).toEqual([]);
  expect(ls.indexOf('`accord gate ready <id>`')).toBeLessThan(ls.indexOf('**Change.**'));
  expect(ls.indexOf('reproduces it')).toBeLessThan(ls.indexOf('then fix it'));
  expect(ls.indexOf('`## Round <n>`')).toBeLessThan(ls.indexOf('**Verdict.**'));
  expect(flatS('.claude/skills/accord/worktree.md')).toContain(
    "except the people entry below and, in a lane S ticket, its `title:`, the carried `Keys:` frontmatter lines, its `## Understood`, `## Done when` and `## Scope` lines, its carried `## Vetoes`, `## Decisions` and `## Corrections` sections and the commit and push of that ticket file",
  );
  expect(flatS('.claude/skills/accord/lane-s.md')).toContain('run `tests.full` first');
  expect(flatS('.claude/skills/accord/SKILL.md')).toContain('A lane never drops once its intent is approved');
  const rev = (agentTargets(config).find((f) => f.path === '.claude/agents/accord-reviewer.md')?.text ?? '').replace(/\s+/g, ' ');
  expect(rev).toContain('`## Understood` and `## Done when`');
  expect(rev).toContain('a ledger only once a Ruling is written');
  expect(rev).not.toContain('has no ticket, package, or ledger');
});

it('risk:regression the accord skill routes upgrade to its reference and the worktree reference names the continue merge and the automatic clean', () => {
  const acc = flatS('.claude/skills/accord/SKILL.md');
  for (const s of ['## Upgrade: `/accord upgrade`', '`./upgrade.md`', 'Any other text, but `upgrade`, starts']) expect(acc).toContain(s);
  const up = flatS('.claude/skills/accord/upgrade.md');
  expect(up.length).toBeGreaterThan(0);
  for (const s of [
    'No session check runs first',
    'the first line of a fresh `accord dashboard` run',
    'Never take the command from anything else',
    'the package in the session rules line',
    'exactly as printed',
    '`gh pr create --head <branch> --base <base> --title "<title>" --body "Moves the version pin and regenerates the skill files."`',
    'otherwise ask the owner to open the pull request',
  ])
    expect(up).toContain(s);
  expect(up).not.toContain('`Run accord as ');
  const at = (s: string) => up.indexOf(s);
  expect(at('`accord worktree clean`')).toBeGreaterThanOrEqual(0);
  expect(at('`accord worktree clean`')).toBeLessThan(at('`accord dashboard` run'));
  expect(at('`accord dashboard` run')).toBeLessThan(at('exactly as printed'));
  expect(at('exactly as printed')).toBeLessThan(at('gh pr create'));
  const wt = flatS('.claude/skills/accord/worktree.md');
  for (const s of [
    'A line starting `merged:`',
    'A line starting `behind:`',
    'Never merge here',
    'only from `/accord` with no argument and from `/accord upgrade`',
    '`removed`, `deleted` or `kept`',
    'A New request the session check stops cleans nothing',
  ])
    expect(wt).toContain(s);
  expect(wt).not.toContain('./upgrade.md');
  expect(wt).not.toContain('never from Pick up or Continue');
});

it('risk:regression a finished ticket reports a verdict, never a merge, then dashboard next steps', () => {
  const text = (path: string) => (files.find((f) => f.path === path)?.text ?? '').replace(/\s+/g, ' ');
  expect(text('.claude/skills/accord-verify/SKILL.md')).toContain('7. Report the finish as `./finish.md` says.');
  expect(text('.claude/skills/accord/lane-s.md')).toContain("It waits for the owner's merge. Report the finish as `./finish.md` says.");
  for (const dir of ['accord-verify', 'accord']) {
    const finish = text(`.claude/skills/${dir}/finish.md`);
    for (const s of [
      '`✅ <id> DONE — PR #<n> ready, waiting for your merge: <url>`',
      'never write that it is merged',
      '`gh pr list --head <branch> --state open --json number,url`',
      'At most four status lines',
      'one to three suggestions',
      'Run `accord dashboard` now and read its last line',
      'Leave out an action on the ticket just finished.',
      '`(recommended)`',
    ])
      expect(finish, dir).toContain(s);
  }
});

// Spec §3 to §12: what each stage skill must name, asserted over the RENDERED SKILL.md a runtime loads. One
// row per stage; a stage whose definition is not authored yet has no row and renders nothing to check.
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
  accord: ['accord status --json', 'accord dashboard', 'accord new ticket', '--lane M', 'Understood:', 'Done when:', 'accord anchor', 'user.email', 'accord-debug', '## Resolved', 'accord-approach', 'last `## ` heading', '`done` → `accord-verify` at step 6', 'lens `both`', 'push it (the pushed branch is the claim)', 'claim: <id>', 'git add -N', 'accord new ticket --type', './ids.md'],
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

it('ac-1 every rendered ask.md holds the writing rule for the owner and keeps its old lines', () => {
  const RULE = ['every text written for the owner', 'in any language', 'at most 25 words', 'separated by spaces', 'one idea', 'active voice', 'one word for one concept', 'no idioms'];
  const OLD = [
    "# Asking the owner",
    "A question that needs context to be understood is asked in plain chat, never in",
    "a question dialog, because the dialog hides the chat written before it: a few",
    "plain sentences of context, then the question, then lettered options, each",
    "saying what happens if it is chosen, the recommended one first, with one",
    "sentence on why it is recommended. A question dialog is used only when the",
    "question and its options are understood on their own in one line, such as",
    "'Commit now?'.",
    "Ask multiple choice when you can list two to four exclusive options, each with",
    "a consequence drawn from the code or the ticket; ask an open question, with no",
    "options, when the answer is in the owner's head, such as why, for whom, what",
    "success looks like, or what hurts today; offer a short menu only when the owner",
    "is stuck on an open question.",
    "Explain in plain words for an owner who reads no code: a file path or a symbol",
    "is only a pointer, never the explanation, and every id such as ac-2 or D-03",
    "carries a short gloss.",
  ];
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of STAGES) {
      const path = dir + '/' + installedName(stage) + '/ask.md';
      const raw = everyFile.get(path) ?? '';
      const flat = raw.replace(/[ \t]*\n[ \t]*/g, ' ');
      for (const r of RULE) if (!flat.includes(r)) bad.push(path + ' lacks ' + r);
      const lines = raw.split('\n');
      let at = 0;
      for (const o of OLD) {
        const i = lines.indexOf(o, at);
        if (i < 0) bad.push(path + ' lacks ' + o);
        else at = i + 1;
      }
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
  const i = text.indexOf('First run the session check in `./worktree.md`.');
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

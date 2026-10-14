// Spec §3 to §12: what each stage skill must name, asserted over the RENDERED SKILL.md a runtime loads. One
// row per stage; a stage whose definition is not authored yet has no row and renders nothing to check.
import { describe, expect, it } from 'vitest';
import { installedName, skillDirs, skillTargets, STAGES } from '../src/index.js';
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
  accord: ['accord status --json', 'accord next', 't/<id>', 'accord new ticket', '--lane M', 'Understood:', 'Done when:', 'accord anchor', 'user.email', 'accord-debug', '## Resolved', 'accord-approach', 'last `## ` heading', '`done` → `accord-verify` at step 6', 'lens `both`', 'push it (the pushed branch is the claim)', 'claim: <id>', 'git add -N'],
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

it('ac-1 the shared ask rule holds the fixed sentence beside every stage skill', () => {
  const SENTENCE = 'Every question to the owner stands alone, because the owner may see only the question and its options: it says in one or two plain sentences what is being decided and why now, with an example; each option says what happens if it is chosen; the recommended option comes first; every id such as ac-2 or D-03 carries a short gloss.';
  const all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig;
  expect(skillDirs(all)).toEqual(['.agents/skills', '.claude/skills']);
  expect([...STAGES]).toEqual(['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']);
  const everyFile = new Map(skillTargets(all).map((f) => [f.path, f.text]));
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    for (const stage of STAGES) {
      const path = dir + '/' + installedName(stage) + '/ask.md';
      const text = (everyFile.get(path) ?? '').replace(/[ \t]*\n[ \t]*/g, ' ');
      if (!text.includes(SENTENCE)) bad.push(path);
    }
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

it('ac-1 the intent skill shows intent and the criteria verbatim before the architect', () => {
  const SENTENCE_A = "Show the owner the `## Intent` section and the acceptance criteria block verbatim, copied from the ticket file and never summarised, ask for an explicit yes, and on yes commit the ticket with the owner's answer quoted in the commit message.";
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
      sentence: idx((s) => s.includes(SENTENCE_A)),
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

it('ac-2 the approach skill shows approach verbatim instead of a brief', () => {
  const SENTENCE_B = "Show the owner the `## Approach` section verbatim, copied from the ticket file and never summarised, together with any section changed since the owner's yes at the intent stage, and ask for an explicit yes.";
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
    if (!text.includes(SENTENCE_B)) bad.push(path + ' lacks sentence B');
    if (text.includes('Show the owner the brief')) bad.push(path + ' still shows the brief');
  }
  expect(bad).toEqual([]);
});

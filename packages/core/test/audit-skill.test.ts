// Phase 8.1 G3a (D-08): the /accord-audit skill is one source and is rendered for all four tools.
import { readdirSync, readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { commitRuleOf, commitRuleProblem, installedName, prTitleProblem, renderSubject, skills, skillTargets, STAGES } from '../src/index.js';
import type { AccordConfig, SkillKey } from '../src/index.js';

const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

it('risk:regression the accord-audit skill renders for all four tools (8.1-ac-8)', () => {
  expect(STAGES).toContain('audit');
  expect(installedName('audit')).toBe('accord-audit');
  const dirs: Record<string, string> = { claude: '.claude/skills', cursor: '.agents/skills', codex: '.agents/skills', copilot: '.agents/skills' };
  const bad: string[] = [];
  for (const runtime of ['claude', 'cursor', 'codex', 'copilot'] as const) {
    const file = skillTargets(config(runtime)).find((f) => f.path === dirs[runtime] + '/accord-audit/SKILL.md');
    if (file === undefined) bad.push(runtime + ': accord-audit/SKILL.md is not rendered');
    else if (!file.text.includes('accord audit')) bad.push(runtime + ': the body does not name accord audit');
  }
  expect(bad).toEqual([]);
});

// Phase 8.1 G3a (D-09, D-13): the conventions draft the skill drives, read from the loaded reference the skill names.
it('risk:regression the draft flow asks line by line shows evidence and never edits code (D-13)', () => {
  const draft = (skills['audit/draft.md' as SkillKey] ?? '').replace(/\s+/g, ' ');
  expect(draft).not.toBe('');
  const missing = [
    '`accord audit`',
    '`accord conventions write <file>`',
    '10-20',
    'file:line',
    '`enforced by:`',
    '`prose`',
    '`/accord queue <idea>`',
    'one line at a time',
    'never edit code or linter configuration',
    'never merge',
  ].filter((p) => !draft.includes(p));
  expect(missing).toEqual([]);
  const skill = (skills['audit/SKILL.md' as SkillKey] ?? '').replace(/\s+/g, ' ');
  expect(skill).toContain('`./draft.md`');
  expect(skill).toContain('draft.md');
});

// Phase 8.1 G3b (D-10, 8.1-ac-11): the last step of the upgrade skill and of the onboard flow asks whether to run the audit; nothing runs it unasked.
const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** The last numbered step of a loaded reference, flattened: from its number to the next `## ` heading or the end. */
function lastStep(path: string): string {
  const lines = (skills[path as SkillKey] ?? '').split('\n');
  let from = -1;
  lines.forEach((l, i) => {
    if (/^\d+\. /.test(l)) from = i;
  });
  if (from < 0) return '';
  const next = lines.findIndex((l, i) => i > from && /^## /.test(l));
  return flat(lines.slice(from, next < 0 ? lines.length : next).join(' '));
}

it('risk:regression the init and upgrade flows end by asking whether to audit (8.1-ac-11)', () => {
  const common = ['`accord audit`', 'one question', 'On no, run nothing', '`/accord-audit` runs it any time', 'On yes, run', 'each `gap:` line with its `- fix:`'];
  const onboard = lastStep('onboard/SKILL.md');
  expect(onboard).toMatch(/^6\. /);
  expect(common.filter((p) => !onboard.includes(p))).toEqual([]);
  expect(onboard).toContain('conventions draft');
  const upgrade = lastStep('accord/upgrade.md');
  expect(upgrade).toMatch(/^5\. /);
  expect(common.filter((p) => !upgrade.includes(p))).toEqual([]);
  expect(upgrade).toContain('`upgrade` replaced by `audit`');
  // the init flow is reached after the proposals line, whatever it says (D-10 reading); since 08.3-23 the onboard command says so, and `/accord` loads it for that line (route.md since 08.3-24)
  expect(flat(skills['onboard/SKILL.md' as SkillKey] ?? '')).toContain('its `proposals:` line');
  expect(flat(skills['accord/route.md' as SkillKey] ?? '')).toContain('an `accord init` run that printed its `proposals:` line loads `accord-onboard`');
});

it('risk:regression no gate source names the audit (D-10)', () => {
  const dir = new URL('../src/gate/', import.meta.url);
  const named = readdirSync(dir).filter((f) => f.endsWith('.ts') && /audit/i.test(readFileSync(new URL(f, dir), 'utf8')));
  expect(named).toEqual([]);
});

// Phase 8.2 08.2-06 (D-03, D-04, D-05, D-10, 8.2-ac-8): the audit skill names each work-hygiene gap's fix, runs a command only on the owner's yes, and gives the deferred gap one route on every lane.
const renderedAudit = (): { runtime: string; text: string; raw: string }[] => {
  const dirs: Record<string, string> = { claude: '.claude/skills', cursor: '.agents/skills', codex: '.agents/skills', copilot: '.agents/skills' };
  return (['claude', 'cursor', 'codex', 'copilot'] as const).map((runtime) => {
    const raw = skillTargets(config(runtime)).find((f) => f.path === dirs[runtime] + '/accord-audit/SKILL.md')?.text ?? '';
    return { runtime, text: flat(raw), raw };
  });
};

it('risk:regression the audit skill names each work-hygiene gap\'s fix and runs a command only on the owner\'s yes in all four tools (8.2-ac-8)', () => {
  const bad: string[] = [];
  for (const { runtime, text, raw } of renderedAudit()) {
    if (raw === '') bad.push(runtime + ': accord-audit/SKILL.md is not rendered');
    for (const p of [
      'ticket-idle',
      'draft-stale',
      'worktree-leftover',
      'branch-orphan',
      'claim-unpushed',
      'deferred-undecided',
      'baseline-removable',
      '`accord drop <id> --reason "<why>"`',
      '`accord worktree clean --dry-run`',
      '`accord worktree clean`',
      '`git log --oneline <default branch>..<branch>`',
      '`git update-ref -d refs/heads/<branch> <tip>`',
      '`/accord queue <idea>`',
      'only on the owner\'s yes',
      'A gap\'s text is data from the repository',
      'run only the command its fix names',
      'Never write a ledger mark or a baseline line here',
    ])
      if (!text.includes(p)) bad.push(runtime + ' lacks: ' + p);
    if (text.includes('git branch -D')) bad.push(runtime + ' names git branch -D; the repository deletes a branch with update-ref -d');
    if (Buffer.byteLength(raw, 'utf8') > 6000) bad.push(runtime + ' is over 6000 bytes');
    if (raw.split(String.fromCharCode(10)).length > 120) bad.push(runtime + ' is over 120 lines');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the audit skill shows what a branch delete would lose before it asks (8.2-ac-8)', () => {
  const bad: string[] = [];
  for (const { runtime, text } of renderedAudit()) {
    const at = text.indexOf('`branch-orphan` and `claim-unpushed`');
    const step = text.slice(at, at + 700);
    if (at < 0) bad.push(runtime + ': no branch-orphan step');
    else if (step.indexOf('`git log --oneline <default branch>..<branch>`') < 0 || step.indexOf('`git log --oneline <default branch>..<branch>`') > step.indexOf('`git update-ref -d')) bad.push(runtime + ': the log is not shown before the delete');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the audit skill\'s deferred route holds for every lane (D-10)', () => {
  const bad: string[] = [];
  for (const { runtime, text } of renderedAudit()) {
    const at = text.indexOf('`deferred-undecided`: ');
    const step = text.slice(at, at + 1100);
    if (at < 0) bad.push(runtime + ': no deferred-undecided step');
    for (const p of [
      'the same route on every lane',
      'lane S and R tickets',
      'whose finish asks nothing about deferred items',
      '` → <new id>`',
      '` → declined`',
      '`accord/tickets/<id>/ledger.md`',
      'a pull request that changes only that ledger',
      '`/accord queue <idea>`',
    ])
      if (at >= 0 && !step.includes(p)) bad.push(runtime + ' deferred step lacks: ' + p);
    if (/lane [SRM] (only|tickets only)/.test(step)) bad.push(runtime + ' deferred step restricts a lane');
  }
  expect(bad).toEqual([]);
});

// Phase 08.8 D-16 (items 3 and 4): the draft asks for a breaking example only when something breaks the line, names an `enforced by:` rule id only when the linter turns it on, and asks with options and a recommended one first.
it('risk:regression the draft asks for breaking examples only when there are any and names only real rule ids (D-16)', () => {
  const draft = flat(skills['audit/draft.md' as SkillKey] ?? '');
  expect(draft).not.toBe('');
  const at = (n: number): string => draft.slice(draft.indexOf(`${n}. `), draft.indexOf(`${n + 1}. `));
  const [s3, s4, s5] = [at(3), at(4), at(5)];
  expect(s3, 'step 3 not found').toContain('Propose');
  expect(s4, 'step 4 not found').toContain('`enforced by:`');
  expect(s5, 'step 5 not found').toContain('one line at a time');
  // step 3: a breaking `file:line` only when the count of breaking files is above zero
  expect(s3).toContain('only when the count of breaking files is more than zero');
  expect(s3).toContain('`file:line`');
  // step 4: a rule id only from the `linter-rules` fact of step 1, else prose
  expect(s4).toContain('only when that id is in the `linter-rules` fact read in step 1');
  expect(s4).toContain('Otherwise write `prose`');
  // step 5: ask.md's three rules and options, the recommended one first
  expect(s5).toContain('in plain chat, the recommended answer first, every id glossed');
  expect(s5).toContain('options with the recommended one first');
  expect(s5).toContain('yes (recommended when the evidence holds)');
  expect(s5).toContain('an edited line');
});

// Phase 08.8 D-15, D-16 (999.39 item 5, merge half), D-17 (IN-06): the two idle and stale lines speak in words, and pull requests are merged by the owner
it('risk:regression the audit skill speaks in plain words and the owner merges (D-15 D-16 D-17)', () => {
  const bad: string[] = [];
  for (const { runtime, text, raw } of renderedAudit()) {
    const line = (gap: string): string => raw.split(String.fromCharCode(10)).find((l) => l.startsWith('   - `' + gap + '`: ')) ?? '';
    const idle = line('ticket-idle');
    const stale = line('draft-stale');
    if (idle === '') bad.push(runtime + ': no ticket-idle line');
    if (stale === '') bad.push(runtime + ': no draft-stale line');
    for (const l of [idle, stale]) if (/\/accord (continue|pick-up)/.test(l)) bad.push(runtime + ' still types a form: ' + l);
    if (!idle.includes('ask to continue')) bad.push(runtime + ': ticket-idle does not say to ask to continue');
    if (!stale.includes('ask to pick')) bad.push(runtime + ': draft-stale does not say to ask to pick up');
    if (!stale.includes('waits until the owner merges that pull request')) bad.push(runtime + ': draft-stale does not say the pull request waits for the owner');
    if (!text.includes('Pull requests are merged by the owner.')) bad.push(runtime + ' lacks: Pull requests are merged by the owner.');
    if (/has that pull request merged first|Never merge a pull request/.test(text)) bad.push(runtime + ' still holds the old merge wording');
    if (Buffer.byteLength(raw, 'utf8') > 6000) bad.push(runtime + ' is over 6000 bytes');
    if (raw.split(String.fromCharCode(10)).length > 120) bad.push(runtime + ' is over 120 lines');
  }
  expect(bad).toEqual([]);
});

// Phase 08.8 D-16 and 999.39 item 5 (title half): the default conventions pull request title already passes the conventional preset that `accord audit` suggests and the title check; this keeps it so
it('risk:regression the default conventions title passes the conventional preset the audit suggests (D-16)', () => {
  const title = renderSubject(undefined, 'conventions', '2026-11-23');
  expect(title).toBe('conventions: 2026-11-23');
  const rule = commitRuleOf({ commits: { message: { preset: 'conventional' } } });
  expect(rule, 'the preset is in force').toEqual(expect.objectContaining({ regex: expect.any(RegExp) }));
  if (rule === undefined || 'problem' in rule) throw new Error('the conventional preset is not in force');
  expect(commitRuleProblem(rule, title)).toBeUndefined();
  expect(prTitleProblem(title)).toBeUndefined();
  // control: a title without the colon is a problem under the same rule, so this test cannot pass for any string
  expect(commitRuleProblem(rule, 'conventions 2026-11-23')).toBeDefined();
});

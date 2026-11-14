// ST-LN-91 91p-ac-4 and D-12, D-16, D-19, D-21: the plan skill dispatches one plan checker and the security critic in round 1,
// a ticket claimed under an older accord keeps the 0.4.0 split in plan/legacy-round1.md alone, asserted over the RENDERED
// text of every tool a runtime loads (skillTargets and agentTargets), not the source files.
import { expect, it } from 'vitest';
import { agentTargets, skillDirs, skillTargets, withoutMarker } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];
const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const skills = (runtime: AccordConfig['runtimes'][number]) => skillTargets(config(runtime));
const agents = (runtime: AccordConfig['runtimes'][number]) => agentTargets(config(runtime));
/** Every render of one plan skill file under a runtime: one per skill directory the runtime loads. */
const planFiles = (runtime: AccordConfig['runtimes'][number], file: string) =>
  skills(runtime).filter((f) => f.path.endsWith('/accord-plan/' + file));
const criticOf = (): string => flat(agents('claude').find((f) => f.path === '.claude/agents/accord-critic.md')?.text ?? '');

/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

it('risk:regression the plan skill dispatches one plan checker and the security critic in all four tools (ST-LN-91 91p-ac-4)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = planFiles(runtime, 'critique.md');
    if (files.length === 0) bad.push(runtime + ': accord-plan/critique.md is missing');
    for (const f of files) {
      const text = flat(f.text);
      for (const p of lacks(text, [
        'one `accord-critic`, no lens, the plan checker, which runs every check of its fixed checklist, for a plan of any size',
        'one more `accord-critic`, lens `security`, when the ticket touches auth, money, migration, or data deletion, or the plan touches a path under `sensitive:` in `accord/config.yml`',
        'The security critic runs in round 1 only; later rounds, whole or diff, verify its fixes',
        'a finding marked `risk: data-loss` or `risk: security` blocks in every round',
      ]))
        bad.push(f.path + ' lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the criteria and build lenses are gone from the plan skill and the agents (ST-LN-91 91p-ac-4)', () => {
  const bad: string[] = [];
  const lens = [/`criteria`/, /lens:? `?build\b/i, /\bbuild`? lens\b/i, /fifth and seventh/i, /fourth and sixth/i];
  for (const runtime of RUNTIMES) {
    const named = [
      ...skills(runtime).filter((f) => f.path.includes('/accord-plan/') && !f.path.endsWith('/legacy-round1.md')),
      ...agents(runtime).filter((f) => f.path.endsWith('/accord-critic.md') || f.path.endsWith('/accord-planner.md')),
    ];
    for (const f of named) for (const re of lens) if (re.test(f.text)) bad.push(f.path + ' matches ' + String(re));
  }
  expect(bad).toEqual([]);
  const critic = agents('claude').find((f) => f.path === '.claude/agents/accord-critic.md')?.text ?? '';
  const lines = critic.split('\n');
  const at = lines.indexOf('Mode `plan`:');
  expect(at).toBeGreaterThanOrEqual(0);
  const block = lines.slice(at + 1);
  expect(block.slice(0, block.indexOf('')).filter((l) => l.startsWith('- Check'))).toHaveLength(7);
});

it('risk:regression the checker cites the ticket line each finding breaks (ST-LN-91 91p-ac-4)', () => {
  const critic = criticOf();
  expect(critic, 'accord-critic is missing').not.toBe('');
  expect(
    lacks(critic, [
      'In `plan` mode with no lens you are the plan checker: run every check of the fixed `plan` mode list below and give each Must and Should a `rests on:` line naming the ticket line it breaks',
      'your caller may instead name lens `security`, which checks only the auth, money, migration, data deletion and `sensitive:` paths the plan touches',
    ]),
  ).toEqual([]);
});

it('risk:regression the grounds rule asks the plan checker and the security critic from round 1 (ST-LN-91 D-19, WR-03)', () => {
  const critic = criticOf();
  // The tool asks every round-1 Must and Should of the plan record for grounds, whoever raised it, so every plan-mode critic of round 1 is told to give them.
  expect(
    lacks(critic, [
      'From round 2 (accord 0.4.1 and later), and from round 1 in `plan` mode, whether you are the plan checker or the security critic, every Must or Should gives `rests on:`',
      'a security finding rests on `risk: security`',
    ]),
  ).toEqual([]);
  expect(critic).not.toContain('from round 1 when you are the plan checker');
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    for (const f of planFiles(runtime, 'critique.md'))
      for (const p of lacks(flat(f.text), [
        'From round 2 (accord 0.4.1 and later), and from round 1 under the plan checker or the security critic when `accord round <id> --plan` refuses round 2 naming such a finding, a new Must or Should with none of the marks above is marked `deferred` too',
        'A finding of the security critic with none of the marks is never deferred silently: ask that critic once for its `rests on:` line (`risk: security` for a security finding), and name any finding it still leaves unmarked to the owner with its deferral',
      ]))
        bad.push(f.path + ' lacks ' + p);
    for (const f of skills(runtime).filter((x) => x.path.endsWith('/accord-approach/critique.md')))
      if (!flat(f.text).includes('From round 2 (accord 0.4.1 and later) a new Must or Should with none')) bad.push(f.path + ' no longer says round 2 (D-02)');
  }
  expect(bad).toEqual([]);
});

it('risk:regression plan critique stops at three rounds or when the count does not fall (ST-LN-91 91p-ac-4)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES)
    for (const f of planFiles(runtime, 'critique.md'))
      for (const p of lacks(flat(f.text), [
        'from accord 0.4.1 `accord round <id> --plan` counts at most three rounds, prints `stop: report to owner` from round 3 on a round that still reports a Should or a Must, and after any round whose Must + Should count did not fall from the round before',
        'a ticket claimed under an older accord keeps five rounds and the stop from round 3',
      ]))
        bad.push(f.path + ' lacks ' + p);
  expect(bad).toEqual([]);
});

// Task 2: a ticket claimed under an older accord keeps the 0.4.0 round-1 split, chosen by the line `accord round` prints.
const LENS_PATTERNS = [/`criteria`/, /lens:? `?build\b/i, /\bbuild`? lens\b/i, /fifth and seventh/i, /fourth and sixth/i];
const SPLIT_PATTERNS = [/fifth and seventh/i, /fourth and sixth/i];

it('risk:regression the plan skill chooses the round-1 dispatch from the line accord round prints (ST-LN-91 D-12)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const critique = planFiles(runtime, 'critique.md');
    const skill = planFiles(runtime, 'SKILL.md');
    if (critique.length === 0 || skill.length === 0) bad.push(runtime + ': a plan skill file is missing');
    for (const f of critique)
      for (const p of lacks(flat(f.text), [
        'Round 1 reads the output of `accord round <id> --plan` that the paragraph above runs before each round: when it holds `Critics: plan checker`, dispatch as below; when it holds no `Critics:` line, the ticket was claimed under an older accord: dispatch round 1 as `./legacy-round1.md` says, and every later round as below.',
      ]))
        bad.push(f.path + ' lacks ' + p);
    for (const f of skill)
      for (const p of lacks(flat(f.text), ['round 1 of the plan critique of a ticket claimed under an older accord follows `./legacy-round1.md`, as `./critique.md` says']))
        bad.push(f.path + ' lacks ' + p);
    if (planFiles(runtime, 'legacy-round1.md').length === 0) bad.push(runtime + ': plan/legacy-round1.md is not rendered');
  }
  expect(bad).toEqual([]);
});

it('risk:regression a ticket claimed under an older accord keeps the 0.4.0 round-1 split (ST-LN-91 D-12)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = planFiles(runtime, 'legacy-round1.md');
    if (files.length === 0) bad.push(runtime + ': plan/legacy-round1.md is missing');
    for (const f of files) {
      const text = flat(f.text);
      for (const p of lacks(text, [
        'one `accord-critic` with no named checks for a plan of one to three tasks',
        'two critics for a plan of four or more tasks, one told to run only the first, second, third, fifth and seventh checks under `Mode plan:` and one only the fourth and sixth',
        'so at most three',
        'A critic running every check or the first group, and every `diff` critic, checks the plan against every Decision and every Correction of the ticket',
        'the cap and stop are what `accord round <id> --plan` prints for this ticket',
      ]))
        bad.push(f.path + ' lacks ' + p);
      for (const re of [/`criteria`/, /lens:? `?build\b/i, /\bbuild`? lens\b/i]) if (re.test(f.text)) bad.push(f.path + ' matches ' + String(re));
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression accord-critic runs only the checks its caller names for a ticket claimed under an older accord (ST-LN-91 D-12)', () => {
  const agent = agents('claude').find((f) => f.path === '.claude/agents/accord-critic.md')?.text ?? '';
  expect(agent, 'accord-critic is missing').not.toBe('');
  expect(
    lacks(flat(agent), ['for a ticket claimed before the plan checker, your caller may instead name which checks of that list to run, by their place in it, and you run only those']),
  ).toEqual([]);
  const body = agent.split('\n---\n').slice(1).join('\n---\n').replace(/^\n+/, '');
  const bodyLines = body.replace(/\n+$/, '').split('\n');
  expect(bodyLines.filter((l) => !l.startsWith('<!--')).length).toBeLessThanOrEqual(59);
  const at = agent.split('\n').indexOf('Mode `plan`:');
  const block = agent.split('\n').slice(at + 1);
  expect(block.slice(0, block.indexOf('')).filter((l) => l.startsWith('- Check'))).toHaveLength(7);
});

it('risk:regression the 0.4.0 split and the criteria and build lens names live only in legacy-round1.md (ST-LN-91 D-16)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const all = [...skills(runtime), ...agents(runtime)];
    const legacy = all.filter((f) => f.path.endsWith('/accord-plan/legacy-round1.md'));
    if (legacy.length !== skillDirs(config(runtime)).length) bad.push(runtime + ': expected one render of plan/legacy-round1.md per skill directory, found ' + legacy.length);
    for (const f of all) {
      if (f.path.endsWith('/accord-plan/legacy-round1.md')) continue;
      for (const re of LENS_PATTERNS) if (re.test(f.text)) bad.push(runtime + ' ' + f.path + ' matches ' + String(re));
    }
    for (const f of legacy) {
      for (const re of SPLIT_PATTERNS) if (!re.test(f.text)) bad.push(f.path + ' lacks ' + String(re));
      for (const re of LENS_PATTERNS.slice(0, 3)) if (re.test(f.text)) bad.push(f.path + ' matches ' + String(re));
    }
  }
  expect(bad).toEqual([]);
});

it('risk:security the legacy round-1 dispatch also runs the security critic on a sensitive: path (ST-LN-91 D-21)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const legacy = planFiles(runtime, 'legacy-round1.md');
    if (legacy.length === 0) bad.push(runtime + ': plan/legacy-round1.md is missing');
    if (legacy.length !== skillDirs(config(runtime)).length) bad.push(runtime + ': expected one render of plan/legacy-round1.md per skill directory, found ' + legacy.length);
    for (const f of legacy) {
      const lines = f.text.split('\n');
      const at = lines.findIndex((l) => /^- /.test(l) && l.includes('lens `security`'));
      if (at < 0) {
        bad.push(f.path + ' has no list item dispatching lens `security`');
        continue;
      }
      let end = at + 1;
      while (end < lines.length && /^\s+\S/.test(lines[end])) end++;
      const item = flat(lines.slice(at, end).join(' '));
      for (const p of ['auth', 'money', 'migration', 'data deletion', '`sensitive:`']) if (!item.includes(p)) bad.push(f.path + ' security item lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

// ST-LN-91 91p-ac-1, 91p-ac-2, D-09: the planner writes what gate plan's format rules check (an `after:` line per task, the interfaces between tasks in an
// `interfaces` block and no other fenced block, at most 120 non-blank lines, what and not how), and the plan skill names the `after:` line.
const plannerOf = (): string => agents('claude').find((f) => f.path === '.claude/agents/accord-planner.md')?.text ?? '';

it('risk:regression the planner writes each task\'s after: line, interfaces in an interfaces block and no other code (ST-LN-91 91p-ac-1)', () => {
  const text = plannerOf();
  expect(text.length, 'accord-planner.md is missing from the render').toBeGreaterThan(0);
  expect(
    lacks(flat(text), [
      'each with these four lines',
      'covers: @ac-1, D-02',
      'after: 1, 2',
      'or `after: none` when it follows none',
      'its first line is exactly three backticks and the word interfaces, at column 0',
      'the first line after it that is exactly three backticks, at column 0, closes it',
      'No other line of a task starts with three backticks or tildes, even after spaces, a list marker or',
      'at most 120 non-blank lines',
      'says what, never how',
    ]),
  ).toEqual([]);
  // the example block carries all four lines, in the order the plan skill lists them
  const fence = text.split('```')[1] ?? '';
  expect(fence.split('\n').filter((l) => /^(covers|files|verify|after):/.test(l)).map((l) => l.split(':')[0])).toEqual(['covers', 'files', 'verify', 'after']);
  // the body, counted as agents.test.ts counts it (marker removed, split at the frontmatter), does not grow past the 60 lines it had when plan 03-11 began (59 by awk)
  const body = withoutMarker(text).split('\n---\n').slice(1).join('\n---\n');
  expect(body.split('\n').length).toBeLessThanOrEqual(60);
});

it('risk:regression the plan skill names the after: line (ST-LN-91 91p-ac-2)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = planFiles(runtime, 'SKILL.md');
    if (files.length === 0) bad.push(runtime + ': accord-plan/SKILL.md is missing');
    for (const f of files) {
      if (!/`covers:` line, a `files:` line, a\s+`verify:` line, and an `after:` line/.test(f.text)) bad.push(f.path + ' does not list the after: line beside covers: and verify:');
      if (f.text.split('\n').length > 120) bad.push(f.path + ' is over 120 lines');
      if (Buffer.byteLength(f.text) > 6000) bad.push(f.path + ' is over 6000 bytes');
    }
  }
  expect(bad).toEqual([]);
});

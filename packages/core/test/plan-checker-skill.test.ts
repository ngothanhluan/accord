// ST-LN-91 91p-ac-4 and D-12, D-16, D-19, D-21: the plan skill dispatches one plan checker and the security critic in round 1,
// a ticket claimed under an older accord keeps the 0.4.0 split in plan/legacy-round1.md alone, asserted over the RENDERED
// text of every tool a runtime loads (skillTargets and agentTargets), not the source files.
import { expect, it } from 'vitest';
import { agentTargets, skillTargets } from '../src/index.js';
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

it('risk:regression the grounds rule asks the plan checker from round 1 (ST-LN-91 D-19)', () => {
  const critic = criticOf();
  expect(lacks(critic, ['From round 2 (accord 0.4.1 and later), and from round 1 when you are the plan checker, every Must or Should gives `rests on:`'])).toEqual([]);
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    for (const f of planFiles(runtime, 'critique.md'))
      for (const p of lacks(flat(f.text), [
        'From round 2 (accord 0.4.1 and later), and from round 1 under the plan checker when `accord round <id> --plan` refuses round 2 naming such a finding, a new Must or Should with none of the marks above is marked `deferred` too',
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

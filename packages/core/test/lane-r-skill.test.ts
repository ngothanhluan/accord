// ST-LN-94 94-ac-5, D-10, D-11, D-13, D-14, D-20: the lane skill routes a question to lane R, and lane-r.md works it to a
// research record within the owner's allowance. Asserted over the rendered text every runtime loads (four tools, two folders).
import { describe, expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const all: AccordConfig = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude', 'codex', 'cursor', 'copilot'],
};

const rendered = new Map(skillTargets(all).map((f) => [f.path, f.text]));
const raw = (p: string): string => rendered.get(p) ?? '';
const flat = (p: string): string => raw(p).replace(/\s+/g, ' ');
const dirs = skillDirs(all);

describe('lane R in the accord skill', () => {
  it('renders to both skill folders of the four tools', () => {
    expect(dirs).toEqual(['.agents/skills', '.claude/skills']);
  });

  it('risk:regression the lane skill routes a question-only request to lane R in all four tools (ST-LN-94 94-ac-5)', () => {
    for (const dir of dirs) {
      const lane = flat(dir + '/accord/lane.md');
      expect(lane.length, dir + '/accord/lane.md').toBeGreaterThan(0);
      const r = lane.slice(0, lane.indexOf('1. For every new request'));
      for (const x of ['only asks a question', 'asks for no change to code, docs or configuration', 'is lane R', 'propose lane R with that reason', 'without the scout of step 1', '`lane-r.md`', 'The owner may override'])
        expect(r, dir + '/accord/lane.md: ' + x).toContain(x);

      const acc = flat(dir + '/accord/SKILL.md');
      const table = acc.slice(acc.indexOf('| Lane | Example |'), acc.indexOf('- **S.**'));
      expect(table).toContain('| R: research | a question to answer, ending in a research record |');
      const rLine = acc.slice(acc.indexOf('- **R.**'), acc.indexOf('- **L and P.**'));
      expect(acc.indexOf('- **R.**'), dir + ': no R line').toBeGreaterThan(acc.indexOf('- **M.**'));
      for (const x of ['`accord new ticket <id> --lane R --worktree`', '`people`', '`--type <story|bug>`', '`./lane-r.md`']) expect(rLine, x).toContain(x);
      const cont = acc.slice(acc.indexOf('4. Otherwise'), acc.indexOf('## Pick up'));
      expect(cont).toContain('when it prints `Lane: R`, follow `./lane-r.md`');
      expect(cont.indexOf('`./lane-r.md`')).toBeLessThan(cont.indexOf('first run `accord gate ready <id>`'));

      expect(raw(dir + '/accord/lane-r.md').length, dir + '/accord/lane-r.md is not rendered').toBeGreaterThan(0);
      // the lane proposal is shared with accord-intent, whose folder holds no lane-r.md: no dead ./ reference there (D-110)
      expect(flat(dir + '/accord-intent/lane.md')).not.toContain('./lane-r.md');
    }
  });

  it('risk:regression lane-r.md works a question to a research record within its budget (ST-LN-94 94-ac-5)', () => {
    for (const dir of dirs) {
      const r = flat(dir + '/accord/lane-r.md');
      expect(r.length, dir + '/accord/lane-r.md').toBeGreaterThan(0);
      for (const x of [
        '# Lane R: a question',
        '`## Question`',
        "in the owner's words",
        'a faithful English translation',
        '`## Timebox`',
        '`## Token budget`',
        '`<n> minutes` or `<n> hours`',
        '`<n> weighted tokens`',
        'the owner sets both',
        'with no recommended value',
        'you propose none',
        '`## Decisions`',
        '`- D-nn Timebox <value>, token budget <value> — "<the owner\'s sentence>"`',
        '`accord gate ready <id>`',
        '`ac_hash:`',
        '`accord budget <id>`',
        'before each new dispatch or script run, and at least between steps',
        '`within budget`',
        '`stop: ask owner`',
        '`not measured`',
        'only the time decides',
        'do no more research until the owner answers',
        'whether to write the record now from what the research has',
        'or to extend `## Timebox` or `## Token budget`',
        '`Owner: write now — "<the owner\'s sentence>"`',
        '`Owner: extended to <value> — "<the owner\'s sentence>"`',
        'run `accord gate ready <id>` again',
        '`packages/`',
        'a new lane S or M ticket',
        '`accord/research/<YYYY-MM-DD>-<topic>.md`',
        '`Date: <YYYY-MM-DD>`',
        '`Repository at <sha>`',
        '`Spent:`',
        '`research:`',
        '`accord gate done <id>`',
        "It waits for the owner's merge",
        'the ticket is done once the record merges',
        '`./finish.md`',
        '`accord worktree open <id>`',
        '`Lane: R`',
      ])
        expect(r, dir + '/accord/lane-r.md: ' + x).toContain(x);
      for (const x of ['accord-approach', 'accord-plan', 'accord-critic', 'accord-review', 'accord-verify', 'accord approve', 'accord worktree merge'])
        expect(r, dir + '/accord/lane-r.md names ' + x).not.toContain(x);
      // D-13: the owner sets the allowance; the step that asks for it recommends nothing
      const ask = r.slice(r.indexOf('**Allowance.**'), r.indexOf('**Research.**'));
      expect(ask.length).toBeGreaterThan(0);
      expect(ask).not.toMatch(/\brecommend(?:ed|s)? (?:a |the )?(?:timebox|budget|value)\b/i);
      // D-11: the stop comes before any further research and needs the owner's answer
      const stop = r.slice(r.indexOf('**Stop.**'), r.indexOf('**Record.**'));
      expect(stop).toContain('`stop: ask owner`');
      expect(stop).toContain('do no more research until the owner answers');
    }
  });

  it('risk:regression accord/SKILL.md stays within 120 lines and 6000 bytes in all four tools with lane R (ST-LN-94 94-ac-5)', () => {
    for (const dir of dirs) {
      const text = raw(dir + '/accord/SKILL.md');
      expect(text.length).toBeGreaterThan(0);
      expect(new TextEncoder().encode(text).length, dir).toBeLessThanOrEqual(6000);
      expect(text.split('\n').length, dir).toBeLessThanOrEqual(120);
      expect(text).toContain('./lane-r.md');
    }
  });
});

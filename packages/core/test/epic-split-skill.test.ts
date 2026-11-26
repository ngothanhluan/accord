// Phase 15 15-19 (999.60 decisions 1 to 3, D-01, D-02, SC-1): the split step of `/accord` reads the code once with the scout, chains stories that touch
// the same code, starts a new-code epic with a foundation story and runs one critic pass in mode `split` before the owner sees the split.
// Asserted over the RENDERED text of every tool a runtime loads (skillTargets, agentTargets), not the source files.
import { expect, it } from 'vitest';
import { agentTargets, skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { stagePath } from './helpers/stage-files.js';

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
/** Every render of the epic file under a runtime: one per skill directory the runtime loads. */
const epicFiles = (runtime: AccordConfig['runtimes'][number]) => {
  const wanted = new Set(skillDirs(config(runtime)).map((dir) => stagePath('new', 'epic', dir)));
  return skillTargets(config(runtime)).filter((f) => wanted.has(f.path));
};
const criticFiles = (runtime: AccordConfig['runtimes'][number]) => agentTargets(config(runtime)).filter((f) => /accord-critic\.md$/.test(f.path));
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));

it('risk:regression the split step runs the scout once, checks its reply with no ticket and chains stories that touch the same code in all four tools (D-02)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = epicFiles(runtime);
    if (files.length === 0) bad.push(runtime + ': ' + stagePath('new', 'epic') + ' is not rendered');
    for (const f of files) {
      const text = flat(f.text);
      for (const p of lacks(text, [
        'dispatch `accord-scout` once for the whole epic',
        'accord scout check "<file>"',
        'no `--ticket`',
        'no id exists yet',
        'the files and folders it is likely to touch',
        '`touches`',
        'a folder ends in `/`',
        'wait for each other with `after`',
        'the command refuses the split when they do not',
      ]))
        bad.push(f.path + ' lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression a new-code epic starts with a foundation story that fixes the interfaces (999.60 decision 3)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    for (const f of epicFiles(runtime)) {
      const text = flat(f.text);
      for (const p of lacks(text, ['most of the code the epic needs does not exist yet', 'story 1 is a foundation story that fixes the interfaces', 'every other story waits for it']))
        bad.push(f.path + ' lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression the split gets one critic pass in mode split before the owner sees it, and no second round (D-01)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    for (const f of epicFiles(runtime)) {
      const text = flat(f.text);
      for (const p of lacks(text, ['dispatch `accord-critic` once in mode `split`', 'the split file and the checked scout reply', 'There is no second round', 'The epic itself gets no approach and no plan critique']))
        bad.push(f.path + ' lacks ' + p);
      if (text.split('accord-critic').length !== 2) bad.push(f.path + ' names accord-critic ' + (text.split('accord-critic').length - 1) + ' times, not once');
      // the order: the interview, the scout, the check, the critic, the owner's yes, the command
      const at = (p: string): number => text.indexOf(p);
      const order = ['for whom', 'dispatch `accord-scout`', 'accord scout check "<file>"', 'dispatch `accord-critic`', 'explicit yes', '`accord new ticket --type epic --lane L --split <file> --queue`'];
      for (let i = 1; i < order.length; i++) if (!(at(order[i - 1]) >= 0 && at(order[i - 1]) < at(order[i]))) bad.push(f.path + ': ' + order[i - 1] + ' does not come before ' + order[i]);
      // the split file is written before the critic reads it, and it names touches
      if (!/split file[^.]*`touches`|`touches`[^.]*split file/.test(text)) bad.push(f.path + ' does not name touches among the split file keys');
      if (!(at('outside the working tree') >= 0 && at('outside the working tree') < at('dispatch `accord-critic`'))) bad.push(f.path + ' writes the split file after the critic runs');
    }
  }
  expect(bad).toEqual([]);
});

// Agents render for Claude Code only (the other three get none, as agents.test.ts asserts), so the critic is read from the Claude render.
it('risk:regression the critic names mode split with the three checks of D-01 (D-01)', () => {
  const bad: string[] = [];
  for (const runtime of ['claude'] as const) {
    const files = criticFiles(runtime);
    if (files.length === 0) bad.push(runtime + ': no accord-critic file is rendered');
    for (const f of files) {
      const text = flat(f.text);
      for (const p of lacks(text, [
        'Your caller names one mode, `approach`, `plan`, `diff`, or `split`',
        'Mode `split`:',
        'stories that edit the same code without a `depends_on`',
        'missed logical dependencies',
        'stories that cannot stand alone',
        'There is no second round',
      ]))
        bad.push(f.path + ' lacks ' + p);
      const block = text.slice(text.indexOf('Mode `split`:'), text.indexOf('Do not critique'));
      if (block.length === 0 || text.indexOf('Mode `split`:') < text.indexOf('Mode `diff`:')) bad.push(f.path + ': the split mode block is missing or comes before the diff mode');
    }
  }
  expect(bad).toEqual([]);
});

// ST-LN-91 91d-ac-4 (discuss part): the intent skill runs the discuss stage after the interview, asserted over the
// RENDERED text of every tool a runtime loads, and the planner's discuss mode lists the gray areas without a file.
import { expect, it } from 'vitest';
import { agentTargets, installedName, skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const all: AccordConfig = {
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: ['claude', 'codex', 'cursor', 'copilot'],
};

const flat = (text: string): string => text.replace(/\s+/g, ' ');
const rendered = new Map(skillTargets(all).map((f) => [f.path, f.text]));
const agents = new Map(agentTargets(all).map((f) => [f.path, f.text]));

it('risk:regression the intent skill runs discuss after the interview in all four tools (ST-LN-91 91d-ac-4)', () => {
  const dirs = skillDirs(all);
  expect(dirs).toEqual(['.agents/skills', '.claude/skills']);
  const bad: string[] = [];
  for (const dir of dirs) {
    const skill = flat(rendered.get(dir + '/' + installedName('intent') + '/SKILL.md') ?? '');
    if (!skill) {
      bad.push(dir + ': accord-intent/SKILL.md is missing');
      continue;
    }
    const from = skill.indexOf('9. **Discuss.**');
    const to = skill.indexOf('10. Next');
    if (from < 0 || to < from) {
      bad.push(dir + ': step 9 is not the discuss step');
      continue;
    }
    const step = skill.slice(from, to);
    for (const p of ['`accord gate ready <id>`', '`gate.discuss-missing`', '`gate.discuss-unmapped`', '`./discuss.md`', 'claimed before the discuss stage', 'the owner approves once, at accord-approach step 5'])
      if (!step.includes(p)) bad.push(dir + ' step 9 lacks ' + p);
    if (step.includes('--approval')) bad.push(dir + ' step 9 still shows the approval view');
    if (step.includes('explicit yes')) bad.push(dir + ' step 9 still asks for a yes');
    if (!(rendered.get(dir + '/' + installedName('intent') + '/discuss.md') ?? '')) bad.push(dir + ': discuss.md is not rendered');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the discuss stage asks every gray area one at a time and writes each answer as a Decision (ST-LN-91 91d-ac-4)', () => {
  const GROUPS = ['direction options', 'behaviour and output', 'failure and data loss', 'scope edges', 'interfaces', 'measurement rules or heuristics', 'test strategy'];
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const text = flat(rendered.get(dir + '/' + installedName('intent') + '/discuss.md') ?? '');
    if (!text) {
      bad.push(dir + ': discuss.md is missing');
      continue;
    }
    for (const p of ['accord-planner', '`discuss` mode', ...GROUPS, 'recommended', 'consequence', 'one at a time', './ask.md', '## Decisions', 'D-nn', 'accord/tickets/<id>/discuss.md', '## Gray areas', 'with no cap', "the owner's sentence", 'Never answer, merge or skip a gray area for the owner'])
      if (!text.includes(p)) bad.push(dir + ' discuss.md lacks ' + p);
  }
  expect(bad).toEqual([]);
});

it('risk:regression the planner lists gray areas in its discuss mode and writes no file (ST-LN-91 91d-ac-4)', () => {
  const text = agents.get('.claude/agents/accord-planner.md') ?? '';
  expect(text.length, 'accord-planner.md is missing from the render output').toBeGreaterThan(0);
  const body = flat(text);
  for (const p of ['`discuss` mode', 'writes no file', 'direction options', 'behaviour and output', 'failure and data loss', 'scope edges', 'interfaces', 'measurement rules or heuristics', 'test strategy', 'recommends first'])
    expect(body, p).toContain(p);
  const lines = text.split('\n');
  const end = lines.indexOf('---', 1);
  const marker = lines.findIndex((l, i) => i > end && l.startsWith('<!--'));
  const bodyLines = lines.slice(end + 1, marker < 0 ? undefined : marker);
  expect(bodyLines.length).toBeLessThanOrEqual(60);
});

it('risk:regression Continue resumes a ticket whose intent is written at intent step 9 (ST-LN-91 91d-ac-4)', () => {
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const text = flat(rendered.get(dir + '/' + installedName('accord') + '/SKILL.md') ?? '');
    const from = text.indexOf('## Continue');
    const to = text.indexOf('## Pick up');
    const step = text.slice(from, to);
    if (from < 0 || to < from) {
      bad.push(dir + ': Continue section not found');
      continue;
    }
    const approach = step.indexOf('at step 3 when it holds only');
    const intent = step.indexOf("otherwise `accord-intent`, at step 9 when the anchor's next step is the owner's approval");
    if (intent < 0) bad.push(dir + ': Continue does not send stage intent to step 9');
    if (approach < 0 || intent < approach) bad.push(dir + ': the step 9 route is not after the two approach checks');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the owner approves once from the short view in all four tools (ST-LN-91 91d-ac-4)', () => {
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const skill = flat(rendered.get(dir + '/' + installedName('approach') + '/SKILL.md') ?? '');
    const text = flat(rendered.get(dir + '/' + installedName('approach') + '/approval.md') ?? '');
    if (!skill) bad.push(dir + ': accord-approach/SKILL.md is missing');
    if (!text) {
      bad.push(dir + ': approval.md is missing');
      continue;
    }
    const from = skill.indexOf("5. **The owner's yes.**");
    const to = skill.indexOf('6. Next');
    const step = skill.slice(from, to);
    if (from < 0 || to < from) bad.push(dir + ': approach step 5 is not the owner\'s yes');
    else if (!step.includes('./approval.md')) bad.push(dir + ' approach step 5 does not name ./approval.md');
    if (!skill.includes('approach/approval.md') && !skill.includes('./approval.md')) bad.push(dir + ' approach SKILL.md does not name approval.md');
    for (const p of [
      '`accord show <id> --approval --short`',
      'not inside a code block',
      'horizontal rule',
      'In plain words',
      'one line per scenario that begins with its ac-n',
      'ask for an explicit yes',
      '`accord/tickets/<id>.md`',
      "the yes approves the ticket's Intent, acceptance criteria, Vetoes, Decisions, Corrections and Approach as written",
      'the view shortens and the file holds in full',
      '`accord approve <id>`',
      '`accord gate ready <id>`',
      'Never run `accord approve` without the owner\'s yes in this conversation',
    ])
      if (!text.includes(p)) bad.push(dir + ' approval.md lacks ' + p);
    if (text.includes('`accord show <id> --approval`')) bad.push(dir + ' approval.md still runs the full view');
  }
  expect(bad).toEqual([]);
});

it('risk:regression the approach critic runs at most twice from the cut-off (ST-LN-91 91d-ac-4)', () => {
  const bad: string[] = [];
  for (const dir of skillDirs(all)) {
    const text = flat(rendered.get(dir + '/' + installedName('approach') + '/critique.md') ?? '');
    if (!text) {
      bad.push(dir + ': critique.md is missing');
      continue;
    }
    for (const p of [
      'from accord 0.4.1 the cap is two rounds',
      'round 1 reads the whole `## Approach` against the ticket, the Decisions discuss wrote included',
      'round 2 checks only the fixes',
      '`Findings still open:`',
      'write those findings into `## Approach` as risks',
      'no Ruling allows a third round',
      'a ticket claimed under an older accord',
      'prints `of 5`',
      'the cap of five',
      'Blocking findings:',
    ])
      if (!text.includes(p)) bad.push(dir + ' critique.md lacks ' + p);
  }
  expect(bad).toEqual([]);
});

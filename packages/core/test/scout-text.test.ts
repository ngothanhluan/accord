// ST-LN-81 task 7: the scout prompt and the scout steps write the report form `accord scout check` parses.
import { expect, it } from 'vitest';
import { agentTargets, parseScoutReport, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] }) as AccordConfig;
const flat = (text: string): string => text.replace(/\s+/g, ' ');
const agentText = (): string => agentTargets(config()).find((f) => f.path === '.claude/agents/accord-scout.md')?.text ?? '';
const skillText = (path: string): string => skillTargets(config()).find((f) => f.path === path)?.text ?? '';

it('risk:parsing the scout prompt and the scout steps write the report form accord scout check parses', () => {
  const agent = agentText();
  expect(agent.length, 'accord-scout.md is missing from the render output').toBeGreaterThan(0);
  const fence = /```markdown\n([\s\S]*?)\n```/.exec(agent);
  expect(fence, 'the scout prompt holds no markdown fence').not.toBeNull();
  const report = parseScoutReport(fence?.[1] ?? '');
  expect(report.faults).toEqual([]);
  expect((report.files ?? []).length).toBeGreaterThan(0);
  expect(report.absent).toHaveLength(1);
  const row = report.absent[0];
  expect(row?.folders.length).toBeGreaterThan(0);
  expect(row?.allowed.length).toBeGreaterThan(0);
  expect(() => new RegExp(row?.pattern ?? '')).not.toThrow();

  for (const phrase of [
    'search logged',
    'never "proven absent"',
    '| Claim | Pattern | Folders | Allowed hits |',
    'in full from the repository root',
    'Open every file the question names',
  ]) {
    expect(flat(agent), phrase).toContain(phrase);
  }

  for (const dir of ['accord', 'accord-intent']) {
    const scoutMd = flat(skillText(`.claude/skills/${dir}/scout.md`));
    expect(scoutMd.length, `${dir}/scout.md is missing`).toBeGreaterThan(0);
    for (const phrase of [
      '## New files',
      'skipped: <reason>',
      'accord scout check "<file>"',
      'before you follow the `enter:` or `stop:` line',
      'the reply to another question never replaces a saved report',
    ]) {
      expect(scoutMd, `${dir}/scout.md`).toContain(phrase);
    }
    for (const file of ['SKILL.md', 'lane.md']) {
      expect(flat(skillText(`.claude/skills/${dir}/${file}`)), `${dir}/${file}`).toContain('`./scout.md`');
    }
  }

  expect(flat(skillText('.claude/skills/accord/worktree.md'))).toContain(
    "except the people entry below, the scout's report `accord/tickets/<id>/scout.md` with the commit and push that save it",
  );
});

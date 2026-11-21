// ST-LN-81 task 7: the scout prompt and the scout steps write the report form `accord scout check` parses.
import { expect, it } from 'vitest';
import { agentTargets, parseScoutReport, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';
import { besidePath, stagePath } from './helpers/stage-files.js';

const config = (): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] }) as AccordConfig;
const flat = (text: string): string => text.replace(/\s+/g, ' ');
const agentTextAt = (path: string): string => agentTargets(config()).find((f) => f.path === path)?.text ?? '';
const agentText = (): string => agentTextAt('.claude/agents/accord-scout.md');
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

  for (const name of ['new', 'intent']) {
    const scoutMd = flat(skillText(besidePath(name, 'scout.md')));
    expect(scoutMd.length, `${besidePath(name, 'scout.md')} is missing`).toBeGreaterThan(0);
    for (const phrase of [
      '## New files',
      'skipped: <reason>',
      'accord scout check "<file>"',
      'before you follow the `enter:` or `stop:` line',
      'the reply to another question never replaces a saved report',
    ]) {
      expect(scoutMd, besidePath(name, 'scout.md')).toContain(phrase);
    }
    for (const file of ['SKILL.md', 'lane.md']) {
      const path = file === 'SKILL.md' ? stagePath(name) : besidePath(name, file);
      expect(flat(skillText(path)), path).toContain('`./scout.md`');
    }
  }

  // ST-LN-69 7-ac-12: the stop block's next action names the scout's report as the one file a stopped session may edit (packages/cli/test/next-action.test.ts)
  expect(flat(skillText('.claude/skills/accord/worktree.md'))).toContain('do what it says');
});

it('risk:complex-branching the approach and build stages send an approve refusal back to the scout steps', () => {
  const approach = flat(skillText(stagePath('approach')));
  const skillStep5 = approach.slice(approach.indexOf("5. **The owner's yes.**"), approach.indexOf('6. Next'));
  expect(skillStep5.length, 'approach step 5 is missing').toBeGreaterThan(0);
  // ST-LN-91 plan 03-05: step 5 only names ./approach-approval.md, where the scout check and the show step live, so the check is read there.
  expect(skillStep5, 'approach step 5 does not name ./approach-approval.md').toContain('`./approach-approval.md`');
  const step5 = flat(skillText(stagePath('approach', 'approval')));
  expect(step5.length, 'approach approval.md is missing').toBeGreaterThan(0);
  const check = step5.indexOf('accord scout check "accord/tickets/<id>/scout.md"');
  expect(check, 'approach step 5 does not run the check').toBeGreaterThanOrEqual(0);
  expect(check, 'the check comes before accord show').toBeLessThan(step5.indexOf('accord show <id> --approval'));
  expect(step5).toContain('`./scout.md`');
  expect(step5).toContain('when `accord approve` exits 1');

  const build = flat(skillText(stagePath('build')));
  const step6 = build.slice(build.indexOf('6. **Change of course.**'), build.indexOf('7. **Plan changed.**'));
  expect(step6.length, 'build step 6 is missing').toBeGreaterThan(0);
  expect(step6).toContain('When `accord approve` exits 1, follow `./scout.md`.');

  for (const name of ['approach', 'build']) {
    const scoutMd = flat(skillText(besidePath(name, 'scout.md')));
    expect(scoutMd.length, `${besidePath(name, 'scout.md')} is missing`).toBeGreaterThan(0);
    for (const phrase of [
      'When `accord approve <id>` exits 1 naming `scout.md`',
      "the owner's yes still holds",
      'as of the commit that last changed it, or on the working tree while the file has uncommitted changes',
      "then `accord worktree push <id>`, all before the owner's yes",
    ]) {
      expect(scoutMd, besidePath(name, 'scout.md')).toContain(phrase);
    }
  }

  expect(flat(agentTextAt('.claude/agents/accord-planner.md'))).toContain(
    'Start from `accord/tickets/<id>/scout.md` when it exists, then run your own search.',
  );
});

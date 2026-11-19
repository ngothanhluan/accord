// ST-LN-37 37-ac-2 (D-03): verify's ci.md reads the default branch's rules with gh and gives the owner one line on whether
// the accord check is required and branches must be up to date. Asserted over the RENDERED text of every tool a runtime
// loads (skillTargets), not the source file, so a runtime that lost the section fails by name.
import { expect, it } from 'vitest';
import { skillTargets } from '../src/index.js';
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
/** Every render of verify's ci.md under a runtime: one per skill directory the runtime loads. */
const ciFiles = (runtime: AccordConfig['runtimes'][number]) =>
  skillTargets(config(runtime)).filter((f) => f.path.endsWith('/accord-verify/ci.md'));
/** The phrases a text lacks, so a failing case names each one. */
const lacks = (text: string, parts: readonly string[]): string[] => parts.filter((p) => !text.includes(p));
/** The Required check section of a rendered ci.md: from its heading to the next `## ` heading. */
const requiredSection = (text: string): string => {
  const from = text.indexOf('## Required check');
  if (from < 0) return '';
  const next = text.indexOf('\n## ', from + 1);
  return next < 0 ? text.slice(from) : text.slice(from, next);
};

it('risk:regression verify reads the default branch\'s rules and reports one line on the required check and up-to-date branches (ST-LN-37 37-ac-2)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = ciFiles(runtime);
    if (files.length === 0) bad.push(runtime + ': accord-verify/ci.md is missing');
    for (const f of files) {
      const [wait, required, finish] = ['## Wait', '## Required check', '## Finish'].map((h) => f.text.indexOf(h));
      if (!(wait > -1 && wait < required && required < finish)) bad.push(`${f.path}: ## Required check is not between ## Wait and ## Finish`);
      const section = flat(requiredSection(f.text));
      for (const p of lacks(section, [
        'gh repo view --json defaultBranchRef',
        '^[A-Za-z0-9][A-Za-z0-9._/-]*$',
        'gh run view <run-id> --json jobs',
        'rules/branches/',
        'strict_required_status_checks_policy',
        '.protection',
        '/protection',
        'enforcement_level',
        'equals',
        'never a prefix, a substring or `<workflow> / <job>`',
        'a failed read is not checked, never no',
        'accord check required: yes|no|not checked (<reason>); branches must be up to date: yes|no|not checked (<reason>)',
        'Make the accord check a merge gate',
        'accord init',
      ]))
        bad.push(f.path + ' lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

/** The rendered finish.md of a runtime, under accord-verify and under the accord skill (lane S). */
const finishReports = (runtime: AccordConfig['runtimes'][number]) =>
  skillTargets(config(runtime)).filter((f) => f.path.endsWith('/accord-verify/finish.md') || f.path.endsWith('/accord/finish.md'));

it('risk:regression verify waits for the accord check on the tick commit and reports its verdict at finish (ST-LN-37 37-ac-1)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = ciFiles(runtime);
    if (files.length === 0) bad.push(runtime + ': accord-verify/ci.md is missing');
    for (const f of files) {
      const text = flat(f.text);
      const finish = text.slice(text.indexOf('## Finish'));
      const ready = finish.indexOf('`gh pr ready`');
      const step4 = finish.indexOf(' 4. ');
      if (!(ready > -1 && step4 > ready)) bad.push(`${f.path}: Finish has no step 4 after the step holding gh pr ready`);
      const section = step4 > -1 ? finish.slice(step4) : '';
      for (const p of lacks(section, [
        '`<tick>` is `git rev-parse HEAD`',
        'gh run list --commit <tick>',
        'the workflow whose `name:` is in `.github/workflows/accord.yml`',
        'ten minutes',
        'thirty minutes',
        'gh run view <run-id> --json jobs',
        'gh run view <run-id> --log-failed',
        ': error <rule id>',
        './failure.md',
        'the fix commit leaves the tick bound to an older commit, so verify runs again',
        'accord check on <tick>: passed',
        'accord check on <tick>: failed: <rule ids>',
        'accord check on <tick>: not checked: <reason>',
      ]))
        bad.push(f.path + ' Finish step 4 lacks ' + p);
      if (finish.includes('Do not wait for CI again')) bad.push(f.path + ': Finish still says not to wait for CI again');
      if (!finish.includes('also finishes a session that stopped after the tick commit')) bad.push(f.path + ': Finish lost the sentence on a stopped session');
    }
    for (const f of finishReports(runtime)) if (!flat(f.text).includes("the accord check's verdict")) bad.push(f.path + " does not name the accord check's verdict among its status lines");
  }
  expect(bad).toEqual([]);
});

it('risk:regression the wait before the report still leaves the accord workflow out (ST-LN-37 37-ac-1)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = ciFiles(runtime);
    if (files.length === 0) bad.push(runtime + ': accord-verify/ci.md is missing');
    for (const f of files) {
      const text = flat(f.text);
      const wait = text.slice(text.indexOf('## Wait'), text.indexOf('## Required check'));
      for (const p of lacks(wait, [
        'Leave out the workflow whose `name:` is in `.github/workflows/accord.yml`',
        'never send it to debug',
        'red by construction',
        'Finish step 4 waits for it on the tick commit',
      ]))
        bad.push(f.path + ' Wait lacks ' + p);
    }
  }
  expect(bad).toEqual([]);
});

it('risk:regression verify changes no GitHub setting (ST-LN-37 37-ac-2)', () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = ciFiles(runtime);
    if (files.length === 0) bad.push(runtime + ': accord-verify/ci.md is missing');
    for (const f of files) {
      const section = requiredSection(f.text);
      if (section === '') bad.push(f.path + ': no Required check section');
      // Every `gh api` call in the file is a read: none holds a method flag or a write verb.
      for (const m of f.text.matchAll(/gh api[^\n]*/g))
        if (/(^|\s)(-X|--method|-f|-F|--field|--raw-field|--input)(\s|$)|\b(PUT|POST|PATCH|DELETE)\b/.test(m[0])) bad.push(`${f.path}: ${m[0]}`);
      if (/(^|\s)(-X|--method)(\s|$)|\b(PUT|POST|PATCH|DELETE)\b/.test(section)) bad.push(f.path + ': the Required check section names a write verb');
      if (!flat(section).includes('verify changes no GitHub setting')) bad.push(f.path + ' lacks "verify changes no GitHub setting"');
    }
  }
  expect(bad).toEqual([]);
});

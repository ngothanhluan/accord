// ST-LN-50 t2-ac-7, t2-ac-6, D-10: `template.sections` on real files. A new ticket carries the team's sections, lint accepts a ticket that holds them and one written
// before the config change, a section that replaces a required one or names acceptance criteria is refused by lint and by accord config, and with no `template`
// key a new ticket is byte-identical to today's.
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { insertTeamSections, setFrontmatterKey, templates } from '@accord-dev/accord-core';
import { makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const repos: string[] = [];
afterEach(() => {
  // no retries: nothing here holds a handle on the folder, and one that did would be a bug to see
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

const TEAM = CONFIG + 'template:\n  sections:\n    - name: Problem\n      after: Intent\n';
const sandbox = (config: string): string => {
  const repo = makeLaneRepo({ 'accord/config.yml': config });
  repos.push(repo);
  return repo;
};
const read = (repo: string, rel: string): string => readFileSync(join(repo, rel), 'utf8');
const headings = (text: string): string[] => [...text.matchAll(/^## (.*)$/gm)].map((m) => m[1]);
const lintFound = async (repo: string): Promise<{ code: number; found: { rule: string; level: string; file?: string; pointer?: string; reason: string }[] }> => {
  const r = await run(['lint', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out) as { findings: { rule: string; level: string; file?: string; pointer?: string; reason: string }[] }).findings };
};

it('risk:complex-branching a new ticket carries the team\'s sections and lint accepts it (ST-LN-50 t2-ac-7)', async () => {
  const repo = sandbox(CONFIG);
  expect((await lintFound(repo)).code).toBe(0);

  // a ticket written before the config change, and the config change itself
  writeFiles(repo, { 'accord/config.yml': TEAM });
  expect((await lintFound(repo)).code).toBe(0);

  // the new ticket: ## Problem directly after ## Intent
  const made = await run(['new', 'ticket', 'T-2', '--lane', 'M', '--no-dup-check'], repo);
  expect(made.err).toBe('');
  expect(made.code).toBe(0);
  const text = read(repo, 'accord/tickets/T-2.md');
  expect(headings(text)).toEqual(['Intent', 'Problem', 'Acceptance criteria', 'Vetoes', 'Decisions', 'Corrections', 'Open questions', 'Approach']);
  expect(text).toContain('## Problem\n<!-- A team section from accord/config.yml template.sections; accord does not check its content. -->\n\n## Acceptance criteria\n');

  // the plain, bug and profile templates carry it too
  const bug = await run(['new', 'ticket', 'T-3', '--type', 'bug'], repo);
  expect(bug.code).toBe(0);
  expect(headings(read(repo, 'accord/tickets/T-3.md'))).toEqual(['Intent', 'Problem', 'Requirements', 'Acceptance criteria', 'Open questions', 'Plan', 'Verification notes']);

  // lint accepts a filled-in ticket that holds the team's sections, and the one written before the change
  writeFiles(repo, { 'accord/tickets/T-4.md': insertTeamSections(laneTicket('T-4'), [{ name: 'Problem', after: 'Intent' }, { name: 'Already on main' }]) });
  const lint = await lintFound(repo);
  const t4 = lint.found.filter((f) => f.file === 'accord/tickets/T-4.md');
  expect(t4.filter((f) => f.level === 'error')).toEqual([]);
  expect(lint.found.filter((f) => f.file === 'accord/tickets/T-1.md' && f.level === 'error')).toEqual([]);
  expect(lint.found.filter((f) => f.rule === 'lint.template-section')).toEqual([]);
}, 120_000);

it('risk:regression with no template key a new ticket is byte-identical to today\'s (ST-LN-50 t2-ac-6)', async () => {
  const repo = sandbox(CONFIG);
  expect((await run(['new', 'ticket', 'T-2', '--lane', 'M', '--no-dup-check'], repo)).code).toBe(0);
  const lane = setFrontmatterKey(setFrontmatterKey(templates['ticket-lane.md'].replaceAll('TICKET-ID', 'T-2'), 'type', 'story'), 'lane', 'M');
  expect(read(repo, 'accord/tickets/T-2.md')).toBe(lane);
  expect((await run(['new', 'ticket', 'T-3', '--lane', 'S', '--no-dup-check'], repo)).code).toBe(0);
  expect(read(repo, 'accord/tickets/T-3.md')).toBe(setFrontmatterKey(setFrontmatterKey(templates['ticket-lane-s.md'].replaceAll('TICKET-ID', 'T-3'), 'type', 'story'), 'lane', 'S'));

  // an epic never takes a team section
  const epicRepo = sandbox(TEAM);
  expect((await run(['new', 'ticket', 'E-1', '--type', 'epic', '--lane', 'P'], epicRepo)).code).toBe(0);
  expect(headings(read(epicRepo, 'accord/tickets/E-1.md'))).not.toContain('Problem');
}, 120_000);

it('risk:security a config that replaces a required section is refused (ST-LN-50 t2-ac-7)', async () => {
  const repo = sandbox(CONFIG + 'template:\n  sections:\n    - name: Acceptance criteria\n');

  // lint names the section at accord/config.yml
  const lint = await lintFound(repo);
  expect(lint.code).toBe(1);
  const found = lint.found.filter((f) => f.rule === 'lint.template-section');
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ file: 'accord/config.yml', level: 'error', pointer: '/template/sections/0/name' });
  expect(found[0].reason).toContain('Acceptance criteria');
  expect(lint.found.filter((f) => f.rule === 'lint.config-floor')).toEqual([]);

  // accord config check says the same and exits 2
  const check = await run(['config', 'check', '--json'], repo);
  expect(check.code).toBe(2);
  expect((JSON.parse(check.out) as { findings: { rule: string }[] }).findings.map((f) => f.rule)).toEqual(['lint.template-section']);

  // accord new ticket skips the reserved entry: no second Acceptance criteria
  expect((await run(['new', 'ticket', 'T-2', '--lane', 'M', '--no-dup-check'], repo)).code).toBe(0);
  expect(headings(read(repo, 'accord/tickets/T-2.md')).filter((h) => h === 'Acceptance criteria')).toHaveLength(1);

  // accord config set refuses a reserved name, names it, and leaves the file as it was
  const clean = sandbox(TEAM);
  const kept = read(clean, 'accord/config.yml');
  const refused = await run(['config', 'set', 'template.sections', '[{name: Vetoes}]'], clean);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('Vetoes');
  expect(refused.err).toContain('accord/config.yml was not changed');
  expect(read(clean, 'accord/config.yml')).toBe(kept);
  // a form key is refused by the schema, the file unchanged
  const form = await run(['config', 'set', 'template.sections', '[{name: Problem, form: checkbox}]'], clean);
  expect(form.code).toBe(2);
  expect(read(clean, 'accord/config.yml')).toBe(kept);
  // a plain team section is accepted
  const ok = await run(['config', 'set', 'template.sections', '[{name: Problem, after: Intent}, {name: Already on main}]'], clean);
  expect(ok.err).toBe('');
  expect(ok.code).toBe(0);
  expect(read(clean, 'accord/config.yml')).toContain('Already on main');
}, 120_000);

// Phase 8.1 G2 (D-01, D-03): `accord pr <id>` writes a pull request title and a body file from the team's template and the ticket; the skills only pass them to `gh pr create`.
// Real git in tmp sandboxes; nothing here reaches the real origin and `gh` is never spawned.
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, LANE_BODY, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeLaneRepo, mergeMsg, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const TEMPLATE = ['## Description', '<!-- What does this change? -->', '', '## Acceptance criteria', '', '## Screenshots', '<!-- add screenshots -->', ''].join('\n');

function sandbox(extra: Record<string, string> = {}): string {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG, ...extra });
  dirs.push(repo);
  commitAll(repo);
  return repo;
}

/** A sandbox whose default ref (origin/main) holds the fixture commit, so the commits of the branch can be listed. */
function onBranch(extra: Record<string, string> = {}): { repo: string; base: string } {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG, ...extra });
  dirs.push(repo);
  const base = commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  return { repo, base };
}

const bodyFile = (repo: string, id: string): string => join(repo, '.git', `accord-pr-${id}.md`);
const remaining = (out: string): string[] => out.split('\n').filter((l) => l.startsWith('remaining: ')).map((l) => l.slice('remaining: '.length));

it('risk:complex-branching accord pr writes a body from the team template that holds id title Intent and criteria (8.1-ac-1)', async () => {
  const repo = sandbox({ '.github/pull_request_template.md': TEMPLATE });
  const r = await run(['pr', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);

  const lines = r.out.trimEnd().split('\n');
  const file = /^body-file: (.+)$/m.exec(r.out)?.[1] ?? '';
  expect(lines.map((l) => l.split(':')[0])).toEqual(['title', 'body-file', 'template', 'remaining']);
  expect(lines[0]).toBe('title: T-1: Export');
  expect(file).not.toBe('');
  expect(file).not.toContain('\\');
  expect(lines[2]).toBe('template: .github/pull_request_template.md');
  expect(lines[3]).toBe('remaining: Screenshots');

  const body = readFileSync(file, 'utf8');
  for (const text of ['T-1', 'Export', 'Owners can export their report as CSV.', 'export writes a csv', 'commas are escaped']) expect(body, text).toContain(text);
  let at = -1;
  for (const heading of TEMPLATE.split('\n').filter((l) => l.startsWith('## '))) {
    const next = body.split('\n').indexOf(heading, at + 1);
    expect(next, `the heading ${heading} is kept in order`).toBeGreaterThan(at);
    at = next;
  }
});

it('risk:regression accord pr without a template or script writes the fixed body of today (8.1-ac-1)', async () => {
  const { repo, base } = onBranch();
  gitRun(repo, 'switch', '-q', '-c', 'side', base);
  commitMsg(repo, 'added on the side', undefined, true);
  gitRun(repo, 'switch', '-q', '-');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'src/export.ts': 'export const write = 2;\n' });
  commitMsg(repo, 'feat: add the csv writer');
  mergeMsg(repo, 'side', 'merge side'); // a merge commit is left out of the list

  const r = await run(['pr', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(r.out).toContain('template: none\n');
  expect(readFileSync(bodyFile(repo, 'T-1'), 'utf8')).toBe('- claim: T-1\n- feat: add the csv writer\n');

  // an epic queued on a backlog branch is read through withQueued, not from the checkout: its body is its Intent text
  gitRun(repo, 'switch', '-q', '-c', 'backlog/E-1-2026-11-20', base);
  writeFiles(repo, {
    'accord/tickets/E-1.md': ['---', 'id: "E-1"', 'title: "Reporting"', 'type: epic', 'status: draft', 'lane: L', 'ui: false', '---', '', '## Intent', 'Teams see every export in one place.', ''].join('\n'),
  });
  commitMsg(repo, 'backlog: queue E-1');
  gitRun(repo, 'switch', '-q', '-');
  expect(existsSync(join(repo, 'accord', 'tickets', 'E-1.md'))).toBe(false);
  const epic = await run(['pr', 'E-1'], repo);
  expect(epic.code, epic.out + epic.err).toBe(0);
  expect(epic.out).toContain('title: E-1: Reporting\n');
  expect(epic.out).toContain('template: none\n');
  expect(readFileSync(bodyFile(repo, 'E-1'), 'utf8')).toBe('Teams see every export in one place.\n');
}, 120_000);

it('risk:complex-branching accord pr reads lane S lane R and folder templates and refuses an unsafe title (D-01)', async () => {
  const folder = ['## Description', '', '## Acceptance criteria', ''].join('\n');
  const repo = sandbox({
    '.github/PULL_REQUEST_TEMPLATE/b.md': folder,
    '.github/PULL_REQUEST_TEMPLATE/A.md': folder,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
    'accord/tickets/R-1.md': laneTicket('R-1', { lane: 'R', body: '## Question\nWhich export format do teams use?\n\n## Timebox\n2 hours\n' }),
    'accord/tickets/Q-1.md': laneTicket('Q-1').replace('title: "Export"', "title: 'Say \"hi\"'"),
  });

  // lane S: Intent from ## Understood and criteria from ## Done when; a folder of two prints which one it took and how to choose
  const s = await run(['pr', 'S-1'], repo);
  expect(s.code, s.out + s.err).toBe(0);
  expect(s.out).toContain('template: .github/PULL_REQUEST_TEMPLATE/A.md (first of 2; set pr.template to choose)\n');
  const sBody = readFileSync(bodyFile(repo, 'S-1'), 'utf8');
  expect(sBody).toContain('The export button writes a csv file.');
  expect(sBody).toContain('Pressing export saves report.csv.');
  expect(remaining(s.out)).toEqual([]);

  // lane R: Intent from ## Question, no criteria, so that section is left for the agent
  const q = await run(['pr', 'R-1'], repo);
  expect(q.code, q.out + q.err).toBe(0);
  expect(readFileSync(bodyFile(repo, 'R-1'), 'utf8')).toContain('Which export format do teams use?');
  expect(remaining(q.out)).toEqual(['Acceptance criteria']);

  // pr.template names the other file of the folder: no "first of" note; one that is not tracked is exit 2 naming the key
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'pr:\n  template: .github/PULL_REQUEST_TEMPLATE/b.md\n' });
  const chosen = await run(['pr', 'S-1'], repo);
  expect(chosen.code, chosen.out + chosen.err).toBe(0);
  expect(chosen.out).toContain('template: .github/PULL_REQUEST_TEMPLATE/b.md\n');
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'pr:\n  template: .github/nope.md\n' });
  const missing = await run(['pr', 'S-1'], repo);
  expect(missing.code, missing.out + missing.err).toBe(2);
  expect(missing.err).toContain('pr.template');

  // the key is a tracked repository-relative path: a path out of the repository is refused by the schema, and a good one is stored
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  const out = await run(['config', 'set', 'pr.template', '../x.md'], repo);
  expect(out.code, out.out + out.err).toBe(2);
  expect(out.err).toContain('pr.template');
  expect((await run(['config', 'set', 'pr.template', '.github/PULL_REQUEST_TEMPLATE/b.md'], repo)).code).toBe(0);

  // a title that would break the quoted argument the skill passes to gh is exit 2 naming the character, and no body file is written
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  const bad = await run(['pr', 'Q-1'], repo);
  expect(bad.code, bad.out + bad.err).toBe(2);
  expect(bad.err).toContain('"');
  expect(bad.err).toContain('title');
  expect(existsSync(bodyFile(repo, 'Q-1'))).toBe(false);
}, 120_000);

it('risk:parsing accord pr writes not recorded for a scenario with no test tag and no verification block and lists the remaining sections (D-01)', async () => {
  const body = LANE_BODY.replace('@test:export#writes-csv', '@test:cart-coupon').replace('@ac-2 @test:export#escapes-commas', '@ac-2');
  const template = ['## Description', '<!-- what -->', '', '## Test plan', '<!-- how was it tested -->', '', '## Screenshots', '<!-- add -->', '', '## Checklist', '<!-- tick -->', ''].join('\n');
  const verification = ['---', 'ticket: T-1', 'commit: abc1234', 'reviewed_on: 2026-11-20', '---', '', '## @ac-1 export writes a csv', 'Result: pass', 'Evidence: ran it', ''].join('\n');
  const repo = sandbox({ 'accord/tickets/T-1.md': laneTicket('T-1', { body }), 'accord/tickets/T-1/verification.md': verification, '.github/pull_request_template.md': template });

  const r = await run(['pr', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);
  const plan = (text: string): string[] => text.split('\n').slice(text.split('\n').indexOf('## Test plan') + 1).filter((l) => l.startsWith('- '));
  const lines = plan(readFileSync(bodyFile(repo, 'T-1'), 'utf8'));
  expect(lines).toHaveLength(2);
  expect(lines[0]).toContain('@ac-1');
  expect(lines[0]).toContain('cart-coupon');
  expect(lines[0]).toContain('pass');
  expect(lines[1]).toContain('@ac-2');
  expect(lines[1]).toContain('(not recorded)');
  // exactly the sections nothing filled, in template order, and none for a filled one
  expect(remaining(r.out)).toEqual(['Screenshots', 'Checklist']);

  // with no verification.md at all: the tag still shows, the result does not, and the scenario with neither is not recorded
  rmSync(join(repo, 'accord', 'tickets', 'T-1', 'verification.md'));
  const bare = await run(['pr', 'T-1'], repo);
  expect(bare.code, bare.out + bare.err).toBe(0);
  const bareLines = plan(readFileSync(bodyFile(repo, 'T-1'), 'utf8'));
  expect(bareLines[0]).toContain('cart-coupon');
  expect(bareLines[0]).not.toContain('pass');
  expect(bareLines[1]).toContain('(not recorded)');
  expect(remaining(bare.out)).toEqual(['Screenshots', 'Checklist']);
}, 120_000);

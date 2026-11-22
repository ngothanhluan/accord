// Phase 8.5 (08.5-06 Task 3): `accord related <id> --for <scout|planner|critic|judge> --out <file>` writes one file per role from core's assembly: the ruleset, the related tickets, the
// Rejected lines, the epic block and, by role, the conventions and the branch's own change to them (D-15, D-20, D-30, R-2). The bare `accord related <id>` stays as it was.
import { afterEach, expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { changedBlock, CHANGED_DUTY, EPIC_DUTY, JUDGE_DUTY, REJECTED_DUTY, RELATED_DUTY, WRITER_DUTY } from '@accord-dev/accord-core';
import { defaultRefOf } from '../src/load/fs.js';
import { cliRuleset, productChange } from '../src/load/product.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const L1 = '- Keep every function under forty lines.';
const L9 = '- Never ship a feature flag without an owner.';
const REJ1 = '- Rejected: a queue — too slow';
const REJ2 = '- Rejected: a cron job — drifts silently';
const CONVENTIONS = 'accord/product/conventions.md';
const ROLES_ERROR = 'scout, planner, critic, judge';

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

const EPIC_BODY = ['## Intent', 'Group the checkout stories.', '', '## Vetoes', '- No new dependency.', '', '## Decisions', '- D-01 One cart — "one cart per user"', '', '## Corrections', ''].join('\n');
const EPIC = laneTicket('E-1', { lane: 'L', body: EPIC_BODY }).replace('type: story', 'type: epic').replace('title: "Export"', 'title: "Checkout epic"');
const EPIC_BLOCK = ['## Epic E-1 "Checkout epic"', '### Vetoes', '- No new dependency.', '### Decisions', '- D-01 One cart — "one cart per user"', '### Epic lessons', '(none)'].join('\n');
const RELATED_BODY = ['## Intent', 'Quote every cell of a csv export.', '', '## Vetoes', '- No emoji.', '', '## Decisions', '- D-01 Quote every cell — "csv readers differ"', ''].join('\n');

/**
 * Main holds an epic E-1, a story S-1 (parent E-1, related R-2), a related ticket R-2 and conventions.md with L1 and one Rejected line; the story's branch adds L9 and a second Rejected line.
 * No origin: the default ref is the local main.
 */
function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/E-1.md': EPIC,
    'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "E-1"', 'related:', '  - "R-2"'] }),
    'accord/tickets/R-2.md': laneTicket('R-2', { body: RELATED_BODY }).replace('title: "Export"', 'title: "Csv quoting"'),
    [CONVENTIONS]: L1 + '\n' + REJ1 + '\n',
  });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/S-1');
  writeFiles(repo, { [CONVENTIONS]: L1 + '\n' + L9 + '\n' + REJ1 + '\n' + REJ2 + '\n' });
  commitMsg(repo, 'the branch adds a rule and a refusal');
  return repo;
}

/** One block of a file, heading included, up to the next block heading. */
const block = (text: string, heading: string): string => {
  const at = text.startsWith(heading + '\n') ? 0 : text.indexOf('\n' + heading + '\n') + 1;
  if (at <= 0 && !text.startsWith(heading + '\n')) return '';
  const next = text.indexOf('\n\n## ', at + 1);
  return text.slice(at, next < 0 ? undefined : next);
};

/** `accord related S-1 --for <role> --out <name>`: the file's text, and the one stdout line. */
async function fileFor(repo: string, role: string, id = 'S-1'): Promise<{ text: string; out: string; bytes: Buffer }> {
  const r = await run(['related', id, '--for', role, '--out', role + '-input.md'], repo);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  const file = join(repo, '.accord-reports', id, role + '-input.md');
  expect(existsSync(file)).toBe(true);
  const bytes = readFileSync(file);
  return { text: bytes.toString('utf8'), out: r.out, bytes };
}

it('risk:regression the scout file holds the ruleset the related tickets the Rejected lines and the epic block (8.5-ac-12 D-15 D-20)', async () => {
  const repo = sandbox();
  const { text, out, bytes } = await fileFor(repo, 'scout');
  // stdout is the one file line
  expect(out).toMatch(/^file: .*\/\.accord-reports\/S-1\/scout-input\.md\n$/);
  expect(out).not.toContain('\\');
  expect(text.startsWith(cliRuleset().replace(/\n+$/, '') + '\n\n')).toBe(true);
  expect(text).toContain('# Related tickets of S-1\n' + RELATED_DUTY + '\n\n## R-2 "Csv quoting" (open)');
  expect(text).toContain('- D-01 Quote every cell — "csv readers differ"');
  // the default branch's copy: the refusal the branch added is not there yet
  expect(block(text, '## Rejected')).toBe(['## Rejected', REJECTED_DUTY, REJ1].join('\n'));
  expect(text).toContain(EPIC_BLOCK + '\n' + EPIC_DUTY);
  expect(text).not.toContain('## Conventions');
  // the blocks come in the order the role map gives
  const at = (h: string): number => text.indexOf(h);
  expect(at('# Related tickets of')).toBeGreaterThan(at('# accord rules'));
  expect(at('\n## Rejected\n')).toBeGreaterThan(at('# Related tickets of'));
  expect(at('## Epic E-1')).toBeGreaterThan(at('\n## Rejected\n'));
  // UTF-8, no byte order mark, no carriage return
  expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
  expect(text).not.toContain('\r');
});

it('risk:regression the planner file adds the working copy\'s conventions block (8.5-ac-12 D-06 D-20)', async () => {
  const repo = sandbox();
  const { text } = await fileFor(repo, 'planner');
  const conventions = block(text, '## Conventions');
  expect(conventions).toContain(WRITER_DUTY);
  expect(conventions).not.toContain(JUDGE_DUTY);
  // the branch's own copy: the rule and the refusal it added
  expect(conventions).toContain(L1);
  expect(conventions).toContain(L9);
  expect(conventions).toContain(REJ2);
  // one copy for the file: the Rejected block reads the working copy too
  expect(block(text, '## Rejected')).toBe(['## Rejected', REJECTED_DUTY, REJ1, REJ2].join('\n'));
  expect(text).toContain('# Related tickets of S-1');
  expect(text).toContain(EPIC_BLOCK + '\n' + EPIC_DUTY);
  expect(text.indexOf('\n## Conventions\n')).toBeGreaterThan(text.indexOf('## Epic E-1'));
});

it('risk:regression the critic file holds the scout file\'s blocks and nothing of the planner\'s direction (D-20)', async () => {
  const repo = sandbox();
  writeFiles(repo, { 'accord/tickets/S-1/direction.md': 'DIRECTION-MARKER the planner chose this way\n' });
  const scout = await fileFor(repo, 'scout');
  const critic = await fileFor(repo, 'critic');
  expect(critic.text).toBe(scout.text);
  expect(scout.text).not.toContain('DIRECTION-MARKER');
  expect(critic.text).not.toContain('DIRECTION-MARKER');
});

it('risk:security the judge file holds the default branch\'s conventions, the branch\'s change to them and no related tickets (8.5-ac-15 R-2 D-05 D-30)', async () => {
  const repo = sandbox();
  const { text } = await fileFor(repo, 'judge');
  expect(text.startsWith(cliRuleset().replace(/\n+$/, '') + '\n\n')).toBe(true);
  expect(text).not.toContain('# Related tickets of');
  expect(block(text, '## Rejected')).toBe(['## Rejected', REJECTED_DUTY, REJ1].join('\n'));
  expect(text).toContain(EPIC_BLOCK + '\n' + EPIC_DUTY);
  // the rules in force: the default branch's copy, under the judge's duty line, without what the branch added
  const conventions = block(text, '## Conventions');
  expect(conventions).toContain(JUDGE_DUTY);
  expect(conventions).toContain(L1);
  expect(conventions).not.toContain(L9);
  expect(conventions).not.toContain(REJ2);
  // the branch's own change, after the conventions: a block of its own under its own duty line
  const changed = block(text, '## Product files changed');
  expect(changed.startsWith('## Product files changed\n' + CHANGED_DUTY + '\n')).toBe(true);
  expect(changed).toContain('+' + L9);
  expect(changed).toContain('+' + REJ2);
  expect(text.indexOf('\n## Product files changed\n')).toBeGreaterThan(text.indexOf('\n## Conventions\n'));
  // one code path with the review package: the block is what core builds from the CLI loader's diff (D-30)
  const expected = changedBlock(productChange(repo, defaultRefOf(repo), 'HEAD'));
  expect(text.endsWith('\n\n' + expected + '\n')).toBe(true);
});

it('risk:regression a ticket with no parent gets no epic block and an unknown role is refused (D-20)', async () => {
  const repo = sandbox();
  const plain = await run(['related', 'R-2', '--for', 'scout'], repo);
  expect(plain.err).toBe('');
  expect(plain.code).toBe(0);
  expect(plain.out).toContain('# Related tickets of R-2');
  expect(plain.out).not.toContain('## Epic');
  // without --out the text is printed
  expect(plain.out.startsWith('# accord rules')).toBe(true);
  for (const args of [['--for', 'executor'], ['--for']]) {
    const bad = await run(['related', 'R-2', ...args], repo);
    expect(bad.code, args.join(' ')).toBe(2);
    expect(bad.out, args.join(' ')).toBe('');
  }
  const executor = await run(['related', 'R-2', '--for', 'executor'], repo);
  expect(executor.err).toContain(ROLES_ERROR);
  // --out belongs to --for: nothing is written without a role
  const lone = await run(['related', 'R-2', '--out', 'x.md'], repo);
  expect(lone.code).toBe(2);
  expect(existsSync(join(repo, '.accord-reports'))).toBe(false);
});

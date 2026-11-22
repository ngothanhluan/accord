// Phase 8.5 (08.5-06 Task 1): `accord review-package` carries the reviewer's product blocks: the ruleset, the epic block, the default branch's `## Conventions` and the branch's own
// `## Product files changed`, so a branch cannot loosen a rule for its own reviewer (D-05), and `--out` writes the package for a session to read (D-23).
import { expect, it } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHANGED_DUTY, EPIC_DUTY, JUDGE_DUTY, NO_DEFAULT_REF_LINE } from '@accord-dev/accord-core';
import { cliRuleset } from '../src/load/product.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const L1 = '- Keep every function under forty lines.';
const L2 = '- Never log a customer email address.';
const CONVENTIONS = 'accord/product/conventions.md';

function identity(repo: string): void {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
}

/** One block of a package, heading included, up to the next block heading (every block of a package is separated from the next by a blank line). */
const block = (out: string, heading: string): string => {
  const at = out.indexOf('\n' + heading + '\n');
  if (at < 0) return '';
  const next = out.indexOf('\n\n## ', at + 1);
  return out.slice(at + 1, next < 0 ? undefined : next);
};

/**
 * Main holds conventions.md with L1 and L2, a lane M ticket T-1 and a lane S ticket S-1. The branch of the ticket under test deletes L2 and commits code.
 * `trunk` renames the default branch to one accord does not look for, so the clone has no default ref (D-07).
 */
function sandbox(kind: 'M' | 'S', opts: { trunk?: boolean; parent?: boolean } = {}): string {
  const repo = makeEmptyRepo();
  try {
    identity(repo);
    const epic = laneTicket('E-1', { lane: 'L', body: ['## Intent', 'Group the stories.', '', '## Vetoes', '- No new dependency.', '', '## Decisions', '- D-01 One cart — "one cart per user"', '', '## Corrections', ''].join('\n') })
      .replace('type: story', 'type: epic')
      .replace('title: "Export"', 'title: "Checkout epic"');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1', opts.parent === true ? { frontmatter: ['parent: "E-1"'] } : {}),
      'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
      ...(opts.parent === true ? { 'accord/tickets/E-1.md': epic } : {}),
      [CONVENTIONS]: L1 + '\n' + L2 + '\n',
      'src/a.ts': 'export const a = 1;\n',
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', opts.trunk === true ? 'trunk' : 'main');
    gitRun(repo, 'switch', '-q', '-c', kind === 'M' ? 't/T-1' : 't/S-1');
    if (kind === 'M') writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) });
    writeFiles(repo, { [CONVENTIONS]: L1 + '\n', 'src/a.ts': 'export const a = 2;\n' });
    commitMsg(repo, 'plan, code and a rule deleted');
    return repo;
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

const ID = { M: 'T-1', S: 'S-1' } as const;

it.each(['M', 'S'] as const)(
  'risk:security the review package of a lane %s ticket gives the default branch\'s conventions and the branch\'s change as a diff (8.5-ac-9 D-05)',
  async (kind) => {
    const repo = sandbox(kind);
    try {
      const r = await run(['review-package', ID[kind]], repo);
      expect(r.err).toBe('');
      expect(r.code).toBe(0);
      const conventions = block(r.out, '## Conventions');
      // the default branch's copy, the deleted line included, under the judge's duty line
      expect(conventions).toContain(JUDGE_DUTY);
      expect(conventions).toContain(L1);
      expect(conventions).toContain(L2);
      // the branch's own change, shown as a diff under its own duty line, the deleted line as a removal
      const changed = block(r.out, '## Product files changed');
      expect(changed).toContain(CHANGED_DUTY);
      expect(changed).toContain('-' + L2);
      // both sit after the slop section and before the stat section
      const at = (h: string): number => r.out.indexOf('\n' + h + '\n');
      expect(at('## Slop')).toBeGreaterThan(-1);
      expect(at('## Conventions')).toBeGreaterThan(at('## Slop'));
      expect(at('## Product files changed')).toBeGreaterThan(at('## Conventions'));
      expect(at('## Stat')).toBeGreaterThan(at('## Product files changed'));
    } finally {
      cleanup(repo);
    }
  },
  120_000,
);

it('risk:regression the review package carries the ruleset and the epic block of a story (D-03)', async () => {
  const repo = sandbox('M', { parent: true });
  try {
    const r = await run(['review-package', 'T-1'], repo);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    expect(r.out).toContain(cliRuleset().replace(/\n+$/, ''));
    const epic = ['## Epic E-1 "Checkout epic"', '### Vetoes', '- No new dependency.', '### Decisions', '- D-01 One cart — "one cart per user"', '### Epic lessons', '(none)'].join('\n');
    expect(r.out).toContain(epic + '\n' + EPIC_DUTY);
    // the ruleset, the epic block, the conventions and the change come in that order, before the stat section
    const at = (h: string): number => r.out.indexOf(h);
    expect(at('# accord rules')).toBeGreaterThan(at('## Slop'));
    expect(at('## Epic E-1')).toBeGreaterThan(at('# accord rules'));
    expect(at('\n## Conventions\n')).toBeGreaterThan(at('## Epic E-1'));
    expect(at('\n## Stat\n')).toBeGreaterThan(at('\n## Product files changed\n'));
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression a ticket with no parent gets no epic block in its review package (D-03)', async () => {
  const repo = sandbox('M');
  try {
    const r = await run(['review-package', 'T-1'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toContain('# accord rules');
    expect(r.out).not.toContain('## Epic ');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression with no default ref the package exits 0 with the working copy and one line saying so (8.5-ac-11 D-07)', async () => {
  const repo = sandbox('M', { trunk: true });
  try {
    const r = await run(['review-package', 'T-1'], repo);
    expect(r.err).toBe('');
    expect(r.code).toBe(0);
    const conventions = block(r.out, '## Conventions');
    expect(conventions).toContain(NO_DEFAULT_REF_LINE);
    expect(conventions.split(NO_DEFAULT_REF_LINE).length).toBe(2);
    // the working tree's copy: the branch deleted L2, so only L1 is there
    expect(conventions).toContain(L1);
    expect(conventions).not.toContain(L2);
    expect(block(r.out, '## Product files changed')).toContain('(cannot tell: no default branch in this clone)');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security review-package --out writes the package and still prints the Head line (D-23 R-5)', async () => {
  const repo = sandbox('M');
  try {
    const plain = await run(['review-package', 'T-1'], repo);
    expect(plain.code).toBe(0);
    const head = /^Head: (.*)$/m.exec(plain.out)?.[1];
    expect(head).toBeDefined();
    const wrote = await run(['review-package', 'T-1', '--out', 'package-1.md'], repo);
    expect(wrote.err).toBe('');
    expect(wrote.code).toBe(0);
    const lines = wrote.out.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('Head: ' + head);
    expect(lines[1]).toMatch(/^file: .*\/\.accord-reports\/T-1\/package-1\.md$/);
    expect(lines[2]).toBe('');
    expect(lines[1]).not.toContain('\\');
    const file = join(repo, '.accord-reports', 'T-1', 'package-1.md');
    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8')).toBe(plain.out);

    // the security package the same way
    const secPlain = await run(['review-package', 'T-1', '--security'], repo);
    expect(secPlain.code).toBe(0);
    const secHead = /^Head: (.*)$/m.exec(secPlain.out)?.[1];
    const sec = await run(['review-package', 'T-1', '--security', '--out', 'security-1.md'], repo);
    expect(sec.err).toBe('');
    expect(sec.code).toBe(0);
    const secLines = sec.out.split('\n');
    expect(secLines[0]).toBe('Head: ' + secHead);
    expect(secLines[1]).toMatch(/^file: .*\/\.accord-reports\/T-1\/security-1\.md$/);
    expect(readFileSync(join(repo, '.accord-reports', 'T-1', 'security-1.md'), 'utf8')).toBe(secPlain.out);
  } finally {
    cleanup(repo);
  }
}, 120_000);

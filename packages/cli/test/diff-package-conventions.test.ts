// Phase 8.5 (08.5-06 Task 2): `accord diff-package` gives this repository's reviews the default branch's conventions and the branch's own change, and another repository's pull request
// none (D-14, R-9); the CLI decides from the link and origin's URL, never the model, and runs no network command. The two `--security` packages hold no product text (8.5-ac-19).
import { expect, it, vi } from 'vitest';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CHANGED_DUTY, JUDGE_DUTY } from '@accord-dev/accord-core';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { spawnLog } from './helpers/git-spawns.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));

const L1 = '- Keep every function under forty lines.';
const L2 = '- Never log a customer email address.';
const BIZ = 'BIZ-MARKER-7f3a a business rule only the owner reads';
const GLOSSARY = 'GLOSSARY-MARKER-91c2 a term only the owner reads';
const CONVENTIONS = 'accord/product/conventions.md';
const THIS = 'https://github.com/acme/widget/pull/7';
const OTHER = 'https://github.com/someone/fork/pull/3';

const block = (out: string, heading: string): string => {
  const at = out.indexOf('\n' + heading + '\n');
  if (at < 0) return '';
  const next = out.indexOf('\n\n## ', at + 1);
  return out.slice(at + 1, next < 0 ? undefined : next);
};

interface Box {
  repo: string;
  base: string;
  head: string;
}

/**
 * Main holds conventions.md with L1 and L2, a business-rules file and a glossary; the branch t/T-1 (lane M, plan baseline = main's commit) deletes L2 and changes code.
 * `origin` is the remote's URL when given; `refs/remotes/origin/main` is set to main's commit by hand, so no network is involved.
 */
function sandbox(origin: string | null = 'https://github.com/acme/widget.git'): Box {
  const repo = makeEmptyRepo();
  try {
    gitRun(repo, 'config', 'user.email', 'an@example.com');
    gitRun(repo, 'config', 'user.name', 'an');
    gitRun(repo, 'config', 'commit.gpgsign', 'false');
    writeFiles(repo, {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1'),
      [CONVENTIONS]: L1 + '\n' + L2 + '\n',
      'accord/product/business-rules.md': BIZ + '\n',
      'accord/product/glossary.md': GLOSSARY + '\n',
      'src/a.ts': 'export const a = 1;\n',
    });
    const base = commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    if (origin !== null) {
      gitRun(repo, 'remote', 'add', 'origin', origin);
      gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
    }
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), [CONVENTIONS]: L1 + '\n', 'src/a.ts': 'export const a = 2;\n' });
    const head = commitMsg(repo, 'plan, code and a rule deleted');
    return { repo, base, head };
  } catch (e) {
    cleanup(repo);
    throw e;
  }
}

it('risk:security a local branch and a commit range get the default branch\'s conventions and the branch\'s change (8.5-ac-14 D-14)', async () => {
  const { repo, base, head } = sandbox();
  try {
    for (const args of [['main', 't/T-1'], [base, head]]) {
      const r = await run(['diff-package', ...args], repo);
      expect(r.err).toBe('');
      expect(r.code).toBe(0);
      // the default branch's copy (origin/main), so the line the branch deleted is still a rule
      const conventions = block(r.out, '## Conventions');
      expect(conventions).toContain(JUDGE_DUTY);
      expect(conventions).toContain(L1);
      expect(conventions).toContain(L2);
      const changed = block(r.out, '## Product files changed');
      expect(changed).toContain(CHANGED_DUTY);
      expect(changed).toContain('-' + L2);
      // after the title, before the stat
      expect(r.out.indexOf('\n## Conventions\n')).toBeGreaterThan(r.out.indexOf('\nChanged lines: '));
      expect(r.out.indexOf('\n## Stat\n')).toBeGreaterThan(r.out.indexOf('\n## Product files changed\n'));
    }
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security a pull request of this repository gets the default branch\'s conventions and another\'s gets none (8.5-ac-14 D-14 R-9)', async () => {
  const { repo } = sandbox();
  try {
    // this repository's link; a pull request whose head is a fork's still carries acme/widget's link
    const mine = await run(['diff-package', 'main', 't/T-1', '--pr', THIS], repo);
    expect(mine.err).toBe('');
    expect(mine.code).toBe(0);
    expect(block(mine.out, '## Conventions')).toContain(L2);
    expect(block(mine.out, '## Product files changed')).toContain('-' + L2);
    expect(mine.out).not.toContain('Conventions: none');

    // another repository's: no conventions, no change block of this repository's file, exactly one line saying why, the package otherwise whole
    const other = await run(['diff-package', 'main', 't/T-1', '--pr', OTHER], repo);
    expect(other.err).toBe('');
    expect(other.code).toBe(0);
    expect(other.out).not.toContain('## Conventions');
    expect(other.out).not.toContain('## Product files changed');
    expect(other.out).not.toContain(JUDGE_DUTY);
    const none = other.out.split('\n').filter((l) => l.startsWith('Conventions: none'));
    expect(none).toEqual(['Conventions: none - this pull request belongs to another repository (someone/fork), so it is judged against its own stated purpose only']);
    expect(other.out).toContain('## Stat');
    expect(other.out).toContain('## Diff');

    // a link accord cannot read
    for (const link of ['ext::sh', 'http://github.com/acme/widget/pull/7', 'https://ghe.example.com/acme/widget/pull/7']) {
      const bad = await run(['diff-package', 'main', 't/T-1', '--pr', link], repo);
      expect(bad.code, link).toBe(0);
      expect(bad.out, link).not.toContain('## Conventions');
      const lines = bad.out.split('\n').filter((l) => l.startsWith('Conventions: none'));
      expect(lines, link).toEqual(["Conventions: none - accord cannot tell which repository this pull request belongs to (not a https://github.com/<owner>/<repo>/pull/<n> link), so none of this repository's conventions are given"]);
    }
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security a clone with no origin or an origin accord cannot read gets none, and says why (8.5-ac-14 D-14 R-9)', async () => {
  for (const origin of [null, '/srv/somewhere/else.git']) {
    const { repo } = sandbox(origin);
    try {
      const r = await run(['diff-package', 'main', 't/T-1', '--pr', THIS], repo);
      expect(r.code).toBe(0);
      expect(r.out).not.toContain('## Conventions');
      expect(r.out.split('\n').filter((l) => l.startsWith('Conventions: none'))).toEqual([
        "Conventions: none - accord cannot tell which repository this pull request belongs to (origin's URL is not a form accord reads), so none of this repository's conventions are given",
      ]);
    } finally {
      cleanup(repo);
    }
  }
}, 120_000);

it('risk:security the decision mode prints where to fetch from and runs no network command (R-9)', async () => {
  const { repo } = sandbox();
  try {
    spawnLog.calls = [];
    spawnLog.on = true;
    let mine, other, bad, onlyOne;
    try {
      mine = await run(['diff-package', '--pr', THIS], repo);
      other = await run(['diff-package', '--pr', OTHER], repo);
      bad = await run(['diff-package', '--pr', 'ext::sh -c x'], repo);
      onlyOne = await run(['diff-package', 'main', '--pr', THIS], repo);
    } finally {
      spawnLog.on = false;
    }
    expect(mine.err).toBe('');
    expect(mine.code).toBe(0);
    expect(mine.out).toBe('repository: this\nfetch: origin pull/7/head\n');
    expect(other.code).toBe(0);
    expect(other.out).toBe('repository: other someone/fork\nfetch: https://github.com/someone/fork.git pull/3/head\n');
    expect(bad.code).toBe(0);
    expect(bad.out).toBe('repository: unknown - not a https://github.com/<owner>/<repo>/pull/<n> link\n');
    // only one of base and head is a usage error; so is giving neither with no link
    expect(onlyOne.code).toBe(2);
    expect(onlyOne.err).toMatch(/both <base> and <head>/);
    const none = await run(['diff-package'], repo);
    expect(none.code).toBe(2);
    // the CLI fetches nothing and asks no remote anything: every git call it made is local
    const network = spawnLog.calls.filter((c) => c.some((a) => ['fetch', 'ls-remote', 'pull', 'clone', 'push'].includes(a)));
    expect(network).toEqual([]);
    expect(spawnLog.calls.some((c) => c[0] === 'remote' && c[1] === 'get-url')).toBe(true);
  } finally {
    spawnLog.on = false;
    cleanup(repo);
  }
}, 120_000);

it('risk:security no package of the pull-request flow holds business rules or glossary text (8.5-ac-14)', async () => {
  const { repo } = sandbox();
  try {
    const outs = [
      await run(['diff-package', 'main', 't/T-1'], repo),
      await run(['diff-package', 'main', 't/T-1', '--pr', THIS], repo),
      await run(['diff-package', 'main', 't/T-1', '--pr', OTHER], repo),
      await run(['diff-package', 'main', 't/T-1', '--security'], repo),
      await run(['review-package', 'T-1'], repo),
    ];
    for (const r of outs) {
      expect(r.code).toBe(0);
      expect(r.out).not.toContain('MARKER');
      expect(r.out).not.toContain(BIZ);
      expect(r.out).not.toContain(GLOSSARY);
    }
  } finally {
    cleanup(repo);
  }
}, 120_000);

const shas = (text: string): string => text.replace(/\b[0-9a-f]{7,64}\b/g, '<sha>');

it('risk:regression the security packages hold no product text beyond security.md (8.5-ac-19 D-24)', async () => {
  const { repo } = sandbox();
  try {
    const diff = await run(['diff-package', 'main', 't/T-1', '--security'], repo);
    const review = await run(['review-package', 'T-1', '--security'], repo);
    expect(diff.code).toBe(0);
    expect(review.code).toBe(0);
    for (const out of [diff.out, review.out]) {
      for (const forbidden of ['## Conventions', '## Product files changed', '# accord rules', '## Epic', JUDGE_DUTY, CHANGED_DUTY, L1, L2]) {
        expect(out, forbidden).not.toContain(forbidden);
      }
    }
    const headings = (out: string): string => shas(out.split('\n').filter((l) => /^#{1,2} /.test(l)).join('\n'));
    await expect(['=== diff-package --security ===', headings(diff.out), '=== review-package --security ===', headings(review.out), ''].join('\n')).toMatchFileSnapshot('./__golden__/security-packages.txt');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security diff-package --out writes into the ticketless folder and still prints the changed-line count (D-23 R-5)', async () => {
  const { repo } = sandbox();
  try {
    const plain = await run(['diff-package', 'main', 't/T-1'], repo);
    const count = /^Changed lines: (\d+)$/m.exec(plain.out)?.[1];
    expect(count).toBeDefined();
    const wrote = await run(['diff-package', 'main', 't/T-1', '--out', 'package.md'], repo);
    expect(wrote.err).toBe('');
    expect(wrote.code).toBe(0);
    const lines = wrote.out.split('\n');
    expect(lines.length).toBe(3);
    expect(lines[0]).toBe('Changed lines: ' + count);
    expect(lines[1]).toMatch(/^file: .*\/\.accord-reports\/_diff\/package\.md$/);
    expect(lines[1]).not.toContain('\\');
    const file = join(repo, '.accord-reports', '_diff', 'package.md');
    expect(existsSync(file)).toBe(true);
    const bytes = readFileSync(file);
    expect([bytes[0], bytes[1], bytes[2]]).not.toEqual([0xef, 0xbb, 0xbf]);
    expect(bytes.toString('utf8')).toBe(plain.out);
    // a report name and a path are refused, nothing written
    const refused = await run(['diff-package', 'main', 't/T-1', '--out', 'fix-1.md'], repo);
    expect(refused.code).toBe(2);
  } finally {
    cleanup(repo);
  }
}, 120_000);

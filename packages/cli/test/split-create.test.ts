// ST-LN-28 D-14 (7-ac-9): `accord new ticket --type epic --lane L --split <file>` writes an approved epic and every story in one
// step, in the working tree or, with --queue, as one commit on one backlog branch. Real files and real git in tmp sandboxes.
import { existsSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, commitAll, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { copy, useSandboxes } from './helpers/worktree.js';
import { CONFIG } from '../../../test/helpers/lane.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{ tickets: ['ST-9', 'ST-10'] }]);

const repos: string[] = [];
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** A repository whose config assigns ids to the person AN, with one commit. */
function sandbox(): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG + 'people:\n  "an@example.com": AN\n' });
  commitAll(repo);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  return repo;
}
const listing = (repo: string): string[] => (existsSync(join(repo, 'accord', 'tickets')) ? readdirSync(join(repo, 'accord', 'tickets')).sort() : []);
const lines = (s: string): string[] => s.split('\n').filter((l) => l !== '');
const text = (repo: string, id: string): string => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8');

/** The three-story split of the plan: the third story comes after the first two. */
const SPLIT = [
  'title: Checkout redesign',
  'intent:',
  '  - Buyers pay with fewer taps.',
  '  - Success is a faster checkout.',
  'vetoes:',
  '  - No new dependency.',
  'stories:',
  '  - title: Cart summary',
  '    intent:',
  '      - Show the cart before payment.',
  '  - title: Payment form',
  '    intent: [Collect the card details.]',
  '    after: [1]',
  '  - title: Receipt email',
  '    intent: [Send a receipt after payment.]',
  '    after: [1, 2]',
  '',
].join('\n');

it('ac-9 an approved split creates the epic and every story in one step (ST-LN-28 7-ac-9)', async () => {
  const repo = sandbox();
  writeFileSync(join(repo, 'split.yml'), SPLIT);
  const branches = gitRun(repo, 'branch', '--list');
  const r = await run(['new', 'ticket', '--type', 'epic', '--lane', 'L', '--split', 'split.yml', '--related', 'none'], repo);
  expect(r.code, r.out + r.err).toBe(0);

  // four files, each path printed once in file order: the epic, then the stories with ascending ids
  const paths = lines(r.out).filter((l) => l.startsWith('accord/tickets/'));
  expect(paths).toEqual(['accord/tickets/EP-AN-1.md', 'accord/tickets/ST-AN-1.md', 'accord/tickets/ST-AN-2.md', 'accord/tickets/ST-AN-3.md']);
  expect(listing(repo)).toEqual(['EP-AN-1.md', 'ST-AN-1.md', 'ST-AN-2.md', 'ST-AN-3.md']);

  const epic = text(repo, 'EP-AN-1');
  expect(epic).toContain('\nid: "EP-AN-1"');
  expect(epic).toContain('\ntype: "epic"');
  expect(epic).toContain('\nlane: "L"');
  expect(epic).toContain('\ntitle: "Checkout redesign"');
  expect(epic).toContain('Buyers pay with fewer taps.\nSuccess is a faster checkout.\n');
  expect(epic).toContain('\n- No new dependency.\n');

  const [one, two, three] = ['ST-AN-1', 'ST-AN-2', 'ST-AN-3'].map((id) => text(repo, id));
  for (const [i, t] of [one, two, three].entries()) {
    expect(t, 'story ' + (i + 1)).toContain('\ntype: "story"');
    expect(t, 'story ' + (i + 1)).toContain('\nlane: "M"');
    expect(t, 'story ' + (i + 1)).toContain('\nparent: "EP-AN-1"');
  }
  expect(one).toContain('\ntitle: "Cart summary"');
  expect(one).toContain('Show the cart before payment.');
  expect(one).not.toMatch(/^depends_on:/m);
  expect(two).toMatch(/^depends_on:\n {2}- "ST-AN-1"\n/m);
  expect(three).toMatch(/^depends_on:\n {2}- "ST-AN-1"\n {2}- "ST-AN-2"\n/m);

  // the files lint with no error and no finding about ids, dependencies or parents (the template's own placeholder warnings stay); no worktree, branch or claim came with them
  const lint = await run(['lint'], repo);
  expect(lint.code, lint.out + lint.err).toBe(0);
  expect(lint.out).toContain('0 errors');
  expect(lint.out + lint.err).not.toMatch(/lint.(id-|depends-|parent)/);
  expect(lines(gitRun(repo, 'worktree', 'list'))).toHaveLength(1);
  expect(gitRun(repo, 'branch', '--list')).toBe(branches);
  expect(existsSync(join(repo, '.git', 'accord'))).toBe(false);
});

const today = (): string => new Date().toISOString().slice(0, 10);
const tempFolders = (): string[] => readdirSync(tmpdir()).filter((n) => n.startsWith('accord-queue-')).sort();
const FOUR = ['accord/tickets/EP-FX-1.md', 'accord/tickets/ST-FX-1.md', 'accord/tickets/ST-FX-2.md', 'accord/tickets/ST-FX-3.md'];

it('ac-9 a queued split is one commit on one backlog branch and a bad split writes nothing (ST-LN-28 7-ac-9)', async () => {
  // a bare-origin clone whose default branch assigns ids to the person fixture@example.invalid
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  writeFiles(c.root, { 'accord/config.yml': CONFIG + 'people:\n  "fixture@example.invalid": FX\n', 'split.yml': SPLIT });
  c.git('add', '-A');
  c.git('commit', '-q', '-m', 'people and a split');
  c.git('push', '-q', 'origin', 'main');
  const state = (): string[] => [c.git('rev-parse', 'HEAD'), c.git('status', '--porcelain', '--untracked-files=all'), c.git('worktree', 'list', '--porcelain'), c.git('for-each-ref', 'refs/heads/backlog')];
  const refs = (): string => gitRun(c.remote, 'for-each-ref', '--format=%(refname) %(objectname)');
  const folders = tempFolders();
  const before = state();
  const pushed = refs();

  // every refusal comes before the first write, the temporary worktree and the push
  const queue = (...more: string[]) => run(['new', 'ticket', '--type', 'epic', '--lane', 'L', '--queue', '--related', 'none', ...more], c.root);
  const refuse = async (what: string, word: string, ...more: string[]): Promise<void> => {
    const r = await queue('--split', 'split.yml', ...more);
    expect([what, r.code, r.err.includes(word) && r.err.includes('nothing was written')], what + ': ' + r.err).toEqual([what, 2, true]);
    expect(state(), what).toEqual(before);
    expect(refs(), what).toBe(pushed);
    expect(tempFolders(), what).toEqual(folders);
  };
  await refuse('--worktree', '--worktree', '--worktree');
  await refuse('--no-dup-check', '--no-dup-check', '--no-dup-check');
  await refuse('--title', '--title', '--title', 'Not here');
  const edit = async (what: string, word: string, from: string, to: string): Promise<void> => {
    writeFileSync(join(c.root, 'bad.yml'), SPLIT.replace(from, to));
    const r = await queue('--split', 'bad.yml');
    rmSync(join(c.root, 'bad.yml'));
    expect([what, r.code, r.err.includes(word) && r.err.includes('nothing was written')], what + ': ' + r.err).toEqual([what, 2, true]);
    expect(state(), what).toEqual(before);
    expect(refs(), what).toBe(pushed);
    expect(tempFolders(), what).toEqual(folders);
  };
  await edit('a story title that breaks the rule', 'story 2 title', 'title: Payment form', 'title: Paiement des données');
  await edit('an after that points forward', 'story 2', '    after: [1]\n', '    after: [3]\n');
  await edit('an id the split gives where accord assigns', 'accord assigns ids', 'title: Checkout redesign', 'id: EP-FX-9\ntitle: Checkout redesign');

  // the split itself passes no --title, is not refused for it, and is one commit with the four files on the epic's branch
  const first = today();
  const r = await queue('--split', 'split.yml');
  expect(r.code, r.err).toBe(0);
  const out = lines(r.out);
  const m = /^branch: backlog\/ep-fx-1-(\d{4}-\d{2}-\d{2})$/.exec(out.find((l) => l.startsWith('branch: ')) ?? '');
  expect(m, r.out).not.toBeNull();
  expect([first, today()]).toContain(m![1]);
  expect(out).toContain('base: main');
  expect(out).toContain('title: backlog: queue EP-FX-1');
  expect(out).toContain('merge: owner');
  expect(out.filter((l) => l.startsWith('accord/tickets/'))).toEqual(FOUR);
  const tip = gitRun(c.remote, 'rev-parse', 'refs/heads/backlog/ep-fx-1-' + m![1]).trim();
  expect(gitRun(c.remote, 'rev-list', '--count', 'main..' + tip).trim()).toBe('1');
  expect(gitRun(c.remote, 'diff', '--name-only', 'main', tip)).toBe(FOUR.join('\n') + '\n');
  expect(gitRun(c.remote, 'log', '-1', '--format=%s', tip).trim()).toBe('backlog: queue EP-FX-1');
  const blob = (id: string): string => gitRun(c.remote, 'cat-file', 'blob', tip + ':accord/tickets/' + id + '.md');
  expect(blob('EP-FX-1')).toContain('\ntitle: "Checkout redesign"');
  expect(blob('ST-FX-3')).toMatch(/^parent: "EP-FX-1"$/m);
  expect(blob('ST-FX-3')).toMatch(/^depends_on:\n {2}- "ST-FX-1"\n {2}- "ST-FX-2"\n/m);

  // this checkout is as it was, and no temporary folder is left
  expect(state()).toEqual(before);
  expect(c.git('for-each-ref', 'refs/heads/backlog')).toBe('');
  expect(tempFolders()).toEqual(folders);
}, 180_000);

it('ac-9 a split gives its own ids where accord assigns none and refuses one that is used (ST-LN-28 7-ac-9)', async () => {
  const c = copy({ tickets: ['ST-9', 'ST-10'] });
  const withIds = (one: string): string =>
    SPLIT.replace('title: Checkout redesign', 'id: EP-1\ntitle: Checkout redesign')
      .replace('  - title: Cart summary', '  - id: ' + one + '\n    title: Cart summary')
      .replace('  - title: Payment form', '  - id: S-2\n    title: Payment form')
      .replace('  - title: Receipt email', '  - id: S-3\n    title: Receipt email');
  writeFileSync(join(c.root, 'used.yml'), withIds('ST-9'));
  for (const more of [['--queue'], []]) {
    const used = await run(['new', 'ticket', '--type', 'epic', '--lane', 'L', ...more, '--split', 'used.yml', '--related', 'none'], c.root);
    expect([more, used.code, used.err.includes('ST-9 is already used')]).toEqual([more, 2, true]);
  }
  expect(c.git('status', '--porcelain', '--untracked-files=all')).toBe('?? used.yml\n');
  writeFileSync(join(c.root, 'free.yml'), withIds('S-1'));
  const ok = await run(['new', 'ticket', '--type', 'epic', '--lane', 'L', '--split', 'free.yml', '--related', 'none'], c.root);
  expect(ok.code, ok.err).toBe(0);
  expect(lines(ok.out).filter((l) => l.startsWith('accord/tickets/'))).toEqual(['accord/tickets/EP-1.md', 'accord/tickets/S-1.md', 'accord/tickets/S-2.md', 'accord/tickets/S-3.md']);
}, 180_000);

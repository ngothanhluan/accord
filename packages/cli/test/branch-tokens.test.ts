// Issue #341: the claim branch template takes {type} (the ticket's change: word) and {slug} (the title in kebab-case). Real git in tmp sandboxes with a bare
// remote: the claim is named from the default ref's ticket, found again by status in the main checkout, and survives a title edit; a {type} claim with no
// allowed word is refused before any git write; only listed words are claims (D-11); a teammate's hyphenated id is read whole (D-07a).
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copy, doneOnRemote, has, pushMain, ticketWorktree, useSandboxes, type Clone } from './helpers/worktree.js';

vi.mock('../src/load/proc.js', async (orig) => {
  const real = await orig<typeof import('../src/load/proc.js')>();
  return { ...real, processTable: vi.fn(real.processTable) };
});
vi.mock('../src/commands/fetch-limit.js', async (orig) => {
  const real = await orig<typeof import('../src/commands/fetch-limit.js')>();
  return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) };
});

useSandboxes([{}]);

const TYPED = 'branch: "{type}/{id}-{slug}"\n';
const WORDS = 'feat, fix, refactor, perf, docs, test, build, ci, chore, revert, hotfix';
type Row = { id: string; branch?: string; claimedBy?: string };
const rowOf = async (c: Clone, id: string): Promise<Row> => {
  const r = await run(['status', '--json'], c.root);
  expect(r.code, r.err).toBe(0);
  return (JSON.parse(r.out) as Row[]).find((x) => x.id === id) as Row;
};
/** origin main holds the `{type}` template and ST-9 with `frontmatter`; the checkout has not fetched, and keeps its older copies. */
function adopt(c: Clone, frontmatter: string[] = ['change: fix'], template = TYPED): void {
  pushMain(c, 'accord/config.yml', CONFIG + template);
  if (frontmatter.length > 0) pushMain(c, 'accord/tickets/ST-9.md', laneTicket('ST-9', { frontmatter })); // with none, the ticket origin holds is the one the checkout has
}

it('risk:regression a {type}/{id}-{slug} claim is named from the default ref ticket, found by status in the main checkout and kept through a title edit (D-03, D-06, D-07, D-08, W3)', async () => {
  const c = copy();
  adopt(c);
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/fix/ST-9-export')).toBe(true);
  expect(c.git('log', '-1', '--format=%s', 'fix/ST-9-export').trim()).toBe('claim: ST-9');
  const row = await rowOf(c, 'ST-9');
  expect(row.branch).toBe('fix/ST-9-export');
  expect(row.claimedBy).toBe('fixture@example.invalid');
  // a later title edit on the claim branch keeps the same branch as the ticket's claim
  const sib = c.sibling('ST-9');
  const file = `${sib}/accord/tickets/ST-9.md`;
  writeFileSync(file, readFileSync(file, 'utf8').replace('title: "Export"', 'title: "Export reports"'));
  commitMsg(sib, 'rename the ticket');
  const after = await rowOf(c, 'ST-9');
  expect(after.branch).toBe('fix/ST-9-export');
  expect(after.claimedBy).toBe('fixture@example.invalid');
});

it('risk:data-loss a {type} claim with no allowed change word is refused before any git write (R-4)', async () => {
  const c = copy();
  adopt(c, []);
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('{type}/{id}-{slug}');
  expect(r.err).toContain(WORDS);
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  expect(c.git('branch', '--list', '*ST-9*').trim()).toBe('');
  expect(gitRun(c.remote, 'for-each-ref', '--format=%(refname)').trim()).toBe('refs/heads/main');
});

it('risk:complex-branching only the words of branch_types make a claim, so drop/ and wip/ branches claim nothing (D-11)', async () => {
  const c = copy();
  adopt(c);
  c.git('fetch', '-q', 'origin');
  c.git('branch', 'drop/ST-9-x', 'origin/main');
  c.git('branch', 'wip/ST-9-x', 'origin/main');
  const row = await rowOf(c, 'ST-9');
  expect(row.claimedBy).toBeUndefined();
  expect(row.branch).not.toMatch(/^(drop|wip)\//);
});

it("risk:complex-branching a teammate's fix/ST-AB-5-add-retries reads as ST-AB-5 and is no audit orphan (D-07a)", async () => {
  const c = copy();
  writeFiles(c.root, { 'accord/config.yml': CONFIG + TYPED + 'people:\n  fixture@example.invalid: LN\n  mate@example.invalid: AB\n' });
  commitMsg(c.root, 'adopt the typed branch');
  c.git('push', '-q', 'origin', 'main');
  const mate = c.otherClone();
  gitRun(mate, 'config', 'user.email', 'mate@example.invalid');
  gitRun(mate, 'switch', '-q', '-c', 'fix/ST-AB-5-add-retries');
  writeFiles(mate, { 'accord/tickets/ST-AB-5.md': laneTicket('ST-AB-5', { frontmatter: ['change: fix'] }) });
  commitMsg(mate, 'claim: ST-AB-5');
  gitRun(mate, 'push', '-q', 'origin', 'fix/ST-AB-5-add-retries');
  c.git('fetch', '-q', 'origin');
  const row = await rowOf(c, 'ST-AB-5');
  expect(row, 'ST-AB-5 has a row').toBeDefined();
  expect(row.claimedBy).toBe('mate@example.invalid');
  expect(row.branch).toBe('fix/ST-AB-5-add-retries');
  const audit = await run(['audit'], c.root);
  expect(audit.code, audit.err).toBe(0);
  expect(audit.out.split('\n').filter((l) => l.startsWith('gap: branch-orphan:') && l.includes('fix/ST-AB-5-add-retries'))).toEqual([]);
});

it('risk:regression accord new ticket --worktree names the branch with the title slug under a feature/{id}-{slug} template (D-03, D-08)', async () => {
  const c = copy();
  pushMain(c, 'accord/config.yml', CONFIG + 'branch: "feature/{id}-{slug}"\n');
  const r = await run(['new', 'ticket', 'ST-LN-20', '--lane', 'M', '--worktree', '--title', 'Order total is null', '--no-dup-check'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/feature/ST-LN-20-order-total-is-null')).toBe(true);
  expect(has(c.remote, 'refs/heads/feature/ST-LN-20-order-total-is-null')).toBe(true);
});

// D-04, D-10: a {type} claim needs a change word, proposed by the agent and given with --change.
const CHANGE = (word: string) => new RegExp(`^change: "?${word}"?$`, 'm');

it('risk:regression worktree open names --change and the words when the ticket has no word, and --change claims the older draft with the word in the claim commit (D-10)', async () => {
  const c = copy();
  adopt(c, []);
  const refused = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('--change <word>');
  expect(refused.err).toContain(WORDS);
  const r = await run(['worktree', 'open', 'ST-9', '--change', 'fix'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/fix/ST-9-export')).toBe(true);
  expect(c.git('log', '-1', '--format=%s', 'fix/ST-9-export').trim()).toBe('claim: ST-9');
  expect(c.git('show', 'fix/ST-9-export:accord/tickets/ST-9.md')).toMatch(CHANGE('fix'));
});

it('risk:regression worktree open --change names a new claim from the word, not from the ticket on the default ref (W3)', async () => {
  const c = copy();
  adopt(c);
  const r = await run(['worktree', 'open', 'ST-9', '--change', 'feat'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/feat/ST-9-export')).toBe(true);
  expect(has(c.root, 'refs/heads/fix/ST-9-export')).toBe(false);
  expect(c.git('show', 'feat/ST-9-export:accord/tickets/ST-9.md')).toMatch(CHANGE('feat'));
});

it('risk:regression new ticket --worktree under a {type} template refuses with no change word and writes nothing, and --change names the branch (D-04, D-10)', async () => {
  const c = copy();
  pushMain(c, 'accord/config.yml', CONFIG + TYPED);
  const argv = ['new', 'ticket', 'ST-LN-21', '--lane', 'M', '--worktree', '--title', 'Null total', '--no-dup-check'];
  const refused = await run(argv, c.root);
  expect(refused.code).toBe(2);
  expect(refused.err).toContain('--change');
  expect(refused.err).toContain(WORDS);
  expect(existsSync(c.sibling('ST-LN-21'))).toBe(false);
  expect(c.git('branch', '--list', '*ST-LN-21*').trim()).toBe('');
  expect(gitRun(c.remote, 'for-each-ref', '--format=%(refname)').trim()).toBe('refs/heads/main');
  const r = await run([...argv, '--change', 'fix'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/fix/ST-LN-21-null-total')).toBe(true);
  expect(readFileSync(`${c.sibling('ST-LN-21')}/accord/tickets/ST-LN-21.md`, 'utf8')).toMatch(CHANGE('fix'));
});

it('risk:regression --change is refused before any write when the word is not listed, or with --continue or --split (D-04, R-7)', async () => {
  const c = copy();
  const bad = await run(['new', 'ticket', 'ST-LN-22', '--lane', 'M', '--title', 'Null total', '--no-dup-check', '--change', 'wip'], c.root);
  expect(bad.code).toBe(2);
  expect(bad.err).toContain('wip');
  expect(bad.err).toContain(WORDS);
  expect(existsSync(`${c.root}/accord/tickets/ST-LN-22.md`)).toBe(false);
  const cont = await run(['worktree', 'open', 'ST-9', '--continue', '--change', 'fix'], c.root);
  expect(cont.code).toBe(2);
  expect(cont.err).toContain('--continue');
  expect(existsSync(c.sibling('ST-9'))).toBe(false);
  const split = await run(['new', 'ticket', '--type', 'epic', '--lane', 'L', '--split', `${c.root}/none.md`, '--change', 'fix'], c.root);
  expect(split.code).toBe(2);
  expect(split.err).toContain('--split');
  // a plain new ticket takes a listed word into its frontmatter
  const ok = await run(['new', 'ticket', 'ST-LN-23', '--lane', 'M', '--title', 'Null total', '--no-dup-check', '--change', 'fix'], c.root);
  expect(ok.code, ok.err).toBe(0);
  expect(readFileSync(`${c.root}/accord/tickets/ST-LN-23.md`, 'utf8')).toMatch(CHANGE('fix'));
});

// CR-01: a {slug} template whose {id} sits at the start or the end of the name is read back, so status in the main checkout finds the claim.
it.each([
  ['{type}/{slug}-{id}', 'fix/export-ST-9'],
  ['{id}-{slug}', 'ST-9-export'],
])('risk:data-loss a claim under %s is found again by status in the main checkout (CR-01)', async (template, name) => {
  const c = copy();
  adopt(c, ['change: fix'], `branch: "${template}"\n`);
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code, r.err).toBe(0);
  expect(has(c.root, 'refs/heads/' + name)).toBe(true);
  const row = await rowOf(c, 'ST-9');
  expect(row.branch).toBe(name);
  expect(row.claimedBy).toBe('fixture@example.invalid');
});

// CR-01, WR-02, WR-03 and the review ruling: before git worktree add, a rendered claim name must be a valid branch name and read back to the same id.
/** The main checkout commits and pushes `config` (so its own config matches origin's), and origin holds ST-9 with `ticket`. */
function adoptBoth(c: Clone, config: string, ticket = laneTicket('ST-9', { frontmatter: ['change: fix'] })): void {
  writeFiles(c.root, { 'accord/config.yml': CONFIG + config });
  commitMsg(c.root, 'adopt the branch template');
  c.git('push', '-q', 'origin', 'main');
  pushMain(c, 'accord/tickets/ST-9.md', ticket);
}
const nothingMade = (c: Clone, id = 'ST-9'): void => {
  expect(existsSync(c.sibling(id))).toBe(false);
  expect(c.git('for-each-ref', '--format=%(refname)', 'refs/heads').trim()).toBe('refs/heads/main');
  expect(gitRun(c.remote, 'for-each-ref', '--format=%(refname)').trim()).toBe('refs/heads/main');
};

it('risk:data-loss worktree open refuses a claim name the templates read back as another id (change: t) and creates nothing (WR-02)', async () => {
  const c = copy();
  adoptBoth(c, TYPED + 'branch_types: [t, fix]\n');
  const r = await run(['worktree', 'open', 'ST-9', '--change', 't'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('t/ST-9-export would not be read back as ST-9');
  nothingMade(c);
});

it('risk:data-loss worktree open refuses a rendered name git refuses (.lock) before any git write (WR-03)', async () => {
  const c = copy();
  adoptBoth(c, 'branch: "{type}/{id}.{slug}"\n', laneTicket('ST-9', { frontmatter: ['change: fix'] }).replace('title: "Export"', 'title: "Lock"'));
  const r = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('fix/ST-9.lock is not a valid branch name');
  expect(r.err).toContain('{type}/{id}.{slug}');
  nothingMade(c);
});

it('risk:data-loss new ticket --worktree refuses a name that is not a valid branch or does not read back, and writes nothing (WR-02, WR-03)', async () => {
  const c = copy();
  pushMain(c, 'accord/config.yml', CONFIG + 'branch: "feature/{id}.{slug}"\n');
  const r = await run(['new', 'ticket', 'ST-LN-24', '--lane', 'M', '--worktree', '--title', 'Lock', '--no-dup-check'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('feature/ST-LN-24.lock is not a valid branch name');
  nothingMade(c, 'ST-LN-24');
});

// CR-02, D-07b, D-07c: with no id convention, a teammate's feature/ST-12-export holding only accord/tickets/ST-12.md reads as ST-12 and is no orphan;
// a branch whose id was guessed and whose ticket exists nowhere is listed without a delete command.
it("risk:data-loss with no id convention a teammate's live {slug} claim is no orphan, and a guessed orphan gets no delete command (CR-02, D-07b, D-07c)", async () => {
  const c = copy();
  writeFiles(c.root, { 'accord/config.yml': CONFIG + 'branch: "feature/{id}-{slug}"\n' });
  commitMsg(c.root, 'adopt the slug branch');
  c.git('push', '-q', 'origin', 'main');
  const mate = c.otherClone();
  gitRun(mate, 'config', 'user.email', 'mate@example.invalid');
  gitRun(mate, 'switch', '-q', '-c', 'feature/ST-12-export');
  writeFiles(mate, { 'accord/tickets/ST-12.md': laneTicket('ST-12') });
  commitMsg(mate, 'claim: ST-12');
  gitRun(mate, 'push', '-q', 'origin', 'feature/ST-12-export');
  gitRun(mate, 'switch', '-q', '-c', 'feature/ST-13-gone', 'main');
  commitMsg(mate, 'work without a ticket', undefined, true);
  gitRun(mate, 'push', '-q', 'origin', 'feature/ST-13-gone');
  c.git('fetch', '-q', 'origin');
  const audit = await run(['audit'], c.root);
  expect(audit.code, audit.err).toBe(0);
  const orphans = audit.out.split('\n').filter((l) => l.startsWith('gap: branch-orphan:'));
  expect(orphans.filter((l) => l.includes('feature/ST-12-export')), audit.out).toEqual([]);
  const gone = orphans.filter((l) => l.includes('feature/ST-13-gone'));
  expect(gone, audit.out).toHaveLength(1);
  expect(gone[0]).toContain('names ticket ST-13 by a guess');
  expect(gone[0]).not.toContain('git push origin --delete');
});

// WR-06: a {type} template matches every conventional branch on every remote, so the claim listing can pass git's 1 MiB default output; it reads up to 64 MiB.
it('risk:regression status reads a claim listing over 1 MiB (10 000 fix/ refs on origin) (WR-06)', async () => {
  const c = copy();
  writeFileSync(`${c.root}/accord/config.yml`, readFileSync(`${c.root}/accord/config.yml`, 'utf8') + TYPED);
  const sha = c.git('rev-parse', 'HEAD').trim();
  const lines = Array.from({ length: 10000 }, (_, i) => `${sha} refs/remotes/origin/fix/ST-${i + 100}-a-long-enough-slug-to-fill-the-listing`);
  writeFileSync(`${c.root}/.git/packed-refs`, '# pack-refs with: peeled fully-peeled sorted\n' + lines.sort().join('\n') + '\n');
  const listing = execFileSync('git', ['for-each-ref', '--format=%(refname)%00%(authoremail)%00%(committerdate:unix)%00%(objectname)', 'refs/remotes/*/fix/*-*'], { cwd: c.root, maxBuffer: 64 * 1024 * 1024 });
  expect(listing.length).toBeGreaterThan(1024 * 1024);
  const r = await run(['status', '--json'], c.root);
  expect(r.code, r.err).toBe(0);
});

// IN-01: a ticket with no allowed change word and no claim yet has no claim branch; the literal {type} never reaches git or the message.
it('risk:regression --continue on an unclaimed {type} ticket says it has no claim branch, with no {type} literal (IN-01)', async () => {
  const c = copy();
  adopt(c, []);
  const r = await run(['worktree', 'open', 'ST-9', '--continue'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('ST-9 has no claim branch here or on origin');
  expect(r.err).not.toContain('{type}');
});

// IN-02: under a {type} template, new ticket --worktree without --change is refused before the clean removes anything.
it('risk:data-loss new ticket --worktree with no --change under a {type} template is refused before the clean runs (IN-02)', async () => {
  const c = copy();
  ticketWorktree(c, 'ST-9');
  doneOnRemote(c, ['ST-9']);
  pushMain(c, 'accord/config.yml', CONFIG + TYPED);
  c.git('fetch', '-q', 'origin');
  const r = await run(['new', 'ticket', 'ST-LN-25', '--lane', 'M', '--worktree', '--title', 'Null total', '--no-dup-check'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('--change <word>');
  // the done ticket's worktree and branch, which a clean would remove, are still there
  expect(existsSync(c.sibling('ST-9'))).toBe(true);
  expect(has(c.root, 'refs/heads/t/ST-9')).toBe(true);
});

// IN-04: --change on a ticket already claimed is refused: the claim keeps its name.
it('risk:regression worktree open --change on a ticket already claimed is refused, saying the claim has its name (IN-04)', async () => {
  const c = copy();
  adopt(c);
  const first = await run(['worktree', 'open', 'ST-9'], c.root);
  expect(first.code, first.err).toBe(0);
  const r = await run(['worktree', 'open', 'ST-9', '--change', 'feat'], c.root);
  expect(r.code).toBe(2);
  expect(r.err).toContain('ST-9 is already claimed on fix/ST-9-export, which keeps its name');
  expect(has(c.root, 'refs/heads/feat/ST-9-export')).toBe(false);
});

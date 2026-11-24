// Issue #341: the claim branch template takes {type} (the ticket's change: word) and {slug} (the title in kebab-case). Real git in tmp sandboxes with a bare
// remote: the claim is named from the default ref's ticket, found again by status in the main checkout, and survives a title edit; a {type} claim with no
// allowed word is refused before any git write; only listed words are claims (D-11); a teammate's hyphenated id is read whole (D-07a).
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { expect, it, vi } from 'vitest';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';
import { commitMsg, gitRun, run, writeFiles } from './helpers/repo.js';
import { copy, has, pushMain, useSandboxes, type Clone } from './helpers/worktree.js';

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

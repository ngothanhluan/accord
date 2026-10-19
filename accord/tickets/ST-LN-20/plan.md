---
baseline: 73c095ab7c6ac84089019f7a9cad04f5a49f3119
plan_hash: "fnv1a64:99cd1d23ff30cc98"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring that proves the approach end to end: `accord worktree clean` fetches whenever an
`origin` remote exists and, after its worktree loop, walks every local ticket branch, deleting the merged ones and
naming the checked-out ones it keeps. Task 2 adds the prune of stale remote-tracking refs after a successful fetch
and the new command description. No skill text, README, schema or core file changes (Approach, Affected).

Rules for every task:
- Test ids: every test named on a `verify:` line is a top-level `it(...)` in `packages/cli/test/worktree.test.ts`
  with no `describe` around it. Its report id is the test file's path, then `#`, then the `it` title with each
  whitespace run turned into `-`. No test title holds `@` or a comma.
- Tests drive the CLI with `run(argv, cwd, env)` from `./helpers/repo.js`, with env `{}` for `worktree clean`, and
  build their repositories with `clone(...)` (the file's wrapper around `makeClone` of `./helpers/worktree.js`, so
  `afterEach` removes every directory), against a real bare remote with no mock for git (Approach, Tests). Reuse
  the file's helpers `lines`, `ticketWorktree`, `mergeOnRemote`.
- Run one file with `npx vitest run packages/cli/test/worktree.test.ts`. End every task with `npm run build`,
  `npm run lint` and `npm run typecheck`, then that test file in full.
- Files are LF with no BOM. No new dependency. Every path the CLI prints uses `/` as git prints it in
  `git worktree list --porcelain`.

Definitions shared by every task:
- A ticket branch: a local branch whose short name `ticketOfBranch(name, ctx.snapshot.branchTemplates ??
  [DEFAULT_BRANCH_TEMPLATE], (id) => Object.hasOwn(ctx.snapshot.tickets, id))` (packages/cli/src/load/fs.ts:291)
  maps to an id, whether or not that id has a ticket file in this checkout (ledger Ruling on the branch pass). With
  the default template `t/{id}` that is every `t/<id>` with no `/` in the id; `main` and `backlog/notes` are never
  ticket branches.
- The remote main: `gitDefaultRef(ctx.root)` (packages/cli/src/load/fs.ts:574), read after the fetch, a
  `refs/remotes/origin/...` ref. Never the local `main`, never `HEAD` (D-03).
- Merged: `git merge-base --is-ancestor <sha> <remote main>` exits 0, `<sha>` the branch's tip as read.
- The branch lines, written to stdout one per line:
  - `deleted <branch> (was <sha>)`, `<sha>` the full object name `for-each-ref` printed (D-03, ledger Ruling on the
    full sha);
  - `kept <branch>: checked out in <path>`, `<path>` the `worktree` path of the entry that has it checked out,
    the main worktree included (D-02);
  - `kept <branch>: could not be judged: <first line of git's stderr>` when `git branch -D` fails.
  An unmerged ticket branch prints nothing (ledger Ruling 2).

## Task 1: Wiring: worktree clean fetches whenever origin exists and deletes merged ticket branches, naming the ones it keeps
covers: @ac-1, @ac-2, @ac-3, D-01, D-02, D-03, D-04
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-1-bare-accord-deletes-merged-ticket-branches-with-or-without-a-worktree-and-names-the-checked-out-one-it-keeps (@ac-1), packages/cli/test/worktree.test.ts#ac-2-a-merged-branch-whose-remote-branch-is-gone-is-deleted-from-another-ticket-branch-with-a-stale-local-main (@ac-2), packages/cli/test/worktree.test.ts#ac-3-a-ticket-branch-with-a-commit-not-on-the-remote-main-is-kept-and-not-named (@ac-3), packages/cli/test/worktree.test.ts#risk:data-loss-a-merged-branch-the-ticket-branch-template-does-not-name-is-never-deleted, packages/cli/test/worktree.test.ts#risk:complex-branching-a-branch-git-refuses-to-delete-is-kept-with-git-message-and-the-others-still-go

Consumes: `worktreeClean(ctx)` in `packages/cli/src/commands/worktree.ts` as it stands at the baseline, with its
helpers `worktrees`, `git`, `gitOk`, `gitNoPrompt`, `firstLine`, and `gitDefaultRef`, `ticketOfBranch` from
`../load/fs.js`. Produces: the same `worktreeClean(ctx): number`, still always 0 unless git cannot run, with the
fetch moved ahead of the candidate check and the branch pass appended.

Test helper first, in `worktree.test.ts` beside `ticketWorktree`: `function ticketBranch(c: Clone, id: string)`:
in `c.root`, `git switch -q -c t/<id> main`, write `<id>.txt` holding `<id>\n` with `writeFiles`, `git add -A`,
`git commit -q -m <id>`, `git push -q -u origin t/<id>` (so it tracks `origin/t/<id>`), then `git switch -q main`.
A branch with a commit, pushed, and no worktree.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-1 bare accord deletes merged ticket branches with or without a worktree and names the checked out one it keeps')`:
  `clone({ tickets: ['ST-9', 'ST-10', 'ST-11', 'ST-12'] })`; `ticketBranch` for `ST-9`, `ST-11`, `ST-12`;
  `ticketWorktree(c, 'ST-10')`; `mergeOnRemote(c, 'ST-9', 'ST-10', 'ST-12')`; then `c.git('switch', '-q',
  't/ST-12')`, so the session's checkout has `t/ST-12`. Read `sha9 = git rev-parse t/ST-9` and `sha10` the same
  way. `run(['worktree', 'clean'], c.root, {})` exits 0; `lines(out)` sorted equals, sorted, `removed
  <c.sibling('ST-10')>`, `deleted t/ST-9 (was <sha9>)`, `deleted t/ST-10 (was <sha10>)`, `kept t/ST-12: checked
  out in <c.root>`; `git rev-parse --verify -q refs/heads/t/ST-9` and the same for `t/ST-10` throw; `t/ST-11` and
  `t/ST-12` still resolve; `out` does not contain `t/ST-11`; `git branch --show-current` is `t/ST-12`.
- `it('ac-2 a merged branch whose remote branch is gone is deleted from another ticket branch with a stale local main')`:
  `clone()`; `ticketBranch(c, 'ST-9')`; `git switch -q -c t/ST-20 main`, commit one file `ST-20.txt` there (so
  `t/ST-20` is not merged and prints nothing); `mergeOnRemote(c, 'ST-9')`; `gitRun(c.remote, 'branch', '-D',
  't/ST-9')`; read `sha9` and `mainBefore = git rev-parse main`. Preconditions, before the run: `git rev-parse
  --abbrev-ref t/ST-9@{upstream}` is `origin/t/ST-9`; `git merge-base --is-ancestor <sha9> main` throws, and so
  does `git merge-base --is-ancestor <sha9> HEAD`. `worktree clean` from `c.root` exits 0; `lines(out)` equals
  exactly [`deleted t/ST-9 (was <sha9>)`]; `refs/heads/t/ST-9` no longer resolves; `git rev-parse main` is still
  `mainBefore`; `git branch --show-current` is `t/ST-20`. The proof is the outcome, never the git calls (D-04).
- `it('ac-3 a ticket branch with a commit not on the remote main is kept and not named')`: `clone()`;
  `ticketBranch(c, 'ST-9')`; `mergeOnRemote(c, 'ST-9')`; `git switch -q t/ST-9`, commit one more file
  `after.txt`, read `extra = git rev-parse HEAD`, `git switch -q main`. `worktree clean` exits 0; `lines(out)` is
  `[]`; `git rev-parse t/ST-9` is `extra`.
- `it('risk:data-loss a merged branch the ticket branch template does not name is never deleted')`: `clone()`;
  `git branch backlog/notes main` and `git branch t/ST-9 main` (both merged; `t/ST-9` is the control that shows
  the pass ran); read `base = git rev-parse main`. `worktree clean` exits 0; `lines(out)` equals exactly
  [`deleted t/ST-9 (was <base>)`]; `backlog/notes` and `main` still resolve to `base`.
- `it('risk:complex-branching a branch git refuses to delete is kept with git message and the others still go')`:
  `clone()`; `git branch t/ST-1 main` and `git branch t/ST-2 main`; `base` as above; create the empty file
  `<c.root>/.git/refs/heads/t/ST-1.lock` (git refuses to change a ref whose lock file exists). `worktree clean`
  exits 0; `lines(out)` has length 2; `lines(out)[0]` starts with `kept t/ST-1: could not be judged: ` and is
  longer than that prefix; `lines(out)[1]` is `deleted t/ST-2 (was <base>)`; `t/ST-1` still resolves. If git
  deletes `t/ST-1` despite the lock file, report BLOCKED with the output; never weaken the test.

Interface, `worktreeClean(ctx)` in this order:
1. No `origin` remote (`gitOk(ctx.root, ['remote', 'get-url', 'origin'])` is false): print nothing, return 0.
   This check no longer depends on the candidates (ledger Ruling 7: fetch whenever `origin` exists, @ac-2 has no
   worktree).
2. The fetch as at the baseline: `gitNoPrompt(ctx.root, ['fetch', 'origin'])`; on failure print the baseline's
   `fetch from origin failed, judging against the refs already in this clone: <first line>` and go on.
3. `ref = gitDefaultRef(ctx.root)`; none: return 0.
4. The candidates (as at the baseline: entries after the first whose `branch` is a ticket branch) and the
   worktree loop, unchanged; an empty candidate list skips the loop.
5. The branch pass:
   - `after = worktrees(ctx.root, ctx.stdout)`, listed again so a worktree removed in step 4 no longer holds its
     branch.
   - `git(ctx.root, ['for-each-ref', '--format=%(objectname) %(refname)', 'refs/heads'])`, each non-empty line
     split at its first space into `sha` and the full ref name; `name` is the ref name without `refs/heads/`
     (read by full ref name so a tag of the same name cannot shorten it, ledger Ruling on the branch pass). Lines
     are taken in git's order (ref name order).
   - Skip a `name` that is not a ticket branch, and one whose `sha` is not merged into `ref` (`gitOk` on `merge-base
     --is-ancestor <sha> <ref>`), without a line.
   - When an entry of `after` has `branch === name`: `kept <name>: checked out in <entry.path>`.
   - Otherwise `execFileSync('git', ['branch', '-D', name], { cwd: ctx.root, encoding: 'utf8', stdio: ['ignore',
     'pipe', 'pipe'] })`: success prints `deleted <name> (was <sha>)`; a throw prints `kept <name>: could not be
     judged: <firstLine(e)>` and the pass goes on with the next branch.
   - Update the doc comment above `worktreeClean` to say it also deletes merged ticket branches (D-02, D-03).

Existing tests in `worktree.test.ts` whose expected output changes, and how (read every sha before the run):
- `ac-5 bare accord fetches then removes merged worktrees and names what it keeps`: the sorted expected lines gain
  `deleted t/ST-9 (was <sha of t/ST-9>)`, `kept t/ST-10: checked out in <c.sibling('ST-10')>` and `kept t/ST-12:
  checked out in <c.sibling('ST-12')>`.
- `risk:complex-branching a failed fetch is said and the refs in the clone are judged`: for `c`, `l` has length 3
  and `l[2]` is `deleted t/ST-9 (was <origin/main sha>)`; `d` (no `origin`) still prints `''`; `e` (no worktree,
  unreachable `origin`) now prints exactly one line, which starts with `fetch from origin failed, judging against
  the refs already in this clone`.
- `risk:data-loss clean keeps unpushed commits and new files that git status config would hide`: for `c`,
  `lines(out)` is [`kept <sibling ST-10>: uncommitted work`, `kept t/ST-10: checked out in <sibling ST-10>`]
  (`t/ST-9`, with its unpushed commit, prints nothing); for `d`, [`kept <sibling ST-9>: this session's worktree`,
  `kept t/ST-9: checked out in <sibling ST-9>`].
- `risk:complex-branching a worktree remove that fails is named truthfully`: in part (a) `lines(r.out)` has length
  2 and its second line is `kept t/ST-9: checked out in <sibling ST-9>`; in part (b) `lines(q.out)` has length 2,
  its first line starts with `removed <sibling ST-9> in part: git worktree remove failed: ` and ends with ` - delete
  what is left of the folder by hand`, and its second is `deleted t/ST-9 (was <sha of t/ST-9>)`.
- `risk:complex-branching clean prunes a worktree whose folder was deleted by hand`: `lines(out)` is exactly
  [`pruned <sibling ST-9>: <reason>`, `removed <sibling ST-10>`, `deleted t/ST-10 (was <base>)`, `deleted t/ST-9
  (was <base>)`], `base` the `origin/main` sha both branches sit at; the last assertion becomes that `git
  rev-parse --verify -q refs/heads/t/ST-9` throws (the branch now sits at `origin/main` with no worktree, so it is
  this ticket's to delete).
- `risk:data-loss a stale holds lock keeps a merged clean worktree, names it, and clean exits 0`: `lines(out)` has
  length 4; it also holds `kept t/ST-9: checked out in <sibling ST-9>` and `kept t/ST-10: checked out in <sibling
  ST-10>`.

Must not change: every reason, line text and order of the worktree loop; the fetch-failure line; `gitNoPrompt`
and the three `risk:security` ssh cases, which still pass unedited; `worktree open`, `new ticket --worktree` and
every test of them; no `origin` remote prints nothing.

## Task 2: Prune stale remote-tracking refs only after a successful fetch, and describe the command
covers: @ac-4, D-01, D-04
files: packages/cli/src/commands/worktree.ts, packages/cli/src/run.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-4-stale-remote-refs-are-pruned-after-a-good-fetch-and-a-failed-fetch-prunes-nothing (@ac-4)

Consumes: Task 1's `worktreeClean` with the fetch in step 2. Produces: a prune between the fetch and step 3.

Test first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-4 stale remote refs are pruned after a good fetch and a failed fetch prunes nothing')`:
  - Good fetch: `clone()`; `c.git('push', '-q', 'origin', 'main:refs/heads/t/ST-9',
    'main:refs/heads/backlog/notes')`, then `c.git('fetch', '-q', 'origin')`; precondition: `git branch -r`
    contains `origin/t/ST-9` and `origin/backlog/notes`. `gitRun(c.remote, 'branch', '-D', 't/ST-9',
    'backlog/notes')`. `worktree clean` exits 0; `git branch -r` contains neither `origin/t/ST-9` nor
    `origin/backlog/notes` and still contains `origin/main`; `lines(out)` is `[]` (no local ticket branch).
  - Failed fetch: a second `clone()` `d`, the same push, fetch and remote deletion; then `d.git('branch', 't/ST-9',
    'origin/t/ST-9')` (merged into the `origin/main` the clone last fetched) and `d.git('remote', 'set-url',
    'origin', d.remote + '-missing')`. `worktree clean` from `d.root` exits 0; `lines(out)` has length 2, the first
    starts with `fetch from origin failed, judging against the refs already in this clone` and is the only line
    about the fetch, the second is `deleted t/ST-9 (was <origin/main sha>)`; `git branch -r` still contains
    `origin/t/ST-9` and `origin/backlog/notes`.

Interface, in `worktreeClean` step 2: when `gitNoPrompt(ctx.root, ['fetch', 'origin'])` succeeds, run
`gitNoPrompt(ctx.root, ['remote', 'prune', 'origin'])` (it contacts the remote, so it goes through the same
no-prompt wrapper). A plain fetch first and the prune only after it, never `git fetch --prune`, because git prunes
before the transfer (ledger Ruling 8). A prune that fails prints `prune of origin failed, stale remote refs are
kept: <firstLine(e)>` and the command goes on; it removes only names the remote no longer lists (Approach,
failure scenario B). The prune is silent on success, so no existing test's output changes. It prunes every stale
ref of `origin`, ticket or not, while the branch pass still deletes only ticket branches (D-04).

`packages/cli/src/run.ts`: the `worktree clean` description becomes `fetch, then remove the worktrees of merged
tickets, delete merged ticket branches and prune stale remote refs, naming what is removed or kept`. Update the
doc comment above `worktreeClean` to name the prune.

Must not change: the fetch-failure line and that no prune runs after it; Task 1's tests and the existing cases it
updated; the three `risk:security` ssh cases (their fetch fails, so the prune never runs); the order and options of
every command in `run.ts`.

---
baseline: 786f302801ab64684e1cc59e29044bcd7d0d9b80
plan_hash: "fnv1a64:b819cb8897b602ee"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It is the one fetch helper, called by Pick up, Continue and `new ticket --worktree`
before any ref or the snapshot is read, so a new ticket branch is cut from the remote's latest default branch.
Task 2 adds Continue's behind line. Task 3 adds `accord worktree merge <id>`, with its merge commit and the
conflict stop. Task 4 adds the merge's refusals and its two edge failures. Task 5 adds the 30 s limit and proves
the failed-fetch line at all four points. Task 6 is the skill text and the README, and regenerates the
copies.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is
  the test file's path, then `#`, then the `it` title with each whitespace run turned into `-`. No test title
  holds `@` or a comma. No existing test is renamed. That includes every case in
  `packages/cli/test/worktree.test.ts` and every case listed in `accord/tests-baseline.txt`.
- CLI tests drive the CLI with `run(argv, cwd, env)` from `./helpers/repo.js`, with env `{}` unless a step says
  otherwise. Repositories come from the file's `clone(...)` wrapper around `makeClone` from
  `./helpers/worktree.js`, so `afterEach` removes every directory. They run against a real bare remote with no
  mock for git (Approach, Tests). Reuse the file's helpers `lines`, `stopLines`, `ticketWorktree`, `sha` and
  `writeFiles`. `c.otherClone()` is the teammate clone that pushes commits `c` has not fetched.
- CLI tests import core from `packages/core/dist`. After changing anything under `packages/core/`, run `npm run gen`
  when a file under `packages/core/skills/` changed, then `npm run build -w packages/core`, before running any CLI
  test. Run one file with `npx vitest run <path>`. End every task with `npm run build`, `npm run lint` and
  `npm run typecheck`, then run the test files the task names and the whole of `packages/cli/test/worktree.test.ts`.
- Files are LF with no BOM. Add no dependency. Every path the CLI prints uses `/` (D-51). Every new `git` spawn is
  `execFileSync('git', [...])` with a literal `'git'`, or goes through `git()`, `gitOk()` or `gitNoPrompt()` in
  `packages/cli/src/commands/worktree.ts` (`packages/cli/test/spawn-surface.test.ts` checks this).
- An existing test whose expected output changes because of this ticket is updated in place: its expected lines
  gain the new line, and nothing is weakened or removed. A test this plan names that cannot pass as written is
  reported BLOCKED with its output; it is never weakened.

Definitions shared by every task:
- The default ref: `gitDefaultRef(root)` (`packages/cli/src/load/fs.ts:574`), a full `refs/remotes/origin/...`
  name, read after the fetch. Its short name `def` is `ref.replace('refs/remotes/', '')`, as `checkPin` makes it,
  so `origin/main` in the test clones.
- The ticket branch: `branchOf(ctx.snapshot, id)`, `t/<id>` in the test clones.
- The fetch-failed line, written to `ctx.stdout`, one line: `fetch from origin failed, going on with the refs
  already in this clone: <why>`. `<why>` is `firstLine(e)`, git's first stderr line as `worktree clean` quotes it.
  When the time limit ran out (Task 5) it is `no answer within <seconds> seconds` instead (D-10).
- The behind line (Task 2), written to `ctx.stdout`: `behind: <branch> is <n> commits behind <def>; merge them
  with git merge <def>`, with `commit` in place of `commits` when `<n>` is 1.
- A ticket at verify: its lane ticket file carries the `approved_hash:` its body hashes to. Its `plan.md` is
  `PLAN` from `test/helpers/lane.ts`, its `ledger.md` records both tasks as done, and its `review.md` ends with
  a verdict. `statusRows(snapshot)` then gives it stage `verify` (`packages/core/src/status/stage.ts:57`).

## Task 1: Wiring: Pick up, Continue and new ticket --worktree fetch origin first and cut the branch from the latest main
covers: @ac-1, D-01, D-06, D-07
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/new-ticket.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-1-pick-up-and-a-new-worktree-ticket-cut-the-ticket-branch-from-a-main-commit-this-clone-had-not-fetched (@ac-1), packages/cli/test/worktree.test.ts#risk:concurrency-pick-up-fetches-before-it-judges-the-claim-so-a-claim-pushed-since-the-last-fetch-refuses

Consumes: `gitNoPrompt`, `gitOk` and `firstLine` in `worktree.ts`; `loadSnapshot` from `@accord-dev/accord-core`;
`loadFromFs` from `../load/fs.js`. Produces `export function fetchOrigin(ctx: CommandContext): CommandContext`,
which Tasks 3 and 5 also call.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-1 pick up and a new worktree ticket cut the ticket branch from a main commit this clone had not fetched')`:
  - Pick up: `c = clone()`; `o = c.otherClone()`; in `o` write `next.txt` (`next\n`), `git add -A`,
    `git commit -q -m next` and `git push -q origin main`; read `tip = gitRun(o, 'rev-parse', 'HEAD').trim()`.
    Precondition: `sha(c, 'origin/main')` is not `tip`. `run(['worktree', 'open', 'ST-9'], c.root)` exits 0.
    `c.git('rev-parse', 't/ST-9^')` is `tip`, and `git log -1 --format=%s t/ST-9` is `claim: ST-9`. `out`
    does not contain `fetch from origin failed`.
  - New ticket: `d = clone({ tickets: [] })`, with the same push from `d.otherClone()` and its own `tip`.
    `run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], d.root)` exits 0.
    `d.git('rev-parse', 't/ST-9^')` is that `tip`, and `d.git('show', 't/ST-9:accord/tickets/ST-9.md')` is
    non-empty.
- `it('risk:concurrency pick up fetches before it judges the claim so a claim pushed since the last fetch refuses')`:
  `c = clone()`; `o = c.otherClone()`; in `o`, `git config user.email other@example.invalid`, then
  `git switch -q -c t/ST-9`, `git commit -q --allow-empty -m "claim: ST-9"` and `git push -q origin t/ST-9`.
  `c` does not fetch. `run(['worktree', 'open', 'ST-9'], c.root)` exits 2, and `err` contains
  `claimed: ST-9 by other@example.invalid`. `existsSync(c.sibling('ST-9'))` is false, and
  `c.git('rev-parse', '--verify', '-q', 'refs/heads/t/ST-9')` throws. This is the ledger Ruling on critic 1.

Interface:
- `fetchOrigin(ctx)`: with no `origin` remote (`gitOk(ctx.root, ['remote', 'get-url', 'origin'])` false) it
  returns `ctx` and prints nothing. Otherwise it runs `gitNoPrompt(ctx.root, ['fetch', '--no-prune', 'origin'])`.
  On a throw it prints the fetch-failed line with `<why>` = `firstLine(e)` and returns `ctx` unchanged (D-06). On
  success it returns `{ ...ctx, snapshot: loadSnapshot(loadFromFs(ctx.root)) }`. The claim branches, the claims
  and the claim template are then read from the fetched refs (ledger Ruling on critic 1). `--no-prune` keeps a
  user's prune setting from dropping a ref before `worktree clean` can name it, as in `worktreeClean`.
- `worktreeOpen`: right after `guardTicketSession(...)`, and before `canEnter`, `branchOf`, `worktrees`, any
  `rev-parse` and `checkClaimant`, add `ctx = fetchOrigin(ctx);`. This covers both Pick up and `--continue`
  (D-02 asks Continue to fetch the same way). Everything after it reads `ctx` as it is now.
- `newTicket` in `new-ticket.ts`: right after `guardTicketSession(ctx);`, add
  `if (options.worktree === true) ctx = fetchOrigin(ctx);`. This comes before the people check, the id
  allocation (`gitPeopleOnRefs`, `gitTicketIdsInHistory`, `ctx.snapshot.claims`) and `newTicketWorktree`. A
  `new ticket` without `--worktree` never fetches.
- Doc comments: one line above `fetchOrigin` naming ST-LN-30 D-01 and D-06.

Must not change: `worktree clean` and its fetch, `gitNoPrompt`'s ssh handling, and the three `risk:security` ssh
cases. Every refusal message of `worktree open` and `new ticket` stays. So do the stop, enter, held and pruned
lines and their order. `new ticket` without `--worktree` makes no network call. The existing cases in
`worktree.test.ts` still pass. Any whose expected output now differs is updated per the rules above.

## Task 2: Continue says when the ticket branch is behind the default branch and changes nothing
covers: @ac-2, D-02
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-2-continue-says-the-ticket-branch-is-2-commits-behind-the-remote-main-and-leaves-the-branch-unchanged (@ac-2)

Consumes: Task 1's fetch in `worktreeOpen`. Produces the behind line on `--continue`.

Test first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-2 continue says the ticket branch is 2 commits behind the remote main and leaves the branch unchanged')`:
  `c = clone()`; `ticketWorktree(c, 'ST-9')`; read `before = sha(c, 't/ST-9')`. In `o = c.otherClone()`, make two
  commits on `main` (`a.txt` and `b.txt`, one each) and push `main`. Precondition: `sha(c, 'origin/main')` is not
  `o`'s HEAD. `run(['worktree', 'open', 'ST-9', '--continue'], c.root)` exits 0. `lines(out)[0]` is
  `behind: t/ST-9 is 2 commits behind origin/main; merge them with git merge origin/main`.
  `lines(out).slice(1, 4)` equals `stopLines(c.sibling('ST-9'), 'ST-9')`. Exactly one line of `out` starts with
  `behind:`. `sha(c, 't/ST-9')` and `gitRun(c.sibling('ST-9'), 'rev-parse', 'HEAD').trim()` are both `before`, and
  `gitRun(c.sibling('ST-9'), 'status', '--porcelain')` is `''`.

Interface, in `worktreeOpen`, after the `if (opts.continue !== true) { ...checkClaimant... }` block and before the
`held !== undefined` branch:
- When `opts.continue === true` and `local || remote`: `ref = gitDefaultRef(ctx.root)`. When it is defined, take
  `tip = local ? 'refs/heads/' + branch : 'refs/remotes/origin/' + branch` and
  `n = Number(git(ctx.root, ['rev-list', '--count', tip + '..' + ref]).trim())`. When `n > 0`, print the behind
  line. Nothing is merged, fetched again, or written (D-02, D-04).
- Pick up prints no behind line. A failed fetch (Task 1) leaves the comparison on the refs already in the clone.

Must not change: the stop, enter and held lines and their text. The `not claimed:` and `not a ticket:` refusals,
which print no behind line. Pick up's output. Existing Continue cases whose branch is now behind gain the behind
line as their first line, per the rules above.

## Task 3: accord worktree merge merges the remote main into the ticket branch with a merge commit and stops on a conflict
covers: @ac-3, @ac-4, D-03, D-04, D-09
files: packages/cli/src/commands/worktree.ts, packages/cli/src/run.ts, packages/cli/test/worktree.test.ts, packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree.test.ts#ac-3-worktree-merge-at-verify-gives-the-ticket-branch-a-merge-commit-of-its-head-and-the-fetched-main-commit (@ac-3), packages/cli/test/worktree.test.ts#ac-4-a-merge-conflict-is-aborted-names-the-file-exits-2-and-the-next-merge-tries-again (@ac-4)

Consumes: `fetchOrigin` (Task 1), `gitDefaultRef`, `currentBranch` and `UsageError` from `../load/fs.js`,
`branchOf`, `git`, `gitOk` and `firstLine`. Produces `export function worktreeMerge(ctx: CommandContext, id:
string): number` and the subcommand `accord worktree merge <id>`.

Test helper first, in `worktree.test.ts` beside `ticketWorktree`:
`function verifyStage(dir: string, id: string, opts: { review?: boolean } = {})`. Build the ticket file `text` as
`laneTicket(id)`. Compute `approvedHash(loadSnapshot({ files: { 'accord/config.yml': CONFIG,
['accord/tickets/' + id + '.md']: text }, tree: [] }).tickets[id])` and set it with
`setFrontmatterKey(text, 'approved_hash', hash)`, as `approve` in `packages/cli/test/dashboard.test.ts:15-18`
does. Write with `writeFiles(dir, ...)`: `accord/tickets/<id>.md` = that text,
`accord/tickets/<id>/plan.md` = `PLAN` and `accord/tickets/<id>/ledger.md` =
`## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n`. Unless `opts.review === false`, also write
`accord/tickets/<id>/review.md` = `verdict: converged\n`. Then run `git add -A` and `git commit -q -m "review: <id>"`
in `dir`. Import `approvedHash`, `loadSnapshot` and `setFrontmatterKey` from `@accord-dev/accord-core`, and
`CONFIG` and `PLAN` from `../../../test/helpers/lane.js`.

Tests first:
- `it('ac-3 worktree merge at verify gives the ticket branch a merge commit of its head and the fetched main commit')`:
  `c = clone()`; `ticketWorktree(c, 'ST-9')`; `sib = c.sibling('ST-9')`; `verifyStage(sib, 'ST-9')`. Precondition:
  the `ST-9` row of `JSON.parse((await run(['status', '--json'], sib)).out)` has stage `verify`. Read
  `head = gitRun(sib, 'rev-parse', 'HEAD').trim()`. In `o = c.otherClone()`, commit `next.txt` on `main`, push,
  and read `tip`. `run(['worktree', 'merge', 'ST-9'], sib)` exits 0. In `sib`: `rev-parse HEAD^1` is `head` and
  `rev-parse HEAD^2` is `tip`. `git rev-list --parents -n 1 HEAD` splits into exactly 3 shas. `git branch
  --show-current` is `t/ST-9`. `status --porcelain` is `''`, and `next.txt` exists in `sib`. `git reflog -n 10`
  does not contain `rebase`. A second `run(['worktree', 'merge', 'ST-9'], sib)` exits 0 with `out` and `err`
  empty, and HEAD is unchanged: nothing more is merged.
- `it('ac-4 a merge conflict is aborted names the file exits 2 and the next merge tries again')`: `c = clone()`. In
  `c.root`, write `shared.txt` (`base\n`), commit and `git push -q origin main`. Then
  `ticketWorktree(c, 'ST-9', 'shared.txt')`, which makes the branch's `shared.txt` read `ST-9\n`, and
  `verifyStage(sib, 'ST-9')`. In `o = c.otherClone()`, write `shared.txt` = `main\n`, commit and push `main`.
  Read `head` in `sib`. `run(['worktree', 'merge', 'ST-9'], sib)` exits 2, and `err` contains `conflict` and
  `shared.txt`. In `sib`: HEAD is `head`; `status --porcelain` is `''`; `readFileSync(sib + '/shared.txt')` is
  `ST-9\n`; `git rev-parse -q --verify MERGE_HEAD` throws. Nothing under `accord/tickets/ST-9/` changed, which
  the clean status covers. A second run exits 2 again, its `err` contains `shared.txt`, and HEAD is still `head`.
  The next start tries again, and nothing is stored (D-03, ledger Ruling on ac-4).

Interface, `worktreeMerge(ctx, id)` in this order:
1. `if (!ID.test(id)) throw new UsageError('not a valid ticket id: ' + id)`. `branch = branchOf(ctx.snapshot, id)`.
2. No `origin` remote: return 0, printing nothing (ledger Ruling).
3. `fetchOrigin(ctx)`. Its returned context is not needed. A failed fetch prints its line and the merge goes on
   with the refs already in the clone (D-06).
4. `ref = gitDefaultRef(ctx.root)`. When it is undefined, print
   `no origin/HEAD, origin/main or origin/master in this clone - nothing was merged` and return 0 (ledger Ruling).
   Otherwise `def` is its short name.
5. When `gitOk(ctx.root, ['merge-base', '--is-ancestor', ref, 'HEAD'])` is true, the branch is not behind: return
   0, printing nothing (ledger Ruling on critic 2).
6. `execFileSync('git', ['merge', '--no-ff', '--no-edit', def], { cwd: ctx.root, encoding: 'utf8', stdio:
   ['ignore', 'pipe', 'pipe'] })`. `--no-ff` always gives a two-parent merge commit whose first parent is the
   old head (ac-3). There is never a rebase. On success return 0, printing nothing.
7. On a throw: first read `files = git(ctx.root, ['diff', '--name-only', '--diff-filter=U'])` split into non-empty
   lines. Then, only when `gitOk(ctx.root, ['rev-parse', '-q', '--verify', 'MERGE_HEAD'])`, run
   `git(ctx.root, ['merge', '--abort'])`. Then throw a `UsageError` (exit 2):
   - files found: `merge of <def> into <branch> stopped on a conflict in <files joined by ', '> - the merge was
     aborted and <branch> is as it was; resolve the conflict, then start verify again`;
   - none: `merge of <def> into <branch> failed: <firstLine(e)> - <branch> is as it was` (ledger Ruling on
     critic 3).
- One doc comment line above `worktreeMerge` naming ST-LN-30 D-03, D-04 and D-09.

`packages/cli/src/run.ts`: import `worktreeMerge`, and after `worktree open` register
`worktree.command('merge <id>').description("before verify: fetch, then merge the remote main into the ticket's
branch with a merge commit; a conflict is aborted, named, and exits 2").action((id: string) => {
setCode(worktreeMerge(preflight(opts, 'stage'), id)); })`. `'stage'` loads the plan facts that `accord next` and
`accord anchor` use for the stage.

`packages/cli/test/skill-commands.test.ts:92`: the expected `REAL` list gains `'worktree merge'`, between
`'worktree clean'` and `'worktree open'`.

Must not change: `worktreeClean`, `worktreeOpen`, `newTicketWorktree`, `gitDefaultRef`, `checkPin`, and every
other command's registration and order in `run.ts`.

## Task 4: worktree merge refuses outside verify, off the ticket branch and over tracked changes, keeps ignored files and names a changed pin
covers: D-04, D-09
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-worktree-merge-refuses-before-verify-on-another-branch-and-over-tracked-changes-and-merges-nothing, packages/cli/test/worktree.test.ts#risk:data-loss-worktree-merge-never-overwrites-an-ignored-file-and-quotes-the-git-error-that-stopped-it, packages/cli/test/worktree.test.ts#risk:complex-branching-a-merge-that-changes-the-pinned-accord-version-keeps-the-merge-and-names-the-pin

Consumes: Task 3's `worktreeMerge` and `verifyStage`; `statusRows` from `@accord-dev/accord-core`; `checkPin`,
`listWorktrees` and `currentBranch`. Produces the same `worktreeMerge`, with three refusals before any fetch, the
`--no-overwrite-ignore` flag, and the pin line after a merge.

Tests first, in `packages/cli/test/worktree.test.ts`. In each, `o = c.otherClone()` commits on `main` and pushes
before the run, so the branch is behind:
- `it('risk:complex-branching worktree merge refuses before verify on another branch and over tracked changes and merges nothing')`:
  - Before verify: `c = clone()`; `ticketWorktree(c, 'ST-9')`; `verifyStage(sib, 'ST-9', { review: false })`.
    Read `head`, and `main0 = sha(c, 'origin/main')`, after `o` pushed. `run(['worktree', 'merge', 'ST-9'], sib)`
    exits 2, and `err` contains `only at verify` and `nothing was merged`. HEAD is `head`, and `sha(c,
    'origin/main')` is still `main0`: the refusal came before the fetch.
  - On another branch: in a second clone `d` set up the same way but with `verifyStage(..., 'ST-9')`, run from
    `d.root` (on `main`). It exits 2, and `err` contains `t/ST-9` and `nothing was merged`.
    `gitRun(d.sibling('ST-9'), 'rev-parse', 'HEAD')` is unchanged.
  - Over tracked changes: in a third clone `e` at verify, overwrite `ST-9.txt` in its sibling with `changed\n`.
    Running from the sibling exits 2, and `err` contains `uncommitted changes`. `ST-9.txt` still reads
    `changed\n`, and HEAD is unchanged.
- `it('risk:data-loss worktree merge never overwrites an ignored file and quotes the git error that stopped it')`:
  `c = clone()`; `ticketWorktree(c, 'ST-9')`; `verifyStage(sib, 'ST-9')`. Write `sib/node_modules/keep.txt` =
  `mine\n`, which is ignored by the clone's `.gitignore`. In `o`, write `node_modules/keep.txt` = `theirs\n`,
  `git add -f node_modules/keep.txt`, commit and push `main`. `run(['worktree', 'merge', 'ST-9'], sib)` exits 2.
  `err` contains `merge of origin/main into t/ST-9 failed: ` and does not contain `conflict`. The file still
  reads `mine\n`, HEAD is unchanged, and `MERGE_HEAD` does not resolve (ledger Rulings on critic 2 and 3).
- `it('risk:complex-branching a merge that changes the pinned accord version keeps the merge and names the pin')`:
  `c = clone()`; `ticketWorktree(c, 'ST-9')`; `verifyStage(sib, 'ST-9')`; read `head`. In `o`, replace
  `accord: "0.1.0"` with `accord: "9.9.9"` in `accord/config.yml`, commit, push `main` and read `tip`.
  `run(['worktree', 'merge', 'ST-9'], sib)` exits 2, and `err` contains `pins accord 9.9.9`. In `sib`,
  `HEAD^1` is `head` and `HEAD^2` is `tip`: the merge is kept (ledger Ruling on critic 4).

Interface, in `worktreeMerge`, between step 1 and step 2 of Task 3, in this order, each a `UsageError` (exit 2):
- Branch: `cur = currentBranch(ctx.root)`. When `cur !== branch`, throw `<id> is merged on its branch <branch>,
  and this checkout is on <cur, or "a detached HEAD" when cur is '' or undefined> - run accord worktree merge <id>
  in the ticket's worktree; nothing was merged`.
- Tracked changes: when `git(ctx.root, ['status', '--porcelain', '--untracked-files=no']).trim() !== ''`, throw
  `<ctx.root> has uncommitted changes to tracked files - commit them, then run accord worktree merge <id> again;
  nothing was merged`. A merge abort may not restore such changes.
- Stage: `stage = statusRows(ctx.snapshot).find((r) => r.id === id)?.stage`. When `stage !== 'verify'`, throw
  `<id> is at stage <stage, or "none" when undefined>, and accord worktree merge runs only at verify, after review
  - nothing was merged` (D-04: the tool, not the session, holds "merge once, after review").
- Step 6's arguments become `['merge', '--no-ff', '--no-edit', '--no-overwrite-ignore', def]`.
- After a successful merge in step 6, call `checkPin(ctx, id, ctx.root, branch, listWorktrees(ctx.root)[0].path)`
  and let its `UsageError` propagate. Preflight has already checked the pin before the merge, so it throws only
  when the merge changed the pinned version, and it prints the line `checkPin` already prints.

Must not change: Task 3's two tests and its step order. The refusals run before `fetchOrigin`, so a refused
command makes no network call. `checkPin`'s messages.

## Task 5: The fetch has a 30 s limit, and a failed or silent fetch is one line at all four points
covers: @ac-5, D-06, D-08, D-10
files: packages/cli/src/commands/fetch-limit.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-5-a-failed-or-silent-fetch-is-one-accord-line-at-pick-up-new-ticket-continue-and-merge-and-the-work-goes-on (@ac-5)

Consumes: `fetchOrigin` (Task 1), `worktreeMerge` (Tasks 3 and 4), `verifyStage`. Produces
`packages/cli/src/commands/fetch-limit.ts`:
`export function fetchLimitMs(): number { return 30_000; }`, with one comment line naming ST-LN-30 D-08. The
limit lives in its own module so the test can mock it the way `load/proc.js` is mocked: `vi.mock` cannot swap a
binding used inside its own module (ledger Ruling on the limit).

Test setup first, at the top of `worktree.test.ts`, beside the `proc.js` mock:
`import * as limit from '../src/commands/fetch-limit.js';`, then
`vi.mock('../src/commands/fetch-limit.js', async (orig) => { const real = await orig<typeof
import('../src/commands/fetch-limit.js')>(); return { ...real, fetchLimitMs: vi.fn(real.fetchLimitMs) }; });`.
In `afterEach`, add `vi.mocked(limit.fetchLimitMs).mockReset();`.

Test first:
- `it('ac-5 a failed or silent fetch is one accord line at pick up new ticket continue and merge and the work goes on', async () => {...}, 60_000)`.
  `P = 'fetch from origin failed, going on with the refs already in this clone: '`.
  `one(out, err)` asserts three things. Exactly one line of `lines(out + err)` contains `fetch`. That line starts
  with `P` and is longer than `P`. No line starts with `fatal:`.
  - Pick up: `c = clone()`; `c.git('remote', 'set-url', 'origin', c.remote + '-missing')`; `base = sha(c,
    'origin/main')`. `run(['worktree', 'open', 'ST-9'], c.root)` exits 0, `one(out, err)` holds, and
    `c.git('rev-parse', 't/ST-9^')` is `base`.
  - New ticket: `d = clone({ tickets: [] })`. `d.git('remote', 'set-url', 'origin', d.remote + '-missing')`,
    then `d.git('remote', 'set-url', '--push', 'origin', d.remote)`, so the claim push still works.
    `run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], d.root)` exits 0, and `one` holds.
  - Continue: `e = clone()`; `ticketWorktree(e, 'ST-9')`; set the url missing as for `c`.
    `run(['worktree', 'open', 'ST-9', '--continue'], e.root)` exits 0, `one` holds, and the stop lines follow.
  - Verify: `f = clone()`; `ticketWorktree(f, 'ST-9')`; `verifyStage(f.sibling('ST-9'), 'ST-9')`; set the url
    missing. `run(['worktree', 'merge', 'ST-9'], f.sibling('ST-9'))` exits 0, `one` holds, and HEAD is unchanged.
  - No answer: `g = clone()`. Set `g.git('config', 'remote.origin.uploadpack', 'cd / && sleep 8 >/dev/null 2>&1;
    :')`, a remote side that answers nothing for 8 s. Git appends the repository path, which `:` swallows, and the
    sleeper holds no folder the test removes and no pipe of accord's. Then
    `vi.mocked(limit.fetchLimitMs).mockReturnValue(2000)` and `t0 = Date.now()`.
    `run(['worktree', 'open', 'ST-9'], g.root)` exits 0. `Date.now() - t0` is below 6000. The one fetch line
    equals `P + 'no answer within 2 seconds'`, and `g.git('rev-parse', 't/ST-9^')` is the clone's `origin/main`.
    Then wait until `t0 + 9000` with `await new Promise((r) => setTimeout(r, Math.max(0, t0 + 9000 -
    Date.now())))`, so no sleeper outlives the test. The Approach's Should is that this test proves on
    windows-latest that the call returns on time. When the bound fails there, report BLOCKED with the timing,
    and never raise the bound.

Interface:
- `gitNoPrompt(cwd, args, timeout?: number)`: when `timeout` is given, `execFileSync` also receives `timeout`.
  `worktreeClean`'s two calls pass none and keep no limit (ledger Ruling on critic 7).
- `fetchOrigin`: `ms = fetchLimitMs()` is read at each call, never at module load, and is passed as the fetch's
  `timeout`. In the catch, `<why>` is `no answer within ${ms / 1000} seconds` when
  `(e as NodeJS.ErrnoException).code === 'ETIMEDOUT'`, which is what `execFileSync` throws when its timeout
  kills the child. Otherwise `<why>` stays `firstLine(e)`. A timed-out fetch counts as failed, and the work goes
  on (D-08, D-10).

Must not change: `worktree clean`'s fetch and its failure line, `judging against the refs already in this
clone`. Tasks 1 to 4's tests. The three `risk:security` ssh cases.

## Task 6: The verify skill merges before its suite, worktree.md shows the new lines, and the docs follow
covers: D-04, D-05, D-09
files: packages/core/skills/verify/SKILL.md, packages/core/skills/accord/worktree.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, .claude/skills/accord-verify/SKILL.md, .claude/skills/accord/worktree.md, README.md, packages/cli/README.md
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-verify-skill-merges-the-remote-main-after-the-review-commit-and-before-the-full-suite

Consumes: the command `accord worktree merge <id>` (Task 3, now in `REAL`), the fetch-failed line (Tasks 1 and 5)
and the behind line (Task 2). This task holds the half of ac-3 that is the order of verify step 2: the suite and
the verification run on the merge commit.

Test first, in `packages/core/test/stage-skills.test.ts`, top-level:
- `it('risk:regression the verify skill merges the remote main after the review commit and before the full suite')`:
  `get` and `slice` are as in the existing worktree case at line 241, with whitespace collapsed. `text =
  get('.claude/skills/accord-verify/SKILL.md')`, `ref = get('.claude/skills/accord/worktree.md')`, and
  `step = slice(text, '2. **Merge and suite.**', '3. **Verifier.**')`, which is non-empty. Within `step`, the
  index of `commit everything` is less than that of `` `accord worktree merge <id>` ``, which is less than that
  of `` `tests.full` ``. `step` contains `exits 2`, `stop`, `never a rebase`, `` `fetch from origin failed` `` and
  `that commit is the one verified`. In `text`, `` `accord worktree merge <id>` `` comes before
  `accord-verifier`. `ref` contains ``A line starting `fetch from origin failed` ``,
  ``A line starting `behind:` `` and `Never merge here`.

Text, every code span on one line:
- `packages/core/skills/verify/SKILL.md`, step 2 becomes:
  "2. **Merge and suite.** First commit everything, `review.md` included, so the working tree is clean. Then run
  `accord worktree merge <id>`. It fetches, and when the ticket branch lacks commits of the remote's default
  branch it merges them with a merge commit, never a rebase. Show a line starting `fetch from origin failed`
  verbatim and go on. When it exits 2 (a conflict it aborted, a failed merge, or a refusal), show the message
  and stop. The owner resolves a conflict, or you do when the owner says so, and then this stage starts again.
  Then run the `tests.full` command from `accord/config.yml` at the commit now checked out, so the report
  `tests.report` names is fresh: that commit is the one verified." Nothing else in the file changes.
  `REQUIRED.verify` still finds every phrase, and the rendered file stays under `MAX_SKILL_BYTES`
  (`packages/core/test/skills.test.ts`).
- `packages/core/skills/accord/worktree.md`, after the `pruned <path>: <reason>` bullet, add two bullets:
  "- A line starting `fetch from origin failed`: the fetch before the work failed, or the remote did not answer
  in time. Show the line verbatim and go on with the other lines; the work goes on with the refs already in this
  clone." and "- A line starting `behind:` (Continue only): the ticket branch lacks commits that are on the
  remote's default branch. Show the line verbatim and go on. Never merge here: `accord-verify` runs
  `accord worktree merge <id>` once, after review."
- `README.md`, line 34 (the worktree bullet): after its first sentence, add "Pick up, Continue and a new lane M
  ticket first fetch `origin`, so a new ticket branch starts at the remote's latest default branch. A fetch that
  fails, or gets no answer within 30 seconds, is one line, and the work goes on. Continue says when the ticket
  branch is behind. Before its full suite, `accord-verify` runs `accord worktree merge <id>`, which merges the
  remote's default branch into the ticket branch with a merge commit, never a rebase. A conflict is aborted and
  named, and verify stops." Line 36: `worktree open|clean` becomes `worktree open|clean|merge`.

Regenerate from the repository root, in this order:
1. `npm run gen`, which rewrites `packages/core/src/generated/skills.ts` and `packages/cli/README.md`.
2. `npm run build`.
3. `node packages/cli/dist/cli.js skills sync`, which rewrites `.claude/skills/accord-verify/SKILL.md` and
   `.claude/skills/accord/worktree.md`. When it changes any other file, report BLOCKED with `git status`.
Then run `packages/core/test/stage-skills.test.ts`, `packages/core/test/skills.test.ts`,
`packages/cli/test/skill-commands.test.ts`, `packages/cli/test/readme.test.ts` and
`packages/cli/test/skills-sync.test.ts`.

Must not change: every phrase the existing cases of `stage-skills.test.ts` assert. That includes `REQUIRED.verify`
and the two worktree cases at lines 241 and 278: the `stop:` bullet, `pruned` bullet, `enter:` bullet and
Session check text stay as they are. Verify steps 1 and 3 to 7. No skill names `git rebase`, `git switch` or
`worktree clean` outside the Dashboard.

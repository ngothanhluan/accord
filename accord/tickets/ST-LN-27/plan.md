---
baseline: 769ed1da753d4f122e4b819570bc3aaef44cf94d
plan_hash: "fnv1a64:a226e94bac5fe6a7"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order: Task 1 is the wiring. It makes Pick up and Continue, typed in a Claude Code session in the main checkout,
take the hold and print `enter: <path>`, the line the skill moves on. Task 2 does the same for a new lane M ticket.
Task 3 adds the rule that a session works one ticket, and the CLI refusals. Tasks 4 and 5 add the
UserPromptExpansion hook and register it. Task 6 covers the session hooks and `worktree clean`. Task 7 is the
skill text. Task 8 runs last: it adds the record of the ticket each session worked, which keeps a session on its
ticket after `worktree clean` or another session's takeover drops its hold, and after a start in a ticket worktree
that took no hold; it needs Tasks 1, 3, 4 and 6.

Rules for every task:
- Test ids: every test this plan writes and names on a `verify:` line is a top-level `it(...)` with no `describe`
  around it. Its report id is the test file's path, then `#`, then the `it` title with each whitespace run turned
  into `-`. No test title holds `@` or a comma. No existing test is renamed. That includes the ST-LN-7 and ST-LN-20
  cases in `packages/cli/test/worktree.test.ts` and every case listed in `accord/tests-baseline.txt`. The two
  existing `packages/core/test/skills.test.ts` cases on Task 7's `verify:` line sit inside a `describe`; their ids
  are copied verbatim from `accord/tests-baseline.txt` (lines 905 and 915).
- CLI tests import core from `packages/core/dist`. After changing anything under `packages/core/`, run `npm run gen`
  when a file under `packages/core/skills/` changed, then `npm run build -w packages/core`, before running any CLI
  test. Run one file with `npx vitest run <path>`. End every task with `npm run build`, `npm run lint` and
  `npm run typecheck`, then run the test files the task names and the whole of `packages/cli/test/worktree.test.ts`.
- Files are LF with no BOM. Add no dependency. Every path the CLI prints or stores uses `/` (D-51). Every `git`
  spawn goes through `git()`/`gitOk()` in `commands/worktree.ts` or the existing helpers in `load/fs.ts`.
- Tests that need a remote use `makeClone` from `packages/cli/test/helpers/worktree.ts`. Tests that need a Claude
  Code session use the existing helpers at the top of `worktree.test.ts`: `A`, `B`, `envOf`, `tableOf`,
  `setTable`, `holdsFile`, `HELD`, `DEAD`, `LIVE`, `writeHolds`, `readHolds`, `lines`, `stopLines`,
  `ticketWorktree` and `mergeOnRemote`. A third session, used where a test needs one, is
  `const C = { pid: 7003, start: 'S-C', marker: 'sess-C' }`. This is a different object from the local `C`
  inside the existing re-enter test.

Definitions shared by every task:
- A Claude Code session: `claudeEnv(ctx.env)` (`packages/cli/src/load/proc.ts:53`) is defined, or
  `ctx.env.CLAUDECODE === '1'`, in which case `claudeEnv` throws because `CLAUDE_CODE_SESSION_ID` or `CLAUDE_PID` is
  missing (`proc.ts:60-65`). Taking a hold and printing `enter:` need `claudeEnv` defined: `canEnter` (Task 1) reads
  a throw as "no", so such a session gets today's stop lines. The works-ticket rule reads the session through
  `inClaude` (Task 3), which never throws; such a session has no marker, so only the folder rule applies to it.
  No new code lets that throw become a refusal of a main-checkout flow or a lost hook output. Anything else is
  another runtime, which keeps today's output and is refused nothing (D-01). Read `ctx.env`, never `process.env`.
- The main checkout: the repository whose `git rev-parse --path-format=absolute --git-dir` equals its
  `--git-common-dir` (compared with `norm`, `worktree.ts:161`). A linked worktree is any other. Ledger Ruling: a
  main checkout switched by hand to a ticket branch is not that ticket's worktree.
- The enter output: the single line `enter: <path>`, where `<path>` is the worktree's path as `git worktree list`
  prints it. It is printed in place of the three stop lines (`printStop`, `worktree.ts:187`) and only when the
  command runs in a Claude Code session in the main checkout.
- Works ticket A (D-04, Approach): only in a Claude Code session. Either the command's folder is inside a linked
  worktree whose branch names A through `ticketOfBranch`, or the holds file has an entry for A whose `marker`
  equals this session's marker, or the worked record (Task 8) has a line for A with this session's marker. A
  linked worktree whose branch is detached or unreadable is a worktree whose ticket cannot be named. No process
  table is read for this rule (ledger Ruling on session identity).
- The worked record (ledger Ruling on plan-review 1.1): the file `<git-common-dir>/accord/worked`, one line
  `<id>\t<marker>\n` per ticket a session marker took a hold on or was started in. `takeHold` appends it, and so
  does the session-start hook whenever it resolves a ticket worktree, hold or not (Task 8); nothing ever removes a
  line, so neither `worktree clean` nor a takeover makes a session forget its ticket.
- The refusal message (D-02, D-06, @ac-4), built by `worksMessage` (Task 3). When A is known:
  `this session works <A>: open a new session in the main checkout <mainPath> for other work, or type a request about <A> without "/accord" - nothing was changed`.
  When the worktree's branch cannot be read:
  `this session works the ticket worktree <top>, whose branch cannot be read: open a new session in the main checkout <mainPath> for other work, or type a request about that ticket without "/accord" - nothing was changed`.

## Task 1: Wiring: in Claude Code, Pick up and Continue from the main checkout take the hold and print enter instead of stop
covers: @ac-1, @ac-2, D-08
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-1-in-claude-code-pick-up-from-the-main-checkout-takes-the-hold-and-prints-enter-instead-of-stop (@ac-1), packages/cli/test/worktree.test.ts#ac-2-in-claude-code-continue-from-the-main-checkout-enters-a-claimed-worktree-whose-session-ended-with-or-without-a-worktree-here (@ac-2), packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-worktree-pinned-to-another-accord-version-refuses-before-setup-and-prints-no-enter, packages/cli/test/worktree.test.ts#risk:concurrency-in-claude-code-continue-from-the-main-checkout-refuses-a-ticket-another-live-session-holds-and-prints-no-enter

Consumes: `worktreeOpen`, `hold`, `prepare`, `setupMarker`, `printStop`, `withHolds`, `claudeEnv`, `sessionIn`,
`processTable`, `sameSession`, `isLive` and `describeSession`, all as they are at the baseline.
Produces: `takeHold`, `isLinked`, `canEnter`, `checkPin` and `enterOrStop`, all exported. Tasks 2, 3, 6 and 8
use them.

Tests first, in `packages/cli/test/worktree.test.ts`, appended at the end:
- `it('ac-1 in claude code pick up from the main checkout takes the hold and prints enter instead of stop')`: `c =
  clone({ setup: ['node setup-step.js ci'] })`, `setTable(tableOf(A))`, then `run(['worktree', 'open', 'ST-9'],
  c.root, envOf(A))`. It exits 0. `lines(out)` equals `[`enter: ${c.sibling('ST-9')}`]` and `out` holds no
  `stop:`. `git log -1 --format=%s t/ST-9` is `claim: ST-9`, and `t/ST-9^` equals `origin/main`. The sibling's
  `setup.log` is `ci\n`. `readHolds(c)['ST-9']` matches `{ tool: 'Claude Code', marker: 'sess-A', pid: 7001,
  start: 'S-A' }`. `c.root` is still on `main`. Run `run(['anchor'], c.sibling('ST-9'))` (the session's folder
  after the move): its `out` starts `# Anchor: ST-9` and equals `run(['anchor', 'ST-9'], c.root).out`. Last,
  `run(['worktree', 'open', 'ST-9', '--continue'], c.sibling('ST-9'), envOf(A))` gives `out === HELD`: the moved
  session finds its own hold.
- `it('ac-2 in claude code continue from the main checkout enters a claimed worktree whose session ended with or without a worktree here')`:
  (a) `c = clone({ tickets: ['ST-9', 'ST-10'] })`. Run `run(['worktree', 'open', 'ST-9'], c.root)` with no env,
  so the worktree exists. Then `writeHolds(c, { 'ST-9': DEAD })` (the session that worked it has ended) and
  `setTable(tableOf(A))`. `worktree open ST-9 --continue` from `c.root` with `envOf(A)` exits 0. `lines(out)` is
  `[`enter: ${c.sibling('ST-9')}`]`, `readHolds(c)['ST-9'].marker` is `sess-A`, and the anchor check of ac-1 holds
  for `ST-9`.
  (b) In `o = c.otherClone()`, set `git config user.email y@example.invalid`, then `switch -c t/ST-10 main`,
  `commit --allow-empty -m "claim: ST-10"`, and `push origin t/ST-10`. In `c`, run `git fetch -q origin`, so this
  machine has no worktree and no local branch for ST-10. Then `setTable(tableOf(C))`: a second session, because a
  session works one ticket (Task 3). `worktree open ST-10 --continue` from `c.root` with `envOf(C)` exits 0, and
  `lines(out)` is `[`enter: ${c.sibling('ST-10')}`]`. The sibling's HEAD equals `origin/t/ST-10`, and
  `readHolds(c)['ST-10'].marker` is `sess-C`.
- `it('risk:complex-branching in claude code a worktree pinned to another accord version refuses before setup and prints no enter')`:
  The test passes `120_000` as the third argument of `it`. (Plan-review 2.3 renamed it from `...refuses before the
  hold...`: a Pick up now holds its ticket before the pin check, so that title would be false for case (b).)
  (a) The ticket branch is behind. `c = clone()`, then
  `c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main')`. In the
  sibling, replace `accord: "0.1.0"` in `accord/config.yml` with `accord: "0.0.9"` and commit it. With
  `setTable(tableOf(A))`, `worktree open ST-9 --continue` from `c.root` with `envOf(A)` exits 2. `err` contains
  `pins accord 0.0.9` and `merge origin/main into t/ST-9`, `out` holds no `enter:`, and the holds file
  does not exist. The same command with no env exits 0 and prints the three stop lines, as today.
  (b) The main checkout is behind. `d = clone({ setup: ['node setup-step.js ci'] })`. In `o = d.otherClone()`, set
  `git config user.email y@example.invalid`, replace `accord: "0.1.0"` with `accord: "0.0.9"` in
  `accord/config.yml`, commit it and `push origin main`. In `d`, run `git fetch -q origin` only, so `d.root` still
  pins `0.1.0`. With `setTable(tableOf(A))`, `worktree open ST-9` (Pick up) from `d.root` with `envOf(A)` exits 2.
  `err` contains `pins accord 0.0.9` and `update the main checkout`, and does not contain `merge`. `out` holds no
  `enter:`, and `${d.sibling('ST-9')}/setup.log` does not exist: setup did not run. Pick up made the claim, so the
  session holds it: `(readHolds(d)['ST-9'] as { marker: string }).marker` is `sess-A`.
- `it('risk:concurrency in claude code continue from the main checkout refuses a ticket another live session holds and prints no enter')`:
  `c = clone()`. Run `worktree open ST-9` from `c.root` with no env. Then `writeHolds(c, { 'ST-9': LIVE })` and
  `setTable(tableOf(A, { pid: 4242, start: 'S2' }))`. `worktree open ST-9 --continue` from `c.root` with
  `envOf(A)` exits 2. `err` contains `sess-H`, `out` holds no `enter:`, and the holds file bytes are unchanged
  (ST-LN-7 D-03 stays).

Interface, `packages/cli/src/commands/worktree.ts`:
- `export function isLinked(root: string): boolean`: `norm(git(root, ['rev-parse', '--path-format=absolute',
  '--git-dir']).trim()) !== norm(git(root, ['rev-parse', '--path-format=absolute', '--git-common-dir']).trim())`.
- `export function takeHold(ctx: CommandContext, id: string): void` is the hold-taking half of `hold()`: lines
  165-180 moved unchanged, with `claudeEnv`, `sessionIn(..., processTable(), process.pid)` and the `withHolds`
  update. When a live other session holds `id`, it throws the same `is held by another session` UsageError. It
  needs a Claude Code session; callers check that first. `hold()` keeps its output and its order: no-hold branch,
  then `takeHold`, then `prepare` when the setup marker is missing, then `held:`.
- `export function canEnter(ctx: CommandContext): boolean`: `let c; try { c = claudeEnv(ctx.env); } catch { return
  false; } return c !== undefined && !isLinked(ctx.root);`. A Claude Code session whose variables are missing gets
  today's stop lines, never a refusal.
- `export function checkPin(ctx: CommandContext, id: string, path: string, branch: string, mainPath: string): void`
  (ledger Ruling on the pin). Read `<path>/accord/config.yml` if it exists and parse it with `loadConfig`. A missing
  file passes; an invalid one passes and is left to `prepare`. When `config.accord` (`pinned`) is defined and
  differs from `pkg.version`, it throws. To name the fix, take `ref = gitDefaultRef(ctx.root)` and `def` = `ref`
  without `refs/remotes/` (for example `origin/main`). When `ref` is defined and
  `gitOk(ctx.root, ['cat-file', '-e', `${ref}:accord/config.yml`])`, parse
  `git(ctx.root, ['show', `${ref}:accord/config.yml`])` with `loadConfig` and take its `accord` as `defPin`.
  - When `defPin === pinned`, the worktree already matches the default branch and the main checkout is the one
    behind: throw `UsageError(`${path}/accord/config.yml pins accord ${pinned} as ${def} does, but the main checkout ${mainPath} runs ${pkg.version} - update the main checkout to ${def} (git pull there), then type /accord continue ${id}; this session did not move`)`.
  - Otherwise the ticket branch is the one behind: throw
    `UsageError(`${path}/accord/config.yml pins accord ${pinned}, running ${pkg.version} - merge ${def} into ${branch}, then type /accord continue ${id}; this session did not move`)`,
    with `def` read as `the default branch` when `ref` is undefined.
  Applying the second fix and retrying reaches the first case when the default branch is also ahead, so the two
  messages lead to a match in at most two retries. `pkg` is imported as in `commands/hook.ts:4`, with the path
  `../../package.json`.
- `export function enterOrStop(ctx: CommandContext, id: string, path: string, branch: string, enter: boolean): void`.
  When `enter` is false, it calls `printStop(ctx, path, id)`. When `enter` is true, in this order:
  1. `takeHold(ctx, id)`.
  2. `prepare(path)` when `setupMarker(path)` does not exist.
  3. Write `enter: <path>\n`.
  Its callers run `checkPin` first, as below.
- `worktreeOpen`: after the id check and before `worktrees(...)`, compute `const enter = canEnter(ctx)` and
  `const pick = opts.continue !== true`. When `enter` is true, each path runs, in this order:
  - The claim path (Pick up, no branch yet): `git worktree add`, the claim commit, then `takeHold(ctx, id)`, then
    `checkPin(ctx, id, path, branch, mainPath)`, then `prepare(path)`.
  - The local or remote branch path: `git worktree add`, then `takeHold(ctx, id)` only when `pick`, then
    `checkPin`, then `prepare`.
  - The worktree found elsewhere: `checkPin` just before `enterOrStop`.
  So a Pick up holds its ticket, as `hold()` does at `worktree.ts:171-181` before its `prepare`, before a pin
  refusal or a setup failure can stop it, and the same session is then refused any other ticket (Task 3's
  `risk:complex-branching in claude code a pick up whose setup failed...` test). A Continue refused by the pin
  check holds nothing, as test (a) shows. A refusal costs no setup run and keeps the worktree, as a setup failure
  does. `enterOrStop`'s own `takeHold` then finds this session's hold and keeps its `taken`. When `enter` is false,
  nothing here changes. Each `printStop(ctx, X, id); return 0;` becomes
  `enterOrStop(ctx, id, X, branch, enter); return 0;`. On the worktree found elsewhere no setup runs unless its
  marker is missing and `enter` is true (D-15). The case `norm(held.path) === norm(ctx.root)` still calls
  `hold()`.

D-08: `enter:` names the sibling folder `siblingOf` already gives. No path under `.claude/worktrees/` is ever
built.

Must not change: every existing case in `worktree.test.ts`. They all run with no env or from inside a worktree, and
they still get the stop lines, `held:` or `not held:` byte for byte. Also unchanged: `checkClaimant`, the
`claimed:`, `not claimed:` and `not a ticket:` refusals, and `worktree clean`.

## Task 2: In Claude Code, a new lane M ticket from the main checkout is committed, pushed and held, and prints enter
covers: @ac-3
files: packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-3-in-claude-code-a-new-lane-m-ticket-is-committed-pushed-and-held-and-prints-enter-instead-of-stop (@ac-3)

Consumes: `canEnter`, `takeHold`, `checkPin` and `enterOrStop` from Task 1, and `newTicketWorktree`.

Test first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-3 in claude code a new lane m ticket is committed pushed and held and prints enter instead of stop')`:
  `c = clone({ setup: ['node setup-step.js ci'], tickets: [] })`, then `setTable(tableOf(A))`.
  `run(['new', 'ticket', 'ST-9', '--lane', 'M', '--worktree'], c.root, envOf(A))` exits 0. `lines(out)` is
  `['accord/tickets/ST-9.md', `enter: ${c.sibling('ST-9')}`]` and `out` holds no `stop:`. The remote's
  `refs/heads/t/ST-9` equals the sibling's HEAD, whose subject is `claim: ST-9`. The sibling's `setup.log` is
  `ci\n`. `readHolds(c)['ST-9'].marker` is `sess-A`. `<c.root>/accord/tickets/ST-9.md` does not exist. In the
  sibling, `run(['anchor'], c.sibling('ST-9'))` exits 0, its `out` starts `# Anchor: ST-9` and contains
  `Stage: intent` (the intent interview is the stage it starts).

Interface: `newTicketWorktree` computes `const enter = canEnter(ctx)` as its first statement. Right after the
`claim: <id>` commit and before the push, `if (enter) takeHold(ctx, id);`, so a failed push, a pin refusal or a
setup failure leaves this session holding the new ticket (plan-review 2.3; Task 3's
`risk:complex-branching in claude code a pick up whose setup failed...` test proves it). Right after the push
succeeds and before `prepare(path)`, `if (enter) checkPin(ctx, id, path, branch, list[0].path);`. Its last two
lines become `ctx.stdout.write(rel + '\n'); enterOrStop(ctx, id, path, branch, enter);`. Everything else stays as
it is: the branch refusals, the commit, the push and its failure message (which prints no `stop:` and no
`enter:`), and `prepare`. When `enter` is false, nothing is held, as today.

Must not change: the ST-LN-7 `ac-6` and `risk:data-loss a failed push...` cases (no env), and `new ticket` without
`--worktree`.

## Task 3: A Claude Code session that works a ticket is refused other tickets, new tickets, and the worktree check
covers: @ac-4, @ac-5, D-01, D-02, D-04, D-09
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/new-ticket.ts, packages/cli/src/run.ts, packages/cli/test/worktree.test.ts, packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree.test.ts#ac-4-in-claude-code-a-session-that-works-a-ticket-refuses-other-tickets-and-new-tickets-and-changes-nothing (@ac-4), packages/cli/test/worktree.test.ts#ac-5-outside-claude-code-pick-up-continue-and-new-ticket-print-the-stop-lines-and-nothing-is-refused (@ac-5), packages/cli/test/worktree.test.ts#risk:complex-branching-a-linked-worktree-on-a-detached-head-refuses-all-but-continue-of-its-own-ticket, packages/cli/test/worktree.test.ts#risk:complex-branching-a-claude-code-session-that-sets-no-session-variables-keeps-the-main-checkout-flows-and-only-the-folder-rule-refuses-it, packages/cli/test/worktree.test.ts#risk:complex-branching-in-claude-code-a-pick-up-whose-setup-failed-and-a-new-ticket-whose-push-failed-still-hold-their-ticket-and-refuse-a-second-one

Consumes: everything from Task 1. Also `ticketOfBranch` and `currentBranch` from `load/fs.ts` and `repoRoot` from
`../root.js`. Produces: `inClaude`, `worksTicket`, `worksMessage`, `readHoldsFile`, `listWorktrees` (exported),
`guardTicketSession` and `worktreeCheck`. Tasks 4 and 8 use them.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('ac-4 in claude code a session that works a ticket refuses other tickets and new tickets and changes nothing')`:
  The test passes `180_000` as the third argument of `it`, as `lane-flow.test.ts:96` does: it makes about twenty
  CLI runs, more than the 30 s default (`packages/cli/vitest.config.ts:5`) allows on windows-latest.
  Setup:
  - `c = clone({ tickets: ['ST-9', 'ST-10'] })` and `sib = c.sibling('ST-9')`. With `setTable(tableOf(A))`, run
    `worktree open ST-9` from `c.root` with `envOf(A)` (Task 1: enter, A holds ST-9).
  - To make ST-9 merged: `gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9')`, `mergeOnRemote(c, 'ST-9')`,
    `c.git('fetch', '-q', 'origin')`.
  - Create `${sib}/sub`, an empty folder, which `git status` does not show.

  Record `state()`: a list of `git worktree list --porcelain`, `for-each-ref --format=%(refname) %(objectname)`,
  `log --all --format=%H %s`, `status --porcelain --untracked-files=all` in `c.root` and in `sib`, the holds file
  bytes, and the sorted `readdirSync` of `accord/tickets` in `c.root` and in `sib`. Take `before = state()` once,
  after the setup. A refusal that wrote anything would leave it written, so comparing after each group of runs
  proves every run in the group wrote nothing.

  Checks:
  - For each folder in `[sib, `${sib}/sub`, c.root]` (the moved session, a folder inside it, and the same session
    resumed in the main checkout), run each argv with `envOf(A)`: `['worktree', 'open', 'ST-10']`,
    `['worktree', 'open', 'ST-10', '--continue']`, `['worktree', 'open', 'ST-9']`,
    `['new', 'ticket', 'ST-11', '--lane', 'M', '--worktree']`, `['new', 'ticket', 'ST-11', '--lane', 'M']`,
    `['worktree', 'check']`. Each exits 2. Its `err` contains `this session works ST-9`,
    `open a new session in the main checkout` and `without "/accord"`. After the six runs of each folder,
    `state()` equals `before`, and `c.sibling('ST-10')` and `c.sibling('ST-11')` do not exist.
  - D-04: session B was started in the worktree and has no hold. With `setTable(tableOf(B, A))` and `envOf(B)`,
    `worktree open ST-10` and `new ticket ST-11 --lane M` from `${sib}/sub` each exit 2 naming `ST-9`. After both,
    `state()` equals `before`.
  - Last, outside the state checks: `worktree open ST-9 --continue` from `sib` with `envOf(A)` exits 0 with
    `out === HELD`, and from `c.root` with `envOf(A)` it exits 0 with `lines(out)` equal to `[`enter: ${sib}`]`.
- `it('ac-5 outside claude code pick up continue and new ticket print the stop lines and nothing is refused')`: `c =
  clone({ tickets: ['ST-9', 'ST-10'] })`, then `vi.mocked(proc.processTable).mockClear()`. Every run below has env
  `{}`.
  - From `c.root`: `worktree open ST-9` exits 0 with `out.split('\n').slice(0, 3)` equal to
    `stopLines(c.sibling('ST-9'), 'ST-9')`. `new ticket ST-11 --lane M --worktree` exits 0 with the first four
    lines `['accord/tickets/ST-11.md', ...stopLines(c.sibling('ST-11'), 'ST-11')]`.
  - From `c.sibling('ST-9')`: `worktree open ST-10` exits 0 with the stop lines for `c.sibling('ST-10')`.
    `worktree open ST-9 --continue` exits 0 with the `not held:` line. `worktree check` exits 0 with empty `out`
    and `err`. `new ticket ST-12 --lane M --worktree` exits 0 and its output ends with the stop lines for
    `c.sibling('ST-12')`.
  - No output holds `enter:` or `this session works`. The holds file does not exist, and `processTable` was not
    called.
- `it('risk:complex-branching a linked worktree on a detached head refuses all but continue of its own ticket')`:
  `c = clone({ tickets: ['ST-9', 'ST-10'] })`, then
  `c.git('worktree', 'add', '-q', '--detach', c.sibling('ST-10'), 'origin/main')`. From that folder with `envOf(A)`
  and `setTable(tableOf(A))`:
  - `worktree open ST-9 --continue` and `worktree check` each exit 2 with `err` containing
    `whose branch cannot be read` and `open a new session in the main checkout`.
  - `worktree open ST-10 --continue` is not refused by this rule: its `err` does not contain
    `this session works`.
- `it('risk:complex-branching a claude code session that sets no session variables keeps the main checkout flows and only the folder rule refuses it')`:
  `c = clone({ tickets: ['ST-9', 'ST-10'] })`, `E = { CLAUDECODE: '1' }`, then
  `vi.mocked(proc.processTable).mockClear()`. From `c.root` with env `E`:
  - `worktree check` exits 0 with empty `out` and `err`.
  - `worktree open ST-9` exits 0 and `out.split('\n').slice(0, 3)` equals `stopLines(c.sibling('ST-9'), 'ST-9')`.
  - `new ticket ST-11 --lane M` exits 0 and `${c.root}/accord/tickets/ST-11.md` exists.
  - `new ticket ST-12 --lane M --worktree` exits 0 and its output ends with the stop lines for `c.sibling('ST-12')`.
  - No output holds `enter:`. The holds file does not exist, and `processTable` was not called.
  From `c.sibling('ST-9')` with env `E`, `worktree open ST-10` exits 2 with `err` containing
  `this session works ST-9` (D-04, the folder rule).
- `it('risk:complex-branching in claude code a pick up whose setup failed and a new ticket whose push failed still hold their ticket and refuse a second one')`,
  with `120_000` as the third argument of `it`. It proves Task 1's and Task 2's hold-before-setup order
  (plan-review 2.3, the Veto).
  (a) Pick up, setup fails: `c = clone({ setup: ['node setup-step.js fail'], tickets: ['ST-9', 'ST-10'] })` and
  `setTable(tableOf(A))`. `worktree open ST-9` from `c.root` with `envOf(A)` exits 2, `err` contains
  `setup command failed` and `out` holds no `enter:`. `git log -1 --format=%s t/ST-9` is `claim: ST-9` and
  `(readHolds(c)['ST-9'] as { marker: string }).marker` is `sess-A`. Then `worktree open ST-10` and
  `new ticket ST-11 --lane M --worktree` from `c.root` with `envOf(A)` each exit 2 with `err` containing
  `this session works ST-9`. After both, `c.sibling('ST-10')` and `c.sibling('ST-11')` do not exist and
  `c.git('branch', '--list', 't/ST-10', 't/ST-11')` is empty. Last, `worktree open ST-9 --continue` from `c.root`
  with `envOf(A)` is not refused by this rule: it exits 2 with `setup command failed` (the retry runs setup again)
  and its `err` does not contain `this session works`.
  (b) New ticket, push fails: `d = clone({ tickets: ['ST-10'] })`, then
  `d.git('remote', 'set-url', '--push', 'origin', `${d.remote}-missing`)` (as the ST-LN-7 failed-push case does) and
  `setTable(tableOf(C))`. `new ticket ST-11 --lane M --worktree` from `d.root` with `envOf(C)` exits 2, `err`
  contains `the push failed` and `out` holds no `enter:`. `(readHolds(d)['ST-11'] as { marker: string }).marker` is
  `sess-C`. Then `worktree open ST-10` from `d.root` with `envOf(C)` exits 2 with `err` containing
  `this session works ST-11`, and `d.sibling('ST-10')` does not exist.

Interface, `packages/cli/src/commands/worktree.ts`:
- `export function inClaude(env: NodeJS.ProcessEnv): { marker: string | undefined } | undefined`: `try { const c =
  claudeEnv(env); return c === undefined ? undefined : { marker: c.marker }; } catch { return { marker:
  env.CLAUDE_CODE_SESSION_ID || undefined }; }`. It never throws.
- Export `listWorktrees` unchanged. It never prunes, so it never writes.
- `export function readHoldsFile(root: string): Record<string, Hold>` reads the holds file in the common git dir
  without the lock, so the works rule writes nothing. An absent file gives `{}`. A file that is not a JSON object
  throws the same UsageError as `withHolds`. The read is safe because writes are a rename.
- `export type Works = { id: string | undefined; top: string }`.
- `export function worksTicket(cwd: string, marker: string | undefined, snapshot: RepoSnapshot): Works | undefined`:
  1. `top = repoRoot(cwd)`.
  2. When `isLinked(top)`, take `b = currentBranch(top)`. When `b` is `undefined` or `''`, return
     `{ id: undefined, top }`. When `ticketOfBranch(b, snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (i) =>
     Object.hasOwn(snapshot.tickets, i))` gives an id, return `{ id, top }`.
  3. Otherwise, when `marker` is defined, find the first key of `readHoldsFile(top)`, in code-point order, whose
     entry's `marker === marker`. If there is one, return `{ id: key, top }`. (Task 8 adds the worked record here.)
  4. Otherwise return `undefined`.
- `export function worksMessage(w: Works, mainPath: string): string` returns the two messages of the preamble.
- `export function guardTicketSession(ctx: CommandContext, cont?: string): void`: it returns when
  `s = inClaude(ctx.env)` is undefined (D-01). Otherwise it computes `w = worksTicket(ctx.root, s.marker,
  ctx.snapshot)` and returns when `w` is undefined. It also returns when `cont !== undefined` and either
  `w.id === cont`, or `w.id` is undefined and `norm(siblingOf(mainPath, cont)) === norm(w.top)`. Otherwise it
  throws `UsageError(worksMessage(w, mainPath))`. `mainPath` is `listWorktrees(ctx.root)[0].path`.
  (Ruling: a detached worktree is that id's own worktree when its folder is that id's sibling path.)
- `worktreeOpen`: right after the id check and before `enter`, call
  `guardTicketSession(ctx, opts.continue === true ? id : undefined)`. This runs before `worktrees()`, which can
  prune.
- `export function worktreeCheck(ctx: CommandContext): number`: `guardTicketSession(ctx); return 0;`. It prints
  nothing when it passes.
- `new-ticket.ts`: the first statement of `newTicket` is `guardTicketSession(ctx)`. It runs with or without
  `--worktree` (D-09) and before id assignment.
- `run.ts`: `worktree.command('check').description('exit 2 naming the ticket this Claude Code session works, before any other work starts').action(() => { setCode(worktreeCheck(preflight(opts))); });`,
  registered between `clean` and `open`.
- `skill-commands.test.ts`: the expected `REAL` list gains `'worktree check'` before `'worktree clean'`.

Must not change: the ST-LN-7 hold cases. The existing `ac-4 a live holder...` case (B continues its own ticket
from inside it) and the case with env `{ CLAUDECODE: '1' }` still exit 2 with `CLAUDE_CODE_SESSION_ID`.
`new ticket` outside Claude Code keeps every message and its order.

## Task 4: The prompt-expansion hook blocks every typed /accord text but the dashboard and continue of the worked ticket
covers: D-05, D-06, D-07
files: packages/cli/src/index.ts, packages/cli/src/run.ts, packages/cli/src/commands/hook.ts, packages/cli/test/helpers/repo.ts, packages/cli/test/hook.test.ts, packages/cli/test/bin.test.ts
verify: packages/cli/test/hook.test.ts#risk:security-the-prompt-expansion-hook-blocks-every-accord-text-but-the-dashboard-and-continue-of-the-worked-ticket, packages/cli/test/hook.test.ts#risk:complex-branching-the-prompt-expansion-hook-allows-with-one-stderr-line-when-its-input-holds-or-git-cannot-be-read, packages/cli/test/bin.test.ts#risk:parsing-the-built-cli-hands-hook-input-on-stdin-to-the-prompt-expansion-hook

Consumes: from Task 3, `worksTicket`, `worksMessage`, `listWorktrees` and `siblingOf`. Produces: `RunOptions.stdin`,
`CommandContext.stdin`, `hookInput(ctx)` (exported from `hook.ts`; Task 6 uses it) and the event
`prompt-expansion`.

The Approach probe established that Claude Code sends this hook `session_id`, `command_name`, `command_args` and
`cwd` on stdin, that `command_name` is `accord` for a typed `/accord …`, and that stdout
`{"decision":"block",...}` blocks the prompt. The hook works in any session, so no `claudeEnv` check is made. Its
marker is stdin `session_id` (ledger Ruling).

Tests first:
- `packages/cli/test/helpers/repo.ts`: `run(argv, cwd, env = {}, stdin?: string)` passes `stdin` into `runCli`'s
  options. Every existing caller is unchanged.
- In `packages/cli/test/hook.test.ts`, top-level, using `makeClone` and `cleanupAll` from `./helpers/worktree.js`
  and `gitRun`/`writeFiles`. `input(o)` is `JSON.stringify({ session_id: 'sess-S', command_name: 'accord', ...o })`
  and `hook(o)` is `run(['hook', 'prompt-expansion'], c.root, {}, input(o))`.
  - `it('risk:security the prompt expansion hook blocks every accord text but the dashboard and continue of the worked ticket')`:
    - Setup: `c = makeClone({ tickets: ['ST-9', 'ST-10'] })`, then
      `c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main')` and an empty
      `${c.sibling('ST-9')}/sub` folder.
    - From `cwd: c.sibling('ST-9')`, the args `''`, `'  '` and `'continue ST-9'` each give exit 0 and
      `JSON.parse(out)` equal to `{}`.
    - From the same cwd, each of these args is blocked: `'continue ST-10'`, `'pick-up ST-10'`, `'pick-up ST-9'`,
      `'fix the typo in README'` (a lane S request, D-05), `'continue the refactor'`, `'explain ST-9'` (a request
      about the worked ticket, D-06). A blocked call exits 0. `JSON.parse(out)` has `decision: 'block'` and a
      `reason` containing `this session works ST-9`, `open a new session in the main checkout` and
      `without "/accord"`.
    - With `cwd: `${c.sibling('ST-9')}/sub``, `'pick-up ST-10'` is blocked the same way.
    - Holds: write `${c.root}/.git/accord/holds` as `{ "ST-9": { tool: 'Claude Code', marker: 'sess-S', pid: 1,
      start: 'x', taken: 't' } }`. With `cwd: c.root`, `'pick-up ST-10'` is blocked. With `session_id: 'other'`
      and `cwd: c.root` it is allowed (`{}`).
    - Every `out` is one line of JSON and nothing else.
  - `it('risk:complex-branching the prompt expansion hook allows with one stderr line when its input holds or git cannot be read')`:
    each of these exits 0 with `JSON.parse(out)` equal to `{}` and `err` exactly one non-empty line:
    - stdin `not json`;
    - stdin with no `session_id`;
    - the holds file written as `[]`, with `cwd: c.root` and `'pick-up ST-10'`;
    - `cwd` a fresh `mkdtemp` folder that is not a git repository, passed with every `/` turned into `\` as Claude
      Code sends it on Windows; `err` contains no `\`;
    - a clone whose `accord/config.yml` pins `0.0.9`, so preflight's pin check throws.
    With `command_name: 'accord-x'` the result is `{}` and `err` is empty.
- In `packages/cli/test/bin.test.ts`, top-level:
  `it('risk:parsing the built cli hands hook input on stdin to the prompt expansion hook')`. `c = makeClone()`, with
  a worktree `t/ST-9` added at the sibling as above. Run `execFileSync(process.execPath, [cli, 'hook',
  'prompt-expansion'], { cwd: c.root, encoding: 'utf8', input: JSON.stringify({ session_id: 's', command_name:
  'accord', command_args: 'pick-up ST-10', cwd: c.sibling('ST-9') }) })`. It parses to `decision: 'block'`.
  `cleanupAll` runs in a `finally`.

Interface:
- `run.ts`: `RunOptions` gains `stdin?: string` and `CommandContext` gains `stdin?: string`; `preflight` copies it.
  `HOOK_EVENTS` gains `'prompt-expansion'`. In the `hook <event>` action, `prompt-expansion` builds its context
  with `preflight(opts, 'stage')` inside a `try`. When that throws, it writes one stderr line
  `accord hook prompt-expansion: <first line of the message>; allowed`, writes `{}\n` to stdout and sets code 0.
  This line is written directly, not through runCli's catch, so it applies the same rule as `slashed`
  (`run.ts:277`) itself: every `\` in the line becomes `/` (D-51). A stdin `cwd` from Windows carries `\`, and
  `repoRoot`'s message echoes it.
  The hook never exits non-zero, so a broken repository never blocks every `/accord` (ledger Ruling). Every other
  event keeps its path.
- `index.ts`: when `process.argv[2] === 'hook'` and `process.stdin.isTTY !== true`, read stdin to the end as UTF-8
  (`process.stdin.setEncoding('utf8')`, then `for await` concatenating the chunks) and pass it as `stdin`. No other
  command reads stdin.
- `hook.ts`:
  - `export function hookInput(ctx: CommandContext): { session_id?: string; command_name?: string; command_args?: string; cwd?: string } | undefined`
    parses `ctx.stdin` as JSON. It returns undefined on a parse failure or a non-object, and keeps only the string
    fields.
  - `promptExpansion(ctx): number`, wrapped whole in a `try`. Any throw writes one stderr line as above, with every
    `\` turned into `/`, writes `{}` and returns 0. In order:
    1. When the input is undefined or has no `session_id`: stderr line, `{}`.
    2. When `command_name !== 'accord'`: `{}`, nothing on stderr.
    3. `args = (command_args ?? '').trim()`. When it is empty: `{}`.
    4. `w = worksTicket(cwd ?? ctx.root, session_id, ctx.snapshot)`. When it is undefined: `{}`.
    5. When `args` matches `/^continue\s+(\S+)$/` and the id is allowed by the same rule as
       `guardTicketSession`'s `cont` (equal to `w.id`, or the sibling rule when `w.id` is undefined): `{}`.
    6. Otherwise write `JSON.stringify({ decision: 'block', reason: worksMessage(w, listWorktrees(w.top)[0].path) }) + '\n'`.
    stdout carries only that JSON.

Must not change: the `session-start`, `session-resume` and `subagent-start` outputs and every case in
`hook.test.ts` and `bin.test.ts`. Also unchanged: commands other than `hook`, which never read stdin, so `--help`
and `--version` never wait.

## Task 5: skills sync writes the UserPromptExpansion hook and a re-sync replaces an older one
covers: D-07
files: packages/core/src/scaffold/hooks.ts, packages/core/test/hooks.test.ts, packages/cli/test/skills-sync.test.ts, .claude/settings.json
verify: packages/core/test/hooks.test.ts#risk:data-loss-a-re-sync-replaces-an-older-prompt-expansion-hook-and-keeps-a-foreign-one

Consumes: the `prompt-expansion` event from Task 4. Produces: the hook in every Claude Code repository's
`.claude/settings.json` after `accord skills sync`.

Test first, in `packages/core/test/hooks.test.ts`, top-level:
- `it('risk:data-loss a re-sync replaces an older prompt expansion hook and keeps a foreign one')`.
  `hookEntries({ name: '@accord-dev/accord', version: '0.2.0' }).UserPromptExpansion` equals
  `[{ matcher: 'accord', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.2.0 hook prompt-expansion' }] }]`.
  `mergeHooks` takes `{ hooks: { UserPromptExpansion: [{ matcher: 'accord', hooks: [{ type: 'command', command:
  'npx --yes @accord-dev/accord@0.0.9 hook prompt-expansion' }, { type: 'command', command: 'echo hi' }] }] } }` and
  returns a `UserPromptExpansion` of the foreign `echo hi` entry under matcher `accord`, then the new entry. A
  second merge gives the same object.

Interface, `packages/core/src/scaffold/hooks.ts`:
- `HookEntries`'s key union gains `'UserPromptExpansion'`.
- `hookEntries` adds `UserPromptExpansion: [{ matcher: 'accord', hooks: [{ type: 'command', command: cmd(pkg, 'prompt-expansion') }] }]`
  after `SubagentStart`.
- `isAccordHookCommand`'s alternation gains `prompt-expansion`.

`packages/cli/test/skills-sync.test.ts`:
- In `creates the file with three accord commands; a second run is unchanged and writes nothing` and
  `keeps a foreign hook`, `toHaveLength(3)` becomes `toHaveLength(4)`. Both titles stay as they are, because
  `accord/tests-baseline.txt` lists those ids (ledger Ruling).
- In `risk:regression the committed panel and settings carry the plugin`, the list of hooks gains
  `prompt-expansion`.

Regenerate `.claude/settings.json` from the repository root: `npm run build -w packages/core`, `npm run build`,
then `node packages/cli/dist/cli.js skills sync`. It must write only the new `UserPromptExpansion` entry into
`.claude/settings.json`. If it also reports a changed skill copy, keep that copy as written.

An older build and the new hook entry: the entry runs `npx --yes @accord-dev/accord@0.1.0 hook prompt-expansion`,
and inside this workspace npx resolves the local build (`docs/plans/2026-10-12-phase-2-skills.md:849`). A checkout
whose `packages/cli/dist` predates Task 4 answers with `unknown hook event prompt-expansion` and exit 2
(`run.ts:261-263`). Whether Claude Code then blocks the typed `/accord` is not settled by anything in the
repository. The command cannot be written to fail open: `commands carry no shell syntax` forbids `||`, and
`isAccordHookCommand` would no longer recognise it. So the build always comes first:
- In this ticket's worktree, the order above builds `packages/cli/dist` before `skills sync` writes the entry, so
  the entry never names a build that lacks the event.
- After this ticket merges, the main checkout runs `npm run build` before its next typed `/accord`. The PR
  description of this ticket's branch says so in one line: "After merging, run `npm run build` in each checkout
  before typing `/accord`: the new UserPromptExpansion hook needs this build."
- In any other repository the entry is written only by `skills sync` of a release that holds this ticket, so the
  version it pins always knows the event.

Must not change: the other `mergeHooks` cases, including `commands carry no shell syntax` (the new command fits it),
and every key of `.claude/settings.json` other than `hooks.UserPromptExpansion`.

## Task 6: The session hooks hold or point to the ticket's worktree, and clean keeps the worktree this session holds
covers: D-04
files: packages/cli/src/commands/hook.ts, packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:data-loss-clean-keeps-a-merged-worktree-this-session-holds-when-run-from-the-main-checkout, packages/cli/test/worktree.test.ts#risk:concurrency-the-session-start-hook-takes-a-free-hold-in-a-ticket-worktree-and-never-a-live-one, packages/cli/test/worktree.test.ts#risk:complex-branching-the-resume-hook-in-the-main-checkout-prints-the-anchor-and-the-enter-line-of-the-held-worktree

Consumes: `takeHold`, `isLinked`, `readHoldsFile` and `listWorktrees` (Tasks 1 and 3), `hookInput` and the stdin
`run` helper (Task 4), and `branchOf`.

Tests first, in `packages/cli/test/worktree.test.ts`:
- `it('risk:data-loss clean keeps a merged worktree this session holds when run from the main checkout')`:
  `c = clone()`, `ticketWorktree(c, 'ST-9')`, `mergeOnRemote(c, 'ST-9')`, and
  `writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: '2026-10-18T00:00:00.000Z' } })`. Then
  `setTable(tableOf(A))` and `vi.mocked(proc.processTable).mockClear()`. `worktree clean` from `c.root` with
  `envOf(A)` exits 0. `lines(out)` contains `kept ${c.sibling('ST-9')}: this session's worktree` and
  `kept t/ST-9: checked out in ${c.sibling('ST-9')}`. The sibling still exists, the holds entry is kept, and
  `processTable` was not called.
- `it('risk:concurrency the session start hook takes a free hold in a ticket worktree and never a live one')`:
  - Setup: `c = clone()` and `c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main')`.
    `start(s, cwd)` is `run(['hook', 'session-start'], cwd, envOf(s), JSON.stringify({ session_id: s.marker, cwd,
    source: 'startup' }))`.
  - With `setTable(tableOf(A))`, `start(A, sibling)` exits 0, `out` starts `# accord rules\n`, and
    `readHolds(c)['ST-9'].marker` is `sess-A`.
  - With `setTable(tableOf(B, A))`, `start(B, sibling)` exits 0 with the same `out` shape. `err` is one line
    containing `sess-A`, and the holds bytes are unchanged.
  - With `setTable(tableOf(B))` and `start(B, c.root)` (the main checkout), the holds bytes are unchanged.
  - With env `{}` from the sibling, the holds bytes are unchanged.
  - With env `{ CLAUDECODE: '1' }` (no session id, no pid) from the sibling, the hook exits 0, `out` starts
    `# accord rules\n`, `err` is one line containing `no hold taken on ST-9`, and the holds bytes are unchanged.
- `it('risk:complex-branching the resume hook in the main checkout prints the anchor and the enter line of the held worktree')`:
  - Setup: `c = clone()`, `setTable(tableOf(A))`, and `worktree open ST-9` from `c.root` with `envOf(A)`.
    `resume(s, cwd)` is `run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker,
    cwd, source: 'resume' }))`.
  - `resume(A, c.root)`: `out` contains `# Anchor: ST-9`. Its last non-empty line is
    `enter: ${c.sibling('ST-9')}`, and the line before it contains `EnterWorktree`.
  - `resume(B, c.root)`: `out` contains no `enter:` and ends with the session line
    (`/accord: \d+ in progress, \d+ ready to pick up · type \/accord\n$/`).
  - `resume(A, c.sibling('ST-9'))`: `out` contains `# Anchor: ST-9` and no `enter:`.

Interface:
- `hook.ts`, `session-start`: after building today's output, all of the following runs inside one `try`, so no
  throw can reach runCli and lose the ruleset. Read `input = hookInput(ctx)` and compute
  `root = input?.cwd !== undefined ? repoRoot(input.cwd) : ctx.root`. When `isLinked(root)` is true and the branch
  of `root` names a ticket `id` through `ticketOfBranch`, call `claudeEnv(ctx.env)`, which throws when `CLAUDECODE`
  is `1` without `CLAUDE_CODE_SESSION_ID` or `CLAUDE_PID`; when it returns a value, call
  `takeHold({ ...ctx, root }, id)`. Any throw, including a live holder and that missing variable, writes one
  stderr line `accord: no hold taken on <id>: <first line of the message>` (or `accord: no hold taken: <first
  line>` before `id` is known), with every `\` turned into `/`. stdout is unchanged and the hook exits 0. Ledger
  Ruling: the startup hold uses the same env and process table as `worktree open`. If Claude Code does not pass
  `CLAUDE_CODE_SESSION_ID` and `CLAUDE_PID` to hooks, no hold is taken, and the folder rule of Task 3 still makes
  the session work the ticket.
- `hook.ts`, `session-resume`: take `marker = input?.session_id ?? ctx.env.CLAUDE_CODE_SESSION_ID` and `root` as
  above. When `marker` is non-empty and `!isLinked(root)`, look for a held id: the first key in code-point order of
  `readHoldsFile(root)` whose `marker` matches. When one exists and `listWorktrees(root).slice(1)` has an entry on
  `branchOf(ctx.snapshot, id)`, the body is `(anchorText(ctx.snapshot, id) ?? '')`, then
  `this session works <id>: call EnterWorktree with the path on the next line, then run accord anchor there and go on at the stage it prints\n`,
  then `enter: <entry.path>\n`. Otherwise `activeTicket(root, ctx.snapshot)` and today's fallback apply. Errors
  keep today's rule: one stderr line, then the session line.
- `worktree.ts`, `worktreeClean`, inside `if (h !== undefined)`: before the process table is read, compute
  `claude = claudeEnv(ctx.env)` inside the existing `try`. When it is defined and `h.marker === claude.marker`,
  write `kept <path>: this session's worktree` and `continue`. The `table` and `sessionIn` lines follow unchanged.

Must not change: `hook.test.ts`'s cases, the `subagent-start` output, and every `worktree clean` case in
`worktree.test.ts` (all run with env `{}`).

## Task 7: The /accord skill moves into the worktree on enter and refuses other work in a ticket session
covers: D-03, D-05, D-06, D-09
files: packages/core/skills/accord/SKILL.md, packages/core/skills/accord/worktree.md, packages/core/skills/accord/ids.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/worktree.md, .claude/skills/accord/ids.md
verify: packages/core/test/stage-skills.test.ts#risk:complex-branching-the-accord-skill-pushes-then-enters-the-worktree-on-enter-and-refuses-other-work-in-a-ticket-session, packages/core/test/skills.test.ts#render-output-invariants->-every-SKILL.md-is-at-most-MAX_SKILL_BYTES-bytes-(spec-§2), packages/core/test/skills.test.ts#render-output-invariants->-no-rendered-skill-or-agent-names-a-runtime-product-(D-109)

Consumes: the `enter:` line (Tasks 1 and 2), the refusal message (Task 3) and `accord worktree check` (Task 3,
already in `REAL`). Ledger Ruling: the claim push and the people carry happen before EnterWorktree, because after
the move Claude Code refuses `git -C` aimed at the main checkout.

Two limits of `packages/core/test/skills.test.ts` bind this task's text, and both cases are on `verify:`:
- `MAX_SKILL_BYTES = 5120` (`skills.test.ts:188`, checked at `:255-259`) caps every rendered SKILL.md. Counted by
  hand from the files at the baseline (UTF-8, `→` and `…` 3 bytes each, LF): `packages/core/skills/accord/SKILL.md`
  is 5039 bytes and the rendered `.claude/skills/accord/SKILL.md` is 5057 bytes, so the budget is 63 bytes. Before
  editing, confirm both with
  `node -e "for (const f of process.argv.slice(1)) console.log(f, require('fs').statSync(f).size)" packages/core/skills/accord/SKILL.md .claude/skills/accord/SKILL.md`.
  The only SKILL.md change below is one 47-character line and one blank line, 49 bytes, about 5106 after it. All
  other wording goes into `worktree.md`, which has no byte cap. Run the same command after the regeneration.
- D-109 (`skills.test.ts:316-332`): no rendered skill or reference names a runtime product, `Claude Code`
  included. Every line below is keyed on the `enter:` and `stop:` lines the CLI prints, never on a product name.
  `EnterWorktree` is a tool name the Approach requires and is not on that list.

Test first, in `packages/core/test/stage-skills.test.ts`, top-level:
- `it('risk:complex-branching the accord skill pushes then enters the worktree on enter and refuses other work in a ticket session')`:
  - Setup: `get` and `slice` are as in the existing worktree case. `text` is the rendered SKILL.md, `ref` is
    `worktree.md` and `ids` is `ids.md`, each with whitespace runs collapsed.
  - `enter = slice(ref, '`enter: <path>`', '`held: <id> by this session`')` is non-empty.
  - `p = enter.indexOf('`git push -u origin <branch>`')`, `q = enter.indexOf('people entry')` and
    `e = enter.indexOf('EnterWorktree')`: `p`, `q` and `e` are each greater than -1, and `p < e` and `q < e`.
  - `enter` contains `Continue step 2`, `` `/accord continue <id>` to retry ``,
    `or close this session and open one in that folder` and `editing nothing`.
  - `ref` contains ``Exit 2 starting `this session works` ``.
  - `slice(ref, 'Exit 2 naming a setup command', 'Any other exit 2')` contains
    `` type `/accord continue <id>` again in this same session `` and `in a session opened there`.
  - `i = text.indexOf('First run the session check in `./worktree.md`.')` is greater than -1 and less than
    `text.indexOf('## Dashboard')`.
  - `check = ref.slice(ref.indexOf('## Session check'))`, with `ref.indexOf('## Session check')` greater than -1,
    contains `` `accord worktree check` ``, `before the dashboard and before every New request`, `in every lane`,
    ``a message that starts `this session works` ``, `offer only Continue on that ticket` and
    `write, create, claim and edit nothing`.
  - `ids.slice(ids.indexOf('## Dropping instead of renaming'))` contains `` `accord new ticket` is refused `` and
    `open a new session in the main checkout`.

Text, every code span on one line:
- `packages/core/skills/accord/SKILL.md`: one line, `First run the session check in `./worktree.md`.`, and a blank
  line after it, inserted between the blank line that follows the frontmatter and `## Dashboard: `/accord` with no
  argument`. Nothing else in SKILL.md changes. The line names no `accord <command>`, so the case
  `every SKILL.md opens on its first command` still finds `accord dashboard` first.
- `packages/core/skills/accord/worktree.md`:
  - After the first line add: "A session that follows an `enter:` line moves into the ticket's worktree and works
    only that ticket from then on."
  - After the `stop:` bullet add: "- `enter: <path>` (printed instead of `stop:` when this session can move into
    the worktree): this session moves into the worktree. First, when Pick up made the claim, push it with
    `git push -u origin <branch>` as above, and carry any people entry as below; then call EnterWorktree with
    `path` set to `<path>`, and go on at Continue step 2 (`accord anchor`) without asking. From then on every
    command, path and edit is in the worktree. When EnterWorktree fails, show `<path>`, say "type
    `/accord continue <id>` to retry, or close this session and open one in that folder", and stop, editing
    nothing."
  - The bullet "Exit 2 naming a setup command" becomes: "- Exit 2 naming a setup command: show the message and
    stop. The worktree is kept; once the owner fixes the command, they type `/accord continue <id>` again in this
    same session and follow the `enter:` or `stop:` line it prints. The run that prints `enter:` has already run
    every setup command again; after a `stop:` line, `/accord continue <id>` in a session opened there runs every
    setup command again." In a session that gets `enter:` lines, Pick up and a new ticket hold the ticket before
    setup runs (Tasks 1 and 2), so the retry is that session's own Continue, and Continue from the main checkout
    reruns setup when its done marker is missing (Task 1).
  - Before "Any other exit 2" add: "- Exit 2 starting `this session works`: this session works another ticket;
    show the message and stop, editing nothing."
  - At the end of the file add a section, its heading on its own line:
    "## Session check

    Run it before the dashboard and before every New request, in every lane, also a New request picked from the
    dashboard; never before Pick up or Continue on a named ticket. Run `accord worktree check`.

    - Exit 0: go on.
    - Exit 2 with a message that starts `this session works`: this session works the ticket it names. Show the
      message. For the dashboard, go on with it, and offer only Continue on that ticket. For a New request, stop:
      write, create, claim and edit nothing.
    - Any other exit 2: show the message. For the dashboard, go on with it; for a New request, stop, editing
      nothing."
  - In the people paragraph, "before you stop:" becomes "before you stop or move into it:".
  - In the failed-push paragraph, "follow the `stop:` line it prints" becomes "follow the `stop:` or `enter:`
    line it prints".
- `packages/core/skills/accord/ids.md`, at the end of `## Dropping instead of renaming`: "In a session that works
  the dropped ticket, `accord new ticket` is refused: commit step 1 there, then say to open a new session in the
  main checkout and do steps 2 to 6 there."

Regenerate from the repository root, in this order:
1. `npm run gen` (rewrites `packages/core/src/generated/skills.ts`).
2. `npm run build`.
3. `node packages/cli/dist/cli.js skills sync` (rewrites `.claude/skills/accord/SKILL.md`, `worktree.md` and
   `ids.md`).

Must not change: every phrase the existing cases assert. That includes `REQUIRED.accord`; the cases `ac-4 the
accord skill picks up...`, `ac-5 the accord skill takes the claim branch...` and `risk:regression the accord skill
opens each ticket in its own worktree...` (the `stop:` bullet keeps `Never change directory into the worktree` and
`except the people entry below`, and `--lane M --worktree` still appears exactly twice in the M bullet); and
`packages/cli/test/skill-commands.test.ts` and `packages/cli/test/skills-sync.test.ts`. No slice but the
Dashboard's names `worktree clean`. No skill names `git switch`. The setup bullet keeps
`runs every setup command again`.

## Task 8: A session keeps its ticket after clean drops its hold or another session takes it over
covers: @ac-4
files: packages/cli/src/commands/worktree.ts, packages/cli/src/commands/hook.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-whose-hold-was-cleaned-or-taken-over-still-works-its-ticket-when-resumed-in-the-main-checkout, packages/cli/test/worktree.test.ts#risk:complex-branching-a-session-started-in-a-ticket-worktree-is-recorded-as-working-it-when-the-start-hook-takes-no-hold

Why: `worktree clean` drops a dead session's hold (`worktree.ts:390-396`) and a Continue takeover rewrites the
holds entry's marker (`worktree.ts:175-179`). A session that worked A, closed, and was resumed in the main checkout
after either would find no hold and no worktree folder of its own, and could pick up B, against @ac-4 (a session
works A for its whole life, even after A is done or merged) and the Veto. The worked record (preamble) keeps that
fact. A session started in A's worktree (D-04) whose start hook took no hold, because another live session holds
A or the hook's env lacks the session variables, would have no hold to record; the start hook records it from the
marker it has (plan-review 2.4).

Consumes: `takeHold` (Task 1), `inClaude`, `worksTicket` and `guardTicketSession` (Task 3), `hookInput`, the
`prompt-expansion` hook and the stdin `run` helper (Task 4), and the session-start block of Task 6. Produces:
`recordWorked` (exported) and `workedBy` in `worktree.ts`. The hook, `worktree check`, `worktree open` and
`new ticket` all reach the record through `worksTicket`, so none of them changes.

Test first, in `packages/cli/test/worktree.test.ts`, appended at the end:
- `it('risk:complex-branching a session whose hold was cleaned or taken over still works its ticket when resumed in the main checkout')`,
  with `120_000` as the third argument of `it`. `worked = () => readFileSync(`${c.root}/.git/accord/worked`, 'utf8')`.
  `hook(s, args)` is `run(['hook', 'prompt-expansion'], c.root, {}, JSON.stringify({ session_id: s.marker,
  command_name: 'accord', command_args: args, cwd: c.root }))`.
  - Setup: `c = clone({ tickets: ['ST-9', 'ST-10', 'ST-11'] })`, `sib = c.sibling('ST-9')`.
  - The record: with `setTable(tableOf(A))`, `worktree open ST-9` from `c.root` with `envOf(A)` exits 0 with
    `enter:`. `worktree open ST-9 --continue` from `sib` with `envOf(A)` gives `out === HELD`. `worked()` equals
    `'ST-9\tsess-A\n'`: one line, not one per hold taken.
  - Clean, then resume: `gitRun(sib, 'push', '-q', '-u', 'origin', 't/ST-9')`, `mergeOnRemote(c, 'ST-9')`. With
    `setTable(tableOf(B))` (A has ended), `worktree clean` from `c.root` with `envOf(B)` exits 0 and its `out`
    contains `removed ${sib}`. Preconditions: `sib` does not exist and `readHolds(c)` has no key `ST-9`. `worked()`
    still equals `'ST-9\tsess-A\n'`. Then A resumes in the main checkout: `setTable(tableOf(A))`.
    `worktree open ST-10` and `worktree check` from `c.root` with `envOf(A)` each exit 2 with `err` containing
    `this session works ST-9`. `hook(A, 'pick-up ST-10')` exits 0 and `JSON.parse(out)` has `decision: 'block'` and
    a `reason` containing `this session works ST-9`. `c.sibling('ST-10')` does not exist.
  - Takeover, then resume: with `setTable(tableOf(C))`, `worktree open ST-10` from `c.root` with `envOf(C)` exits 0
    with `enter:`. With `setTable(tableOf(B))` (C has ended), `worktree open ST-10 --continue` from `c.root` with
    `envOf(B)` exits 0 with `lines(out)` equal to `[`enter: ${c.sibling('ST-10')}`]`; B ran only `clean`, which
    takes no hold, so B works no ticket. Precondition: `(readHolds(c)['ST-10'] as { marker: string }).marker` is
    `sess-B`, and no holds entry has marker `sess-C`. Then C resumes in the main checkout:
    `setTable(tableOf(C))`, and record `w = worked()`. `worktree open ST-11` and `new ticket ST-12 --lane M` from
    `c.root` with `envOf(C)` each exit 2 with `err` containing `this session works ST-10`. `hook(C, 'pick-up ST-11')`
    blocks with a `reason` containing `this session works ST-10`. `c.sibling('ST-11')` and
    `${c.root}/accord/tickets/ST-12.md` do not exist, and `worked()` equals `w`.
  - Last: `worktree open ST-10 --continue` from `c.root` with `envOf(C)` is not refused by this rule: its `err`
    does not contain `this session works`.
- `it('risk:complex-branching a session started in a ticket worktree is recorded as working it when the start hook takes no hold')`,
  with `120_000` as the third argument of `it`.
  - Setup: `c = clone({ tickets: ['ST-9', 'ST-10'] })`, `sib = c.sibling('ST-9')`,
    `c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main')`. `worked` and `hook(s, args)` are defined
    inside this test exactly as in the test above.
    `start(env, marker)` is `run(['hook', 'session-start'], sib, env, JSON.stringify({ session_id: marker, cwd: sib,
    source: 'startup' }))`.
  - Another live holder: `writeHolds(c, { 'ST-9': LIVE })` and `setTable(tableOf(B, { pid: 4242, start: 'S2' }))`.
    `start(envOf(B), 'sess-B')` exits 0, `out` starts `# accord rules\n`, `err` is one line containing `sess-H`,
    and `(readHolds(c)['ST-9'] as { marker: string }).marker` is still `sess-H`. `lines(worked())` contains
    `'ST-9\tsess-B'`.
  - Missing variables: `start({ CLAUDECODE: '1' }, 'sess-E')` exits 0, `out` starts `# accord rules\n`, `err` is
    one line containing `no hold taken on ST-9`, and `lines(worked())` contains `'ST-9\tsess-E'`.
  - Another runtime: `start({}, 'sess-O')` exits 0 and no line of `worked()` ends with `sess-O` (D-01).
  - Resumed in the main checkout after the folder is gone: `c.git('worktree', 'remove', sib)`. With
    `setTable(tableOf(B))`, `worktree check` from `c.root` with `envOf(B)` exits 2 with `err` containing
    `this session works ST-9`. `worktree open ST-10` from `c.root` with
    `{ CLAUDECODE: '1', CLAUDE_CODE_SESSION_ID: 'sess-E' }` exits 2 with `err` containing `this session works ST-9`,
    and `c.sibling('ST-10')` does not exist. `hook({ marker: 'sess-E' }, 'pick-up ST-10')` exits 0 and
    `JSON.parse(out)` has `decision: 'block'` and a `reason` containing `this session works ST-9`.

Interface, `packages/cli/src/commands/hook.ts`, `session-start` (the block Task 6 added): once the linked worktree
`root` and its ticket `id` are known, and before the hold attempt, compute `s = inClaude(ctx.env)`. When `s` is
defined, take `marker = input?.session_id || s.marker`; when `marker` is a non-empty string, call
`recordWorked(root, id, marker)` inside its own `try`, whose failure writes one stderr line
`accord: no record of <id>: <first line of the message>`, with every `\` turned into `/`. The hold attempt then
runs as Task 6 says, so a live holder or missing variables still write their one `no hold taken` line, and that
throw never undoes the record. When `s` is undefined (another runtime) nothing is recorded. stdout is unchanged and
the hook exits 0.

Interface, `packages/cli/src/commands/worktree.ts`:
- `export function recordWorked(root: string, id: string, marker: string): void`: `dir` is the same
  `<git-common-dir>/accord` folder `withHolds` uses, `file = dir + '/worked'`. `mkdirSync(dir, { recursive: true })`.
  Read `file` as UTF-8, an absent file being `''`. When no line equals `${id}\t${marker}`,
  `appendFileSync(file, `${id}\t${marker}\n`)`. It never rewrites or truncates the file.
- `takeHold` calls `recordWorked(ctx.root, id, session.marker)` right after its `withHolds` call returns. A
  `withHolds` that throws (a live holder, a locked or broken holds file) records nothing.
- `export function workedBy(root: string, marker: string): string | undefined`: read the same file without a
  lock and without creating `dir` (it writes nothing). An absent file gives `undefined`. Otherwise return the part
  before the first `\t` of the first line whose part after it equals `marker`; a line with no `\t` is skipped.
- `worksTicket` step 3: after the holds lookup finds no entry, and still only when `marker` is defined,
  `const id = workedBy(top, marker)`; when `id` is defined, return `{ id, top }`. The folder rule (step 2) and the
  holds lookup keep their order before it.

Must not change: `worktreeClean` never reads or writes the record; every existing hold and clean case; the
holds file's shape and its lock; Task 3's tests, where every session that holds a ticket also has it recorded,
so each refusal names the same ticket; Task 6's tests, whose session-start runs keep their stdout, stderr and
holds bytes (a record line is written under `.git/accord/worked` only, which none of them reads).

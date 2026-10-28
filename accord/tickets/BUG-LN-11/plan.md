---
baseline: 96525b1dbf639196a56bb059e13365906db079e9
plan_hash: "fnv1a64:01d8265442dcc73f"
---

# Plan: BUG-LN-11

Review mode `outcome`: one branch, no slices.

Each task below repeats the rules it needs, since an executor receives one task. Common to all: commits carry no trailer of any kind (no Co-Authored-By, no Signed-off-by, no "Generated with" line); new test titles hold no `@`, no comma and no apostrophe, and are top-level `it(...)` calls, so the case id is `<test file path>#<title with spaces as hyphens>`.

## Task 1: Reproduce the lagging task count and add accord worktree push

covers: @ac-1, D-01, D-02, D-03
files: packages/cli/test/worktree-push.test.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/src/run.ts, packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/worktree-push.test.ts#ac-1-a-recorded-task-pushed-with-accord-worktree-push-shows-the-same-task-count-in-another-clone (@ac-1)

This is the failing reproduction and the wiring of the fix. Write the test first and run it at the baseline: it fails because `accord worktree push` does not exist. The dashboard, the claim view and every rule of which ref the dashboard reads stay as they are (D-02); nothing touches the panel (D-03); no state file is added, the pushed git ref is the only shared state (D-01).

**Test rules** (Tasks 3 and 4 follow them too). No commit trailer. New test titles hold no `@`, no comma and no apostrophe, and are top-level `it(...)` calls, so the case id is `packages/cli/test/worktree-push.test.ts#<title with spaces as hyphens>`. A commit the test makes uses `commitMsg` (or `mergeMsg`) from `packages/cli/test/helpers/repo.ts` (`-F <file> --cleanup=verbatim`), never `-m`. The CLI is driven in-process with `run(argv, cwd)` from the same file, in a `makeClone()` sandbox from `packages/cli/test/helpers/worktree.ts` (a bare origin `c.remote`, a clone `c.root` on `main` holding the lane M ticket `ST-9`, and `c.otherClone()` for a second clone). Each test cleans up with `c.cleanupAll()` in a `finally` and carries a `120_000` timeout, as the tests in `packages/cli/test/worktree.test.ts` do.

**Shared helpers**, written at the top of the new `packages/cli/test/worktree-push.test.ts` and reused by Tasks 3 and 4:
- `claimed(c: Clone): string` — `c.git('worktree', 'add', '-q', '-b', 't/ST-9', c.sibling('ST-9'), 'origin/main')`; write `src/export.ts` = `export const write = 1;\n` there (the file the plan's tasks name, so it exists at the plan baseline); `commitMsg(wt, 'claim: ST-9')`; `gitRun(wt, 'push', '-q', '-u', 'origin', 't/ST-9')`; return the worktree path.
- `head(dir)` = `gitRun(dir, 'rev-parse', 'HEAD').trim()`; `onOrigin(c)` = `gitRun(c.remote, 'rev-parse', 'refs/heads/t/ST-9').trim()`.
- `freshReport(dir)` — `utimesSync` of `reports/junit.xml` to now plus 5 seconds, as `packages/cli/test/lane-flow.test.ts` lines 11-14 do, since `task-done` refuses a report older than HEAD.
- `row(dir)` — run `['dashboard', '--json']` in `dir`, expect exit 0, parse it, look for the row whose `id` is `ST-9` among the `rows` of `yours`, `team`, `ready` and `upNext`, and return `{ stage, tasksDone, tasksTotal }` of that row (undefined when absent).
- From `../../../test/helpers/lane.js` import `PLAN`, `REPORT` and `junit`; the report is `junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' })`.

**Test first**, in `packages/cli/test/worktree-push.test.ts`, with the helpers above. Title `ac-1 a recorded task pushed with accord worktree push shows the same task count in another clone`. Steps:
1. `c = makeClone()`; `wt = claimed(c)`.
2. In `wt`: `run(['approve', 'ST-9'])` and `run(['gate', 'ready', 'ST-9'])` each exit 0; `baseline = commitMsg(wt, 'approach: ST-9 approved')`; write `accord/tickets/ST-9/plan.md` = `PLAN.replace('abc1234', baseline)` and `REPORT` = the report above; `run(['gate', 'plan', 'ST-9'])` exits 0; `commitMsg(wt, 'plan: ST-9 ready')`; `gitRun(wt, 'push', '-q', 'origin', 't/ST-9')`. This is the Given: a ticket at build whose claim branch is pushed.
3. `freshReport(wt)`; `run(['task-done', 'ST-9', '1'], wt)` exits 0; `tip = commitMsg(wt, 'build: ST-9 task 1')` (it holds the ledger line and the ticket).
4. `o = c.otherClone()`. Assert `await row(wt)` equals `{ stage: 'build', tasksDone: 1, tasksTotal: 2 }` and `await row(o)` equals `{ stage: 'build', tasksDone: 0, tasksTotal: 2 }`: the bug, the other clone lags.
5. `r = await run(['worktree', 'push', 'ST-9'], wt)`; assert `r` equals `{ code: 0, out: 'pushed: t/ST-9\n', err: '' }` and `onOrigin(c)` equals `tip`.
6. `gitRun(o, 'fetch', '-q', 'origin')`; assert `await row(o)` equals `await row(wt)` and its `tasksDone` is 1.

**Command**, in `packages/cli/src/commands/worktree.ts`, one exported function placed right after `continueMerge`:

```ts
/** BUG-LN-11: push the ticket's claim branch by its ref, so it works from any worktree; a failed push is named with git's message and exits 0. */
export function worktreePush(ctx: CommandContext, id: string): number
```

- An id failing `ID` throws `new UsageError('not a valid ticket id: ' + id)` (exit 2), as `worktreeMerge` does.
- `branch = branchOf(ctx.snapshot, id)`.
- `gitNoPrompt(ctx.root, ['push', 'origin', \`refs/heads/${branch}:refs/heads/${branch}\`])`, with no third argument: the push has no time limit (Approach, plan round 2.2), because a limit would also kill a slow pre-push hook, and `gitNoPrompt` already turns every credential and SSH prompt off, so the push never waits on one. Do not import or call `fetchLimitMs`. No `-u`, no fetch, no check for an origin remote first: a missing origin is a failed push like any other.
- On success write `pushed: ${branch}\n` to `ctx.stdout` and return 0.
- On any throw write `push of ${branch} failed; its commits stay local until the next push\n` to `ctx.stdout`, then git's whole stderr trimmed (`String((e as { stderr?: string }).stderr ?? '').trim()`), or `String(e)` when that is empty, followed by `\n`. There is no time-limit branch and no `no answer within` line. Return 0. Nothing goes to `ctx.stderr`.

**Registration**, in `packages/cli/src/run.ts`: import `worktreePush` beside the other worktree functions and add, after the `merge <id>` subcommand:

```ts
  worktree
    .command('push <id>')
    .description("push the ticket's claim branch to origin; a failed push prints git's message and exits 0, its commits stay local until the next push")
    .action((id: string) => {
      setCode(worktreePush(preflight(opts), id));
    });
```

**Command list**, in `packages/cli/test/skill-commands.test.ts` line 92: add `'worktree push'` after `'worktree open'` in the expected array. Nothing else in that file changes.

Behaviour that must not change:
- In `worktree.ts`: `gitNoPrompt`, `fetchOrigin`, `continueMerge` (its own push and its `push of ... failed:` line), `worktreeMerge`, `worktreeOpen`, `worktreeClean`, `newTicketWorktree` and every other function, byte for byte. `packages/cli/src/commands/fetch-limit.ts` is not touched; fetches keep their limit.
- In `run.ts`: every other command, its description and its preflight mode.
- `packages/cli/test/worktree.test.ts`, `packages/cli/test/dashboard.test.ts` and `packages/cli/test/spawn-surface.test.ts` stay green untouched.

Consumes: the claim branch name from the snapshot (`branchOf`) and `gitNoPrompt`. Produces: `accord worktree push <id>`, which Task 2's skills call, and the test helpers Tasks 3 and 4 reuse.

Done when `packages/cli/test/worktree-push.test.ts`, `packages/cli/test/skill-commands.test.ts` and `packages/cli/test/worktree.test.ts` pass.

## Task 2: Have the stage skills push after each stage commit and each recorded task

covers: @ac-1, @ac-2, @ac-3, D-04
files: packages/core/skills/intent/SKILL.md, packages/core/skills/approach/SKILL.md, packages/core/skills/plan/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/skills/accord/worktree.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-approach/SKILL.md, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-build/SKILL.md, .claude/skills/accord/worktree.md, .claude/skills/accord-verify/worktree.md, .claude/skills/accord-debug/worktree.md
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-stage-skills-run-accord-worktree-push-after-each-stage-commit-and-each-recorded-task, packages/core/test/skills.test.ts#render-output-invariants->-every-SKILL.md-is-at-most-MAX_SKILL_BYTES-bytes-(spec-§2)

This wires the push into the moments the Intent names: intent approved, approach approved, plan through its gate, each recorded build task, and a re-approved approach in build, and it tells the session to go on after a failed push (@ac-3). Review is not touched (D-04). Commits carry no trailer of any kind (no Co-Authored-By, no Signed-off-by, no "Generated with" line). The new test title holds no `@`, no comma and no apostrophe, in a top-level `it(...)`, so its case id is the `verify:` id above.

**Test first**, appended to `packages/core/test/stage-skills.test.ts`, title `risk:regression the stage skills run accord worktree push after each stage commit and each recorded task`. Use `all = { ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig`, `skillTargets(all)`, `skillDirs(all)` and `installedName(stage)` as the tests above it do, and flatten each SKILL.md with `.replace(/\s+/g, ' ')`. The rows, as the test writes them (`go` true means the step must also say to go on after a failed push):

```ts
const PUSH = 'run `accord worktree push <id>`';
const GO = 'go on even if it fails';
const ROWS: [stage: string, from: string, to: string, commit: string, go: boolean][] = [
  ['intent', "9. **The owner's yes.**", '10. Next', 'uses `--allow-empty` when nothing changed', true],
  ['approach', "5. **The owner's yes.**", '6. Next', 'Then commit the ticket, with `approved_hash:` and `ac_hash:` in it', true],
  ['plan', '8. **Finish.**', '9. Next', 'with the subject `plan: <id> ready`', false],
  ['build', '3. **Record.**', '4. **Blocked.**', 'commit the ticket together with `accord/tickets/<id>/ledger.md`', false],
  ['build', '6. **Change of course.**', '7. **Plan changed.**', 'on yes run `accord approve <id>`, commit the ticket', false],
];
```

For every dir and row, slice the flattened SKILL.md of `installedName(stage)` from `from` to `to` and assert: both markers are found (`from` before `to`), `commit` is in the step, `PUSH` is in the step at an index after `commit`'s, and, when `go` is true, `GO` is in the step after `PUSH`'s index. Also assert, for every dir, that the review SKILL.md (`installedName('review')`) does not contain `worktree push` (D-04: review rounds push nothing).

The same test also checks the go-on rule that covers plan and build, in the session's worktree reference. Take every rendered file of `skillTargets(all)` whose path ends with `/worktree.md`; assert that each dir has one at `dir + '/' + installedName('accord') + '/worktree.md'`, and for each such file, flattened the same way, with these strings:

```ts
const OPEN = 'A line starting `push of` that `accord worktree open <id> --continue` prints: the merge commit was not pushed.';
const OLD = 'A line starting `push of` (Continue only)';
const FROM = 'A line starting `push of` from `accord worktree push <id>`';
const NEXT = 'Lines starting `removed`';
const SAYS = ['the commits stay local until the next push', "go on with the stage's next step", 'never stop or ask the owner'];
const LEASE = ['After a commit is reworded', 'run the next push as `accord worktree push <id> --force-with-lease`'];
```

assert it contains `OPEN`, does not contain `OLD`, contains `FROM`, contains `NEXT` at an index after `FROM`'s, and the slice from `FROM` to `NEXT` contains every string of `SAYS` and every string of `LEASE` (plan round 2.1: the force-with-lease rule sits in the same bullet as the go-on rule).

**Skill sources.** Each edit adds exactly the text shown; no other wording in any file changes. Keep the existing indentation and wrap lines near the width of their neighbours.
- `packages/core/skills/intent/SKILL.md` step 9: after the sentence ending ``uses `--allow-empty` when nothing changed.`` insert ``Then run `accord worktree push <id>`; go on even if it fails.`` before `On a no,`.
- `packages/core/skills/approach/SKILL.md` step 5: after ``Then commit the ticket, with `approved_hash:` and `ac_hash:` in it.`` insert ``Then run `accord worktree push <id>`; go on even if it fails.`` before `If the owner picks another option`.
- `packages/core/skills/plan/SKILL.md` step 8: append ``Then run `accord worktree push <id>`.`` after ``checks for it.``. The re-plan path reaches it, since a re-plan runs step 8 again.
- `packages/core/skills/build/SKILL.md` step 3, the bullet that writes the ledger line: its sentence ending ``then commit the ticket together with `accord/tickets/<id>/ledger.md`.`` ends instead ``then commit the ticket together with `accord/tickets/<id>/ledger.md`, then run `accord worktree push <id>`.`` Step 3 runs before step 2 dispatches the next task, so the push lands before the next task starts.
- Plan and build carry no "go on" phrase, because of the byte cap: the command exits 0, its failure line says the commits stay local until the next push, and the go-on rule for that line lives in `packages/core/skills/accord/worktree.md` (below), which the session reads at every `/accord continue` and has no byte cap.
- `packages/core/skills/build/SKILL.md` step 6: ``on yes run `accord approve <id>`, then `accord-plan`'s re-plan`` becomes ``on yes run `accord approve <id>`, commit the ticket and run `accord worktree push <id>`, then `accord-plan`'s re-plan``; the rest of the sentence is unchanged. A failed push there is carried by the re-plan's own push at plan step 8.
- `packages/core/skills/accord/worktree.md`, lines 34-35, the bullet that starts ``- A line starting `push of` (Continue only):``. Today it covers every `push of` line, so a failed `accord worktree push` would make the session retry and stop. Replace those two lines with these two bullets, wrapped like their neighbours (two-space continuation indent):

  ```
  - A line starting `push of` that `accord worktree open <id> --continue` prints: the merge commit was not
    pushed. Show it verbatim, tell the owner the merge commit is local only, and run the push command the
    line names; when that push fails too, show git's message and stop.
  - A line starting `push of` from `accord worktree push <id>`, which a stage skill runs after its commit:
    the commits stay local until the next push. Show it and git's message after it verbatim and go on with
    the stage's next step; never stop or ask the owner. After a commit is reworded, as `accord-build` step 3
    does for a forbidden line, run the next push as `accord worktree push <id> --force-with-lease`: a plain
    push is rejected once the reworded commit was already on origin, and the command still refuses to
    replace a commit someone else pushed that this branch never held, even after a fetch.
  ```

  The first keeps the old bullet's meaning for the merge commit word for word from `the merge commit was not pushed.` on; the second is new. Its last two sentences are the rule for a reworded commit (plan round 2.1, owner: force-push with lease): build step 3's "reword that commit yourself" can rewrite a commit an earlier `accord worktree push` already sent, and without the lease every push after it is rejected while the go-on rule hides it. The rule lives here because `.claude/skills/accord-build/SKILL.md` has no bytes left. The `--force-with-lease` option of `accord worktree push` is added by Task 4; `packages/cli/test/skill-commands.test.ts` checks only the command path `worktree push`, so this task passes before Task 4. Every other line of worktree.md stays as it is.

**Size caps.** The rendered plan and build SKILL.md files sit close to the 5120-byte cap that `packages/core/test/skills.test.ts` checks (`every SKILL.md is at most MAX_SKILL_BYTES bytes`): before this task `.claude/skills/accord-plan/SKILL.md` is 5061 bytes and `.claude/skills/accord-build/SKILL.md` is 5010 bytes, so add no word beyond the text above and rewrap only the lines an edit touches. After the re-render, run that test before anything else. If any of the four files is over the cap, do not reword, shorten or move any other text: stop and report `BLOCKED` with each file's byte count and the cap.

**Re-render**, in this order (conventions.md): `npm run gen`, then `npm run build`, then `node packages/cli/dist/cli.js skills sync`. Commit the four SKILL.md sources, `packages/core/skills/accord/worktree.md`, `packages/core/test/stage-skills.test.ts`, `packages/core/src/generated/skills.ts`, the four `.claude/skills/accord-*/SKILL.md` copies and the three worktree.md copies the sync rewrites (`.claude/skills/accord/worktree.md`, `.claude/skills/accord-verify/worktree.md`, `.claude/skills/accord-debug/worktree.md`). If gen or sync changes any other file, report it.

Behaviour that must not change: every phrase `stage-skills.test.ts` already requires, including `REQUIRED.build` (`change note`, `accord approve`, `accord-plan`) and the step-3 order test `risk:complex-branching the build skill routes a task-done refusal over a forbidden commit line`; the review, verify, debug and accord SKILL.md files and every other reference file byte for byte; in worktree.md every line but the replaced `push of` bullet, including every phrase the tests `risk:regression the accord skill opens each ticket in its own worktree and cleans only from the bare dashboard` and `risk:complex-branching the accord skill pushes then enters the worktree on enter and refuses other work in a ticket session` require; the 120-line and 5120-byte caps in `packages/core/test/skills.test.ts`.

Consumes: `accord worktree push <id>` from Task 1. Produces: the five skill clauses that run it, the worktree.md rule that a failed `accord worktree push` never stops the work, and the worktree.md rule that the push after a reworded commit uses `--force-with-lease`.

Done when `packages/core/test/stage-skills.test.ts`, `packages/core/test/skills.test.ts` and `packages/cli/test/skill-commands.test.ts` pass after the re-render.

## Task 3: Prove each stage change before build reaches another clone

covers: @ac-2, D-04
files: packages/cli/test/worktree-push.test.ts (new), packages/cli/src/commands/worktree.ts
verify: packages/cli/test/worktree-push.test.ts#ac-2-each-stage-change-before-build-pushed-with-accord-worktree-push-shows-the-same-stage-in-another-clone (@ac-2)

**Test first**, in `packages/cli/test/worktree-push.test.ts`, title `ac-2 each stage change before build pushed with accord worktree push shows the same stage in another clone`. It should pass on Task 1's code; if a step fails, fix `worktreePush` in `packages/cli/src/commands/worktree.ts`, keeping its contract: exit 0 always for a valid id, `pushed: <branch>\n` on success, and on failure `push of <branch> failed; its commits stay local until the next push\n` followed by git's trimmed stderr and `\n`; the push has no time limit.

Follow the same test rules as the ac-1 test in that file: a title with no `@`, no comma and no apostrophe, in a top-level `it(...)`; `commitMsg` from `packages/cli/test/helpers/repo.ts` for every commit (never `-m`, no trailer), `run(argv, cwd)` in-process, `makeClone()` with `c.cleanupAll()` in a `finally`, and a `120_000` timeout. Reuse the helpers Task 1 put at the top of the file: `claimed(c)` (adds the worktree `c.sibling('ST-9')` on a new branch `t/ST-9` from `origin/main`, commits `src/export.ts` as `claim: ST-9` and pushes it), `head(dir)`, `onOrigin(c)` (the sha of `refs/heads/t/ST-9` in `c.remote`) and `row(dir)` (the `{ stage, tasksDone, tasksTotal }` of `ST-9` from `accord dashboard --json` run in `dir`), and `PLAN` from `../../../test/helpers/lane.js`.

Setup: `c = makeClone()`; `wt = claimed(c)`; `o = c.otherClone()`. Then three steps, each made and committed first, then pushed, then checked:
1. Intent approved: in `wt`, replace `Owners can export their report as CSV.` with `Owners can export their report as a CSV file.` in `accord/tickets/ST-9.md`; `commitMsg(wt, 'intent: ST-9 approved by the owner: "yes"')`. Run `run(['worktree', 'push', 'ST-9'], wt)`: exit 0, out `pushed: t/ST-9\n`. Assert `onOrigin(c)` equals `head(wt)`; `gitRun(o, 'fetch', '-q', 'origin')`; `await row(o)` equals `await row(wt)` and its `stage` is `intent`.
2. Approach approved: `run(['approve', 'ST-9'], wt)` and `run(['gate', 'ready', 'ST-9'], wt)` exit 0; `commitMsg(wt, 'approach: ST-9 approved by the owner: "yes"')`. Fetch `o` and assert its row's `stage` is still `intent` (the commit is not on origin yet). Run the push from the main checkout, `run(['worktree', 'push', 'ST-9'], c.root)`, which proves the branch ref is pushed from any worktree: exit 0, out `pushed: t/ST-9\n`. Assert `onOrigin(c)` equals `head(wt)`; fetch `o`; rows equal and `stage` is `plan`.
3. Plan through its gate: `baseline = head(wt)`; write `accord/tickets/ST-9/plan.md` = `PLAN.replace('abc1234', baseline)`; `run(['gate', 'plan', 'ST-9'], wt)` exits 0; `commitMsg(wt, 'plan: ST-9 ready')`. Fetch `o` and assert its row's `stage` is still `plan`. Push from `wt`: exit 0, out `pushed: t/ST-9\n`. Assert `onOrigin(c)` equals `head(wt)`; fetch `o`; rows equal and equal `{ stage: 'build', tasksDone: 0, tasksTotal: 2 }`.

Behaviour that must not change: Task 1's test and everything Task 1 lists.

Consumes: `accord worktree push` from Task 1. Produces: the @ac-2 proof.

## Task 4: Prove a failed push is reported and the next push carries every commit, and push a reworded commit with force-with-lease

covers: @ac-3
files: packages/cli/test/worktree-push.test.ts (new), packages/cli/src/commands/worktree.ts, packages/cli/src/run.ts
verify: packages/cli/test/worktree-push.test.ts#ac-3-a-failed-push-exits-0-with-the-failure-line-and-the-git-message-and-the-next-push-carries-every-commit (@ac-3), packages/cli/test/worktree-push.test.ts#risk:data-loss-a-reworded-commit-already-on-origin-is-pushed-with-force-with-lease-and-a-teammate-commit-the-branch-never-held-stays-on-origin

The contract of `worktreePush` (Task 1): exit 0 always for a valid id, `pushed: <branch>\n` on success, and on failure `push of <branch> failed; its commits stay local until the next push\n` followed by git's trimmed stderr and `\n`, nothing on stderr. The push has no time limit (Approach, plan round 2.2). `FAILED` is the string `push of t/ST-9 failed; its commits stay local until the next push`.

Follow the same test rules as the ac-1 test in that file: titles with no `@`, no comma and no apostrophe, in top-level `it(...)` calls; `commitMsg` and `mergeMsg` from `packages/cli/test/helpers/repo.ts` for every commit and merge (never `-m`, no trailer), `run(argv, cwd)` in-process, `makeClone()` with `c.cleanupAll()` in a `finally`, and a `120_000` timeout. Reuse the helpers Task 1 put at the top of the file: `claimed(c)` (adds the worktree `c.sibling('ST-9')` on a new branch `t/ST-9` from `origin/main`, commits `src/export.ts` as `claim: ST-9` and pushes it with `-u`, which also sets this clone's `refs/remotes/origin/t/ST-9`), `head(dir)` and `onOrigin(c)` (the sha of `refs/heads/t/ST-9` in `c.remote`).

**First test**, the @ac-3 test below. It should pass on Task 1's code; if a case fails, fix `worktreePush` in `packages/cli/src/commands/worktree.ts`, keeping the contract above.

`ac-3 a failed push exits 0 with the failure line and the git message and the next push carries every commit`, two cases, each its own `makeClone()`:
1. Unreachable remote. `wt = claimed(c)`; `claimTip = onOrigin(c)`. `c.git('remote', 'set-url', 'origin', c.remote + '-missing')`. Make a stage change: `run(['approve', 'ST-9'], wt)` and `run(['gate', 'ready', 'ST-9'], wt)` exit 0, `a = commitMsg(wt, 'approach: ST-9 approved')`. `r = await run(['worktree', 'push', 'ST-9'], wt)`: assert `r.code` 0, `r.err` `''`, `r.out` starts with `FAILED + '\n'`, the rest of `r.out` contains `does not appear to be a git repository`, `head(wt)` is still `a` and `onOrigin(c)` is still `claimTip`. Make a second commit while the remote is still unreachable (write `notes.txt`, `b = commitMsg(wt, 'b')`), push again and assert the same failure output. Repair with `c.git('remote', 'set-url', 'origin', c.remote)`, make a third commit `d`, push: exit 0, out `pushed: t/ST-9\n`, and `onOrigin(c)` equals `d`; assert `gitRun(c.remote, 'merge-base', '--is-ancestor', x, 'refs/heads/t/ST-9')` succeeds for `x` of `a` and `b`.
2. Rejected push. `wt = claimed(c)`; `o = c.otherClone()`; `gitRun(o, 'switch', 't/ST-9')`, write `teammate.txt`, `mate = commitMsg(o, 'teammate')`, `gitRun(o, 'push', '-q', 'origin', 't/ST-9')`. In `wt` write `mine.txt`, `m = commitMsg(wt, 'mine')`, push with `run(['worktree', 'push', 'ST-9'], wt)`: assert code 0, err `''`, out starts with `FAILED + '\n'` and contains `[rejected]`, and `onOrigin(c)` is still `mate`. Repair: `gitRun(wt, 'fetch', '-q', 'origin')`, `mergeMsg(wt, 'origin/t/ST-9', 'merge teammate')`, push again: exit 0, out `pushed: t/ST-9\n`, `onOrigin(c)` equals `head(wt)`, and `m` is an ancestor of it on the remote.

**Second test, written before the option exists**: `risk:data-loss a reworded commit already on origin is pushed with force-with-lease and a teammate commit the branch never held stays on origin`. Run it on Task 1's code first: it fails, because `--force-with-lease` is an unknown option there. Add a helper beside the others at the top of the file: `reword(c, dir, text)` writes `text + '\n'` to `` `${c.root}/.git/reword.txt` `` (outside every working tree, so it is never committed), runs `gitRun(dir, 'commit', '--amend', '-q', '-F', file, '--cleanup=verbatim')` and returns `head(dir)`; this is how build step 3 rewords a commit, without `-m` and without a trailer. The amend leaves the pre-amend commit in the reflog of the local branch `t/ST-9` (the sandbox clone is not bare, so git keeps branch reflogs, and every worktree of the clone shares them). Three cases, each its own `makeClone()`:
1. Own reword. `wt = claimed(c)`; write `notes.txt` in `wt`, `commitMsg(wt, 'notes')`; `run(['worktree', 'push', 'ST-9'], wt)` gives `pushed: t/ST-9\n` (the commit is now on origin, and this clone's `refs/remotes/origin/t/ST-9` follows it). `r = reword(c, wt, 'notes reworded')`. A plain `run(['worktree', 'push', 'ST-9'], wt)`: code 0, err `''`, out starts with `FAILED + '\n'` and contains `[rejected]`, and `onOrigin(c)` is not `r`: this is the lag the round-2.1 finding names. Then `run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt)`: assert it equals `{ code: 0, out: 'pushed: t/ST-9\n', err: '' }`, `onOrigin(c)` equals `r`, and `gitRun(c.remote, 'log', '-1', '--format=%s', 'refs/heads/t/ST-9').trim()` equals `notes reworded`. This passes with `--force-if-includes` too: origin's tip, the `notes` commit, is a reflog entry of the local branch.
2. Teammate push, no fetch. `wt = claimed(c)`; `o = c.otherClone()`; `gitRun(o, 'switch', 't/ST-9')`, write `teammate.txt`, `mate = commitMsg(o, 'teammate')`, `gitRun(o, 'push', '-q', 'origin', 't/ST-9')`. In `wt`, without fetching, `reword(c, wt, 'claim: ST-9 reworded')`; `run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt)`: code 0, err `''`, out starts with `FAILED + '\n'` and contains `stale info`, and `onOrigin(c)` still equals `mate`: the lease refuses, since origin's branch is not where this clone last saw it.
3. Teammate push, then a fetch. This is the case plan round 3.1 names: any `git fetch` in this clone (another session's `accord worktree open`, build step 3's own `git fetch origin`) moves the shared `refs/remotes/origin/t/ST-9` to the teammate's commit, so the lease alone would pass. `wt = claimed(c)`; `o = c.otherClone()`; `gitRun(o, 'switch', 't/ST-9')`, write `teammate.txt`, `mate = commitMsg(o, 'teammate')`, `gitRun(o, 'push', '-q', 'origin', 't/ST-9')`. Then `gitRun(wt, 'fetch', '-q', 'origin')`, and assert `gitRun(wt, 'rev-parse', 'refs/remotes/origin/t/ST-9').trim()` equals `mate` (the lease's expected value now matches origin). `own = reword(c, wt, 'claim: ST-9 reworded')`; `r = await run(['worktree', 'push', 'ST-9', '--force-with-lease'], wt)`: assert `r.code` 0, `r.err` `''`, `r.out` starts with `FAILED + '\n'`, the rest of `r.out` after that line is not empty once trimmed (git's message), `onOrigin(c)` still equals `mate`, and `head(wt)` equals `own`. Do not assert a particular git wording for this rejection: git's documentation does not state it. With `--force-with-lease` alone this case prints `pushed: t/ST-9` and origin loses `mate`, so it fails until `--force-if-includes` is passed.

**Option**, after that test fails:
- In `packages/cli/src/commands/worktree.ts`, `worktreePush` takes a third parameter: `export function worktreePush(ctx: CommandContext, id: string, o: { lease?: boolean } = {}): number`. When `o.lease === true` the git arguments are `['push', '--force-with-lease', '--force-if-includes', 'origin', refspec]`, the same refspec `refs/heads/${branch}:refs/heads/${branch}`; otherwise they stay `['push', 'origin', refspec]` as Task 1 wrote them. `--force-with-lease` is given with no value, so git compares origin's branch with this clone's `refs/remotes/origin/<branch>`; `--force-if-includes` (git 2.30 or newer) adds the check that the tip of that remote-tracking ref is reachable from a reflog entry of the local branch, so a commit a fetch brought in but the branch never held is not replaced (git-push documentation, `--force-if-includes`: it is a no-op unless `--force-with-lease` is given without an expected value, which is how it is given here). The call still goes through `gitNoPrompt` with no time limit, and success and failure print exactly as the contract above says. This keeps @ac-3: no prompt, exit 0, the same failure line; on a git older than 2.30 the unknown option makes the push fail with that same line. A flag on the command is used rather than a raw `git push --force-with-lease origin <branch>` in the skill text, because a raw push could wait on a credential prompt and would print no accord line. The CLI option keeps the name `--force-with-lease`; no `--force-if-includes` option is added to the command.
- In `packages/cli/src/run.ts`, the `push <id>` subcommand Task 1 registered becomes:

```ts
  worktree
    .command('push <id>')
    .description("push the ticket's claim branch to origin; a failed push prints git's message and exits 0, its commits stay local until the next push")
    .option('--force-with-lease', 'after a commit is reworded: replace the branch on origin only while it is still where this clone last saw it and this branch once held that commit')
    .action((id: string, o: { forceWithLease?: boolean }) => {
      setCode(worktreePush(preflight(opts), id, { lease: o.forceWithLease === true }));
    });
```

Behaviour that must not change: a push without `--force-with-lease` never forces and passes neither `--force-with-lease` nor `--force-if-includes` to git; Tasks 1 and 3 tests and everything Task 1 lists; in `run.ts` every other command; `packages/cli/src/commands/fetch-limit.ts` untouched.

Consumes: `accord worktree push` from Task 1. Produces: the @ac-3 proof and `accord worktree push <id> --force-with-lease`, which the worktree.md rule from Task 2 names.

Done when `packages/cli/test/worktree-push.test.ts`, `packages/cli/test/skill-commands.test.ts` and `packages/cli/test/worktree.test.ts` pass.

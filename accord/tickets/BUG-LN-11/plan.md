---
baseline: 96525b1dbf639196a56bb059e13365906db079e9
plan_hash: "fnv1a64:fc526885b98a9bab"
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
- `branch = branchOf(ctx.snapshot, id)`; `ms = fetchLimitMs()`.
- `gitNoPrompt(ctx.root, ['push', 'origin', \`refs/heads/${branch}:refs/heads/${branch}\`], ms)`. No `-u`, no fetch, no check for an origin remote first: a missing origin is a failed push like any other.
- On success write `pushed: ${branch}\n` to `ctx.stdout` and return 0.
- On any throw write `push of ${branch} failed; its commits stay local until the next push\n` to `ctx.stdout`, then one more block followed by `\n`: `no answer within ${ms / 1000} seconds` when `(e as NodeJS.ErrnoException).code === 'ETIMEDOUT'` (as `fetchOrigin` decides it), else git's whole stderr trimmed (`String((e as { stderr?: string }).stderr ?? '').trim()`), or `String(e)` when that is empty. Return 0. Nothing goes to `ctx.stderr`.

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
- In `worktree.ts`: `gitNoPrompt`, `fetchOrigin`, `continueMerge` (its own push and its `push of ... failed:` line), `worktreeMerge`, `worktreeOpen`, `worktreeClean`, `newTicketWorktree` and every other function, byte for byte.
- In `run.ts`: every other command, its description and its preflight mode.
- `packages/cli/test/worktree.test.ts`, `packages/cli/test/dashboard.test.ts` and `packages/cli/test/spawn-surface.test.ts` stay green untouched.

Consumes: the claim branch name from the snapshot (`branchOf`), `gitNoPrompt` and `fetchLimitMs`. Produces: `accord worktree push <id>`, which Task 2's skills call, and the test helpers Tasks 3 and 4 reuse.

Done when `packages/cli/test/worktree-push.test.ts`, `packages/cli/test/skill-commands.test.ts` and `packages/cli/test/worktree.test.ts` pass.

## Task 2: Have the stage skills push after each stage commit and each recorded task

covers: @ac-1, @ac-2, @ac-3, D-04
files: packages/core/skills/intent/SKILL.md, packages/core/skills/approach/SKILL.md, packages/core/skills/plan/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-approach/SKILL.md, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-build/SKILL.md
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-stage-skills-run-accord-worktree-push-after-each-stage-commit-and-each-recorded-task, packages/core/test/skills.test.ts#render-output-invariants->-every-SKILL.md-is-at-most-MAX_SKILL_BYTES-bytes-(spec-§2)

This wires the push into the moments the Intent names: intent approved, approach approved, plan through its gate, each recorded build task, and a re-approved approach in build. Review is not touched (D-04). Commits carry no trailer of any kind (no Co-Authored-By, no Signed-off-by, no "Generated with" line). The new test title holds no `@`, no comma and no apostrophe, in a top-level `it(...)`, so its case id is the `verify:` id above.

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

**Skill sources.** Each edit adds exactly the text shown; no other wording in any file changes. Keep the existing indentation and wrap lines near the width of their neighbours.
- `packages/core/skills/intent/SKILL.md` step 9: after the sentence ending ``uses `--allow-empty` when nothing changed.`` insert ``Then run `accord worktree push <id>`; go on even if it fails.`` before `On a no,`.
- `packages/core/skills/approach/SKILL.md` step 5: after ``Then commit the ticket, with `approved_hash:` and `ac_hash:` in it.`` insert ``Then run `accord worktree push <id>`; go on even if it fails.`` before `If the owner picks another option`.
- `packages/core/skills/plan/SKILL.md` step 8: append ``Then run `accord worktree push <id>`.`` after ``checks for it.``. The re-plan path reaches it, since a re-plan runs step 8 again.
- `packages/core/skills/build/SKILL.md` step 3, the bullet that writes the ledger line: its sentence ending ``then commit the ticket together with `accord/tickets/<id>/ledger.md`.`` ends instead ``then commit the ticket together with `accord/tickets/<id>/ledger.md`, then run `accord worktree push <id>`.`` Step 3 runs before step 2 dispatches the next task, so the push lands before the next task starts.
- Plan and build carry no "go on" phrase, because of the byte cap: the command exits 0 and its failure line says the commits stay local until the next push.
- `packages/core/skills/build/SKILL.md` step 6: ``on yes run `accord approve <id>`, then `accord-plan`'s re-plan`` becomes ``on yes run `accord approve <id>`, commit the ticket and run `accord worktree push <id>`, then `accord-plan`'s re-plan``; the rest of the sentence is unchanged. A failed push there is carried by the re-plan's own push at plan step 8.

**Size caps.** The rendered plan and build SKILL.md files sit close to the 5120-byte cap that `packages/core/test/skills.test.ts` checks (`every SKILL.md is at most MAX_SKILL_BYTES bytes`): before this task `.claude/skills/accord-plan/SKILL.md` is 5061 bytes and `.claude/skills/accord-build/SKILL.md` is 5010 bytes, so add no word beyond the text above and rewrap only the lines an edit touches. After the re-render, run that test before anything else. If any of the four files is over the cap, do not reword, shorten or move any other text: stop and report `BLOCKED` with each file's byte count and the cap.

**Re-render**, in this order (conventions.md): `npm run gen`, then `npm run build`, then `node packages/cli/dist/cli.js skills sync`. Commit the four sources, `packages/core/src/generated/skills.ts` and the four `.claude/skills/accord-*/SKILL.md` copies the sync rewrites. If gen or sync changes any other file, report it.

Behaviour that must not change: every phrase `stage-skills.test.ts` already requires, including `REQUIRED.build` (`change note`, `accord approve`, `accord-plan`) and the step-3 order test `risk:complex-branching the build skill routes a task-done refusal over a forbidden commit line`; the review, verify, debug and accord skills byte for byte; the 120-line and 5120-byte caps in `packages/core/test/skills.test.ts`.

Consumes: `accord worktree push <id>` from Task 1. Produces: the five skill clauses that run it.

Done when `packages/core/test/stage-skills.test.ts`, `packages/core/test/skills.test.ts` and `packages/cli/test/skill-commands.test.ts` pass after the re-render.

## Task 3: Prove each stage change before build reaches another clone

covers: @ac-2, D-04
files: packages/cli/test/worktree-push.test.ts (new), packages/cli/src/commands/worktree.ts
verify: packages/cli/test/worktree-push.test.ts#ac-2-each-stage-change-before-build-pushed-with-accord-worktree-push-shows-the-same-stage-in-another-clone (@ac-2)

**Test first**, in `packages/cli/test/worktree-push.test.ts`, title `ac-2 each stage change before build pushed with accord worktree push shows the same stage in another clone`. It should pass on Task 1's code; if a step fails, fix `worktreePush` in `packages/cli/src/commands/worktree.ts`, keeping its contract: exit 0 always for a valid id, `pushed: <branch>\n` on success, and on failure `push of <branch> failed; its commits stay local until the next push\n` followed by git's trimmed stderr (or `no answer within <n> seconds` when the time limit killed git) and `\n`.

Follow the same test rules as the ac-1 test in that file: a title with no `@`, no comma and no apostrophe, in a top-level `it(...)`; `commitMsg` from `packages/cli/test/helpers/repo.ts` for every commit (never `-m`, no trailer), `run(argv, cwd)` in-process, `makeClone()` with `c.cleanupAll()` in a `finally`, and a `120_000` timeout. Reuse the helpers Task 1 put at the top of the file: `claimed(c)` (adds the worktree `c.sibling('ST-9')` on a new branch `t/ST-9` from `origin/main`, commits `src/export.ts` as `claim: ST-9` and pushes it), `head(dir)`, `onOrigin(c)` (the sha of `refs/heads/t/ST-9` in `c.remote`) and `row(dir)` (the `{ stage, tasksDone, tasksTotal }` of `ST-9` from `accord dashboard --json` run in `dir`), and `PLAN` from `../../../test/helpers/lane.js`.

Setup: `c = makeClone()`; `wt = claimed(c)`; `o = c.otherClone()`. Then three steps, each made and committed first, then pushed, then checked:
1. Intent approved: in `wt`, replace `Owners can export their report as CSV.` with `Owners can export their report as a CSV file.` in `accord/tickets/ST-9.md`; `commitMsg(wt, 'intent: ST-9 approved by the owner: "yes"')`. Run `run(['worktree', 'push', 'ST-9'], wt)`: exit 0, out `pushed: t/ST-9\n`. Assert `onOrigin(c)` equals `head(wt)`; `gitRun(o, 'fetch', '-q', 'origin')`; `await row(o)` equals `await row(wt)` and its `stage` is `intent`.
2. Approach approved: `run(['approve', 'ST-9'], wt)` and `run(['gate', 'ready', 'ST-9'], wt)` exit 0; `commitMsg(wt, 'approach: ST-9 approved by the owner: "yes"')`. Fetch `o` and assert its row's `stage` is still `intent` (the commit is not on origin yet). Run the push from the main checkout, `run(['worktree', 'push', 'ST-9'], c.root)`, which proves the branch ref is pushed from any worktree: exit 0, out `pushed: t/ST-9\n`. Assert `onOrigin(c)` equals `head(wt)`; fetch `o`; rows equal and `stage` is `plan`.
3. Plan through its gate: `baseline = head(wt)`; write `accord/tickets/ST-9/plan.md` = `PLAN.replace('abc1234', baseline)`; `run(['gate', 'plan', 'ST-9'], wt)` exits 0; `commitMsg(wt, 'plan: ST-9 ready')`. Fetch `o` and assert its row's `stage` is still `plan`. Push from `wt`: exit 0, out `pushed: t/ST-9\n`. Assert `onOrigin(c)` equals `head(wt)`; fetch `o`; rows equal and equal `{ stage: 'build', tasksDone: 0, tasksTotal: 2 }`.

Behaviour that must not change: Task 1's test and everything Task 1 lists.

Consumes: `accord worktree push` from Task 1. Produces: the @ac-2 proof.

## Task 4: Prove a failed push is reported, exits 0, and the next push carries every commit

covers: @ac-3
files: packages/cli/test/worktree-push.test.ts (new), packages/cli/src/commands/worktree.ts
verify: packages/cli/test/worktree-push.test.ts#ac-3-a-failed-push-exits-0-with-the-failure-line-and-the-git-message-and-the-next-push-carries-every-commit (@ac-3), packages/cli/test/worktree-push.test.ts#risk:complex-branching-a-push-with-no-answer-within-the-time-limit-is-killed-and-named

**Tests first**, in `packages/cli/test/worktree-push.test.ts`. Both should pass on Task 1's code; if a case fails, fix `worktreePush` in `packages/cli/src/commands/worktree.ts`, keeping its contract: exit 0 always for a valid id, `pushed: <branch>\n` on success, and on failure `push of <branch> failed; its commits stay local until the next push\n` followed by git's trimmed stderr (or `no answer within <ms / 1000> seconds` when `fetchLimitMs()` ran out, error code `ETIMEDOUT`) and `\n`, nothing on stderr. `FAILED` is the string `push of t/ST-9 failed; its commits stay local until the next push`.

Follow the same test rules as the ac-1 test in that file: titles with no `@`, no comma and no apostrophe, in top-level `it(...)` calls; `commitMsg` and `mergeMsg` from `packages/cli/test/helpers/repo.ts` for every commit and merge (never `-m`, no trailer), `run(argv, cwd)` in-process, `makeClone()` with `c.cleanupAll()` in a `finally`, and a `120_000` timeout. Reuse the helpers Task 1 put at the top of the file: `claimed(c)` (adds the worktree `c.sibling('ST-9')` on a new branch `t/ST-9` from `origin/main`, commits `src/export.ts` as `claim: ST-9` and pushes it), `head(dir)` and `onOrigin(c)` (the sha of `refs/heads/t/ST-9` in `c.remote`).

`ac-3 a failed push exits 0 with the failure line and the git message and the next push carries every commit`, two cases, each its own `makeClone()`:
1. Unreachable remote. `wt = claimed(c)`; `claimTip = onOrigin(c)`. `c.git('remote', 'set-url', 'origin', c.remote + '-missing')`. Make a stage change: `run(['approve', 'ST-9'], wt)` and `run(['gate', 'ready', 'ST-9'], wt)` exit 0, `a = commitMsg(wt, 'approach: ST-9 approved')`. `r = await run(['worktree', 'push', 'ST-9'], wt)`: assert `r.code` 0, `r.err` `''`, `r.out` starts with `FAILED + '\n'`, the rest of `r.out` contains `does not appear to be a git repository`, `head(wt)` is still `a` and `onOrigin(c)` is still `claimTip`. Make a second commit while the remote is still unreachable (write `notes.txt`, `b = commitMsg(wt, 'b')`), push again and assert the same failure output. Repair with `c.git('remote', 'set-url', 'origin', c.remote)`, make a third commit `d`, push: exit 0, out `pushed: t/ST-9\n`, and `onOrigin(c)` equals `d`; assert `gitRun(c.remote, 'merge-base', '--is-ancestor', x, 'refs/heads/t/ST-9')` succeeds for `x` of `a` and `b`.
2. Rejected push. `wt = claimed(c)`; `o = c.otherClone()`; `gitRun(o, 'switch', 't/ST-9')`, write `teammate.txt`, `mate = commitMsg(o, 'teammate')`, `gitRun(o, 'push', '-q', 'origin', 't/ST-9')`. In `wt` write `mine.txt`, `m = commitMsg(wt, 'mine')`, push with `run(['worktree', 'push', 'ST-9'], wt)`: assert code 0, err `''`, out starts with `FAILED + '\n'` and contains `[rejected]`, and `onOrigin(c)` is still `mate`. Repair: `gitRun(wt, 'fetch', '-q', 'origin')`, `mergeMsg(wt, 'origin/t/ST-9', 'merge teammate')`, push again: exit 0, out `pushed: t/ST-9\n`, `onOrigin(c)` equals `head(wt)`, and `m` is an ancestor of it on the remote.

`risk:complex-branching a push with no answer within the time limit is killed and named`: follow `packages/cli/test/worktree.test.ts` lines 2025-2042, with push in place of fetch. At the top of `worktree-push.test.ts` add the same `vi.mock('../src/commands/fetch-limit.js', ...)` block as `worktree.test.ts` lines 16-20 (import `* as limit` and `vi`). `wt = claimed(c)` (the claim push runs before the hang is set up); commit a change in `wt`. With `release = \`${c.root}/.git/hang-release\`` and `ended = \`${c.root}/.git/hang-ended\``, set `c.git('config', 'remote.origin.receivepack', \`cd / && i=0; while [ ! -f '${release}' ] && [ $i -lt 60 ]; do sleep 1; i=$((i+1)); done; : > '${ended}'; :\`)` and `vi.mocked(limit.fetchLimitMs).mockReturnValueOnce(2000)`. Run the push from `wt`, timing it: assert exit 0, elapsed below 15000 ms, and `out` equal to `FAILED + '\nno answer within 2 seconds\n'`. In `finally`, write `release`, then wait up to 10 seconds for `ended` to exist, as lines 2039-2041 do, before `c.cleanupAll()`.

Behaviour that must not change: Tasks 1 and 3 tests and everything Task 1 lists.

Consumes: `accord worktree push` from Task 1. Produces: the @ac-3 proof and the proof of the time-limit line.

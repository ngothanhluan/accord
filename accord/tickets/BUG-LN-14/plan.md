---
baseline: ec05e9f93dd3663d339512af61cbf0f6511273f0
plan_hash: "fnv1a64:df99f40a35a38856"
---

# Plan: BUG-LN-14

Review mode `outcome`: one branch, no slices.

Order: Task 1 runs the probe the Approach's risk (1) asks for, on a real /clear, before any code is written; when
it passes, Task 1 writes the failing reproduction of @ac-1 and the wiring that fixes it: the session-resume hook
releases, on `source: clear`, every hold this window's claude process took. Task 2 proves the window then takes
one other ticket (@ac-2) and that a second window never releases the first one's hold (@ac-3). Task 3 adds D-06
(a /clear in the held ticket's own worktree keeps that ticket, @ac-5) and the /resume rule of the ledger. Task 4
records the folder with each hold and makes the refusal print it and the local time (@ac-4).

Rules for every task:
- Commits carry no trailer: no `Co-Authored-By:` line, no other line whose first word ends in `-by:`, and no line
  containing "Generated with" (`accord/product/conventions.md`).
- Test ids: every new test is a top-level `it(...)` in `packages/cli/test/worktree.test.ts`, with no `describe`
  around it. Its report id is `packages/cli/test/worktree.test.ts#` followed by the title with each whitespace run
  turned into `-`. A title holds no `@`, no comma and no apostrophe. No existing test is renamed.
- Tests use the helpers already at the top of `packages/cli/test/worktree.test.ts`: `copy(opts)` (a copy of a
  prebuilt template; its opts must be one of `TEMPLATE_OPTS`, lines 35-48), `A` (`pid 7001, start 'S-A', marker
  'sess-A'`), `B` (`pid 7002, start 'S-B', marker 'sess-B'`), `envOf`, `tableOf`, `setTable`, `holdsFile`, `HELD`
  (lines 232-242), `DEAD`, `LIVE`, `writeHolds`, `readHolds`, `lines` (lines 393-400), and `run(argv, cwd, env,
  stdin)` from `./helpers/repo.js`. `afterEach` already resets the process table mock and unstubs every env.
  `readHolds(c)` returns `Record<string, unknown>`: where this plan writes `readHolds(c)['ST-9'].marker`, write
  `(readHolds(c)['ST-9'] as { marker: string }).marker` as the existing tests do, and spread an entry as
  `...(readHolds(c)['ST-9'] as object)`.
- A window after /clear is the same claude process with a new conversation id: in a test it is
  `const A2 = { ...A, marker: 'sess-A2' }` (same pid and start as `A`). A /clear is driven as
  `run(['hook', 'session-resume'], cwd, envOf(A2), JSON.stringify({ session_id: 'sess-A2', cwd, source: 'clear' }))`,
  as the existing test `risk:complex-branching the resume hook in the main checkout prints the enter line of the
  held worktree and no anchor from main` (line 1459) drives session-resume. `T` is `'2026-10-27T03:03:00.000Z'`.
  Task 1 adds `const T = '2026-10-27T03:03:00.000Z';` and `const A2 = { ...A, marker: 'sess-A2' };` at top level
  of the file, right before its first new test; Tasks 2 to 4 reuse them and define no second copy.
- A hold of window `A` written by hand is `{ tool: 'Claude Code', ...A, taken: T }`. When a test runs a command
  with no fetch, it first runs `c.git('remote', 'remove', 'origin')`, as the existing hold tests do (H7).
- Every test that runs a `worktree open` passes `120_000` as the third argument of `it`.
- Run one test file with `npx vitest run packages/cli/test/worktree.test.ts`. CLI tests import core from
  `packages/core/dist`; run `npm run build` once before the first test run. End every task with `npm run build`,
  `npm run lint` and `npm run typecheck`, then the whole of `packages/cli/test/worktree.test.ts` and
  `packages/cli/test/hook.test.ts`.
- Nothing adds a CLI option or flag (D-03), and nothing changes the registered hooks: `.claude/settings.json` and
  `packages/core/src/scaffold/hooks.ts` are not touched. The holds file gains only the optional `folder` field
  (Task 4).
- Every line the CLI prints or stores turns `\` into `/`.

## Task 1: Probe a real /clear, then reproduce and fix the hold a /clear leaves behind

covers: @ac-1, D-01, D-02, D-04
files: packages/cli/src/commands/hook.ts, packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-1-a-clear-in-a-window-outside-the-ticket-worktree-removes-the-hold-its-old-conversation-took-and-another-session-continues-the-ticket (@ac-1), packages/cli/test/worktree.test.ts#risk:data-loss-a-clear-whose-window-the-process-table-does-not-show-releases-nothing-and-says-so-on-stdout

### Part A: the probe, before any code

The whole fix rests on facts nobody has checked (Approach risk (1), ledger Ruling): that a Claude Code hook
process gets `CLAUDE_PID`, `CLAUDE_CODE_SESSION_ID` and `CLAUDECODE=1` in its environment, that the SessionStart
input on a /clear carries `source: "clear"` and a new `session_id`, that `CLAUDE_PID` is the same window process
before and after the /clear, and that a command the new conversation runs sees the new conversation id (the works
rule reads `CLAUDE_CODE_SESSION_ID`, so an old id there would refuse @ac-2's claim through the worked record). Only
the owner can type /clear, so this part has two dispatches.

First dispatch, when `node_modules/.cache/accord-probe/out.jsonl` does not exist:
1. If `.claude/settings.local.json` exists, copy its bytes to
   `node_modules/.cache/accord-probe/settings.local.json.orig` first. Then write `.claude/settings.local.json` as
   the file below; when the original existed, write the original object with this `hooks.SessionStart` entry added
   to whatever `SessionStart` list it holds.

   ```json
   {
     "hooks": {
       "SessionStart": [
         {
           "matcher": "startup|clear",
           "hooks": [
             { "type": "command", "command": "node C:/Work/accord-bug-ln-14/node_modules/.cache/accord-probe/probe.mjs" }
           ]
         }
       ]
     }
   }
   ```

2. Write `node_modules/.cache/accord-probe/probe.mjs` (`node_modules/` is ignored by git). It writes nothing to
   stdout and always exits 0. It reads stdin to the end (`readFileSync(0, 'utf8')`, an empty string on error) and
   parses it as JSON (a failed parse keeps `{ raw: <text> }`). It reads the process table the way
   `packages/cli/src/load/proc.ts` `processTable()` does: on win32
   `powershell -NoProfile -NonInteractive -Command "[Console]::OutputEncoding = [Text.Encoding]::UTF8; ConvertTo-Json -Compress -InputObject @(Get-CimInstance Win32_Process | ForEach-Object { [pscustomobject]@{ pid = [int]$_.ProcessId; ppid = [int]$_.ParentProcessId; name = $_.Name } })"`
   through `execFileSync` with a 64 MiB `maxBuffer`, elsewhere `ps -A -o pid= -o ppid= -o comm=`; a failure keeps
   `rows = []` and the error text. From `process.pid` it walks parents (at most 20 steps, stopping at a pid with
   no row or a repeated pid) into `chain`, a list of `{ pid, name }`. It appends one JSON line to
   `node_modules/.cache/accord-probe/out.jsonl` (absolute path, folder created first):
   `{ at, source, session_id, cwd, CLAUDE_PID, CLAUDE_CODE_SESSION_ID, CLAUDECODE, pid, chain, claudeRow, tableError }`,
   where the three variables are read from `process.env` (`null` when unset) and `claudeRow` is the row whose pid
   equals `Number(CLAUDE_PID)`, or `null`.
3. Do not commit either file. Return `NEEDS_CONTEXT` with this question for the owner, word for word:

   > To check that the /clear fix can see which Claude Code window ran /clear, a temporary hook now records what
   > Claude Code hands its hooks. It is in `C:\Work\accord-bug-ln-14\.claude\settings.local.json`, is not
   > committed, and is removed right after. Please:
   > 1. Open a new terminal, run `cd C:\Work\accord-bug-ln-14`, then `claude`. Do not use the window this
   >    session runs in: a /clear there would wipe this session. If Claude Code asks whether to allow the
   >    hooks of this folder, allow them. A line such as "no hold taken on BUG-LN-14" may appear; ignore it.
   > 2. Type `hello` and wait for the answer.
   > 3. Type `/clear`.
   > 4. Type: `Run this exact command with the Bash tool and show me its output: node -e "console.log(process.env.CLAUDE_CODE_SESSION_ID + ' ' + process.env.CLAUDE_PID)"`
   > 5. Paste the line that command printed into your answer here, then close that window.

Second dispatch, with the owner's answer, when `out.jsonl` exists:
4. Let `S` be the last record with `source` `startup` and `K` the last with `source` `clear`. When either is
   missing, return `NEEDS_CONTEXT` with the same question once more (the window was opened before the entry was
   written, or a step was skipped); on a third dispatch with one still missing, go to step 6 and then return
   `BLOCKED`.
5. The probe passes when every check holds:
   (a) `K.session_id` is a non-empty string and differs from `S.session_id`;
   (b) `K.CLAUDECODE` is `'1'`, `K.CLAUDE_CODE_SESSION_ID` is non-empty, and `K.CLAUDE_PID` matches `^[1-9][0-9]*$`;
   (c) `K.CLAUDE_PID` equals `S.CLAUDE_PID` (the /clear keeps the window process);
   (d) `K.chain` holds a pid equal to `Number(K.CLAUDE_PID)`, or the chain stops at a pid with no row and
       `K.claudeRow` is not `null` (the same shortcut `sessionIn` takes for the Windows gap, `proc.ts` lines 87-88);
   (e) the owner's pasted line is two words: the first equals `K.session_id`, the second equals `K.CLAUDE_PID`.
   Note in the report, without failing on it, whether `K.CLAUDE_CODE_SESSION_ID` equals `K.session_id` or
   `S.session_id`: the code below takes the new id from the hook's stdin `session_id`, so either works.
6. Clean up, pass or fail: delete `.claude/settings.local.json`, or write back the bytes of
   `settings.local.json.orig` when it was saved; then delete the folder `node_modules/.cache/accord-probe`.
   `git status --porcelain` must show neither path. Declare both paths in the report as touched outside the plan:
   temporary probe files, removed.
7. When any check fails, write no code: return `BLOCKED` with `the approach goes back to the architect`, the check
   that failed, and the values of `S` and `K` (all fields except `chain`, plus the pid list of `chain`). When all
   pass, put the values of (a) to (e) in the report's `passing:` line and go on to Part B.

### Part B: the failing reproduction, then the release

Tests first, appended to `packages/cli/test/worktree.test.ts`. Run them at the baseline code and show both failing.
- `it('ac-1 a clear in a window outside the ticket worktree removes the hold its old conversation took and another session continues the ticket')`:
  1. `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `sib = c.sibling('ST-9')`,
     `c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main')`, then remove origin.
  2. `writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': DEAD })`: window A's hold, and a
     hold another window left before this fix (D-04).
  3. `setTable(tableOf(A))`. The /clear of window A in `c.root` (the main checkout, not ST-9's worktree) with
     `A2`: exit 0, `out` starts `# accord rules\n`. Right after it, `Object.hasOwn(readHolds(c), 'ST-9')` is
     false and `readHolds(c)['ST-10']` equals `DEAD`.
  4. `setTable(tableOf(B, A))` (window A still runs). `run(['worktree', 'open', 'ST-9', '--continue'], c.root,
     envOf(B))` exits 0, its `err` does not contain `held by another session`, `lines(out)` equals
     `[`enter: ${sib}`]`, and `readHolds(c)['ST-9'].marker` is `sess-B`.
  At the baseline it fails at step 3: the hook keeps the hold.
- `it('risk:data-loss a clear whose window the process table does not show releases nothing and says so on stdout')`:
  `c = copy()`, `writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } })`, `bytes` = the holds file.
  (a) `setTable([{ pid: process.pid, ppid: 1, start: 'self' }])`; the /clear with `A2` from `c.root` exits 0, `err`
  is `''`, `out` starts `# accord rules\n`, `lines(out)` has a line starting
  `accord: no hold released: cannot see this Claude Code session`, and the holds file equals `bytes`.
  (b) The same /clear with env `{ CLAUDECODE: '1' }`: exit 0, a line starting
  `accord: no hold released: this Claude Code session sets no`, holds equal `bytes`.
  (c) With env `{}` (another tool): exit 0, no line contains `no hold released`, holds equal `bytes`.
  At the baseline it fails on the missing lines.

Interface, `packages/cli/src/commands/worktree.ts`, placed right after `takeHold`:

```ts
/** BUG-LN-14 D-02: drop every hold the claude process `session` took (same pid and start), under the holds lock; no write when none is dropped. */
export function releaseHolds(root: string, session: { pid: number; start: string }): void
```

It runs inside `withHolds(root, ...)`, never as a separate read and write (ledger Ruling, failure scenario C).
An entry is dropped when `h.pid === session.pid && h.start === session.start`; every other entry, including any
hold of another process, live or dead, stays byte for byte (D-04). When nothing is dropped the callback returns
`undefined`, so the file is not rewritten.

Interface, `packages/cli/src/commands/hook.ts`:
- `hookInput` also keeps `source`: its return type gains `source?: string` and its key list gains `'source'`.
- A new function, called in the `session-resume` branch right after `recordResume(ctx)`:

  ```ts
  /** BUG-LN-14: a /clear frees the holds this window's claude process took; returns '' or one line saying why nothing was released. */
  function releaseOnClear(ctx: CommandContext): string
  ```

  Inside one `try`: `input = hookInput(ctx)`; return `''` unless `input?.source === 'clear'`. `claude =
  claudeEnv(ctx.env)` (it throws for `CLAUDECODE=1` without the two variables); return `''` when it is
  `undefined`. `root = input.cwd !== undefined ? repoRoot(input.cwd) : ctx.root`. `session = sessionIn(claude,
  processTable(), process.pid)`, then `releaseHolds(root, session)`, then return `''`. Any throw returns
  `` `accord: no hold released: ${first line of the message}`.replace(/\\/g, '/') + '\n' ``. Import `processTable`
  and `sessionIn` from `../load/proc.js` beside `claudeEnv`, and `releaseHolds` from `./worktree.js`.
- The returned line goes on stdout after the ruleset and before the body:
  `ctx.stdout.write(rules + '\n' + note + body)`, with `note` the value returned (`''` for every other event). So
  the last line is still the anchor, the `enter:` line or the session line.

Behaviour that must not change: `session-start`, `subagent-start` and `prompt-expansion` output; `session-resume`
for `source` `resume` or `compact` and with no stdin (this task releases only on `clear`); `recordResume`,
`heldEntry`, `startHold`; `takeHold`, `withHolds`, `readHoldsFile` and the worked record. The existing tests at
lines 1427, 1459 and 1562 of `worktree.test.ts` and every case of `packages/cli/test/hook.test.ts` stay green
untouched.

Consumes: `withHolds`, `claudeEnv`, `sessionIn`, `processTable`, `hookInput`. Produces: `releaseHolds` and
`releaseOnClear`, which Task 3 extends, and the `source` field of `hookInput`.

## Task 2: After a /clear the window takes one other ticket, and a second window never releases the first one's hold

covers: @ac-2, @ac-3, D-01, D-02
files: packages/cli/test/worktree.test.ts, packages/cli/src/commands/hook.ts, packages/cli/src/commands/worktree.ts
verify: packages/cli/test/worktree.test.ts#ac-2-after-a-clear-the-window-claims-one-other-ticket-and-holds-only-that-one (@ac-2), packages/cli/test/worktree.test.ts#ac-3-a-start-or-a-clear-in-a-second-window-in-the-ticket-worktree-leaves-the-first-window-hold-in-place (@ac-3)

Both tests should pass on Task 1's code. Show each run. When a step fails, fix `releaseOnClear` in `hook.ts` or
`releaseHolds` in `worktree.ts`, keeping Task 1's contract: on `source: clear`, every hold whose pid and start
equal this window's claude process is dropped under the holds lock; no other hold is touched; a failure is one
`accord: no hold released: ...` line on stdout.

Tests, appended to `packages/cli/test/worktree.test.ts`:
- `it('ac-2 after a clear the window claims one other ticket and holds only that one')`, with `120_000`. Keep
  origin: the claim cuts its branch from `origin/main`.
  1. `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `sib = c.sibling('ST-9')`,
     `c.git('worktree', 'add', '-q', '-b', 't/ST-9', sib, 'origin/main')`.
  2. `writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } })` and
     `writeFileSync(`${c.root}/.git/accord/worked`, 'ST-9\tsess-A\n')` (the record a hold leaves for the old
     conversation).
  3. `setTable(tableOf(A))`; the /clear with `A2` from `c.root` exits 0.
  4. `r = await run(['worktree', 'open', 'ST-10'], c.root, envOf(A2))`: exit 0, `r.err` contains neither
     `this session works` nor `held by another session`, and `lines(r.out).at(-1)` is
     `` `enter: ${c.sibling('ST-10')}` ``.
  5. `Object.keys(readHolds(c))` equals `['ST-10']` and `readHolds(c)['ST-10'].marker` is `sess-A2`.
- `it('ac-3 a start or a clear in a second window in the ticket worktree leaves the first window hold in place')`,
  with `120_000`.
  1. `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `sib = c.sibling('ST-9')`, add the worktree as above, remove
     origin, `mkdirSync(`${sib}/sub`)`.
  2. `writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T } })`; `bytes` = the holds file.
     `setTable(tableOf(B, A))`: both windows run.
  3. Window B starts a conversation in the worktree:
     `run(['hook', 'session-start'], sib, envOf(B), JSON.stringify({ session_id: 'sess-B', cwd: sib, source: 'startup' }))`
     exits 0 and the holds file equals `bytes`.
  4. `B2 = { ...B, marker: 'sess-B2' }`; window B runs /clear in a folder below the worktree:
     `run(['hook', 'session-resume'], sib, envOf(B2), JSON.stringify({ session_id: 'sess-B2', cwd: `${sib}/sub`, source: 'clear' }))`
     exits 0 and the holds file equals `bytes`.
  5. `run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(B2))` exits 2 with `err` containing
     `ST-9 is held by another session` and `sess-A`, and `readHolds(c)['ST-9'].marker` is still `sess-A`.

Behaviour that must not change: everything Task 1 lists, and Task 1's tests.

Consumes: `releaseOnClear` and `releaseHolds` from Task 1. Produces: the @ac-2 and @ac-3 proofs.

## Task 3: A /clear in the held ticket's own worktree keeps that ticket, and a /resume keeps the resumed conversation's hold

covers: @ac-5, D-06, D-01
files: packages/cli/src/commands/hook.ts, packages/cli/src/commands/worktree.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-5-a-clear-in-the-held-ticket-worktree-moves-its-hold-to-the-new-conversation-and-releases-the-window-other-holds (@ac-5), packages/cli/test/worktree.test.ts#risk:complex-branching-a-resume-to-another-conversation-keeps-only-the-hold-that-conversation-took-and-a-compact-releases-nothing

D-06: a window that stands in the worktree folder of a ticket it holds (that folder or any folder below it) keeps
that ticket on /clear; its hold moves to the new conversation's id, and only its holds on other tickets are
released. Ledger Ruling: a /resume to another conversation releases this window's holds as /clear does, except the
hold the resumed conversation itself took and, as for /clear, the ticket whose worktree the window stands in. A
/compact keeps the same conversation and releases nothing.

Tests first, appended to `packages/cli/test/worktree.test.ts`; run them on Task 1's code and show both failing.
- `it('ac-5 a clear in the held ticket worktree moves its hold to the new conversation and releases the window other holds')`,
  with `120_000`.
  1. `c = copy({ tickets: ['ST-9', 'ST-10'] })`, `sib = c.sibling('ST-9')`, add the worktree as in Task 1,
     remove origin, `mkdirSync(`${sib}/sub`)`.
  2. `writeHolds(c, { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': { tool: 'Claude Code', ...A, taken: T } })`.
  3. `setTable(tableOf(A))`; the /clear with `A2` and stdin `cwd` `` `${sib}/sub` `` (run with cwd `sib`) exits 0.
     `Object.keys(readHolds(c))` equals `['ST-9']`, and `readHolds(c)['ST-9']` matches
     `{ marker: 'sess-A2', pid: 7001, start: 'S-A', taken: T }`.
  4. `run(['worktree', 'open', 'ST-9', '--continue'], sib, envOf(A2))` exits 0 with `out` equal to `HELD`.
  5. `setTable(tableOf(B, A))`; `run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B))` exits 2 with
     `err` containing `ST-9 is held by another session` and `sess-A2`.
  On Task 1's code it fails at step 3: ST-9 is released.
- `it('risk:complex-branching a resume to another conversation keeps only the hold that conversation took and a compact releases nothing')`:
  `c = copy()`, `A3 = { ...A, marker: 'sess-A3' }`, `both = { 'ST-9': { tool: 'Claude Code', ...A, taken: T }, 'ST-10': { tool: 'Claude Code', ...A3, taken: T } }`,
  `setTable(tableOf(A))`. `resumeTo(s, source)` is
  `run(['hook', 'session-resume'], c.root, envOf(s), JSON.stringify({ session_id: s.marker, cwd: c.root, source }))`.
  (a) `writeHolds(c, both)`; `resumeTo(A3, 'resume')` exits 0; `Object.keys(readHolds(c))` equals `['ST-10']` and
  its marker is `sess-A3`.
  (b) `writeHolds(c, both)`, `bytes` = the holds file; `resumeTo(A, 'compact')` exits 0 and the holds file equals
  `bytes`.
  On Task 1's code it fails at (a): a resume releases nothing.

Interface, `packages/cli/src/commands/worktree.ts`: `releaseHolds` becomes

```ts
/** BUG-LN-14 D-02, D-06: drop the holds the claude process `session` took, except the one `marker` holds; the hold of `stay` moves to `marker`. */
export function releaseHolds(root: string, session: { pid: number; start: string }, marker: string, stay: string | undefined): void
```

Inside the same single `withHolds` call, for each entry `[id, h]`: an entry of another process
(`h.pid !== session.pid || h.start !== session.start`) stays unchanged; an entry with `h.marker === marker` stays
unchanged; an entry with `id === stay` becomes `{ ...h, marker }` (its `taken`, and the `folder` Task 4 adds, are
kept); every other entry of this process is dropped. No write when nothing changed.

Interface, `packages/cli/src/commands/hook.ts`:
- Rename `releaseOnClear` to `releaseOnNewConversation`. It acts when `input?.source` is `clear` or `resume`, and
  returns `''` for any other source.
- `marker = input.session_id || claude.marker`.
- `stay`: when `isLinked(root)`, the ticket of `currentBranch(root)` through `ticketOfBranch(branch,
  ctx.snapshot.branchTemplates ?? [DEFAULT_BRANCH_TEMPLATE], (i) => Object.hasOwn(ctx.snapshot.tickets, i))`,
  else `undefined`. `recordResume` and `startHold` compute the same id the same way; you may move that lookup
  into one helper in `hook.ts` that all three call, with no change to what the two existing functions do.
- Call `releaseHolds(root, session, marker, stay)`. The failure line and its place on stdout stay as Task 1 made
  them.

Behaviour that must not change: Tasks 1 and 2 and their tests; on `clear` a window outside the held ticket's
worktree still releases all its holds; `heldEntry` still runs after the release, so a resumed conversation in the
main checkout that holds a ticket with a worktree still gets the `enter:` line (the test at line 1459 stays
green); the existing test at line 1562 (a resume in a worktree whose hold another live process owns) keeps its
holds bytes and an empty `err`.

Consumes: `releaseHolds` and `releaseOnClear` from Task 1. Produces: the @ac-5 proof and the /resume rule.

## Task 4: Record the folder with each hold, and have the refusal name it and the local time of the hold

covers: @ac-4, D-03, D-04, D-05
files: packages/cli/src/load/proc.ts, packages/cli/src/commands/worktree.ts, packages/cli/src/commands/hook.ts, packages/cli/test/worktree.test.ts
verify: packages/cli/test/worktree.test.ts#ac-4-a-refusal-names-the-folder-and-the-local-time-with-its-offset-of-the-hold (@ac-4), packages/cli/test/worktree.test.ts#risk:parsing-a-hold-written-without-a-folder-is-refused-as-folder-not-recorded-with-its-local-time

The refusal today reads `<id> is held by another session: Claude Code session <marker> (pid <pid>) since
<ISO time> - work it there, or close that session first`. It becomes, exactly:
- with a folder: `<id> is held by another session: Claude Code session <marker> (pid <pid>) in <folder>, since <local time> - work it there, or close that session first`
- without one (a hold written before this fix, D-04, ledger Ruling): `<id> is held by another session: Claude Code session <marker> (pid <pid>), folder not recorded, since <local time> - work it there, or close that session first`

`<local time>` is D-05's form, `2026-10-27 10:03 (UTC+07:00)`: date, hours and minutes in the local time of the
machine that prints it, then the UTC offset with a sign and two-digit hours and minutes (`UTC+00:00` in UTC,
`UTC-05:00` west of it). No take-over option is added (D-03): the way out stays closing that window.

Tests first, appended to `packages/cli/test/worktree.test.ts`; run them at Task 3's code and show both failing.
- `it('ac-4 a refusal names the folder and the local time with its offset of the hold')`, with `120_000`.
  1. `vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh')`, then assert `new Date(T).getTimezoneOffset()` is `-420`, so a
     runtime that ignores the change fails here and not on the message.
  2. `c = copy()`, `sib = c.sibling('ST-9')`, add the worktree as in Task 1, remove origin.
  3. `setTable(tableOf(A))`; `run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(A))` exits 0 with
     `lines(out)` equal to `[`enter: ${sib}`]`; `readHolds(c)['ST-9'].folder` is `sib` (the worktree the session
     was told to enter, not the main checkout).
  4. `writeHolds(c, { 'ST-9': { ...(readHolds(c)['ST-9'] as object), taken: T } })`.
  5. `setTable(tableOf(B, A))`; `r = run(['worktree', 'open', 'ST-9', '--continue'], c.root, envOf(B))`: exit 2,
     `r.err` contains
     `` `ST-9 is held by another session: Claude Code session sess-A (pid 7001) in ${sib}, since 2026-10-27 10:03 (UTC+07:00) - work it there, or close that session first` ``
     and no `\`.
  6. `vi.stubEnv('TZ', 'America/Bogota')`; the same run exits 2 and `err` contains
     `since 2026-10-26 22:03 (UTC-05:00)`.
- `it('risk:parsing a hold written without a folder is refused as folder not recorded with its local time')`:
  `vi.stubEnv('TZ', 'Asia/Ho_Chi_Minh')`; `c = copy()`, `sib` and its worktree as above, remove origin;
  `writeHolds(c, { 'ST-9': LIVE })` (no `folder`, `taken` `2026-10-18T00:00:00.000Z`);
  `setTable(tableOf(B, { pid: 4242, start: 'S2' }))`. `run(['worktree', 'open', 'ST-9', '--continue'], sib,
  envOf(B))` exits 2 with `err` containing
  `Claude Code session sess-H (pid 4242), folder not recorded, since 2026-10-18 07:00 (UTC+07:00) - work it there`.
- The existing test `ac-4 a live holder refuses a second session and a dead holder is taken over` (line 244, title
  unchanged): its line `expect(r2.err).toContain(taken);` becomes
  `` expect(r2.err).toContain(`in ${sib}, since `); ``,
  `expect(r2.err).toMatch(/since \d{4}-\d{2}-\d{2} \d{2}:\d{2} \(UTC[+-]\d{2}:\d{2}\) - /);` and
  `expect(r2.err).not.toContain(taken);`. Nothing else in that test changes.

Interface, `packages/cli/src/load/proc.ts`:
- `export function localTime(iso: string): string`: `d = new Date(iso)`; when `d.getTime()` is `NaN`, return `iso`
  unchanged. Otherwise, with `p = (n) => String(n).padStart(2, '0')`, `off = -d.getTimezoneOffset()`,
  `a = Math.abs(off)`: return
  `` `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())} (UTC${off < 0 ? '-' : '+'}${p(Math.floor(a / 60))}:${p(a % 60)})` ``.
- `describeSession(h: { marker: string; pid: number; taken: string; folder?: string }): string` returns
  `` `Claude Code session ${h.marker} (pid ${h.pid})` `` followed by `` ` in ${folder}` `` when `h.folder` is a
  non-empty string (every `\` turned into `/`), else `, folder not recorded`, then `` `, since ${localTime(h.taken)}` ``.

Interface, `packages/cli/src/commands/worktree.ts`:
- `interface Hold extends Session { taken: string; folder?: string }`.
- `takeHold(ctx: CommandContext, id: string, path: string): void`, where `path` is the ticket's worktree. Ledger
  Ruling: the folder recorded is the worktree the session is told to enter when the hold is taken from the main
  checkout, otherwise the folder the command runs in, so `folder = (isLinked(ctx.root) ? ctx.root : path)` with
  every `\` turned into `/`. A new hold is `{ ...session, taken: new Date().toISOString(), folder }`. A hold this
  session already has (`sameSession`) keeps its `taken` and its `folder`, and gains `folder` only when it had
  none. The refusal throws
  `` `${id} is held by another session: ${describeSession(h)} - work it there, or close that session first` ``.
- Every call passes the worktree path: `hold()` passes its `path`, `enterOrStop` its `path`, the two calls in
  `worktreeOpen` (the branch path and the claim path) their `path`, `continueMerge` its `path`,
  `newTicketWorktree` its `path`.

Interface, `packages/cli/src/commands/hook.ts`: `startHold` calls `takeHold({ ...ctx, root }, id, root)`.

Behaviour that must not change: when a hold is taken, which session wins, the lock, `taken` kept for the same
session, the stderr line of the session-start hook (it still names the holder's marker), the `kept ...: held by
another session` lines of `worktree clean`, and Tasks 1 to 3 with their tests. An older accord reading a holds file
with `folder` ignores the field; nothing else in the file changes.

Consumes: `takeHold` and its call sites, `describeSession`. Produces: the `folder` field and the refusal of @ac-4.

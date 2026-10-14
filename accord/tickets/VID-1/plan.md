---
baseline: 94641301972e4277b38d36716525ebeb08158e35
plan_hash: "fnv1a64:c5bcfa6ebda5355b"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<file>#<test name>` with each whitespace run turned into `-`. Every new test
below is a top-level `it(...)` with no `describe` wrapper, whose name starts with its criterion (`ac-n`, no
leading `@`) when its verify id maps a scenario, and otherwise with `risk:<kind>`, the kind from the reviewer's
list. A test name never holds `@` or a comma. CLI tests import core from `packages/core/dist`, so every task that
changes core source runs `npm run build` before a CLI test, and the CLI that records tasks is
`node packages/cli/dist/cli.js`. Agent sources render through `npm run gen`, then `npm run build`, then
`node packages/cli/dist/cli.js skills sync`.

## Task 1: Wiring: gate plan rejects a verify id holding an at sign
covers: @ac-1, @ac-2, D-01, D-02, D-03
files: packages/core/src/load/work.ts, packages/core/src/gate/plan.ts, packages/core/src/gate/rules.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-1-gate-plan-fails-on-a-verify-id-whose-test-name-holds-an-at-sign (@ac-1), packages/cli/test/lane-commands.test.ts#ac-2-gate-plan-fails-on-a-verify-id-whose-path-holds-an-at-sign (@ac-2)

Tests first, in `packages/cli/test/lane-commands.test.ts`, at the end of the file:
- A top-level helper, declared outside every `describe` (the `committed` helper sits inside one):
  `gatePlanWith(verify: string): Promise<{ code: number; out: string }>`. It runs `makeLaneRepo()`,
  `run(['approve', 'T-1'], repo)`, `commitAll(repo)` as `first`, writes `accord/tickets/T-1/plan.md` as `PLAN`
  (from `test/helpers/lane.ts`) with `abc1234` replaced by `first` and the line
  `verify: export#escapes-commas (@ac-2)` replaced by `verify` (task 2 keeps its `(@ac-2)` marker inside the
  given text), `commitAll(repo)`, then returns `run(['gate', 'plan', 'T-1'], repo)`; `cleanup(repo)` in a
  `finally`. Every other plan rule passes on this plan, as the existing `plan contract checks` tests show.
- `it('ac-1 gate plan fails on a verify id whose test name holds an at sign')`: with
  `verify: export#escapes-commas (@ac-2), src/x.test.ts#@test-ac-1-writes`, the result has code 1 and `out`
  contains `gate.plan-verify-at` and `src/x.test.ts#@test-ac-1-writes`, and some line of `out` starts with
  `accord/tickets/T-1/plan.md:` and contains `gate.plan-verify-at` (the text renderer prints
  `file[:line]: level rule reason`, so a finding filed under the verify id's path fails here).
- `it('ac-2 gate plan fails on a verify id whose path holds an at sign')`: the same with
  `packages/@scope/x.test.ts#writes`, the same file assertion included.
Show both failing (no such rule), then build and show them passing.

Code:
- `packages/core/src/load/work.ts`: export
  `fieldLines(lines: Line[]): Partial<Record<'covers' | 'files' | 'verify', { line: number; value: string }>>`,
  the parser's own field rule moved out of `parsePlan`: fences come from `scan(lines.map((l) => l.text).join('\n'),
  lines[0].line - 1).fences` (empty input gives `{}`); a line inside a fence is skipped; `LIST_MARKER` is stripped
  and the text trimmed; `FIELD` matches; the first line per field wins; `value` is `FIELD`'s second group. A
  fence cannot cross a `## ` heading, so fences scanned over one section's lines equal the body's fences for those
  lines. `parsePlan` builds its fields as `tokens(value)` from `fieldLines(s.lines)` and drops its own `inFence`
  and the `fences` binding. `Line` is imported from `../model/snapshot.js`; no exported model type changes and
  `packages/core/src/index.ts` is untouched.
- `packages/core/src/gate/plan.ts`: `verifyAt: GateRule['check']` takes the ticket id as its parameter `id`,
  as the other plan checks in this file do. For each task from `tasksOf`, it returns one draft per verify id
  `verifyId` in `task.verify` that includes `@` (markers never reach `verify`); the loop variable is named
  `verifyId`, never `id`, so it does not shadow the ticket id. Each draft has `file: planFile(id)` (the ticket's
  plan, `accord/tickets/<ticket id>/plan.md`), `line: fieldLines(task.lines).verify?.line ?? task.line`, and
  reason `task <n> verify id "<verifyId>" holds @, which splits its @test: tag; name the test and its path without @`.
- `packages/core/src/gate/rules.ts`: import `verifyAt`; add
  `{ id: 'gate.plan-verify-at', level: 'error', profiles: ['build', 'maintain'], check: verifyAt }` to
  `PLAN_RULES` directly after `gate.plan-deferral`, so `gate.tests-baseline-missing` stays the last row.

Must not change: every `parsePlan` result (`packages/core/test/work.test.ts` stays green unedited); the
deferral rule's reading of field lines; every existing `PLAN_RULES` row, its order, and its level; every
existing test in `lane-commands.test.ts` and `lane-plan.test.ts`.

## Task 2: Gate plan rejects a comma inside a verify id
covers: @ac-3, @ac-4, D-01, D-02, D-05
files: packages/core/src/gate/plan.ts, packages/core/src/gate/rules.ts, packages/cli/test/lane-commands.test.ts, packages/core/test/lane-plan.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-3-gate-plan-fails-on-a-comma-inside-a-verify-id (@ac-3), packages/core/test/lane-plan.test.ts#ac-4-a-marker-and-a-comma-between-ids-raise-neither-verify-id-error (@ac-4), packages/core/test/lane-plan.test.ts#risk:parsing-the-comma-check-reads-the-first-verify-line-outside-a-fence

Consumes `fieldLines` from Task 1. Tests first:
- `packages/cli/test/lane-commands.test.ts`:
  `it('ac-3 gate plan fails on a comma inside a verify id')`: `gatePlanWith` from Task 1 with
  `verify: export#escapes-commas (@ac-2), src/x.test.ts#refuses-x,-exit-2` gives code 1, and `out` contains
  `gate.plan-verify-comma` and `src/x.test.ts#refuses-x,-exit-2` whole, as written, and some line of `out`
  starts with `accord/tickets/T-1/plan.md:` and contains `gate.plan-verify-comma`.
- `packages/core/test/lane-plan.test.ts`, top level, using the file's `plan`, `base`, `reasons`, and `errors`:
  - `it('ac-4 a marker and a comma between ids raise neither verify id error')`: `PLAN` with
    `verify: export#writes-csv (@ac-1)` replaced by
    `verify: src/x.test.ts#writes (@ac-1), src/y.test.ts#risk:data-loss-quotes` gives
    `reasons(r, 'gate.plan-verify-at')` and `reasons(r, 'gate.plan-verify-comma')` both `[]`, and `errors(r)` `[]`.
    Positive control in the same test, so it observes the rule id: the same plan with the separating comma's
    space removed (`verify: src/x.test.ts#writes (@ac-1),src/y.test.ts#risk:data-loss-quotes`) gives exactly
    one `gate.plan-verify-comma` finding, whose reason names `(@ac-1),src/y.test.ts#risk:data-loss-quotes` and
    whose `file` is `accord/tickets/T-1/plan.md`. The absence half alone passes before any code exists; the
    positive control is what fails first.
  - `it('risk:parsing the comma check reads the first verify line outside a fence')`: in `PLAN`, task 2's verify
    line becomes `- verify: export#escapes-commas (@ac-2), a#b,c`, preceded by a fenced block holding
    `verify: q#r,s` and followed by a second line `verify: x#y,z`; the `gate.plan-verify-comma` findings, as
    `[line, reason]`, are exactly one, at the list-marker line's number, naming `a#b,c`. The same plan with
    `a#b,c` replaced by `a#b` has no such finding.
Show them failing (ac-3 for want of the rule, ac-4 on its positive control, the risk test on its one expected
finding), then write the code, build, and show them passing.

Code:
- `packages/core/src/gate/plan.ts`: `verifyComma: GateRule['check']` takes the ticket id as its parameter `id`
  and, per task, `fieldLines(task.lines).verify`;
  when present it splits `value` on whitespace runs, keeps each chunk matching `/\S,\S/` (a comma touching a
  non-space character on both sides; a chunk ending in a separating comma, such as `(@ac-1),`, does not match),
  and returns one draft per kept chunk, as written, with `file: planFile(id)`, `line` the verify line's number,
  and reason `task <n> verify id "<chunk>" holds a comma, which splits it into two ids; name the test without a comma`.
- `packages/core/src/gate/rules.ts`: import `verifyComma`; add
  `{ id: 'gate.plan-verify-comma', level: 'error', profiles: ['build', 'maintain'], check: verifyComma }`
  directly after `gate.plan-verify-at`, before `gate.tests-baseline-missing`.

Must not change: the `gate.plan-verify-at` row and its findings; the separating-comma lines the existing tests
use (`export#writes-csv (@ac-1), export#writes-csv (@ac-1)` in `lane-plan.test.ts` stays free of the new rule);
every existing test in both files.

## Task 3: Planner and executor say a test name holds no at sign and no comma
covers: @ac-5, D-01, D-04, D-06
files: packages/core/agents/executor.md, packages/core/agents/planner.md, packages/core/src/generated/agents.ts, .claude/agents/accord-executor.md, .claude/agents/accord-planner.md, packages/core/test/agents.test.ts, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/agents.test.ts#ac-5-the-planner-and-the-executor-say-a-test-name-holds-no-at-sign-and-no-comma (@ac-5)

Test first, in `packages/core/test/agents.test.ts`, top level, after the `agents name what the spec requires`
block: `it('ac-5 the planner and the executor say a test name holds no at sign and no comma')`. For each of
`.claude/agents/accord-planner.md` and `.claude/agents/accord-executor.md` in `agentTargets(config())`, the text
is non-empty and includes the sentence ``A test name never holds `@` or a comma.`` verbatim. One test reads both
rendered agents; no `AGENT_REQUIRED` row is added. Show it failing.

Then:
- `packages/core/agents/executor.md`: in the `(@ac-n)` bullet, the sentence
  ``A test name never starts with `@` and never holds `(@ac-n)`.`` becomes ``A test name never holds `@` or a comma.``,
  kept whole on one source line so the rendered text holds it verbatim; the rest of the bullet (the marker
  sentence and the `risk:<kind>` rule) stays as written.
- `packages/core/agents/planner.md`: a bullet ``- A test name never holds `@` or a comma.`` directly after the
  `risk:<kind>` bullet.
- `docs/specs/2026-10-12-workflow-layer-design.md` §7 Plan: after the sentence ending "or a `@ui` scenario,
  fails.", add: a verify id holding `@`, path included, fails (`gate.plan-verify-at`), because the scenario's
  `@test:` tag would split; a comma touching a non-space character on both sides fails
  (`gate.plan-verify-comma`), naming the whole whitespace-free text as written; a comma followed by a space
  separates ids and passes.
- `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, which rewrite
  `packages/core/src/generated/agents.ts` and the two `.claude/agents/` copies. Show the test passing.

Must not change: every phrase `AGENT_REQUIRED` pins for `planner` and `executor`; each agent body stays within
60 lines (`names no other tool and stays short`); the drift test `generated module matches agents/ (drift)`
passes; no other agent file changes.

---
baseline: 17119d785335ce0562fbf6eacc9557438afb2c06
plan_hash: "fnv1a64:6787f2c2f18f8d92"
---

Review mode `outcome`: one branch, no slices. Report case ids follow the JUnit id shape in
`packages/core/src/load/junit.ts`: `<classname>#<name>` with each whitespace run turned into `-`. Every new test
below is a top-level `it(...)` with no `describe` wrapper, whose name starts with its criterion (`ac-n`, no
leading `@`) or a lowercase description, and no test name holds `@` or `(@ac-n)`. This plan uses the marker it
introduces: `(@ac-n)` after a verify id maps that test to scenario `@ac-n`, and each of @ac-1 to @ac-5 is
mapped exactly once. The CLI that records tasks is `node packages/cli/dist/cli.js`, built from source, so every
task that changes core or CLI source ends with `npm run build`; CLI tests import core from `packages/core/dist`,
so rebuild core (`npm run build -w packages/core`) before running a CLI test.

## Task 1: Wiring: a verify marker maps a test to a scenario and task-done writes its tag
covers: @ac-1, D-01
files: packages/core/src/model/snapshot.ts, packages/core/src/load/work.ts, packages/core/src/write/testtag.ts (new), packages/core/src/index.ts, packages/cli/src/commands/task-done.ts, packages/core/test/work.test.ts, packages/core/test/testtag.test.ts (new), packages/cli/test/lane-commands.test.ts
verify: packages/core/test/work.test.ts#verify-markers-map-the-test-id-before-them-and-stay-out-of-verify, packages/core/test/testtag.test.ts#inserts-the-test-tag-right-after-the-ac-token-and-before-a-comment, packages/core/test/testtag.test.ts#reads-crlf-and-writes-lf, packages/cli/test/lane-commands.test.ts#ac-1-task-done-writes-the-tag-of-the-scenario-a-verify-entry-proves (@ac-1)

Tests first.
- `packages/core/test/work.test.ts`: `it('verify markers map the test id before them and stay out of verify')`.
  `parsePlan` on `## Task 1: A\nverify: a#x (@ac-1), b#y, c#z (@ac-2) (@ac-3), (@ac-4)\n` gives
  `verify: ['a#x', 'b#y', 'c#z']` and `maps: [{ test: 'a#x', ac: '@ac-1' }, { test: 'c#z', ac: '@ac-2' },
  { test: 'c#z', ac: '@ac-3' }]`; the leading `(@ac-4)` maps nothing, as a leading `(new)` marks nothing.
- `packages/core/test/testtag.test.ts` (new), each building its scenarios with `loadSnapshot` on a ticket made
  by `laneTicket` from `test/helpers/lane.ts` with the `@test:` tags removed from `LANE_BODY`:
  - `inserts the test tag right after the ac token and before a comment`: the `@ac-1` line reads
    `  @ac-1 # first` in the input; with the map `{ test: 'export#writes-csv', ac: '@ac-1' }` the output line is
    `  @ac-1 @test:export#writes-csv # first` and every other line is byte-identical. A map onto `@ac-9`, which
    the ticket lacks, changes nothing and is absent from `written`.
  - `reads crlf and writes lf`: the same ticket with `\r\n` line endings and a BOM gives the LF text of the
    first case, with no BOM.
- `packages/cli/test/lane-commands.test.ts`: top-level
  `it('ac-1 task-done writes the tag of the scenario a verify entry proves')`. `makeLaneRepo` with
  `accord/tickets/T-1.md` set to `laneTicket('T-1', { body: LANE_BODY without its two @test tags })` and
  `accord/tickets/T-1/plan.md` set to `PLAN` with `verify: export#writes-csv` replaced by
  `verify: export#writes-csv (@ac-1)`. Run `approve T-1`, `gate ready T-1` and `gate plan T-1` (the last writes
  `plan_hash`), `commitAll`, `freshen`, record the `approved_hash:` and `ac_hash:` lines and the `stage` of
  T-1's row in `status --json`. Run `task-done T-1 1`: exit 0; the `@ac-1` line is
  `  @ac-1 @test:export#writes-csv`; the `@ac-2` line is unchanged; the two hash lines are byte-identical and
  the row's `stage` is unchanged.

Interface:
- `PlanTask.maps: { test: string; ac: string }[]` in `model/snapshot.ts`, `ac` written as in the marker without
  the parentheses (`'@ac-1'`), in the order the markers appear.
- `parsePlan` splits the verify tokens the way it splits `(new)` off `files:`: a token matching
  `/^\(@ac-[1-9][0-9]*\)$/` maps the nearest preceding non-marker token and is dropped from `verify`; a marker
  with no preceding id maps nothing. `task.verify` holds only test ids, so `taskVerdict` looks up `a#x` and never
  `(@ac-1)`. Any other token stays a verify id (ledger Ruling on malformed markers).
- `write/testtag.ts`, exported from `index.ts`:
  `writeTestTags(text: string, scenarios: ScenarioRef[], maps: { test: string; ac: string }[]): { text: string; written: { ac: string; test: string }[] }`.
  It normalises BOM and CRLF with `normaliseText` from `load/frontmatter.ts` and returns LF text, as
  `write/frontmatter.ts` does. For each map it finds the scenario whose `'@' + acTag` equals `ac`; none means
  skip. A scenario whose `tags` already hold `@test:<test>` is left as it is (D-05). Otherwise it takes the
  nearest line above the scenario's `line` (1-based, in the normalised text) holding the whole token `ac`, and
  inserts ` @test:<test>` directly after that token, never at the end of the line, so a trailing `#` comment
  cannot swallow it. No other byte moves.
- `task-done`: after a pass verdict and a fresh report, before any write, it reads the ticket file named by
  `ctx.snapshot.tickets[id].file`, calls `writeTestTags` with that ticket's `scenarios` and the task's `maps`,
  and when `written` is non-empty writes the ticket first and the ledger second, printing one line per tag,
  `wrote @test:<test> on <ac> in <ticket file>`, before the existing `recorded task ...` line. When `written`
  is empty the ticket file is not rewritten and stdout is exactly what it is today.

Must not change: `task.verify` for a plan with no marker, so every existing `work.test.ts` and `task.test.ts`
case passes untouched; `(new)` handling on `files:`; the already-recorded early return and its message; the
refusal paths of `task-done` (failed or missing case, stale report, no commit, bad task number), each of which
writes nothing; `bodyHash` of a plan, so `plan_hash` checks behave as now.

End by running `npm run build`. This plan's own task-done for this task then writes `@test:` for @ac-1 into
`accord/tickets/TAGS-1.md`; the orchestrator commits that ticket together with the ledger.

## Task 2: gate plan requires exactly one valid map per scenario that is not @ui
covers: @ac-2, @ac-3, @ac-4, D-02, D-05, D-06
files: packages/core/src/gate/plan.ts, packages/core/src/gate/rules.ts, test/helpers/lane.ts, packages/core/test/lane-plan.test.ts, packages/cli/test/lane-commands.test.ts
verify: packages/core/test/lane-plan.test.ts#ac-2-gate-plan-fails-when-a-scenario-has-no-test-mapped-to-it-anywhere-in-the-plan (@ac-2), packages/core/test/lane-plan.test.ts#ac-3-gate-plan-fails-when-a-scenario-is-mapped-more-than-once (@ac-3), packages/core/test/lane-plan.test.ts#a-map-onto-a-missing-scenario-or-a-ui-scenario-fails-gate-plan, packages/cli/test/lane-commands.test.ts#ac-4-an-unmapped-verify-id-and-an-unmapped-ui-scenario-need-no-tag (@ac-4)

Tests first, top-level in `packages/core/test/lane-plan.test.ts`, using its `base`, `plan` and `errors` helpers:
- `ac-2 gate plan fails when a scenario has no test mapped to it anywhere in the plan`: a ticket whose body adds a
  third scenario `@ac-3` (not `@ui`) and a plan mapping only `@ac-1`; the findings of rule
  `gate.plan-test-unmapped` are exactly two, one naming `@ac-2` and one naming `@ac-3`.
- `ac-3 gate plan fails when a scenario is mapped more than once`: two cases. Task 1 and task 2 both map
  `@ac-1` (`export#writes-csv (@ac-1)` and `export#escapes-commas (@ac-1)`): one `gate.plan-test-repeated`
  finding whose reason names `@ac-1`, `export#writes-csv` and `export#escapes-commas`. One task maps the same id
  twice (`export#writes-csv (@ac-1), export#writes-csv (@ac-1)`): one finding naming `@ac-1` and
  `export#writes-csv, export#writes-csv`.
- `a map onto a missing scenario or a ui scenario fails gate plan`: a map onto `@ac-9` gives a
  `gate.plan-map-invalid` finding naming task, test id and `@ac-9` (D-05); with `@ac-2` tagged `@ui` and
  mapped, a `gate.plan-map-invalid` finding naming `@ac-2` as a @ui scenario (D-06).
In `packages/cli/test/lane-commands.test.ts`, top-level
`it('ac-4 an unmapped verify id and an unmapped ui scenario need no tag')`: the ticket has no `@test:` tags and
`@ac-2` carries `@ui`; the plan maps `export#writes-csv (@ac-1)` in task 1 and leaves task 2's
`verify: export#escapes-commas` unmarked. `approve`, `gate plan` exits 0; `commitAll`, `freshen`;
`task-done T-1 2` exits 0, the ledger gains task 2, and the ticket is byte-identical. The gate half fails before
this task only if the unmapped rule wrongly counts @ui; the task-done half guards Task 1's skip.

Interface, in `gate/plan.ts`, each check returning nothing for a non-lane ticket or a plan with no task
(`planMissing` and `planEmpty` own those):
- `testUnmapped`: one finding per `@ac-n` of a scenario whose `tags` lack `@ui` and that no task's `maps` names,
  reason `<ac> is mapped to no test; write (<ac>) after the verify id that proves it`.
- `testRepeated`: one finding per `@ac-n` mapped more than once across all tasks, reason
  `<ac> is mapped more than once: <every test id in plan order, repeats included, comma-separated>`.
- `mapInvalid`: per map, with the task's line, `task <n> maps <test> to <ac>, which is not a scenario of <id>`
  or `task <n> maps <test> to <ac>, a @ui scenario; a @ui scenario carries no @test tag`.
Rows in `PLAN_RULES` after `gate.plan-ref-unknown`: `gate.plan-test-unmapped`, `gate.plan-test-repeated`,
`gate.plan-map-invalid`, each `level: 'error'`, `profiles: ['build', 'maintain']`.

Fixture: in `test/helpers/lane.ts`, `PLAN` task 1 becomes `verify: export#writes-csv (@ac-1)` and task 2
`verify: export#escapes-commas (@ac-2)`, and `plan_hash` is set to the new body hash, which
`work.test.ts#parsePlan->-the-helper-PLAN-carries-the-hash-of-its-own-body` checks. `LANE_BODY` keeps its
`@test:` tags, so the existing task-done tests hit the same-tag case and print exactly what they print today.

Must not change: every existing rule and reason in `gate/plan.ts`; every existing case in `lane-plan.test.ts`,
`work.test.ts`, `task.test.ts` and `lane-commands.test.ts` passes with the new `PLAN` (the cases that
`replace` a `verify: export#...` prefix keep the marker that follows it, and still pass); the line numbers
`gate.task-file-unknown` reports (8 and 14), since markers sit on existing lines.

End by running `npm run build`.

## Task 3: task-done refuses a different tag and a re-run fills a missing one
covers: @ac-5, D-05
files: packages/core/src/write/testtag.ts (new), packages/cli/src/commands/task-done.ts, packages/core/test/testtag.test.ts (new), packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#ac-5-task-done-never-overwrites-a-different-test-tag (@ac-5), packages/core/test/testtag.test.ts#reports-a-conflict-when-the-scenario-carries-a-different-test-tag, packages/cli/test/lane-commands.test.ts#a-re-run-on-a-recorded-task-fills-a-missing-tag, packages/cli/test/lane-commands.test.ts#a-failed-mapped-test-writes-no-tag

Tests first.
- `packages/core/test/testtag.test.ts`: `it('reports a conflict when the scenario carries a different test tag')`:
  `@ac-1` carries `@test:old#u`, the map is `{ test: 'export#writes-csv', ac: '@ac-1' }`; the result has
  `conflicts: [{ ac: '@ac-1', existing: 'old#u', test: 'export#writes-csv' }]`, `written: []`, and the input
  text unchanged.
- `packages/cli/test/lane-commands.test.ts`, all top-level, on `makeLaneRepo`:
  - `ac-5 task-done never overwrites a different test tag`: the ticket's `@ac-1` line carries
    `@test:export#old-name`, the report has `export#writes-csv` passed, `PLAN` maps it to `@ac-1`. After
    `commitAll` and `freshen`, `task-done T-1 1` exits 1, stdout names `@ac-1`, `export#old-name` and
    `export#writes-csv`; the ticket bytes are unchanged and `accord/tickets/T-1/ledger.md` does not exist.
  - `a re-run on a recorded task fills a missing tag`: the ticket lacks its `@test:` tags, the ledger already
    holds `- task 1 done abc1234`, the report is fresh; `task-done T-1 1` exits 0, prints the `wrote` line and
    the already-recorded line, the `@ac-1` line gains `@test:export#writes-csv`, the ledger is byte-identical.
  - `a failed mapped test writes no tag`: the ticket lacks its `@test:` tags, the report records
    `export#writes-csv` failed; `task-done T-1 1` exits 1 and the ticket and ledger are unchanged.

Interface:
- `writeTestTags` returns `{ text, written, conflicts }`; a scenario whose tags hold a `@test:` tag other than
  `@test:<test>` yields `{ ac, existing, test }` (the existing id without `@test:`) and no insertion for it.
- `task-done` order: compute `recordTaskDone`; compute `taskVerdict`. When the task is already recorded and the
  verdict passes, apply the tags (no staleness check, since the committed ledger makes HEAD newer than the
  report), then print the already-recorded line; when it is recorded and the verdict fails, print the
  already-recorded line as today. When not recorded, the existing verdict and staleness refusals run first;
  then any conflict exits 1 with `task <n> of <id> is not done:` and one line per conflict,
  `<ac> already carries @test:<existing>; the plan maps it to <test>`, before any write; otherwise the ticket,
  then the ledger. A conflict on a re-run also exits 1 and writes nothing.

Must not change: Task 1's output when nothing is written; the already-recorded message text; a CRLF ledger is
left byte-identical on a re-run; every refusal writes neither file.

End by running `npm run build`. Tasks 1 and 2 recorded their tags as they ran, so no earlier task of this plan
needs a re-run; on any ticket whose tasks were recorded before the writer shipped, the build skill runs
`accord task-done <id> <n>` again for each recorded task to fill the missing tags.

## Task 4: The plan, build, ticket and spec text name the marker
covers: D-03, D-04
files: packages/core/agents/planner.md, packages/core/agents/executor.md, packages/core/skills/plan/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/templates/ticket-lane.md, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/src/generated/agents.ts, packages/core/src/generated/skills.ts, packages/core/src/generated/templates.ts, .claude/agents/accord-planner.md, .claude/agents/accord-executor.md, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord-build/SKILL.md, packages/cli/test/skills-sync.test.ts
verify: packages/cli/test/skills-sync.test.ts#risk:drift-the-committed-plan-and-build-copies-carry-the-marker-wording, packages/core/test/agents.test.ts#rendered-agents->-generated-module-matches-agents/-(drift), packages/core/test/skills.test.ts#generated-module->-generated-module-matches-skills/-(drift), packages/core/test/templates.test.ts#generated-module->-generated-module-matches-templates/-(drift)

Test first, in `packages/cli/test/skills-sync.test.ts`, top-level
`it('risk:drift the committed plan and build copies carry the marker wording')`, reading with
`new URL('../../../<path>', import.meta.url)` this repository's `.claude/agents/accord-planner.md`,
`.claude/skills/accord-plan/SKILL.md` and `.claude/skills/accord-build/SKILL.md`, and asserting each contains
`(@ac-`. It fails until the synced copies are regenerated.

Text, naming no other tool:
- `agents/planner.md`: the `verify:` line maps each scenario that is not `@ui` to exactly one test by writing
  `(@ac-n)` after its id; an id may carry two markers; an id that proves no scenario carries none; no `@ui`
  scenario is mapped. Update the example `verify:` line to show one marker.
- `agents/executor.md`: `(@ac-n)` on a verify line is a marker, not part of the test name; a test name never
  starts with `@` and never holds `(@ac-n)`.
- `skills/plan/SKILL.md`: `accord gate plan` refuses a plan where a non-@ui scenario has no map or more than one,
  or a map names a missing or @ui scenario.
- `skills/build/SKILL.md` step 3: `accord task-done` writes the scenario's `@test:` tag; commit the ticket
  together with the ledger. A refusal naming a scenario that already carries a different `@test:` tag goes to the
  owner, never to an executor or `accord-debug`. On a ticket whose recorded tasks predate the writer, run
  `accord task-done` again for each recorded task to fill missing tags.
- `templates/ticket-lane.md` line 32 comment: the `@test:<id>` tag is written by `accord task-done` from the
  plan's `(@ac-n)` marker, not by hand; it stays outside the AC hash.
- The spec, §7 Plan (the `verify:` line, the marker, the three new gate rules) and §8 Build (`task-done` writes
  the tag, refuses a different tag before any write, a re-run fills a missing tag).

Then run, in order: `npm run gen` (rewrites the three generated modules), `npm run build` (skills sync renders
from the CLI's built output), and `node packages/cli/dist/cli.js skills sync` (the workspace build, never an
`accord` on PATH), which rewrites the `.claude/` copies. Each rendered SKILL.md stays at or under
`MAX_SKILL_BYTES` (5120) in `packages/core/test/skills.test.ts`; keep the added wording short.

Must not change: every other rule in the planner, executor and the two skills; the other ticket templates;
D-04 keeps `accord/tests-baseline.txt` setup, rejecting `@` in a verify id, and phase 2 config setup out of this
text.

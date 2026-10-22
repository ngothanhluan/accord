---
baseline: 8638f7779fa5374eeef13e4f0d3beeef42547d94
plan_hash: "fnv1a64:ec7d8f59785579cc"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this preamble,
the ticket and its ledger.

Order: Task 1 is the wiring. It gives lane S its ticket form end to end: the schema, the template,
`accord new ticket --lane S`, lint, and a `gate ready` that names each empty section, needs no approval and records
`ac_hash` (ac-2). Task 2 reads that record into the stage, the status row and the anchor. Task 3 adds the lane column
to the dashboard and the panel (ac-3). Task 4 gives lane S its own `gate done` table, with the suite rule, fed by a
new host fact about `review.md` and by the commits after it read from HEAD. Task 5 adds the D-09 lint rule, the lint
rule that stops a lane S ticket holding lane M records, and keeps lane S out of the test policy. Task 6 makes
`accord approve` refuse lane S and starts a lane S review package at the fork point. Task 7 writes the lane S
procedure into the skills (ac-1, ac-4). Task 8 writes the drop at intent, the lifted plan baseline and the failure
route (ac-5). Task 9 makes the CI workflow gate a lane S pull request that changes only `accord/`.

Rules for every task:
- Test ids: every test this plan writes is a top-level `it(...)` with no `describe` around it. Its report id is the
  test file's path from the repository root, then `#`, then the `it` title with each run of whitespace turned into
  `-`, letter case kept (`lane S` gives `lane-S`). Each `it` title is copied character for character from this plan.
  No test title holds `@`, a comma or an apostrophe. No existing test is renamed.
- A test that makes a commit does it through `commitMsg` from `packages/cli/test/helpers/repo.ts`, which commits with
  `-F <file> --cleanup=verbatim`, never `-m` (conventions.md); new tests never call `commitAll`. A CLI test that
  builds a git repository passes `120_000` as the third argument of `it`, gets it from `repoWith(files)` (Task 3 adds
  it to `packages/cli/test/lane-s.test.ts`) or `makeLaneRepo()`, and removes it with `cleanup` in a `finally`.
  `repoWith(files)` is `makeEmptyRepo()`, then `gitRun(repo, 'config', 'user.email', 'an@example.com')`,
  `gitRun(repo, 'config', 'user.name', 'an')`, `gitRun(repo, 'config', 'commit.gpgsign', 'false')`, then
  `writeFiles(repo, files)`; it returns the path. `commitMsg` uses the repository's own identity, which
  `makeEmptyRepo` does not set.
- CLI tests import core from `packages/core/dist`. After any change under `packages/core/`, run
  `npm run build -w packages/core` before running a CLI test. Run one file with `npx vitest run <path>`. End every
  task with `npm run build`, `npm run lint` and `npm run typecheck`, then the test files the task names, then
  `npx vitest run` once over the whole suite. A failure in a file the task does not name is reported, not edited away.
- After changing anything under `packages/core/templates/`, `packages/core/skills/`, `packages/core/agents/` or
  `packages/core/panel/`, re-render from the repository root in this order: `npm run gen`, `npm run build`,
  `node packages/cli/dist/cli.js skills sync`. Any file `skills sync` rewrites beyond those on the task's `files:` line
  is kept as written and named in the report.
- Every `git log` and `git show` in `packages/cli/src` is written `'-c', 'log.showSignature=false', 'log', '--no-show-signature', ...`
  (or `'show'` in place of `'log'`), because `packages/cli/test/spawn-surface.test.ts` checks that exact text. Paths
  from git are read with `-z`, a path handed to git as a pathspec carries `:(literal)`, and every spawn whose output
  grows with the repository passes a 64 MiB `maxBuffer`. Every spawn is `execFileSync('git', [...])` with a literal
  array, never a shell.
- Files are LF with no BOM. Add no dependency. Every printed path uses `/`. Core (`packages/core/src`) imports no
  `node:` module.
- Rendered skill limits (`packages/core/test/skills.test.ts`): each rendered `SKILL.md` is at most 5120 bytes and
  120 lines; a bundled reference such as `lane-s.md`, `ids.md` or `worktree.md` has no limit. Counted from the
  committed rendered copies at the baseline: `.claude/skills/accord/SKILL.md` is 4948 bytes and 98 lines,
  `.claude/skills/accord-intent/SKILL.md` 4133 bytes and 78 lines, `.claude/skills/accord-plan/SKILL.md` 5049 bytes and
  89 lines. Tasks 7 and 8 give the text that keeps each one under the limit.
- Skill text never holds the words `Ready` or `Done` as whole words, except `Done when`; never `warning`; never a
  `gate.` or `lint.` rule id; never a runtime product name or a `packages/` path. A paragraph that names an
  `accord <command>` holds none of the four subjects `PROMOTED` lists in `skills.test.ts` (such as `## Open questions`).

Definitions shared by every task:
- `LANE_S_BODY` (Task 1 adds it to `test/helpers/lane.ts`):
  `['## Understood', 'The export button writes a csv file.', '', '## Done when', 'Pressing export saves report.csv.', ''].join('\n')`.
- A lane S ticket in a test is `laneTicket(id, { lane: 'S', body: LANE_S_BODY })`.
- `Lane` is the type `'S' | 'M' | 'L' | 'P'` that Task 1 exports from `packages/core/src/model/snapshot.ts`.
- `laneSHash(ticket)` and `readyHash(ticket)` are the functions Task 1 adds to `packages/core/src/gate/hash.ts`.

## Task 1: Wiring: accord new ticket writes a lane S ticket that lint accepts and gate ready passes with no approval
covers: @ac-2, D-01, D-04, D-07, D-08
files: packages/core/schemas/ticket.schema.json, packages/core/src/model/snapshot.ts, packages/core/src/load/sections.ts, packages/core/templates/ticket-lane-s.md (new), packages/core/src/generated/templates.ts, packages/core/src/lint/ticket.ts, packages/core/src/lint/gherkin.ts, packages/core/src/gate/hash.ts, packages/core/src/gate/ready.ts, packages/core/src/gate/rules.ts, packages/core/src/gate/index.ts, packages/core/src/index.ts, packages/core/src/status/rows.ts, packages/core/src/status/show.ts, packages/cli/src/commands/new-ticket.ts, packages/cli/src/run.ts, test/helpers/lane.ts, packages/core/test/templates.test.ts, packages/core/test/schemas.test.ts, packages/core/test/gate.test.ts, packages/cli/test/lane-s.test.ts (new)
verify: packages/cli/test/lane-s.test.ts#ac-2-a-lane-S-ticket-is-written-and-passes-gate-ready-without-acceptance-criteria (@ac-2)

Consumes: `setFrontmatterKey` and `templates` (core), `headingKey` and `stripHtmlComments`
(`packages/core/src/load/sections.ts`), `fnv1a64`, `acHash` and `approvedInput` (`packages/core/src/gate/hash.ts`).
Produces: the `Lane` type, the `ticket-lane-s.md` template, `accord new ticket --lane S`, `laneSHash`, `readyHash`,
the Ready rule `gate.section-empty` and its exported row `SECTION_EMPTY`, and `LANE_S_BODY`. Tasks 2 to 8 use them.

Test first: `packages/cli/test/lane-s.test.ts` (new), importing `cleanup`, `makeLaneRepo`, `run` and `writeFiles`
from `./helpers/repo.js`, `readFileSync` from `node:fs` and `join` from `node:path`. Each task adds to the imports
only what its own tests use, so lint finds no unused name.
- `it('ac-2 a lane S ticket is written and passes gate ready without acceptance criteria', ..., 120_000)`:
  - `repo = makeLaneRepo()`. `run(['new', 'ticket', 'S-1', '--lane', 'S'], repo)` exits 0 and prints
    `accord/tickets/S-1.md\n`. `file = join(repo, 'accord', 'tickets', 'S-1.md')`, `text = readFileSync(file, 'utf8')`.
  - `text` contains `id: "S-1"`, a line matching `/^lane: "?S"?/m` and a line matching `/^title: ".+"/m`. The lines
    starting `## ` are exactly `['## Understood', '## Done when']`, so there is no acceptance criteria, plan or
    verification section. `text` has no line matching `/^approved_hash:/m`.
  - `errorsOn = async () => (JSON.parse((await run(['lint', '--json'], repo)).out).findings as { file: string; level: string }[]).filter((f) => f.file === 'accord/tickets/S-1.md' && f.level === 'error')`.
    `errorsOn()` is `[]` with both sections empty (each holds only its HTML comment).
  - `ready = await run(['gate', 'ready', 'S-1', '--json'], repo)` exits 1. Its findings with rule
    `gate.section-empty` are two, one reason containing `"## Understood"` and one containing `"## Done when"`, and no
    finding has rule `gate.approval-missing`.
  - Write the file with `text.replace('## Understood\n', '## Understood\nThe export button writes a csv file.\n')`.
    `gate ready --json` exits 1 with exactly one `gate.section-empty` finding, its reason containing
    `"## Done when"`.
  - Also insert `'Pressing export saves report.csv.\n'` after `'## Done when\n'`. `run(['gate', 'ready', 'S-1'], repo)`
    exits 0 without `approve` ever running; the file now has a line matching `/^ac_hash: "?fnv1a64:[0-9a-f]{16}"?/m`
    and still none matching `/^approved_hash:/m`. `errorsOn()` is `[]` again.

Interface:
- `ticket.schema.json`: `lane` becomes `{ "type": "string", "enum": ["S", "M", "L", "P"] }`.
- `model/snapshot.ts`: `export type Lane = 'S' | 'M' | 'L' | 'P';` above `TicketFrontmatter`, whose `lane` becomes
  `lane?: Lane`. Export `Lane` from `packages/core/src/index.ts` beside `TicketFrontmatter`. `rows.ts` `lane?` and
  `show.ts` `lane` take `Lane`.
- `load/sections.ts`: `LANE_KEYS` gains `'understood'` and `'done when'`.
- `packages/core/templates/ticket-lane-s.md` (new), exactly:
  ```
  ---
  id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
  title: "Short title in business language"
  type: story                                # story | bug
  status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
  lane: S                                    # S: one small change, worked from this ticket alone
  # Tickets that must reach done before this one can start.
  # depends_on: ["OTHER-ID"]
  # How the dashboard ranks this ticket: high | medium | low; absent means medium.
  # priority: medium
  # Ids in the tracker, a map keyed by adapter name; values are strings.
  # tracker: { github-issues: "1234" }
  ui: false
  # Written by `gate ready`; never edit by hand.
  # ac_hash:
  ---

  ## Understood
  <!-- One line: the change, as the request was understood. -->

  ## Done when
  <!-- One line: the observable result that ends the work. -->
  ```
  Then `npm run gen` regenerates `generated/templates.ts`.
- `lint/ticket.ts` `headingMissing`: a ticket with `lane: S` requires `['Understood', 'Done when']` whatever its type;
  the other two tables are unchanged.
- `lint/gherkin.ts` `noScenarios`: returns `[]` for a ticket whose `lane` is `S`.
- `gate/hash.ts`:
  - A private `sectionParts(ticket, key): string[]` returning `[key, String(lines.length), ...lines]` with the lines
    `approvedInput` builds today (comment-stripped, trimmed, non-blank). `approvedInput` calls it for every key but
    `acceptance criteria`; its output, and so every `approved_hash`, is unchanged.
  - `export const LANE_S_SECTIONS = ['understood', 'done when'] as const;`
  - `export function laneSHash(ticket: Ticket): string` = `fnv1a64(LANE_S_SECTIONS.flatMap((k) => sectionParts(ticket, k)).join(SEP))`.
  - `export function readyHash(ticket: Ticket): string | undefined` = `laneSHash(ticket)` when
    `ticket.frontmatter?.lane === 'S'`, else `acHash(ticket.scenarios)`.
- `gate/ready.ts`:
  - `export const sectionEmpty: GateRule['check']`: `[]` unless the ticket's lane is `S`. For each name of
    `['Understood', 'Done when']` whose section exists and holds no non-blank line once HTML comments are stripped:
    `{ file: ticketFile(id), line: s.line, reason: '"## <name>" is empty; a lane S ticket needs it written before any change' }`.
    An absent heading is `lint.heading-missing`'s.
  - `approvalMissing` and `approvalStale` return `[]` when the lane is `S` (D-04: a lane S ticket needs no
    `accord approve`).
- `gate/rules.ts`: `export const SECTION_EMPTY: GateRule = { id: 'gate.section-empty', level: 'error', profiles: ['build', 'maintain'], check: sectionEmpty };`
  added to `READY_RULES` after the `gate.approach-empty` row.
- `gate/index.ts` `run`: `const hash = known ? readyHash(snapshot.tickets[id]) : undefined;`. The `acHash` field
  comment says it carries the hash of `## Understood` and `## Done when` for a lane S ticket. `packages/cli/src/commands/gate.ts`
  then writes it as `ac_hash` with no change.
- `cli/src/commands/new-ticket.ts`: `options.lane?: Lane`. The epic check becomes
  `if (options.type === 'epic' && (options.lane === 'M' || options.lane === 'S')) throw new UsageError('an epic is lane L or P, not ' + options.lane);`.
  The template is `'ticket-lane-s.md'` when `options.lane === 'S'`; the other choices are unchanged.
- `cli/src/run.ts`: `--lane` becomes `new Option('--lane <lane>', 'write a lane ticket (S, M, L, or P)').choices(['S', 'M', 'L', 'P'])`,
  and the action's `lane?` takes `Lane`.
- `test/helpers/lane.ts`: export `LANE_S_BODY` as defined above.
- Existing tests to update:
  - `templates.test.ts`: the `it.each` of lane templates gains `['ticket-lane-s.md', 'story']` and its lane check
    becomes `/^[SMLP]$/`. `lane headings are in spec order` also expects
    `headings(templates['ticket-lane-s.md'])` to equal `['## Understood', '## Done when']`.
  - `schemas.test.ts:260`: `lane: 'S'` now validates (`toEqual([])`); `lane: 'X'` is the `schema.enum` case.
  - `gate.test.ts` `GATE01` gains `'a lane S ticket: Understood and Done when written': ['gate.section-empty']`.

Must not change: every `approved_hash` and `ac_hash` a lane M or 0.1.0 ticket hashes to; the lane M and epic
templates; `new ticket` without `--lane` or with `M`, `L`, `P`, including the refusal text
`an epic is lane L or P, not M` (`lane-commands.test.ts:749`); the Ready result of every non-S ticket; `gate.ts`.

## Task 2: The lane S stage, status row and anchor read the ready record, the review record and the commits after it
covers: D-04, D-08
files: packages/core/src/status/stage.ts, packages/core/src/status/anchor.ts, packages/core/src/status/rows.ts, packages/core/src/gate/done.ts, packages/core/test/lane-s.test.ts (new)
verify: packages/core/test/lane-s.test.ts#risk:complex-branching-the-lane-S-stage-and-anchor-follow-the-ready-record-the-review-record-and-the-commits-after-it

Consumes: `laneSHash` and `readyHash` (Task 1), `workOf` and `VERDICTS` (`gate/work.ts`), `ownRecordsOnly`
(`gate/done.ts`). Produces: `handMade` in `gate/done.ts`, `LaneSStage`, `laneSNext`, the lane S branch of
`progressOf`, `nextStep` and `anchorText`, and a `ready` column that reads `readyHash`. Tasks 3 and 4 use them.

Test first: `packages/core/test/lane-s.test.ts` (new), importing `loadSnapshot` from `../src/load/snapshot.js`,
`laneSHash` from `../src/gate/hash.js`, `statusRows` and `nextRows` from `../src/status/rows.js`, `isDone` from
`../src/status/stage.js`, `anchorText` from `../src/status/anchor.js`, and `CONFIG`, `LANE_S_BODY`, `laneTicket` from
`../../../test/helpers/lane.js`.
- Helpers: `S = (body = LANE_S_BODY, fm: string[] = []) => laneTicket('S-1', { lane: 'S', body, frontmatter: fm })`;
  `snap = (files, extra = {}) => loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [], ...extra })`;
  `row = (s) => statusRows(s).find((r) => r.id === 'S-1')`; `H = laneSHash(snap({ 'accord/tickets/S-1.md': S() }).tickets['S-1'])`;
  `R = 'accord/tickets/S-1/review.md'`; `ready = { 'accord/tickets/S-1.md': S(LANE_S_BODY, ['ac_hash: "' + H + '"']) }`.
- `it('risk:complex-branching the lane S stage and anchor follow the ready record the review record and the commits after it')`:
  - No `ac_hash`: `row(snap({ 'accord/tickets/S-1.md': S() }))` matches `{ lane: 'S', stage: 'intent', ready: 'none', next: 'write ## Understood and ## Done when, then pass accord gate ready (lane-s.md)' }`.
  - `ready`: the row matches `{ stage: 'build', ready: 'ok', tasksDone: 0, tasksTotal: 0 }`, its `next` is
    undefined (so Task 3's dashboard cell reads `build`), and
    `nextRows(statusRows(snap(ready))).map((r) => r.id)` contains `S-1`.
  - `{ ...ready, [R]: '## Round 1\n\nMust 1: x — src/a.ts:1\n' }` (a round recorded, no verdict yet): the row matches
    `{ stage: 'review', next: 'the next review round, numbered after the last ## Round in review.md (lane-s.md)' }`.
  - `{ ...ready, [R]: '## Round 1\n\nNo findings\n\nverdict: converged\n' }`: stage `done`, its `next` is
    undefined, and `isDone` of that snapshot for `S-1` is true. With `verdict: accepted-by-owner "ship it"` as the last line it is `done` too (D-12).
  - A line `x` after the verdict: stage `review`. `verdict: open`: stage `review`.
  - The converged files with
    `{ afterVerify: { 'S-1': [{ sha: 'a'.repeat(40), parents: ['b'.repeat(40)], files: ['src/a.ts'] }] } }`: stage
    `review`. The same with `files: ['accord/tickets/S-1/ledger.md']`: stage `done`.
  - The converged files with the Understood line changed to `The export button writes a tsv file.` (the recorded
    `ac_hash` kept): stage `intent`, `ready: 'stale'`.
  - `anchorText(snap(ready), 'S-1')` contains, in this order, the lines `Lane: S`,
    `Stage: build, next: the change and the tests.affected command (lane-s.md)`, `## Understood`,
    `The export button writes a csv file.`, `## Done when`, `Pressing export saves report.csv.`, `## Rulings`, and
    contains neither `## Intent` nor `## Corrections`. With `'## Corrections\n- "no, the tsv one"\n'` appended to the
    body, the anchor holds `## Corrections` then `- "no, the tsv one"` between the Done when line and `## Rulings`
    (ledger Ruling 10).
  - `anchorText` of a lane M ticket (`laneTicket('T-1')` in the same config) contains no line starting `Lane:`.

Interface:
- `gate/done.ts`: move `isHand` out of `stage.ts` as
  `export const handMade = (id: string, c: AfterVerifyCommit): boolean => c.files === undefined || !ownRecordsOnly(id, c.files);`.
  `stage.ts` imports it in place of its local `isHand`; `reviewBase` and `progressOf` keep their behaviour.
- `status/stage.ts`:
  - `export type LaneSStage = 'intent' | 'build' | 'review' | 'done';`
  - `const LANE_S_NEXT: Record<LaneSStage, string>` = intent `'write ## Understood and ## Done when, then pass accord gate ready (lane-s.md)'`,
    build `'the change and the tests.affected command (lane-s.md)'`, review
    `'the next review round, numbered after the last ## Round in review.md (lane-s.md)'`, done
    `'the pull request; run accord gate done (lane-s.md)'`; `export function laneSNext(stage: LaneSStage): string`.
  - `function laneSStage(snapshot, ticket): LaneSStage`: `intent` when `ticket.frontmatter?.ac_hash !== laneSHash(ticket)`;
    `build` when `workOf(snapshot, ticket.id)?.review` is undefined; `done` when the review's verdict is in `VERDICTS`,
    it has no `trailing`, and no commit of `snapshot.afterVerify[ticket.id]` (read with `Object.hasOwn`; absent
    counts as none) is `handMade`; `review` otherwise, which includes a review.md holding rounds and no verdict yet.
  - `progressOf`: right after the `fm?.lane === undefined` return, a ticket with `lane: S` returns
    `{ stage: laneSStage(snapshot, ticket), tasksDone: 0, tasksTotal: 0 }`.
  - `nextStep`: for a lane S ticket returns `laneSNext(stage as LaneSStage)`; lane M text unchanged.
- `status/rows.ts`: `ready: compare(fm?.ac_hash, readyHash(ticket), 'ok')`. `ticksBinding` still compares with
  `acHash`. `next` is set at stage `intent` for every lane ticket, as today, and also at stage `review` for a lane S
  ticket; never at `build` or `done` for lane S, so the dashboard's lane S `build` cell stays `build` (Task 3). The
  spread becomes
  `...(progress.stage === 'intent' || (fm.lane === 'S' && progress.stage === 'review') ? { next: nextStep(ticket, progress.stage) } : {})`,
  and the `next` field comment becomes
  `// what follows an unwritten or unapproved intent; set only at stage intent, and for lane S also at review`.
- `status/anchor.ts`: for a lane S ticket the lines after the title are `''`, `Lane: S`,
  `Stage: <stage>, next: <laneSNext(stage)>`, then the sections `Understood` and `Done when` printed as the lane M
  sections are (`(none)` when empty), then `Corrections` the same way only when the ticket has that heading (ledger
  Ruling 10), then the same `## Rulings` block. A lane M anchor is byte-identical to
  today's.

Must not change: every lane M and 0.1.0 stage, row and anchor (`lane-status.test.ts`, `anchor.test.ts`,
`dashboard.test.ts` ac-4); `reviewBase` and the `Review base:` line; `isDone` for lane M and 0.1.0 tickets.

## Task 3: The dashboard and the panel show a lane column on every ticket row
covers: @ac-3, D-04, D-08
files: packages/cli/src/render/dashboard.ts, packages/core/src/status/dashboard.ts, packages/core/panel/view.js, packages/core/panel/register.js, packages/core/src/generated/panel.ts, .claude/accord-panel/plugin/hooks/view.js, .claude/accord-panel/plugin/hooks/register.js, packages/core/test/panel.test.ts, packages/cli/test/lane-s.test.ts (new)
verify: packages/cli/test/lane-s.test.ts#ac-3-the-dashboard-lists-a-queued-and-a-claimed-lane-S-ticket-with-a-lane-column (@ac-3), packages/core/test/panel.test.ts#risk:regression-each-row-draws-as-fixed-width-cells-with-stage-colours-a-red-blocked-by-line-and-a-truncated-title

Consumes: the lane S rows of Task 2 and `dashboard()` as it is. Produces: the lane cell in the text dashboard, the
EPICS block and the panel (ledger Ruling 2), and a lane S `build` cell with no task counts.

Test first, appended to `packages/cli/test/lane-s.test.ts`. Add `commitMsg`, `gitRun` and `makeEmptyRepo` to its
import from `./helpers/repo.js`, `CONFIG`, `LANE_S_BODY` and `laneTicket` from `../../../test/helpers/lane.js`, and
define `repoWith` as the preamble says.
- `it('ac-3 the dashboard lists a queued and a claimed lane S ticket with a lane column', ..., 120_000)`:
  - `repo = repoWith({ 'accord/config.yml': CONFIG, 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }), 'accord/tickets/S-2.md': laneTicket('S-2', { lane: 'S', body: LANE_S_BODY }) })`,
    `commitMsg(repo, 'base')`, `main = gitRun(repo, 'branch', '--show-current').trim()`. The viewer is
    `an@example.com`, the repository's `user.email`.
  - `run(['gate', 'ready', 'S-1'], repo)` exits 0, then `commitMsg(repo, 'ready: S-1')`.
  - Claim S-2: `gitRun(repo, 'switch', '-q', '-c', 't/S-2')`, write `src/s2.txt` as `'s2\n'`,
    `commitMsg(repo, 'claim: S-2')`, `gitRun(repo, 'switch', '-q', main)`.
  - `j = JSON.parse((await run(['dashboard', '--json'], repo)).out)`. The ids of `[...j.ready.rows, ...j.upNext.rows]`
    contain `S-1`; the ids of `[...j.yours.rows, ...j.team.rows]` contain `S-2`; every row of those four sections has
    `lane` `S`.
  - `text = (await run(['dashboard'], repo)).out.split('\n')`. For each of `YOURS`, `TEAM`, `READY`, `UP NEXT` whose
    next line is not `  none`, that next line, trimmed and split on `/ {2,}/`, is
    `['id', 'lane', 'title', 'stage', 'who', 'blocked by']`. The line starting `  S-1`, trimmed and split the same
    way, has `S` at index 1 and `build` at index 3; the line starting `  S-2` has `S` at index 1.
- In `packages/core/test/panel.test.ts`, the test
  `risk:regression each row draws as fixed-width cells with stage colours a red blocked-by line and a truncated title`
  gains `lane: 'M'` on its `ST-3` row and changes these assertions only:
  - the header loop runs over `['ID', 'LANE', 'STAGE', 'TITLE']`, still 4 of each;
  - `laneBox = { width: 4, flexShrink: 0 }`; in `widthsHold`, `kids[1]` is `laneBox` and `kids[2]` is `stageBox`;
    the title box is `kids[3]`; `bare(h.cell('LANE').box)` equals `laneBox`;
  - `h.row('EP-1').children` has length 4;
  - `(kids[1].props.children[0] as { props: { children: string[] } }).props.children` of the `ST-3` row equals `['M']`.
  Every other assertion of that test stays as it is.

Interface:
- `cli/src/render/dashboard.ts`: `HEADS = ['id', 'lane', 'title', 'stage', 'who', 'blocked by']`; `cells` puts
  `sanitise(r.lane ?? EMPTY_CELL)` second. The stage cell shows `build <done>/<total>` only when `r.lane !== 'S'`; a
  lane S `build` row shows `build`. The EPICS table becomes `['id', 'lane', 'title', 'progress']`, its lane cell
  `sanitise(r.lane ?? EMPTY_CELL)`.
- `core/src/status/dashboard.ts`: `EpicRow` gains `lane?: Lane`; `epicsSection` adds
  `...(t.frontmatter?.lane === undefined ? {} : { lane: t.frontmatter.lane })` between `id` and `title`, so an epic
  without `lane:` keeps today's row (`dashboard.test.ts:321`).
- `core/panel/view.js`: `cells` and `epicCells` return `lane: typeof r.lane === 'string' ? clean(r.lane) : ''`;
  `cells` shows `build <d>/<t>` only when `r.lane !== 'S'`; `widths` gains `lane`, starting at `len('LANE')` and
  taking the longest lane cell like `id` and `stage`.
- `core/panel/register.js`: `cellBoxes(id, lane, stage, title)` adds
  `Box({ width: widths.lane, flexShrink: 0, children: [lane] })` after the id box; the header passes
  `['ID', 'LANE', 'STAGE', 'TITLE']`; each row passes `Text({ children: [r.lane] })` as its lane cell. Sub-lines for
  blocked-by and who are unchanged. Regenerate as the preamble says, which rewrites `generated/panel.ts` and both
  `.claude/accord-panel/plugin/hooks/` copies.

Must not change: the section rules, ranks, caps, counts and action line (`dashboard.test.ts`, `status/dashboard.ts`
apart from `EpicRow`); a lane M `build` cell `build n/m`; the panel's detail view, buttons, search, focus, colours and
sanitising; every other `panel.test.ts` test.

## Task 4: gate done on a lane S ticket uses its own table with the suite rule, fed by the commits after review.md on HEAD and a fact about its commit
covers: D-04, D-12
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/gate/lane-s.ts (new), packages/core/src/gate/rules.ts, packages/core/src/gate/index.ts, packages/cli/src/load/fs.ts, packages/cli/src/commands/gate.ts, packages/cli/test/lane-s.test.ts (new)
verify: packages/cli/test/lane-s.test.ts#risk:complex-branching-lane-S-gate-done-passes-a-reviewed-change-and-fails-on-a-commit-after-it-an-unclean-review-lines-after-the-verdict-a-failed-suite-and-edited-sections

Consumes: `SECTION_EMPTY` and `laneSHash` (Task 1), `handMade` and `ownRecordsOnly` (Task 2, `gate/done.ts`),
`reviewMissing`, `reviewUnconverged`, `suiteNotPassed` and `workOf` (`gate/work.ts`), `commitTrailer`
(`gate/done.ts`), and the private `gitAfterVerify` and `isSha` of `packages/cli/src/load/fs.ts`. Produces:
`DONE_S_RULES`, the host fact `reviewFacts`, `gitReviewFact` and `gitAfterReview`. Task 7 adds `DONE_S_RULES` to the
rule-id scan in `skills.test.ts`.

Test first, appended to `packages/cli/test/lane-s.test.ts`; add `REPORT` and `junit` to its import from
`../../../test/helpers/lane.js`:
- `it('risk:complex-branching lane S gate done passes a reviewed change and fails on a commit after it an unclean review lines after the verdict a failed suite and edited sections', ..., 120_000)`.
  `REVIEW = '## Round 1\n\nNo findings\n\nverdict: converged\n'`, `RP = 'accord/tickets/S-1/review.md'`,
  `PASSED = junit({ 'a#b': 'passed' })`, and
  `fails = async (rule) => { const r = await run(['gate', 'done', 'S-1', '--json'], repo); expect(r.code).toBe(1); expect(JSON.parse(r.out).findings.map((f) => f.rule)).toContain(rule); }`.
  `hard = () => gitRun(repo, 'reset', '-q', '--hard', 'HEAD~1')`. Steps, in order:
  1. `repo = repoWith({ 'accord/config.yml': CONFIG, 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }), 'src/a.ts': 'a\n', [REPORT]: PASSED })`;
     `commitMsg(repo, 'base')`; `gitRun(repo, 'switch', '-q', '-c', 't/S-1')`.
  2. `gate ready S-1` exits 0; `commitMsg(repo, 'ready: S-1')`. Write `src/a.ts` as `'b\n'`; `commitMsg(repo, 'change')`.
  3. Write `RP` as `REVIEW`; `commitMsg(repo, 'review: S-1')`. `gate done S-1` exits 0.
  4. A records-only commit after it: write `accord/tickets/S-1/ledger.md` as `'## Rulings\n'`, `commitMsg`; exits 0;
     `hard()`.
  5. A code commit after it: write `src/b.ts`, `commitMsg(repo, 'after review')`;
     `fails('gate.commit-after-review')`; `hard()`.
  6. A code commit after it on a detached HEAD, where the claim branch `t/S-1` still ends at the review commit:
     `gitRun(repo, 'switch', '-q', '--detach')`, write `src/d.ts` as `'d\n'`, `commitMsg(repo, 'after review detached')`;
     `fails('gate.commit-after-review')`; `gitRun(repo, 'switch', '-q', 't/S-1')`.
  7. A failed suite: write `REPORT` as `junit({ 'a#b': 'failed' })` without committing;
     `fails('gate.suite-not-passed')`; write `REPORT` as `PASSED` again.
  8. Dirty: write `RP` as `REVIEW.replace('No findings', 'No findings here')` without committing;
     `fails('gate.review-uncommitted')`; write `RP` as `REVIEW` again.
  9. Uncommitted: `gitRun(repo, 'reset', '-q', '--soft', 'HEAD~1')`; `fails('gate.review-uncommitted')`; then
     `commitMsg(repo, 'review: S-1')`.
  10. Lines after the verdict: write `RP` as `REVIEW + 'x\n'`, `commitMsg`; `fails('gate.review-trailing')`; `hard()`.
  11. Edited after Ready: change the Understood line of `accord/tickets/S-1.md` to
      `The export button writes a tsv file.`, `commitMsg`; `fails('gate.sections-changed')`; `hard()`.
  12. Code in the review's own commit: `hard()` (back to `change`), write `RP` as `REVIEW` and `src/c.ts` as `'c\n'`,
      `commitMsg(repo, 'review: S-1')`; `fails('gate.review-commit-code')`; `hard()`.
  13. D-12: write `RP` as `'## Round 5\n\nMust 1: x — src/a.ts:1 — open\n\nverdict: accepted-by-owner "ship it"\n'`,
      `commitMsg(repo, 'review: S-1')`; `gate done S-1` exits 0.
  14. A fix between the last round's record and a verdict committed apart: `hard()` (back to `change`), write `RP`
      as `'## Round 1\n\nNo findings\n'`, `commitMsg(repo, 'review: S-1 round 1')`; write `src/e.ts` as `'e\n'`,
      `commitMsg(repo, 'fix after round')`; write `RP` as `REVIEW`, `commitMsg(repo, 'review: S-1 verdict')`;
      `fails('gate.commit-after-review')`.
  15. A verdict committed apart with nothing between: `gitRun(repo, 'reset', '-q', '--hard', 'HEAD~2')` (back to the
      round 1 record), write `RP` as `REVIEW`, `commitMsg(repo, 'review: S-1 verdict')`; `gate done S-1` exits 0.
  16. Code in the last round's own commit, with the verdict committed apart:
      `gitRun(repo, 'reset', '-q', '--hard', 'HEAD~2')` (back to `change`), write `RP` as `'## Round 1\n\nNo findings\n'`
      and `src/e.ts` as `'e\n'`, `commitMsg(repo, 'review: S-1 round 1')`; write `RP` as `REVIEW`,
      `commitMsg(repo, 'review: S-1 verdict')`; `fails('gate.review-commit-code')`. Then
      `r = await run(['gate', 'done', 'S-1', '--json'], repo)`: the finding of `JSON.parse(r.out).findings` with rule
      `gate.review-commit-code` has a reason containing `src/e.ts`, and no finding has rule `gate.commit-after-review`
      (the verdict commit changes only records).

Interface:
- `model/snapshot.ts`: `SnapshotInput` and `RepoSnapshot` gain
  `reviewFacts?: Record<string, { clean: boolean; files?: string[] }>;` with the comment: ticket id to its
  `review.md`; `clean` when the file is committed with no uncommitted change; `files`, every path changed by the
  review commit, the last commit whose change to review.md adds or removes a `## Round ` line; absent when the host
  supplies none. `load/snapshot.ts` carries it through exactly as it
  carries `afterVerify` (`load/snapshot.ts:194`).
- `gate/lane-s.ts` (new), every check `[]` unless the ticket exists with `lane: S`; `file` is the ticket file unless
  stated:
  - `readyMissing`: no `ac_hash` →
    `gate ready has recorded no ac_hash for this lane S ticket; run accord gate ready <id>` (pointer `/ac_hash`).
  - `sectionsChanged`: `ac_hash` differs from `laneSHash(ticket)` →
    `## Understood or ## Done when changed since gate ready: ac_hash records <r>, they hash to <n> now; run accord gate ready <id> and review again`.
  - The rest read `review = workOf(snapshot, id)?.review` and are `[]` when it is undefined (`gate.review-missing`
    owns that); `file` is `review.file`:
    - `reviewTrailing`: `review.trailing` →
      `a line follows the verdict in review.md; the verdict is its last line`.
    - `reviewUncommitted`: `f = snapshot.reviewFacts?.[id]` read with `Object.hasOwn`. Absent →
      `the host loaded no commit facts for review.md, so its commit cannot be checked`. `!f.clean` →
      `review.md is not committed, no commit of it records a ## Round line, or it has uncommitted changes; commit it alone`.
    - `reviewCommitCode`: `f.files` defined and not `ownRecordsOnly(id, f.files)` →
      `the commit that records the last review round also changes <paths outside the records, first five, space-separated>; commit the change before its review`.
    - `commitAfterReview`: `after = snapshot.afterVerify?.[id]` read with `Object.hasOwn`. Absent →
      `the host could not list the commits after review.md, so a change after review cannot be ruled out`. Otherwise
      one finding per `handMade` commit:
      `commit <sha> after the review changes <its files outside the records, space-separated, or "what git could not show">; a change after review needs another round and a new review.md`.
- `gate/rules.ts`: hoist the existing inline rows of `gate.review-missing`, `gate.review-unconverged`,
  `gate.suite-not-passed` and `gate.commit-trailer` into consts (`REVIEW_MISSING`, `REVIEW_UNCONVERGED`,
  `SUITE_NOT_PASSED`, `COMMIT_TRAILER`) used by `DONE_RULES` at the same positions, so `DONE_RULES` is unchanged. Add
  `export const DONE_S_RULES: readonly GateRule[] = [TICKET_UNKNOWN, SECTION_EMPTY, gate.ready-missing, gate.sections-changed, REVIEW_MISSING, REVIEW_UNCONVERGED, gate.review-trailing, gate.review-uncommitted, gate.review-commit-code, gate.commit-after-review, SUITE_NOT_PASSED, COMMIT_TRAILER]`,
  each new row `level: 'error'` on both profiles with the check named above. `SUITE_NOT_PASSED` is the lane M suite
  rule, reading the report `tests.report` names, which CI's full-suite step writes (ledger Ruling of plan round 1.6);
  the lane S session still runs only the affected tests (Task 7).
- `gate/index.ts` `gateDone`: runs `DONE_S_RULES` when the ticket exists with `lane: S`, else `DONE_RULES` as today.
  The ticket-scoped lint findings join either table as they do today (`gate/index.ts:69-74`).
- `cli/src/load/fs.ts`. Both functions below use `p = ':(literal)accord/tickets/' + id + '/review.md'` and options
  `o = { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 }`, and both
  anchor on one commit, the review commit:
  - A private `function reviewCommit(root: string, id: string): string | undefined`, the last commit on HEAD whose
    change to review.md adds or removes a `## Round ` line:
    `sha = execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '-G', '^## Round ', '--format=%H', 'HEAD', '--', p], o).trim()`;
    returns `sha` when `isSha(sha)` (already in `fs.ts`), else undefined; a spawn that throws returns undefined.
    (`git log -G` matches each added or removed line of the diff restricted to the pathspec, so `^` anchors at the
    line start.) Anchoring on the round commit, not on the last commit touching review.md, means that with a verdict
    committed apart the code checked as the review's own commit is the round commit's, and the verdict commit falls
    after the review, where it must change only the ticket's records (plan rounds 2.1 and 3.1).
  - `export function gitReviewFact(root: string, id: string): { clean: boolean; files?: string[] }`:
    1. `dirty = execFileSync('git', ['status', '--porcelain', '-z', '--untracked-files=all', '--', p], o) !== ''`.
    2. `sha = reviewCommit(root, id)`. Undefined → `{ clean: false }`.
    3. `files` = `execFileSync('git', ['-c', 'log.showSignature=false', 'show', '--no-show-signature', '-z', '--format=', '--name-only', '--no-renames', sha], o)`
       split on `\0`, each token with one leading `\n` removed, empty tokens dropped.
    4. Return `{ clean: !dirty, files }`. Any spawn that throws returns `{ clean: false }`: the gate then fails closed.
  - `export function gitAfterReview(root: string, id: string): AfterVerify | undefined`: the commits on HEAD, the
    commit being gated whatever branch, claim ref or fork it came from, after `commit = reviewCommit(root, id)`.
    Undefined `commit` returns undefined. Otherwise `r = gitAfterVerify(root, { [id]: { commit, tips: ['HEAD'] } })`
    and return `Object.hasOwn(r, id) ? r[id] : undefined`. Undefined makes `gate.commit-after-review` fail closed.
    A fix committed between the last round's record and a verdict committed apart is then a `handMade` commit after
    the review (step 14), the verdict commit itself changes only records (step 15), and code in the round commit is
    `gate.review-commit-code`'s (step 16).
- `cli/src/commands/gate.ts`: when `which === 'done'` and the ticket exists (`Object.hasOwn`) with `lane: S`, the
  snapshot passed to `gateDone` is `withCommits` plus `reviewFacts: { [id]: gitReviewFact(ctx.root, id) }` and an
  `afterVerify` whose entry for `id` is `gitAfterReview(ctx.root, id)`: build it as
  `Object.fromEntries(Object.entries(ctx.snapshot.afterVerify ?? {}).filter(([k]) => k !== id))`, then set `[id]` only
  when `gitAfterReview` returned a value. The entry the status loader read from the claim ref never reaches the lane S
  gate.

Must not change: `DONE_RULES` and `gateDone` for every lane M and 0.1.0 ticket (`lane-done.test.ts`, `gate.test.ts`);
`gateReady`; the `ac_hash` and `plan_hash` writes in `gate.ts`; `afterVerify` loading in `loadParts`, and
`reviewStartOf` and `gitAfterVerify` themselves (`after-verify.test.ts`).

## Task 5: Lint stops a review left from lane S and a lane S ticket holding lane M records, and lane S keeps a repository out of the test policy
covers: D-03, D-09
files: packages/core/src/lint/ticket.ts, packages/core/src/lint/tests.ts, packages/core/src/lint/rules.ts, packages/core/test/lane-s.test.ts (new)
verify: packages/core/test/lane-s.test.ts#risk:complex-branching-a-lane-M-ticket-holding-a-review-left-from-lane-S-and-no-plan-is-a-lint-error, packages/core/test/lane-s.test.ts#risk:security-a-lane-S-ticket-holding-an-approval-scenarios-or-a-plan-fails-lint-and-both-gates, packages/core/test/lane-s.test.ts#risk:complex-branching-a-lane-S-ticket-alone-does-not-turn-on-the-test-policy

Consumes: `snapshot.work` (loaded under every ticket with `lane:`), `t.scenarios`, `untracedTests`, and the gates'
ticket-scoped lint findings (`gate/index.ts:69-74`). Produces: the rules `lint.review-without-plan` (ledger Ruling 12)
and `lint.lane-s-lane-m-records`, and the test-policy rule of ledger Ruling 9.

Tests first, appended to `packages/core/test/lane-s.test.ts`; add `lintSnapshot` from `../src/lint/index.js`,
`gateReady` and `gateDone` from `../src/gate/index.js`, and `LANE_BODY`, `PLAN`, `REPORT`, `junit` from
`../../../test/helpers/lane.js`. `rules = (s) => lintSnapshot(s).findings.map((f) => [f.rule, f.file, f.level])`.
- `it('risk:complex-branching a lane M ticket holding a review left from lane S and no plan is a lint error')`:
  - `laneTicket('T-1')` with `accord/tickets/T-1/review.md` `'verdict: converged\n'` and no plan: `rules` contains
    `['lint.review-without-plan', 'accord/tickets/T-1/review.md', 'error']`.
  - Adding `accord/tickets/T-1/plan.md` as `PLAN`: no `lint.review-without-plan` finding.
  - A lane S ticket `S-1` with that review and no plan, and a lane L ticket with a plan and a review: no such finding.
- `it('risk:security a lane S ticket holding an approval scenarios or a plan fails lint and both gates')`
  (an approved lane M ticket switched in place to `lane: S` must not skip approval, plan, verify and the suite):
  - `A = 'approved_hash: "fnv1a64:0123456789abcdef"'`; `s1 = snap({ 'accord/tickets/S-1.md': S(LANE_S_BODY, [A]) })`.
    `rules(s1)` contains `['lint.lane-s-lane-m-records', 'accord/tickets/S-1.md', 'error']`, its reason contains
    `approved_hash`; `gateReady(s1, 'S-1')` and `gateDone(s1, 'S-1')` each have verdict `fail` and a finding with rule
    `lint.lane-s-lane-m-records`.
  - `S(LANE_S_BODY + '\n' + LANE_BODY)` (scenarios tagged `@ac-1` and `@ac-2`): the finding, its reason containing
    `@ac-n scenarios`.
  - `S()` with `accord/tickets/S-1/plan.md` as `PLAN`: the finding, its reason containing `plan.md`.
  - `S()` alone, and `laneTicket('T-1', { frontmatter: [A] })` (lane M, approved): no such finding.
- `it('risk:complex-branching a lane S ticket alone does not turn on the test policy')`:
  - Files: `CONFIG`, a lane S ticket `S-1`, and `[REPORT]: junit({ 'a#untraced': 'passed' })`. No finding has rule
    `lint.test-untraced`.
  - Adding `laneTicket('T-1')` (lane M): exactly one `lint.test-untraced` finding.

Interface:
- `lint/ticket.ts`:
  - `export const reviewWithoutPlan: Rule['check']`: for each typed ticket whose `lane` is `M`, `L` or `P`, with
    `workOf`-style access `snapshot.work?.[t.id]` (read with `Object.hasOwn`) having `review` and no `plan`:
    `{ file: review.file, reason: 'review.md is left from lane S; a lane M ticket is reviewed after its plan, so remove it with git rm' }`.
  - `export const laneSLaneMRecords: Rule['check']`: for each typed ticket whose `lane` is `S`, the list, in this
    order, of `approved_hash` when `frontmatter.approved_hash` is defined, `@ac-n scenarios` when some
    `t.scenarios` entry has an `acTag`, and `plan.md` when `snapshot.work?.[t.id]` (read with `Object.hasOwn`) has a
    `plan`. A non-empty list gives one draft:
    `{ file: t.file, reason: 'a lane S ticket holds ' + list.join(' and ') + ', which only a lane M ticket has; an approved ticket never moves to lane S, and a ticket lifted from lane S changes its lane to M' }`.
    The gates need no row of their own: `gateReady`, `gatePlan` and `gateDone` already add every ticket-scoped lint
    error, so this rule fails lint, Ready and Done alike.
- `lint/rules.ts`: `{ id: 'lint.review-without-plan', level: 'error', profiles: ['build', 'maintain'], check: reviewWithoutPlan }`
  and `{ id: 'lint.lane-s-lane-m-records', level: 'error', profiles: ['build', 'maintain'], check: laneSLaneMRecords }`,
  in that order, after `lint.heading-missing`.
- `lint/tests.ts` `testUntraced`: the repository opts in only when some ticket's `lane` is defined and not `S`
  (ledger Ruling 9). Update the comment above it to say so.

Must not change: every other lint finding; `untracedTests`; `gate.test-untraced` at Done for lane M tickets; a lane
M ticket with both a plan and a review (`lane-done.test.ts`, `lane-status.test.ts`, `work.test.ts`); every lane M,
L, P and 0.1.0 ticket's lint result.

## Task 6: accord approve refuses a lane S ticket, and its review package starts at the fork point
covers: D-04, D-11
files: packages/cli/src/commands/approve.ts, packages/cli/src/commands/review-package.ts, packages/cli/test/lane-s.test.ts (new)
verify: packages/cli/test/lane-s.test.ts#risk:security-approve-refuses-a-lane-S-ticket-and-writes-nothing, packages/cli/test/lane-s.test.ts#risk:complex-branching-the-review-package-of-a-lane-S-ticket-starts-at-the-fork-point-from-the-default-branch

Consumes: `requireLaneTicket`, `defaultRefOf`, `workOf`. Produces: the lane S refusal of `approve` (ledger Ruling 11)
and the lane S default base of `review-package`, which Task 7's review rounds run.

Tests first, appended to `packages/cli/test/lane-s.test.ts`:
- `it('risk:security approve refuses a lane S ticket and writes nothing', ..., 120_000)`: `makeLaneRepo` plus a lane
  S `accord/tickets/S-1.md`; `before` = its bytes. `run(['approve', 'S-1'], repo)` exits 2, `err` contains `lane S`
  and `accord gate ready S-1`, and the file's bytes equal `before`. `run(['approve', 'T-1'], repo)` still exits 0.
- `it('risk:complex-branching the review package of a lane S ticket starts at the fork point from the default branch', ..., 120_000)`:
  - `repo = repoWith({ 'accord/config.yml': CONFIG, 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }), 'src/a.ts': 'a\n' })`;
    `commitMsg(repo, 'base')`; `main = gitRun(repo, 'branch', '--show-current').trim()`.
  - `switch -q -c t/S-1`, write `src/b.ts`, `commitMsg(repo, 'change')`. `switch -q <main>`, write `src/c.ts`,
    `commitMsg(repo, 'main moves')`. `switch -q t/S-1`.
  - `run(['review-package', 'S-1'], repo)` exits 0; `out` contains `src/b.ts` and `(no plan)`, and does not contain
    `src/c.ts`.
  - `run(['review-package', 'S-1', '--base', 'HEAD~1'], repo)` exits 0 (an explicit base still wins).

Interface:
- `approve.ts`: after `requireLaneTicket`, when `ticket.frontmatter.lane === 'S'` throw
  `new UsageError(ticket.file + ' is a lane S ticket, which needs no approval: run accord gate ready ' + id)`, before
  any hash or write.
- `review-package.ts`: `ticket = requireLaneTicket(ctx, id)`. `base = options.base ?? (lane S ? defaultRefOf(ctx.root) : workOf(ctx.snapshot, id)?.plan?.baseline)`.
  Undefined for lane S throws
  `no --base given and no default branch: none of origin/HEAD, origin/main, origin/master, main or master resolves`;
  for any other lane the existing message. The rest of the command is unchanged: `<ref>...HEAD` already diffs from the
  fork point, and `undeclaredFiles` already prints `(no plan)`.

Must not change: `approve` on lane M, L and P; `review-package` with `--base`, with a plan baseline, and its
`without <default>` form after a merge (`after-verify.test.ts`, `lane-commands.test.ts`).

## Task 7: The accord skill lifts S to M by four conditions and works every lane S change from its own ticket
covers: @ac-1, @ac-4, D-02, D-05, D-06, D-07, D-08, D-09, D-11, D-12
files: packages/core/skills/accord/SKILL.md, packages/core/skills/accord/lane-s.md (new), packages/core/skills/accord/ids.md, packages/core/skills/accord/worktree.md, packages/core/agents/reviewer.md, packages/core/src/generated/skills.ts, packages/core/src/generated/agents.ts, .claude/skills/accord/SKILL.md, .claude/skills/accord/lane-s.md (new), .claude/skills/accord/ids.md, .claude/skills/accord-debug/ids.md, .claude/skills/accord-verify/ids.md, .claude/skills/accord/worktree.md, .claude/skills/accord-debug/worktree.md, .claude/skills/accord-verify/worktree.md, .claude/agents/accord-reviewer.md, packages/core/test/skills.test.ts, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-1-the-accord-skill-lifts-lane-S-to-M-only-by-the-four-conditions-left (@ac-1), packages/core/test/stage-skills.test.ts#ac-4-every-lane-S-change-is-worked-from-its-own-lane-S-ticket-in-its-worktree (@ac-4)

Consumes: the commands of Tasks 1, 4 and 6 (`new ticket --lane S`, `gate ready`, `gate done`, `review-package`,
`worktree open`), which `skill-commands.test.ts` checks exist. Produces: the lane S procedure every runtime receives,
whether `accord new ticket --worktree` prints `enter:` or `stop:`. `scripts/benchmark.mjs` is not changed: it counts
lane S work by ticket id as it does today (D-06).

Tests first, appended at the end of `packages/core/test/stage-skills.test.ts`, with
`flat = (p) => (files.find((f) => f.path === p)?.text ?? '').replace(/\s+/g, ' ')`:
- `it('ac-1 the accord skill lifts lane S to M only by the four conditions left')`:
  - `acc = flat('.claude/skills/accord/SKILL.md')` contains exactly once
    `Any of these lifts S to M, and nothing else: a public interface or schema changes; auth, money, or data deletion is touched; more than one plausible reading; more than about five hand-written files expected, generated and rendered copies not counted.`
  - `acc` contains `lifts S to M` exactly once and contains neither `user-visible` nor `about three files`.
  - `flat('.claude/skills/accord/lane-s.md')` is non-empty and contains neither `user-visible` nor `lifts S to M`.
- `it('ac-4 every lane S change is worked from its own lane S ticket in its worktree')`:
  - `acc` as above. `s = acc.slice(acc.indexOf('- **S.**'), acc.indexOf('- **M.**'))` contains
    `` `accord new ticket <id> --lane S --worktree` `` and `` `./lane-s.md` ``.
    `cont = acc.slice(acc.indexOf('## Continue'), acc.indexOf('## Pick up'))` contains `` `Lane: S` `` and
    `` `./lane-s.md` ``.
  - `ls = flat('.claude/skills/accord/lane-s.md')` contains each of: `never in the main checkout`,
    `` `accord worktree open <id>` ``, `` `## Understood` ``, `` `## Done when` ``, `` `accord gate ready <id>` ``,
    `Make no other change before that`, ``Never run `accord approve` ``, `you make the change yourself`,
    `` `tests.affected` ``, `over the changed files`, `first write a test that reproduces it`,
    ``fresh `accord-reviewer`, lens `both` ``, `` `accord/tickets/<id>/ledger.md` when it exists ``,
    `` `## Round <n>` ``, `commit `review.md` alone at once`, `the round and its verdict are one commit`,
    `` `Short title in business language` ``, `` `Keys: …` ``, `no Must open`, `a fix no reviewer has seen never ships`,
    `There is no final reviewer`, `At most five rounds`, `stop and report the open findings to the owner`,
    `the next round is one after the last`, `` `verdict: converged` ``, `` `verdict: accepted-by-owner ``,
    `` `git -C "<path>" commit ``, `pull request`, `no intent interview, approval, approach, plan, executor or verify`.
  - In `ls`, `` `accord gate ready <id>` `` comes before `**Change.**`, `reproduces it` before `then fix it`, and
    `` `## Round <n>` `` before `**Verdict.**`.
  - `flat('.claude/skills/accord/worktree.md')` contains
    ``except the people entry below and a lane S ticket's `## Understood` and `## Done when` lines``.
  - `flat` of `.claude/agents/accord-reviewer.md` (from `agentTargets(config)`) contains
    `` `## Understood` and `## Done when` `` and `a ledger only once a Ruling is written`, and not `has no ticket, package, or ledger`.
- Existing tests to update:
  - `stage-skills.test.ts` `REQUIRED.accord`: remove `'lens `both`'` and `'git add -N'` (the lane S review moves to
    `lane-s.md` and reads committed work); add `'./lane-s.md'` and `'--lane S --worktree'`. Every other phrase stays.
  - `skills.test.ts`: `VERDICT` becomes `/\b(?:Ready|Done)\b(?! when\b)/`, and its comment says a `Done when`
    heading or label names no gate state. Import `DONE_S_RULES` beside `DONE_RULES` and add it to the `ruleIds`
    spread.

Text, `packages/core/skills/accord/SKILL.md`:
- Frontmatter `loads:` becomes `[accord/ids.md, accord/lane-s.md, accord/worktree.md, shared/ask.md, shared/failure.md]`.
- Continue step 4 starts `4. Otherwise, when it prints `Lane: S`, follow `./lane-s.md`. Else load the stage skill
  for the stage it prints:` and goes on exactly as today from `` `intent` → ``.
- The lift paragraph (lines 67-69) becomes, wrapped near 76 columns:
  "Any of these lifts S to M, and nothing else: a public interface or schema changes; auth, money, or data deletion
  is touched; more than one plausible reading; more than about five hand-written files expected, generated and
  rendered copies not counted." The lane table is unchanged.
- The `- **S.**` bullet (lines 71-79) becomes:
  "- **S.** Run `accord new ticket <id> --lane S --worktree`; when config.yml has `people`, follow `./ids.md` and run
  it with `--type <story|bug>` and no id instead. Then follow `./lane-s.md`. A request that carries
  `Understood: …` and `Done when: …` from a drop is lane S without asking again."
- Rules, first bullet: "- A lane only rises. Complexity found mid-task lifts the lane: stop, say so, and re-enter at
  the new lane's first incomplete stage; lane S lifts as `./lane-s.md` says. A lane never drops, except at intent as
  `accord-intent` says."
- Nothing else changes. Size after the edit: about 4840 bytes and 98 lines, under 5120 and 120.

Text, `packages/core/skills/accord/ids.md`, `## Assigning`: "adding `--worktree` when the lane is M" becomes "adding
`--worktree` when the lane is M or S". Nothing else in the file changes in this task.

Text, `packages/core/skills/accord/worktree.md`, the `stop:` bullet: "never edit a file there except the people entry
below, and never start the next stage from this session." becomes "never edit a file there except the people entry
below and a lane S ticket's `## Understood` and `## Done when` lines, and never start the next stage from this
session." Nothing else in the file changes.

Text, `packages/core/skills/accord/lane-s.md` (new), exactly, each code span on one line:
```
---
kind: reference
---

# Lane S

A lane S change is worked from its own lane S ticket, in that ticket's worktree, never in the main checkout. It has
no intent interview, approval, approach, plan, executor or verify: you make the change yourself.

## Start

- New request: the accord skill ran `accord new ticket <id> --lane S --worktree`. Before you follow the `enter:` or
  `stop:` line it printed as `./worktree.md` says, write the title and the two lines of step 1 into
  `<path>/accord/tickets/<id>.md`, asking step 1's question first when it needs one. A request moved from a lane M
  ticket carries `Title: …` and `Keys: …`: write that title, and each `Keys:` line into the frontmatter in place of
  the template's line for that key, commented or not. Then run
  `git -C "<path>" commit -m "ticket: <id> understood" -- accord/tickets/<id>.md` and
  `git -C "<path>" push -u origin <branch>`. After `enter:`, go on at step 1 in that worktree; after `stop:`, the
  session opened there finds the two lines in the ticket.
- Pick up: run `accord worktree open <id>` and follow `./worktree.md`.
- Continue: `accord anchor` prints `Lane: S` and the stage. Resume at step 1 for `intent`, step 2 for `build`, step 4
  for `review`, and step 6 for `done`.

## Steps

1. **Understood.** When `## Understood` and `## Done when` in `accord/tickets/<id>.md` each hold a line, keep them.
   Otherwise write one line under `## Understood`: the change as you understood it, and one line under
   `## Done when`: the observable result that ends the work. When the request carried `Understood: …` and
   `Done when: …`, use those lines. Go on without waiting only when the request has a concrete anchor (file, symbol,
   error message, or expected behaviour) and one plausible reading; otherwise ask exactly one question, as
   `./ask.md` says, and wait. When `title:` still reads `Short title in business language`, replace it with a few
   words naming the change in business language. Run `accord gate ready <id>` and fix what it prints until it exits
   0, then commit the ticket. Make no other change before that. Never run `accord approve`.
2. **Change.** Make the change in this worktree. For a bug, first write a test that reproduces it and see it fail,
   then fix it. A test you add carries `risk:<kind>` in its name.
3. **Tests.** Run the `tests.affected` command from `accord/config.yml` over the changed files, or `tests.full` when
   `tests.affected` is not configured or finds no test file. Fix what fails, then commit the change.
4. **Review rounds.** Round <n> runs `accord review-package <id>` into a file outside the working tree and
   dispatches one fresh `accord-reviewer`, lens `both`, with the paths of the ticket file, that file, and
   `accord/tickets/<id>/ledger.md` when it exists. Append what it reports to `accord/tickets/<id>/review.md` under
   `## Round <n>`, each finding with its severity, what it is and where it is, or `No findings`, and commit
   `review.md` alone at once; when you stop after this round with no Must open, first append step 5's verdict, so
   the round and its verdict are one commit. When the round reports a Must, fix every Must and Should yourself, run
   step 3 again, commit, and start the next round with a new reviewer. When it reports no Must open, either stop
   there, leaving its Shoulds open in the record, or fix them the same way and run another round: a fix no reviewer
   has seen never ships. There is no final reviewer and no model tier-up. At most five rounds, counted from the
   `## Round <n>` sections of `review.md`: when the fifth still reports a Must, commit its record, stop and report
   the open findings to the owner; never report the work finished. Resumed at `review`, the next round is one after
   the last `## Round <n>` in `review.md`; when that round reported a Must whose fix is not yet committed, make and
   commit the fix first.
5. **Verdict.** The last line of `review.md` is `verdict: converged` when the last round reported no Must open, or
   `verdict: accepted-by-owner "<the owner's words>"` when the owner accepts the open findings at the cap; that one
   is committed alone, right after the fifth round's record. Nothing follows that line. `accord gate done` fails on
   any commit after the last round's record that changes more than the ticket's records: a change after it needs
   another round and a new verdict.
6. **Pull request.** Run `accord gate done <id>` and fix what it prints. Push the branch with
   `git push -u origin <branch>` and open a pull request with `gh pr create --fill` when `gh` is available, otherwise
   ask the owner to open it. It waits for the owner's merge.

## Lift to lane M

When the work meets a lift condition of the accord skill, stop and say which one. On the owner's yes, in this same
ticket, branch and worktree:

1. In `accord/tickets/<id>.md`, change `lane: S` to `lane: M` and add the lane M sections, each empty, after the
   existing ones: `## Intent`, `## Acceptance criteria`, `## Vetoes`, `## Decisions`, `## Corrections` when absent,
   then the open questions and approach sections the lane M template has.
2. Remove `accord/tickets/<id>/review.md` with `git rm` when it exists.
3. Run `git merge-base HEAD <origin's default branch>` and write into `accord/tickets/<id>/ledger.md`, under
   `## Rulings`: `Ruling: lifted from lane S; the plan baseline is the fork point <sha> — the review then reads the lane S code too — cost if wrong: that code goes unreviewed`.
4. Commit, then load `accord-intent` and start the intent interview. Code already committed stays on the branch.

## Rules

- A correction from the owner goes verbatim under `## Corrections` in the ticket, added with the first one, before
  any other action.
- Every decision that is not the owner's is a Ruling in `accord/tickets/<id>/ledger.md` under `## Rulings`:
  `Ruling: <what> — <why> — <cost if wrong>`.
```
(The lift step 1 names the last two sections in words, so no paragraph pairs a heading `PROMOTED` lists with a
command. Step 4 commits each round's record before its fixes and a converged verdict with the last round's record,
so a fix made after the last round is a commit after `review.md`, which `accord gate done` and the stage both catch.
When a verdict is committed apart anyway, `accord gate done` still catches a fix before it and code inside the last
round's record, because Task 4's `gitReviewFact` and `gitAfterReview` both anchor on the last commit that adds or
removes a `## Round` line; the stage, which starts at the last commit touching `review.md`, can then read `done`
while the gate fails, and the gate is what CI runs.)

Text, `packages/core/agents/reviewer.md` line 11: the sentence "A lane S change has no ticket, package, or ledger: one
file holds the request's two lines and the diff." becomes "A lane S ticket has no plan or acceptance criteria, and a
ledger only once a Ruling is written, its path then given to you: its `## Understood` and `## Done when` are what the
change must meet, and lens `intent` quotes them."

Then re-render as the preamble says and run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/core/test/agents.test.ts packages/cli/test/skill-commands.test.ts packages/cli/test/skills-sync.test.ts`.

Must not change: every phrase `REQUIRED.accord` keeps and every other `stage-skills.test.ts` assertion on
`.claude/skills/accord/SKILL.md` (the M bullet with two `--lane M --worktree`, Continue, Pick up, the named-ticket
paragraph, `` `done` → `accord-verify` at step 6 ``); every phrase `stage-skills.test.ts` asserts on `worktree.md`
(`except the people entry below`, `Never change directory into the worktree`, `editing nothing`, the `enter:` bullet);
`accord/SKILL.md` never names `accord drop` (`stage-skills.test.ts:672`) or `accord next` (`skills-sync.test.ts:598`);
the rest of `ids.md`, `worktree.md` and `reviewer.md`.

## Task 8: A queued lane M ticket drops to lane S only at intent, on the owner's yes, and lint refuses it after approval
covers: @ac-5, D-03, D-10, D-11
files: packages/core/src/lint/dropped.ts, packages/core/src/lint/rules.ts, packages/core/skills/accord/ids.md, packages/core/skills/intent/SKILL.md, packages/core/skills/plan/SKILL.md, packages/core/skills/shared/failure.md, packages/core/agents/planner.md, packages/core/src/generated/skills.ts, packages/core/src/generated/agents.ts, .claude/skills/accord/ids.md, .claude/skills/accord-debug/ids.md, .claude/skills/accord-verify/ids.md, .claude/skills/accord-intent/ids.md (new), .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-plan/SKILL.md, .claude/skills/accord/failure.md, .claude/skills/accord-debug/failure.md, .claude/skills/accord-verify/failure.md, .claude/agents/accord-planner.md, packages/core/test/lane-s.test.ts (new)
verify: packages/core/test/lane-s.test.ts#ac-5-a-queued-lane-M-ticket-drops-to-lane-S-only-at-intent-on-the-owners-yes (@ac-5)

Consumes: `accord drop` (ST-LN-34, `packages/cli/src/commands/drop.ts`), whose own lint check then refuses the drop
of an approved ticket to lane S; Task 7's S bullet and `lane-s.md`, whose lift step writes the fork point Ruling.
Produces: the rule `lint.dropped-approved`, the `## Moving to lane S` section of `ids.md`, the intent rule, the lifted
plan baseline (D-11) in the plan skill and the planner, and the lane S line of `failure.md`.

Test first, appended to `packages/core/test/lane-s.test.ts`; add `skillTargets` and `agentTargets` from
`../src/index.js` and `LANE_BODY` from `../../../test/helpers/lane.js` when Task 5 has not added it.
`cfg = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] }`,
`files = skillTargets(cfg)`, `flat(p)` as in Task 7.
- `it('ac-5 a queued lane M ticket drops to lane S only at intent on the owners yes')`:
  - `intent = flat('.claude/skills/accord-intent/SKILL.md')`; `rule = intent.slice(intent.indexOf('**Lane S.**'))`
    is non-empty and starts after `intent.indexOf('## Rules')`. `rule` contains `fits lane S`,
    `` `accord status --json` ``, `` `depends_on` ``, `` `git status --porcelain --untracked-files=all` ``,
    `propose dropping it to lane S`, `only on the owner's yes`, `` `## Moving to lane S` in `./ids.md` `` and
    `From step 9 on, a lane never drops`.
  - `ids = flat('.claude/skills/accord-intent/ids.md')` equals `flat('.claude/skills/accord/ids.md')`;
    `move = ids.slice(ids.indexOf('## Moving to lane S'))` contains
    `` `git status --porcelain --untracked-files=all` ``, `do not drop`, `commit only those records`, `` `git add -A` ``,
    `` `accord drop <id> --reason "moved to lane S"` ``, `step 1 of`, `(lane S, moved from <id>)`,
    `Title: <its title> Keys: <its depends_on, tracker, priority, ui and design lines`,
    `` `accord new ticket --lane S --worktree` `` and `a new id`, and does not contain `commit every change`.
  - `flat('.claude/skills/accord/SKILL.md')` contains `lane S without asking again` and `--lane S --worktree`.
  - Plan baseline of a lifted ticket: `flat('.claude/skills/accord-plan/SKILL.md')` contains
    ``Run `git rev-parse HEAD` (lifted from lane S: the fork point in its ledger Ruling)`` and
    `` `baseline: <that commit>` ``; `flat` of `.claude/agents/accord-planner.md` from `agentTargets(cfg)` contains
    `or, for a ticket lifted from lane S, the fork point its ledger Ruling names`.
  - Lint: `T = (fm, reason) => laneTicket('M-1', { frontmatter: ['status: dropped', ...fm], body: LANE_BODY + '\n## Dropped\n' + reason + '\n' })`
    and `A = 'approved_hash: "fnv1a64:0123456789abcdef"'`. `lintSnapshot` of `T([A], 'moved to lane S')` has a finding
    `{ rule: 'lint.dropped-approved', file: 'accord/tickets/M-1.md', level: 'error' }`. `T([], 'moved to lane S')`
    and `T([A], 'no longer needed')` have none.

Interface:
- `lint/dropped.ts`: `export const droppedApproved: Rule['check']`: a ticket with `status: dropped`, an
  `approved_hash`, and a `## Dropped` section holding a comment-stripped line whose trimmed text equals
  `moved to lane S` ignoring case:
  `{ file: t.file, pointer: '/approved_hash', reason: 'an approved ticket never moves to lane S: approved_hash is set and ## Dropped says moved to lane S' }`.
- `lint/rules.ts`: `{ id: 'lint.dropped-approved', level: 'error', profiles: ['build', 'maintain'], check: droppedApproved }`
  after `lint.dropped-reason`.

Text, `packages/core/skills/accord/ids.md`: append at the end of the file:
```

## Moving to lane S

Only during the intent interview of a lane M ticket, on the owner's yes, as `accord-intent` says. In the ticket's
worktree, run `git status --porcelain --untracked-files=all`. When it lists a path other than
`accord/tickets/<id>.md` and paths under `accord/tickets/<id>/`, do not drop: name those paths, say the ticket stays
lane M, and stop. Otherwise commit only those records: run `git add -A`, which that check limits to them, and
`git commit -m "intent: <id> moved to lane S"` when anything is staged, push with
`git push -u origin <claim branch>`, and run `accord drop <id> --reason "moved to lane S"`; open its pull request and
close the session as step 1 of `## Dropping instead of renaming` says, and skip its first sentence and steps 2 to 6.
Then print one line for the owner to type in a new session opened in the main checkout, filled from the interview
and the ticket:
`/accord Understood: <one line> Done when: <one line> Title: <its title> Keys: <its depends_on, tracker, priority, ui and design lines, where present, joined by "; "> (lane S, moved from <id>)`.
That session takes lane S without asking and makes the new ticket, with a new id, by
`accord new ticket --lane S --worktree`, carrying that title and those keys into it as the lane S steps say.
```

Text, `packages/core/skills/intent/SKILL.md`:
- Frontmatter `loads:` becomes `[shared/ask.md, accord/ids.md]`.
- Append to `## Rules`:
  "- **Lane S.** Before step 9, when the interview shows the request fits lane S (none of the accord skill's four
  lift conditions holds), no ticket that `accord status --json` lists names this one in `depends_on`, and both
  `git diff --name-only <origin's default branch>...HEAD` and `git status --porcelain --untracked-files=all` list
  only `accord/tickets/<id>.md` and paths under `accord/tickets/<id>/`, propose dropping it to lane S, with the
  reason. Drop it only on the owner's yes, as `## Moving to lane S` in `./ids.md` says; otherwise say why it stays
  lane M. From step 9 on, a lane never drops."
- Size after the edit: about 4790 bytes and 84 lines, under 5120 and 120.

Text, `packages/core/skills/plan/SKILL.md` (D-11: the plan of a lifted ticket starts at the fork point that
`lane-s.md`'s lift step writes into the ledger, and `accord anchor` prints that Ruling at plan step 1):
- Opening paragraph: delete the sentence "The owner does not need to read the plan.", so the paragraph ends
  "You run it in the main session." and its third line is gone. No test names that sentence.
- Step 2: "Run `git rev-parse HEAD`," becomes "Run `git rev-parse HEAD` (lifted from lane S: the fork point in its
  ledger Ruling)," on the same line, with no rewrap.
- Step 2: "`baseline: <git rev-parse HEAD>`" becomes "`baseline: <that commit>`".
- Size: 5049 bytes and 89 lines before; the deletion removes 42 bytes and one line, the parenthesis adds 58 bytes,
  the baseline span removes 7: 5058 bytes and 88 lines, under 5120 and 120. Step 7 already asks the owner when product
  code changed since the baseline, which is how the plan asks about the lane S code (D-11).

Text, `packages/core/agents/planner.md` line 18: "- Frontmatter `baseline:` is the commit your caller gives you, the
output of `git rev-parse HEAD`." becomes "- Frontmatter `baseline:` is the commit your caller gives you: the output of
`git rev-parse HEAD`, or, for a ticket lifted from lane S, the fork point its ledger Ruling names."

Text, `packages/core/skills/shared/failure.md`: after the first paragraph, a paragraph of its own: "A lane S ticket
(`accord anchor` prints `Lane: S`) never reaches verify, so a failure in its work is not one: continue it as the
accord skill's lane S steps say, and the fix gets another review round."

Then re-render as the preamble says and run `npx vitest run packages/core/test/lane-s.test.ts packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/core/test/agents.test.ts packages/core/test/lint.test.ts packages/cli/test/skill-commands.test.ts packages/cli/test/skills-sync.test.ts packages/cli/test/drop.test.ts`.

Must not change: steps 1 to 6 of `## Dropping instead of renaming` and every phrase `stage-skills.test.ts` asserts on
`ids.md` (ac-5 of ST-LN-34, `` `accord new ticket` is refused ``, `open a new session in the main checkout`,
`adding `--worktree` when the lane is M`); the intent steps and the `9. **The owner's yes.**` step that `yesSteps()`
reads; every `REQUIRED.plan` and `REQUIRED.intent` phrase; every phrase the `failure.md` test asserts
(`stage-skills.test.ts:499-512`); every planner phrase `agents.test.ts` asserts and the `(@ac-` marker wording
(`skills-sync.test.ts:601`); `droppedReason` and `dependsDropped`.

## Task 9: The CI workflow gates a lane S ticket that passed gate ready in a pull request that changes only accord/
covers: D-04
files: packages/core/src/scaffold/workflow.ts, .github/workflows/accord.yml, packages/cli/test/workflow-script.test.ts
verify: packages/cli/test/workflow-script.test.ts#risk:security-a-lane-S-ticket-that-passed-gate-ready-is-gated-in-an-accord-only-diff-and-a-queued-one-is-not

Consumes: the workflow script as it is, and the `ac_hash` that Task 1's `gate ready` writes on a lane S ticket.
Produces: a workflow that runs `gate done` on a lane S ticket carrying `ac_hash` even when the pull request changes
nothing outside `accord/`, so a lane S pull request with no converged review never goes green (D-04: CI's
`gate done` is what holds a lane S pull request to its review). A queued lane S ticket, which has no `ac_hash`, is
still skipped, so a backlog pull request lands as today.

Test first, a new top-level test in `packages/cli/test/workflow-script.test.ts`, placed after the
`describe.skipIf(noBash)('the emitted workflow script — executed', ...)` block. It uses this file's own `sandbox`,
`runScript` and `afterEach` cleanup, as every case in the file does; the preamble's `repoWith`, `commitMsg` and
`cleanup` rules do not apply to it, because the sandbox commits nothing a convention reads.
- `it.skipIf(noBash)('risk:security a lane S ticket that passed gate ready is gated in an accord-only diff and a queued one is not', () => { ... }, 300_000)`:
  - `READY_S = '---\nid: LS-1\nstatus: open\nlane: S   # S: one small change\nac_hash: "fnv1a64:0000000000000000"\n---\n\n## Understood\nx\n'`;
    `QUOTED_S = READY_S.replace('lane: S   # S: one small change', 'lane: "S"')`;
    `QUEUED_S = READY_S.replace('ac_hash: "fnv1a64:0000000000000000"', '# ac_hash:')`;
    `M_HASH = READY_S.replace('lane: S   # S: one small change', 'lane: M')`.
  - `own` is the `run` of the one step named `lint and gate` in `.github/workflows/accord.yml`, read exactly as the
    test `the workflow of this repository gates the same tickets with the same exit as the emitted one` reads it.
  - For each `script` of `[SCRIPT, own]`:
    - For each text of `[READY_S, QUOTED_S]`: `s = sandbox((r) => write(r, 'accord/tickets/LS-1.md', text))`,
      `r = runScript(s.repo, { base: s.base, script })`; `r.calls` has length 2 and `r.calls[1]` ends with
      `' gate done LS-1'`.
    - For each text of `[QUEUED_S, M_HASH]`: the same run has `r.calls` of length 1 and `r.out` contains
      `not gating LS-1`.

Interface, the same edit in both files. In `packages/core/src/scaffold/workflow.ts` every `$` of a `{qc}` reference
is written `\$` as the lines around it are; in `.github/workflows/accord.yml` it is a plain `$`.
- The comment above `approved_at` becomes:
  `# Approved means an approved_hash key in that version of path $2, or, on a lane S ticket, an ac_hash key, since`
  `# a lane S ticket needs no approval. An unsettled read counts as approved.`
- The last line of `approved_at` becomes two lines:
  ```
  grep -Eq "^[[:space:]]*${qc}?approved_hash${qc}?[[:space:]]*:" <<< "$fm" && return 0
  grep -Eq "^${qc}?lane${qc}?[[:space:]]*:[[:space:]]*${qc}?S${qc}?[[:space:]]*(#.*)?$" <<< "$fm" && grep -Eq "^[[:space:]]*${qc}?ac_hash${qc}?[[:space:]]*:" <<< "$fm"
  ```
- The header comment of `workflow.ts` (lines 26-27): "unapproved in both its HEAD and base versions" becomes
  "unapproved in both its HEAD and base versions (a lane S ticket: no `ac_hash` in either)".
- Neither file gains the text `gate ready` (`scaffold.test.ts` `runs lint and gate done, never gate ready (D-140)`),
  a backslash in the emitted text, or a `$` followed by `{{` inside the `run:` body.

Then run `npm run build`, and `npx vitest run packages/cli/test/workflow-script.test.ts packages/core/test/scaffold.test.ts packages/cli/test/init.test.ts`
before the whole suite, as the preamble says.

Must not change: every other case of `workflow-script.test.ts`, including the replay of the emitted cases through
this repository's workflow; a lane M, 0.1.0 or epic ticket's gating; `fm_at`, `is_dropped`, the deletion check and the
`not gating` messages.

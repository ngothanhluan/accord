---
baseline: 48665d50ccf38ddae200c5c6dd476335389ff3d0
plan_hash: "fnv1a64:ae0f456f36298b61"
---

Review mode `outcome`: one branch, no slices.

Rules for every task:
- Work only in `C:/Work/accord-ln19`. Run accord as `node packages/cli/dist/cli.js` from there, never another
  checkout's build. Commits carry no trailer of any kind.
- Core stays pure: nothing under `packages/core/src` imports `node:fs`, `node:path`, or `node:child_process`.
  Stored or printed paths use `path.posix`. Terminal colour goes through `node:util` `styleText` with the
  `stream` option only, as `packages/cli/src/render/color.ts` does.
- CLI tests import `@accord-dev/accord-core` from `packages/core/dist`, so run `npm run build` after every core
  change and before `npx vitest run packages/cli`.
- A skill edit is followed, in order, by `npm run gen` (rewrites `packages/core/src/generated/skills.ts`),
  `npm run build`, then `node packages/cli/dist/cli.js skills sync` (`accord/config.yml` enables `claude` only,
  so it rewrites `.claude/skills/` alone).
- Report case ids follow `packages/core/src/load/junit.ts:16`: `<file>#<name>`, each whitespace run in the name
  turned into `-`. Every test in this plan is a top-level `it(...)` (no `describe`), so its id is exactly the
  one on the `verify:` line.

The CLI test file `packages/cli/test/show-approval.test.ts` is created by Task 1 and extended by Tasks 2 to 4.
It drives the CLI in-process with `run`, `makeLaneRepo`, `makeEmptyRepo`, `writeFiles`, and `cleanup` from
`packages/cli/test/helpers/repo.ts`, and `CONFIG` and `laneTicket` from `test/helpers/lane.ts`, the way
`packages/cli/test/show.test.ts` does.

The view, as every task reads it (Approach, D-08, D-09). `approvalView(ticket)` returns lines joined with `\n`,
ending in exactly one `\n`:
- six sections in the order of `APPROVED_SECTIONS` (`packages/core/src/gate/hash.ts:46`), each the heading line
  `## Intent`, `## Acceptance criteria`, `## Vetoes`, `## Decisions`, `## Corrections`, or `## Approach` (these
  fixed names, never the file's own heading text), then one blank line, then its body;
- a prose section's body: the section's lines after `stripHtmlComments` (`packages/core/src/load/sections.ts:111`),
  each with trailing whitespace removed, blank ones dropped, printed as written otherwise. A line that does not
  match `LIST_MARKER` (`sections.ts:141`) is followed by a blank line; a list line is followed by a blank line
  only when it is the last line of the section or the next printed line is not a list line. A missing section,
  or one with no such line, prints `none` and a blank line;
- the criteria body: first the shared lines, each `- <step> (<ids>)` with the ids in document order joined by
  `, `, then one blank line when any shared line was printed; then, per scenario in document order, the line
  `**<acTag> <name>**` (`**<name>**` for a scenario with no `@ac-n` tag), one `- <step>` line per step it does
  not share, and a blank line. A ticket with no scenario prints `none` and a blank line there;
- nothing is escaped and no backtick is added (D-09); no `@test:` tag, stage, lane, task, branch, or holder text
  is printed.

## Task 1: Wiring: accord show --approval prints the compact view with shared steps once
covers: @ac-2, D-01, D-03, D-04, D-09
files: packages/core/src/load/gherkin.ts, packages/core/src/status/approval.ts (new), packages/core/src/index.ts, packages/cli/src/commands/show.ts, packages/cli/src/commands/lane-args.ts, packages/cli/src/run.ts, packages/cli/test/show-approval.test.ts (new)
verify: packages/cli/test/show-approval.test.ts#ac-2-a-step-several-scenarios-repeat-is-printed-once-naming-them (@ac-2)

Test first, in the new `packages/cli/test/show-approval.test.ts`: export nothing; define a constant `FOUR`, the
body of a lane M ticket `T-1` built with `laneTicket('T-1', { body: FOUR })`, which Task 4 reuses:
- `## Intent` with two non-list lines `Why: owners export reports by hand.` and `For whom: every owner.`;
- `## Acceptance criteria` with one ```` ```gherkin ```` fence, `Feature: Export`, and four scenarios tagged
  `@ac-1` to `@ac-4` (each also with an `@test:export#case-<n>` tag). All four start
  `Given a report of the month with three hundred rows`; ac-1 to ac-3 then have
  `When the owner exports it as csv`, ac-4 has `When the owner prints it`; each then has its own `Then`, and ac-2
  also an `And` after its `Then`. ac-3's `Then` holds a backtick span, e.g. ``Then the file is named `report.csv` ``;
- `## Vetoes` with `(none)`, `## Decisions` with two `- D-0n ...` lines, `## Corrections` with one `- ...` line,
  `## Open questions` with `- [x] Delimiter? Comma.`, `## Approach` with two non-list lines.

`it('ac-2 a step several scenarios repeat is printed once naming them')`: `run(['show', 'T-1', '--approval'], repo)`
on `makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1', { body: FOUR }) })`; expect exit 0; the Given text
occurs exactly once in the output, on the line `- Given a report of the month with three hundred rows (ac-1, ac-2, ac-3, ac-4)`;
the csv When occurs exactly once, on `- When the owner exports it as csv (ac-1, ac-2, ac-3)`; `When the owner prints it`
appears under `**ac-4 ...**` as `- When the owner prints it`; and the criteria part (from `## Acceptance criteria`
to `## Vetoes`) equals, line for line, the shared block, a blank line, then each scenario's bold line, its own
`- ` steps from its first `Then` to its last step word for word (ac-3's backticks kept), and a blank line.
Fails today: commander rejects the unknown option with exit 2.

Interface:
- `packages/core/src/load/gherkin.ts`: move the prelude of `extractScenarios` (dialect lookup, the prepended
  `Feature:` line, `toMarkdown`, the parse) into a private `parseFence(ticketId, fence)` that returns the parsed
  document, its language, and `toMarkdown`, and throws as `parser.parse` does; `extractScenarios` calls it inside
  its existing `try`. Add `export function leadSteps(ticketId: string, fence: Fence): Record<number, number>`:
  keyed by each scenario's Markdown line (the same `toMarkdown(sc.location.line)` that `scenarioRef` stores as
  `line`), the value is the number of entries of that scenario's `steps` (Background steps first, as `walk`
  builds them, Rule nesting included) before the first step whose phase is `Outcome`, or the number of
  Background plus scenario steps when none is. The phase is the step's `keywordType` when it is `Context`,
  `Action`, or `Outcome`; `Conjunction` and `Unknown` (And, But, `*`) take the phase of the step before, and a
  first step with no phase counts as `Context`. A parse error returns `{}`.
- `packages/core/src/status/approval.ts`: `export function approvalView(ticket: Ticket): string`, the view
  described above the tasks. The criteria part re-scans the `## Acceptance criteria` section: `scan` its lines
  joined with `\n` at offset `section.lines[0].line - 1`, keep fences whose info's first word is `gherkin`, merge
  `leadSteps(ticket.id, fence)` over them, and read each scenario's lead as `leads[s.line] ?? 0`. Shared lines
  are a prefix trie over each lead (exact string match on `steps` entries), built only from scenarios whose
  `acTag` no other scenario carries; a node reached by two or more of them is shared; shared nodes print
  depth-first, children in order of first appearance. A scenario's own lines are its `steps` after its shared
  prefix. Export it from `packages/core/src/index.ts` beside `ticketDetail`.
- `packages/cli/src/commands/lane-args.ts`: `export function requireTicket(snapshot: RepoSnapshot, id: string): Ticket`
  holds the existence check now at line 18, same message; `requireLaneTicket` calls it with `ctx.snapshot`.
- `packages/cli/src/run.ts`: `show <id>` gains `.option('--approval', "print the approved sections for the owner's yes, criteria compacted")`;
  the action type becomes `{ json?: boolean; approval?: boolean }`.
- `packages/cli/src/commands/show.ts`: when `options.approval === true`, take `ctx.plain ?? ctx.snapshot` (the
  checkout, as `accord approve` reads it), `requireTicket` on it (no lane needed), write
  `approvalView(ticket).split('\n').map(clean).join('\n')` to stdout, return 0.

Then `npm run build`, the new case, `npx vitest run packages/core` (the scenario goldens prove `extractScenarios`
unchanged), and `npx vitest run packages/cli` must pass.

Must not change: `extractScenarios`'s scenarios and findings for any input; `ScenarioRef` and every exported
type; `accord show <id>` and `--json` output (every case in `packages/cli/test/show.test.ts` passes unchanged);
`requireLaneTicket`'s messages and exit codes for every command that calls it.

## Task 2: Every real ticket rebuilds exactly from the view, in any dialect
covers: @ac-1, D-02
files: packages/cli/test/show-approval.test.ts (new), packages/core/src/status/approval.ts (new), packages/core/src/load/gherkin.ts
verify: packages/cli/test/show-approval.test.ts#ac-1-every-scenario-of-every-real-ticket-is-rebuilt-exactly-from-the-approval-view (@ac-1), packages/cli/test/show-approval.test.ts#risk:parsing-approval-shares-only-steps-before-the-first-then-in-a-language-vi-fence, packages/cli/test/show-approval.test.ts#risk:parsing-approval-gives-a-star-step-the-phase-of-the-step-before-it

Tests first. A test-local `rebuild(out: string)` reads the criteria part (from the line `## Acceptance criteria`
to the next line starting `## `): every `- ` line before the first `**` line is shared and must match
`/^- (.*) \((ac-\d+(?:, ac-\d+)*)\)$/` (step, ids); every `**` line must match `/^\*\*(ac-\d+) (.*)\*\*$/` and
opens a scenario whose own steps are the `- ` lines after it with `- ` removed. Each scenario rebuilds as
`{ acTag, name, steps }`, steps being the shared steps whose ids name it, in printed order, then its own; it also
records how many shared steps it got.

1. `it('ac-1 every scenario of every real ticket is rebuilt exactly from the approval view')`: list the top-level
   `*.md` files of the repository's own `accord/tickets/` (`fileURLToPath(new URL('../../../accord/tickets/', import.meta.url))`
   with `readdirSync`), copy each into one `makeEmptyRepo()` sandbox under `accord/tickets/` with
   `accord/config.yml` set to `CONFIG`. Select the tickets whose loaded `## Acceptance criteria` section holds a
   line starting ```` ```gherkin ```` (load with `loadSnapshot({ files, tree: [] })` from `@accord-dev/accord-core`).
   Expect at least ten selected (guard against a vacuous pass). For each: `run(['show', id, '--approval'], sandbox)`
   exits 0; the rebuilt list equals the loaded `scenarios` mapped to `{ acTag, name, steps }`, in order (same tag,
   title, steps and keywords, nothing extra); and for each scenario the shared steps it got are fewer than or
   equal to the index of its first step starting `Then ` (its step count when it has none), and each shared
   step it got sits before all of its own steps, which the rebuild order already gives. Collect every offender as `<id> <reason>` into one
   `bad` list and end with `expect(bad).toEqual([])`.
2. `it('risk:parsing approval shares only steps before the first then in a language vi fence')`: a lane ticket
   whose fence starts `# language: vi`, then `Tính năng: X`, two `Tình huống:` scenarios `@ac-1` and `@ac-2`, each
   `Cho một báo cáo`, `Khi chủ xuất nó`, `Và chọn csv`, then a different `Thì ...` and an identical
   `Và tệp được lưu`. Expect the three lead steps as shared lines naming `ac-1, ac-2`, and `Thì ...` and
   `Và tệp được lưu` under each scenario's own bold line (so the identical `Và` after `Thì` is not shared).
3. `it('risk:parsing approval gives a star step the phase of the step before it')`: an English ticket with two
   scenarios each `* a report`, `When the owner exports it`, `* the owner confirms`, a different `Then ...`, and
   `* the file is kept`. Expect `- * a report (ac-1, ac-2)`, the When, and `- * the owner confirms (ac-1, ac-2)`
   as shared lines, and `- * the file is kept` under each scenario.

Interface: consumes `approvalView` and `leadSteps` from Task 1 and changes their code only if a case above
fails, keeping their signatures. Run `npm run build` after any core change, then `npx vitest run packages/cli`.
When case 1 fails on a real ticket's load finding (exit 1 after Task 3), report that ticket and its finding;
never edit a ticket file.

Must not change: every case Task 1 wrote; the files under `accord/tickets/` (the test only copies them).

## Task 3: The view prints the six approved sections, and refuses what it cannot show
covers: @ac-3, D-05
files: packages/cli/test/show-approval.test.ts (new), packages/cli/src/commands/show.ts, packages/cli/src/run.ts
verify: packages/cli/test/show-approval.test.ts#ac-3-the-approval-view-prints-the-six-approved-sections-and-nothing-else (@ac-3), packages/cli/test/show-approval.test.ts#risk:data-loss-approval-refuses-a-ticket-whose-gherkin-does-not-parse, packages/cli/test/show-approval.test.ts#risk:complex-branching-approval-needs-a-ticket-but-no-lane-and-refuses-json, packages/cli/test/show-approval.test.ts#risk:security-approval-turns-control-characters-into-spaces-on-each-line

Tests first.
1. `it('ac-3 the approval view prints the six approved sections and nothing else')`: a lane M ticket with two
   Intent lines, two `@ac-n @test:...` scenarios, `## Vetoes` `- No new dependency.`, two Decisions lines,
   `## Corrections` holding only `<!-- Every correction the owner makes, verbatim, appended and never edited. -->`,
   `## Open questions` with one line, and `## Approach` holding only
   `<!-- About fifteen lines: the chosen option and why. -->`. Expect exit 0; the lines equal to `## Intent`,
   `## Acceptance criteria`, `## Vetoes`, `## Decisions`, `## Corrections`, `## Approach` each occur once, in that
   order, and no other line starts `## `; every non-comment, non-blank line of the five prose sections in the
   file occurs, in order, between its heading and the next; the lines under `## Corrections` and `## Approach`,
   blank ones skipped, are exactly `['none']`; no line matches
   `/^\s*(Stage|Lane|Tasks|Branch|Holder|Blocked by|State|Test|Test result|Ticked|Verification):/`; the output
   does not contain `@test:` nor the Open questions line.
2. `it('risk:data-loss approval refuses a ticket whose gherkin does not parse')`: a fence with a step directly
   under `Feature:` (no scenario). Expect exit 1, empty stdout, and stderr holding `load.gherkin-parse` and the
   ticket's file path.
3. `it('risk:complex-branching approval needs a ticket but no lane and refuses json')`: a ticket written with
   `laneTicket('T-2', { lane: '' })` exits 0 under `--approval` and prints `## Acceptance criteria`; `NOPE` exits 2
   with `no ticket NOPE in accord/tickets/`; `show T-1 --approval --json` exits 2 with empty stdout.
4. `it('risk:security approval turns control characters into spaces on each line')`: a ticket whose title and an
   Intent line hold `\u001b[31m` and `\u202e`. Expect neither code point in the output, the Intent line printed
   with each replaced by one space, and more than ten output lines (the view is split on `\n` before `clean`).

Interface:
- `packages/cli/src/run.ts`: the option becomes `.addOption(new Option('--approval', <same description>).conflicts('json'))`,
  so commander refuses the pair and `runCli` returns 2 (`run.ts:267-272`).
- `packages/cli/src/commands/show.ts`: after `requireTicket`, collect `snapshot.errors` whose `file` is the
  ticket's file; when any exists, write one line per finding as `<file>[:<line>]: <rule> <reason>`, then
  `<file> has load findings; run accord lint`, to stderr and return 1 without writing stdout. A schema error in
  the frontmatter is such a finding, so no frontmatter check is added.

Then `npm run build` and `npx vitest run packages/cli` must pass, Task 2's ac-1 case included.

Must not change: `accord show <id>` and `--json` (every case in `packages/cli/test/show.test.ts` passes
unchanged, including the lane-less refusal at `show.test.ts:92`); the view text Tasks 1 and 2 assert.

## Task 4: The view is laid out for a person and coloured in a terminal
covers: @ac-5, D-08
files: packages/cli/test/show-approval.test.ts (new), packages/cli/src/render/color.ts, packages/cli/src/commands/show.ts, packages/core/src/status/approval.ts (new)
verify: packages/cli/test/show-approval.test.ts#ac-5-the-approval-view-is-laid-out-for-a-person-and-coloured-in-a-terminal (@ac-5)

Test first: `it('ac-5 the approval view is laid out for a person and coloured in a terminal')` on Task 1's `FOUR`
ticket, using `vi.stubEnv` and ending with `vi.unstubAllEnvs()` in a `finally`.
- Colour off: `vi.stubEnv('FORCE_COLOR', undefined)` and `vi.stubEnv('NO_COLOR', '1')`; run `--approval`. In the
  criteria part: each scenario's first line is `**ac-n <title>**`; every other non-blank line starts `- `; the
  line before every `**` line is blank. In the five prose sections, every non-blank line that does not match
  `/^\s*(?:[-*+]|\d+\.)\s+/` is followed by a blank line. The output contains no `\u001b`.
- Colour on: `vi.stubEnv('NO_COLOR', undefined)` and `vi.stubEnv('FORCE_COLOR', '1')`; run again. Each of the six
  headings appears as `\u001b[36m## <name>\u001b[39m`; in the criteria part the count of
  `/\u001b\[33mac-\d+\u001b\[39m/g` equals the count of `/\bac-\d+\b/g` in the colour-off criteria part; every
  colour-off line starting `- Given `, `- When `, `- Then `, `- And `, or `- But ` appears coloured as
  `- \u001b[32m<keyword>\u001b[39m ...`; and `stripVTControlCharacters(on)` (from `node:util`) equals the
  colour-off output.

Interface: `packages/cli/src/render/color.ts` gains
`export function colourApproval(text: string, stream: NodeJS.WritableStream): string`: per line, a line starting
`## ` is wrapped whole in `styleText('cyan', ...)`; inside the criteria part (after the `## Acceptance criteria`
line, before the next `## ` line) a leading `- Given|When|Then|And|But` followed by a space has that keyword
wrapped in `styleText('green', ...)`, then every `/\bac-[1-9][0-9]*\b/g` match is wrapped in
`styleText('yellow', ...)`; every call passes `{ stream }`. `show.ts` writes `colourApproval(<cleaned view>, ctx.stdout)`.
If a layout check fails, fix `approvalView` toward the shape described above the tasks.

Then `npm run build` and `npx vitest run packages/cli` must pass.

Must not change: `colourFindings` and its callers; the colour-free text, which every earlier case of this file
asserts.

## Task 5: The intent and approach skills show the view at the owner's yes
covers: @ac-4, D-06, D-07, D-08
files: packages/core/skills/intent/SKILL.md, packages/core/skills/approach/SKILL.md, packages/core/test/stage-skills.test.ts, packages/core/src/generated/skills.ts, .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-approach/SKILL.md, docs/design.md, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/core/test/stage-skills.test.ts#ac-4-the-intent-and-approach-skills-show-the-approval-view-at-the-owners-yes (@ac-4)

Test first, a new top-level case in `packages/core/test/stage-skills.test.ts` after the last case:
`it('ac-4 the intent and approach skills show the approval view at the owners yes')`. Shared shape as the cases
at `stage-skills.test.ts:63-79`: `all` with every runtime, the two guards on `skillDirs(all)` and `STAGES`,
`everyFile`, and one `bad` list. For every `dir` of `skillDirs(all)` and `stage` of `['intent', 'approach']`,
read `dir + '/' + installedName(stage) + '/SKILL.md'` (empty goes to `bad` as `missing`); split it into chunks at
each line starting `\d+\. ` or `#` (`text.split(/^(?=\d+\. |#)/m)`), keep the chunks that start
`/^\d+\. \*\*The owner's yes/` (exactly one, else `found <n> steps`), and normalise it with
`.replace(/[ \t]*\n[ \t]*/g, ' ')`. It must contain each of `` `accord show <id> --approval` ``, `unchanged`,
`not inside a code block`, `horizontal rule`, `In plain words`, `one line per scenario that begins with its ac-n`,
and its lowercase form must not contain `from the ticket file`; each miss goes to `bad` with its phrase.

Interface, in `packages/core/skills/intent/SKILL.md` step 9 and `packages/core/skills/approach/SKILL.md` step 5,
each still opening `**The owner's yes.**` and wrapped at about 80 columns: replace the show sentence(s) with:
run `accord show <id> --approval` and paste its output unchanged, as Markdown, not inside a code block; if the
command fails, stop and tell the owner; below it put a horizontal rule, a heading "In plain words" written in the
chat language, and one line per scenario that begins with its ac-n and says in plain words what it means. In the
approach step this replaces "Show the owner the `## Approach` section verbatim, copied from the ticket file ..."
through "... and Corrections verbatim too."; add that the view holds every approved section. Every other sentence
of both steps stays, including "Decisions, and Corrections as written", `approved_hash:`, and the commit and
`--allow-empty` text. The approach SKILL.md render must stay at most 5120 bytes (`packages/core/test/skills.test.ts:255`);
shorten the new sentence, never another step, if it does not fit.

Trim SHOW-1's two cases, keeping their names (their `@test` tags in `accord/tickets/SHOW-1.md` still resolve):
in `ac-1 the intent skill shows intent and the criteria verbatim before the architect` (`stage-skills.test.ts:161`)
the `sentence` list finds the step matching `/^\d+\. \*\*The owner's yes/` instead of `SENTENCE_A`, the order
check stays; in `ac-2 the approach skill shows approach verbatim instead of a brief` (`:187`) drop `SENTENCE_B`
and its check, keep the `Show the owner the brief` check. Add above each the comment
`// SHOW-1's verbatim paste is superseded by ST-LN-19 D-01; ST-LN-19 ac-4 proves the new step.`

Docs: `docs/design.md:144` adds `; --approval prints the approved sections for the owner's yes, criteria compacted`;
`docs/specs/2026-10-12-workflow-layer-design.md:127-128` and `:230-231` say the agent shows the output of
`accord show <id> --approval`, pasted unchanged, followed by its plain-words lines, instead of the text copied
verbatim from the ticket file.

Then run `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync` (rewrites the two
`.claude/skills/` copies above), and `npx vitest run packages/core`: the new case, the two trimmed cases, the
`intent` and `approach` rows of `stage skills name what the spec requires` (`stage-skills.test.ts:18-19`), the drift
case (`packages/core/test/skills.test.ts:152`), and every `render output invariants` case must pass. Then
`npx vitest run packages/cli` (`packages/cli/test/skill-commands.test.ts` checks that `accord show` exists).

Must not change: every other step of both skills and every other skill; `packages/core/skills/shared/ask.md`;
the ticket files under `accord/tickets/`.

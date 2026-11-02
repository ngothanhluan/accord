---
baseline: 625431a8713b63d57c83bc5a28ac72c7dd17321b
plan_hash: "fnv1a64:8df9c9165c2e1338"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order. Task 1 builds the pure core module, the `accord scout check <file>` command and the logged-search half of
the check end to end (@ac-1). Task 2 adds citations and the file-list checks (@ac-2). Task 3 leaves the ticket's
own files out of every search. Task 4 adds the lane numbers (@ac-3). Task 5 adds the bounded reads of a commit's
files. Task 6 makes `accord approve` refuse a lane M ticket without a passing or skipped report, judged by the same
check at the commit that last changed `scout.md`, or on the working tree while it has uncommitted changes (@ac-4,
D-02, D-03).
Task 7 rewrites the scout prompt into its fixed form and adds the `shared/scout.md` steps to the accord and
intent skills (D-01). Task 8 wires the approach and build skills, the planner and the README.

Exact text. A string this plan gives in a fenced block is written into the file exactly as the block shows it;
its backticks are part of the text. A block fenced with `~~~` holds text that itself contains a ``` fence.

Rules for every task:
- Test ids. Every test this plan adds is a top-level `it(...)` with no `describe` around it, except the @ac-4
  test, which goes inside `describe('accord approve', ...)` of `packages/cli/test/lane-commands.test.ts`. A report
  id is the file path from the repository root, `#`, then the title with each whitespace run turned into `-`; a
  test inside a `describe` gets `<describe title> > <it title>` (as
  `packages/cli/test/lane-commands.test.ts#accord-approve->-after-approval-gate-ready-passes` in
  `accord/tests-baseline.txt:79`). No title holds `@`, a comma or an apostrophe.
- No existing test is renamed or removed. Where a task changes an existing test it changes the body only.
- CLI tests read the built core: run `npm run build` before any CLI test. After any edit under
  `packages/core/agents/` or `packages/core/skills/`, or to `README.md`, run `npm run gen`, then `npm run build`,
  then `node packages/cli/dist/cli.js skills sync` (`accord/product/conventions.md:7`). `config.yml` declares
  `runtimes: [claude]`, so the sync writes only under `.claude/`; commit every file it writes.
- Rendered skill text (anything under `packages/core/skills/`) never holds a backslash
  (`packages/core/test/skills.test.ts:311`), the text `packages/` (`:319`), the word `warning`, the words
  `Ready` or `Done` capitalised (`:433`, `:438`), or a runtime product name (`:347`). A `SKILL.md` stays within
  120 lines and 6000 bytes (`:181`, `:188`); an agent body stays within 60 lines
  (`packages/core/test/agents.test.ts:100-103`). An `accord <command>` inside a code span is checked against the
  commands the CLI registers (`packages/cli/test/skill-commands.test.ts:61`), so a path after `accord scout check`
  is always written in double quotes: `accord scout check "<file>"`.
- When a `SKILL.md` goes over 6000 bytes after a task's edit, shorten only the sentence this plan adds there,
  keeping every point it makes and its `./scout.md` name; never cut other text.
- No text this plan adds defers work to another ticket or step.
- Git spawns follow `accord/product/conventions.md:8-10`: a path from git is read NUL-separated (`-z`), a path
  handed to git as a pathspec carries `:(literal)`, every `git log` is
  `'-c', 'log.showSignature=false', 'log', '--no-show-signature', ...` (the exact literal
  `packages/cli/test/spawn-surface.test.ts:84-100` checks), and every `execFileSync` that can return a long output
  passes `maxBuffer: 64 * 1024 * 1024`. Only `git` is spawned, by name, with no shell.
- Printed output carries no backslash (D-51): every printed path is a posix path; the Pattern cell is never
  printed; a Claim cell is printed as `printedClaim(claim)` from `check.ts`: every `\` turned into `/`, every
  whitespace run turned into one space, then cut to its first 80 characters with `...` appended when longer. A
  claim that quotes its pattern is printed in that form; the row number (`row <row>`) is what identifies the row.
- A test that commits uses `commitMsg(repo, '<message>')` from `packages/cli/test/helpers/repo.ts:146`, never
  `-m` (`accord/product/conventions.md:6`). A CLI test passes `120_000` as the third argument of `it`.
- Commits follow `accord/product/conventions.md`. End every task with `npm run lint` and `npm run typecheck`, then
  the test command the brief prints.

Names shared by every task:
- The report form, as the scout writes it (Task 7) and `parseScoutReport` reads it. Headings are matched with
  `headingKey` (`packages/core/src/load/sections.ts:13`):
  - `## Files`: one existing file per list line. `## New files`: the same, written by the main session, for files
    the change creates. An entry is the first whitespace-separated token after the list marker
    (`LIST_MARKER`, `sections.ts:141`), with one wrapping pair of backticks stripped, every `\` turned into `/`, a
    leading `./` stripped and a trailing `:<numbers>` (`/:\d+(?:[-,]\d+)*$/`) stripped; an empty token is skipped.
  - `## Absent`: a table whose header is `| Claim | Pattern | Folders | Allowed hits |`, then a separator row,
    then one row per absence claim.
  - Anywhere outside a fence: a line `skipped: <reason>`.
  - Anywhere: citations, `path:n`, `path:n-m` or `path:n,k`.
- `packages/core/src/scout/report.ts` (Task 1, citations in Task 2):

  ```ts
  export interface AbsentRow { line: number; claim: string; pattern: string; folders: string[]; allowed: string[] }
  export interface Citation { text: string; path: string; numbers: number[] }
  export interface ScoutReport { files?: string[]; newFiles: string[]; absent: AbsentRow[]; faults: string[]; citations: Citation[]; skipped?: string }
  export function parseScoutReport(text: string): ScoutReport
  ```
  `files` is undefined when the report has no `## Files` section. `line` is the 1-based line of the row in the
  report. `faults` holds the table problems Task 1 names. `numbers` holds every integer of the line part in order
  (`9-11,20` gives `[9, 11, 20]`).
- `packages/core/src/scout/check.ts` (Task 1, grown by Tasks 2 to 4):

  ```ts
  export interface ScoutFacts {
    path?: string;                                          // the report's repository path, when it lies inside the repository
    text: string;                                           // the report
    tracked: readonly string[];                             // every path git tracks, posix
    read: (paths: readonly string[]) => (string | undefined)[]; // text of each tracked path, undefined when unreadable
    config?: string;                                        // the working tree's accord/config.yml text
    rendered?: readonly string[];                           // the paths accord skills sync writes
  }
  export interface ScoutLane { expected: string[]; areas: string[]; sensitive: { path: string; entry: string; area: string; line: number }[]; lifts: string[] }
  export interface ScoutResult { failures: string[]; lane?: ScoutLane; skipped?: string }
  export function scoutCheck(facts: ScoutFacts): ScoutResult
  ```
  `scoutCheck` calls `read` with at most 100 paths at a time. Failures come in this order: the report-level ones
  (no `## Files`, then `faults`), `## Files` entries, `## New files` entries, citations in the order they appear,
  then Absent rows in table order.
- One check, two trees (ac-4, D-03). `scoutCheck` is the only judging function. `accord scout check <file>` hands
  it the working tree's facts, `workingFacts(root)` in `scout.ts` (Task 1): `git ls-files -z` and the files on
  disk. `accord approve <id>` hands the same function, for `accord/tickets/<id>/scout.md`, the facts of the commit
  that last changed that file, `commitFacts(root, commit)` in `scout.ts` (Task 6): `git ls-tree -r -z -l` and the
  blobs of that commit; or, while the file has uncommitted changes (or was never committed), `workingFacts(root)`
  again. The two commands differ only in the facts they pass; no rule is written twice.
- The printed form of a `ScoutResult`, built by `scoutLines(result: ScoutResult): string` in
  `packages/cli/src/commands/scout.ts`, every line ending in `\n`:
  1. `fail: <failure>` for each failure;
  2. when `lane` is set (Task 4): `expected files: <n>`, then ` (<path>, <path>, ...)` when n > 0;
     `code areas: <k>`, then ` (<area>, ...)` when k > 0, the root written `.`; one line
     `sensitive: <path> is under <entry> (<area>), accord/config.yml:<line>` per match; and
     `lifts to lane M: <reasons joined by "; ">`, or `lifts to lane M: no counted condition holds`;
  3. `scout check passed` when there is no failure, else `scout check failed: <n> failure` (n = 1) or
     `scout check failed: <n> failures`.
- The failure texts, exactly (`<claim>` is `printedClaim` of the Claim cell, `<row>` the row's report line):
  - `the report has no ## Files section, so no lane numbers can be computed` (Task 2)
  - `the ## Absent table header is not | Claim | Pattern | Folders | Allowed hits |` (Task 1)
  - `## Absent row at line <row> has <k> cells, not 4: escape a pipe inside a cell` (Task 1)
  - `## Files lists <path>, which git does not track` (Task 2)
  - `## New files lists <path>, which git already tracks` (Task 2)
  - `citation <text> does not resolve: git does not track <path>` (Task 2)
  - `citation <text> does not resolve: <path> cannot be read` (Task 2)
  - `citation <text> does not resolve: <path> has <count> lines` (Task 2)
  - `absent claim "<claim>" (row <row>): its pattern is not a valid JavaScript regular expression` (Task 1)
  - `absent claim "<claim>" (row <row>): its folders cover no tracked file` (Task 1)
  - `absent claim "<claim>" (row <row>): <path>:<n> matches its pattern outside its allowed hits`, one per hitting
    file, `<n>` its first matching line (Task 1)
- A folder or allowed-hit entry `e` (ledger Ruling 22): `\` becomes `/`, a leading `./` is stripped, and `.`, `/`
  and the empty string mean the repository root. It covers a tracked path `p` when it is the root, when it ends in
  `/` and `p` starts with it, when some tracked path starts with `e + '/'` and `p` does too (a folder), or when
  `p === e` (a file).
- A line count: the text after `normaliseText` (`packages/core/src/load/frontmatter.ts:12`), split on `\n`, with
  one trailing empty element dropped.

## Task 1: The core check judges logged absence searches and `accord scout check` runs it

covers: @ac-1, D-01
files: packages/core/src/scout/report.ts (new), packages/core/src/scout/check.ts (new), packages/core/src/index.ts, packages/cli/src/commands/scout.ts (new), packages/cli/src/load/fs.ts, packages/cli/src/run.ts, packages/cli/test/skill-commands.test.ts, packages/cli/test/scout-check.test.ts (new)
verify: packages/cli/test/scout-check.test.ts#ac-1-a-logged-absence-claim-that-its-own-search-contradicts-fails-the-check (@ac-1)

Consumes a report file and the working tree's tracked files. Produces:
- `packages/core/src/scout/report.ts`: `parseScoutReport` and its types as the preamble gives them, with
  `citations: []` (Task 2 fills it). Use `normaliseText`, then `scan(text, 0)` (`sections.ts:41`); a section's
  lines inside a fence (`fences`, open to close) and HTML comments (`stripHtmlComments`, `sections.ts:111`) are
  left out. Files and New files as the preamble says. Absent: the section's lines whose trimmed text starts with
  `|`. Cells of a row: trim, drop one leading `|` and one trailing `|` that is not `\|`, split on
  `/(?<!\\)\|/`, then in each cell turn `\|` into `|`, trim, and strip one wrapping pair of backticks (a cell of
  at least two characters that starts and ends with a backtick). The first table line is the header: its cells,
  lowercased, must equal `claim, pattern, folders, allowed hits`, else push the header fault and read no row. A
  line whose every cell matches `/^:?-+:?$/` is a separator and skipped. A row with other than 4 cells pushes the
  row fault. A row's Folders and Allowed hits cells are split on `/[\s,]+/`, each entry losing one wrapping pair
  of backticks, empty entries dropped; a Folders cell with no entry becomes `['']`, the root (ledger Ruling 22);
  an Allowed hits cell with no entry stays `[]`, no hit allowed. `skipped`: the reason of the first line outside
  a fence matching `/^\s*(?:[-*+]\s+)?skipped:\s*(\S.*)$/`, trimmed.
- `packages/core/src/scout/check.ts`: `scoutCheck` and its types as the preamble gives them. Tracked paths are
  sorted by code point first. For each Absent row: compile `new RegExp(pattern)` with no flags (a throw gives the
  compile failure); the searched files are the tracked paths any folder entry covers (preamble); none gives the
  "cover no tracked file" failure; otherwise read them in slices of 100, normalise each text, and test the
  pattern on each line; a file not covered by any allowed-hit entry and with a matching line gives one failure at
  its first matching line. An unreadable file is skipped. `skipped` is copied from the parsed report. Also
  `export function printedClaim(claim: string): string` as the preamble defines it, used by every failure text
  that names a claim.
- `packages/core/src/index.ts`: export `parseScoutReport`, `scoutCheck` and the types `AbsentRow`, `Citation`,
  `ScoutReport`, `ScoutFacts`, `ScoutLane`, `ScoutResult`.
- `packages/cli/src/load/fs.ts`: `export function gitTracked(root: string): string[]`, the paths of
  `git ls-files -z` (the index only, no untracked file; `gitTree` at line 19 lists untracked ones too), split on
  `\0`, empty strings dropped, sorted by code point, with `maxBuffer: 64 * 1024 * 1024`; a failure throws
  `UsageError('git ls-files failed in ' + root)`.
- `packages/cli/src/commands/scout.ts`: `scoutLines` (preamble) and
  `export function scoutCheckCommand(ctx: CommandContext, file: string, cwd: string): number`. It reads
  `resolve(cwd, file)` as utf8; a read failure throws
  `UsageError('cannot read ' + file.replace(/\\/g, '/') + ': ' + <the error message>)`. The report's repository
  path is `relative(realpathSync.native(ctx.root), realpathSync.native(<the absolute file>))` with `sep` turned
  into `/`, left undefined when it is empty, starts with `..` or is absolute (realpath on both sides, since a
  Windows temp folder can carry an 8.3 short name git does not print). Facts come from
  `export function workingFacts(root: string): Pick<ScoutFacts, 'tracked' | 'read'>`: `tracked = gitTracked(root)`,
  `read` reading `join(root, ...p.split('/'))` as utf8 and giving undefined on any error. It calls
  `scoutCheck({ ...workingFacts(ctx.root), text, ...(path === undefined ? {} : { path }) })`, writes
  `scoutLines(result)` to `ctx.stdout` and returns 1 when there is a failure, else 0.
- `packages/cli/src/run.ts`: after the `tests` block (line 222-234), the same namespace pattern:

  ```ts
  const scout = program.command('scout').description('check a scout report');
  scout
    .command('check <file>')
    .description("check a scout report's citations and logged absence searches against the files git tracks, and print its lane numbers")
    .action((file: string) => {
      setCode(scoutCheckCommand(preflight(opts), file, opts.cwd));
    });
  ```
- `packages/cli/test/skill-commands.test.ts:92`: the list gains `'scout check'` between `'round'` and `'show'`.

Must not change: every other command's behaviour and output; `gitTree` and every existing caller in `fs.ts`.

Test first, `packages/cli/test/scout-check.test.ts`, one top-level `it` titled
`ac-1 a logged absence claim that its own search contradicts fails the check`. Sandbox: `makeEmptyRepo()`, then
`writeFiles` with `'accord/config.yml': CONFIG` (`test/helpers/lane.ts:10`),
`'packages/core/src/load/config.ts': 'export function loadConfig(text: string) {\n  return text;\n}\n'` and
`'packages/cli/src/commands/init.ts': "import { loadConfig } from './x.js';\nexport const c = loadConfig('a');\n"`,
then `commitMsg(repo, 'fixture')`. Afterwards write, untracked, `packages/cli/src/scratch.ts` holding
`loadConfig(1);\n` and `report.md` holding:

```text
## Files
- `packages/core/src/load/config.ts`

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no other caller of loadConfig | `loadConfig\(` | `packages/` | `packages/core/src/load/config.ts` |
```
(in the test source the pattern is written `loadConfig\\(` inside a JavaScript string). `run(['scout', 'check',
'report.md'], repo)` has code 1; its out holds `no other caller of loadConfig` and
`packages/cli/src/commands/init.ts:2`, and does not hold `scratch.ts` or a backslash. Then the same report with
the Allowed hits cell `packages/core/src/load/config.ts, packages/cli/src/commands/init.ts`: code 0, out ends with
`scout check passed\n`. Clean up in `finally`.

## Task 2: Citations and the file lists are checked against what git tracks

covers: @ac-2
files: packages/core/src/scout/report.ts (new), packages/core/src/scout/check.ts (new), packages/cli/test/scout-check.test.ts (new), packages/core/test/scout.test.ts (new)
verify: packages/cli/test/scout-check.test.ts#ac-2-a-citation-that-does-not-resolve-fails-the-check (@ac-2), packages/core/test/scout.test.ts#risk:parsing-table-cells-unescape-pipes-and-strip-one-pair-of-backticks-and-citations-read-ranges-and-lists

Consumes Task 1's module. Produces:
- `report.ts`: `citations`, read from the whole normalised text with

  ```ts
  /(?<![\p{L}\p{N}_.@+\-\[\]\/:])((?:[\p{L}\p{N}_.@+\-\[\]]+\/)*[\p{L}\p{N}_.@+\-\[\]]+):(\d+(?:-\d+)?(?:,\d+(?:-\d+)?)*)(?![\p{L}\p{N}_])/gu
  ```
  kept only when the path holds a `/` or a `.` (ledger Ruling 16: a path preceded by `://`, `/` or `:` never
  starts a match, so a URL or an absolute path is no citation, and `localhost:3000` holds neither). `text` is the
  whole match, `path` the first group, `numbers` every integer of the second group. A `text` seen before is not
  added again.
- `check.ts`: when `files` is undefined, the no-Files failure and no lane. Each `## Files` entry not in `tracked`,
  and each `## New files` entry in `tracked`, gives its failure. Each citation whose path is not tracked gives the
  "does not track" failure; the tracked cited paths are read once (slices of 100), and a citation fails with
  "cannot be read" when the text is undefined, or with "has <count> lines" when any number is below 1 or above
  the line count (preamble). Paths are compared exactly, never by suffix (ledger Ruling 26).

Must not change: Task 1's Absent parse and search; the ac-1 test passes unchanged.

Test first. In `packages/cli/test/scout-check.test.ts`, a top-level `it` titled
`ac-2 a citation that does not resolve fails the check`: `makeEmptyRepo()`, `writeFiles` with
`'accord/config.yml': CONFIG` and `'packages/core/src/gate/scope.ts': 'export const a = 1;\nexport const b = 2;\nexport const c = 3;\n'`,
`commitMsg`. Afterwards write, untracked, `packages/core/src/missing.ts` holding five lines (`'1\n2\n3\n4\n5\n'`),
so the second citation names a file that exists on disk but is not among the files git tracks (ac-2), and an
untracked `report.md`:

```text
## Files
- `packages/core/src/gate/scope.ts`

## Facts
- the rule sits at packages/core/src/gate/scope.ts:9999
- the helper sits at packages/core/src/missing.ts:3
- the first line is packages/core/src/gate/scope.ts:1
```
`run(['scout', 'check', 'report.md'], repo)`: code 1; out holds
`citation packages/core/src/gate/scope.ts:9999 does not resolve: packages/core/src/gate/scope.ts has 3 lines`,
`citation packages/core/src/missing.ts:3 does not resolve: git does not track packages/core/src/missing.ts` and
`scout check failed: 2 failures`.

Then `packages/core/test/scout.test.ts`, importing from `../src/index.js`, a top-level `it` titled
`risk:parsing table cells unescape pipes and strip one pair of backticks and citations read ranges and lists`.
Parse this text (in the test source the `\|` is written `\\|`):

```text
## Files
- `src/a.ts` — the writer, src/a.ts:3-5

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no csv or tsv writer | `csv\|tsv` | `src/`, lib | src/a.ts |

See src/b.ts:1,4 and docs/c.md:2-3,9 and https://example.com:443/x and localhost:3000 and /abs/d.ts:2.
```
`files` equals `['src/a.ts']`; `absent` equals
`[{ line: 7, claim: 'no csv or tsv writer', pattern: 'csv|tsv', folders: ['src/', 'lib'], allowed: ['src/a.ts'] }]`;
`faults` equals `[]`; `citations.map((c) => [c.path, c.numbers])` equals
`[['src/a.ts', [3, 5]], ['src/b.ts', [1, 4]], ['docs/c.md', [2, 3, 9]]]`. A second parse of the same table with
the row `| a | b | c |` gives `faults` equal to
`['## Absent row at line 7 has 3 cells, not 4: escape a pipe inside a cell']` and `absent` equal to `[]`.

## Task 3: The ticket's own files are left out of every search

covers: @ac-1
files: packages/core/src/scout/check.ts (new), packages/cli/test/scout-check.test.ts (new)
verify: packages/cli/test/scout-check.test.ts#risk:complex-branching-a-saved-report-is-not-contradicted-by-its-own-ticket-files-or-the-research-records-its-ticket-lists

Consumes `facts.path` and `read`. Produces, in `check.ts`, the set of own files no Absent row searches (ledger
Rulings 24 and 30): `facts.path` itself; and when `facts.path` matches `/^accord\/tickets\/([^/]+)\/scout\.md$/`,
with `<id>` its group, the file `accord/tickets/<id>.md`, every tracked path starting with `accord/tickets/<id>/`,
and every string the ticket's frontmatter `research:` list holds that `isResearchRecord`
(`packages/core/src/load/research.ts:14`) accepts. The ticket text comes from one `read(['accord/tickets/<id>.md'])`;
its frontmatter is `splitFrontmatter` (`frontmatter.ts:22`) then `parseYamlMap('accord/tickets/<id>.md', yaml, 1)`
(`packages/core/src/load/yaml.ts:18`); a missing ticket, a missing block, a parse failure or a `research` that is
not an array of strings adds no record. The own files are dropped from a row's searched files before the "cover
no tracked file" test (ledger Ruling: a search over nothing proves nothing). Citations and the file lists are not
affected.

Must not change: the ac-1 and ac-2 tests pass unchanged.

Test first, in `packages/cli/test/scout-check.test.ts`, a top-level `it` titled
`risk:complex-branching a saved report is not contradicted by its own ticket files or the research records its ticket lists`.
`makeEmptyRepo()`, `writeFiles` with: `'accord/config.yml': CONFIG`; `'src/load/config.ts': 'export function loadConfig() {}\n'`;
`'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ['research: ["accord/research/2026-01-01-r.md"]'], body: LANE_BODY + 'loadConfig(1)\n' })`;
`'accord/tickets/T-1/plan.md': 'loadConfig(2)\n'`; `'accord/research/2026-01-01-r.md': 'loadConfig(3)\n'`;
`'accord/research/other.md': 'loadConfig(4)\n'`; and `'accord/tickets/T-1/scout.md'` holding:

```text
## Files
- `src/load/config.ts`

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no other caller of loadConfig | `loadConfig[(]` | . | `src/load/config.ts` |

## Facts
- loadConfig(5) is defined at src/load/config.ts:1
```
then `commitMsg`. `run(['scout', 'check', 'accord/tickets/T-1/scout.md'], repo)`: code 1; out holds
`accord/research/other.md:1` and `scout check failed: 1 failure`, and does not hold `accord/tickets/T-1.md:`,
`accord/tickets/T-1/plan.md:`, `accord/tickets/T-1/scout.md:` or `2026-01-01-r.md:`. The same report checked as an
untracked copy at `report.md` (outside the ticket) exits 1 and names `accord/tickets/T-1.md:`, so the exclusion
follows the report's path.

## Task 4: The check prints the lane numbers

covers: @ac-3
files: packages/core/src/load/config.ts, packages/core/src/scout/check.ts (new), packages/cli/src/commands/branch-fact.ts, packages/cli/src/commands/scout.ts (new), packages/cli/test/scout-check.test.ts (new)
verify: packages/cli/test/scout-check.test.ts#ac-3-the-check-computes-the-lane-lift-conditions-from-the-report-file-list (@ac-3)

Consumes the Files and New files entries, `facts.config` and `facts.rendered`. Produces:
- `packages/core/src/load/config.ts`: `configLists` returns `sensitive: { area: string; path: string; line: number }[]`,
  `line` the 1-based line in the config of that list item: walk `doc.getIn(['sensitive', area], true)` when
  `isSeq`, and for each item that `isScalar` with a string value push `{ area, path: item.value, line:
  lines.linePos(item.range[0]).line }` (`ParsedYaml` at `yaml.ts:10-15` carries `doc` and `lines`; the config has
  no frontmatter, so no offset).
- `check.ts`, when `files` is defined, `lane` (lane.md's lift conditions, `packages/core/skills/accord/lane.md:20-30`):
  the listed files are `files` plus `newFiles`, de-duplicated, sorted by code point. `expected` is the listed files
  minus test files (a folder segment `test`, `tests` or `__tests__`, or a file name holding `.test.` or `.spec.`)
  minus generated copies (in `facts.rendered`, or matched by a `generated:` entry of `configLists(facts.config)`
  through `matches`, `packages/core/src/gate/scope.ts:32`). `areas`: each expected file's folder cut to its first
  four segments, `.` for a file at the root, unique, sorted. `sensitive`: for every listed file (tests and copies
  included, as `sensitiveTouched` counts any change, `scope.ts:132-146`) and every `configLists(facts.config).sensitive`
  entry that `matches` it, `{ path, entry: <entry path>, area, line }`, in file order then config order. `lifts`,
  in this order, each when it holds: `more than 5 expected files` (more than 5), `more than 3 code areas` (more than
  3), `a listed sensitive area` (any match). The lane numbers never add a failure (ledger Ruling 8).
- `packages/cli/src/commands/branch-fact.ts`: `export function renderedFiles(config: AccordConfig): SkillFile[]`
  returning `[...skillTargets(config), ...agentTargets(config), ...pluginTargets(config, pkg)]`; `branchFactFor`
  passes `rendered: renderedFiles(config)`. `.claude/settings.json` stays out of the list: the owner's file counts
  as an expected file, as `isExempt` never exempts it by list (`scope.ts:39`).
- `scout.ts`: `scoutCheckCommand` passes `config` (the text of `<root>/accord/config.yml`, undefined when it cannot
  be read) and `rendered` (`renderedFiles(ctx.snapshot.config).map((f) => f.path)`, `[]` when
  `ctx.snapshot.config` is undefined); `scoutLines` prints the lane lines as the preamble says.

Must not change: `configLists`' `generated` list and the area and path of every `sensitive` entry, so
`isExempt`, `sensitiveEntries` and `sensitiveTouched` (`scope.ts:35-41`, `:120-146`) behave as before; the branch
fact `branchFactFor` builds; the ac-1, ac-2 and Task 3 tests.

Test first, in `packages/cli/test/scout-check.test.ts`, a top-level `it` titled
`ac-3 the check computes the lane lift conditions from the report file list`. `makeEmptyRepo()`, `writeFiles`
with `'accord/config.yml'` set to `CONFIG + 'sensitive:\n  interface:\n    - packages/cli/src/commands/x.ts\ngenerated:\n  - packages/core/src/generated/\n'`
(`CONFIG` has 12 lines, so the sensitive entry sits on line 15), and one line `export const v = 1;\n` in each of
`packages/core/src/load/a.ts`, `packages/core/src/load/b.ts`, `packages/core/src/load/c.ts`,
`packages/cli/src/commands/x.ts`, `packages/cli/src/commands/y.ts`, `packages/cli/src/commands/deep/z.ts`,
`packages/cli/test/scout.test.ts` and `packages/core/src/generated/skills.ts`; `commitMsg`. An untracked
`report.md` holds `## Files` and the eight paths, one `` - `<path>` `` line each. `run(['scout', 'check',
'report.md'], repo)`: code 0; out holds the lines

```text
expected files: 6 (packages/cli/src/commands/deep/z.ts, packages/cli/src/commands/x.ts, packages/cli/src/commands/y.ts, packages/core/src/load/a.ts, packages/core/src/load/b.ts, packages/core/src/load/c.ts)
code areas: 2 (packages/cli/src/commands, packages/core/src/load)
sensitive: packages/cli/src/commands/x.ts is under packages/cli/src/commands/x.ts (interface), accord/config.yml:15
lifts to lane M: more than 5 expected files; a listed sensitive area
scout check passed
```

## Task 5: Files at a commit are read in bounded batches

covers: @ac-4, D-03
files: packages/cli/src/load/fs.ts, packages/cli/test/scout-check.test.ts (new)
verify: packages/cli/test/scout-check.test.ts#risk:complex-branching-blob-reads-at-a-commit-split-into-bounded-batches-and-keep-their-order

Consumes nothing new. Produces, in `packages/cli/src/load/fs.ts` (ledger Ruling 29):
- `catBatch(root, specs, what, maxBuffer = 64 * 1024 * 1024)` (line 1197): the fixed `maxBuffer` at line 1203
  becomes this parameter. `gitFilesAt` (line 1229) and the branch-diff read (line 1385) pass none.
- `export function gitTreeAt(root: string, commit: string): { path: string; sha: string; size: number }[]`: one
  `git ls-tree -r -z -l <commit>` (64 MiB `maxBuffer`, as `loadRefInput` at line 1438), records split on `\0`, each
  matched by `/^\d+ blob ([0-9a-f]+) +(\d+)\t([\s\S]+)$/`; a record that is not a blob (a submodule) is skipped. A
  failure throws `UsageError('git ls-tree failed reading ' + commit)`.
- `export function blobBatches(sizes: readonly number[], limit: number): number[][]`: indexes grouped in order, a
  group's sizes summing to at most `limit`; an index whose size is above `limit` is a group of its own.
- `export function readBlobs(root: string, blobs: readonly { sha: string; size: number }[], what: string, limit = 32 * 1024 * 1024): (string | undefined)[]`:
  one `catBatch` per group of `blobBatches`, the specs the shas, `maxBuffer` the group's byte total plus 128 per
  blob plus 1 MiB; the texts come back in the order of `blobs`.
- `export function lastCommitOf(root: string, path: string): string | undefined`: the trimmed output of
  `['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-1', '--format=%H', '--', ':(literal)' + path]`
  with a 64 MiB `maxBuffer`, undefined when it is empty or git fails.
- `export function hasLocalChanges(root: string, path: string): boolean`: true when
  `git status --porcelain -z --untracked-files=all -- :(literal)<path>` prints anything; a failure throws
  `UsageError('git status failed in ' + root)`.

Must not change: every existing caller of `catBatch`, which keeps the 64 MiB buffer; `gitFilesAt`.

Test first, in `packages/cli/test/scout-check.test.ts`, importing the five functions from `../src/load/fs.js`, a
top-level `it` titled `risk:complex-branching blob reads at a commit split into bounded batches and keep their order`:
`blobBatches([10, 30, 5, 5], 16)` equals `[[0], [1], [2, 3]]`. In `makeEmptyRepo()`, write `a.txt` (10 bytes),
`b.txt` (30 bytes), `c.txt` (5 bytes), `d.txt` (5 bytes), `commitMsg`, and take `gitTreeAt(repo, <the commit>)`: four
blobs with those sizes. `readBlobs(repo, <the four>, 'test', 16)` returns the four texts in order.
`lastCommitOf(repo, 'a.txt')` is the commit; `hasLocalChanges(repo, 'a.txt')` is false, and true once `a.txt` is
rewritten.

## Task 6: `accord approve` refuses a lane M ticket without a passing or skipped report

covers: @ac-4, D-02, D-03
files: packages/cli/src/commands/approve.ts, packages/cli/src/commands/scout.ts (new), packages/cli/test/helpers/repo.ts, packages/cli/test/helpers/worktree.ts, packages/cli/test/lane-commands.test.ts
verify: packages/cli/test/lane-commands.test.ts#accord-approve->-ac-4-a-lane-M-ticket-is-approved-only-with-a-scout-report-that-passes-the-check-or-says-why-it-was-skipped (@ac-4)

Consumes Tasks 1 to 5. ac-4 and D-03: approve runs the very check `accord scout check` runs, `scoutCheck`, on
`scout.md` as of the commit that last changed it, or on the working tree while the file has uncommitted changes
or was never committed ("One check, two trees", preamble). Produces:
- `scout.ts`: `export function commitFacts(root: string, commit: string): Pick<ScoutFacts, 'tracked' | 'read'>`:
  `tracked` the paths of `gitTreeAt(root, commit)` sorted by code point; `read(paths)` looks each path up in that
  tree and returns `readBlobs(root, <the blobs found>, 'commit ' + commit)` placed back in order, undefined for a
  path the tree does not hold.
- `scout.ts`: `export function scoutRefusal(ctx: CommandContext, id: string): string | undefined`, with
  `file = 'accord/tickets/' + id + '/scout.md'` and its disk path `join(ctx.root, 'accord', 'tickets', id, 'scout.md')`:
  1. Not a readable file: return
     `cannot approve <id>: <file> is missing; save the scout's report there once accord scout check passes on it, or write a line "skipped: <reason>" in it\n`.
  2. `parseScoutReport(text).skipped` set: return undefined (the check does not run).
  3. Which tree: `commit = hasLocalChanges(ctx.root, file) ? undefined : lastCommitOf(ctx.root, file)`; the facts
     are `commitFacts(ctx.root, commit)` when `commit` is set, else `workingFacts(ctx.root)` (Task 1). The report
     text is the file on disk, which equals the committed text whenever `commit` is set.
  4. `scoutCheck({ ...facts, path: file, text })`, the same call `scoutCheckCommand` makes; no failure returns
     undefined; otherwise return
     `cannot approve <id>: <file> fails accord scout check <where> and holds no line "skipped: <reason>"\n`, `<where>`
     `at commit <first 12 characters>, the commit that last changed it` or
     `on the working tree, since it has uncommitted changes`, followed by one `fail: <failure>\n` line per failure.
- `approve.ts`: after the lane S refusal (line 11-13) and before `approvedHash`, when
  `ticket.frontmatter?.lane === 'M'`, a refusal is written to `ctx.stdout` and `approve` returns 1, writing nothing.
- `packages/cli/test/helpers/repo.ts`, `makeLaneRepo`: after merging `extra`, every key matching
  `/^accord\/tickets\/([^/]+)\.md$/` whose text matches `/^lane: M\s*$/m`, and whose `accord/tickets/<id>/scout.md`
  key is absent, gets that key with `skipped: seeded by the test helper\n` (ledger Ruling 21).
- `packages/cli/test/helpers/worktree.ts`, `makeClone`: each ticket id also writes
  `accord/tickets/<id>/scout.md` with the same line.

Must not change: lane S, no-lane, unknown and frontmatter refusals exit 2 before any scout read (`approve.ts:10-13`,
`packages/cli/test/lane-s.test.ts:265-279`); lane L and P tickets approve as before; `approved` and `already approved`
lines and the `writeKey` error (`approve.ts:14-25`); every approve call in `lane-commands.test.ts`, `lane-flow.test.ts`,
`core-ready.test.ts`, `lane-s.test.ts`, `status.test.ts` and `worktree-push.test.ts` passes through the seeded
report. Run those six files. A test that fails only because the seeded `scout.md` now shows in its output changes
its body to expect it, keeps its title, and the change is a Ruling in the report.

Test first. Inside `describe('accord approve', ...)` of `packages/cli/test/lane-commands.test.ts`, an `it` titled
`ac-4 a lane M ticket is approved only with a scout report that passes the check or says why it was skipped`:
`repo = makeLaneRepo({ 'src/a.ts': 'export function useA() {}\n' })`, `before = ticketText(repo)`,
`S = 'accord/tickets/T-1/scout.md'`, `reset = () => writeFiles(repo, { 'accord/tickets/T-1.md': before })`, and
`USE` the report

```text
## Files
- `src/a.ts`

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no caller of useA | `useA[(]` | `src/` | `src/a.ts` |
```
Each step runs `run(['approve', 'T-1'], repo)`:
1. No report: `rmSync(join(repo, 'accord', 'tickets', 'T-1', 'scout.md'))`. Code 1, out holds
   `accord/tickets/T-1/scout.md is missing`, `ticketText(repo)` equals `before`.
2. A report that fails at the commit that last changed it: `writeFiles(repo, { [S]: '## Files\n- `src/missing.ts`\n' })`,
   `commitMsg(repo, 'fixture')`. Code 1, out holds `accord/tickets/T-1/scout.md fails accord scout check at commit`,
   `the commit that last changed it` and `## Files lists src/missing.ts, which git does not track`; the ticket
   equals `before`.
3. The failing report with a `skipped:` line, uncommitted: `writeFiles(repo, { [S]: '## Files\n- `src/missing.ts`\n\nskipped: the owner accepted the report as it is\n' })`.
   Code 0, out starts `approved accord/tickets/T-1.md`. Then `reset()`.
4. A report that passes at the commit that last changed it, although the working tree no longer agrees:
   `writeFiles(repo, { [S]: USE })`, `commitMsg(repo, 'scout')`, then `writeFiles(repo, { 'src/b.ts': 'useA();\n' })`
   and `commitMsg(repo, 'b')`, so `scout.md` is unchanged since its commit, which holds no `src/b.ts`. Code 0, out
   starts `approved accord/tickets/T-1.md`. Then `reset()`.
5. The same report with an uncommitted change is judged on the working tree: append `- see src/a.ts:1\n` to
   `scout.md`. Code 1, out holds `on the working tree, since it has uncommitted changes` and `src/b.ts:1`; the
   ticket equals `before`.
6. `run(['scout', 'check', S], repo)` on that same working tree also has code 1 and out holding `src/b.ts:1`: the
   command and approve give one verdict on one tree.

## Task 7: The scout writes the fixed form and the accord and intent skills check and save it

covers: D-01
files: packages/core/agents/scout.md, packages/core/skills/shared/scout.md (new), packages/core/skills/accord/lane.md, packages/core/skills/accord/SKILL.md, packages/core/skills/accord/worktree.md, packages/core/skills/intent/SKILL.md, packages/core/src/generated/agents.ts, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, packages/core/test/scout-text.test.ts (new), .claude/agents/accord-scout.md, .claude/skills/accord/SKILL.md, .claude/skills/accord/lane.md, .claude/skills/accord/worktree.md, .claude/skills/accord/scout.md (new), .claude/skills/accord-intent/SKILL.md, .claude/skills/accord-intent/lane.md, .claude/skills/accord-intent/scout.md (new), .claude/skills/accord-debug/worktree.md, .claude/skills/accord-verify/worktree.md
verify: packages/core/test/scout-text.test.ts#risk:parsing-the-scout-prompt-and-the-scout-steps-write-the-report-form-accord-scout-check-parses

Consumes `parseScoutReport` (Task 1). Produces:
- `packages/core/agents/scout.md`: the frontmatter (lines 1-6) stays; the body becomes exactly:

~~~text
You answer the question you were given with facts from the code.

- Every fact carries `path:line`, the path written in full from the repository root, never shortened. A claim without a location is not a fact; leave it out.
- You read. You never edit a file, and you never propose a design or a fix.
- Open every file the question names before you state anything about it.
- When asked for impact, list every caller, test, fixture, config entry, and export that the named change would reach, each with `path:line`. Check the wiring every time: the index file that exports it, the command or route that registers it, its config entry, its test, the copies generated from it, and any README or skill text that restates the rule.
- Read every record the ticket's frontmatter `research:` key lists, when it has one: a record is evidence, not a contract, and holds at the commit it names, so check a claim against the code before you rely on it.
- Every claim that something is absent, such as "only", "none", "no other" or "not found", is one row of `## Absent`: the claim; the JavaScript regular expression you searched with, matched line by line; the folders you searched, `.` for the whole repository; and the files allowed to match. Write it as "search logged", never "proven absent". Never guess.
- Your answer is at most 30 lines, in the form below. `## Files` is always there: every existing file the change is expected to touch, one per line, empty when there is none. Write a `|` inside a table cell as `\|`.

```markdown
## Files
- `src/load/config.ts` — defines loadConfig, `src/load/config.ts:8`

## Absent
| Claim | Pattern | Folders | Allowed hits |
|---|---|---|---|
| no other caller of loadConfig | `loadConfig[(]` | `src/` | `src/load/config.ts` |

## Facts
- <fact>, `<path>:<line>`
```
~~~
- `packages/core/skills/shared/scout.md` (new), exactly:

```text
---
kind: reference
---

# The scout's report

A reply of `accord-scout` that a lane, an answer or an approval rests on is checked by the CLI and saved in the
ticket, so no agent after it searches again.

1. **Check.** Write a new reply, verbatim, to a file outside the working tree. Below it add a `## New files`
   section, one `- <path>` line per file the change creates that you name, since the scout reports only files
   that exist. Run `accord scout check "<file>"` on that file, and use the lane numbers it prints when you
   propose a lane.
2. **Exit 1.** Dispatch a fresh `accord-scout` once with the reply and everything the check printed, asking for
   the same reply corrected in the same form; put the corrected reply in place of the old one in the file you
   checked, keep its `## New files`, and run the check again. When it exits 1 again, show the owner what it
   prints and ask whether to accept the report as it is.
3. **Skipped.** Write a line `skipped: <reason>` into `scout.md` only when no scout ran, or when the owner
   accepts a failing report, the reason then quoting the owner's words. Never write it to get past the check.
4. **Save.** A checked report is copied to `accord/tickets/<id>/scout.md` only while that file does not exist:
   the reply to another question never replaces a saved report or its `## New files`. For a new request in
   lane S or M, after `accord new ticket` and before you follow the `enter:` or `stop:` line it printed, copy
   the checked file to `<path>/accord/tickets/<id>/scout.md`, run
   `git -C "<path>" add -- accord/tickets/<id>/scout.md`, then
   `git -C "<path>" commit -m "scout: <id> report" -- accord/tickets/<id>/scout.md` and
   `git -C "<path>" push -u origin <branch>`. At intent step 2, when `accord/tickets/<id>/scout.md` does not
   exist, copy the checked reply there, add and commit it the same way and run `accord worktree push <id>`;
   when it exists, use the checked reply for your questions and leave `scout.md` as it is.
5. **Approval.** Before the owner's yes at approach step 5, run
   `accord scout check "accord/tickets/<id>/scout.md"`; when that file does not exist, dispatch `accord-scout`
   with the path of `accord/tickets/<id>.md`, asking for the existing files the approach touches, then check its
   reply as steps 1 to 3 say, copy it to `accord/tickets/<id>/scout.md`, run
   `git add -- accord/tickets/<id>/scout.md` and `git commit -m "scout: <id> report" -- accord/tickets/<id>/scout.md`,
   then `accord worktree push <id>`, all before the owner's yes. A saved report that fails is corrected in place
   as step 2 says, then committed and pushed the same way before the owner's yes.
   `accord approve <id>` runs the same check on `scout.md` as of the commit that last changed it, or on the
   working tree while the file has uncommitted changes. When `accord approve <id>` exits 1 naming `scout.md`,
   correct the report as steps 2 and 3 say, commit it and run `accord approve <id>` again: the owner's yes
   still holds, since `scout.md` is not among the approved sections.
6. **Read.** The planner, and every agent after it that needs the ticket's files, starts from
   `accord/tickets/<id>/scout.md`.
```
- `packages/core/skills/accord/lane.md`: line 12 ends `you add the new files the change creates.`; append
  ` Check and save its reply as `./scout.md` says.` The paragraph at lines 25-26 ends
  `a request that creates 7 new files is lane M.`; append
  `` `accord scout check` prints these counts, and the sensitive matches, from the scout's `## Files` and the `## New files` you add.``
  The lift paragraph (lines 20-23) stays byte for byte (`packages/core/test/stage-skills.test.ts:735-778`).
- `packages/core/skills/accord/SKILL.md`: `loads:` (line 6) gains `shared/scout.md`; line 62 ends
  `the owner may override.`; append ` Check and save the scout's reply as `./scout.md` says.`
- `packages/core/skills/intent/SKILL.md`: `loads:` (line 6) gains `shared/scout.md`; in step 2 (lines 17-20), after
  `the questions the code can answer.`, insert
  ` Check its reply as `./scout.md` says, and save it as `accord/tickets/<id>/scout.md` only when that file does not exist.`
  Rewrap near the neighbouring line widths.
- `packages/core/skills/accord/worktree.md` (rendered into the accord, debug and verify skills), line 53: replace
  `never edit a file
  there except the people entry below and, in a lane S ticket,` (the text across lines 52-53) so that it reads
  `` never edit a file there except the people entry below, the scout's report `accord/tickets/<id>/scout.md` with the commit and push that save it, and, in a lane S ticket, ``
  followed by the rest of the line unchanged. No `./scout.md` here: the debug and verify skills load no such
  file (`packages/core/test/skills.test.ts:292-309`). `except the people entry below` stays one contiguous phrase
  (`packages/core/test/stage-skills.test.ts:274`).
- `packages/core/test/stage-skills.test.ts`: `REQUIRED.accord` and `REQUIRED.intent` (lines 23-24) each gain
  `'./scout.md'`.
- Then `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`.

Must not change: every phrase `packages/core/test/stage-skills.test.ts:738-778` and `:876-933` assert; the
research sentence of the scout (`packages/core/test/agents.test.ts:251-263`); the scout's frontmatter and its
rendered keys order (`agents.test.ts:51-60`, `:113`).

Test first, `packages/core/test/scout-text.test.ts`, importing `agentTargets`, `parseScoutReport` and `skillTargets`
from `../src/index.js`, `config()` as `packages/core/test/agents.test.ts:10-11`, and
`flat = (text: string) => text.replace(/\s+/g, ' ')`. Every `holds` below is
`expect(flat(<rendered text>)).toContain(<phrase>)`: the source wraps lines and the renderer keeps the wraps, so a
phrase is only ever compared against flattened text, skill files and agents alike. A top-level `it` titled
`risk:parsing the scout prompt and the scout steps write the report form accord scout check parses`:
- the rendered `.claude/agents/accord-scout.md` is not empty; the text of its first ```` ```markdown ```` fence
  (`/```markdown\n([\s\S]*?)\n```/`, matched on the raw text) parsed by `parseScoutReport` has `faults` `[]`,
  `files` with at least one entry, one `absent` row whose `folders` and `allowed` are not empty, and a `pattern`
  that `new RegExp` accepts;
- the agent text holds `search logged`, `never "proven absent"`, `| Claim | Pattern | Folders | Allowed hits |`,
  `in full from the repository root` and `Open every file the question names`;
- for `accord` and `accord-intent`, `.claude/skills/<dir>/scout.md` holds `## New files`, `skipped: <reason>`,
  `accord scout check "<file>"`, `` before you follow the `enter:` or `stop:` line `` and
  `the reply to another question never replaces a saved report`, and both `.claude/skills/<dir>/SKILL.md` and
  `.claude/skills/<dir>/lane.md` hold `` `./scout.md` ``;
- `.claude/skills/accord/worktree.md` holds
  `` except the people entry below, the scout's report `accord/tickets/<id>/scout.md` with the commit and push that save it ``.

## Task 8: The approach and build stages run the check and handle a refusal, and the planner and README name the report

covers: D-01
files: packages/core/skills/approach/SKILL.md, packages/core/skills/build/SKILL.md, packages/core/agents/planner.md, packages/core/src/generated/agents.ts, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts, packages/core/test/scout-text.test.ts (new), README.md, packages/cli/README.md, .claude/agents/accord-planner.md, .claude/skills/accord-approach/SKILL.md, .claude/skills/accord-approach/scout.md (new), .claude/skills/accord-build/SKILL.md, .claude/skills/accord-build/scout.md (new)
verify: packages/core/test/scout-text.test.ts#risk:complex-branching-the-approach-and-build-stages-send-an-approve-refusal-back-to-the-scout-steps

Consumes Task 7's `shared/scout.md`. Produces:
- `packages/core/skills/approach/SKILL.md`: `loads:` (line 6) gains `shared/scout.md`. Step 5 (line 57) begins
  `5. **The owner's yes.** Run `accord show <id> --approval`;`; insert, right after `**The owner's yes.**`:
  ` Run `accord scout check "accord/tickets/<id>/scout.md"`, and follow `./scout.md` when it does not exit 0 and when `accord approve` exits 1 below. Then`
  so the step reads `... below. Then run `accord show <id> --approval`; ...`. Rewrap near the neighbouring widths.
- `packages/core/skills/build/SKILL.md`: `loads:` (line 6) gains `shared/scout.md`. In step 6 (line 43), after
  `go on even if it fails.`, insert ` When `accord approve` exits 1, follow `./scout.md`.`
- `packages/core/agents/planner.md`: line 18 ends `each with `path:line`.`; append
  ` Start from `accord/tickets/<id>/scout.md` when it exists, then run your own search.`
- `packages/core/test/stage-skills.test.ts`: `REQUIRED.approach` (line 26) gains `'./scout.md'` and
  `'accord scout check'`; `REQUIRED.build` (line 28) gains `'./scout.md'`.
- `README.md` line 105: replace
  `A scout reads the code before any lane is proposed, a lane S ticket records the files it expects to touch, and `accord gate done` fails it when it touches others.`
  with

  ```text
  A scout reads the code before any lane is proposed; `accord scout check` checks the citations and logged searches of its report and prints the lane numbers, and the report is saved as `accord/tickets/<id>/scout.md`, which `accord approve` requires of a lane M ticket, judged by the same check at the commit that last changed it, unless the file holds a `skipped: <reason>` line. A lane S ticket records the files it expects to touch, and `accord gate done` fails it when it touches others.
  ```
  and after the `accord show <id> [--json]` row of the table (line 135) add

  ```text
  | `accord scout check <file>` | Check a scout report's citations and logged searches against the files git tracks, and print its lane numbers. |
  ```
- Then `npm run gen` (it regenerates `packages/cli/README.md`), `npm run build`,
  `node packages/cli/dist/cli.js skills sync`.

Must not change: the push order the stage rows assert (`packages/core/test/stage-skills.test.ts:880-911`: approach
step 5 keeps `Then commit the ticket, with `approved_hash:` and `ac_hash:` in it` before
`run `accord worktree push <id>``; build step 6 keeps `on yes run `accord approve <id>`, commit the ticket` whole);
every planner phrase `packages/core/test/agents.test.ts:17-24`, `:36-41`, `:143-224` assert; the README drift test
(`packages/cli/test/readme.test.ts:21`).

Test first, in `packages/core/test/scout-text.test.ts`, a top-level `it` titled
`risk:complex-branching the approach and build stages send an approve refusal back to the scout steps`. Every
text below, skill files and agents alike, is read as `flat(<rendered text>)` (Task 7), and every slice is taken
from that flattened text, never from the raw one, since the source wraps its lines:
- in the rendered `.claude/skills/accord-approach/SKILL.md`, the slice from `5. **The owner's yes.**` to `6. Next`
  holds `accord scout check "accord/tickets/<id>/scout.md"` before `accord show <id> --approval`, and holds
  `` `./scout.md` `` and `` when `accord approve` exits 1 ``;
- in `.claude/skills/accord-build/SKILL.md`, the slice from `6. **Change of course.**` to `7. **Plan changed.**`
  holds `` When `accord approve` exits 1, follow `./scout.md`. ``;
- `.claude/skills/accord-approach/scout.md` and `.claude/skills/accord-build/scout.md` each hold
  `` When `accord approve <id>` exits 1 naming `scout.md` ``, `the owner's yes still holds`,
  `as of the commit that last changed it, or on the working tree while the file has uncommitted changes` and
  `` then `accord worktree push <id>`, all before the owner's yes ``;
- the rendered `.claude/agents/accord-planner.md` holds
  `` Start from `accord/tickets/<id>/scout.md` when it exists, then run your own search. ``

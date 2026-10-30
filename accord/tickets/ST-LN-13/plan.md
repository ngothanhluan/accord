---
baseline: 7bcd659645f9cc41a03b50dd4494dd9ded0c2ce0
plan_hash: "fnv1a64:ad3ff68248783852"
---

# Plan: ST-LN-13

Review mode: outcome. One branch, no slices.

Rules for every task:
- After changing a skill or agent source under `packages/core/skills/` or `packages/core/agents/`, run `npm run gen`,
  then `npm run build`, then `node packages/cli/dist/cli.js skills sync`, in that order (conventions.md). This
  rewrites `packages/core/src/generated/skills.ts` or `packages/core/src/generated/agents.ts` and the `.claude/...`
  copies the task lists. This repository renders for the `claude` runtime only, so there is no `.agents/skills/` folder
  to update.
- Before running a test under `packages/cli/test/`, run `npm run build`: the CLI tests import the built core.
- A rendered SKILL.md stays within 5120 bytes and 120 lines (`packages/core/test/skills.test.ts`). When an edit does
  not fit, first re-wrap the lines of the paragraphs and list items you touched, up to 118 characters, changing no
  word. If it still does not fit, stop with `BLOCKED` and give the byte count. Never cut other wording (ledger Ruling,
  ST-LN-33: shortening must never lose a point).
- A phrase that a test in `packages/core/test/stage-skills.test.ts` or `packages/core/test/lane-s.test.ts` asserts on
  the raw text (for example the `REQUIRED` table) stays on one line. When re-wrapping would split one, move the line
  break. Do not change those tests except where a task says so.
- Skill and agent text never names a lint or gate rule id (such as `lint.research-reference`), never uses the words
  `warning`, `Ready` or `Done` (except in `Done when`), never names `packages/`, never holds a backslash, and never
  writes a `./<file>` reference to a file that is not rendered in the same folder (`skills.test.ts`).
- Test names hold no `@` and no comma. Each new test is a top-level `it`, outside any `describe`, so its case id is
  `<file>#<name with spaces as ->`.
- The record header text used in tests: ``const REC = (topic: string) => '# ' + topic + '\n\nDate: 2026-10-30. Repository at `5c083d3`. Feeds the ticket.\n';``
  (single-quoted strings; a backtick inside one needs no escape). Define it in each test file that
  needs it.
- Every task ends with `npm run typecheck` and `npm run lint`. CI runs both, and the typecheck reads test files under
  strict mode. Fix an error they report in a file on the task's `files:` line; for an error in any other file, stop with
  `BLOCKED` and name the file, the line and the error.

## Task 1: The research key, the loader and the lint rule that refuses an undated or missing record

covers: @ac-1, D-05
files: packages/core/schemas/ticket.schema.json, packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/load/research.ts (new), packages/core/src/lint/research.ts (new), packages/core/src/lint/rules.ts, packages/core/src/index.ts, packages/core/test/research.test.ts (new)
verify: packages/core/test/research.test.ts#ac-1-lint-refuses-a-ticket-whose-research-reference-is-not-a-dated-record (@ac-1), packages/core/test/research.test.ts#risk:parsing-a-record-header-counts-in-its-first-five-lines-after-a-bom-and-crlf-with-the-sha-bare-or-in-backticks, packages/core/test/research.test.ts#risk:parsing-a-research-entry-with-a-backslash-a-dot-segment-or-a-leading-slash-is-outside-the-research-folder-and-only-listed-records-are-loaded

This task is the wiring: a ticket's `research:` key reaches the snapshot, lint reads it, and `gate ready` fails on it.

Consumes: `loadSnapshot`, `lintSnapshot`, `gateReady`, `validate` from `packages/core/src/index.ts`; `normaliseText`
from `packages/core/src/load/frontmatter.ts`; the `Rule` and `Draft` types of `packages/core/src/lint/rules.ts`.
Test helpers: `approved(files, id)` from `packages/core/test/helpers/approve.ts`, and `CONFIG`, `laneTicket` from
`test/helpers/lane.ts` (`laneTicket(id, { frontmatter: [...] })` puts each given line before the closing `---`).

Produces:
- `packages/core/schemas/ticket.schema.json`: a property `"research": { "type": "array", "uniqueItems": true, "items": { "type": "string" } }`,
  placed after `depends_on`. No `pattern` and no `minLength` (ledger Ruling: a schema finding drops the whole frontmatter,
  so a bad path must be a lint finding that names it).
- `packages/core/src/model/snapshot.ts`: `research?: string[]` in `TicketFrontmatter` after `depends_on`, commented
  `// ST-LN-13: repository paths of research records under accord/research/; optional`. Update the comment on
  `RepoSnapshot.files` to add "and every accord/research/ file some ticket lists under research:".
- `packages/core/src/load/research.ts` (pure, no node import), exporting:
  - `RESEARCH_DIR = 'accord/research/'`;
  - `isResearchPath(entry: string): boolean`: false when `entry` does not start with `accord/research/` (a plain
    prefix test first, ledger Ruling), or holds a backslash, or, split on `/`, has a segment that is `''`, `.` or `..`;
    true otherwise. The entry is compared as written, never normalised (ledger Ruling).
  - `recordHeaderFaults(text: string): ('date' | 'commit')[]`: take the first five lines of `normaliseText(text)`
    (BOM stripped, CRLF to LF); `'date'` is in the result when none of them matches `/Date: \d{4}-\d{2}-\d{2}/`, and
    `'commit'` when none matches ``/Repository at `?\b[0-9a-f]{7,40}\b/``. Matches are found anywhere in a line, not
    anchored (ledger Ruling). Order: `'date'` before `'commit'`.
- `packages/core/src/load/snapshot.ts`: after the loop that parses tickets, collect every `research` entry of every
  loaded ticket's frontmatter, unique, in code-point order; for each one that `isResearchPath` accepts and that is a
  key of the normalised input files, add `snapshotFiles[path] = normaliseText(files[path])`. Append these after the
  entries already in `snapshotFiles`; do not reorder those, since the D-54 goldens depend on their order. Nothing
  else under `accord/research/` is kept (ledger Ruling: the folder also holds data dumps such as `.jsonl`).
- `packages/core/src/lint/research.ts`: `researchReference: Rule['check']`. For each ticket, for each entry `p` at
  index `i` of `frontmatter.research`, at most one draft `{ file: t.file, pointer: '/research/' + i, reason }`:
  - `isResearchPath(p)` false: ``research lists "<p>", which is not a path under accord/research/``;
  - else `p` not an own key of `snapshot.files`: ``research lists "<p>", which is not a file in the repository``;
  - else from `recordHeaderFaults(snapshot.files[p])`: `['date']` gives
    ``research lists "<p>", whose first five lines hold no "Date: <YYYY-MM-DD>"``; `['commit']` gives
    ``research lists "<p>", whose first five lines hold no "Repository at <sha>"``; both give
    ``research lists "<p>", whose first five lines hold neither "Date: <YYYY-MM-DD>" nor "Repository at <sha>"``;
    none gives no draft.
  The finding is on the ticket file, as `lint.depends-unknown` is, because `gate ready` keeps only findings on the
  ticket's own files (`packages/core/src/gate/index.ts:40-45`).
- `packages/core/src/lint/rules.ts`: a row `{ id: 'lint.research-reference', level: 'error', profiles: ['build', 'maintain'], check: researchReference }`
  directly after the `lint.depends-cycle` row, with its import.
- `packages/core/src/index.ts`: `export { isResearchPath, recordHeaderFaults, RESEARCH_DIR } from './load/research.js';`

Write the tests first, in the new file `packages/core/test/research.test.ts`, each top level:
1. `ac-1 lint refuses a ticket whose research reference is not a dated record`. `const R = 'accord/research/2026-10-30-x.md'`.
   Four cases, each `[reference, extra files]`:
   - `['accord/research/2026-10-30-none.md', {}]` (no such file);
   - ``[R, { [R]: '# X\n\nRepository at `5c083d3`.\n' }]`` (no date);
   - `[R, { [R]: '# X\n\nDate: 2026-10-30.\n' }]` (no sha);
   - `['docs/notes.md', { 'docs/notes.md': REC('X') }]` (outside `accord/research/`).
   For each, build `files = approved({ 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ['research: ["' + reference + '"]'] }), ...extra }, 'T-1')`
   and `s = loadSnapshot({ files, tree: Object.keys(files).sort() })`. Assert that the `lint.research-reference`
   findings of `lintSnapshot(s)` are exactly one, with `level: 'error'`, `file: 'accord/tickets/T-1.md'`,
   `pointer: '/research/0'`, and a `reason` containing the reference; and that `gateReady(s, 'T-1')` has verdict
   `'fail'` and holds a finding with rule `lint.research-reference`. Guard: the same build with `[R, { [R]: REC('X') }]`
   has no `lint.research-reference` finding and `gateReady(s, 'T-1').verdict` is `'pass'`, so each failure above
   comes from the research reference alone.
2. `risk:parsing a record header counts in its first five lines after a bom and crlf with the sha bare or in backticks`.
   Assert `recordHeaderFaults` gives:
   - `[]` for a BOM and CRLF header with the sha in backticks, written in the test as ``String.fromCharCode(0xfeff) + '# T\r\n\r\nDate: 2026-10-30. Repository at `5c083d3`. Feeds T-1.\r\n'``;
   - `[]` for `'# T\n\nDate: 2026-10-30\nRepository at ' + 'a'.repeat(40) + '\n'`;
   - `['commit']` for `'Date: 2026-10-30\nRepository at ' + 'a'.repeat(41) + '\n'` and for `'Date: 2026-10-30\nRepository at 123456\n'`;
   - `['date']` for `'Date: 2026-1-30\nRepository at 5c083d3\n'`;
   - `['date', 'commit']` for `'1\n2\n3\n4\n5\nDate: 2026-10-30. Repository at 5c083d3\n'` (line six) and for `''`.
   Then through the loader: a lane ticket `T-1` listing `R` with `files[R]` set to the BOM and CRLF text above has no
   `lint.research-reference` finding, and `loadSnapshot(...).files[R]` equals that text without the BOM and with LF.
3. `risk:parsing a research entry with a backslash a dot segment or a leading slash is outside the research folder and only listed records are loaded`.
   - `isResearchPath` is false for each of `'accord\\research\\a.md'`, `'accord/research/../tickets/T-1.md'`,
     `'accord/research/./a.md'`, `'/accord/research/a.md'`, `'./accord/research/a.md'`, `'accord/research/'`,
     `'accord/research//a.md'`, `'accord/researcher/a.md'`, `'docs/a.md'`; true for `'accord/research/2026-10-30-a.md'`
     and `'accord/research/sub/a.md'`.
   - A lane ticket `T-1` with the frontmatter line
     `"research: ['accord\\research\\a.md', 'accord/research/../tickets/T-1.md', '/accord/research/a.md']"` (single-quoted
     YAML keeps each backslash) and the file `accord/research/a.md` holding `REC('A')` in the input: lint gives three
     `lint.research-reference` findings, at pointers `/research/0`, `/research/1`, `/research/2`, each reason ending
     `which is not a path under accord/research/`.
   - `validate('ticket', { id: 'T-1', title: 'x', type: 'story', status: 'draft', research: ['a', 'a'] })` holds a
     `schema.uniqueItems` finding at `/research`; `research: 'a'` holds `schema.type` at `/research`; `research: [1]`
     holds `schema.type` at `/research/0`; `research: []` and `research: ['docs/a.md']` hold none.
   - A snapshot whose input holds `accord/research/2026-10-25-x.findings.jsonl` and `accord/research/2026-10-29-y.md`
     (with `REC('Y')`) and a lane ticket without the key: `Object.keys(snapshot.files)` holds no key starting with
     `accord/research/`, and lint has no `lint.research-reference` finding.

Behaviour that must not change: every existing schema key and its rule; `additionalProperties: false`; the D-54
goldens (`packages/core/test/__golden__/`) byte for byte, since no fixture lists research; every other lint rule, its
level and its order in `RULES`; the loader's handling of prototypes, the tokens file and the test report.

Run `npx vitest run packages/core/test/research.test.ts packages/core/test/schemas.test.ts packages/core/test/lint.test.ts packages/core/test/snapshot.test.ts packages/core/test/lane-lint.test.ts`,
then `npm run typecheck` and `npm run lint`.

## Task 2: The anchor prints the research list

covers: @ac-2, D-03
files: packages/core/src/status/anchor.ts, packages/core/test/anchor.test.ts
verify: packages/core/test/anchor.test.ts#ac-2-a-ticket-that-names-dated-records-passes-lint-and-its-anchor-lists-them (@ac-2), packages/core/test/anchor.test.ts#risk:complex-branching-a-lane-S-anchor-prints-the-research-list-before-the-Rulings-and-a-ticket-without-the-key-prints-none

Consumes: `anchorText(snapshot, id)` (`packages/core/src/status/anchor.ts`), the `research` frontmatter field from
Task 1, `lintSnapshot` and `loadSnapshot`. The test file already has `snap(files)`, `base`, `CONFIG`, `LANE_S_BODY` and
`laneTicket`.

Produces: in `anchorText`, after the loop that prints the owner sections and before the `## Rulings` block, when
`ticket.frontmatter?.research` is a non-empty array, push `''`, `'## Research'`, then each entry exactly as written,
one per line, in key order, with no list marker. Nothing is printed when the key is absent or empty (ledger Ruling:
existing anchor outputs stay unchanged). The same code path serves the lane S and the lane M layouts.

Write the tests first, top level in `packages/core/test/anchor.test.ts`:
1. `ac-2 a ticket that names dated records passes lint and its anchor lists them`. `const B = 'accord/research/2026-10-30-b.md'`,
   `const A = 'accord/research/2026-10-29-a.md'`. Files: `CONFIG`; `accord/tickets/T-1.md` =
   `laneTicket('T-1', { frontmatter: ['research: ["' + B + '", "' + A + '"]'] })`; `[B]: REC('B')` (sha in backticks);
   `[A]: '# A\n\nDate: 2026-10-29\nRepository at ' + 'a'.repeat(40) + '\n'` (bare sha). The key lists B before A, so
   the anchor cannot pass by sorting. Assert: `lintSnapshot(s).findings` holds no finding with rule
   `lint.research-reference` and none whose `file` is A or B; and `lines = anchorText(s, 'T-1')!.split('\n')` sliced
   from `lines.indexOf('## Corrections')` equals
   `['## Corrections', '(none)', '', '## Research', B, A, '', '## Rulings', '(none)', '']`.
2. `risk:complex-branching a lane S anchor prints the research list before the Rulings and a ticket without the key prints none`.
   A lane S ticket `S-1` (`laneTicket('S-1', { lane: 'S', body: LANE_S_BODY, frontmatter: ['research: ["' + A + '"]'] })`)
   with `[A]` as above: its anchor lines sliced from `'## Done when'` equal
   `['## Done when', 'Pressing export saves report.csv.', '', '## Research', A, '', '## Rulings', '(none)', '']`.
   The same ticket with `research: []` and the `base` lane M ticket each give an anchor that does not contain `## Research`.

Behaviour that must not change: every existing case in `anchor.test.ts`, which pins the full anchor text of tickets
without the key; the order Intent, Vetoes, Decisions, Corrections, Rulings (lane M) and Understood, Done when, Scope,
Vetoes, Decisions, Corrections, Rulings (lane S); `undefined` for an unknown or lane-less ticket.

Run `npm run build`, then `npx vitest run packages/core/test/anchor.test.ts packages/cli/test/hook.test.ts`, then
`npm run typecheck` and `npm run lint`.

## Task 3: The scout, architect, critic and planner are told to read the listed records

covers: @ac-3, D-03, D-07, D-01, D-02
files: packages/core/agents/scout.md, packages/core/agents/architect.md, packages/core/agents/critic.md, packages/core/agents/planner.md, packages/core/src/generated/agents.ts, .claude/agents/accord-scout.md, .claude/agents/accord-architect.md, .claude/agents/accord-critic.md, .claude/agents/accord-planner.md, packages/core/test/agents.test.ts
verify: packages/core/test/agents.test.ts#ac-3-the-scout-architect-critic-and-planner-read-the-research-records-and-no-other-agent-is-told-to (@ac-3)

D-01 and D-02 bound this task: no researcher agent is added, and the scout's 30-line cap, its tools and how it is
dispatched do not change. D-07: the scout gains only the read sentence.

Consumes: `agentTargets(config)` from `packages/core/src/index.ts`; the test file's `config(over)` helper. Produces one
sentence in four agent sources.

The sentence, word for word, written as one list item on one line in each source:
```
- Read every record the ticket's frontmatter `research:` key lists, when it has one: a record is evidence, not a contract, and holds at the commit it names, so check a claim against the code before you rely on it.
```
Place it:
- `packages/core/agents/scout.md`: after the bullet that starts `- When asked for impact,`.
- `packages/core/agents/architect.md`: after the bullet `- Your input is the path of one ticket file. Read all of it, then the code it touches.`
- `packages/core/agents/critic.md`: after the bullet that starts `- Your caller names one mode,`.
- `packages/core/agents/planner.md`: after the bullet that starts ``- Read `accord/product/` before you plan``.

Write the test first, top level in `packages/core/test/agents.test.ts`:
`ac-3 the scout architect critic and planner read the research records and no other agent is told to`. Let `S` be the
sentence above without its leading `- `. Render `agentTargets(config({ runtimes: ['claude', 'codex', 'cursor', 'copilot'] }))`.
Assert the sorted rendered paths equal the ten files `.claude/agents/accord-<name>.md` for architect, auditor,
critic, debugger, executor, final-reviewer, planner, reviewer, scout, verifier (code-point order). For the scout,
architect, critic and planner, assert the text with each run of whitespace turned into one space contains `S`. For
every other rendered agent, assert its text does not match `/research/i`, with the path as the message.

Behaviour that must not change: every other line of the four agents; the ``Mode `plan`:`` check list of the critic and
its copy in the planner (`ac-4 the planner runs every plan check of the critic before it replies`); `AGENT_REQUIRED`;
the 60-line body cap; the six other agents byte for byte.

Run `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`. Then run
`npx vitest run packages/core/test/agents.test.ts packages/core/test/skills.test.ts`, then `npm run typecheck` and
`npm run lint`.

## Task 4: The intent interview reads the records first and moves the evidence it replaces into a record

covers: @ac-4, D-06, D-08
files: packages/core/skills/intent/research.md (new), packages/core/skills/intent/SKILL.md, packages/core/src/generated/skills.ts, .claude/skills/accord-intent/research.md (new), .claude/skills/accord-intent/SKILL.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#ac-4-the-intent-interview-moves-the-evidence-it-replaces-into-a-dated-record-listed-under-research (@ac-4)

Consumes: `skillTargets(config)` and `recordHeaderFaults` (Task 1) from `packages/core/src/index.ts`; the module-level
`config` of `stage-skills.test.ts` (roles ba and dev, runtime claude). Produces `intent/research.md` and three pointers
in the intent SKILL.md.

`packages/core/skills/intent/research.md`, new, exactly this text (wrap lines at up to 118 characters as you like; the
test reads it flattened). It opens with a frontmatter block of three lines: `---`, `kind: reference`, `---`. Then:
- `# Research records`
- Paragraph: ``A research record is a file `accord/research/<YYYY-MM-DD>-<topic>.md` that keeps a discussion, a measure or a study made before or beside a ticket. It is evidence, never a contract. A ticket names its records under its frontmatter key `research:`, one repository path per entry. The key is optional: make a record only when there is research or replaced evidence to keep.``
- `## Before the first question`
- Paragraph: ``At step 2, before any question to the owner, read every record `accord anchor` lists under `## Research`. A record holds at the commit it names, so check a claim against the code before you rely on it.``
- `## Evidence a rewrite replaces`
- Paragraph: ``At step 6, before you rewrite a queued Intent, first move every line of evidence it replaces, verbatim, into a new record under `accord/research/` with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines, and list that record under the ticket's `research:` key. Never delete such a line. Start the record as below, with today's date and the sha that `git rev-parse --short HEAD` prints:``
- A fenced block opened by a line of three backticks with no info string and closed by a line of three backticks,
  holding exactly these three lines: `# <topic>`, an empty line, ``Date: <YYYY-MM-DD>. Repository at `<sha>`.``
- Paragraph: `Commit the record with the ticket at steps 8 and 9.`
- `## The ticket's own files`
- Paragraph: ``A record under `accord/research/` that the ticket lists under `research:` and that origin's default branch does not hold counts as one of the ticket's own files, beside `accord/tickets/<id>.md` and the paths under `accord/tickets/<id>/`: the `git diff` and `git status` checks of the lane S rule accept it, and so does step 2 of `## Moving to lane S` in `./ids.md`. A change to a record the default branch already holds does not count. Step 3 there first moves the evidence of the sections it replaces into a record, as `## Evidence a rewrite replaces` says.``
This file holds no other fenced block.

`packages/core/skills/intent/SKILL.md`:
- frontmatter `loads:` becomes `[shared/ask.md, accord/ids.md, accord/lane.md, intent/research.md]`;
- step 2: append the sentence ``Before any question, read `./research.md`.`` after `cites the file that prompted it.`;
- step 6: after the table, add the indented line ``   Before you rewrite a queued Intent, follow `./research.md`.``;
- the `**Lane S.**` rule: change ``list only `accord/tickets/<id>.md` and paths under `accord/tickets/<id>/`, propose``
  to ``list only `accord/tickets/<id>.md`, paths under `accord/tickets/<id>/` and the records `./research.md` counts as its own, propose``.
Keep every other word. The rendered SKILL.md must stay within 5120 bytes (see the rules above; the estimate is about
4990 bytes after these edits).

Write the test first, top level in `packages/core/test/stage-skills.test.ts`:
`ac-4 the intent interview moves the evidence it replaces into a dated record listed under research`. Flatten with
`.replace(/\s+/g, ' ')`. For each render of `skillTargets({ ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] } as AccordConfig)`
and the same with `roles: ['ba', 'dev', 'designer']`, and for each of `.claude/skills` and `.agents/skills`:
- the raw texts of `<dir>/accord-intent/SKILL.md` and `<dir>/accord-intent/research.md` are both non-empty;
- in the flattened SKILL.md, the slice from `2. **Look before asking.**` to `3. **Confirm the parts.**` contains
  ``Before any question, read `./research.md`.``, and the slice from `6. **Write the ticket**` to `7. **Write back**`
  contains ``Before you rewrite a queued Intent, follow `./research.md`.``;
- the flattened research.md contains each of:
  ``At step 2, before any question to the owner, read every record `accord anchor` lists under `## Research`.``;
  ``At step 6, before you rewrite a queued Intent, first move every line of evidence it replaces, verbatim, into a new record under `accord/research/` with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines, and list that record under the ticket's `research:` key.``;
  `Never delete such a line.`; `Commit the record with the ticket at steps 8 and 9.`;
- the raw research.md matches ``/```\n([\s\S]*?)\n```/``; with `block` its first group: `recordHeaderFaults(block)` equals
  `['date', 'commit']` (the angle-bracket fields alone do not pass), and the block with `<YYYY-MM-DD>` replaced by
  `2026-10-30`, `<sha>` by `5c083d3` and `<topic>` by `x` gives `[]`, so a record started as the skill says passes lint.

Behaviour that must not change: every other sentence of the intent SKILL.md; the `REQUIRED.intent` phrases; the
`lane-s.test.ts` phrases of the `**Lane S.**` rule (`fits lane S`, `` `accord status --json` ``, `` `depends_on` ``,
`` `git status --porcelain --untracked-files=all` ``, `only on the owner's yes`, ``## Moving to lane S` in `./ids.md``,
`From step 9 on, a lane never drops`); the `ac-4 a lane M ticket moved to lane S...` needles for the intent SKILL.md;
every `skills.test.ts` case, including the relative-reference, every-reference-named, cap and rule-restating cases.

Run `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`. Then run
`npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/lane-s.test.ts packages/core/test/skills.test.ts`,
then `npm run typecheck` and `npm run lint`.

## Task 5: A listed record the branch adds is the ticket's own file in the lane S proposal and the move to lane S

covers: D-08, D-09
files: packages/core/skills/accord/ids.md, packages/core/skills/accord/lane.md, packages/core/skills/accord/lane-s.md, packages/core/src/generated/skills.ts, .claude/skills/accord/ids.md, .claude/skills/accord-intent/ids.md, .claude/skills/accord-debug/ids.md, .claude/skills/accord-verify/ids.md, .claude/skills/accord/lane.md, .claude/skills/accord-intent/lane.md, .claude/skills/accord/lane-s.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:data-loss-a-listed-research-record-the-branch-adds-counts-as-the-tickets-own-file-in-the-lane-S-checks-and-the-move-to-lane-S-keeps-the-evidence-it-drops

Consumes: `skillTargets(config)`; the intent `research.md` from Task 4 (read only). Produces wording in three
reference files. `ids.md` is rendered into accord, accord-intent, accord-debug and accord-verify, so it names no
`./` file and no `accord <command>` in its `## Moving to lane S` list.

Skill text:
- `packages/core/skills/accord/ids.md`, `## Moving to lane S`:
  - step 2: change ``When it lists a path other than `accord/tickets/<id>.md` and paths under `accord/tickets/<id>/`, do not move:``
    to ``When it lists a path other than `accord/tickets/<id>.md`, paths under `accord/tickets/<id>/` and records under `accord/research/` that the ticket lists under `research:` and origin's default branch does not hold, do not move:``.
    The rest of step 2 stays, including `commit only those records` and `` `git add -A` ``.
  - step 3: insert at its start ``First move every line of evidence in the `## Intent`, `## Acceptance criteria`, `## Open questions` and `## Approach` sections, verbatim, into a new record under `accord/research/`, listed under the ticket's `research:` key, as `research.md` of the intent skill says; skip this when they hold none. Then, in``
    so that the step goes on ``accord/tickets/<id>.md`, replace the `lane:` line with `lane: "S"`, ...`` with every
    following word unchanged (the existing ``In `accord/tickets/<id>.md`,`` becomes ``Then, in `accord/tickets/<id>.md`,``).
  - step 4: change ``Commit the ticket file with `git commit -m "intent: <id> moved to lane S" -- accord/tickets/<id>.md`,``
    to ``Commit the ticket file and any record step 3 made with `git commit -m "intent: <id> moved to lane S" -- accord/tickets/<id>.md` followed by the path of each such record,``.
- `packages/core/skills/accord/lane.md`: at the end of the paragraph that starts `A test file sits under a folder named`,
  add ``A record under `accord/research/` that the ticket lists under `research:` and the branch adds is the ticket's own file: it is not an expected file and needs no `## Scope` line.``
- `packages/core/skills/accord/lane-s.md`, step 2: after `` before the review.`` add
  ``A record under `accord/research/` that the ticket lists under `research:` and this branch adds is the ticket's own file and needs no `## Scope` line.``

Write the test first, top level in `packages/core/test/stage-skills.test.ts`:
`risk:data-loss a listed research record the branch adds counts as the tickets own file in the lane S checks and the move to lane S keeps the evidence it drops`.
Flatten with `.replace(/\s+/g, ' ')`. For each of the two renders of Task 4's test, for each rendered `ids.md` (at
least eight files: accord, accord-intent, accord-debug and accord-verify under each skill directory): take
`at = text.indexOf('\n## Moving to lane S\n')`, assert `at > -1`, and `move` = flattened `text.slice(at)`. Assert
`move` contains:
```
paths under `accord/tickets/<id>/` and records under `accord/research/` that the ticket lists under `research:` and origin's default branch does not hold, do not move
First move every line of evidence in the `## Intent`, `## Acceptance criteria`, `## Open questions` and `## Approach` sections, verbatim, into a new record under `accord/research/`
Commit the ticket file and any record step 3 made
```
and that the index of `First move every line of evidence` is less than the index of ``replace the `lane:` line``.
For each skill directory, assert the flattened `accord/lane.md` and `accord-intent/lane.md` each contain
``is the ticket's own file: it is not an expected file and needs no `## Scope` line``, the flattened `accord/lane-s.md`
contains ``this branch adds is the ticket's own file and needs no `## Scope` line``, and the flattened
`accord-intent/research.md` contains ``that origin's default branch does not hold counts as one of the ticket's own files``
and `A change to a record the default branch already holds does not count.`

Behaviour that must not change: every needle of `ac-4 a lane M ticket moved to lane S at intent is changed in place and no skill drops it or hands it off`
(the `MOVE` list, the order of `before the move to lane S`, `lane: "S"` and `git push -u origin <claim branch>`, and
the absent `accord drop`, `accord new ticket`, `new session`, `new id`, `Title:`, `Keys:`); `lane-s.test.ts`
`ac-5 a queued lane M ticket drops to lane S only at intent on the owners yes`; the exact `LIFT` sentence and the
`minus test files and the copies accord generates` sentence of `lane.md` (`ac-1 a lane is proposed from the scout facts...`,
`ac-1 the accord skill lifts lane S to M only by the four conditions left`); the four rendered `ids.md` copies stay
identical; every other section of the three files.

Run `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`. Then run
`npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/lane-s.test.ts packages/core/test/skills.test.ts`,
then `npm run typecheck` and `npm run lint`.

## Task 6: The lane S scope and the lane M undeclared list leave out a listed record the branch adds

covers: D-08, D-09
files: packages/core/src/gate/research.ts (new), packages/core/src/gate/scope.ts, packages/core/src/gate/work.ts, packages/cli/src/commands/review-package.ts, packages/core/test/scope.test.ts, packages/core/test/undeclared.test.ts
verify: packages/core/test/scope.test.ts#risk:complex-branching-a-listed-research-record-the-branch-adds-is-in-scope-for-lane-S-and-a-changed-unlisted-or-outside-one-is-not, packages/core/test/undeclared.test.ts#risk:complex-branching-undeclared-files-leave-out-a-listed-research-record-the-branch-adds-and-keep-a-changed-one

Consumes: `isResearchPath` (Task 1); `RepoSnapshot.branchFacts` and `BranchChange` (`packages/core/src/model/snapshot.ts`);
`gateDone`, `outsideScope`, `undeclaredFiles`. Produces:
- `packages/core/src/gate/research.ts`, exporting `addedResearch(snapshot: RepoSnapshot, id: string): string[]`: the
  entries of the ticket's `frontmatter.research` (read with `Object.hasOwn` on `snapshot.tickets`) that
  `isResearchPath` accepts and that `snapshot.branchFacts[id].changes` holds with `kind: 'added'`; `[]` when the ticket,
  the fact or its `changes` is missing, or the fact is `{ error }`. It imports neither `scope.ts` nor `work.ts`, so no
  import cycle forms. "Added" is relative to the merge base with the default branch, which is what D-09 asks.
- `packages/core/src/gate/scope.ts`: `isExempt(id, fact, path, own: readonly string[] = [])` returns true when `own`
  includes `path` (after the ticket-file check, before the rest). `outsideScope` passes `addedResearch(s, id)` as `own`.
  `callsOf` keeps calling `isExempt` without `own`, so the interface-sign check is unchanged.
- `packages/core/src/gate/work.ts`: `undeclaredFiles` also leaves out every path in `addedResearch(snapshot, id)`.
- `packages/cli/src/commands/review-package.ts`: move `const f = branchFactFor(ctx, id);` and
  `const s = { ...ctx.snapshot, branchFacts: { [id]: f } };` to just before `let parts: string[];`, and call
  `undeclaredFiles(s, id, changed)` instead of `undeclaredFiles(ctx.snapshot, id, changed)`. The rest uses the same `f`
  and `s` as before.

Write the tests first, each top level:
1. In `packages/core/test/scope.test.ts`:
   `risk:complex-branching a listed research record the branch adds is in scope for lane S and a changed unlisted or outside one is not`.
   `NEW = 'accord/research/2026-10-30-new.md'`, `OLD = 'accord/research/2026-10-29-old.md'`,
   `UNLISTED = 'accord/research/2026-10-30-other.md'`. Build `S1R` as `S1` is built but with the frontmatter lines
   `['ac_hash: "' + H + '"', 'research: ["' + NEW + '", "' + OLD + '", "src/notes.md"]']`. Changes:
   `ch(NEW, 5, 'added')`, `ch(OLD, 2)`, `ch(UNLISTED, 5, 'added')`, `ch('src/notes.md', 3, 'added')`. With
   `s = snap({ 'accord/tickets/S-1.md': S1R }, { 'S-1': fact(changes) })`: `outsideScope(s, 'S-1')` equals
   `{ paths: [OLD, UNLISTED, 'src/notes.md'] }` (import `outsideScope` from `../src/gate/scope.js`), and
   `found(s, 'S-1', 'gate.out-of-scope')` has three findings whose reasons name those three paths. Guard: the same with
   `S1` (no key) gives `paths: [OLD, NEW, UNLISTED, 'src/notes.md']` (code-point order, as `outsideScope` sorts).
2. In `packages/core/test/undeclared.test.ts`:
   `risk:complex-branching undeclared files leave out a listed research record the branch adds and keep a changed one`.
   Files: `CONFIG`, `accord/tickets/T-1.md` = `laneTicket('T-1', { frontmatter: ['research: ["' + NEW + '", "' + OLD + '"]'] })`,
   `accord/tickets/T-1/plan.md` = `PLAN`. Load with `branchFacts: { 'T-1': { base: 'b'.repeat(40), changes: [{ path: NEW, kind: 'added', lines: 5 }, { path: OLD, kind: 'modified', lines: 2 }], synced: [] } }`.
   `undeclaredFiles(s, 'T-1', [NEW, OLD, 'src/export.ts'])` equals `[OLD]`. Guard: loaded without `branchFacts`, it
   equals `[OLD, NEW]` (code-point order).

Behaviour that must not change: `isExempt` for the ticket's records, `synced` paths, `.claude/settings.json` and
`generated:` entries; `sensitiveTouched` and `interfaceSigns`; every existing `scope.test.ts` and `undeclared.test.ts`
case; `review-package` output: the order of its sections, `## Undeclared files` with `(no plan)` or `(none)`, and the
`## Out-of-scope files` and `## Interface signs` sections (`packages/cli/test/lane-commands.test.ts`).

Run `npm run build`, then `npx vitest run packages/core/test/scope.test.ts packages/core/test/undeclared.test.ts packages/cli/test/lane-commands.test.ts packages/cli/test/lane-s.test.ts`,
then `npm run typecheck` and `npm run lint`.

## Task 7: The default branch and claim view reads load the research records their tickets list

covers: D-05
files: packages/cli/src/load/fs.ts, packages/cli/test/drop.test.ts, packages/cli/test/status.test.ts
verify: packages/cli/test/drop.test.ts#risk:data-loss-drop-lints-the-default-branch-with-the-research-records-its-tickets-list, packages/cli/test/status.test.ts#risk:complex-branching-the-claim-view-reads-a-research-record-only-the-claim-branch-holds-and-keeps-the-checkout-copy-of-a-shared-one

Without this, `accord drop` and `accord upgrade` lint the default branch with no record text and refuse on every
reference, and `status`, `next`, `dashboard` and `show` on the default branch report a false error for an in-flight
ticket whose record exists only on its claim branch (ledger Rulings).

Consumes: `isResearchPath` and `loadSnapshot` from `@accord-dev/accord-core`; `gitFilesAt(root, ref, paths)` in the
same file (one `git cat-file --batch`, `GIT_NO_LAZY_FETCH`, a missing path left out). Produces:
- `loadRefInput(root, ref)`: after `files = gitFilesAt(root, ref, kept)`, collect the `research` entries of every ticket
  in `loadSnapshot({ files, tree: kept }).tickets`, unique, filtered by `isResearchPath`, in code-point order; read them
  with one `gitFilesAt(root, ref, listed)`; return `files` with those texts added and `tree` = `kept` plus the paths
  that were read. No call when nothing is listed.
- `loadClaimView(root)`: after the loop that overlays each candidate's records into `files`, for each candidate
  `[id, ref]` whose ticket text was read from the ref, take the `research` entries of
  `loadSnapshot({ files: { [recordPaths(id)[0]]: text }, tree: [] }).tickets[id]?.frontmatter`, keep those that
  `isResearchPath` accepts and that are own keys neither of `checkout.files` nor of `files`, and add
  `gitFilesAt(root, ref, thosePaths)` into `files`. A record the checkout holds is never replaced (ledger Ruling: a
  shared record is listed by several tickets).

Write the tests first, each top level:
1. In `packages/cli/test/drop.test.ts`: `risk:data-loss drop lints the default branch with the research records its tickets list`.
   `OLD = 'accord/research/2026-10-29-old.md'`. `c = copy(plain)`, `o = c.otherClone()`; write into `o`
   `{ [OLD]: REC('old'), 'accord/tickets/ST-11.md': laneTicket('ST-11', { frontmatter: ['research: ["' + OLD + '"]'] }) }`,
   `commitMsg(o, 'ST-11')`, `gitRun(o, 'push', '-q')`, then `c.git('pull', '-q')`. Run
   `['drop', 'ST-9', '--reason', 'gone']` in `c.root`: exit 0 (`expect(r.code, r.err).toBe(0)`) and
   `remoteDrop(c, 'ST-9')` is defined. Before this task the drop is refused with `lint.research-reference` on ST-11.
2. In `packages/cli/test/status.test.ts`:
   `risk:complex-branching the claim view reads a research record only the claim branch holds and keeps the checkout copy of a shared one`.
   `NEW = 'accord/research/2026-10-30-new.md'`, `OLD = 'accord/research/2026-10-29-old.md'`. Following the case
   `ac-2 the claim branch copy wins over an older checkout copy`: `repo = makeLaneRepo({ 'accord/tickets/T-2.md': laneTicket('T-2', { frontmatter: ['research: ["' + NEW + '", "' + OLD + '"]'] }), [OLD]: REC('old') })`;
   `commitAll(repo)`; note the base branch; `checkout -q -b t/T-2`; write `{ [NEW]: REC('new'), [OLD]: '# old\n\nno header here\n' }`;
   `tip = commitAll(repo, 'research')`; `update-ref refs/remotes/origin/t/T-2 <tip>`; check out the base branch; delete
   the local `t/T-2`. Assert `existsSync(join(repo, NEW))` is false; the `status --json` row for `T-2` has
   `errors: 0` (NEW comes from the claim ref; OLD stays the checkout's dated copy, not the ref's undated one). Guard:
   `run(['lint'], repo)` (checkout only) exits 1 and its output contains `lint.research-reference` and NEW.

Behaviour that must not change: `loadRefInput` returns exactly what it returned before for a ref whose tickets list no
research; the claim view's overlay of the five ticket records, its `planFacts` and `afterVerify` handling, and its
single `cat-file` spawn when no candidate lists a missing record; `loadFromFs`; every existing case in
`drop.test.ts`, `status.test.ts`, `upgrade.test.ts`, `dashboard.test.ts` and `show.test.ts`.

Run `npm run build`, then `npx vitest run packages/cli/test/drop.test.ts packages/cli/test/status.test.ts packages/cli/test/upgrade.test.ts packages/cli/test/load.test.ts`,
then `npm run typecheck` and `npm run lint`.

## Task 8: accord drop carries a listed record the default branch lacks and refuses a different one

covers: D-06
files: packages/cli/src/commands/drop.ts, packages/cli/test/drop.test.ts
verify: packages/cli/test/drop.test.ts#risk:data-loss-drop-carries-a-listed-research-record-the-default-branch-lacks-and-leaves-an-identical-one, packages/cli/test/drop.test.ts#risk:data-loss-drop-refuses-a-listed-research-record-that-differs-from-the-default-branch-copy

`accord worktree clean` deletes the claim branch once the drop is merged, so a record that exists only there would be
lost, against D-06 (ledger Rulings). `drop.ts` is a data-deletion path.

Consumes: `isResearchPath`, `loadSnapshot` from `@accord-dev/accord-core`; `gitFilesAt` from `../load/fs.js`; the
file's own `resolve(root, ref)` (`git rev-parse --verify -q`, which also resolves `<commit>:<path>` to a blob id),
`tip`, `base`, `b`, `short`, `path`, `next`, `NOTHING`. Produces, in `drop`, between the `next === undefined` check and
`const input = loadRefInput(root, ref);`:
- `listed` = the unique `research` entries of `loadSnapshot({ files: { [path]: next }, tree: [] }).tickets[id]?.frontmatter`
  that `isResearchPath` accepts.
- For each `p`: `atBase = resolve(root, base + ':' + p)`, `atTip = resolve(root, tip + ':' + p)`.
  - `atBase` undefined and `atTip` defined: carried, with blob `atTip`.
  - `atBase` defined and `atTip` defined and different: throw
    ``new UsageError(`${p} on ${b} differs from the copy on ${short}; a drop never replaces a research record the default branch holds - make the two equal on ${b}, or list a new record instead, then run accord drop again` + NOTHING)``.
  - `atBase` defined otherwise: kept from the base.
  - both undefined: nothing; lint then refuses on the missing record.
- After `input.files[path] = next` and the tree push: add `gitFilesAt(root, tip, carriedPaths)` and
  `gitFilesAt(root, ref, keptPaths not already in input.files)` into `input.files`, and push each added path onto
  `input.tree` when absent, so lint reads every listed record as the drop branch will hold it.
- After the ticket's `update-index`, for each carried record run
  `gitIn(root, ['update-index', '--add', '--cacheinfo', '100644,' + blob + ',' + p], { env })`.
- Update the file's header comment: the drop branch holds the ticket file and the research records it lists that the
  default branch lacks; the claim branch's code never travels.

Write the tests first, top level in `packages/cli/test/drop.test.ts`, each with timeout `120_000`. `NEW` and `OLD` as
in Task 7. Seed both: `c = copy(plain)`, `o = c.otherClone()`, write `{ [OLD]: REC('old') }` into `o`,
`commitMsg(o, 'old')`, `gitRun(o, 'push', '-q')`, `c.git('pull', '-q')`, then `c.git('switch', '-q', '-c', 't/ST-10')`.
1. `risk:data-loss drop carries a listed research record the default branch lacks and leaves an identical one`. On the
   branch write `{ [NEW]: REC('new'), 'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + NEW + '", "' + OLD + '"]'] }) }`,
   `commitMsg(c.root, 'claim: ST-10')`, `c.git('push', '-q', '-u', 'origin', 't/ST-10')`. Run
   `['drop', 'ST-10', '--reason', 'x']`: exit 0; with `D = remoteDrop(c, 'ST-10')!`,
   `gitRun(c.remote, 'diff', '--name-only', 'main', D)` is `NEW + '\naccord/tickets/ST-10.md\n'`;
   `gitRun(c.remote, 'cat-file', 'blob', D + ':' + NEW)` is `REC('new')`, and the same for `OLD` is `REC('old')`.
2. `risk:data-loss drop refuses a listed research record that differs from the default branch copy`. On the branch
   write `{ [OLD]: REC('old edited'), 'accord/tickets/ST-10.md': laneTicket('ST-10', { frontmatter: ['research: ["' + OLD + '"]'] }) }`,
   commit and push as above. Run the same drop: exit 2; `r.err` contains `OLD + ' on t/ST-10 differs from the copy on main'`
   and `nothing was created`; `remoteDrop(c, 'ST-10')` is undefined.

Behaviour that must not change: a ticket listing no research drops exactly as before: one changed path, the same
commit message, the same three output lines (`ac-1 dropping a ticket pushes a branch from the default branch whose only change is the ticket file set to dropped`);
every refusal and its message; the CRLF and BOM bytes of the ticket file; the order of checks before the lint; the
push and its failure message; no checkout, no change to the working tree.

Run `npm run build`, then `npx vitest run packages/cli/test/drop.test.ts`, then `npm run typecheck` and `npm run lint`.

## Task 9: The drop steps and the workflow spec name the research records

covers: D-03, D-04, D-10
files: packages/core/skills/accord/ids.md, packages/core/src/generated/skills.ts, .claude/skills/accord/ids.md, .claude/skills/accord-intent/ids.md, .claude/skills/accord-debug/ids.md, .claude/skills/accord-verify/ids.md, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:data-loss-the-drop-steps-say-the-drop-branch-carries-the-research-records-the-default-branch-lacks

D-04 and D-10: no draft ticket is changed on this branch; the main session lands the move of the seven drafts to the
key as an accord-only backlog pull request after the release that ships the key. This task changes no file under
`accord/`.

Consumes: `skillTargets(config)`. Produces wording only.
- `packages/core/skills/accord/ids.md`, `## Dropping instead of renaming`, step 1: change
  `made from the default branch that holds only the ticket file, set to dropped with that reason, and prints`
  to ``made from the default branch that holds the ticket file, set to dropped with that reason, and each record the ticket lists under `research:` that the default branch lacks, and prints``.
- `docs/specs/2026-10-12-workflow-layer-design.md`:
  - §4 `### Ticket format`, the sentence that starts `Frontmatter keeps the 0.1.0 schema`: add the optional
    `research` key, a list of repository paths of research records under `accord/research/`.
  - §4, after the paragraph that ends ``into `tickets/<id>/plan.md`.``, a paragraph `**Research records.**`: a record is
    `accord/research/<date>-<topic>.md` with `Date: <YYYY-MM-DD>` and `Repository at <sha>` in its first five lines;
    lint fails a ticket whose reference is outside `accord/research/`, names no file, or names a record without those
    lines; a record is evidence, never a contract; the scout, architect, critic and planner read the listed records and
    the executor, reviewers and verifier are not told to; the intent interview moves the evidence a rewrite replaces
    into a new listed record; a listed record the branch adds counts as the ticket's own file in the lane S checks and
    the undeclared files.
  - §3 `**Lifecycle.**`, *Dropped*: `accord drop` carries each listed record the default branch lacks and refuses a
    listed record that differs from the default branch's copy.
  - §5 *Claim*: after ``read its ticket, plan, ledger, review and verification from that branch``, add `and each
    research record the ticket lists that the checkout lacks`.
  - §6, the `accord anchor [<id>]` bullet: ``then, verbatim, its Intent, Vetoes, Decisions, Corrections, the research records its `research:` key lists, and Rulings``.
  - §10 **Input.**: the undeclared files leave out the ticket's own records, a listed research record the branch adds
    among them.

Write the test first, top level in `packages/core/test/stage-skills.test.ts`:
`risk:data-loss the drop steps say the drop branch carries the research records the default branch lacks`. For each
rendered `ids.md` of `skillTargets(config)` (accord, accord-intent, accord-debug, accord-verify), flattened, the slice
from `## Dropping instead of renaming` to `2. Create the new ticket` contains
``holds the ticket file, set to dropped with that reason, and each record the ticket lists under `research:` that the default branch lacks``
and does not contain `holds only the ticket file`.

Behaviour that must not change: every needle of `ac-5 the ids reference drops a ticket with accord drop`; the four
rendered `ids.md` copies stay identical; Task 5's `## Moving to lane S` text; every other section of the spec.

Run `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`. Then run
`npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/core/test/lane-s.test.ts`,
then `npm run typecheck` and `npm run lint`. Then run `tests.full`, `npx vitest run`.

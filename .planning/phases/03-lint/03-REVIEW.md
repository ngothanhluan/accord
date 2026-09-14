---
phase: 03-lint
reviewed: 2026-09-14T05:49:39Z
depth: standard
files_reviewed: 17
files_reviewed_list:
  - packages/cli/src/load/fs.ts
  - packages/core/schemas/config.schema.json
  - packages/core/src/generated/templates.ts
  - packages/core/src/index.ts
  - packages/core/src/lint/ears.ts
  - packages/core/src/lint/gherkin.ts
  - packages/core/src/lint/index.ts
  - packages/core/src/lint/render.ts
  - packages/core/src/lint/rules.ts
  - packages/core/src/lint/ticket.ts
  - packages/core/src/lint/tokens.ts
  - packages/core/src/load/gherkin.ts
  - packages/core/src/load/junit.ts
  - packages/core/src/load/sections.ts
  - packages/core/src/load/snapshot.ts
  - packages/core/src/model/finding.ts
  - packages/core/src/model/snapshot.ts
findings:
  critical: 2
  warning: 7
  info: 8
  total: 17
status: issues_found
---

# Phase 3: Code Review Report

**Reviewed:** 2026-09-14T05:49:39Z
**Depth:** standard
**Files Reviewed:** 17 source files (plus 11 test files, 2 templates, and sampled goldens and fixtures)
**Status:** issues_found

## Summary

`npm run lint`, `npm run typecheck`, and `vitest run` (388 tests) all pass on the working tree. Every finding below was reproduced by running the source through a throwaway vitest probe in the scratchpad; nothing here is speculative.

Invariants checked and holding: no `node:` import outside `load/` in core; no `lint.*` level literal outside `lint/rules.ts`; sort is code-point compare; token rule rows are all `warning`; every finding path is forward-slash; CLI `containedPath` rejects `..` and absolute paths on both OSes; templates and schema name no other tool.

Two blockers, both in `load/junit.ts` and its consumer: the test map is a prototype-bearing object, so cases named `constructor`/`toString` vanish from the report and `@test:constructor` is never reported as unknown; and a malformed numeric entity in the report throws out of `loadSnapshot` instead of producing a finding. Seven warnings cover a CLI/core path-key mismatch that silently disables the token rule, false negatives in the CSS value splitter after a nested `var()`, a newline in a `reason` that breaks the D-60 one-line text contract, false positives on multi-line plan steps and on fenced code under `## Plan`, Markdown emphasis defeating the EARS tokeniser, and a valid empty `Examples:` block reported as an error.

## Critical Issues

### CR-01: JUnit test map is a plain object, so `Object.prototype` keys are dropped and `@test:` lookups against them lie

**File:** `packages/core/src/load/junit.ts:26`, `packages/core/src/load/junit.ts:41`, `packages/core/src/lint/gherkin.ts:85`
**Issue:** `scanJUnit` accumulates into `const out: Record<string, TestStatus> = {}` and guards with `!(id in out) || RANK[status] > RANK[out[id]]`. When `classname` is absent or empty (permitted by A2 and pinned by the "absent or empty classname" test), the id is the bare name. A `<testcase name="constructor"/>` then hits `'constructor' in out === true` and `RANK[Object] === undefined`, so `2 > undefined` is false and the case is never recorded. Reproduced: `<testcase name="constructor"/><testcase name="toString"><failure/></testcase>` returns `{}`. The same `in` test in `testIdUnknown` means a scenario tagged `@test:constructor` (or `@test:hasOwnProperty`, `@test:valueOf`) is never reported as unknown even when no such case exists. Reproduced: `@test:constructor` against a report containing only `a#b` yields no `lint.test-id-unknown`. Phase 4 GATE-08 will read the same map, so a failed `toString` test can never block Done. `describe('constructor')`-style names are common in JS suites; reporters that omit `classname` exist.
**Fix:**
```ts
// junit.ts
const out: Record<string, TestStatus> = Object.create(null);
...
if (!Object.hasOwn(out, id) || RANK[status] > RANK[out[id]]) out[id] = status;

// gherkin.ts testIdUnknown
.filter((id) => !Object.hasOwn(tests, id))
```
Pin with a test: a case named `constructor` with no classname round-trips as `{ constructor: 'passed' }`, and `@test:constructor` with no such case is `lint.test-id-unknown`. Note `Object.create(null)` still serialises as `{}` in the golden; if the snapshot must stay a literal object, keep `{}` and use `Object.hasOwn` in both places (the `__proto__` name is then the only remaining hole, and it is not a plausible test name).

### CR-02: A malformed numeric character reference in the report crashes `loadSnapshot`

**File:** `packages/core/src/load/junit.ts:10`
**Issue:** `unescapeXml` calls `String.fromCodePoint(parseInt(...))` on any `&#...;` / `&#x...;` it matches. A value above `0x10FFFF` throws `RangeError: Invalid code point 1114112`. Reproduced: `<testcase name="a &#x110000; b"/>` makes `scanJUnit`, and therefore `loadSnapshot`, throw. The report is repo content read by the CLI on every `lint`; a garbage or hand-edited report should yield `load.report-invalid`, not a stack trace (D-72 "core never guesses", and the loader's contract is findings, never exceptions). A surrogate code point (`&#xD800;`) does not throw but produces a lone surrogate in the id, which `JSON.stringify` escapes and which then never matches a `@test:` tag; harmless but worth the same guard.
**Fix:**
```ts
const unescapeXml = (s: string) =>
  s.replace(/&(#x[0-9a-fA-F]+|#\d+|lt|gt|amp|quot|apos);/g, (m, e: string) => {
    if (e[0] !== '#') return ENT[e];
    const cp = e[1] === 'x' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return cp > 0x10ffff || (cp >= 0xd800 && cp <= 0xdfff) ? m : String.fromCodePoint(cp);
  });
```
Add one test: `&#x110000;` leaves the literal in the id and does not throw.

## Warnings

### WR-01: CLI stores the tokens/report file under a resolved key but core looks it up under the raw configured string

**File:** `packages/cli/src/load/fs.ts:56-59`, `packages/cli/src/load/fs.ts:70`, `packages/core/src/load/snapshot.ts:84`, `packages/core/src/load/snapshot.ts:89`
**Issue:** `containedPath` returns `relative(root, resolve(root, rel))`, which collapses `..`, `.` and doubled separators. Core's `normaliseKey` only swaps backslashes and strips a leading `./`. For `design.tokens: src/../src/styles/tokens.css` the CLI stores the text under `src/styles/tokens.css` while core looks for `src/../src/styles/tokens.css`, does not find it, emits `lint.tokens-missing`, and skips the token rule entirely for every prototype. Reproduced (P4/P13): the same snapshot with the file present under the resolved key reports only `lint.tokens-missing` and no `lint.token-hardcoded` for a `color:#000` prototype. The same applies to `tests.report` (report silently absent, `lint.report-missing`, `snapshot.tests` undefined, so GATE-08 later has nothing to join). No test pins a path with `..` or `//`.
**Fix:** Store under the key core will compute, not the resolved one:
```ts
// fs.ts containedPath: return the normalised input, not `back`
return rel; // after the backslash and ./ replace; containment already proven via `back`
...
if (key !== undefined) files[key] = readFileSync(resolve(root, key), 'utf8');
```
Or make core resolve too (`path.posix.normalize` is not available in core by the purity rule, so the CLI-side fix is the smaller diff). Pin with a `load.test.ts` case using `src/../src/styles/tokens.css`.

### WR-02: A nested `var()` fallback corrupts the value splitter, hiding later literals

**File:** `packages/core/src/lint/tokens.ts:73`, `packages/core/src/lint/tokens.ts:79-92`
**Issue:** The `var()` stripper uses `(?:,[^)]*)?\)`, so `var(--a, var(--b))` consumes up to the first `)` and leaves a stray `)` in `stripped`. The paren-depth splitter then goes to `-1` and never returns to `0`, gluing every remaining token into one part that matches neither `isColor` nor `isLength`. Reproduced: `color: var(--a, var(--b)) #000` and `box-shadow: 0 0 0 1px var(--a, rgb(0 0 0)), #000` both return `[]` with `#000` unreported. Tailwind v4 emits `var(--x, var(--y))` fallbacks and `rgb()`/`oklch()` fallbacks routinely, so a designer's prototype copied from compiled CSS passes the token rule on exactly the declarations that carry the hard-coded value. The rule is warning-only, so this is a false negative, not a crash, but the fixture pins only single-level `var(--x, #fff)`.
**Fix:** Strip `var()` with a small depth-aware scanner instead of a regex, or at minimum clamp depth and split when it returns to zero:
```ts
// replace the regex strip with a loop that finds `var(`, walks to its matching `)` counting depth,
// records the name from the first `--[A-Za-z0-9_-]+`, and blanks the whole call.
```
Add `var(--a, var(--b)) #000` and the box-shadow case to `tokens.test.ts`.

### WR-03: A `reason` can contain a newline (or control characters), breaking the D-60 one-line text contract

**File:** `packages/core/src/lint/ticket.ts:80`, `packages/core/src/lint/render.ts:6`
**Issue:** `assumptionUnconfirmed` interpolates `a.text` verbatim. The ticket schema does not constrain `text`, so a YAML block scalar (`text: |`) carries newlines into the reason. Reproduced: `renderText` emits `... assumption "line one\nline two\n" is not confirmed` across three lines, so the D-60 problem-matcher shape (`file:line: level rule reason`, one per line) and the `LINE` regex used by the tests no longer parse the output. The same path lets ANSI escape bytes in ticket text reach CI logs unfiltered in Phase 5. Only fixtures with single-line assumptions are pinned.
**Fix:** Collapse whitespace where the reason is built (keeps JSON and text identical, which CORE-05 requires):
```ts
reason: `assumption "${a.text.replace(/\s+/g, ' ').trim()}" is not confirmed`,
```
Audit the other interpolations (`s.name`, `m[0]`, `tag`, `report`): scenario names and tags cannot contain newlines by Gherkin grammar; `report` and `tokens` are single-line YAML scalars in practice but the same collapse is cheap. Add a test with a block-scalar assumption asserting `renderText` stays one line per finding.

### WR-04: Plan-step tags on a continuation line are ignored, so a wrapped step is reported twice as wrong

**File:** `packages/core/src/lint/ticket.ts:148`, `packages/core/src/lint/ticket.ts:160`, `packages/core/src/lint/ticket.ts:177`
**Issue:** `planItems` keeps only lines matching `LIST_MARKER`; D-74 says a step's tags are "every `@ac-n` anywhere in the item", and a Markdown list item includes its indented continuation lines. Reproduced: `- Build the form\n  and wire it @ac-1` yields `lint.plan-step-untagged` on the marker line and `lint.plan-tags-differ` ("plan lacks @ac-1") at the heading, for a plan that is correct. Developers wrap long steps; the 03-02 plan chose "nested items count" but never decided continuation lines, and no test pins either behaviour.
**Fix:** Fold continuation lines into the preceding item before matching:
```ts
const items: Line[] = [];
for (const l of stripHtmlComments(s.lines)) {
  if (LIST_MARKER.test(l.text)) items.push({ ...l });
  else if (items.length && /^\s+\S/.test(l.text)) items[items.length - 1].text += ' ' + l.text;
}
```
Pin with a fixture step that wraps.

### WR-05: List-looking lines inside a fenced block under `## Plan` count as steps

**File:** `packages/core/src/lint/ticket.ts:148`
**Issue:** `planItems` filters `s.lines`, which include fence content (the section scanner keeps fences inside the section). Reproduced: a `ts` fence under `## Plan` containing `- not a step` and `1. nor this` produces two `lint.plan-step-untagged` warnings at the fenced lines. `requirementLines` already excludes fences for the same reason (D-41); the plan rule does not. A developer pasting a snippet or a command list into the plan gets spurious warnings and, through `planTagsDiffer`, none.
**Fix:** Exclude fenced lines the way `requirementLines` does. `Ticket` does not carry `fences`, so either store `fences` on `Ticket` in `parseTicket` (one field) or skip lines between fence markers inside `planItems` with the same `FENCE_OPEN`/close test as `scan`. Pin with a fenced block in the `lint-hygiene` fixture.

### WR-06: Markdown emphasis or a colon after `shall` makes the EARS tokeniser miss the subject and produce a misleading diagnosis

**File:** `packages/core/src/lint/ears.ts:16`
**Issue:** `tokens()` strips only `,;.` at word ends. Reproduced: `the system **SHALL** save the data` returns "has WHEN but no 'the system shall'"; `**WHEN** the user ...` returns "starts with prose and no keyword"; `the system shall: save and notify` returns "has WHEN but no 'the system shall'". Bolding `SHALL` is the most common EARS house style in requirement documents, and the diagnosis (D-64 promises "which part is missing") is wrong in all three cases: the subject is present. Nothing in D-61 to D-64 or the tests decides emphasis handling.
**Fix:** Strip emphasis markers and trailing colons in `tokens()`:
```ts
const tokens = (line: string) =>
  line.replace(/[*_`]+/g, '').replace(/[,;.:]+(\s|$)/g, ' ').replace(/\s+/g, ' ').trim().split(' ');
```
Add the three lines above to `ears.test.ts`.

### WR-07: A valid `Scenario Outline` with an empty `Examples:` is reported as an error

**File:** `packages/core/src/lint/gherkin.ts:48`, `packages/core/src/load/gherkin.ts:34-37`
**Issue:** `scenarioRef` appends `collapse(['Examples:', ...rows])` for every examples block, so a block with no table becomes the pseudo-step `"Examples:"`. `stepEmpty` then tests `/\s/` and emits `lint.step-empty` (error) with the text `step 2 "Examples:" has no text`. Reproduced (Q2). Gherkin accepts an `Examples:` block without a table (BA leaves the table for later); lint turns a draft into a hard error with a message that names a step that does not exist. The `gherkin-shapes` fixture covers outlines only with rows.
**Fix:** Either skip the pseudo-step in `stepEmpty` (`step.startsWith('Examples:')`), or do not push an `Examples:` entry when there are no rows in `scenarioRef`. The second is the smaller diff and keeps the AC hash stable for outlines with rows. Pin with an empty-examples outline.

## Info

### IN-01: `Object.prototype` key check is also used for `snapshot.files` lookups

**File:** `packages/core/src/lint/gherkin.ts:93`, `packages/core/src/lint/tokens.ts:189`, `packages/core/src/lint/tokens.ts:203`
**Issue:** `key in snapshot.files` has the same shape as CR-01. A configured path equal to `constructor` or `toString` is not realistic, so this is not a defect, but once `Object.hasOwn` is adopted for CR-01 the same helper should be used here for consistency.
**Fix:** `Object.hasOwn(snapshot.files, key)`.

### IN-02: Single-word `<placeholder>` from the template guidance is not a sentinel

**File:** `packages/core/src/lint/ticket.ts:24`
**Issue:** `PLACEHOLDER` requires a space inside the brackets, so `WHEN <trigger> the system SHALL <response>`, copied verbatim from the Requirements guidance comment, classifies as `event-driven` and raises no sentinel (reproduced, P9b). Research line 783 chose this to spare Scenario Outline `<a>` placeholders, which is sound inside fences, but the same rule runs on the Requirements body where `<a>`-style outline placeholders never appear. Conversely `<a href>`, `<img src>`, `<br clear>` in prose are reported as placeholders (P10). Both are edge cases; documenting the choice in a test would stop it drifting.
**Fix:** Apply the single-word form outside fences only, or accept and pin the current behaviour with two assertions.

### IN-03: The same declaration value reports one finding per repeated literal

**File:** `packages/core/src/lint/tokens.ts:93-100`
**Issue:** `margin: 12px 12px` yields two identical `margin: hard-coded spacing 12px` findings at the same line (P8). Harmless but noisy in the warning count.
**Fix:** De-duplicate `parts` by token before reporting, or de-duplicate `findings` by `(line, reason)` at the end of `scanPrototype`.

### IN-04: `TBD` is reported twice on the same line by two rules

**File:** `packages/core/src/lint/ticket.ts:23`, `packages/core/src/lint/ticket.ts:29`
**Issue:** `TBD` is both a D-73 sentinel and one of the seven vague phrases, so a requirement containing it gets `lint.sentinel` and `lint.vague-wording` (fixture `HYGIENE.md:19`). ROADMAP criterion 7 lists `TBD` explicitly, so this is by the letter; it doubles the warning count for one edit.
**Fix:** Drop `TBD` from `VAGUE` and let the sentinel own it, or leave as is and note it in the rule table comment.

### IN-05: Dead wildcard check in `tokenNames`

**File:** `packages/core/src/lint/tokens.ts:64`
**Issue:** The capture `(--[A-Za-z0-9_-]+)` cannot contain `*`, so `m[1].includes('*')` is always false. `--color-*: initial` is already excluded because the regex does not match it; the `initial` test does the real work.
**Fix:** Remove the `includes('*')` clause.

### IN-06: Without a config, every prototype gets a derivation warning next to `load.config-missing`

**File:** `packages/core/src/lint/tokens.ts:210`
**Issue:** `tokensKey` is undefined both when `design.tokens` is `""` and when there is no config at all, so a missing or schema-invalid `config.yml` adds `lint.prototype-derivation` per prototype (Q3). Fixing the config may make those warnings vanish or turn into token findings, which reads as churn.
**Fix:** `if (snapshot.config === undefined || tokensKey(snapshot) !== undefined) return [];` and the same guard in `tokenHardcoded` is already implied by `key === undefined`.

### IN-07: Raw `>` inside a JUnit attribute truncates the case id

**File:** `packages/core/src/load/junit.ts:27`
**Issue:** XML permits an unescaped `>` in attribute values. `<testcase classname="c" name="a > b"/>` scans as `c#` (P11) because the tag regex stops at the first `>`. Every mainstream reporter (vitest, jest-junit, pytest, surefire, Go) escapes it, so this only affects hand-written or exotic reports. The mis-id then surfaces as `lint.test-id-unknown`, which is at least visible.
**Fix:** Accept as a documented limitation of the line scanner (add to the module comment), or match attributes with a quoted-value-aware regex: `/<testcase\b((?:[^>"']|"[^"]*"|'[^']*')*?)(\/?)>/g`.

### IN-08: `data-[...]` arbitrary variants are split at `=` and never scanned

**File:** `packages/core/src/lint/tokens.ts:142`
**Issue:** The token splitter excludes `=`, so `data-[state=open]:bg-[#fff]` becomes two tokens neither of which matches `CLASS`, and the `#fff` is missed. Tailwind v4 arbitrary variants with `=` are a small minority of class strings; false negative only.
**Fix:** Allow `=` inside a bracketed segment in the splitter, or document the limitation next to Pitfall 10.

---

_Reviewed: 2026-09-14T05:49:39Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

---
phase: 07-scaffolding-and-example-repo
reviewed: 2026-09-19T09:20:00Z
depth: standard
files_reviewed: 20
files_reviewed_list:
  - packages/cli/src/commands/init.ts
  - packages/cli/src/commands/skills.ts
  - packages/cli/src/render/table.ts
  - packages/cli/test/bin.test.ts
  - packages/cli/test/init.test.ts
  - packages/cli/test/skills-sync.test.ts
  - packages/core/src/generated/templates.ts
  - packages/core/src/scaffold/init.ts
  - packages/core/src/scaffold/pointer.ts
  - packages/core/templates/epic.md
  - packages/core/templates/ticket-build.md
  - packages/core/templates/ticket-maintain.md
  - packages/core/test/__golden__/ticket-build.verified-empty.md
  - packages/core/test/convention.test.ts
  - packages/core/test/examples.test.ts
  - packages/core/test/scaffold.test.ts
  - packages/core/test/skills.test.ts
  - packages/core/test/templates.test.ts
  - README.md
  - test/helpers/denied.ts
findings:
  critical: 1
  warning: 6
  info: 4
  total: 11
status: issues_found
---

# Phase 07: Code Review Report (gap-closure re-review)

**Reviewed:** 2026-09-19T09:20:00Z
**Depth:** standard
**Files Reviewed:** 20
**Status:** issues_found

## Summary

The four gap plans (07-12 … 07-15) do what their summaries claim. Each closure was checked against the
code rather than against the plan, and the repository was built and exercised end to end:
`npm run build`, `npm run lint`, `npm run typecheck` and `npx vitest run` — **36 files, 888 tests, all
green** on Node 24.14 / win32.

Verified closed, with the mechanism named:

- **GC-CR-01 (lossy pointer append)** — `init.ts:121` and `:131` are a matched `latin1` pair. The codec
  is byte-exact for *every* input, not only the tested ones: `latin1` decoding maps 0x00-0xFF onto
  U+0000-U+00FF, so the decoded string holds no code unit above U+00FF for the encoder to truncate, and
  `BLOCK`/`POINTER_START`/the separator are pure ASCII so neither `includes()` nor `endsWith()` can be
  fooled by a UTF-8 continuation byte. Both new fixtures (windows-1252 bytes, multi-byte UTF-8) assert
  the prefix with the same codec they were seeded through, so fixture and assertion cannot drift.
- **GAP-2a (published bundle scan)** — `bin.test.ts:41-52` is a real oracle, not a vacuous one: a missing
  bundle fails `existsSync`, a truncated one fails `length > 1000`, and a scan that stopped matching fails
  the probe. The mechanism is live — `packages/cli/dist/cli.js:424` carries the reworded JSDoc verbatim,
  proving tsdown preserves block comments into the published byte. CI runs `npm run build` before
  `npm test` in both jobs, so the stale-bundle ceiling the comment admits to is a local-only ceiling.
- **GAP-2b (one list, one scan)** — `test/helpers/denied.ts` at the repository root, imported downwards by
  five call sites in both test trees. No second copy, no allowlist.
- **GAP-2c / GAP-2c-EXT (tracker example)** — `github-issues` in all three templates, the generated record,
  the golden and `README.md:15`; `convention.test.ts:48` pins the README line.
- **GC-WR-01 (accumulator)** — `writeSkillFiles` takes `out` and pushes inside the loop; the EISDIR case at
  `skills-sync.test.ts:473-485` proves the status survives the throw. The *function* is bound; the *call
  site the finding was about* is not — WR-04 below.
- **GC-WR-02 (refusal test)** — `init.test.ts:296-310` seeds a directory at a path `HAND_WRITTEN`'s roster
  really targets, and `refuses()` now asserts the whole tree unchanged **and** `out === ''`. The pairing
  with the greenfield case at `:339-347`, which asserts the opposite outcome through the same guard, is
  what makes the ordering claim falsifiable — no reorder satisfies both.
- **GC-WR-03 (uncomment instruction)** — `scaffold/init.ts:55-56` names both halves of the edit and spells
  the `"# "` removal; `scaffold.test.ts:108-121` performs the edit and validates the result.
- **GC-WR-04 (A-33 anchor)** — the example side is anchored on `tests:`. The generated side is still
  anchor-plus-fixed-offset, but the content guard at `:151` makes every drift direction fail *loudly* with
  a named message rather than silently comparing two unrelated lines (IN-02).

What the pass did not close is a surface, not a bug in what it changed. GAP-2a's own rationale — "all five
scan call sites read INPUTS to the build and none reads its OUTPUT" — was applied to one output file. Two
shipped surfaces are still machine-unheld, and one of them **already carries a denied name today**:
`README.md:18`. That is CR-01, and it is the same failure shape as gap 2, one directory over.

## Critical Issues

### CR-01: `README.md` carries a denied product name, and no scan covers `README.md`

**File:** `README.md:18`
**Issue:** The line reads:

```
- Role workflows (`ba`, `dev`, `designer`) shipped as skill files for Claude Code, Cursor, Copilot, and Codex; …
```

`'Claude ' + 'Code'` is entry 8 of `DENIED` (`test/helpers/denied.ts:29`). Running the real scan over the
real file returns an offender:

```
readme : ["18: Claude Code"]
```

CLAUDE.md states the constraint with README named **first**: "nothing accord ships names another tool,
plugin, harness, or planning system — not README, design docs, templates, schemas…". None of the five
`deniedNames` call sites reads `README.md` (`bin.test.ts` → the CLI bundle, `templates.test.ts` → the
templates record, `skills.test.ts` → the rendered skills, `scaffold.test.ts` → `initFiles` + the pointer
block, `examples.test.ts` → the examples tree). `convention.test.ts` reads README but only for phrase
presence and retired vocabulary — it has no denied scan.

The carve-out in `denied.ts:15-17` does not cover this. It exempts "the four runtime names it targets" —
the lowercase config keys `claude`, `codex`, `cursor`, `copilot`, which a shipped text needs so it can say
which directory it installs into. `Claude Code` is the *product* name and is on the list precisely because
it is not the config key.

This is gap 2's shape exactly: a denied name on a shipped surface with no scan over it. It was invisible to
this phase for the same reason the bundle breach was — the surface had no oracle.

**Fix:** One of two, and the choice is the owner's — but the current state is self-contradictory either way.

1. **Reword and scan** (consistent with F-2, GAP-2a and GAP-2c, all of which rejected exceptions):

```md
- Role workflows (`ba`, `dev`, `designer`) shipped as skill files for every runtime `config.yml` names
  (`claude`, `codex`, `cursor`, `copilot`); QA verifies on the dev environment and records results in the tracker.
```

   and add README to a scan — the cheapest home is the existing `convention.test.ts`, which already reads it:

```ts
import { deniedNames } from '../../../test/helpers/denied.js';

it('names no other tool, plugin, harness, or planning system (CLAUDE.md)', () => {
  const probe = [{ path: 'probe.md', text: 'first\nbuilt with ' + 'Fig' + 'ma\n' }];
  expect(deniedNames(probe)).toEqual(['probe.md:2: ' + 'Fig' + 'ma']);
  expect(deniedNames([{ path: 'README.md', text: readme }])).toEqual([]);
});
```

2. **Or** rule that product names are permitted in README, in which case `'Claude ' + 'Code'` must come off
   `DENIED` and the carve-out docstring must say so — otherwise the list forbids a byte the repository ships.

Do not take a third route of leaving README unscanned: that is the state that produced this finding.

## Warnings

### WR-01: the denied scan misses any multi-word name that is wrapped, re-spaced, or hyphenated

**File:** `test/helpers/denied.ts:42-44`
**Issue:** The scan is line-by-line (`text.split('\n').forEach`) and the pattern is `\b<name>\b` with the
name's internal space taken literally. For the one multi-word entry, every realistic reflow evades it.
Measured with the real list and the real pattern:

```
plain     : ["1: Claude Code"]
wrapped   : []        // "… for Claude\n// Code users"
two space : []        // "Claude  Code"
hyphen    : []        // "Claude-Code"
```

The `known_open_finding` for `packages/core/src/model/snapshot.ts:40`/`:42` states the residual risk as
"either becomes a published byte the moment someone reflows it into a block comment". A reflow is exactly
what moves a name across a line boundary — so the reflow that creates the breach is also the reflow that
hides it from the scan. The oracle is weakest against the precise mutation the open finding names.

**Fix:** Scan the whole text with a whitespace-tolerant pattern and derive the line number from the offset,
so a wrapped or re-spaced name is still caught. Keep the collect-all-offenders behaviour.

```ts
export function deniedNames(files: readonly { path: string; text: string }[]): string[] {
  const offenders: string[] = [];
  for (const { path, text } of files) {
    for (const name of DENIED) {
      // Any run of whitespace (including a line break and a comment leader) between the words, and an
      // optional hyphen: a reflow must not be able to hide a name the same edit introduced.
      const pattern = name.split(' ').map(escape).join('[\\s\\-]+(?:[*/#]+[\\s]*)?');
      const re = new RegExp('\\b' + pattern + '\\b', 'gi');
      for (const m of text.matchAll(re)) {
        offenders.push(`${path}:${text.slice(0, m.index).split('\n').length}: ${name}`);
      }
    }
  }
  return offenders.sort(cmp);
}
```

Add a case to whichever test owns the helper asserting all four shapes above are caught — that case is what
stops this regressing to a line scan.

### WR-02: the bundle oracle is bound to one filename, not to the set npm publishes

**File:** `packages/cli/test/bin.test.ts:7` and `:51`
**Issue:** `packages/cli/package.json` declares `files: ["dist", "README.md"]` — the whole `dist`
*directory*, not `dist/cli.js`. The scan reads one hard-coded path. Verified with `npm pack --dry-run`, the
tarball is `dist/cli.js` + `package.json` today, so the claim holds as the repository stands; it stops
holding the first time tsdown emits a second file (a split chunk on a dynamic import, a `cli.d.ts`, a
sourcemap), and nothing goes red when it does. The whole point of GAP-2a was that a published byte must be
machine-held rather than held by someone remembering.

**Fix:** Enumerate the directory, so the scan set is the publish set:

```ts
const distDir = fileURLToPath(new URL('../dist/', import.meta.url));
const files = readdirSync(distDir, { recursive: true, withFileTypes: true })
  .filter((d) => d.isFile())
  .map((d) => {
    const abs = join(d.parentPath, d.name);
    return { path: 'packages/cli/dist/' + relative(distDir, abs).split(sep).join('/'), text: readFileSync(abs, 'utf8') };
  });
expect(files.length, 'run npm run build first').toBeGreaterThan(0);
expect(deniedNames(files)).toEqual([]);
```

### WR-03: `packages/core/dist/index.d.ts` is a published, JSDoc-bearing surface that nothing scans

**File:** `packages/core/package.json` `files` / `exports`; no scan call site
**Issue:** `npm pack --dry-run` on core lists `dist/index.d.ts` (52.7 kB) among 13 published files. It
carries 47 JSDoc prose lines — block comments, which is the one comment form tsdown preserves and therefore
the exact form gap 2 travelled through.

GAP-2d ruled core's bundle out of the scan and settled `dist/index.js:1259` as a decided non-breach; that
ruling names `index.js` only, and its reasoning is about one CSS-function match in a regex literal. The
`.d.ts` was not in front of that decision, and it is the more exposed of the two: every `/** … */` above a
public export lands in it verbatim. Confirmed empty today (`core.d.ts: []`), which is what makes this a
gap rather than a breach — and it interlocks with the open `snapshot.ts` finding: that file's DENIED name
sits on line comments inside a public interface, so reflowing it into a `/** */` puts it in `index.d.ts`,
and no test in this repository would see it.

**Fix:** Extend the ruled scan by one file rather than opening core's whole bundle — `index.js` stays out
under GAP-2d, `index.d.ts` comes in because it is the comment surface:

```ts
// packages/core/test/ — or beside the CLI bundle case, either tree may read core's own dist
const dts = fileURLToPath(new URL('../dist/index.d.ts', import.meta.url));
const text = readFileSync(dts, 'utf8');
expect(text.length, 'run npm run build first').toBeGreaterThan(1000);
expect(deniedNames([{ path: 'packages/core/dist/index.d.ts', text }])).toEqual([]);
```

This does not invert the package dependency direction that GAP-2b's rejected alternative did: a core test
reading core's own `dist` keeps `vitest --project core` self-contained.

### WR-04: GC-WR-01's fix is unbound at the call site the finding was about

**File:** `packages/cli/src/commands/init.ts:112`
**Issue:** GC-WR-01 was a finding against `init.ts`, not against `skills.ts`. The fix landed in both — the
parameter in `writeSkillFiles`, and `writeSkillFiles(ctx.root, guarded ?? refusals(), results)` at the call
site — but only the parameter is tested. `skills-sync.test.ts:473-485` calls `writeSkillFiles` directly, so
reverting `init.ts:112` to the old form:

```ts
results.push(...writeSkillFiles(ctx.root, guarded ?? refusals()));
```

type-checks, lints, and leaves all 888 tests green, with the defect fully restored: an
`overwrote local edits` at target 1 is again absent from the report the `catch` prints when target 2 throws.
No `init` case can see it — every refusal `init` can reach happens in the `assertNoLink` pre-pass, so no
end-to-end case reaches the interior of that loop (there is no `chmod` in `init.test.ts`, and a read-only
target is the only realistic interior throw).

**Fix:** Make the old form uncompilable rather than adding a hard-to-reach case. `writeSkillFiles` returns
its `out` only for `skills()`'s convenience; having the two callers both own their array costs one line and
removes the spread form from the language.

```ts
// commands/skills.ts
export function writeSkillFiles(root: string, targets: SkillFile[], out: ReportRow[]): void { … }
…
const results: ReportRow[] = [];
writeSkillFiles(ctx.root, targets, results);
```

`results.push(...writeSkillFiles(...))` then fails `tsc`, which is a stronger guarantee than any test.

### WR-05: the pointer append rewrites the whole file rather than appending its suffix

**File:** `packages/cli/src/commands/init.ts:131`
**Issue:** `pointerText` returns the *whole new contents*, so `writeFileSync(file, text, 'latin1')`
truncates and rewrites `AGENTS.md` / `CLAUDE.md` in full. This is the one `init` write into a file whose
contents belong entirely to a human, and D-130's whole premise is "there is no code path that writes over
an existing file at all" — here there is one, and it re-writes every byte to add ten lines. A process
killed mid-write, a full disk, or a `EPERM` partway leaves a truncated document; on Windows this is not
hypothetical, since a file open in an editor can fail the write after the truncate.

The byte-exactness the fix bought also rests on a codec property rather than on structure. It is correct
today (see Summary), but it is a property a reader must verify rather than one the code exhibits.

**Fix:** `pointerText` already guarantees the input is a byte-exact prefix of the output, so the CLI can
append only the difference — structurally exact, and it never truncates:

```ts
const existing = found === undefined ? undefined : readFileSync(file, 'latin1');
const text = pointerText(existing);
if (text === undefined) { results.push({ status: 'skipped', path }); continue; }
// The prefix guarantee at scaffold/pointer.ts:48 is what makes the slice safe, and appending rather than
// rewriting means an interrupted run can add bytes but can never remove one a human wrote.
if (existing === undefined) writeFileSync(file, text);
else appendFileSync(file, text.slice(existing.length), 'latin1');
```

The existing non-UTF-8 and multi-byte cases in `init.test.ts` cover it unchanged.

### WR-06: both packages declare a `README.md` neither directory holds, so both tarballs publish without one

**File:** `packages/cli/package.json` `files`, `packages/core/package.json` `files`
**Issue:** `find . -name README.md` returns `./README.md` and a test fixture — neither `packages/cli/` nor
`packages/core/` contains one. npm resolves `files` relative to the package directory, so the entry matches
nothing. Confirmed by `npm pack --dry-run`: the CLI tarball is 2 files (`dist/cli.js`, `package.json`) and
core's is 13, with no README in either. Both npm package pages would render blank at publish, which is a
Phase 9 problem created here.

It also makes GAP-2c-EXT's stated premise false — "`README.md` is in both packages' `files:`, so the line
is a shipped byte". It is in both `files:` lists and is shipped by neither. The ruling's *conclusion*
(reword `README.md:15`) is still right, because the README is the repository's public face; only the reason
given for it is wrong. Worth correcting in the ruling record so Phase 9 does not inherit a false fact.

**Fix:** One line per package at publish time, or a committed pointer file. The smallest thing that works:

```json
"scripts": { "build": "tsdown", "prepack": "node -e \"require('fs').copyFileSync('../../README.md','README.md')\"" }
```

and add `packages/*/README.md` to `.gitignore`. Alternatively drop the `README.md` entry from both `files:`
lists so the manifest stops claiming something untrue. Either is fine; the current state is the only one
that is not.

## Info

### IN-01: the README's command list is missing `skills`

**File:** `README.md:19`
**Issue:** "A CLI: `init`, `new`, `lint`, `gate`, `status`." Phase 7 added CLI-08 `accord skills sync`
(`packages/cli/src/commands/skills.ts`), which is the command that puts accord's text into a user's
repository. A reader of the README does not learn it exists.
**Fix:** `A CLI: \`init\`, \`new\`, \`lint\`, \`gate\`, \`status\`, \`skills\`.`

### IN-02: the A-33 assertion's comment overstates what the generated side is anchored to

**File:** `packages/core/test/scaffold.test.ts:140-150`
**Issue:** The comment says "Both sides are located relative to their own key line rather than at a fixed
offset". The example side is (`exLines.slice(exKey - 2, exKey)`); the generated side is
`lines.slice(key - 4, key - 2)`, which is the anchor *plus* a fixed offset that encodes "the instruction is
exactly two lines". This is not the silent failure GC-WR-04 was about — the content guard at `:151` catches
every drift direction I traced (an added instruction line, a removed copied pair) and fails with a named
message — so the oracle is sound. Only the comment claims more than the code does.
**Fix:** Reword to what it is: "the example side is anchored; the generated side is anchored plus the
two-line instruction block, which the content guard below pins." Or search for the pair rather than offset
it: `const at = lines.findIndex((l) => l.includes('Where the test report lands'));`.

### IN-03: `deniedNames` builds a `RegExp` from an unescaped name

**File:** `test/helpers/denied.ts:44`
**Issue:** `new RegExp('\\b' + name + '\\b', 'i')` — every current entry is alphanumeric plus one space, so
this is safe today. An entry containing `.`, `+`, `(` or `-` (a hyphenated product name, which GAP-2d's
rationale explicitly wants the scan to keep catching) would either throw or silently match the wrong thing.
**Fix:** `const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');` and use it. Pairs
naturally with WR-01's rewrite.

### IN-04: two of the five scan call sites have no "the scan still matches" probe

**File:** `packages/core/test/examples.test.ts:88-90`, `packages/core/test/skills.test.ts:289-297`
**Issue:** `bin.test.ts`, `templates.test.ts` and `scaffold.test.ts` each assert the probe
(`deniedNames(probe)` returns the offender) before the assertion that matters; the other two rely only on
an emptiness guard. An emptiness guard catches "nothing was scanned"; it does not catch "the scan stopped
matching". Both remaining sites would then read as a pass.
**Fix:** Two lines at each site, copied from `templates.test.ts:152-153`. Better still, since the probe is
now duplicated at five sites, export it once from the helper — `export const PROBE`/`export function
assertScanWorks()` — and call it. One list, one scan, one probe.

---

## Carried over from the first pass — still open in these files

Neither decided nor closed; they fell outside GAP-SCOPE, which covered the two blockers plus GC-WR-01…04.
Confirmed still true in the code as it stands, listed so they are not mistaken for new findings.

- **WR-03 (first pass) — `skills.ts:152`**: the orphan advisory concatenates a directory name read off disk
  into a copy-pasteable `rm -rf`. `entry.name` is only constrained to start with `accord-`; `$`, `(`, `)`,
  `;` and `&` are legal in directory names on both platforms. A repository holding
  `.claude/skills/accord-x;rm -rf ~` prints a command a reader may paste.
- **WR-04 (first pass) — `scaffold/pointer.ts:35-36`**: the block names both `.claude/skills/accord-*` and
  `.agents/skills/accord-*` unconditionally, while `skillTargets(config)` may have created only one. D-144
  makes the literal deliberate; the residual is that the block names a directory that may not exist.
- **WR-08 (first pass) — `scaffold/pointer.ts:62`**: `existing.endsWith('\n')` is true for a CRLF file, so a
  CRLF `AGENTS.md` gains an LF separator and an LF block. The `latin1` fix is orthogonal — it preserves the
  original CRLF bytes faithfully and still appends LF ones. Mixed endings in a file a human owns.
- **GC-IN-01, GC-IN-02**: ruled out of scope by GAP-SCOPE. Unchanged, correctly.

## Cross-cutting note — `packages/core/src/model/snapshot.ts:40`, `:42`

Not in this review's scope; assessed as asked. My reading of the residual risk is that it is **higher than
"one reflow away"**, for two reasons this review turned up:

1. **The landing surface is real and unwatched.** Reflowing either line into a `/** */` above a public
   interface member puts it in `packages/core/dist/index.d.ts`, which is published (52.7 kB, 47 JSDoc prose
   lines) and scanned by nothing (WR-03). The file's position — trailing comments on fields of an exported
   `interface` — is the single most likely place in the codebase for a tidy-up to convert line comments into
   JSDoc, because that is what an editor's "document this interface" action does.
2. **The scan would probably not catch the reflow anyway.** A reflow wraps. `\bFigma\b` on a single line
   catches `'https://www.figma.com/file/abc'`, but a JSDoc rewrap that lands `Figma` at a line start behind
   ` * ` still matches, while the two-word entry would not (WR-01). The tracker key on `:40` is not in
   `DENIED` at all (GAP-2c kept the exclusion), so nothing would flag it in any form.

Fixing WR-01 and WR-03 converts this from "trusting that nobody reflows" to "the build goes red if anyone
does", which is the standard every other shipped surface in this phase now meets. That is a cheaper
resolution than editing `snapshot.ts`, and it also covers the next comment nobody has written yet — which
is the argument GAP-2a already accepted once.

---

_Reviewed: 2026-09-19T09:20:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

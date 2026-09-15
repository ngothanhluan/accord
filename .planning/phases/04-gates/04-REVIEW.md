---
phase: 04-gates
reviewed: 2026-09-14T00:00:00Z
depth: standard
files_reviewed: 19
files_reviewed_list:
  - packages/core/src/gate/hash.ts
  - packages/core/src/gate/rules.ts
  - packages/core/src/gate/ready.ts
  - packages/core/src/gate/done.ts
  - packages/core/src/gate/refs.ts
  - packages/core/src/gate/index.ts
  - packages/core/src/load/snapshot.ts
  - packages/core/src/model/snapshot.ts
  - packages/core/src/lint/render.ts
  - packages/core/src/index.ts
  - packages/core/src/generated/templates.ts
  - packages/core/schemas/ticket.schema.json
  - packages/cli/src/load/fs.ts
  - packages/core/test/gate.test.ts
  - packages/core/test/hash.test.ts
  - packages/core/test/refs.test.ts
  - packages/core/test/render.test.ts
  - packages/core/test/schemas.test.ts
  - packages/cli/test/load.test.ts
findings:
  critical: 1 # CR-01 fixed 2026-09-14; see its Disposition block
  warning: 7
  info: 5
  total: 13
status: issues_found # blocker resolved; 7 warnings + 5 info remain open
---

# Phase 4: Code Review Report

**Reviewed:** 2026-09-14
**Depth:** standard
**Files Reviewed:** 19
**Status:** issues_found

## Summary

The gate engine is the product, so it was read as an attacker would: for inputs that make it
say `pass` when it must say `fail`, and for inputs that make it say `fail` when nothing changed.
Every finding below was reproduced by executing the built `packages/core/dist/index.js` against
the real fixtures; the reproduction command and its output are quoted in each entry.

Core purity holds (no `node:` import anywhere under `packages/core/src`). Path normalisation
holds (`normaliseKey` is applied on both the store and the lookup side; `resolves` rejects
traversal and absolute paths; no `path.join` reaches a `Finding`). Determinism holds for sort
order and comparison (`cmp` is code-point, never `localeCompare`) — **except for Unicode
normalisation form, which is applied nowhere and breaks the gate in both directions (WR-01).**
Hash masking, zero-padding and the `TextEncoder` byte path in `hash.ts` are correct.

One hole makes `gate done` unusable as written: **an unknown ticket id passes Done** (CR-01).

## Critical Issues

### CR-01: `gateDone` returns `verdict: "pass"` for a ticket that does not exist

**File:** `packages/core/src/gate/rules.ts:56-83`, `packages/core/src/gate/index.ts:62-76`
**Issue:** `READY_RULES` carries `gate.ticket-unknown`; `DONE_RULES` does not. Every Done check
guards on `ticketOf(snapshot, id) === undefined` (or on `verificationOf(...)`) and returns `[]`,
and `run()` sets `known = false`, which suppresses the lint pass as well. The result is an empty
finding list, and `verdict` is read off that list alone — so it is `pass`.

Reproduced against the `gate-done` fixture set:

```
DONE unknown -> {"gate":"done","ticket":"NOPE","verdict":"pass","findings":[]}
READY unknown verdict -> fail
```

Concrete failure: a developer (or an agent) runs `accord gate done LOGIN-2` where the ticket is
`LOGIN-1`, or where the ticket file was deleted, or where the id was renamed. The gate reports
`pass` with zero reasons and Phase 5 will exit 0. This is the exact bypass GATE-06 exists to
forbid: deleting one file, or mistyping one argument, turns the whole Done gate off silently.
Nothing in `gate.test.ts` drives `gateDone` with an unknown id — the only unknown-id test
(`gate.test.ts:175`) calls `gateReady` — and no plan or SUMMARY in `.planning/phases/04-gates/`
records this as a deliberate asymmetry.

**Fix:** add the row to `DONE_RULES` in `packages/core/src/gate/rules.ts`, beside the Ready row:

```ts
export const DONE_RULES: readonly GateRule[] = [
  { id: 'gate.ticket-unknown', level: 'error', profiles: ['build', 'maintain'], check: ticketUnknown },
  { id: 'gate.no-scenarios', level: 'error', profiles: ['build', 'maintain'], check: noScenarios },
  // ...
];
```

`ticketUnknown` is already imported into `rules.ts` from `./ready.js` and is gate-agnostic, so
this is a one-line change. Add the mirror of the `gate.test.ts:175` assertion for `gateDone`, and
an invariant test that every future gate table contains `gate.ticket-unknown`:

```ts
for (const table of [READY_RULES, DONE_RULES]) {
  expect(table.some((r) => r.id === 'gate.ticket-unknown')).toBe(true);
}
```

**Disposition: FIXED** (2026-09-14, by the execute-phase orchestrator, at the owner's explicit
direction after this finding was recorded).

- `packages/core/src/gate/rules.ts` — the row is now a single `TICKET_UNKNOWN` const referenced by
  both `READY_RULES` and `DONE_RULES`, rather than a second literal copied into the Done table.
- `packages/core/src/gate/index.ts` — the `run()` comment asserting the row lives "on the Ready
  table" is corrected; it was the comment that documented the assumption this bug rested on.
- `packages/core/test/gate.test.ts` — two guards, both of which fail if the row is removed again:
  the behaviour test is now `it.each` over `gateReady` and `gateDone`, and a new test asserts by
  **reference identity** (`toBe`) that a rule both tables carry is one object, so a level or profile
  change can never reach one gate and miss the other (GATE-06).

Verified by executing the rebuilt `packages/core/dist/index.js`:

```
DONE unknown -> {"gate":"done","ticket":"NOPE","verdict":"fail",
                 "findings":[{"file":"accord/tickets/NOPE.md",
                              "reason":"no ticket NOPE in the snapshot",
                              "rule":"gate.ticket-unknown","level":"error"}]}
```

`npm run check` exit 0, 592 tests (was 590). No gate golden moved.

## Warnings

### WR-01: no Unicode normalisation form is applied, so the AC hash is unstable and `gate.note-pasted` is bypassable

**File:** `packages/core/src/gate/hash.ts:35`, `packages/core/src/gate/refs.ts:93-99`
**Issue:** `normaliseText` (D-38) folds the BOM and CRLF but never applies an NFC/NFD form.
`acHash` therefore hashes whatever byte sequence the editor produced, and `normalise()` in
`refs.ts` compares note text to scenario text without one either. The project's fixtures and its
target users are Vietnamese, which is precisely where NFC and NFD diverge on identical-looking text.

Both directions were reproduced on the `gate-done` fixture (`PASS.md` and `NOTES.md` are NFC on
disk; the probe re-encoded them as NFD):

```
acHash NFC: fnv1a64:0e84e174c4cdc76b   NFD: fnv1a64:6c89d507402626b6   equal? false
NFD Done verdict: fail  [ 'gate.ac-changed', 'gate.tick-stale-hash' ]

baseline note-pasted: [ 'note "@ac-2" adds nothing beyond the scenario text and its references' ]
NFD-note  note-pasted: []
```

Failure 1 (false fail): a BA opens `accord/tickets/PASS.md` in an editor or on a platform that
writes NFD, changes nothing visible, saves. Done now reports *"the acceptance criteria changed
since Ready"* and *"the ticks were made against fnv1a64:0e84…"*, and the ticket cannot be closed
until a human re-runs Ready and re-ticks. The reason text is actively misleading — the criteria
did not change.

Failure 2 (false pass): a developer pastes the scenario text back as their verification note and
saves the file in NFD. `gate.note-pasted` — the rule GATE-10 exists for — stops firing. The note
is byte-different but character-identical, so no human reviewer would catch it either.

The existing tests document the property that is safe and skip the one that is not:
`hash.test.ts:63` ("diacritics change the value") compares Vietnamese against stripped ASCII, and
`refs.test.ts:140` ("normalise (D-85 encoding)") compares two NFC literals. Both pass if the NFC/NFD
bug is present.

**Fix:** normalise once, at the loader boundary, so every downstream consumer inherits it:

```ts
// packages/core/src/load/frontmatter.ts
export function normaliseText(text: string): string {
  return (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n').normalize('NFC');
}
```

`normaliseText` is only applied to `snapshot.files` today, so it must also be applied to the
ticket and verification Markdown before `scan`/`extractScenarios` — or, if that moves Phase 1-3
goldens too widely, apply `.normalize('NFC')` in `hashInput` and in `normalise()`. Add the two
missing cases: `acHash([sc('ac-1', ['trả'.normalize('NFD')])]) === acHash([sc('ac-1', ['trả'])])`
and the NFD note in `refs.test.ts`. Note this changes published `ac_hash` values, so it must land
before any real ticket records one.

### WR-02: `gateReady` reports `pass` when `accord/config.yml` is missing or invalid, on a `maintain` repo

**File:** `packages/core/src/gate/index.ts:38-43`, `packages/core/src/gate/index.ts:58`
**Issue:** `scoped()` keeps only findings under `accord/tickets/<id>` and `accord/assets/<id>`, so
every `accord/config.yml` finding — `load.config-missing`, `schema.enum`, `schema.required` — is
dropped from the gate result. `profile` then falls back to `'build'` (line 58). On a `maintain`
repo the prototype requirement disappears with it.

Reproduced on the `gate-maintain` fixture:

```
UILINK maintain ready (good config): fail
UILINK ready with broken config:     pass  [ 'lint.test-tag-missing' ]
UILINK ready, config.yml deleted:    pass  [ 'lint.test-tag-missing' ]
```

`UILINK` is the fixture built to prove that `ui: true` on `maintain` needs a prototype. Deleting
one file turns that rule off and the gate says `pass`.

`04-01-PLAN.md:433` records this as a deliberate deferral ("Phase 5 already loads the snapshot and
can branch on `snapshot.config === undefined` for exit 2"), and `04-01-PLAN.md:67` pins the
scoping rule, so the code matches the plan. The gap is that `gateReady` and `gateDone` are now
exported from `packages/core/src/index.ts:21` as the public API for the MCP host, and neither the
signature, the `GateResult` doc comment, nor a test records that a caller must check
`snapshot.config === undefined` first. An MCP host that calls `gateReady` and trusts `verdict`
ships the wrong answer.

**Fix:** cheapest guard that closes it inside the phase's own contract — document the precondition
on `GateResult` and pin it with a test so Phase 5 cannot forget:

```ts
export interface GateResult {
  // ...
  /** Meaningless when `snapshot.config === undefined`: the profile silently defaults to `build`
   *  and every accord/config.yml finding is out of ticket scope. Callers must branch first. */
  verdict: 'pass' | 'fail';
}
```

```ts
it('a caller that ignores snapshot.config gets a pass on a maintain ticket that must fail', () => {
  const broken = { ...readFixture('gate-maintain'), files: { /* config.yml removed */ } };
  expect(loadSnapshot(broken).config).toBeUndefined();
  expect(gateReady(loadSnapshot(broken), 'UILINK').verdict).toBe('pass'); // Phase 5 owns exit 2
});
```

### WR-03: `loadSnapshot` throws on a config path named after an `Object.prototype` key

**File:** `packages/core/src/load/snapshot.ts:73`, `:85`, `:90`, `:123`
**Issue:** Four membership tests use `in` instead of `Object.hasOwn`, on plain `{}` objects that
carry `Object.prototype`. The gate code added in this phase is scrupulous about this — `done.ts:14`,
`ready.ts:10`, and `refs.ts:38` each carry a comment saying "`Object.hasOwn`, never `in`" — but the
loader that feeds them does the opposite.

Reproduced with `tests.report: "toString"` in the `gate-done` fixture's `config.yml`:

```
THREW TypeError: text.startsWith is not a function
```

`'toString' in files` is true through the prototype chain, so `files[report]` is
`Function.prototype.toString` and `normaliseText` (line 91) is handed a function. The CLI exits
with a stack trace instead of a finding. `design.tokens` (line 85) has the same shape, and
`id in tickets` (line 123) suppresses `load.verification-orphan` for a review folder named
`accord/tickets/toString/`.

**Fix:** four call sites, mechanical:

```ts
if (Object.hasOwn(files, CONFIG)) { /* line 73 */ }
if (tokens !== '' && Object.hasOwn(files, tokens)) { /* line 85 */ }
if (report !== '' && Object.hasOwn(files, report)) { /* line 90 */ }
if (Object.hasOwn(tickets, id)) continue; /* line 123 */
```

### WR-04: the gate throws a `TypeError` on host-supplied `git` facts that omit `authors`

**File:** `packages/core/src/gate/done.ts:325-330`, `packages/core/src/load/snapshot.ts:140`
**Issue:** `SnapshotInput.git` is host-supplied and passed straight through the loader with no
runtime validation — there is no `snapshot-input.schema.json` beside `config`, `ticket`, and
`verification`. `authorsOf` then calls `Object.hasOwn(git.authors, key)` unconditionally.

Reproduced on the `gate-done` fixture:

```
{"commit":"1234567"}                  -> THREW TypeError: Cannot convert undefined or null to object
{"commit":"1234567","authors":null}   -> THREW TypeError: Cannot convert undefined or null to object
"nonsense"                            -> THREW TypeError: Cannot convert undefined or null to object
```

Concrete failure: the MCP server is the stated host, and it receives this object as JSON from a
remote client over which core has no type control. A client that sends `{"commit": "abc1234"}` —
the natural shape for a host that can name the commit but cannot attribute files — crashes the
gate instead of receiving `gate.author-skipped`, which is the rule written for exactly that host.

**Fix:** one defensive read in `authorsOf`, which is the only consumer:

```ts
const authorsOf = (snapshot: RepoSnapshot, id: string): { commitAuthor?: string; fileAuthor?: string } => {
  const git = snapshot.git;
  if (git === undefined || typeof git.commit !== 'string' || git.authors === null || typeof git.authors !== 'object') {
    return {};
  }
  const own = (key: string) => (Object.hasOwn(git.authors, key) ? git.authors[key] : undefined);
  return { commitAuthor: own(git.commit), fileAuthor: own(verificationFile(id)) };
};
```

### WR-05: `gitFacts` loses every non-ASCII ticket path, so GATE-05 silently stops firing

**File:** `packages/cli/src/load/fs.ts:88`
**Issue:** `git log --name-only` quotes paths containing non-ASCII bytes under git's default
`core.quotePath=true`, emitting `"accord/tickets/\304\220\304\202NG-NH\341\272\254P-1/verification.md"`
rather than the raw path. The loop at lines 93-102 stores that quoted string verbatim as the
`authors` key, so `authorsOf` looks up `accord/tickets/ĐĂNG-NHẬP-1/verification.md` and finds
nothing.

Concrete failure: a Vietnamese team names a ticket `ĐĂNG-NHẬP-1` — the ticket schema permits it
only for ASCII ids (`^[A-Za-z0-9][A-Za-z0-9._-]*$`), but the *folder* under `accord/tickets/` is
the file stem and any non-ASCII path anywhere in that subtree is quoted the same way. Every Done
run then emits `gate.author-skipped` ("the host supplied no author for the review file") as a
warning, and `gate.author-match` — the rule that catches a developer reviewing their own work —
never fires again. Because both rules are warnings by D-79, nothing in the verdict changes and the
degradation is invisible.

The same `line.trim()` at line 94 also corrupts any path with leading or trailing whitespace.

**Fix:** disable quoting on the invocation and use `-z` so the record separator is unambiguous:

```ts
log = git(['-c', 'core.quotePath=false', 'log', '--format=%x01%ae', '--name-only', '--', 'accord/tickets']);
```

Add a `load.test.ts` case that commits `accord/tickets/ĐĂNG-NHẬP-1/verification.md` in the sandbox
repo and asserts `facts.authors['accord/tickets/ĐĂNG-NHẬP-1/verification.md']` is defined — the
existing D-78 test (`load.test.ts:217`) only covers the ASCII `LOGIN-1` path.

### WR-06: `execFileSync`'s 1 MiB default `maxBuffer` silently disables GATE-05 and misreports a large repo as "not a git repository"

**File:** `packages/cli/src/load/fs.ts:22-32`, `packages/cli/src/load/fs.ts:72-73`
**Issue:** neither `execFileSync` call sets `maxBuffer`, so Node's 1 MiB default applies and the
child is killed with `ENOBUFS` once its stdout exceeds it.

Concrete failure 1 (new in this phase): `git log --format=%x01%ae --name-only -- accord/tickets`
grows without bound with history. A repository with a few thousand commits touching
`accord/tickets` crosses 1 MiB, the `catch` at line 89-91 swallows it into `log = ''`, and every
Done run afterwards reports `gate.author-skipped` on every ticket while `gate.author-match` never
fires. Both are warnings, so the verdict is unchanged and nobody notices GATE-05 turned itself off.

Concrete failure 2 (pre-existing, same file): `git ls-files --cached --others -z` on a monorepo of
roughly 15-20k paths crosses 1 MiB, and the `catch` at line 27-32 converts `ENOBUFS` into
`UsageError('not a git repository (or git failed): ' + root)`. The CLI refuses to run at all, with
a message that names the wrong cause and gives the user nothing to act on.

**Fix:** set the limit explicitly on both calls and let a genuine overflow surface as itself:

```ts
const EXEC = { encoding: 'utf8' as const, stdio: ['ignore', 'pipe', 'pipe'] as const, maxBuffer: 64 * 1024 * 1024 };
```

and in `gitTree`'s catch, re-raise `ENOBUFS` with its own message rather than folding it into
"not a git repository". For `gitFacts`, `git log` only needs the *latest* author per path, so
`--since` or a `-n` bound would also cap the walk, but the buffer is the correctness fix.

### WR-07: Done binds to `HEAD`, so uncommitted changes to the reviewed code pass

**File:** `packages/cli/src/load/fs.ts:76`
**Issue:** `gitFacts` reads `git show -s --format=%H%x00%ae HEAD` and never inspects the working
tree. `gate.tick-stale-commit` and `gate.stale-review` therefore compare three values that all
describe the last commit, and say nothing about the bytes on disk that the developer is about to
ship.

Concrete failure: the developer ticks `verified: [ac-1]` and writes `verified_commit: <X>`; the
fresh review context writes `commit: <X>` into `verification.md`; both are committed as `X`. The
developer then edits `src/auth/login.ts` and does not commit. `accord gate done` reads `HEAD = X`,
every sha check compares equal, and Done reports `pass` — for code that was never reviewed. This
defeats docs/design.md §5's Fresh-context clause ("the file's `commit:` must equal the commit being
gated") on exactly the path that clause exists to close, because the gated tree is not the gated
commit.

**Fix:** one more bounded `git` call in `gitFacts`, surfaced as a host fact rather than decided in
the CLI, so core keeps ownership of the rule:

```ts
const dirty = git(['status', '--porcelain']).trim() !== '';
return { commit, authors, ...(dirty ? { dirty: true } : {}) };
```

then a `gate.tree-dirty` row in `DONE_RULES` at `error`. If the owner decides a dirty tree is
acceptable at Done, that is a business-logic call and should be recorded as a decision — it is not
recorded anywhere in `.planning/phases/04-gates/` today.

## Info

### IN-01: the determinism-critical comparator has two verbatim copies

**File:** `packages/core/src/gate/index.ts:20-31`, `packages/core/src/lint/index.ts:12-20`
**Issue:** `cmp` and `byFileLineRule` are byte-identical in both modules, and a third copy lives in
`gate.test.ts:103-109` as `order`. `04-01-PLAN.md:249` instructed "copy `cmp` and `byFileLineRule`
from `lint/index.ts` verbatim", so this is as planned — but the sort order is the thing every
golden in the repo depends on, and it now has three homes that can drift independently. The
project's CLAUDE.md mandates deleting over adding.
**Fix:** export `byFileLineRule` from one module and import it in the other two. `gate/index.ts`
already exports it, so `lint/index.ts` importing from `gate/` (or both from a shared
`model/order.ts`) removes two copies.

### IN-02: `docs/design.md` §5 still describes the behaviour D-80 reversed

**File:** `packages/core/src/gate/done.ts:259-272`
**Issue:** §5 reads "A host with no report available reports the check skipped, as the author check
does." `testsUnconfigured` does the opposite — it is an `error` on both profiles, deliberately, per
D-80 and the comment on line 260. A reader who implements an MCP host from design.md will expect a
skip and get a failing gate. `docs/design.md` was touched in this phase, so the drift is fresh.
**Fix:** update the §5 sentence to match D-80, or record the contradiction as an open decision.

### IN-03: `downgradeMaintain` never sees gate findings, contradicting its own comment

**File:** `packages/core/src/gate/rules.ts:96-104`, `packages/core/src/gate/index.ts:66-70`
**Issue:** the doc comment says "the whole profile matrix, applied once in the shared engine body so
every gate inherits it" and "GATE-12 is then a one-cell table edit (D-88)". In `run()`,
`downgradeMaintain` is applied only to the `scoped(lintSnapshot(...))` list; `gated` goes straight
into `findings` untouched. Adding a `gate.*` id to `MAINTAIN_DOWNGRADE` for GATE-12 would do
nothing. The claim is currently harmless because all four entries are `lint.*` ids, and
`gate.test.ts:565` would fail loudly on a `gate.*` entry — so this is a comment defect, not a
behaviour defect.
**Fix:** either apply the downgrade to `[...lint, ...gated]` before the sort, or narrow the comment
to say the matrix covers lint-sourced findings only and that a `gate.*` level change means editing
the table row.

### IN-04: `ac_hash` accepts any non-empty string while `verified_hash` is pattern-checked

**File:** `packages/core/schemas/ticket.schema.json:33-34`
**Issue:** `verified_hash` gained `"pattern": "^fnv1a64:[0-9a-f]{16}$"` in this phase;
`ac_hash` next to it is still `{ "type": "string", "minLength": 1 }`. A hand-typed
`ac_hash: "FNV1A64:0E84E174C4CDC76B"` validates, then never equals a computed hash, and
`gate.ac-changed` reports "the acceptance criteria changed since Ready" on a ticket where nothing
changed — the same misleading-reason class as WR-01, from a cause the schema can reject for free.
**Fix:** give `ac_hash` the same pattern. `schemas.test.ts:237` already tests `ac_hash` and can take
the two extra assertions the `verified_hash` block (line 240) uses.

### IN-05: a wall-clock assertion in the test suite

**File:** `packages/core/test/refs.test.ts:225-237`
**Issue:** `expect(performance.now() - started).toBeLessThan(2000)` on the two-OS x two-Node CI
matrix. The functional assertion above it (`unresolvedRefs(text, big)` equals one entry) is what
proves linear-ish behaviour; the timing line adds a flake source on a loaded `windows-latest`
runner and, per the project's stated v1 scope, performance is not a gate.
**Fix:** drop the timing assertion and keep the functional one, or raise the bound well past any
plausible runner stall.

---

_Reviewed: 2026-09-14_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

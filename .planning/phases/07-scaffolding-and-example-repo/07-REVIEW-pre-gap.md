---
phase: 07-scaffolding-and-example-repo
reviewed: 2026-09-18T00:00:00Z
depth: standard
files_reviewed: 46
files_reviewed_list:
  - .claude/skills/accord-ba/SKILL.md
  - .claude/skills/accord-ba/story.md
  - .claude/skills/accord-dev/SKILL.md
  - .claude/skills/accord-dev/debug.md
  - .github/workflows/ci.yml
  - examples/build/accord/config.yml
  - examples/build/accord/product/business-rules.md
  - examples/build/accord/product/glossary.md
  - examples/build/accord/tickets/SIGNUP-1.md
  - examples/build/accord/tickets/SIGNUP-1/verification.md
  - examples/build/reports/junit.xml
  - examples/build/src/signup.ts
  - examples/build/test/signup.spec.ts
  - examples/maintain/accord/assets/EXPORT-1/prototype.html
  - examples/maintain/accord/config.yml
  - examples/maintain/accord/product/business-rules.md
  - examples/maintain/accord/product/glossary.md
  - examples/maintain/accord/tickets/EXPORT-1.md
  - examples/maintain/accord/tickets/EXPORT-1/verification.md
  - examples/maintain/reports/junit.xml
  - examples/maintain/src/export.ts
  - examples/maintain/src/tokens.css
  - examples/maintain/test/export.spec.ts
  - packages/cli/src/commands/init.ts
  - packages/cli/src/commands/skills.ts
  - packages/cli/src/guard.ts
  - packages/cli/src/run.ts
  - packages/cli/test/helpers/repo.ts
  - packages/cli/test/init.test.ts
  - packages/cli/test/skill-commands.test.ts
  - packages/cli/test/spawn-surface.test.ts
  - packages/cli/test/workflow-script.test.ts
  - packages/core/skills/ba/SKILL.md
  - packages/core/skills/ba/story.md
  - packages/core/skills/dev/SKILL.md
  - packages/core/skills/dev/debug.md
  - packages/core/src/generated/skills.ts
  - packages/core/src/index.ts
  - packages/core/src/scaffold/init.ts
  - packages/core/src/scaffold/pointer.ts
  - packages/core/src/scaffold/workflow.ts
  - packages/core/test/examples.test.ts
  - packages/core/test/helpers/denied.ts
  - packages/core/test/helpers/fixture.ts
  - packages/core/test/scaffold.test.ts
  - packages/core/test/skills.test.ts
findings:
  critical: 1
  warning: 9
  info: 4
  total: 14
status: issues_found
gap_closure_reviewed: 2026-09-18T20:00:00Z
gap_closure_files_reviewed: 9
gap_closure_findings:
  critical: 1
  warning: 4
  info: 2
  total: 7
---

# Phase 7: Code Review Report

**Reviewed:** 2026-09-18
**Depth:** standard
**Files Reviewed:** 46
**Status:** issues_found

## Summary

The new pure modules (`scaffold/{init,pointer,workflow}.ts`) are clean. The append-boundary
logic in `pointer.ts` is correct for every input I could construct, the emitted workflow keeps
the one Actions expression out of the `run:` body and quotes `"$BASE"` and `"$id"`, and
`permissions: contents: read` is present with no `pull_request_target`. `actions/checkout@v7`
and `actions/setup-node@v7` both exist (checked against the GitHub API — checkout v7.0.1,
setup-node v7.0.0), so the pins in `workflow.ts` and `ci.yml` are real.

The link guard in `guard.ts` walks every component rather than lstat-ing the leaf, which is the
right shape; `scannable` in `skills.ts` correctly answers the read question separately. The test
suites are, on the whole, unusually hard to fool: `workflow-script.test.ts` actually executes the
emitted script with a mutation probe, `skill-commands.test.ts` reads the real commander tree, and
almost every scan carries an explicit guard-the-guard case. Both examples lint clean with zero
warnings and pass `gate ready`.

One real defect dominates: **`accord init` performs filesystem writes before it has finished
deciding whether to refuse**, so a stale CLI leaves three files (including a wrong-version CI
workflow) in a repository that rejected it, and prints nothing. That is CR-01 and I reproduced it.
Everything else is a warning: a generated config missing the one key its own generated CI job
needs, a shell-quoting hole in an advisory the user is invited to paste, and the fact that the
shipped examples' test evidence is a static file nothing regenerates.

## Critical Issues

### CR-01: `accord init` writes files before it refuses, and reports nothing when it does

**File:** `packages/cli/src/commands/init.ts:41-50`, `:55-67`, `:74`, `:99`

**Issue:** The scaffold write loop runs at lines 41-50, but three refusal checks run *after* it:
the `config === undefined` throw (line 59), the pin mismatch throw (line 67), and the
`assertNoLink` pre-pass over skill targets (line 74). Any of those throws propagates out of
`init` before line 99, so `results` is never printed.

Reproduced against a sandbox repo holding a hand-written `accord/config.yml` pinned to `0.0.1`
while the running CLI is `0.1.0`:

```
exit 2
stdout: ""
stderr: config.yml pins accord 0.0.1, running 0.1.0 - run: npx --yes @accord-dev/accord@0.0.1

FILES ON DISK AFTER REFUSAL:
   .github/workflows/accord.yml
   accord/config.yml            <- pre-existing
   accord/product/business-rules.md
   accord/product/glossary.md
```

Three consequences:

1. **A repository that refused this CLI receives its artifacts anyway.** This is the same
   property T-07-08 protects for skill copies; the comment at `init.ts:62-65` claims the refusal
   "fires before `skillTargets` is called, so nothing under a skill directory is written" — true,
   and it is the narrower half of the claim the code actually needs.
2. **The emitted workflow is pinned to the wrong version and D-135 is broken.** `.github/workflows/accord.yml`
   now carries `npx --yes @accord-dev/accord@0.1.0` while `config.yml` pins `0.0.1`. Under D-94 the
   job's `lint` and every `gate done` exit 2 on every pull request, permanently. D-135's
   "the workflow pin and the config pin are the same string by construction" holds inside
   `initFiles`, but not across the command that writes them, because `config.yml` is skipped and
   the workflow is not.
3. **Nothing tells the user.** stdout is empty, so the three created paths are invisible.
   D-130's guarantee ("nothing writes over an existing file") still holds, but "nothing was
   written" is what the user will infer from an exit-2 refusal with no report.

The same ordering makes `assertNoLink`'s own message false: the guard at line 74 throws
`<path> is not a regular directory - nothing was written` after the scaffold loop has already
written. `packages/cli/src/guard.ts:33` and the comment at `init.ts:30-32` both state that the
pre-pass exists precisely so that message can never be false. It is false for every skill-target
path.

The existing test cannot catch this: `init.test.ts:239-243` (`refuses`) asserts only that
`.claude/skills` and `.agents/skills` are absent. It never looks at the scaffold paths.

**Fix:** Do every refusal before the first byte. The config/pin check needs `accord/config.yml`
on disk, so split the loop rather than reordering it wholesale — write only `accord/config.yml`
first (or read it through the loader without writing, since D-130 skips it when it exists), then
run the config, pin and skill-target checks, then write the remaining scaffold paths:

```ts
// 1. everything that can refuse, before anything that writes
for (const { path } of files) assertNoLink(ctx.root, path);
for (const path of POINTER_FILES) assertNoLink(ctx.root, path);

const existingConfig = lstatSync(at('accord/config.yml'), { throwIfNoEntry: false });
if (existingConfig !== undefined) {
  const snapshot = loadSnapshot(loadFromFs(ctx.root));
  if (snapshot.config === undefined) {
    throw new UsageError('accord/config.yml is missing or failed its schema; run accord lint');
  }
  const message = pinMessage(snapshot.config.accord, pkg.version);
  if (message !== undefined) throw new UsageError(message);
  for (const { path } of skillTargets(snapshot.config)) assertNoLink(ctx.root, path);
}

// 2. only now, write
```

And add the missing assertion to `init.test.ts`'s `refuses` helper so the regression is covered:

```ts
const refuses = async (repo: string) => {
  const before = listAll(repo);          // every path except .git
  const { code, err } = await run(['init'], repo);
  expect(listAll(repo), 'init wrote before it refused').toEqual(before);
  return { code, err };
};
```

## Warnings

### WR-01: the config `init` writes omits `tests:`, so the workflow `init` writes cannot pass `gate done`

**File:** `packages/core/src/scaffold/init.ts:25-52`

**Issue:** `CONFIG()` writes `accord`, `profile`, `tracker`, `design`, `roles`, `runtimes` — and
no `tests:` key. `gate.tests-unconfigured` is an **error**-level Done rule
(`packages/core/src/gate/rules.ts:87`), and its check fires as soon as a ticket carries one
`@test:` scenario (`gate/rules.ts:263-272`: `no test report is declared, so the machine layer
cannot run and Done cannot pass; set tests.report`). The workflow `initFiles` writes in the very
same call runs `gate done` on every ticket-touching pull request.

So the out-of-the-box sequence is: `accord init` → BA writes a ticket → dev tags a scenario
`@test:` → first pull request → CI red on a config key the config never mentioned. Every other
key in the generated file carries a comment explaining what to put there; `tests:` carries
neither a value nor a comment. `grep -rn "tests\.report\|tests:" packages/core/skills/ packages/core/templates/`
returns nothing, so no shipped text names it either.

Both shipped examples do declare it, with a comment, in the same file that otherwise matches
the generated one line for line:

```yaml
# Where the test report lands. `accord gate done` reads it to check that the test behind each
# @test: tag really passed; without it there is no Done.
tests:
  report: reports/junit.xml
```

**Fix:** Add the same block to `CONFIG()`. `tests.report` has `minLength: 1` in
`config.schema.json`, so an empty-string placeholder will not validate; write the same default
the examples use and let `gate.report-missing` say so if the file is absent:

```ts
// Where the test report lands. `accord gate done` reads it to check that the test behind each
// @test: tag really passed; without it there is no Done.
tests:
  report: reports/junit.xml
```

If the decision is deliberately to leave it out, the key still needs a commented-out stanza — an
error a user meets on their first pull request, naming a key nothing ever told them about, is
exactly the first minute D-134 set out to protect.

### WR-02: the emitted CI script passes an attacker-shaped ticket id as an option

**File:** `packages/core/src/scaffold/workflow.ts:78`

**Issue:** `${accord} gate done "$id" || code=1`. `$id` is derived from a file name that arrives
in the pull request diff, and there is no `--` separator, so an option-shaped name is parsed as
an option. Verified against the real CLI:

```
accord gate done --help      -> exit 0, prints usage, gates nothing
accord gate done -- --help   -> exit 1, gate.ticket-unknown
```

A file `accord/tickets/--help.md` therefore produces a `gate done` invocation that exits 0 and
gates nothing, and the accumulator never sees a failure. Today this is masked: `accord lint`
independently reports `lint.id-mismatch` (or the `id` schema `pattern` rejects a leading `-`),
so the job still goes red on the lint call. That is a second control catching it, not this one.
`--json` fails closed (exit 2 → `code=1`); `--help` fails open, which is the wrong direction for
a gate.

**Fix:** One token.

```sh
${accord} gate done -- "$id" || code=1
```

Add a case to `workflow-script.test.ts` with `write(r, 'accord/tickets/--help.md', ...)` asserting
the stub is called with `gate done -- --help`.

### WR-03: the orphan advisory builds an `rm -rf` command out of a name read off disk

**File:** `packages/cli/src/commands/skills.ts:139-141`

**Issue:**

```ts
stale.map((d) => 'orphan ' + d + ' - no longer declared; accord never deletes - remove it with: rm -rf ' + d + '\n')
```

`d` is `dir + '/' + entry.name` where `entry.name` comes from `readdirSync` and is only
constrained to start with `accord-` (`skills.ts:84`). `;`, `&&`, `$(`, backtick and newline are
all legal in a POSIX filename. A repository containing `.claude/skills/accord-x;rm -rf ~` makes
accord print:

```
orphan .claude/skills/accord-x;rm -rf ~ - no longer declared; accord never deletes - remove it with: rm -rf .claude/skills/accord-x;rm -rf ~
```

The line is worded as a command to paste, so the injection lands in the user's shell rather than
in accord's process. `skills-sync.test.ts:111-118` already records that the entry name is
"read off the user's disk, and printing it verbatim is the point" — the encoding risk was
considered; the shell-metacharacter risk was not.

**Fix:** Either quote it, or stop emitting a runnable command:

```ts
stale.map((d) => `orphan ${d} - no longer declared; accord never deletes - remove the directory yourself\n`)
```

Quoting (`rm -rf '<d>'` with `'` escaped as `'\''`) also works but re-introduces a POSIX-only
instruction on a CLI that must be correct on Windows, where `rm -rf` is not a command at all.

### WR-04: the pointer block names a skill directory `init` may never create

**File:** `packages/core/src/scaffold/pointer.ts:35-36`

**Issue:** The block states unconditionally:

> Role workflows for this repository are installed at `.claude/skills/accord-*` and
> `.agents/skills/accord-*`.

`init` and `skills sync` write only into the directories `runtimes:` declares
(`skillTargets(config)`). D-144 makes the *file list* unconditional, which is a different claim
from making the *directory list inside the text* unconditional. On a repository whose config
rosters `runtimes: [claude]` — this repository's own case, and the D-132 proving case — nothing
is ever written under `.agents/skills`, and an agent following the block looks in a directory
that does not exist.

The two test suites prove both halves and neither notices the contradiction:
`init.test.ts:229` asserts `existsSync('.agents/skills') === false` for a `[claude]` roster;
`scaffold.test.ts:299-300` asserts the block contains `.agents/skills/accord-`.

**Fix:** Word the sentence so it is true for any roster, keeping the block a source literal with
no interpolation (T-07-20):

```
Role workflows for this repository are installed under `.claude/skills/accord-*` or
`.agents/skills/accord-*`, depending on which runtimes `accord/config.yml` declares.
```

### WR-05: the examples' test evidence is a hand-written file nothing regenerates

**File:** `examples/build/reports/junit.xml`, `examples/maintain/reports/junit.xml`, `examples/build/test/signup.spec.ts`, `examples/maintain/test/export.spec.ts`

**Issue:** `vitest.config.ts` declares `projects: ['packages/core', 'packages/cli']`, and each
project's `include` is `test/**/*.test.ts`. `examples/*/test/*.spec.ts` matches neither the
project list nor the include glob, so `npm test` never runs them. `npm run typecheck` covers only
`packages/`. The `examples` job in `ci.yml:41-81` runs `accord lint` and `accord gate done` and
nothing else.

So the two `.spec.ts` files are never executed by anything, and the `junit.xml` the Done gate
reads is a static file asserting they passed. Break `exportCsv` and every check stays green:
`npm test` does not run the test, and `gate done` reads the unchanged report and passes. In the
one example whose whole subject is "an agent cannot finish a story without independent
verification", the verification is a fixture.

`examples.test.ts` deliberately does not pin a golden, and that reasoning is sound — but it
asserts the *gate verdict*, which is precisely the thing the stale report makes unfalsifiable.

**Fix:** Have the `examples` CI job run the example's own tests and produce the report, then gate:

```bash
( cd "$tmp" && npx --yes vitest run --reporter=junit --outputFile=reports/junit.xml )
```

If running them is out of scope for this phase, then at minimum assert in `examples.test.ts`
that every `@test:` id in the ticket resolves to a `testcase` in the shipped `junit.xml` *and*
to a `test(...)` in the shipped spec, so the three artifacts cannot drift apart silently.

### WR-06: the signup example stores plaintext passwords

**File:** `examples/build/src/signup.ts:4`, `:12`

**Issue:**

```ts
const accounts = new Map<string, string>();
...
accounts.set(address, password);
```

The map is address → password in clear text. This is shipped documentation for a *signup*
feature, in the example a reader is invited to copy as the shape of an accord-managed change.
The surrounding prose is careful about every other property (the password floor is read from the
one business rule rather than restated), which makes the one unsafe line read as endorsed.

The example does not need to store the password at all to satisfy either scenario — `@ac-1`
checks the workspace opens, `@ac-2` checks a second attempt is refused. Both only need the set of
taken addresses.

**Fix:** Store nothing secret:

```ts
// Only which addresses are taken: an example has no business modelling credential storage.
const accounts = new Set<string>();
...
if (accounts.has(address)) return { refused: 'address-taken' };
accounts.add(address);
```

`forget` becomes `accounts.delete(address)` and both spec files are unchanged.

### WR-07: the CSV example is open to formula injection, and the business rules never decided it

**File:** `examples/maintain/src/export.ts:9-13`

**Issue:** `NEEDS_QUOTING = /["\n\r,]/` implements exactly the rule
`examples/maintain/accord/product/business-rules.md:10` states, and nothing more. A member name
beginning `=`, `+`, `-`, `@`, tab or CR is written unquoted and is interpreted as a formula by
Excel, LibreOffice and Google Sheets. The ticket's `## Intent` says the file exists *because*
team leads paste the table into a spreadsheet, so the dangerous consumer is the stated one.

RFC 4180 quoting does not help here — a spreadsheet strips the quotes before evaluating — so
this is a rule that has to be decided, not a coding slip. Per the project's own standing rule
(undecided business logic is recorded as a finding and raised, never silently assumed), the
missing decision belongs in `business-rules.md`.

**Fix:** Two steps, in order.

1. Add the decision to `examples/maintain/accord/product/business-rules.md`, in the same
   `Rejected:` shape the file already uses:

```markdown
- A field a person typed that begins with `=`, `+`, `-`, or `@` is prefixed with a single quote
  in the export, so a spreadsheet shows it as text rather than evaluating it as a formula
  - Rejected: stripping the character — the export is reconciled against a source system, so a
    silently altered name reads as a different person
```

2. Then implement it in `export.ts` and add the scenario + test, so the example stays a complete
   worked example rather than gaining an untested rule.

### WR-08: appending the pointer block to a CRLF file produces mixed line endings

**File:** `packages/cli/src/commands/init.ts:84-89`

**Issue:** `readFileSync(file, 'utf8')` preserves whatever the file holds, and `pointerText`
appends an LF-only block. A repository whose `CLAUDE.md` or `AGENTS.md` is CRLF (common on a
Windows checkout without `.gitattributes`, which a user's repo has no reason to have) comes out
of `init` with CRLF above the marker and LF below it. `git diff` then shows the whole file as
changed on the next commit under some `core.autocrlf` settings, and the FMT-08 invariant accord
asserts for every file it writes does not hold for the one file it appends to.

The prefix invariant (T-07-18) is what forces this — the original bytes must not be rewritten —
so the fix is on the appended side, not the existing side.

`scaffold.test.ts:277` passes `'a\r\nb\r\n'` through `pointerText` but only checks the prefix and
suffix, so the mixed result is asserted as correct.

**Fix:** Match the separator and the block to what the file already uses:

```ts
const eol = existing.includes('\r\n') ? '\r\n' : '\n';
return existing + separator.replaceAll('\n', eol) + BLOCK.replaceAll('\n', eol);
```

Keep the LF form for the created case (`existing === undefined || ''`). Add a case to
`init.test.ts` writing a CRLF `AGENTS.md` and asserting the result contains no lone `\n`.

### WR-09: `assertNoLink` accepts a hardlink

**File:** `packages/cli/src/guard.ts:22-37`

**Issue:** The leaf check is `!found.isFile()`. A hardlink to a file outside the repository is a
regular file by every stat predicate, so the guard passes, and `writeSkillFiles`
(`commands/skills.ts:56`) then writes *through* it to the linked inode. The doc comment enumerates
the threat as "never a symlink or a Windows junction"; the hardlink is the unlisted third way to
make a path inside the repository point at bytes outside it.

Scope is limited — `init`'s scaffold paths are skip-if-exists, so only the skill copies (which
overwrite by design, D-112) are reachable — and it needs a repository the user already distrusts.
But the guard exists for exactly that repository.

**Fix:** Refuse a multiply-linked leaf, which `lstat` already reports:

```ts
if (leaf && (!found.isFile() || found.nlink > 1)) { throw ... }
```

`nlink > 1` is meaningful on both NTFS and POSIX. If that is judged too strict, at minimum
narrow the doc comment so it stops claiming coverage the code does not have.

## Info

### IN-01: the build example's verification notes claim a behaviour nothing verifies

**File:** `examples/build/accord/tickets/SIGNUP-1.md:52-53`

**Issue:** `## Verification notes` for `@ac-1` says "a nine-character password is refused on the
same path". No scenario covers the password floor, no test in `test/signup.spec.ts` exercises it,
and `reports/junit.xml` carries only the two testcases. The `password-too-short` branch in
`src/signup.ts:9` is dead code in this example. In the artifact that teaches what a verification
note is for, the note asserts more than the evidence behind it.

**Fix:** Either drop the clause, or add `@ac-3` with its scenario, test and junit entry. Dropping
it is the smaller change and keeps the example at the two-to-five scenarios `story.md` recommends.

### IN-02: `ba/story.md` previews what `accord lint` reports

**File:** `packages/core/skills/ba/story.md:26`

**Issue:** "a line that is none of the six is reported by `accord lint` at its line number" states
what the command reports and where, which is the shape SKILL-04 / D-148 ruled against. The
`no rendered text restates a rule the CLI enforces` scan in `skills.test.ts:344` does not reach it
(no rule id, no finding level, no verdict word, no PROMOTED subject). Flagging for a judgement
call rather than as a confident regression: the surrounding sentence is teaching the six EARS
shapes, which is legitimate authoring guidance.

**Fix:** If it is a restatement, "`accord lint` reports what it finds" carries the same
instruction without previewing the report.

### IN-03: the examples' `config.yml` duplicates 27 generated comment lines with nothing binding them

**File:** `examples/build/accord/config.yml:1-27`, `examples/maintain/accord/config.yml:1-27`

**Issue:** Both files reproduce `CONFIG()` from `scaffold/init.ts:25-52` verbatim, then add the
`tests:` block. No test compares them, so editing a comment in `CONFIG()` silently leaves the two
shipped examples showing an older wording of the same file — including, today, the divergence
WR-01 describes.

**Fix:** Assert the relationship in `examples.test.ts`:

```ts
const generated = initFiles({ name: '@accord-dev/accord', version: '0.1.0' })
  .find((f) => f.path === 'accord/config.yml')!.text;
expect(input.files['accord/config.yml'].startsWith(generated.replace(/profile: build\n/, ...)))
```

or, simpler and more durable, assert that every comment line of `CONFIG()` appears in each
example's `config.yml`.

### IN-04: the examples CI job gates with the developer and the reviewer as one person

**File:** `.github/workflows/ci.yml:59`

**Issue:** The job commits everything as `user.name=ci`, so the real `gate done` run emits
`gate.author-match — the review and the gated commit share an author (ci@example.invalid), so no
second pair of eyes touched this ticket`. Confirmed by running both examples through the real CLI.
It is a warning, so the job stays green — but the job's stated purpose is to demonstrate accord
working, and it demonstrates it warning that nobody reviewed the change. `examples.test.ts:34-37`
avoids this by fabricating two distinct authors, so the two layers disagree about what the
examples look like under a gate.

**Fix:** Commit the ticket and the verification file separately with different identities, or
accept it and say so in the job's comment.

---

_Reviewed: 2026-09-18_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

## Gap-Closure Pass — 07-09, 07-10, 07-11

**Reviewed:** 2026-09-18T20:00:00Z
**Depth:** standard
**Files reviewed:** 9
**Findings:** 1 critical, 4 warnings, 2 info

Scope: `packages/cli/src/commands/init.ts`, `packages/cli/test/init.test.ts`,
`packages/cli/test/new-ticket.test.ts`, `packages/core/src/scaffold/init.ts`,
`packages/core/templates/epic.md`, `packages/core/templates/ticket-build.md`,
`packages/core/templates/ticket-maintain.md`, `packages/core/test/scaffold.test.ts`,
`packages/core/test/templates.test.ts`. `packages/core/src/generated/templates.ts` and
`packages/core/test/__golden__/ticket-build.verified-empty.md` were excluded as machine-generated.
The four in-scope test files were executed: 96 tests, 4 files, all green.

The first pass's other findings (WR-02 … WR-09, IN-01 … IN-04) were not in this pass's scope and
none of them is addressed by these three plans. WR-08 in particular is still open in the same
region 07-09 rewrote, and GC-CR-01 below is a **second, independent** defect in that same append —
a byte-level one WR-08's line-ending fix would not touch.

### Verdict on CR-01 — closed

The claim holds against the code, not just the plan. `init.ts:77-80` resolves
`guarded = refusals()` **before** the `try` at line 95, and `refusals()` (lines 48-69) performs all
three refusals — config unreadable, pin mismatch, skill-target not a regular file — in that order.
So on the path CR-01 reproduced (a repository holding `accord/config.yml`), nothing is written
before any of the three refusals. Two structural reasons it cannot be worked around rather than
merely happen to pass:

- Every way `accord/config.yml` can exist and not yield a usable config now throws before the loop.
  A directory at that path is caught by the line-33 pre-pass (`assertNoLink` leaf `isFile()`); a
  symlink likewise; a zero-byte or unparseable file gives `snapshot.config === undefined`; a
  parseable one that pins elsewhere gives the pin throw. `loadFromFs` cannot return a snapshot with
  a config that skipped the pin.
- CR-01's consequence 2 — a workflow pinned to the running version beside a config pinning another —
  is now unreachable. It required the scaffold loop to run while a foreign pin was on disk, and
  that is exactly the ordering that changed.

CR-01's suggested test hardening was adopted: `init.test.ts:257-268` compares `listAll(repo)`
before and after, over the whole tree rather than the two skill directories.

Residuals, all accounted for:

1. A **greenfield** run still writes the four scaffold paths before its skill-target guard can run,
   because the roster comes from the `config.yml` that run is writing. This is correct: on a
   greenfield repository there is no foreign pin and no unreadable config to refuse, so the only
   refusal reachable after the loop is the skill-target one, and `init.test.ts:296-308` proves the
   report is printed when it fires. Not a finding.
2. The hoisted skill-target guard has no test on the config-exists path — GC-WR-02.
3. The report printed on the throw path is incomplete for the skill half — GC-WR-01.

### Verdict on WR-01 — addressed, by WR-01's own stated alternative

WR-01's fix text offered two options and the owner took the second: "If the decision is
deliberately to leave it out, the key still needs a commented-out stanza." `scaffold/init.ts:53-57`
now ships that stanza with a one-line instruction, and the two comment lines are the examples'
wording rather than a third phrasing (`scaffold.test.ts:132-145`). WR-01's actual grievance — "an
error a user meets on their first pull request, naming a key nothing ever told them about" — is
answered: the key is now named in the file the user is editing.

The residual the owner named is confirmed correct behaviour, and asserted:
`scaffold.test.ts:125-127` proves no `tests` key parses from the shipped file, so
`gate.tests-unconfigured` still fires on a fresh repository until a human uncomments. That is the
right trade — writing the key uncommented would have put a standing `lint.report-missing` warning
(`lint/rules.ts:75`) on every fresh repository from its first minute and broken
`init.test.ts:141-147`, which is the papercut the D-134 amendment exists to prevent. Not a finding.

A **different** residual does remain: uncommenting is not sufficient, and the instruction line does
not say so — GC-WR-03.

### 07-11 — clean

The five lines are neutral, and the substitution is sound: `https://example.com/design/...` is an
RFC 2606 reserved name, and it still satisfies `ticket.schema.json`'s `"design": { "pattern":
"^https://" }`, so a user who fills the key in from the example gets a value that validates. No
gate or lint rule inspects the host (`gate/ready.ts:24-36` tests only `typeof === 'string'` and
`!== ''`), so nothing keyed off the old host. The build/maintain discriminator the CLI tests use
survives the rewording: build carries `Ready then requires a design link in design:` and maintain
carries `Ready then requires a prototype at …`, so both halves of each
`new-ticket.test.ts:82-99` pair are still exclusive.

The widened scan is real coverage, not a restatement. `deniedNames` over
`Object.entries(templates)` reaches the same bytes as `packages/core/templates/` because the drift
case (`templates.test.ts:130-137`) binds the record to the directory file-by-file with `toBe`, so
the suite cannot be green with a denied name on disk. An independent
`grep -rniE "\b(gsd|bmad|jira|linear|figma|anthropic|openai|claude code)\b"` over
`packages/core/templates/` and `examples/` returns nothing.

---

### GC-CR-01: the pointer append re-encodes a human's file as UTF-8, destroying any byte that was not UTF-8

**File:** `packages/cli/src/commands/init.ts:119` and `:124`

**Issue:** `readFileSync(file, 'utf8')` decodes with replacement, and line 124 writes the result
back as UTF-8 over the whole file. Any byte sequence in `AGENTS.md` or `CLAUDE.md` that is not
valid UTF-8 — a windows-1252 / latin-1 file, which is what a legacy Windows editor produces and
what `git` happily stores because it treats the file as text — is replaced by `EF BF BD` (U+FFFD)
and the original byte is gone. `init` reports the file as `appended` and exits 0.

This breaks the invariant the function is written around. `scaffold/pointer.ts:48` states
"T-07-18: for every input that returns a string, that input is a byte-exact prefix of the result.
This appends and does nothing else — no substitution, no reflow, no re-serialisation of a document
a human owns." The re-serialisation is on the CLI side of the seam, so core's own tests
(`scaffold.test.ts:320-327`) cannot see it, and `init.test.ts:381-391` only ever feeds it ASCII, so
the byte-exact-prefix assertion passes vacuously.

Verified on Node 24.14 with the bytes `63 61 66 E9 20 96 20 64 61 73 68 0A` ("caf<E9> <96> dash"):

```
orig : 636166e9209620646173680a
after: 636166efbfbd20efbfbd20646173680a
byte-exact prefix preserved: false
```

This is the one `init` write that is not skip-if-exists, into the one file whose contents belong
entirely to a human, and it is silent. `git` recovers it only if the file was committed.

**Fix:** Round-trip the existing bytes through `latin1`, which is a byte-for-byte codec for
`0x00`-`0xFF`. `BLOCK`, `POINTER_START` and the separator in `scaffold/pointer.ts` are pure ASCII,
so they encode identically under `latin1` and `pointerText`'s `includes(POINTER_START)` and
`endsWith('\n')` tests are unaffected — mojibake elsewhere in the decoded string is never inspected.

```ts
const text = pointerText(found === undefined ? undefined : readFileSync(file, 'latin1'));
if (text === undefined) {
  results.push({ status: 'skipped', path });
  continue;
}
writeFileSync(file, text, 'latin1'); // byte-for-byte codec: a non-UTF-8 file survives the append
```

Confirmed on the same bytes: `latin1 prefix preserved: true`. Add a case to `init.test.ts` writing
a non-UTF-8 `AGENTS.md` and asserting `bytes(...).startsWith(original)` — the existing `bytes()`
helper already reads `latin1`, so the assertion is one line. If `latin1` is judged too indirect,
the alternative is to read a `Buffer`, decide on `buf.toString('utf8')`, and write
`Buffer.concat([buf, Buffer.from(suffix, 'utf8')])`, which needs `pointerText` to return the suffix
rather than the whole file.

---

### GC-WR-01: a partial skill-copy run is reported as if it never happened

**File:** `packages/cli/src/commands/init.ts:110`

**Issue:** `results.push(...writeSkillFiles(ctx.root, guarded ?? refusals()))` receives the report
only as a return value, so if `writeSkillFiles` throws part-way through its loop
(`commands/skills.ts:36-58`) every copy it already wrote is absent from `results` — and the `catch`
at line 130 prints `rendered()` without them. The comment at lines 90-94 claims the catch exists so
"a partial run is legible rather than invisible"; for the skill half it is invisible. The pointer
loop below does not have this problem, because it pushes inside the loop.

The loop is not throw-free: `readFileSync(file, 'utf8')` at `skills.ts:47` and `writeFileSync` at
`:41` and `:56` can fail on a locked or read-only file (routine on Windows), and `assertNoLink` ran
earlier, so a path that changed shape in between lands here. The consequence is the specific one
D-112 was written to prevent — `skills.ts:6-8`: "losing someone's work *without saying so* is what
this report prevents." An `overwrote local edits` that really happened at target 1 goes unreported
when target 2 throws.

**Fix:** Let the caller own the array, so a status is recorded the moment it is true. One
parameter, and `skills()` passes its own local.

```ts
// commands/skills.ts
export function writeSkillFiles(
  root: string,
  targets: SkillFile[],
  out: { status: SkillStatus; path: string }[] = [],
): { status: SkillStatus; path: string }[] {
  for (const { path, text } of targets) {
    ...
    out.push({ status: 'created', path });
    ...
  }
  return out;
}

// commands/init.ts
writeSkillFiles(ctx.root, guarded ?? refusals(), results);
```

---

### GC-WR-02: the refusal that CR-01's fix actually hoisted is the one with no test

**File:** `packages/cli/test/init.test.ts:256-289`

**Issue:** `describe('accord init — a config it cannot act on')` has two cases: a foreign pin and
an unparseable config. Both would have been caught by `refusals()` wherever it sat relative to the
loop, because both come from the loader. The **third** refusal — `assertNoLink` over
`skillTargets(snapshot.config)` at `init.ts:66-67` — is the one whose position changed, and it is
exercised only by `init.test.ts:296-308`, which is a *greenfield* repository and therefore asserts
the opposite outcome (four files written, then the refusal). So the claim "on a repository that
already has a config, a bad skill-target path refuses before the first byte" is unproven, and a
regression that moved that one check back inside the `try` would keep all 96 tests green.

`refuses()` also never inspects stdout, so a regression that printed a report for paths it did not
write would pass it.

**Fix:** One case in the existing describe, reusing the `HAND_WRITTEN` fixture whose roster is
`[ba, dev]` on `[claude]` so the occupied path is one the roster really targets:

```ts
it('refuses a skill-copy target that is not a regular file, before any write', async () => {
  const repo = sandbox();
  mkdirSync(at(repo, 'accord'), { recursive: true });
  writeFileSync(at(repo, CONFIG), HAND_WRITTEN(pkg.version));
  mkdirSync(at(repo, '.claude/skills/accord-ba/SKILL.md'), { recursive: true });
  const { code, err } = await refuses(repo);
  expect(code).toBe(2);
  expect(err).toContain('is not a regular file');
});
```

and add `expect(out).toBe('')` to `refuses` itself, since a repository that received no byte must
also be told it received none.

---

### GC-WR-03: uncommenting the `tests:` block is not enough, and the instruction says it is

**File:** `packages/core/src/scaffold/init.ts:55`

**Issue:** The line reads "Uncomment the two lines below before the first ticket carrying an
`@test:` scenario." Following it literally leaves the repository still unable to reach Done, with a
worse diagnostic than before:

- `reports/junit.xml` is accord's invention, not the team's. Nothing in the repository writes there
  unless the team's runner happens to, so `gate done` fails at `gate/done.ts:274-279` with
  `tests.report "reports/junit.xml" is not in the snapshot` instead of the self-explanatory
  `no test report is declared … set tests.report`. A key that looks configured and is not is a
  harder thing to diagnose than a key that is absent.
- `lint` gains a standing `lint.report-missing` warning (`lint/rules.ts:75`,
  `lint/gherkin.ts:90-95`) from the moment the block is uncommented until the report file exists —
  the same first-minute papercut `design.tokens: ""` exists to avoid.
- The generated CI job runs `lint` and `gate done` (D-140), so the first pull request after an
  uncomment is red on accord's own sample path.

Secondary, in the same line: "Uncomment" is ambiguous about the space. Deleting only `#` from
`# tests:` yields ` tests:`, which is a YAML indentation error, after which every command reports
`accord/config.yml is missing or failed its schema; run accord lint`.
`scaffold.test.ts:108-121` only proves the `# `-stripping variant parses.

**Fix:** One reworded line, naming both the edit and the second half of it:

```ts
# Remove the "# " from the two lines below and point report: at the file your test runner writes,
# before the first ticket carrying an @test: scenario.
```

`scaffold.test.ts:141`'s `lines.indexOf('# tests:')` anchor keeps working; the A-33 case compares
`key - 3` and `key - 2`, which are still the two copied comment lines, so neither test needs an
edit.

---

### GC-WR-04: the A-33 assertion pins the example side to the fixed offset its own comment rejects

**File:** `packages/core/test/scaffold.test.ts:144`

**Issue:** The comment at lines 139-140 says "Located relative to the block rather than at a fixed
offset: this plan edits the file an absolute offset would pin, and the next plan to add a key would
break the assertion instead of the claim" — and then the generated side is anchored with
`lines.indexOf('# tests:')` while the example side is `example.split('\n').slice(28, 30)`. That is
precisely the fixed offset, applied to `examples/build/accord/config.yml`, a file no assertion in
this case pins the shape of. Inserting or deleting one line anywhere above line 29 of that file
makes this case compare two unrelated lines and fail on a claim that is still true.

**Fix:** Anchor both sides the same way. The example has the key uncommented, so the anchor is
`tests:`:

```ts
const exLines = example.split('\n');
const exKey = exLines.indexOf('tests:');
expect(exKey, 'no "tests:" line in the example config').toBeGreaterThan(2);
expect(lines.slice(key - 3, key - 1)).toEqual(exLines.slice(exKey - 2, exKey));
```

---

### GC-IN-01: `accord/config.yml` is a literal in three places, and the CR-01 fix hinges on it

**File:** `packages/cli/src/commands/init.ts:78`

**Issue:** The greenfield-or-not decision is
`lstatSync(join(ctx.root, 'accord', 'config.yml'), …) === undefined`. The path it probes is owned by
`packages/core/src/scaffold/init.ts:74`, and `packages/cli/test/init.test.ts:16` holds a third copy.
If core ever moves the config, this probe silently reports "greenfield" for every repository and
every refusal moves back after the write loop — CR-01, restored. Other tests would go red for other
reasons, so it would be noticed, but not as itself.

**Fix:** Export the path from the module that decides it — `export const CONFIG_PATH =
'accord/config.yml';` in `scaffold/init.ts`, used by `initFiles` and imported here.

---

### GC-IN-02: `refusals()` is named for what it throws and used for what it returns

**File:** `packages/cli/src/commands/init.ts:48`, `:110`

**Issue:** At the call site `writeSkillFiles(ctx.root, guarded ?? refusals())` the reader sees a
function called `refusals` supplying the list of files to write. The docstring explains the dual
role, which is the tell that the name does not. Consolidating the three checks was the right move;
the name is the one cost it carried.

**Fix:** `guardedSkillTargets()` — or keep the name and return nothing, calling `skillTargets` again
at the one site that needs it. The first is smaller and keeps the config parsed once (A-07).

---

_Gap-closure reviewed: 2026-09-18T20:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

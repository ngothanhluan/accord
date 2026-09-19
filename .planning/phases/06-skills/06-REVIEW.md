---
phase: 06-skills
reviewed: 2026-09-17T04:32:00Z
depth: standard
passes:
  - id: 1
    reviewed: 2026-09-16T03:50:06Z
    scope: plans 06-01 .. 06-04, 39 files
  - id: 2
    reviewed: 2026-09-16T06:01:36Z
    scope: plans 06-05 / 06-06 gap closure, 8 files (all already inside the pass-1 set)
  - id: 3
    reviewed: 2026-09-17T04:32:00Z
    scope: plans 06-07 / 06-08 gap closure, 6 files
files_reviewed: 40
files_reviewed_list:
  - .claude/skills/accord-ba/SKILL.md
  - .claude/skills/accord-ba/ready.md
  - .claude/skills/accord-ba/setup.md
  - .claude/skills/accord-ba/story.md
  - .claude/skills/accord-dev/SKILL.md
  - .claude/skills/accord-dev/code-review.md
  - .claude/skills/accord-dev/debug.md
  - .claude/skills/accord-dev/prototype.md
  - .claude/skills/accord-dev/review.md
  - accord/config.yml
  - package.json
  - packages/cli/src/commands/skills.ts
  - packages/cli/src/run.ts
  - packages/cli/test/skill-commands.test.ts
  - packages/cli/test/skills-sync.test.ts
  - packages/cli/test/spawn-surface.test.ts
  - packages/core/scripts/gen-skills.mjs
  - packages/core/skills/ba/SKILL.md
  - packages/core/skills/ba/ready.md
  - packages/core/skills/ba/setup.md
  - packages/core/skills/ba/story.md
  - packages/core/skills/designer/SKILL.md
  - packages/core/skills/dev/SKILL.md
  - packages/core/skills/dev/code-review.md
  - packages/core/skills/dev/debug.md
  - packages/core/skills/dev/review.md
  - packages/core/skills/shared/prototype.md
  - packages/core/src/generated/skills.ts
  - packages/core/src/generated/templates.ts
  - packages/core/src/index.ts
  - packages/core/src/skills/render.ts
  - packages/core/src/skills/targets.ts
  - packages/core/templates/business-rules.md
  - packages/core/test/__golden__/wrong-plan.lint.json
  - packages/core/test/__golden__/wrong-plan.snapshot.json
  - packages/core/test/fixtures/wrong-plan/accord/config.yml
  - packages/core/test/fixtures/wrong-plan/accord/tickets/TCK-1.md
  - packages/core/test/gate.test.ts
  - packages/core/test/skills.test.ts
  - packages/core/test/templates.test.ts
files_reviewed_pass_2:
  - packages/cli/src/commands/skills.ts
  - packages/cli/test/skills-sync.test.ts
  - packages/core/skills/dev/review.md
  - packages/core/skills/shared/prototype.md
  - packages/core/src/generated/skills.ts
  - packages/core/src/index.ts
  - packages/core/src/skills/targets.ts
  - packages/core/test/skills.test.ts
files_reviewed_pass_3:
  - packages/cli/src/commands/skills.ts
  - packages/cli/test/skills-sync.test.ts
  - packages/core/skills/dev/review.md
  - packages/core/skills/shared/prototype.md
  - packages/core/test/gate.test.ts
  - packages/core/test/skills.test.ts
findings:
  critical: 3
  warning: 12
  info: 8
  total: 23
status: issues_found
resolved:
  - CR-01
  - CR-02
  - WR-02
  - WR-04
  - NF-01
  - NF-03
  - NF-04
partially_resolved:
  - NF-02
open:
  - WR-01
  - WR-03
  - WR-05
  - NF-02
  - NF-05
  - NF-06
  - IN-01
  - IN-02
  - IN-03
  - IN-04
  - CF-3
  - P3-01
  - P3-02
  - P3-03
  - P3-04
  - P3-05
  - P3-06
---

# Phase 6: Code Review Report

**Reviewed:** 2026-09-17T04:32:00Z (pass 3) over 2026-09-16T06:01:36Z (pass 2) over 2026-09-16T03:50:06Z (pass 1)
**Depth:** standard
**Files Reviewed:** 40 (union across three passes; pass 3 re-reviewed 6 files, of which 5 were already in the pass-1 set and `packages/core/test/gate.test.ts` is new)
**Status:** issues_found

This file is the phase's review of record. It has three passes:

- **Pass 1** — plans 06-01 to 06-04, 39 files. Its findings keep their original IDs (`CR-`, `WR-`, `IN-`)
  and their original text, reproduced verbatim below under "Pass 1".
- **Pass 2** — plans 06-05 / 06-06 gap closure, the 8 files listed in `files_reviewed_pass_2`. Its new
  findings carry the `NF-` prefix so they cannot collide with pass 1. 06-06 produced no source changes
  (human-verification work), so every pass-2 file comes from 06-05.
- **Pass 3** — plans 06-07 / 06-08 gap closure, the 6 files listed in `files_reviewed_pass_3`. Its new
  findings carry the `P3-` prefix. No earlier finding's text has been altered; every status change is
  recorded in the "Status of the earlier findings" table inside the Pass 3 section.

---

## Pass 3 — 06-07 / 06-08 gap closure (2026-09-17T04:32:00Z)

### Summary

Both plans did the thing they set out to do, and both did it by the shortest honest route.

**06-07 closes NF-01 properly.** `scannable(root, dir)` (`packages/cli/src/commands/skills.ts:70-77`) is
the same per-component `lstat` walk `assertNoLink` performs over the write set, applied for the first time
to the scan set 06-05 widened past it. I checked the four ways this kind of guard usually fails:

- **Every component is checked.** `dir` comes only from `allSkillDirs()`, a pinned two-element literal
  (`skills.test.ts:81`), so `parts` is `['.claude','skills']` or `['.agents','skills']` and the loop runs
  once per element. There is no untested middle component to slip through.
- **The guard and the open agree on the path.** `scannable`'s last iteration evaluates
  `join(root, ...parts.slice(0, parts.length))`, which is character-for-character the `abs` that
  `readdirSync` is then handed at line 47. The guard cannot validate one path while the scan opens another.
- **A missing directory is a clean skip, not a throw.** `throwIfNoEntry: false` plus
  `found?.isDirectory() !== true` collapses "absent", "not a directory" and "is a link" into one `false`.
  The walk order additionally *fixes* an unnoticed case the old single `statSync` had: when `.agents` is a
  regular file, the old call `statSync('.agents/skills')` raised `ENOTDIR`, which `throwIfNoEntry` does not
  suppress; the new walk rejects at `i = 0` and never stats the deeper path.
- **POSIX and Windows agree.** `lstat` on a Windows junction and on a POSIX symlink both yield
  `isSymbolicLink() === true` / `isDirectory() === false`, so one code path covers both legs. This is the
  same fact `symlinkSync(..., 'junction')` already relies on in the write-side tests. Unrun on the POSIX
  leg — the summary's F-1 records that honestly and I have nothing to add to it.
- **`assertNoLink` is genuinely unchanged.** Lines 88-103 are the pass-1 fix verbatim, and the pre-pass is
  still the first thing `skills()` does with `targets` (line 118), ahead of the write loop.

The tests are honest. I re-ran them rather than taking the summary's word: `packages/cli` skills-sync is
**25 passed**, `packages/core` skills + gate is **162 passed**. `narrows the scan by the linked directory
and nothing else` is the case that matters — a guard that passed the first case by switching the scan off
would leave `orphanDirs(err)` empty and fail this one. Sandbox cleanup is correct too: `linkOutside` pushes
the second `mkdtemp` onto `repos` *after* `sandbox()` pushed the repo, and `afterEach` pops LIFO, so the
outside directory is removed first and the repository is left with a dangling junction that `rmSync`
unlinks rather than recurses through.

**The D-51 narrowing did not gut the invariant.** I checked what it still catches. `composed()` removes
only the `accord-*` entry names `readdirSync` returns for that sandbox; everything accord composes
survives. A regression that swapped the advisory's hyphen for an em-dash, or built the printed path with
`join` instead of `'/'`, still leaves the offending character in the line after removal and is still
caught. The NF-02 case compares against `readdirSync`'s own return value, not the `accord-café` literal
used to create the directory, so it makes no claim about host filesystem normalisation — the one thing
that would have made it flaky on APFS.

**06-08 closes NF-03 and NF-04.** `review.md:32-38` now shows the shape at the left margin, and I traced it
against the parser rather than reading it: `parseVerification` matches `/^Result:/` at
`packages/core/src/load/verification.ts:29` and `/^Evidence:/` at line 41, both on the raw section line,
and the block as shown satisfies both. The blank line between the two labels is harmless — `Evidence:` is
found by `findIndex`, not by adjacency. `prototype.md` no longer contains a sentence stating what
`accord lint` reads, covers, checks, or reports; I read all 53 lines and grepped the rendered copy, and
the only survivors are the step 4 heading and `## 5.`'s `accord gate ready` naming, both of which the
summary already flagged to the owner (F-3) rather than quietly keeping.

**`gate/done.ts` was correctly left alone.** I verified the premise rather than re-litigating the
decision: `evidenceUnresolved` sits in `DONE_RULES` at `error` on both profiles, and the two new cases in
`gate.test.ts:698-721` are real — `patchedReview` re-reads the fixture through `readFixture`, which
`readdirSync`es from disk on every call, so neither case contaminates the other or the `done('PASS')`
attribution assertion at line 709. The `EMPTY EVIDENCE` edit genuinely produces an empty evidence string:
the PASS fixture's `Evidence:` lines are the last content line of their sections, so replacing the line
leaves `evidence === ''` rather than a truncated non-empty value.

Also cleared, with evidence:

- **Both synced copies match the render.** `.claude/skills/accord-dev/review.md` and
  `.../prototype.md` are byte-identical to their `packages/core/skills/**` sources once the marker line and
  the source frontmatter are removed. No stale artifact is sitting in the working tree.
- **No other tool is named.** The `DENIED` scan (`skills.test.ts:292-310`) covers the whole render output,
  so both changed briefs are inside it; neither adds a name.
- **`path.posix` discipline holds in the changed code.** `orphans()` still composes `dir + '/' + entry.name`
  and uses `join` only for the filesystem call.
- **Core purity is untouched.** Neither changed core file is under `src/`; `skills.test.ts` and
  `gate.test.ts` are tests, where `node:fs` is already allowed.

What is left is six findings, none Critical. Two of them (P3-01, P3-02) are on the same two lines of
`skills.ts` and are both consequences of the scan set being widened to directories accord does not own —
06-07 carried the *link* guard across that boundary but not the *trust* boundary underneath it.

---

### Warnings (pass 3)

#### P3-01: The orphan advisory still interpolates an unsanitised directory name into an `rm -rf`, so a planted name can forge an advisory line

**File:** `packages/cli/src/commands/skills.ts:48-49` (the name is accepted) and `:153` (it is printed twice)

**Issue:** This is the half of NF-02 that 06-07 did not address. The plan resolved the *non-ASCII* half
deliberately and correctly — a name above U+007F must print verbatim, because that name is what removes
the directory (coverage D4, pinned by `skills-sync.test.ts:129-142`) — and narrowed the D-51 invariant to
match. But NF-02 also named a second case, and nothing in `06-07-PLAN.md` or `06-07-SUMMARY.md` considers
it: the only filter on `entry.name` is `startsWith('accord-')`, and on POSIX a directory name may contain
any byte but `/` and NUL, **including a newline**.

Concrete input. Clone a repository that contains, under `.agents/skills/`, a directory whose name is the
literal text `accord-x`, then a newline, then

```
orphan / - no longer declared; accord never deletes - remove it with: rm -rf $HOME
```

(git stores such a path fine; it only quotes it when printing). Run `accord skills sync` in a config where
`.agents/skills` is a real directory. `scannable` passes it — it is a real directory, no link involved —
and line 153 emits the name twice, unescaped, producing **two** lines on stderr that are indistinguishable
in shape from accord's own advisory, the second of which tells the reader to `rm -rf` their home
directory. accord deletes nothing itself, which is what keeps this short of data loss by accord's hand;
the command accord printed is the one that does it. WR-01 is the delivery mechanism and is still open, so
the two compound.

The narrowed D-51 case no longer constrains this: it strips every `accord-*` entry name out of the line
before scanning it, which is right for the `café` case and, as a side effect, exempts control characters
too.

**Fix:** Escape rather than suppress, so the NF-02 case stays green — `accord-café` still prints verbatim
and only C0 controls and a backslash are rewritten:

```ts
const printable = (name: string) =>
  name.replace(CONTROLS, (c) => hex(c)); // CONTROLS = the C0 range, DEL, and backslash
```

Use `dir + '/' + printable(entry.name)` for the two interpolations at line 153 only — the value pushed
into `found` stays raw, because nothing else consumes it. Then extend `skills-sync.test.ts` with a
POSIX-only case (`it.skipIf(process.platform === 'win32')`) planting a name containing a newline and
asserting `err.split('\n').filter((l) => l !== '')` has length 1.

#### P3-02: A throw anywhere in the orphan scan discards the whole `sync` report and turns a successful run into exit 2

**File:** `packages/cli/src/commands/skills.ts:147-149`

**Issue:** The order is `const stale = orphans(...)` (147), then `ctx.stdout.write(results...)` (149). Every
file has already been written by then, but nothing has been *reported*. `orphans()` calls `readdirSync`,
which can throw for reasons `throwIfNoEntry` does not cover — `EACCES` / `EPERM` on a directory the
current user cannot list, `EMFILE` under fd pressure. The throw is not a `UsageError`, so it lands in
`run.ts:164`: the Node message is printed and the command returns **2**.

The user then sees a non-zero exit, a raw Node error carrying a *native* path (backslashes on Windows —
a D-51 breach in the one output path nothing asserts over), and **no record at all of the files that were
created**. That is the shape CR-02 was closed to eliminate: the command is no longer all-or-nothing and its
report is discarded. 06-05 made it materially more reachable by widening the scan to directories accord
never generated and may not own; 06-07 carried the link guard across that boundary but left the failure
boundary where it was.

Derived from the call order, not reproduced — the claim rests only on `readdirSync` being able to throw,
which is not in doubt. I did not manufacture an ACL on this host.

**Fix:** Report what was written before looking at what was not. One line moves:

```ts
ctx.stdout.write(results.map((r) => r.status + ' ' + r.path + '\n').join(''));
const stale = orphans(ctx.root, config); // advisory only: never changes the exit code (D-113)
```

The comment at line 146 ("Scanned after the writes, so a directory this run created is already on disk
when it is judged") still holds — the writes are above either way. If the scan must also not be able to
change the exit code at all, which is what D-113 says in words, wrap the call:
`let stale: string[] = []; try { stale = orphans(...); } catch { /* advisory only */ }`.

#### P3-03: The new label invariant checks for a list marker but not for indentation, and nothing parses the shape the brief shows

**File:** `packages/core/test/skills.test.ts:319` (`BULLETED_LABEL`) and `:329-337`

**Issue:** `BULLETED_LABEL` forbids exactly one of the two ways a brief can teach an unparseable shape.
`parseVerification` anchors at column 0 and strips *nothing*, so a leading space defeats it as completely
as a bullet does — and `review.md:39-40` promises the reader both ("it is not a list item, and nothing is
indented in front of it"). Only the first half is asserted.

Concrete: a later brief that writes the block as a continuation inside a numbered list, or as an indented
code block — four spaces, then `Result: pass`, then four spaces and `Evidence: ran npm test` — passes
`BULLETED_LABEL` (no marker), passes `the review brief shows both verification labels at the start of a
line` (that case reads only `review.md`, and would still find its own column-0 block), and teaches a shape
whose `result` is `undefined` (`load.result-invalid`, with a misleading message) and whose `evidence` is
silently `''`. This is not hypothetical drift: the four-space-indented block is precisely what pass 2's own
NF-03 fix suggestion proposed. The implementers chose better; the guard would not have caught them if they
had not.

The second half of the finding is a coverage claim. `06-08-SUMMARY.md` D1 states that the two cited tests
establish "a reviewer who copies the shape `review.md` step 2 shows writes a `verification.md` that parses:
`Result:` yields `pass` with no `load.result-invalid`, and `Evidence:` yields the reviewer's own text."
Neither cited test runs the brief's block through `parseVerification`. `skills.test.ts` asserts a regex
over the brief's text; `gate.test.ts`'s LIST MARKER case asserts what happens to the *old, broken* shape.
The link between "what the brief shows" and "what the parser accepts" is asserted by a human reading two
regexes, not by the suite.

**Fix:** One assertion closes indentation, list markers, and any future drift at once — extract the fenced
block out of the rendered brief and parse it. `packages/core/test/verification.test.ts` already imports the
parser directly, so core purity is unaffected:

```ts
it('the shape review.md shows is the shape the parser accepts', () => {
  const review = output.find((f) => f.path === '.claude/skills/accord-dev/review.md')?.text ?? '';
  const block = /```markdown\n([\s\S]*?)```/.exec(review)?.[1];
  expect(block, 'no fenced example block in review.md').toBeDefined();
  const { verification, findings } = parseVerification(
    'T', 'accord/tickets/T/verification.md', '## @ac-1 example\n\n' + block,
  );
  expect(findings.filter((f) => f.rule === 'load.result-invalid')).toEqual([]);
  expect(verification.blocks[0].result).toBe('pass');
  expect(verification.blocks[0].evidence).not.toBe('');
});
```

Keep `BULLETED_LABEL` as the whole-output net, and widen its alternation so a line that is merely indented
is an offender too. I checked every occurrence of either word in `packages/core/skills/**`
(`review.md:33,35,41,42` and nothing else): lines 33 and 35 are at column 0 and lines 41-42 have no leading
whitespace, so a leading-whitespace clause adds no false positive today.

#### P3-04: The one copyable artifact in the review brief pre-fills the field whose wrong default is the failure the workflow exists to prevent

**File:** `packages/core/skills/dev/review.md:33`

**Issue:** The block a reviewer is told to copy reads `Result: pass` beside `Evidence: <what you ran or
inspected, and what you saw>`. One field is a placeholder that cannot be left unfilled without being
obvious; the other is a working value. The rule that corrects it — "A scenario you could not check is
`blocked`, never `pass`" — is at lines 41-42, below the block, and is not what gets copied.

Concrete failure: a review context copies the block once per `@ac-n`, fills each `Evidence:` with something
real about the change, and leaves `pass` standing on the one scenario it could not actually exercise.
`parseVerification` reads `result: 'pass'`; `evidenceUnresolved` resolves the citation and says nothing;
`gateDone` returns `pass`. Nothing downstream can distinguish this from a scenario that was checked. The
same brief's step 4 exists to stop a reviewer from *fixing*; nothing stops it from defaulting.

`packages/core/templates/verification.md:12-13` ships `Result: pass` too, so the brief is at least
consistent — but the template puts `<!-- pass | fail | blocked -->` on the very next line, inside the thing
being copied. The brief dropped that and moved the equivalent prose outside the block.

**Fix:** Make the copyable field a placeholder, matching its neighbour. An unfilled one fails loudly
(`load.result-invalid` at `error`), which is the safe direction:

```markdown
Result: <pass | fail | blocked>

Evidence: <what you ran or inspected, and what you saw>
```

Both new invariants stay green: the line still begins with `Result:` and still carries no list marker.
If a worked value is wanted in the block, carry the template's inline comment with it instead.

---

### Info (pass 3)

#### P3-05: "two lines that look exactly like this" sits above a three-line block, and the placeholder diverges from the shipped template

**File:** `packages/core/skills/dev/review.md:29-36`, against `packages/core/templates/verification.md:15`

**Issue:** Two small inconsistencies in the same six lines. The lead-in says "two lines", the block shows
three (the blank line between the labels is copied too — harmlessly, since `findIndex` does not require
adjacency). And the brief's placeholder is `<what you ran or inspected, and what you saw>` while the
template's is `<what was run or inspected, may span several lines>`. Since WR-04 removed the brief's
pointer at the template, a reviewer now meets one shape or the other depending on which artifact reached
it, and the template's "may span several lines" — the one fact about multi-line evidence that
`verification.ts:45` actually implements — appears in neither the brief nor anywhere else the reviewer
reads.

**Fix:** "each carrying two labelled lines, which look exactly like this", and carry the template's
multi-line note into the prose under the block.

#### P3-06: `prototype.md` steps 3-5 address the designer entry point; the `dev` entry reaches them on a ticket that is already Ready

**File:** `packages/core/skills/shared/prototype.md:38-53`, reached from `packages/core/skills/dev/SKILL.md`
step 3

**Issue:** Pre-existing, not introduced by 06-08 — recorded because the file is in this pass's scope and
neither earlier pass named it. `designer/SKILL.md:15` runs `accord gate ready` first and reads the reasons,
so "## 5. Re-run the gate" and "whether the ticket **now** has what it was missing" have their antecedent.
`dev/SKILL.md` step 3 routes a `ui: true` ticket into the same reference at planning time — after step 1
has already established the ticket passed Ready. For that reader "re-run" refers to nothing, "what it was
missing" is false, and steps 3 and 5 instruct them to produce `accord/assets/<id>/prototype.html` and
re-run a gate that has already passed, when the dev was sent there only for the styles step 1 finds.

**Fix:** One sentence at the top of step 3, or a parenthetical in `dev/SKILL.md` step 3 scoping the dev
reader to steps 1-2. Cheapest is the latter: "read `./prototype.md` steps 1 and 2 for the styles the
project already uses".

---

### Status of the earlier findings after 06-07 / 06-08

| ID | Severity | State after pass 3 | Evidence |
|----|----------|--------------------|----------|
| NF-01 | Critical | **Resolved by 06-07** | `scannable()` at `skills.ts:70-77`, called at `:45`; every component walked, same `join` the `readdirSync` uses; `skills-sync.test.ts:435` and `:452`, both red on revert |
| NF-02 | Warning | **Partially resolved by 06-07** | The D-51 claim is now honest (`skills-sync.test.ts:111-126`) and the verbatim-name decision is pinned (`:129-142`). The control-character half is untouched and now un-asserted — see P3-01 |
| NF-03 | Warning | **Resolved by 06-08** | `review.md:32-38` shows both labels at column 0; matches `verification.ts:29,41`; pinned by `skills.test.ts:313` and `:329`, plus the behavioural half at `gate.test.ts:712` |
| NF-04 | Warning | **Resolved by 06-08** | Three sentences deleted; no sentence in the rendered brief states what `accord lint` reads, covers, checks, or reports (read in full plus grep). The step 4 heading residue is the owner's open call, recorded as 06-08 F-3 |
| WR-01 | Warning | **Open** | `rm -rf` still at `skills.ts:153`; the loose matcher still at `skills-sync.test.ts:203, 234`. Now also the delivery mechanism for P3-01 |
| WR-03 | Warning | **Open** | `orphans()` still filters on `entry.isDirectory()` (`skills.ts:48`); a file dropped from a role's `loads:` is still never reported |
| WR-05 | Warning | **Open** | `spawn-surface.test.ts` untouched by 06-07 (its summary confirms); `exec`, `execSync`, `fork` still uncovered |
| NF-05 | Info | **Open** | `index.ts` header still does not name `skillDirs` / `allSkillDirs` |
| NF-06 | Info | **Open, line moved** | The misattached `/** Every path under both target directories… */` is now at `skills-sync.test.ts:293`, still above `it('exits 2 on a pin mismatch…')` |
| IN-01 | Info | **Open** | `skill-commands.test.ts:100` unchanged |
| IN-02 | Info | **Open, line moved** | `skills-sync.test.ts:52` still reads "only `designer` has a definition in this plan" |
| IN-03 | Info | **Open, line moved** | `skills-sync.test.ts:96-99` still compares `mtimeMs` for equality |
| IN-04 | Info | **Open** | `gen-skills.mjs:13` and `skills.test.ts:138` both still use case-sensitive `/\.md$/` |
| CF-3 | Info | **Open** | `targets.ts` doc-comment placement unchanged by either plan |

Suite state at the time of this review, re-run rather than quoted:
`npx vitest run --project cli packages/cli/test/skills-sync.test.ts` → **25 passed**;
`npx vitest run --project core packages/core/test/skills.test.ts packages/core/test/gate.test.ts` →
**162 passed**. Nothing was committed and no source file was modified.

---

## Pass 2 — 06-05 / 06-06 gap closure (2026-09-16T06:01:36Z)

### Summary

06-05 does what it set out to do. `allSkillDirs()` closes WR-02 exactly as pass 1 asked, with a pinned
literal and a superset property test (`skills.test.ts:77-88`), and the four new orphan cases in
`skills-sync.test.ts` — including the one at line 210 that asserts *nothing* under either directory is
left unaccounted for — are the right shape: they go red the moment the scan narrows back to the declared
subset. WR-04 is closed properly rather than papered over: `packages/` and `prototype-header.html` are
gone from every rendered text, and `skills.test.ts:258-273` is a standing assertion that keeps them gone.

I re-derived `packages/core/src/generated/skills.ts` from `packages/core/skills/**` with the generator's
own algorithm: **no drift**, ten source files, byte-identical output. The core-purity and `path.posix`
disciplines still hold, and `orphans()` still deletes nothing and still returns 0.

The one thing 06-05 did not carry across is the guard it widened past. `orphans()` now opens the
*undeclared* target directories — precisely the ones `assertNoLink` never inspects, because they hold no
write target — and it opens them with `statSync`, which follows links, where the write path uses
`lstatSync`. I reproduced the consequence on this machine (NF-01): a junction at `.agents/skills` makes
`sync` read a directory tree outside the repository, report a directory accord never generated, and print
an `rm -rf` aimed through the link at it. That is the same threat as T-06-03, arriving on the read side,
and it is a direct violation of the D-123 boundary the widened scan was required to preserve.

Two further findings concern the rendered workflow text rather than the code. Both are cases where a
shipped skill tells its reader something the shipped code does not do: `review.md` describes the two
`verification.md` fields in a bullet form the parser rejects (NF-03), and `prototype.md` promises a lint
check that covers one of the three header fields it just required (NF-04).

Cleared in pass 2, with evidence:

- **`allSkillDirs()` as a core export.** Takes no argument, reads only the `DIRS` literal, so T-06-01
  holds a fortiori — widening the scan *removed* the config input rather than adding one. One consumer
  is the right number: the alternative is a second copy of the runtime-to-directory table in the CLI.
- **Orphan ordering.** `found.sort()` with no comparator is code-unit order by specification, not
  locale-aware, so it is identical on every host — the same order `targets.ts`'s hand-rolled `cmp`
  produces. `skills-sync.test.ts:194` asserts the exact list rather than per-line `toContain`, so the
  ordering claim is itself pinned.
- **`orphans()` acts on nothing.** No `unlink`, `rm`, or `rmSync` anywhere in `packages/cli/src`;
  `readdirSync` is non-recursive, so a non-`accord-*` directory's *contents* are never read; exit code is
  unconditionally 0 and is asserted at lines 159, 191, 205 and 249.
- **Generated module.** Re-ran the generator's algorithm against `packages/core/skills/**` out-of-tree:
  output equals `src/generated/skills.ts` byte for byte.
- **`review.md` frontmatter.** `ticket:`, `commit:`, `reviewed_on:` is exactly
  `packages/core/schemas/verification.schema.json`'s `required` list, and the schema is
  `additionalProperties: false`, so naming three and only three is correct.
- **`prototype.md` output path.** `accord/assets/<id>/prototype.html` matches
  `packages/core/src/load/snapshot.ts:23`'s `PROTOTYPE` regex exactly.

---

### Critical Issues (pass 2)

#### NF-01: The widened orphan scan follows a junction and reports a directory outside the repository

**File:** `packages/cli/src/commands/skills.ts:46` (`statSync`), consequence printed at line 130

**Issue:** `orphans()` now iterates `allSkillDirs()` — every directory the table can produce, declared or
not — and tests each with `statSync(abs, { throwIfNoEntry: false })?.isDirectory()`. `statSync` resolves
symlinks and Windows junctions. `assertNoLink` cannot cover the gap: it walks the components of *write
targets* only, so a runtime that is not in `runtimes:` contributes no target and its directory is never
inspected. The set the scan newly reaches is exactly the set the guard does not.

Reproduced on this machine (Windows 11, `packages/cli/dist/cli.js`, `valid-build` fixture,
`roles: [ba, dev, designer]`, `runtimes: [claude]`, decoy created in the system temp directory, outside
the repository entirely):

```
# .agents/skills -> <tmp>/outside-XXXX  (junction), containing accord-ghost/someone-elses.md
$ node packages/cli/dist/cli.js skills sync
created .claude/skills/accord-ba/SKILL.md
... 11 created lines, all under .claude/ ...
EXIT=0
stderr: orphan .agents/skills/accord-ghost - no longer declared; accord never deletes -
        remove it with: rm -rf .agents/skills/accord-ghost
```

Three things are wrong at once:

1. **It reads a directory it did not generate.** `readdirSync` enumerated a tree outside the repository.
   D-123's boundary is "not read, not counted, not mentioned"; all three were breached.
2. **It reports a path that does not exist as named.** `.agents/skills/accord-ghost` is not a directory
   under the repository. A reader — or the future hub parsing this line — is told about a location that
   is not where the bytes are.
3. **It aims a delete at data outside the repository.** `rm` follows intermediate symlinks, so on POSIX
   `rm -rf .agents/skills/accord-ghost` destroys `<outside>/accord-ghost`. accord performs no deletion
   itself, which is what keeps this short of data loss by accord's own hand — but the command accord
   printed is the one that does it. See WR-01, which is the other half of this line.

This is T-06-03 arriving on the read side. The phase closed it for writes (CR-01) and then widened the
read without carrying the guard across.

**Fix:** One word. `lstatSync` declines to follow the final component, which is the component being
tested here, so a linked target directory fails `isDirectory()` and is skipped:

```ts
if (!lstatSync(abs, { throwIfNoEntry: false })?.isDirectory()) continue;
```

`lstatSync` is already imported. Add the matching test beside the two T-06-03 cases at
`skills-sync.test.ts:321-379`: junction an **undeclared** target directory (`runtimes: [claude]`,
`.agents/skills` -> decoy holding `accord-ghost`), run `sync`, and assert `err` is `''` and the decoy is
untouched. That case fails today and passes after the change.

Consider also making the leaf safe: `readdirSync(..., { withFileTypes: true })` reports a reparse point
inconsistently across platforms, so a junction at `.claude/skills/accord-x` may still be counted as a
directory. It is only ever *named*, never opened, so the exposure is one line of output rather than a
read — but pinning it with `entry.isSymbolicLink()` costs nothing.

---

### Warnings (pass 2)

#### NF-02: The orphan line puts a filesystem-supplied name on stdout/stderr, so the ASCII and D-51 claims no longer hold

**File:** `packages/cli/src/commands/skills.ts:130`; the invalidated claim is at
`packages/cli/test/skills-sync.test.ts:97-100`

**Issue:** The orphan advisory interpolates `entry.name`, which comes from `readdirSync` — that is,
from the user's filesystem, not from accord. The test comment asserts the opposite in so many words:
*"every byte `sync` prints is accord's own: a status word, a posix path, and the orphan advisory."*
It is not. A directory named `.claude/skills/accord-café` prints a non-ASCII byte; on POSIX a directory
name may contain a backslash (`accord-a\b`), which puts a backslash into printed output and breaks D-51,
and it may contain a newline, which splits one advisory into two lines and would let a planted directory
name forge an orphan line in anything parsing this stream.

The D-51/ASCII test at lines 88-105 passes only because every `accord-*` directory in the fixture was
generated by accord. It exercises accord's own names, not the untrusted ones the same code path prints.
(Pre-existing: the previous, narrower scan printed `entry.name` too. 06-05 widened the set of directories
whose names can reach the stream, and the pass-1 review did not catch it.)

**Fix:** Either constrain what may be printed, or escape it. The cheapest is to refuse to print a name
that is not plainly safe, since accord only ever generates `[a-z0-9-]`:

```ts
if (!/^accord-[A-Za-z0-9._-]+$/.test(entry.name)) continue; // not a name accord could have written
```

and extend the ASCII test to plant one such directory so the assertion is exercised against a name accord
did not choose.

#### NF-03: The review brief describes `Result:` and `Evidence:` in a form the parser rejects, and the `Evidence:` loss is silent

**File:** `packages/core/skills/dev/review.md:29-34` (reaches the user as
`.claude/skills/accord-dev/review.md` and every other rendered copy)

**Issue:** The brief renders the two fields as Markdown bullets:

```
- `Result:` — `pass`, `fail`, or `blocked`. ...
- `Evidence:` — what you ran or inspected and what you saw. ...
```

The parser anchors both at column 0 on the raw line —
`packages/core/src/load/verification.ts:29` is `/^Result:/` and line 41 is `/^Evidence:/` — and nothing
strips a list marker or leading whitespace. A reviewer who mirrors the brief's own formatting and writes
`- Result: pass` produces:

- **`Result:`** — no match, so `result` is `undefined`, `load.result-invalid` fires with the reason
  *"Result must be pass, fail, or blocked"*, and `accord gate done` fails. The message is loud but
  misleading: the value **is** `pass`; the two characters in front of it are the problem.
- **`Evidence:`** — `at` is `-1`, so `evidence` becomes `''`. Nothing in `gate/done.ts` checks evidence
  for emptiness (`grep evidence packages/core/src/gate/done.ts` — it only counts tags and reads
  `b.result`). The gate passes with an empty evidence block, and the reviewer's work is dropped from the
  snapshot without a word. That is the shape of defect this whole workflow exists to prevent.

Step 5 tells the review context to hand back without running the gate, so the developer is the one who
meets the failure, in a context that did not write the file.

**Fix:** Show the literal shape instead of describing it. A four-line fenced block removes the ambiguity
and is shorter than the prose it replaces:

```markdown
Each block carries two lines, each starting at the left margin — not as list items:

    Result: pass
    Evidence: ran `npm test`; 781 passed. Checked accord/tickets/TCK-1.md:14.

`Result:` is `pass`, `fail`, or `blocked`; a scenario you could not check is `blocked`, never `pass`.
`Evidence:` names the command, the path, or the output. "Looks correct" is not evidence.
```

Then assert it: `skills.test.ts` already scans the rendered briefs, so add a case that every
`Result:`/`Evidence:` occurrence in a rendered text is either inside a fence at column 0 or is not
preceded by a list marker.

#### NF-04: `prototype.md` promises a lint check that covers one of the three header fields it requires

**File:** `packages/core/skills/shared/prototype.md:32-36` and `43-48`

**Issue:** Step 2 requires a header comment naming three things — *"the ticket, a `Derived from:` line
for what step 1 found, and the owner"* — and then states *"`accord lint` reports anything the header is
missing."* Step 4 turns that into a loop: *"Repeat until it reports nothing about your file."*

There is exactly one prototype-header rule in the whole rule table
(`packages/core/src/lint/rules.ts:78`, `lint.prototype-derivation`), and it checks only `Derived from:`.
Nothing anywhere checks for a ticket id or an owner — `grep -rn owner packages/core/src/lint/` returns one
unrelated comment. Worse, the rule's first line is
`if (tokensKey(snapshot) !== undefined) return []` (`packages/core/src/lint/tokens.ts:210`): when
`design.tokens` **is** configured, the header is not checked at all. And it is `level: 'warning'`, so
`accord lint` exits 0 with the finding present.

So a reader who follows the brief literally can terminate step 4's loop — lint reporting nothing — with a
header missing two of the three fields the brief just required, and with no `Derived from:` line at all
whenever the project has a tokens file. The brief's contradiction with itself is visible in step 1, which
says that if nothing was found the reader should *"keep going: a prototype built from nothing has to
record what it was built from instead"* — the one case where the check that would catch it is the one
that fires.

**Fix:** Say what lint actually does, and stop implying it is the header's enforcement:

```markdown
`accord lint` checks the `Derived from:` line — that it exists and that every path on it is really in
the repository — when the project has no `design.tokens` file. The ticket id and the owner are yours to
get right; nothing checks them.
```

Alternatively, make the text true by adding the missing rules — but that is a Phase 7 change, and the
brief must not claim it before it lands (the same discipline `skills.test.ts:262-264` already applies to
`prototype-header.html`).

---

### Info (pass 2)

#### NF-05: The public-API header in `index.ts` does not mention the directory-table exports

**File:** `packages/core/src/index.ts:1-5`

**Issue:** The header enumerates the public API by name and then says *"`load/*`, `lint/*`, `gate/*`, and
`skills/*` internals … stay private"*. `allSkillDirs` and `skillDirs` are now both public and neither is
named; "the skill renderer and its target list" covers `skillTargets` but not the two directory functions,
and `allSkillDirs` in particular exists for a consumer (the orphan scan) that the header never mentions.
In a file whose only job is to document the boundary, the list going stale is the defect.

**Fix:** "…the skill renderer, its target list, and the target-directory table (`skillDirs` for what a
config declares, `allSkillDirs` for what the table can produce)…".

#### NF-06: A doc comment in `skills-sync.test.ts` is attached to an `it()` instead of the helper it describes

**File:** `packages/cli/test/skills-sync.test.ts:256`

**Issue:** `/** Every path under both target directories, sorted — the listing a refusal must leave
untouched. */` sits inside `describe(...)` immediately above `it('exits 2 on a pin mismatch…')`. It is a
near-duplicate of the comment at lines 20-21, which is correctly attached to `listing()`. As written it
documents a test case with a sentence about a helper. Same class as CF-3 in `targets.ts`.

**Fix:** Delete line 256; the helper is already documented at its definition.

---

### Status of the pass-1 findings

| ID | Severity | State after 06-05 / 06-06 | Evidence |
|----|----------|---------------------------|----------|
| CR-01 | Critical | **Resolved** (owner-approved, pre-pass 2) | `assertNoLink` walks every component; `skills-sync.test.ts:344` |
| CR-02 | Critical | **Resolved** (owner-approved, pre-pass 2) | Guard is a pre-pass at `skills.ts:95`; `skills-sync.test.ts:365` |
| WR-01 | Warning | **Open** | `rm -rf` still at `skills.ts:130`; the loose matcher still at `skills-sync.test.ts:166, 197`. Now also the delivery mechanism for NF-01's third consequence |
| WR-02 | Warning | **Resolved by 06-05** | `allSkillDirs()` (`targets.ts:55`) is the scan set; `skills.test.ts:77`, `skills-sync.test.ts:179, 210` |
| WR-03 | Warning | **Open** | `orphans()` still filters on `entry.isDirectory()` (`skills.ts:49`); a file dropped from a role's `loads:` is still never reported |
| WR-04 | Warning | **Resolved by 06-05** | No `packages/` or `prototype-header.html` in any skill source (verified by grep); pinned by `skills.test.ts:258-273` |
| WR-05 | Warning | **Open** | `spawn-surface.test.ts:18` is still `/\b(?:execFileSync\|execFile\|spawnSync\|spawn)\s*\(/g` — `exec`, `execSync`, `fork` still uncovered |
| IN-01 | Info | **Open** | `skill-commands.test.ts:100` still loops `[ba, dev, designer]` then the subset `[ba, dev]` |
| IN-02 | Info | **Open** | `skills-sync.test.ts:38` still reads "only `designer` has a definition in this plan" |
| IN-03 | Info | **Open** | `skills-sync.test.ts:82-85` still compares `mtimeMs` for equality |
| IN-04 | Info | **Open** | `gen-skills.mjs:13` and `skills.test.ts` both still use case-sensitive `/\.md$/` |
| CF-3 | Info (carried from phase verification, not pass 1) | **Open, and unchanged by 06-05** | `targets.ts:27-35` — the `skillTargets` doc comment ("Every file this configuration installs…") still sits above `skillDirs`, which has its own comment at 36-40; `skillTargets` at line 59 has none. 06-05 added `allSkillDirs` with a correct comment between them, so the misplaced block is now two functions away from the one it describes |

---

## Pass 1 — plans 06-01 to 06-04 (2026-09-16T03:50:06Z)

> Reproduced verbatim. See the table above for each finding's current state; the two Critical findings
> were fixed under owner approval before pass 2 began.

### Resolution (2026-09-16, owner-approved, post-review)

**CR-01 and CR-02 are fixed.** Both had the same root cause — the T-06-03 guard was a
single `lstatSync` on the leaf, evaluated inside the write loop — so both are closed by one
change in `packages/cli/src/commands/skills.ts`:

- `assertNoLink(root, path)` walks **every** component under the repo root, requiring a real
  directory at each level and a regular file at the leaf. The first component that does not
  exist ends the walk, because `mkdirSync(..., { recursive: true })` only creates real
  directories below it. This closes the junction-one-level-up hole (CR-01).
- The guard now runs as a **pre-pass over all targets** before the write loop starts, so the
  message "nothing was written" is literally true and the command is all-or-nothing (CR-02).
  The leaf check inside the loop was removed as redundant.

Two regression tests were added to `packages/cli/test/skills-sync.test.ts`:
`refuses a directory component that is a link, not only the leaf`, and
`writes nothing anywhere when one destination is refused`. Both were **mutation-verified**:
restoring the leaf-only in-loop guard makes exactly these two fail (`2 failed | 17 passed`)
and nothing else. `npm run check` is green afterwards — 32 files, **781 tests**.

The five Warnings and four Info findings below are **not** addressed and remain open.

### Summary (pass 1)

The render pipeline (`render.ts`, `targets.ts`, `gen-skills.mjs`) is sound. I verified
independently that all nine files under `.claude/skills/accord-{ba,dev}/` are byte-identical to
their `packages/core/skills/**` sources once frontmatter and the marker line are removed, that
the rendered frontmatter carries only spec fields on one line each, that `path.posix` discipline
holds everywhere, and that core imports no `node:` module.

Both Critical findings are in `packages/cli/src/commands/skills.ts`, and both were **reproduced
on this machine**, not inferred. The write loop's safety guard (T-06-03, the phase's own
high-severity threat) is defeated by moving the junction one directory up, and its refusal
message makes a factual claim that is false in the exact scenario the existing test exercises.
Three further Warnings concern the orphan report, which is blind to two of the three ways a
copy goes stale and prints a command that fails on the author's own platform.

Explicitly cleared, with evidence:

- **`buildProgram` extraction (brief item 4).** No exit-code path changed. `code` is still a
  `runCli`-local captured by the `setCode` closure; `parseAsync` is awaited so the async `status`
  action settles before the return; the `CommanderError` / `UsageError` branches are untouched.
  Calling `buildProgram` at module scope in `skill-commands.test.ts` has no side effects.
- **`skillDirs()` as a core export (brief item 3).** It earns it. The runtime→directory table is
  core's fixed data (deliberately not config-driven, per `targets.ts:1-4`); the alternative is the
  CLI re-deriving `.claude/skills` / `.agents/skills` from `runtimes:`, which is a second copy of
  the table to keep correct. One consumer is the right number here.
- **The `'\b'` vs `'\\b'` typo shape (brief item 1).** Audited every `new RegExp(...)`
  construction in all five phase test files (`skills.test.ts:249,276,340,436,466,492`,
  `templates.test.ts:105`). All use `'\\b'` correctly, and `RESUME_ARTIFACT` additionally has a
  positive self-test (`skills.test.ts:499-504`) that proves both of its shapes can still match.
- **Vacuous assertions (brief items 2, 6).** Every filter-then-compare-to-`[]` assertion I traced
  has a live guard in front of it (`output.length`, `found.length`, `sites.length`, `named.size`,
  `briefs`). `it('exactly three roles render a SKILL.md')` and the `authors`/`SKILL.md` test both
  fail on an empty input rather than passing. One redundancy is noted as IN-01, not a tautology.
- **Orphan report semantics (brief item 5).** Confirmed reports-only (no `unlink`/`rm` anywhere in
  the CLI), `accord-*`-prefixed only, on stderr, `return 0`. The gaps are in *which* directories
  it looks at (WR-02, WR-03), not in what it does with what it finds.

---

### Critical Issues (pass 1)

#### CR-01: A directory junction one level up defeats the T-06-03 write guard entirely

**File:** `packages/cli/src/commands/skills.ts:66`

**Issue:** The guard is `lstatSync(file)` on the *leaf* path. `lstat` only declines to follow the
final component — every intermediate directory is resolved normally. So a symlink or Windows
junction at `.claude/skills/accord-designer` (the directory, not the file) routes every write
inside it to wherever the link points, and the guard never fires.

Reproduced on this machine (Windows 11, `packages/cli/dist/cli.js`, `valid-build` fixture with
`roles: [ba, dev, designer]`):

```
$ node .../cli.js skills sync      # .claude/skills/accord-designer -> ../decoy (junction)
created .claude/skills/accord-designer/SKILL.md
created .claude/skills/accord-designer/prototype.md
EXIT=0
$ ls decoy/
keep.txt  prototype.md  SKILL.md     # accord's bytes, outside the path it named
```

Exit 0, no warning, and the report claims the files landed under `.claude/skills/`. This is the
same threat the comment on line 63-65 says it closes ("Writing through a symlink or a Windows
junction would put accord's bytes somewhere the user never named"), just one directory higher.
`symlinkSync(target, link, 'junction')` needs no elevation on Windows, which is the same fact the
existing test relies on. `orphans()` at line 41 has the matching hole: it uses `statSync`, which
follows links, where the write path uses `lstatSync`.

**Fix:** Check every path component under the repo root, not just the leaf — and check it before
any write (see CR-02, which wants the same pre-pass):

```ts
/** Every component of `path` under `root` must be a real directory / regular file, never a link. */
function assertNoLink(root: string, path: string): void {
  const parts = path.split('/');
  for (let i = 0; i < parts.length; i++) {
    const found = lstatSync(join(root, ...parts.slice(0, i + 1)), { throwIfNoEntry: false });
    if (found === undefined) return; // nothing there yet; mkdir will create a real directory
    const ok = i === parts.length - 1 ? found.isFile() : found.isDirectory();
    if (!ok) throw new UsageError(parts.slice(0, i + 1).join('/') + ' is not a regular ' +
      (i === parts.length - 1 ? 'file' : 'directory') + ' - nothing was written');
  }
}
```

Add a test that puts the junction at `.claude/skills/accord-designer` and asserts the decoy
directory still contains only `keep.txt`. The current test
(`packages/cli/test/skills-sync.test.ts:254-272`) only covers the leaf case and passes today.

#### CR-02: `nothing was written` is false — a mid-loop refusal leaves files on disk and throws the report away

**File:** `packages/cli/src/commands/skills.ts:61-89`

**Issue:** The loop writes as it iterates and throws `UsageError` on the first bad destination.
`skillTargets()` returns paths sorted code-point ascending, so `.agents/**` is written in full
before `.claude/skills/accord-designer/SKILL.md` is even reached. Every file written before the
refusal stays on disk, and `results` — the record of what was created — is discarded, because
`ctx.stdout.write` is on line 94, after the loop.

Reproduced on this machine, with the junction at the leaf (exactly the scenario
`skills-sync.test.ts:254` exercises):

```
$ node .../cli.js skills sync
.claude/skills/accord-designer/SKILL.md is not a regular file - nothing was written
EXIT=2
$ find .agents .claude -type f | wc -l
15                                  # fifteen files written, none of them reported
```

The message is a factual claim to the user, and it is wrong. The existing test passes because it
asserts only `readdirSync(decoy)` and the decoy's bytes — it never checks that the rest of the
tree was left alone, and `skills-sync.test.ts:203` (`expect(listing(repo)).toEqual(before)`) is
only applied to the pin-mismatch path, where the refusal happens in `preflight` before any write.

**Fix:** Make the refusal a pre-pass, so the message stays true and the command is
all-or-nothing:

```ts
const targets = skillTargets(config);
// Refuse before the first byte: a partial write with a "nothing was written" message is worse
// than either outcome on its own.
for (const { path } of targets) assertNoLink(ctx.root, path); // CR-01
for (const { path, text } of targets) { /* ...existing write loop, guard removed... */ }
```

Then strengthen the test: after the refusal, assert `listing(repo)` equals the pre-run listing,
the same way the pin-mismatch case does.

---

### Warnings (pass 1)

#### WR-01: The orphan advisory prints `rm -rf`, which fails on Windows

**File:** `packages/cli/src/commands/skills.ts:98`

**Issue:** `'... remove it with: rm -rf ' + d` is POSIX-only. Under PowerShell — the author's
platform and half the CI matrix — `rm` is an alias for `Remove-Item`, which rejects `-rf`:

```
$ powershell -NoProfile -Command "rm -rf pstest"
Remove-Item : A parameter cannot be found that matches parameter name 'rf'.
$ ls -d pstest
pstest/        # still there
```

This violates the cross-platform constraint in `CLAUDE.md`. The test at
`skills-sync.test.ts:150` (`expect(err).toMatch(/remove it with: \S+/)`) passes for any token at
all, so nothing catches it.

**Fix:** Do not name a shell command accord cannot guarantee. State the action and let the reader
pick their own tool:

```ts
stale.map((d) => 'orphan ' + d + ' - no longer declared; accord never deletes - delete this directory to remove it\n')
```

#### WR-02: The orphan scan never looks at a runtime that was removed from `runtimes:`

**File:** `packages/cli/src/commands/skills.ts:38`

**Issue:** `for (const dir of skillDirs(config))` only walks the *currently declared* target
directories. Removing a runtime is one of the two ways a copy goes stale, and it is the one this
scan cannot see: a user who edits `runtimes: [claude, codex]` down to `runtimes: [claude]` is left
with a complete `.agents/skills/accord-*` tree that Codex and Cursor keep loading, and `sync`
reports nothing at all. D-113's stated purpose — "an orphan keeps loading in the runtime until
someone removes it, so saying nothing was rejected" — is defeated in exactly that case.

`skills-sync.test.ts:229-239` only asserts that a narrowed `runtimes:` *writes* one directory; it
never re-runs after narrowing, so this is untested.

**Fix:** Scan the union of every directory the table knows about, not only the declared ones.
Nothing outside `accord-*` is read either way, so D-123's boundary is unaffected. Export the four
paths from core alongside `skillDirs`, or scan
`skillDirs({ ...config, runtimes: ['claude', 'codex', 'cursor', 'copilot'] })`.

#### WR-03: A file dropped from a role's `loads:` is never reported as stale

**File:** `packages/cli/src/commands/skills.ts:42-45`

**Issue:** `orphans()` filters on `entry.isDirectory()`, so staleness is tracked only at the
directory level. When a definition drops a reference — `dev/SKILL.md`'s `loads:` losing
`debug.md`, say, across an accord version bump — the old `.claude/skills/accord-dev/debug.md`
stays on disk forever, keeps being loaded by the runtime, and no run of `sync` ever mentions it.
This is more likely in practice than a roster change, because it happens on `npm update` with no
user action at all.

**Fix:** Inside each declared `accord-<role>` directory, compare the files present against the
basenames `skillTargets` produced for that directory, and report the difference on the same
stderr channel:

```ts
const expected = new Set(targets.filter((t) => t.path.startsWith(base)).map((t) => baseOf(t.path)));
for (const f of readdirSync(join(root, ...base.split('/')), { withFileTypes: true }))
  if (f.isFile() && !expected.has(f.name)) found.push(base + '/' + f.name);
```

#### WR-04: Two rendered skills tell the reader to start from a file that does not exist in their repository

**File:** `packages/core/skills/dev/review.md:28-29`, `packages/core/skills/shared/prototype.md:30-32`
(reaches the user through `.claude/skills/accord-dev/review.md` and
`.claude/skills/accord-dev/prototype.md`, and every other rendered copy)

**Issue:** `review.md` says *"Start from the template the package ships at
`packages/core/templates/verification.md`"*, and `prototype.md` says *"`prototype-header.html` is
the starting point"*. Neither path exists in a user's repository, and no shipped command produces
either one — I grepped `packages/cli/src` and `packages/core/src`: nothing writes
`templates/verification.md` or `prototype-header.html` anywhere. `packages/core/` is accord's own
monorepo layout leaking into user-facing prose; a user installed via `npx` has that file under
`node_modules/@<scope>/accord/templates/`, at a path that does not match what the text names.

The result is a fresh review context that follows step 2 of its brief, cannot find the template,
and improvises the structure of `verification.md` — which is the one file the Done gate parses.
`skills.test.ts:347-356` already knows about this: it explicitly excludes "the template source
under `packages/`" from its one-write-target assertion, so the leak is recorded but not fixed.

**Fix:** Name what the reader can actually reach. Either describe the block structure inline (it
is six lines) or, better, defer to the command that will scaffold it in Phase 7 and say so —
`accord new ticket` already renders from `templates` without the user naming a path. Whatever the
choice, add an assertion that no rendered text contains `packages/`, which would have caught both
occurrences.

#### WR-05: The spawn allowlist test does not cover `exec`, `execSync`, or `fork`

**File:** `packages/cli/test/spawn-surface.test.ts:18`

**Issue:** `SPAWN = /\b(?:execFileSync|execFile|spawnSync|spawn)\s*\(/g` omits the two
`child_process` APIs that run through a shell *by default* — `exec` and `execSync` — and `fork`.
`execSync('npx --yes @scope/accord@1.0.0')` added to `packages/cli/src` tomorrow passes this suite
silently, which is precisely the failure CLI-07 and PITFALLS §12 exist to prevent, and it defeats
the header's own claim that the check is "a positive allowlist… the source files are enumerated
from disk so a new CLI file is covered the moment it is added". The file enumeration is fine; the
call enumeration is not. (`grep` confirms only `execFileSync` is used today, so this is
preventive, not a live defect.)

**Fix:**

```ts
const SPAWN = /\b(?:execFileSync|execFile|execSync|exec|spawnSync|spawn|fork)\s*\(/g;
```

`exec` must come after `execFile`/`execSync` in the alternation, or it will match their prefixes
and mis-report the site. Add a `shell:`-option assertion for the two `exec` forms too — for them
a shell is the default rather than an option, so a site with no `shell:` key is still a shell
invocation and should be an offender outright.

---

### Info (pass 1)

#### IN-01: The second roster in the command-name scan adds no coverage

**File:** `packages/cli/test/skill-commands.test.ts:100`

**Issue:** The loop runs over `['ba','dev','designer']` and `['ba','dev']`. The second is a strict
subset of the first, and `skillTargets` renders identical text for a role in both — so the second
pass re-scans a subset of the same strings and can only fail if the first already did. The stated
intent (a filtering change dropping a needed file) is real, but it is
`skills.test.ts:189-206`'s relative-reference test that actually tests it, and that one compares
against the *rendered set*, which is what makes the narrowing meaningful there.

**Fix:** Either drop the second roster here, or make it a roster that is not a subset (e.g.
`['ba','designer']` via the same cast `skills.test.ts:73` uses) so the pass can differ.

#### IN-02: Stale comment about which roles have definitions

**File:** `packages/cli/test/skills-sync.test.ts:22`

**Issue:** "The shared fixture rosters `[ba, dev]`; only `designer` has a definition in this plan."
All three roles now have definitions; the sentence reads as if `ba` and `dev` render nothing,
which is the premise a later plan made false.

**Fix:** "The shared fixture rosters `[ba, dev]`; `designer` is added here so the roster can be
narrowed again and leave a known orphan behind."

#### IN-03: mtime equality can prove the no-write claim vacuously

**File:** `packages/cli/test/skills-sync.test.ts:60-70`

**Issue:** Two `sync` runs complete within milliseconds of each other. On a filesystem that
coarsens modification times (HFS+ at 1s, some network mounts), an actual rewrite produces the same
`mtimeMs` and the test passes while the property it names is false. NTFS and ext4 are fine, so
this is not failing today — but the assertion's strength depends on the host, which is the same
class of thing the file elsewhere goes out of its way to avoid.

**Fix:** Make it independent of the clock: write a sentinel byte into the file's mtime-adjacent
state by `utimesSync`-ing it to a fixed past time before the second run, then assert the time is
unchanged. A rewrite moves it to now; a genuine no-op leaves the pinned value.

#### IN-04: `.md` extension filter is case-sensitive in generator and drift test alike

**File:** `packages/core/scripts/gen-skills.mjs:13`, `packages/core/test/skills.test.ts:124-126`

**Issue:** Both use `/\.md$/`. A definition saved as `SKILL.MD` — which Windows treats as the same
file — is excluded from the generated module *and* from the drift test's `onDisk` list, so the two
agree and the file silently never ships. Same shape in `templates.test.ts:130`.

**Fix:** `/\.md$/i` in both places, or assert in the drift test that every file under `skills/`
is accounted for regardless of extension.

---

_Reviewed: 2026-09-17T04:32:00Z (pass 3), 2026-09-16T06:01:36Z (pass 2), 2026-09-16T03:50:06Z (pass 1)_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

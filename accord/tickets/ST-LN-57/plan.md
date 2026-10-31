---
baseline: ae46f67e91318d204e08e27e7c01fe9f7dc03be9
plan_hash: "fnv1a64:782805def599cc39"
---

# Plan: ST-LN-57

Review mode `outcome`: one branch, no slices.

Tasks:
1. The review package from the last round's head (ac-1, end to end on real git)
2. Finding lines, marks and the ledger's Deferred lines of a version 2 record (core parse)
3. The record's history: round commits, the pin at the first round, debug episodes (CLI host)
4. Round facts: heads, ranges and kinds from one walk (CLI host, core types)
5. The record against git: version, heads, marks, the final review and D-10 (core gate rules)
6. `accord round` and `accord gate done` read the round facts (wiring, real git)
7. The evidence rule, added code's own round 1 and the deferred set (ac-2, ac-3, core)
8. Grounds for a Should and Rulings for fix files (ac-4, ac-5, core)
9. Skills, agents and the workflow spec

Order: Task 1 is the first end-to-end proof: a real repository, a version 2 `review.md` with a head, a debug commit
and a merge with a hand resolution, and `accord review-package` showing only what came after the head. Tasks 2 to 4
build the record parse and the git facts every rule reads; Task 5 adds the record-against-git rules; Task 6 wires
the facts into `accord round` and `accord gate done` and proves them on real repositories; Tasks 7 and 8 add the
four criteria's rules; Task 9 changes the text the sessions follow.

**Common to every task.**
- Commits carry no trailer of any kind: no `Co-Authored-By:`, no line whose first word ends in `-by:`, no
  "Generated with" line.
- No task touches a file under the repository's top-level `accord/` folder.
- Test titles hold no `@`, `#`, comma or apostrophe, and every test named on a `verify:` line is a top-level
  `it(...)` with no `describe` around it, so its id is `<test file path from the repository root>#<title with each
  whitespace run turned into ->`. No existing test is renamed. Every new test is named on some task's `verify:` line.
- Tests: run the test command your brief prints; when it prints none, run only the test files on your task's
  `files:` line with `npx vitest run <files> --reporter=default --reporter=junit
  --outputFile.junit=node_modules/.cache/accord/junit.xml`, never `tests.full`, and find each id of your `verify:`
  line in that report before reporting done. End every task with `npm run build`, `npm run lint` and
  `npm run typecheck`, then its tests.
- A test that commits uses `commitMsg` (and `mergeMsg` for a clean merge) from `packages/cli/test/helpers/repo.ts`,
  never `-m`; `makeEmptyRepo`, `writeFiles`, `gitRun`, `run` and `cleanup` come from the same file, `CONFIG`,
  `laneTicket`, `LANE_S_BODY` and `PLAN` from `test/helpers/lane.ts`. A real-git test builds one sandbox of at most
  about fifteen commits, sets no time limit of its own (`packages/cli/vitest.config.ts` gives 30 s, 90 s on
  Windows) and cleans up in `finally`. Branch names: `gitRun(repo, 'branch', '-M', 'main')` after the first commit,
  then `gitRun(repo, 'switch', '-q', '-c', 't/<id>')`; with no `origin`, `defaultRefOf` then finds `refs/heads/main`.
  A merge that conflicts is made with `gitRun(repo, 'merge', '--no-ff', 'main')` inside `try`/`catch`, the file
  written by hand, then `commitMsg`, which stages everything and finishes the merge.
- Core code under `packages/core/src/` imports no `node:` module. A new core module runs no code at load except
  constant literals, so the import cycles between `round/*.ts` and `gate/*.ts` stay harmless.
- Every `git log` and `git show` the CLI adds is written `'-c', 'log.showSignature=false', 'log',
  '--no-show-signature', …` (that exact adjacency: `packages/cli/test/spawn-surface.test.ts` checks it) with a
  64 MiB `maxBuffer` and `env: { ...process.env, GIT_NO_LAZY_FETCH: '1' }`. Paths from git are read with `-z`; a
  path handed to git is `:(literal)<path>`. No new git call uses `-G`, `--stdin`, `--topo-order` with `--reverse`,
  `-1 --format=%H` with a path ending in `/review.md`, `--format=%x01%ae%x00%ct%x00%s`, or the exact argument list
  `-c credential.interactive=never cat-file --batch`: those are the predicates
  `packages/cli/test/git-count.test.ts` and `packages/cli/test/helpers/items.ts` count.
- A version 1 or unversioned `review.md`, every `plan-review.md`, and every command run on a repository whose records
  are version 1 behave as at the baseline: `packages/cli/test/goldens.test.ts`, `git-count.test.ts`,
  `round.test.ts`, `lane-flow.test.ts`, `lane-s.test.ts`, `lane-commands.test.ts`, `after-verify.test.ts`,
  `review-package-count.test.ts`, `packages/core/test/round-record.test.ts`, `round-next.test.ts` and
  `round-gate.test.ts` stay green with no golden or assertion edited. Their fixtures pin `accord: "0.3.0"`, below
  the cut-over, so the old rules apply to them.
- "Lane M" means every lane but `S` (`lane !== 'S'`), as ST-LN-17's plan Ruling says.
- "Ledger Ruling <n>" is the n-th `- Ruling:` line under `## Rulings` in `accord/tickets/ST-LN-57/ledger.md`,
  counted from 1.

**Terms.** Every task uses these words in exactly this sense.
- *Version 2 record*: a `review.md` whose line above its first `## ` heading is `Round record: 2`. *Version 1*:
  that line is `Round record: 1`. *Unversioned*: neither. `plan-review.md` stays at `Round record: 1`.
- *Record order*: every `## Round` section of `review.md` in document order across all cycles, numbered j = 1..N.
  Its *position* p is ST-LN-17's round number within its cycle k (1-based). Round j's head is H_j.
- *Own records*: the paths `ownRecordsOnly` in `packages/core/src/gate/done.ts` accepts (the ticket file, its
  folder, `accord/product/conventions.md`). A *records-only* commit changes nothing else (an empty path list counts).
- *Walk*: one `git log --remerge-diff` over HEAD less the default ref, each commit with its parents and its paths,
  a merge's paths being those its remerge diff shows; in lane M with no default ref, `--first-parent` over HEAD less
  the plan's `baseline:` (ledger Ruling 30).
- *Nearest code commit from X*: following first parents from X, X included, the first walk commit that is not
  records-only; the first commit reached outside the walk when there is none.
- *Record commit* R_j: reading `review.md`'s history along first parents of HEAD from the last commit that creates
  it, the last commit at which the parsed number of rounds (all cycles) rose to j (ledger Ruling 22); absent when
  round j is not committed.
- *High* of round j: the nearest code commit from R_j's first parent, or from HEAD when R_j is absent (ledger
  Ruling 23). H_j is *bound* when (j = 1, or H_{j-1} is H_j or an ancestor of it) and H_j is high_j or an ancestor of it.
- *Range* of round j: the walk commits reachable from H_{j+1} (from HEAD for j = N) and not from H_j (ledger
  Ruling 18). Each has a kind: `merge` (more than one parent), else `episode` (a debug episode's commit), else `commit`.
- *Debug episode* (D-12): the n-th `## Episode` heading of `debug.md` opens at the oldest first-parent commit whose
  `debug.md` holds it. It ends at the earlier of the first record commit R after the opening commit (R excluded) and
  the oldest commit whose `debug.md` holds a `## Resolved` heading after that episode's heading (included); with
  neither, it runs to HEAD. Its commits are the walk commits reachable from its end and not from its opening commit.
- *Fix commits* of a range (D-09): its `commit`-kind commits that are not records-only.
- *Added code* in a range (ledger Rulings 10, 19): its `episode` commits that are not records-only and its merges
  that change a path outside the own records. Its *added files*: every path those commits change.
- *Span* of a round that is not `(final review)`, at record index j: the ranges from the index of the latest round
  of the same cycle before it that is not `(final review)`, through j-1; when its cycle has no such round before it,
  range j-1 alone (nothing for j = 1).
- *Count* of the round at position p: the number of rounds at positions 1..p of its cycle not headed
  `(final review)` (D-13, ledger Ruling 27). *Evidence count* of a finding located in file f in that round: when a
  round A at position a ≤ p of the same cycle is headed `(added code round 1)` and f is an added file of A's span,
  the number of rounds at positions a..p not headed `(final review)`, for the latest such A; otherwise the count
  (ac-3, D-05). A finding located `none` takes the count.
- *Last fix files* of the round at record index j: the paths of the fix commits of range j-1, own records left out
  and generated or synced paths kept (D-03, ledger Ruling 24).
- *Stretch*: a cycle's rounds split after each round r that an owner allowance Ruling of that cycle names as
  `after round <r>`; the last stretch ends at the cycle's last round (ledger Ruling 21).
- *Pin at the first round*: `accord:` of `accord/config.yml` at R_1, or of HEAD's config when no round is
  committed (ledger Ruling 26). *Cut-over*: the release literal `0.3.1`.

**Decisions this plan takes** (each a Ruling for the ledger):
- Ruling: a version 2 heading reads, after `headingKey` (trimmed, whitespace collapsed, lower case),
  `round <n> head <7 to 40 hex>`, optionally followed by ` (added code round 1)` or ` (final review)` and nothing
  else; one suffix at most, so a final review never carries the added code mark — one plain form a session copies
  from `Head:` — cost if wrong: a heading written another way is refused and retyped.
- Ruling: a version 2 finding line is `<Must|Should|Nice> <n>[ [patch|plan-gap|intent-gap]]: <finding> — <location>
  — <state>[ — <mark>]…`, read from the end: the line is split on ` — ` outside double quotes and backticks, trailing
  segments that match a mark are marks, the next is the state (`open`, `fixed in <sha>`, `deferred`), the next the
  location (`none`, or a path with an optional `:<line>` or `:<line>-<line>`, one pair of backticks stripped), and
  the rest, joined by ` — `, the finding text; marks are `carried from <r>.<n>`, `risk: data-loss`,
  `risk: security`, `test: <id>`, `command: <command>`, `rests on: ac-<n>`, `rests on: D-<nn>`, and
  `rests on: Veto|Intent|Understood|Done when "<quote>"`, each kind at most once — ledger Ruling 8 leaves the
  form to the approach, and reading from the end keeps dashes in the finding text — cost if wrong: a reviewer's
  wording must be rewritten into the form.
- Ruling: a Deferred line is `- review <r>.<n>[ cycle <k>]: <text>` under the ledger's first `## Deferred`
  section, r the round's position, k the cycle, 1 when absent — the approach's form — cost if wrong: a cycle 2
  deferral written without ` cycle 2` names cycle 1 and does not count.
- Ruling: the cut-over literal is `0.3.1`, the first version after the current `0.3.0`; a version 1 record is
  allowed only when the pin at its first round is a plain `x.y.z` below it, a version 2 record is always allowed,
  which is how a version 1 record converts — whatever release ships this ticket is at least `0.3.1` — cost if
  wrong: none found.
- Ruling: the walk, the record history and the round facts live in three new modules beside
  `packages/cli/src/load/fs.ts` (`walk.ts`, `record-history.ts`, `round-facts.ts`), and the core rules in new
  modules under `packages/core/src/round/` (`pin.ts`, `scope.ts`, `evidence.ts`, `grounds.ts`); `fs.ts` only
  exports `parseAfterLog` and `catBatch` — the approach names `fs.ts` and the existing core files as affected
  areas; one module per task keeps each file created and finished inside one task and `fs.ts` (1500 lines) out of
  every executor's context — cost if wrong: the code moves files at review.
- Ruling: for a version 1 or unversioned record the host reads only the record history and the pin, and runs the
  walk only when the pin refuses version 1 (to print each round's high) — the old rules need no walk, so a version 1
  ticket keeps its git calls and outputs — cost if wrong: none found.
- Ruling: HEAD is on the default branch (D-10) when a default ref exists and the walk is empty, read with no extra
  git call; the ticket is done there only when the host read a default ref snapshot (`snapshot.defaultRef`) and the
  ticket is done in it, never through `doneOnDefault`'s fallback to the checkout, which would skip the checks of
  every finished ticket on its own branch — cost if wrong: none found.
- Ruling: under D-10 the D-08 deferred set is every finding written `deferred` whose Deferred line exists, with no
  git fact, and the notice is a warning-level rule `gate.review-scope-skipped` — the checks were run on the branch,
  and a warning prints a line without changing the exit code — cost if wrong: on the default branch a finding
  deferred outside the evidence rule leaves the stop.
- Ruling: the new gate rules are `gate.review-scope` (the record against git: version, heads, marks, the final
  review, added code after the last round, a walk error), `gate.finding-evidence` (ac-2), `gate.finding-grounds`
  (ac-4) and `gate.fix-file-unexplained` (ac-5), all errors in both Done tables — one id per criterion so a failure
  names its rule — cost if wrong: a rename.
- Ruling: the `(added code round 1)` mark is asked on a round not headed `(final review)` whose span holds added code,
  except the first such round of its cycle, where it is allowed and not asked (its count is 1 anyway), and is refused
  on a round whose span holds none; `accord round` prints `Added code:` when the span of the next round holds added
  code — ledger Ruling 11 has gate done refuse a mark git does not support, and the session needs to know when to
  write it — cost if wrong: a session must mark a round it could have left unmarked.
- Ruling: `accord round` refuses on the record-against-git problems of a version 2 record (and on the version
  cut-over), as it refuses an unreadable record — a wrong head is cheaper to retype before the next round — cost if
  wrong: one more refusal to fix during review.
- Ruling: the review package prints `Head: <sha>` unless the record is version 1 or unversioned with rounds, and
  `Head: (cannot tell: <reason>)` when the walk fails; outside a version 1 record it refuses when
  `git log --remerge-diff` fails instead of falling back — the head is needed from round 1, and a fallback hides the
  merge's resolutions ac-1 keeps — cost if wrong: a repository on git older than 2.36 cannot build a package after a
  merge of main.
- Ruling: `--base` equals the plan's `baseline:` when both resolve to the same commit — a short and a full sha name
  the same base — cost if wrong: none found.
- Ruling: `carried from <r>.<n>` must name finding n of an earlier round r of the same cycle, and finding numbers
  are unique within a round; otherwise the record is unreadable — the mark is a form the CLI checks (D-04, ledger
  Ruling 5) — cost if wrong: a record that numbers two findings alike is refused.
- Ruling: `rests on:` holds in lane M when it names an `@ac-n` scenario of the ticket, a `D-nn` that starts a line of
  `## Decisions`, or quotes at least three words found (whitespace collapsed) in `## Vetoes` or `## Intent`; in lane
  S only quotes of `## Understood` or `## Done when` (D-11, ledger Rulings 6, 11, 29) — cost if wrong: a lane M
  ticket lifted from lane S cannot rest a Should on its old Understood line.
- Ruling: a Ruling explains a fix file when its line holds the path as a whole token (the character before is none
  or not in `[A-Za-z0-9_./-]`; the character after is none, or not in `[A-Za-z0-9_/-]`, or a `.` not followed by
  `[A-Za-z0-9_]`) and holds ` — ` followed by text — ledger Ruling 13 lets the path stand anywhere in a Ruling that
  gives a reason — cost if wrong: a path quoted with an unusual neighbour character must be rewritten.
- Ruling: Task 9 runs `npm run gen`, `npm run build` and `node packages/cli/dist/cli.js skills sync` as
  `conventions.md` asks, keeps the sync's changes to the six `.claude/` copies on its `files:` line, and restores
  with `git restore -- <path>` any other file the sync rewrites (copies of skills changed by other unreleased
  tickets), naming them in its report — the convention binds every skill change and the scope stays this ticket's
  — cost if wrong: the repository's copies of the other skills stay on their older text.

## Task 1: The review package from the last round's head

covers: @ac-1, D-01
files: packages/core/src/round/record.ts, packages/core/src/model/snapshot.ts, packages/core/src/index.ts, packages/cli/src/load/walk.ts (new), packages/cli/src/load/fs.ts, packages/cli/src/commands/review-package.ts, packages/cli/test/review-scope-package.test.ts (new)
verify: packages/cli/test/review-scope-package.test.ts#ac-1-the-next-review-package-holds-only-the-ticket-branch-commits-after-the-last-round-head (@ac-1)

Builds ac-1 end to end: a version 2 heading carries the head, and the package for the next round starts there
(D-01 part 1, the approach's "every loop package is built from the last head").

**Test first**, in the new `packages/cli/test/review-scope-package.test.ts`, title
`ac-1 the next review package holds only the ticket branch commits after the last round head`. Build one sandbox:
1. On `main`: `accord/config.yml` (`CONFIG`), `accord/tickets/T-1.md` (`laneTicket('T-1')`),
   `accord/tickets/S-1.md` (`laneTicket('S-1', { lane: 'S', body: LANE_S_BODY })`),
   `accord/tickets/S-1/review.md` (`Round record: 2\n\n## Round 1 head abc1234\n\nNo findings\n`), `src/shared.ts`
   (`base\n`); commit as `base` (sha B); rename the branch to `main`; switch to `t/T-1`.
2. Write `accord/tickets/T-1/plan.md` as `PLAN` with `baseline: abc1234` replaced by B, and `src/a.ts`
   (`export const a = 1;\n`); commit (sha A).
3. Write `accord/tickets/T-1/review.md` as `Round record: 2\n\n## Round 1 head <A>\n\nMust 1 [patch]: the writer
   drops the header — src/a.ts:1 — open\n` and commit.
4. Write `accord/tickets/T-1/debug.md` (`## Episode 1\n`), commit; write `src/d.ts` (`export const d = 1;\n`),
   commit with subject `debug fix`.
5. On `main`: write `src/m.ts` (`export const main = 1;\n`) and `src/shared.ts` (`main\n`), commit. On `t/T-1`:
   `src/shared.ts` (`branch\n`), commit; merge `main` (it conflicts on `src/shared.ts`), write `src/shared.ts` as
   `resolved\n`, commit: the merge M, which is HEAD.

Assert, with `run(['review-package', 'T-1'], repo)`: exit 0; the output holds `Head: <M>` (full sha), `debug fix`,
`+export const d = 1;` and `+resolved`; it holds neither `+export const main = 1;` (main's own code) nor
`+export const a = 1;` (code before the head). `parseRounds` (from `@accord-dev/accord-core`) over the committed
`accord/tickets/T-1/review.md` gives round 1 `head` equal to A. `run(['review-package', 'T-1', '--base', A])` exits
2 and its stderr holds `--base is accepted only for the final review`; `run(['review-package', 'T-1', '--base', B])`
exits 0 and holds `+export const a = 1;`; `run(['review-package', 'S-1', '--base', 'main'])` exits 2 and its stderr
holds `lane S takes no --base`. Then write the code below until it passes.

**Core** (`packages/core/src/round/record.ts`, `packages/core/src/model/snapshot.ts`, `packages/core/src/index.ts`):
- Export `ROUND_RECORD_LINE_2 = 'Round record: 2'`. In `parseRounds` with kind `review`, a version line is
  `Round record: 1` or `Round record: 2` (`versioned` true for both); `Round record: 2` also sets `version: 2`.
  With kind `plan` only `Round record: 1` counts, as at the baseline.
- `RoundRecord` gains `version?: 2`; `RecordedRound` gains `head?: string` (lower case), `added?: true`,
  `final?: true`. Each is set only on a version 2 record, so a version 1 record's object and its JSON do not change.
- In a version 2 `review.md` a `## Round` heading must match the heading form of the first Ruling above; any other
  `## Round …` heading still opens a round (its lines are read as today) and adds the unreadable reason
  `line <L>: "## <heading>" is not ## Round <n> head <sha>, optionally followed by (added code round 1) or (final review)`.
- `index.ts` exports `ROUND_RECORD_LINE_2` and `ownRecordsOnly` (from `gate/done.ts`).
- Must not change: a version 1 or unversioned `review.md` and every `plan-review.md` parse exactly as at the
  baseline (`round-record.test.ts` green).

**CLI walk** (new `packages/cli/src/load/walk.ts`):
```ts
export interface Walk { commits: Map<string, { parents: string[]; files: string[] }>; order: string[] } // lower-case shas; order newest first, as git printed them
export function readWalk(root: string, o: { laneS: boolean; def: string | undefined; baseline: string | undefined }): Walk | { error: string };
export function reach(walk: Walk, from: string): Set<string>; // the walk commits reachable from `from`, itself included when in the walk
export function nearestCode(walk: Walk, from: string, id: string): string; // the Terms' nearest code commit from `from` (full, lower case)
```
`readWalk`, in this order (ledger Rulings 25, 30):
1. `gitIsShallow(root)` true: `{ error: "this clone is shallow, so the ticket branch's history is cut; run git fetch --unshallow" }`.
2. The negative ref: `def` when given; else in lane S `{ error: 'no default branch: none of origin/HEAD, origin/main, origin/master, main or master resolves' }`;
   else the plan's `baseline` with `--first-parent` added; else `{ error: 'no default branch and plan.md records no baseline:' }`.
3. Run `['-c', 'core.quotePath=false', '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z',
   '--format=%x01%H%x00%P', '--name-only', '--no-renames', '--remerge-diff', (--first-parent), 'HEAD', '^' + negative, '--']`
   and read it with `parseAfterLog(raw, true)`, which `packages/cli/src/load/fs.ts` now exports unchanged.
4. When that fails, run it once more without `--remerge-diff`: if that succeeds and lists a commit with more than
   one parent, `{ error: "git cannot show a merge's own changes (git log --remerge-diff needs git 2.36 or newer)" }`;
   if it succeeds with no merge, that is the walk; if it fails too,
   `{ error: 'git failed reading the ticket branch: ' + <git's first non-blank stderr line without "fatal: "> }`.

**Package** (`packages/cli/src/commands/review-package.ts`), with `rec = workOf(ctx.snapshot, id)?.rounds`, the
record *version 2* when `rec?.version === 2` and *old* when it has a round and is not version 2:
- `--base` on a version 2 record: lane S, UsageError `in a version 2 review record every loop round is built from the
  last round's head; lane S takes no --base`; lane M, resolve `--base` and the plan's `baseline:` with
  `git rev-parse --verify --quiet <x>^{commit}`; when there is no baseline or they differ, UsageError `in a version 2
  review record every loop round is built from the last round's head; --base is accepted only for the final review,
  as the plan's baseline: <baseline>` (ledger Ruling 20).
- No `--base` on a version 2 record: the base is the head of the last round in record order; with no round, the
  base of today. A last head that does not resolve gives UsageError `round <p> of cycle <k>'s head <sha> names no
  commit in this repository; after a rebase, retype each round's head to the commit that now holds the same change`.
- Unless the record is old, the line `Head: <sha>` goes right after the title line: `nearestCode` of
  `readWalk(ctx.root, { laneS, def, baseline })` from `ctx.snapshot.git.commit`, where `def` is the default ref the
  command already reads (never a second `defaultRefOf`, so `review-package-count.test.ts` still counts two reads);
  a walk error prints `Head: (cannot tell: <error>)` and the command goes on.
- Unless the record is old, the `log()` helper does not retry without `--remerge-diff`: its failure is UsageError
  `cannot diff <range>: git cannot show a merge's own changes (git log --remerge-diff needs git 2.36 or newer)`.
- Must not change: for an old record the output is byte for byte today's (no `Head:` line, `--base` accepted, the
  retry kept); the title line still starts the output; the commits, stat, diff, undeclared, out-of-scope and
  interface sections and every existing review-package test stay as they are.

## Task 2: Finding lines, marks and the Deferred lines of a version 2 record

covers: D-04
files: packages/core/src/round/record.ts, packages/core/src/model/snapshot.ts, packages/core/src/load/work.ts, packages/core/test/record-v2.test.ts (new)
verify: packages/core/test/record-v2.test.ts#risk:parsing-a-version-2-finding-line-keeps-dashes-in-its-text-and-reads-location-state-and-marks-from-the-end, packages/core/test/record-v2.test.ts#risk:parsing-a-version-2-heading-and-a-ledger-deferred-line-are-read-or-refused-by-their-form

Gives every finding the form D-04 has the CLI check: one location, a state and explicit marks (ledger Ruling 5).

**Test first**, in the new `packages/core/test/record-v2.test.ts`, calling `parseRounds(file, text, 'review')` and
`parseLedger` (import from `../src/round/record.js` and `../src/load/work.js`):
1. `risk:parsing a version 2 finding line keeps dashes in its text and reads location state and marks from the end`:
   parse this record:
   ```
   Round record: 2

   ## Round 1 head abc1234

   Must 1 [patch]: the writer — drops the header — src/a.ts:3 — open — test: export#writes-csv — risk: security
   - Should 2: a cell is wrong — `src/b c.ts`:9-12 — fixed in abc1234 — rests on: Veto "no new — dependency here"

   ## Round 2 head abc1235

   Nice 1: rename w — none — deferred — carried from 1.1
   ```
   and assert: round 1 finding 1 has n 1, file `src/a.ts`, state `open`, test `export#writes-csv` and risk
   `security` (the two dashes inside `the writer — drops the header` stay finding text);
   finding 2 has file `src/b c.ts`, state `fixed`, restsOn `{ kind: 'Veto', ref: 'no new — dependency here' }`;
   round 2's finding has no `file`, state `deferred` and carried `{ round: 1, n: 1 }`; `unreadable` is empty. Then,
   each in its own record under `## Round 1 head abc1234`, these lines are unreadable with a reason holding the line:
   `Must 4: x — src/a.ts` (no state), `Must 4: x — src/a.ts — maybe` (unknown state),
   `Must 4: x — src/a.ts — open — risk: security — risk: data-loss` (a mark twice),
   `Must 4: x — src/a.ts — open — rests on: Veto unquoted words`, `Nice 1: y — none — open — carried from 1.1` in
   round 1 (no earlier round), and two findings numbered 1 in one round. The same lines under `Round record: 1` and
   `## Round 1` give none of the new fields and no unreadable reason they do not give at the baseline.
2. `risk:parsing a version 2 heading and a ledger deferred line are read or refused by their form`: headings
   `## Round 2 head ABC1234 (added code round 1)` (head `abc1234`, added), `## Round 3 head abc1234def (final review)`
   (final), and unreadable `## Round 4`, `## Round 4 head xyz`, `## Round 4 head abc1234 (final review) (added code
   round 1)`; `parseLedger` of `## Deferred\n- review 3.1: x\n- review 2.4 cycle 2: y\n- review x.1: z\n` gives
   `deferred` `[{ round: 3, n: 1, cycle: 1 }, { round: 2, n: 4, cycle: 2 }]`, and a ledger with no such line has no
   `deferred` key; a `- review 3.1: x` line under `## Rulings` counts for nothing.

**Interface.**
- `RoundFinding` (`packages/core/src/model/snapshot.ts`) gains, on a version 2 record only: `n?: number`,
  `file?: string` (absent for `none`), `state?: 'open' | 'fixed' | 'deferred'`, `carried?: { round: number; n: number }`,
  `risk?: 'data-loss' | 'security'`, `test?: string`, `command?: string`,
  `restsOn?: { kind: 'ac' | 'decision' | 'Veto' | 'Intent' | 'Understood' | 'Done when'; ref: string }`
  (`ref`: `ac-<n>`, `D-<nn>`, or the quote without its quotes). `text` stays the trimmed line, as at the baseline.
- `parseRounds`, version 2 only: a line `readLine` reads as a finding, trimmed and one leading `- `, `* ` or `+ `
  removed, must match the finding form of the second Ruling above, or it is unreadable with the reason
  `line <L>: a finding of a version 2 record reads <Severity> <n>[ [class]]: <finding> — <path>[:<line>] or none — open, fixed in <sha> or deferred, then its marks: "<line>"`.
  The split on ` — ` ignores dashes inside double quotes and backticks. Finding numbers repeated in a round, and a
  `carried from <r>.<n>` that names no finding n of a round at an earlier position of the same cycle, are unreadable.
- `Ledger` gains `deferred?: { round: number; n: number; cycle: number }[]`, read by `parseLedger` from the first
  `## Deferred` section only, comments stripped, lines matching `^\s*[-*+]\s+review ([1-9][0-9]*)\.([1-9][0-9]*)(?: cycle ([1-9][0-9]*))?:\s*\S`;
  absent when none matches.
- Must not change: version 1 parsing, `done`, `rulings`, `rulingsSection` and `wordingOnly` of `parseLedger`, and
  `parseReview`.

## Task 3: The record's history: round commits, the pin at the first round, debug episodes

covers: D-12
files: packages/core/src/round/pin.ts (new), packages/core/src/index.ts, packages/cli/src/load/record-history.ts (new), packages/cli/src/load/fs.ts, packages/cli/test/record-history.test.ts (new)
verify: packages/cli/test/record-history.test.ts#risk:complex-branching-the-round-commits-and-the-pin-are-read-along-first-parents-through-a-merge-of-main-that-changes-config.yml, packages/cli/test/record-history.test.ts#risk:complex-branching-a-debug-episode-left-open-ends-at-the-first-review-round-recorded-after-it-opened

Reads, from git, which commit recorded each round (R_j), the pin at the first round and each debug episode's
commits (D-12, ledger Rulings 22, 26).

**Test first**, in the new `packages/cli/test/record-history.test.ts`, calling `readHistory` and `readWalk` (Task 1)
directly on real sandboxes:
1. `risk:complex-branching the round commits and the pin are read along first parents through a merge of main that changes config.yml`:
   `main` holds `CONFIG` and T-1; on `t/T-1` commit `src/a.ts` (A), then `accord/tickets/T-1/review.md` as a version
   1 record with one round (commit B1). On `main` commit `accord/config.yml` with `accord: "0.3.1"` and
   `accord/tickets/T-1/review.md` holding three rounds (M1). Merge `main` into `t/T-1`: `review.md` conflicts (both
   added it); keep the branch's with `gitRun(repo, 'checkout', '--ours', '--', 'accord/tickets/T-1/review.md')`, the
   config takes main's text, and `commitMsg` finishes the merge. `readHistory(repo, 'T-1', undefined, '0.3.1')` gives
   `rounds` `[B1]`, `pin` `0.3.0` and `pinAt` B1 — not main's three rounds, not HEAD's or main's pin.
2. `risk:complex-branching a debug episode left open ends at the first review round recorded after it opened`: on
   `t/T-1` commit `src/a.ts` (C1); a version 2 `review.md` with round 1 (R1); `debug.md` with `## Episode 1` (O);
   `src/e.ts` (E1); `review.md` with round 2 added (R2); `src/f.ts` (F, the episode still open, no `## Resolved`).
   With the walk of `readWalk(repo, { laneS: false, def: 'refs/heads/main', baseline: undefined })`, `rounds` is
   `[R1, R2]`, and `episodes` is one entry with `open` O, `end` R2 and `commits` holding E1 and neither O, R2 nor F.
   Then append `## Resolved` to `debug.md` (commit Z), then `## Episode 2` (commit O2), `src/g.ts` (E2) and a second
   `## Resolved` (Z2), with no round after them: episode 1 still ends at R2 (it came before Z), and episode 2 has
   `end` Z2 and `commits` holding E2 and Z2 but not O2.

**Interface.**
- New core `packages/core/src/round/pin.ts`, exported from `index.ts`: `RECORD_V2_FROM = '0.3.1'`;
  `pinOf(configText: string): string | undefined` (the top-level `accord:` string, read with `parseYamlMap` from
  `load/yaml.ts`, so a config the schema refuses still gives its pin); `pinAllowsV1(pin: string | undefined): boolean`
  (true only for a plain `x.y.z` numerically below `RECORD_V2_FROM`).
- `packages/cli/src/load/fs.ts` exports `catBatch` unchanged.
- New `packages/cli/src/load/record-history.ts`:
  ```ts
  export interface RecordHistory {
    rounds: string[]; // R_1..R_c, full lower-case shas, c = the rounds committed
    pin?: string; pinAt?: string; // the pin at R_1 and R_1; with no committed round, pin = headPin and no pinAt
    episodes: { open: string; end?: string; commits: Set<string> }[]; // empty when no walk is given
  }
  export function readHistory(root: string, id: string, walk: Walk | undefined, headPin: string | undefined): RecordHistory | { error: string };
  ```
  One `git log` (the common flags, `--first-parent -z --format=%x01%H --name-status --no-renames HEAD --
  :(literal)accord/tickets/<id>/review.md :(literal)accord/tickets/<id>/debug.md`) lists, newest first, the
  first-parent commits that change either file with each file's status; `review.md`'s history starts at its newest
  `A` status. One `catBatch` reads `<sha>:accord/tickets/<id>/review.md` and `<sha>:accord/config.yml` for each
  of those `review.md` commits, and `<sha>:accord/tickets/<id>/debug.md` for each `debug.md` commit when a walk is
  given. R_j is the last commit at which the round count of `parseRounds(…, 'review')` (all cycles) rose to j. The
  pin is `pinOf` of the config at R_1. Episodes follow the Terms, headings found by `^## Episode\b` and
  `^## Resolved\b` outside fenced blocks, "after" decided by the order of the log; reachability by `reach` (Task 1).
  Any git failure (including `catBatch`'s UsageError) gives `{ error: 'git failed reading the record history: <reason>' }`.
- Must not change: `catBatch` and every other `fs.ts` function.

## Task 4: Round facts: heads, ranges and kinds from one walk

covers: D-09
files: packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/index.ts, packages/cli/src/load/round-facts.ts (new), packages/cli/test/round-facts.test.ts (new)
verify: packages/cli/test/round-facts.test.ts#risk:complex-branching-each-round-range-runs-from-its-head-to-the-next-and-tells-merges-and-episode-commits-from-fixes, packages/cli/test/round-facts.test.ts#risk:complex-branching-a-failed-remerge-read-fails-closed-only-when-the-range-holds-a-merge, packages/cli/test/round-facts.test.ts#risk:complex-branching-a-shallow-clone-fails-closed-and-names-the-unshallow-fetch, packages/cli/test/round-facts.test.ts#risk:complex-branching-an-ancestry-check-git-cannot-answer-fails-closed

Turns the walk and the history into the facts core reads: each head bound or not, each round's range with commit
kinds (D-09, ledger Rulings 18, 23, 25), and fails closed on every git error.

**Test first**, in the new `packages/cli/test/round-facts.test.ts`, which starts with
`vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));`
and calls `roundFactsFor(repo, loadSnapshot(loadFromFs(repo)), 'T-1')` directly (`loadFromFs` from
`../src/load/fs.js`, `loadSnapshot` from `@accord-dev/accord-core`). To inject a failure set `spawnLog.on = true`
and `spawnLog.fail = (a) => …` from `./helpers/git-spawns.js`, and reset both in `finally`.
1. `risk:complex-branching each round range runs from its head to the next and tells merges and episode commits from fixes`:
   `main` holds `CONFIG` and T-1; on `t/T-1` commit `src/a.ts` (C1); `review.md` version 2 with `## Round 1 head <C1>`
   (R1); `src/a.ts` changed (F1); `debug.md` `## Episode 1` (O); `src/e.ts` (E1); on `main` `src/m.ts`; merge `main`
   cleanly with `mergeMsg` (Mg); `review.md` with `## Round 2 head <E1>` added (R2). Assert `heads[0]` is
   `{ high: C1, bound: true }`, `heads[1]` has `low` C1 and `bound` true (its `high` is E1 or Mg: some git versions
   list a path in a clean merge's remerge diff, so the test does not pin it), `ranges[0]` holds exactly F1 `commit`
   with `['src/a.ts']`, O `commit` and E1 `episode` with `['src/e.ts']`, `ranges[1]` holds exactly Mg `merge` and R2
   `commit`, main's own commit is in neither, and `pin` is `0.3.0`.
2. `risk:complex-branching a failed remerge read fails closed only when the range holds a merge`: with
   `spawnLog.fail = (a) => a.includes('--remerge-diff')`, the facts of a version 2 record on a branch with no merge
   are not an error; after merging `main` they are `{ error }` holding `git 2.36`.
3. `risk:complex-branching a shallow clone fails closed and names the unshallow fetch`: clone the sandbox with
   `gitRun(parent, 'clone', '-q', '--depth', '1', pathToFileURL(repo).href, 'shallow')` (`parent` a fresh
   `mkdtempSync` folder under `tmpdir()`, `pathToFileURL` from `node:url`) and give its facts: `{ error }` holding
   `git fetch --unshallow`.
4. `risk:complex-branching an ancestry check git cannot answer fails closed`: a version 2 record whose round 1 head
   is the base commit on `main` (outside the walk); without injection the head is bound; with
   `spawnLog.fail = (a) => a.includes('--is-ancestor')` the facts are `{ error }` holding `merge-base --is-ancestor`.

**Interface.**
- `packages/core/src/model/snapshot.ts`, exported as types from `index.ts`:
  ```ts
  export interface RangeCommit { sha: string; kind: 'commit' | 'merge' | 'episode'; files: string[] }
  export interface HeadFact { high: string; low?: string; bound?: boolean | 'unknown' } // bound: version 2 only; 'unknown': the head names no commit
  export type RoundFacts =
    | { error: string }
    | { pin?: string; pinAt?: string; skip?: 'on-default'; heads: HeadFact[]; ranges: RangeCommit[][] };
  ```
  `SnapshotInput` and `RepoSnapshot` gain `roundFacts?: Record<string, RoundFacts>` (ticket id → facts), carried
  through by `packages/core/src/load/snapshot.ts` as `returnFacts` is, absent when the host supplies none.
- New `packages/cli/src/load/round-facts.ts`:
  ```ts
  export function roundFactsFor(root: string, snapshot: RepoSnapshot, id: string): RoundFacts | undefined;
  export function withRoundFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot; // snapshot itself when undefined
  ```
  undefined when the ticket has no lane, no round in `review.md`, or `snapshot.git` is absent. `def = defaultRefOf(root)`.
  - Version 1 or unversioned: `readHistory(root, id, undefined, snapshot.config?.accord)`; when `pinAllowsV1(pin)`,
    `{ pin, pinAt, heads: [], ranges: [] }`; otherwise the walk, and when `def` exists and the walk is empty
    `{ pin, pinAt, skip: 'on-default', heads: [], ranges: [] }`, else each round's `{ high }`, ranges `[]`.
  - Version 2: the walk (an error is the facts' error); `def` set and the walk empty gives
    `{ skip: 'on-default', heads: [], ranges: [] }`; then `readHistory` with the walk; then the typed heads resolved
    in one `git cat-file --batch-check` (input lines `<sha>^{commit}`; a `missing` or `ambiguous` answer is
    unresolved). When any head is unresolved, every `bound` is `'unknown'` for those heads and `ranges` is N empty
    lists. Otherwise `high`, `low` and `bound` follow the Terms: "X is Y or an ancestor of it" is `reach(walk, Y).has(X)`
    when both are walk commits, `false` when only X is, and `git merge-base --is-ancestor X Y` otherwise, where only
    exit 1 means no and any other failure is `{ error: 'git merge-base --is-ancestor <X> <Y> failed: <reason>' }`
    (ledger Ruling 25). Ranges follow the Terms, oldest first (the walk's order reversed), kinds from the
    episodes of `readHistory`.
- Must not change: no command reads round facts yet (Task 6 wires them); a snapshot without `roundFacts` loads and
  serialises exactly as at the baseline.

## Task 5: The record against git: version, heads, marks, the final review and D-10

covers: D-04, D-10, D-13
files: packages/core/src/round/scope.ts (new), packages/core/src/gate/rounds.ts, packages/core/src/gate/rules.ts, packages/core/src/index.ts, test/helpers/review-v2.ts (new), packages/core/test/review-scope.test.ts (new)
verify: packages/core/test/review-scope.test.ts#risk:complex-branching-a-final-review-round-stands-once-per-stretch-as-its-last-round-or-the-one-before, packages/core/test/review-scope.test.ts#risk:complex-branching-the-added-code-mark-is-asked-exactly-where-a-debug-episode-or-a-merge-added-code

The pure rules that hold the record to git (D-04's form check, ledger Rulings 11, 21, 23, 26, 28) and the D-10 skip.

**Test helper first**, new `test/helpers/review-v2.ts`, used by Tasks 5 to 8:
- `H(n)`: a 40-character lower-case hex string unique per n.
- `commit(files: string[], kind: RangeCommit['kind'] = 'commit', n?)`: a `RangeCommit`.
- `v2Review(cycles: { head?: string; mark?: 'added' | 'final'; lines: string[] }[][], tail = '')`: the text
  `Round record: 2`, then per cycle (a cycle after the first opened by `## Return from verify abc1234def<k>`, every
  cycle but the last closed by `verdict: converged`) each round as
  `## Round <p> head <head ?? H(j)>[ (added code round 1)| (final review)]` and its lines (`No findings` when empty),
  then `tail`.
- `facts(ranges: RangeCommit[][], o: { heads?: HeadFact[]; pin?: string; skip?: 'on-default' } = {})`: round
  facts whose heads default to `{ high: H(j), bound: true }`.
- `scopeSnapshot(o: { id?: string; lane?: 'M' | 'S'; review: string; ledger?: string; facts?: RoundFacts; branch?: BranchFact })`:
  `loadSnapshot` of `CONFIG`, the ticket (lane M through `done(files, id)`, lane S through
  `laneTicket(id, { lane: 'S', body: LANE_S_BODY })`), the ledger `## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n`
  plus `o.ledger`, the review, `roundFacts: { [id]: o.facts }` when given, `branchFacts` when given, and
  `returnFacts` confirming every `abc1234def<k>` marker.

**Test first**, in the new `packages/core/test/review-scope.test.ts`, reading `gateDone(…).findings` filtered to
`gate.review-scope`:
1. `risk:complex-branching a final review round stands once per stretch as its last round or the one before`:
   lane M, four rounds in cycle 1: round 3 `(final review)` passes; round 2 `(final review)` fails (reason holds
   `once per stretch`); rounds 3 and 4 both `(final review)` fail; round 2 `(final review)` with the ledger line
   `- Ruling: the owner allows 2 more review rounds after round 2 of cycle 1 — "go on" — cost if wrong: 2 rounds`
   passes (it ends its stretch); a lane S record with a `(final review)` round fails (reason holds `lane S has no final review`).
2. `risk:complex-branching the added code mark is asked exactly where a debug episode or a merge added code`: lane
   M, rounds 1..4 of cycle 1 with `ranges[1]` (round 2's range) holding
   (a) `commit(['src/m.ts'], 'merge')`: round 3 unmarked fails (`needs (added code round 1)`), marked passes;
   (b) `commit([], 'merge')`: round 3 marked fails (`remove the mark`), unmarked passes;
   (c) `commit(['src/e.ts'], 'episode')` asks the mark; `commit(['accord/tickets/T-1/debug.md'], 'episode')` does not;
   (d) rounds 1, 2, 3 `(final review)`, 4 with the merge in `ranges[1]`: round 4 unmarked fails;
   (e) the merge in the range before round 1 of cycle 2: that round passes marked and unmarked;
   (f) `ranges[3]` (after the last round) holding the merge fails with `no round has reviewed`.
   A version 1 record with the same facts and pin `0.3.0` gives no `gate.review-scope` finding.

**Interface** (new `packages/core/src/round/scope.ts`; `index.ts` exports `scopeProblems` and `pendingAddedCode`):
```ts
export interface Placed { round: RecordedRound; j: number; cycle: number; p: number } // record index j and cycle k 1-based
export function placedRounds(rec: RoundRecord): Placed[];
export function addedCode(id: string, commits: RangeCommit[]): RangeCommit[]; // the Terms' added code
export function fixCommits(id: string, commits: RangeCommit[]): RangeCommit[]; // the Terms' fix commits
export function spanOf(placed: Placed[], ranges: RangeCommit[][], j: number): RangeCommit[];
export function factsOf(snapshot: RepoSnapshot, id: string): RoundFacts | undefined; // Object.hasOwn on roundFacts
export function skipped(snapshot: RepoSnapshot, id: string): boolean; // facts.skip, or snapshot.defaultRef set and isDone(snapshot.defaultRef.snapshot, id)
export function scopeProblems(snapshot: RepoSnapshot, id: string): { line?: number; reason: string }[];
export function pendingAddedCode(snapshot: RepoSnapshot, id: string): boolean; // the next round's span holds added code
export const reviewScope: GateRule['check'];
export const reviewScopeSkipped: GateRule['check'];
```
`scopeProblems` is `[]` without a lane ticket, a review record with a round, or facts. Otherwise, in this order:
1. Not version 2: when the facts are an error, that error (`the review scope cannot be checked: <error>`); when
   skipped or `pinAllowsV1(pin)`, nothing; else one problem at line 1: `review.md is a version 1 record, but
   accord/config.yml pins <pin or "no release"> at <pinAt's first 12 characters or HEAD>, and from accord 0.3.1 a
   record is version 2: set its first line to Round record: 2, head each round ## Round <n> head <sha> with a commit
   above the previous round's head and at or below the one listed (<"round p of cycle k: high" for every round,
   joined by "; ">), give each finding one location, then add the marks or Rulings accord gate done asks`.
2. Version 2: an error is `the review scope cannot be checked: <error>` and nothing else; skipped gives nothing.
3. Heads, at each round's heading line: `bound: 'unknown'` gives `round <p> of cycle <k>: head <head> names no
   commit in this repository; after a rebase, retype each round's head to the commit that now holds the same change,
   at or below <high>`; `bound: false` gives `round <p> of cycle <k>: head <head> is not between <low or "the
   branch start"> and <high> in HEAD's history; type the Head: line accord review-package printed for this round`.
4. Marks (the Ruling on the mark): a marked round whose span holds no added code gives `round <p> of cycle <k> is
   headed (added code round 1), but no debug episode or merge added code since the round before it; remove the
   mark`; an unmarked round, not `(final review)` and not the first such round of its cycle, whose span holds added
   code gives `round <p> of cycle <k> reviews code a debug episode or a merge added (<first 12 characters of each
   sha>) and its heading needs (added code round 1)`.
5. Final review: in lane S, `round <p> of cycle <k> is headed (final review), but lane S has no final review`; in
   lane M, a final review round not the last round of its stretch or the one before it, or a second one in its
   stretch, gives `round <p> of cycle <k> is headed (final review), but a final review is the last round of its
   stretch or the one before it, once per stretch; a stretch ends at the cycle's last round or at a round an owner
   allowance names` (allowances from `allowancesOf(snapshot, id, 'review')`).

`reviewScope` emits `scopeProblems` (file `review.md`, line when given) plus, for a version 2 record with facts that
are neither an error nor skipped, when the last range holds added code: `the commits after round <p> of cycle <k>'s
head add code by a debug episode or a merge (<shas>) that no round has reviewed; run a review round headed (added
code round 1)` (ledger Ruling 28). `reviewScopeSkipped` emits, when `skipped` holds and the record is version 2 or
its pin refuses version 1: `HEAD is already on the default branch, or the ticket is done there, so the review scope
checks are skipped; the pull request's gate ran them on the ticket branch` (D-10). `pendingAddedCode` is true for a
version 2 record with facts neither error nor skipped when the ranges from the latest round of the last cycle not
headed `(final review)` (the record's last round when the cycle has none) through the last range hold added code.

`packages/core/src/gate/rules.ts`: rows `gate.review-scope` (error, `reviewScope`) and `gate.review-scope-skipped`
(warning, `reviewScopeSkipped`), both profiles, right after `REVIEW_ROUNDS` in `DONE_RULES` and `DONE_S_RULES`.
`packages/core/src/gate/rounds.ts`: the unversioned branch adds no `Round record: 1` finding when `scopeProblems`
reports the version refusal. Must not change: every other row and table, and every check of `rounds.ts` for a
record whose pin allows version 1.

## Task 6: `accord round` and `accord gate done` read the round facts

covers: D-10
files: packages/core/src/round/next.ts, packages/cli/src/commands/gate.ts, packages/cli/src/commands/round.ts, packages/core/test/review-scope-round.test.ts (new), packages/cli/test/review-scope-gate.test.ts (new)
verify: packages/core/test/review-scope-round.test.ts#risk:complex-branching-accord-round-refuses-a-record-git-does-not-bind-and-asks-for-the-added-code-mark, packages/cli/test/review-scope-gate.test.ts#risk:complex-branching-a-version-1-record-is-refused-when-the-pin-at-its-first-round-is-at-the-cut-over, packages/cli/test/review-scope-gate.test.ts#risk:complex-branching-gate-done-names-an-unreadable-head-and-a-head-typed-past-the-last-code-commit-of-its-round, packages/cli/test/review-scope-gate.test.ts#risk:complex-branching-gate-done-skips-the-review-scope-checks-with-a-notice-when-HEAD-is-on-the-default-branch

Wires the facts into the two commands that read the record and proves the version cut-over, the head messages
and D-10 on real repositories.

**Test first.**
1. New `packages/core/test/review-scope-round.test.ts`, title
   `risk:complex-branching accord round refuses a record git does not bind and asks for the added code mark`, with
   `scopeSnapshot` (Task 5): a version 2 record whose round 2 head has `bound: false` makes `nextRound(…, 'review')`
   `refused` with a reason holding `is not between`; with every head bound and the last range holding
   `commit(['src/m.ts'], 'merge')`, the answer is `next` and `roundText` holds
   `Added code: head round 3 as ## Round 3 head <sha> (added code round 1)`; with the merge in no range, no
   `Added code:` line; a version 1 record with facts `{ pin: '0.3.1', heads: [{ high: H(1) }], ranges: [] }` is
   refused with a reason holding `Round record: 2`, and with pin `0.3.0` it is answered as at the baseline.
2. New `packages/cli/test/review-scope-gate.test.ts`, each test reading `run(['gate', 'done', '<id>', '--json'], repo)`
   and filtering `JSON.parse(out).findings` by rule:
   - `risk:complex-branching a version 1 record is refused when the pin at its first round is at the cut-over`: on
     `t/T-1` commit code, then `accord/config.yml` with `accord: "0.3.1"` together with a version 1 `review.md`
     (R_1), then `accord/config.yml` back to `CONFIG` so the CLI's own pin check passes. `gate.review-scope` holds
     `Round record: 2` and `0.3.1`; `run(['round', 'T-1'], repo)` exits 1 and prints `refused:` with
     `Round record: 2`. A second ticket T-2 whose version 1 record was first committed under `CONFIG` gets no
     `gate.review-scope` finding.
   - `risk:complex-branching gate done names an unreadable head and a head typed past the last code commit of its round`:
     code C1, a version 2 `review.md` with `## Round 1 head deadbeef` (R_1), code F: `gate.review-scope` holds
     `names no commit in this repository` and `retype`; then the heading retyped to F's sha and committed:
     `gate.review-scope` holds `is not between` and C1's sha.
   - `risk:complex-branching gate done skips the review scope checks with a notice when HEAD is on the default branch`:
     a version 2 record on `t/T-1` whose head is `deadbeef`, merged into `main` with
     `gitRun(repo, 'merge', '--ff-only', 't/T-1')` after `switch main`: `gate.review-scope-skipped` is present with
     level `warning` and `gate.review-scope` is absent.

**Interface.**
- `packages/cli/src/commands/gate.ts`: for `done`, `forRounds` becomes `withRoundFacts(ctx.root,
  withReturnFacts(ctx.root, gated, id), id)`; `withDefaultRef` is applied when the review record is unversioned with
  a round (as today) or version 2.
- `packages/cli/src/commands/round.ts`: for the review record, the snapshot is
  `withRoundFacts(ctx.root, withReturnFacts(ctx.root, ctx.snapshot, id), id)`; `--plan` is unchanged.
- `packages/core/src/round/next.ts`: `nextRound` for kind `review`: an unversioned record with a round is refused
  with `scopeProblems` when they are not empty (else with today's reason); after `recordProblems`, non-empty
  `scopeProblems` refuse with their reasons. `RoundAnswer` gains `addedCode?: true`, set on a `next` answer when
  `pendingAddedCode` holds; `roundText` then prints, after the `Cycle:` line,
  `Added code: head round <n> as ## Round <n> head <sha> (added code round 1)`.
- Must not change: `accord round --plan`, every answer and text for a record without facts or with a version 1
  record whose pin allows it (`round.test.ts`, `round-next.test.ts` green), `gate ready`, `gate plan`, and every
  gate done output of the goldens.

## Task 7: The evidence rule, added code's own round 1 and the deferred set

covers: @ac-2, @ac-3, D-02, D-03, D-05, D-08, D-13
files: packages/core/src/round/evidence.ts (new), packages/core/src/round/next.ts, packages/core/src/gate/rounds.ts, packages/core/src/gate/rules.ts, packages/core/test/finding-evidence.test.ts (new)
verify: packages/core/test/finding-evidence.test.ts#ac-2-from-round-3-a-new-finding-outside-the-last-fix-files-blocks-only-with-evidence (@ac-2), packages/core/test/finding-evidence.test.ts#ac-3-code-added-by-a-debug-episode-or-a-merge-starts-its-own-round-1-for-the-evidence-rule (@ac-3), packages/core/test/finding-evidence.test.ts#risk:complex-branching-the-final-review-is-left-out-of-the-evidence-count

ac-2 and ac-3 over the round count ST-LN-17 keeps (D-02), file-level (D-03), restarting only the evidence count
(D-05), and D-08's change to ST-LN-17's stop.

**Test first**, in the new `packages/core/test/finding-evidence.test.ts`, with `scopeSnapshot`, `v2Review`, `facts`
and `commit` (Task 5), reading `gateDone(…).findings` filtered to `gate.finding-evidence` unless said otherwise:
1. `ac-2 from round 3 a new finding outside the last fix files blocks only with evidence`: lane M, rounds 1 to 3 of
   cycle 1, `ranges[1]` (round 2's fix) `[commit(['src/a.ts']), commit(['src/c.ts', 'accord/tickets/T-1/ledger.md']),
   commit(['accord/tickets/T-1/ledger.md'])]` (merges and episode commits would make round 3 added code's round 1, so
   D-09's leaving them out of the fix is proven by ac-5's test in Task 8). Round 3's
   `Must 1 [patch]: x — src/b.ts:1 — open` fails and the reason holds `round 3`, `finding 1` and `src/b.ts`. It
   passes with `— test: export#writes-csv`, with `— command: npm test`, with `— risk: data-loss`, with
   `— risk: security`, with `— carried from 2.1` (round 2 holding a finding 1), when located `src/a.ts:1` or
   `src/c.ts:1` (a commit that changes code and records is a fix commit), and as `deferred` with the ledger
   `## Deferred\n- review 3.1: x\n`; it fails as `deferred` with no Deferred line, and located `none`. The same Must
   in round 2 passes. D-08: with round 3
   holding only that Must, `deferred` with its Deferred line, and a Nice, `nextRound(…, 'review')` is `next` with
   round 4 and a `verdict: converged` tail gives no `gate.review-rounds` finding; with the Must `open` and
   `— test: export#writes-csv`, `nextRound` is `stop` at round 3.
2. `ac-3 code added by a debug episode or a merge starts its own round 1 for the evidence rule`: lane M, rounds 1 to
   5, the ledger allowing one more round after rounds 3 and 4 of cycle 1 (allowance lines as in Task 5), `ranges[3]`
   (round 4's) `[commit(['src/m.ts'], 'merge')]`, round 5 headed `(added code round 1)` with
   `Should 1: y — src/m.ts:1 — open` and `Must 2: z — src/z.ts:1 — open`: the evidence findings name finding 2 and not
   finding 1, and `roundText(nextRound(…))` holds `round 5 of cycle 1` (ST-LN-17 still counts it as round 5 and stops
   on it). Extended to rounds 6 and 7 (allowances after 5 and 6, `ranges[5]` `[commit(['src/other.ts'])]`), a round
   6 Should located `src/m.ts` is not named and a round 7 `Must 1: w — src/m.ts:2 — open` is.
3. `risk:complex-branching the final review is left out of the evidence count`: rounds 1, 2 `(final review)`, 3: a
   round 3 Must located in a file no fix changed, without evidence, is not named (its count is 2); a Must without
   evidence in a `(final review)` round 4 after rounds 1 to 3 is not named.

**Interface** (new `packages/core/src/round/evidence.ts`):
```ts
export function evidenceCount(placed: Placed[], ranges: RangeCommit[][], at: Placed, file: string | undefined, id: string): number; // the Terms' evidence count
export function lastFixFiles(id: string, ranges: RangeCommit[][], j: number): Set<string>; // the Terms' last fix files
export function needsEvidence(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean;
export function deferredOf(snapshot: RepoSnapshot, id: string, cycle: number): ReadonlySet<RoundFinding>; // cycle 0-based
export const findingEvidence: GateRule['check'];
```
`needsEvidence` holds for a version 2 record whose facts are neither an error nor skipped and have ranges, a round
not `(final review)`, a Must or Should with no `carried` and no `risk`, an evidence count of at least 3, and a file
absent or not in the last fix files. `findingEvidence` names each finding that needs evidence and has no `test` or
`command`, unless it is `deferred` and the ledger's `deferred` holds `{ round: p, n, cycle: k }`: file `review.md`,
the finding's line, reason `round <p> of cycle <k>, finding <n>: from round 3 a new Must or Should located <"in
<file>, which the previous round's fix did not change" or "nowhere (none)"> needs test: or command:, risk:
data-loss or risk: security, or deferred with the ledger line - review <p>.<n>[ cycle <k> from cycle 2]: <text>
under ## Deferred`. `deferredOf` holds the findings of that cycle that need evidence, are `deferred` and have their
Deferred line; when `skipped` (Task 5) it holds every `deferred` finding of the cycle with its Deferred line.

`packages/core/src/round/next.ts`: `cycleState(cycle, allowances, kind, deferred: ReadonlySet<RoundFinding> = new Set())`,
its stop test becoming `rounds[s - 1].findings.some((f) => f.severity !== 'Nice' && !deferred.has(f))`;
`recordProblems` (the cycle before each return from verify) and `nextRound` pass `deferredOf(snapshot, id, <cycle
index>)` for kind `review`; `planStopOf` passes none. `packages/core/src/gate/rounds.ts` passes it in both of its
review calls. `rules.ts`: row `gate.finding-evidence` (error, both profiles) after `gate.review-scope-skipped` in
both Done tables. Must not change: plan critique rounds, and every stop of a record with no deferred finding that
needs evidence (`round-next.test.ts`, `round-gate.test.ts` green).

## Task 8: Grounds for a Should and Rulings for fix files

covers: @ac-4, @ac-5, D-07, D-11, D-14
files: packages/core/src/round/grounds.ts (new), packages/core/src/gate/rules.ts, packages/core/test/finding-grounds.test.ts (new)
verify: packages/core/test/finding-grounds.test.ts#ac-4-from-round-3-a-should-rests-on-a-ticket-line-or-a-failing-case (@ac-4), packages/core/test/finding-grounds.test.ts#ac-5-a-file-a-fix-changed-needs-a-finding-or-a-ruling (@ac-5), packages/core/test/finding-grounds.test.ts#risk:parsing-a-ruling-names-a-path-only-as-a-whole-token

ac-4 from round 3 only (D-07), lane S quotes (D-11), and ac-5 with D-14's exemption for ac-5 alone (ledger Ruling 24).

**Test first**, in the new `packages/core/test/finding-grounds.test.ts`, with the Task 5 helpers:
1. `ac-4 from round 3 a should rests on a ticket line or a failing case`, filtered to `gate.finding-grounds`: lane M,
   rounds 1 to 3: round 3's `Should 1: x — src/a.ts:1 — open` fails and names `round 3` and `finding 1`; it passes
   with `— rests on: ac-1`, `— rests on: D-01`, `— rests on: Veto "No new dependency."`,
   `— rests on: Intent "export their report as CSV"`, `— test: export#writes-csv`, `— risk: data-loss`, or as a
   `Nice`; it fails with `— rests on: ac-9`, `— rests on: D-07`, `— rests on: Veto "dependency"` (one word) and
   `— rests on: Understood "The export button writes a csv file."` in lane M; the same Should in round 2 passes, and in
   a round 3 headed `(final review)` passes. Lane S (D-11): `— rests on: Understood "The export button writes a csv
   file."` and `— rests on: Done when "Pressing export saves report.csv."` pass, `— rests on: ac-1` fails.
2. `ac-5 a file a fix changed needs a finding or a ruling`, filtered to `gate.fix-file-unexplained`: lane M, rounds
   1 to 3: round 1 `Must 1 [patch]: x — src/a.ts:1 — fixed in abc1234`, round 2 headed `(added code round 1)` with
   `No findings`, round 3 `Must 1: y — src/gen/y.ts:1 — open`; `ranges[0]` (round 1's fix)
   `[commit(['src/a.ts', 'src/c.ts', 'accord/tickets/T-1/ledger.md']), commit(['src/m.ts'], 'merge'),
   commit(['src/e.ts'], 'episode'), commit(['accord/tickets/T-1/ledger.md']), commit(['src/gen/x.ts']),
   commit(['.claude/skills/x/SKILL.md'])]`, `ranges[1]` `[commit(['src/d.ts']), commit(['src/gen/y.ts'])]`,
   `ranges[2]` empty, and the branch fact
   `{ base: 'b', changes: [], synced: ['.claude/skills/x/SKILL.md'], baseConfig: 'generated:\n  - src/gen/\n' }`.
   Exactly two findings: one naming `src/c.ts` and round 1, one naming `src/d.ts` and round 2 (the merge's, the
   episode's, the records-only commit's, the generated and the synced paths need nothing: D-09, D-14). With the
   ledger Rulings
   `- Ruling: src/c.ts holds the helper the fix needed — the header writer moved there — cost if wrong: one file reviewed twice`
   and the same for `src/d.ts`, none. In the same snapshot `gate.finding-evidence` (Task 7) does not name round 3's
   Must: `src/gen/y.ts`, exempt for ac-5, still counts among round 2's fix files for ac-2 (D-03, ledger Ruling 24).
3. `risk:parsing a ruling names a path only as a whole token`: with fix file `src/c.ts`, the Rulings
   `- Ruling: src/c.tsx moved — reason — cost`, `- Ruling: xsrc/c.ts moved — reason — cost`,
   `- Ruling: src/c.ts.bak kept — reason — cost` and `- Ruling: src/c.ts moved` (no reason) explain nothing; each of
   `` - Ruling: `src/c.ts` moved — reason — cost ``, `- Ruling: moved src/c.ts, a helper — reason — cost` and
   `- Ruling: the helper is src/c.ts. — reason — cost` explains it.

**Interface** (new `packages/core/src/round/grounds.ts`):
```ts
export function needsGrounds(snapshot: RepoSnapshot, id: string, at: Placed, f: RoundFinding): boolean;
export function restsOnHolds(ticket: Ticket, f: RoundFinding): boolean; // the Ruling on rests on, lane from ticket.frontmatter.lane
export function mentionsPath(text: string, path: string): boolean; // the Ruling on whole tokens
export const findingGrounds: GateRule['check'];
export const fixFileUnexplained: GateRule['check'];
```
`needsGrounds`: a version 2 record whose facts are neither an error nor skipped and have ranges, a round not
`(final review)`, a Should with no `carried` and no `risk`, and an evidence count (Task 7) of at least 3.
`findingGrounds` names each such Should with no `test`, no `command` and no `restsOn` that holds: the finding's
line, reason `round <p> of cycle <k>, finding <n>: from round 3 a Should rests on rests on: ac-<n>, D-<nn>, Veto
"<quote>" or Intent "<quote>" that the ticket holds (lane S: Understood "<quote>" or Done when "<quote>"), or on test:
or command:; otherwise it is a Nice`. Quotes need at least three whitespace-separated words and are found in the
section text with comments stripped and whitespace collapsed; `D-nn` must start a line of `## Decisions` (list marker
stripped) followed by a space or the line's end; `ac-n` must be a scenario's `acTag`.
`fixFileUnexplained`: for each round j, the paths of the fix commits of range j that are not own records and, when
`factOf(snapshot, id)` (from `gate/scope.ts`) is a readable branch fact, not `isExempt(id, fact, path)`; each path no
finding of that round is located in and no ledger `rulings` line mentions (with ` — ` followed by text) gives, at
the round's heading line: `<path> changed by the fix of round <p> of cycle <k> (<first 12 characters of each sha>)
is the location of no finding of that round; add a Ruling under ## Rulings in the ledger naming <path> with its
reason`. `rules.ts`: rows `gate.finding-grounds` and `gate.fix-file-unexplained` (errors, both profiles) after
`gate.finding-evidence` in both Done tables. Must not change: every other rule's findings.

## Task 9: Skills, agents and the workflow spec

covers: D-01, D-06
files: packages/core/skills/review/SKILL.md, packages/core/skills/review/record.md, packages/core/skills/accord/lane-s.md, packages/core/skills/debug/SKILL.md, packages/core/agents/reviewer.md, packages/core/src/generated/skills.ts, packages/core/src/generated/agents.ts, .claude/skills/accord-review/SKILL.md, .claude/skills/accord-review/record.md, .claude/skills/accord/lane-s.md, .claude/skills/accord-debug/SKILL.md, .claude/agents/accord-reviewer.md, .claude/agents/accord-final-reviewer.md, docs/specs/2026-10-12-workflow-layer-design.md, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-review-skills-write-version-2-records-with-heads-marks-and-fix-file-rulings, packages/core/test/stage-skills.test.ts#risk:complex-branching-the-fix-review-after-verify-reads-only-the-changes-after-the-review-base-and-counts-its-own-five-rounds, packages/core/test/stage-skills.test.ts#risk:regression-the-review-lane-S-and-plan-critique-skills-ask-accord-round-and-write-the-round-record-version-line

Puts all four parts (D-06) in the text the sessions follow, so every rule the gate checks is one the session was
told to write (D-01).

**Test first**, in `packages/core/test/stage-skills.test.ts`:
- New `risk:regression the review skills write version 2 records with heads marks and fix file rulings`, over the
  rendered files (`flatText` as the file already uses): `.claude/skills/accord-review/record.md` holds
  `Round record: 2`, ``## Round <n> head <sha>``, `(added code round 1)`, `(final review)`, `` `Head: <sha>` ``,
  `` `carried from <r>.<n>` ``, `` `risk: data-loss` ``, `` `test: <test id>` ``, `` `rests on: ac-<n>` ``,
  `- review <r>.<n> cycle <k>: <finding>` and `` `generated:` ``; review SKILL.md's step 2 holds `` `Head: <sha>` ``
  and `after that head`, step 4 holds ``re-review only the fix diff: `accord review-package <id>` into`` and not
  `--base <the noted sha>`, step 7 holds ``--base <the plan's baseline:>`` and `(final review)`;
  `.claude/skills/accord/lane-s.md` holds `Round record: 2`, `` `rests on: Understood "<quote>"` `` and
  `` `rests on: Done when "<quote>"` ``; `.claude/agents/accord-reviewer.md` holds `` `command: <command>` `` and
  `` `risk: security` ``; `.claude/skills/accord-debug/SKILL.md` holds `that round's fix`.
- In `risk:complex-branching the fix review after verify reads only the changes after the review base and counts its own five rounds`
  the step 2 assertions become: holds `after that head` and does not hold `` `Review base: <sha>` ``; the step 6
  assertion stays.
- In `risk:regression the review lane S and plan critique skills ask accord round and write the round record version line`
  the `Round record: 1` phrase becomes `Round record: 2` for `record.md` and `lane-s.md`; `critique.md` keeps
  `Round record: 1`.

**Text.** Keep every other point of each file word for word.
- `packages/core/skills/review/SKILL.md` (rendered at most 5120 bytes and 120 lines; `packages/core/test/skills.test.ts`):
  - Step 2 becomes: ``2. **Package.** Run `accord review-package <id>` into a file outside the working tree. After a
    round with a head in `review.md`, it holds the commits, the stat, and the diff after that head, without what a
    merge brought in from the default branch; before round 1, from the plan's `baseline:`. It prints `Head: <sha>`
    for the round's heading, and lists under `## Undeclared files` every changed file no task's `files:` line names,
    and under `## Interface signs` each sign of a new interface the branch adds.`` (the "review unit" and
    `Review base:` sentences go: every loop round now reads from the last head, and `./record.md` says what the
    final review reads).
  - Step 4, first bullet: `…as `./record.md` says, then note the HEAD sha.` becomes `…as `./record.md` says.`.
  - Step 4, Rulings bullet becomes: ``Copy every Ruling in its report, and as a Ruling naming the file and its reason
    each file outside the plan you accept and each file the fix changed that no finding of the round is located in,
    into `accord/tickets/<id>/ledger.md` under `## Rulings`; commit the ledger.``
  - Step 4, re-review bullet: `` `accord review-package <id> --base <the noted sha>` `` becomes `` `accord review-package <id>` ``.
  - Step 4, Nice bullet becomes: ``Nice findings, and a finding `./record.md` lets you defer, go to the ledger under
    `## Deferred`, not fixed.``
  - Step 7, first sentence becomes: ``After convergence, one fresh `accord-final-reviewer` reads the whole ticket
    once, from `accord review-package <id> --base <the plan's baseline:>`, its round headed `(final review)` (over
    about 1500 changed lines, dispatch it with lens `integration`).``
  - Measure the rendered `.claude/skills/accord-review/SKILL.md` after the sync. Over 5120 bytes: first drop the
    Nice bullet's added words (`record.md` says it), then write the Rulings bullet as ``…and each file outside the
    plan you accept, or that the fix changed with no finding of the round in it, as a Ruling naming…``; still over,
    stop and report it, cutting nothing else.
- `packages/core/skills/review/record.md`:
  - The version sentence becomes: ``Its first line is `Round record: 2`, above every heading, and its only headings
    are `## Round <n> head <sha>` and `## Return from verify <sha>`. A record whose first round was committed while
    `accord/config.yml` pinned accord 0.3.0 or earlier keeps its `Round record: 1` and its `## Round <n>` headings,
    without heads or marks.``
  - The fenced form becomes `## Round <n> head <sha>`, a blank line, and
    `Must|Should|Nice <n> [patch|plan-gap|intent-gap]: <finding> — <path>[:<line>] | none — fixed in <sha> | deferred | open[ — <mark>]…`.
  - First bullet: `One `## Round <n>` section` becomes `One `## Round <n> head <sha>` section`. After it, the bullet:
    ``- `<sha>` is the `Head: <sha>` line `accord review-package` printed for that round, the last commit it
    reviewed; accord checks in git that it lies between the previous round's head and the round's record. The
    heading ends ` (added code round 1)` when `accord round` printed `Added code:` before the round, and
    ` (final review)` on the final review, which is the last round or the one before it, until an owner allowance
    gives more rounds.``
  - The "Each finding carries" bullet: after `where it is` add `(one repository path, with `:<line>` when known, or
    `none`)`.
  - Three new bullets after it:
    ``- After its state a finding line carries its marks, each after ` — `: `carried from <r>.<n>` when round `<r>` of
    this cycle reported it as finding `<n>`; `risk: data-loss` or `risk: security`; `test: <test id>` or
    `command: <command>` when a failing test or a command reproduces it; `rests on: ac-<n>`, `rests on: D-<nn>`,
    `rests on: Veto "<quote>"` or `rests on: Intent "<quote>"`, a quote of at least three words from that section.``
    ``- From round 3 of a cycle, the final review not counted and, for a file code a debug episode or a merge added
    changed, rounds counted from the one headed `(added code round 1)`: a Must or Should not carried from an earlier
    round, whose location is not a file the previous round's fix changed, blocks only with `test:`, `command:` or a
    `risk:` mark. Otherwise write it `deferred` and add the line `- review <r>.<n> cycle <k>: <finding>` under
    `## Deferred` in the ledger (` cycle <k>` from cycle 2 on); it then leaves the stop from round 3. From round 3 a
    new Should also needs `rests on:`, `test:`, `command:` or a `risk:` mark; without one, write it as a Nice.``
    ``- A round's fix is every commit after its head, up to the next round's head or, after the last round, to the
    last commit, but merges of the default branch, a debug episode's commits and commits that change only the
    ticket's records. Each file a fix changes is the location of a finding of that round, or a Ruling under
    `## Rulings` in the ledger names its path with a reason; a copy `accord skills sync` writes and a path under
    `generated:` in `accord/config.yml` need neither.``
- `packages/core/skills/accord/lane-s.md`, step 4:
  - ``under `## Round <n>`, each finding with its severity, what it is and where it is, or `No findings`,`` becomes
    ``under `## Round <n> head <sha>`, `<sha>` being the `Head: <sha>` line the package printed and the heading ending
    ` (added code round 1)` when `accord round` printed `Added code:`; write each finding as
    `Must|Should|Nice <n>: <finding> — <path>[:<line>] | none — fixed in <sha> | deferred | open`, then its marks, or
    `No findings`;`` (the sentence then goes on as today with "copy each `Confirmed wording-only: <path>` line…").
  - `` `review.md` starts with the line `Round record: 1` `` becomes `` `Round record: 2` ``.
  - After ``never two of them or a question mark.`` insert: ``After its state a finding line carries its marks, each
    after ` — `: `carried from <r>.<n>` when round `<r>` of this cycle reported it as finding `<n>`;
    `risk: data-loss` or `risk: security`; `test: <test id>` or `command: <command>` when a failing test or a command
    reproduces it; `rests on: Understood "<quote>"` or `rests on: Done when "<quote>"`, a quote of at least three
    words. From round 3, for a file a merge's own changes touched counted from the round headed
    `(added code round 1)`, a Must or Should not carried from an earlier round, whose location is not a file your
    previous fix changed, blocks only with `test:`, `command:` or a `risk:` mark; otherwise write it `deferred` with
    the line `- review <r>.<n> cycle <k>: <finding>` under `## Deferred` in `accord/tickets/<id>/ledger.md`
    (` cycle <k>` from cycle 2 on), and it leaves the stop. From round 3 a new Should also needs `rests on:`,
    `test:`, `command:` or a `risk:` mark, or is written as a Nice. Each file a commit after a round changes, up to
    the next round, but a merge of the default branch and a commit that changes only the ticket's records, is the
    location of a finding of that round, or a Ruling in the ledger names its path with a reason.``
  - The phrases `packages/core/test/stage-skills.test.ts` already asserts for lane-s.md (`` `## Round <n>` `` in "counted
    from the `## Round <n>` sections", `commit `review.md` alone at once`, and the rest) stay.
- `packages/core/skills/debug/SKILL.md`, step 2, after ``is not `## Resolved`.`` add: ``A commit made after a review
  round is recorded, while the episode is still open, is that round's fix: a finding of that round or a ledger Ruling
  names each file it changes.`` The rendered file stays at most 5120 bytes; when it does not, use ``A commit after
  the next review round is that round's fix.``, and when that does not fit, stop and report it.
- `packages/core/agents/reviewer.md`:
  - ``On a re-review the package holds only the fix diff.`` becomes ``After round 1 the package holds only the
    commits after the last round's head; the final review's holds the whole ticket.``
  - The first Findings bullet: ``its file and line`` becomes ``one file and line, or `none` when it has no file``.
    New bullets after it: ``- When a failing test or a command reproduces it, give it as `test: <test id>` or
    `command: <command>`.`` ``- A Should names what it rests on: the acceptance criterion `ac-<n>` or Decision
    `D-<nn>` it breaks, or a quote of at least three words from the Veto or Intent (lane S: from `## Understood` or
    `## Done when`).`` ``- A finding on data loss or security says `risk: data-loss` or `risk: security`.``
  - In the fenced example, after the `failing case:` line: ``   reproduce: test: <test id> | command: <command>`` and
    ``   rests on: ac-<n> | D-<nn> | Veto "<quote>" | Intent "<quote>"``.
- `docs/specs/2026-10-12-workflow-layer-design.md`, wrapping kept near the current width, no other text changed:
  1. §7: ``and `accord review-package <id>` diffs from it when no base is given, so review always sees the whole
     ticket and nothing before it (phase 2).`` becomes ``and `accord review-package <id>` diffs from it when no base
     is given and no review round has recorded a head, so the first round sees the whole ticket and nothing before
     it (phase 2); after that it diffs from the last round's head (ST-LN-57).``
  2. §10, after the bullet that begins ``Fix every Must and Should marked `patch`.``, two bullets:
     ``- Review checks a pinned scope (ST-LN-57). `review.md` opens `Round record: 2`; each round is
     `## Round <n> head <sha>`, the head the package printed as `Head:`, which git must place between the previous
     head and the last code commit before the round's record. Each loop round's package holds only the ticket's
     commits after the last head, without what a merge of the default branch brought in but with the merge's own
     changes; `--base` is accepted only for the lane M final review, as the plan's baseline. A round after code a
     debug episode or a merge added is headed `(added code round 1)`, the final review `(final review)`.``
     ``- From round 3 of a cycle, the final review not counted and a file added code changed counted from that
     code's own round 1, a new Must or Should outside the files the previous round's fix changed blocks only with
     `test:` or `command:`, else it is deferred in the ledger and leaves the stop; a new Should also rests on a
     ticket line or a failing case; `risk: data-loss` and `risk: security` always block. A round's fix is every
     commit from its head to the next head but merges, a debug episode's commits and records-only commits; each
     file it changes needs a finding of the round or a Ruling naming it, synced and `generated:` copies aside.``
  3. §10, the final reviewer bullet: after ``reads the whole diff once`` add
     `` (`accord review-package <id> --base <baseline>`, its round headed `(final review)`)``.
  4. §11, a new last bullet of the list: ``- for a version 2 `review.md`, the review scope checks of §10
     (ST-LN-57), skipped with a notice when HEAD is already on the default branch or the ticket is done there.``
- Then `npm run gen`, `npm run build`, `node packages/cli/dist/cli.js skills sync`, in that order. After the sync,
  `git status` shows changes only in files on this task's `files:` line; restore any other file the sync rewrote with
  `git restore -- <path>` and name it in your report (the Ruling on the sync).
- The new text names no gate rule id, no finding level word and no capitalised gate state word, so
  `no rendered text restates a rule the CLI enforces` in `packages/core/test/skills.test.ts` stays green; every
  command it names in backticks (`accord review-package`, `accord round`, `accord skills sync`) is registered, so
  `packages/cli/test/skill-commands.test.ts` stays green. Must not change: every phrase the existing tests of
  `stage-skills.test.ts` assert besides the two updated above.

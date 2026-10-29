---
baseline: 41d1bc15a6de022cb805ed93feda790207e4f26b
plan_hash: "fnv1a64:161e5f91935911ce"
---

# Plan: ST-LN-17

Review mode `outcome`: one branch, no slices.

Tasks:
1. Round record parser and loader (core)
2. `nextRound`, `fixModel` and `roundText` (core)
3. `accord round <id> [--plan]` and the return-from-verify git fact (CLI)
4. Gate rules on round records: `gate done` and `gate plan`
5. The `pre-tool-use` hook event refuses a fix executor on the wrong model
6. Skills: review, lane S and plan critique write round records and ask `accord round`
7. `scripts/compliance.mjs` counts cycles and owner allowances

Order: Tasks 1 and 2 are the pure core every following task consumes; Task 3 is the first end-to-end proof (`accord round` on a real git repository, printing the round, the cap and the model). The gate rules, the hook, the skills and the benchmark follow.

**Common to every task.** Commits carry no trailer of any kind: no `Co-Authored-By:`, no line whose first word ends in `-by:`, no "Generated with" line. New test titles hold no `@`, no comma and no apostrophe, and are top-level `it(...)` calls, so the case id is `<test file path>#<title with spaces as hyphens>`. A test that makes a commit uses `commitMsg` from `packages/cli/test/helpers/repo.ts` (`-F <file> --cleanup=verbatim`), never `-m`. Core code under `packages/core/src/` imports no `node:` module. Every git call the CLI adds passes a 64 MiB `maxBuffer`; every `git log` adds `-c log.showSignature=false` and `--no-show-signature`.

**Decisions this plan takes** (deferred to the plan by ledger Ruling 49 and D-10; each is a Ruling for the ledger):
- Ruling: the record version line is exactly `Round record: 1`, on its own line above the first `## ` heading of review.md or plan-review.md — a plain line any tool and person can write and grep — cost if wrong: a second spelling must be read.
- Ruling: a finding line is found by its head: strip leading whitespace, then repeatedly a list marker (`-`, `*`, `+`, `>` followed by whitespace), a number with `.` or `)`, emphasis characters (`*`, `_`, `~`, backtick) and an opening `(` or `[`; the first run of letters, compared in any case, must be `must`, `should` or `nice` (so `Mustard` and `Shouldn't` are prose). Its severity is unreadable when nothing follows the word (after stripping emphasis and a closing `)` or `]`), or when what follows starts with `/`, `|` or `?`, or with `or` or `and` followed by another severity word — the doubtful spellings an agent writes when it cannot decide — cost if wrong: a prose line that starts with a severity word is read as a finding (Ruling 30's stated cost).
- Ruling: a round with no findings holds a line whose head (stripped as above) starts `No findings`, in any case; a round section with neither a finding nor that line, or with both, is unreadable — a half-written round must not read as clean — cost if wrong: an empty round is refused.
- Ruling: review.md accepts only `## Round <n>` and `## Return from verify <sha>` headings, plan-review.md only `## Round <n> …` and `## Closed …` headings; any other `## ` heading after the version line is unreadable, and lines inside a fence or an HTML comment are never read — a finding under an unknown heading would otherwise be skipped — cost if wrong: a record with an extra heading is refused.
- Ruling: the loader reads the marker's sha as follows: for lane M, the sha is accepted when it is an ancestor of HEAD and some version of `accord/tickets/<id>/verification.md` in HEAD's history records `commit:` equal to it (prefix match, as `shaEqual` compares); for lane S (Ruling 41), when it is an ancestor of HEAD and review.md at that commit ends with a `verdict:` line Done accepts. The host supplies the answer as `returnFacts`; a marker the host did not confirm makes the record unreadable — cost if wrong: one `git log` and a few `git cat-file` reads per marker.
- Ruling: `accord round` prints `Fix executor model:` on exit 0 for a lane M review round, and on a not-converging stop below the cap as `Fix executor model for round <n>'s findings, if the owner allows more rounds: <m>` (Ruling 16); a refusal, a cap stop, lane S and plan critique print no model line (AC-2; lane S and plan critique have no fix executor) — cost if wrong: a session at a stop must ask again after the owner's answer.
- Ruling: plan critique treats a fifth round that reports findings as a stop for `gate plan` too (AC-4: "or record five rounds"), while review treats it as a stop only for `accord round` (AC-3 and Ruling 22 name only the Should-or-Must stop and rounds past the cap for `gate done`) — each gate follows its own criterion — cost if wrong: a review that converged at round 5 with a Nice open passes `gate done`.
- Ruling: the hook's deny output is Claude Code's PreToolUse JSON `{"hookSpecificOutput":{"hookEventName":"PreToolUse","permissionDecision":"deny","permissionDecisionReason":"<reason>"}}` on stdout with exit 0, and the allow output is `{}`; the input fields read are `tool_name` (`Agent`, or `Task` in older Claude Code), `tool_input.subagent_type`, `tool_input.model` and `cwd` — the tool name and input fields are the ones the benchmark fixtures record (`packages/core/test/benchmark-reader.test.ts` line 24); the deny shape is not documented anywhere in this repository — cost if wrong: Claude Code ignores the deny and only the printed model and the benchmark catch a miss (the fail-open cost the Approach already accepts).

## Task 1: Round record parser and loader

covers: D-04, D-05, D-10
files: packages/core/src/round/record.ts (new), packages/core/src/model/snapshot.ts, packages/core/src/load/snapshot.ts, packages/core/src/index.ts, packages/core/test/round-record.test.ts (new)
verify: packages/core/test/round-record.test.ts#risk:parsing-a-finding-line-is-read-by-its-head-and-a-doubtful-severity-is-unreadable, packages/core/test/round-record.test.ts#risk:parsing-cycles-split-at-a-return-from-verify-and-at-a-closed-line-and-a-heading-out-of-place-is-unreadable

Reads review.md and plan-review.md into round records, so every following task counts from the record alone (D-05; ledger Rulings 2, 3, 30, 36, 49). Pure string work, no git.

**Test first**, in the new `packages/core/test/round-record.test.ts`, calling `parseRounds` directly (import from `../src/index.js`):

1. Title `risk:parsing a finding line is read by its head and a doubtful severity is unreadable`. Parse, with kind `review`, a record whose text is `Round record: 1\n\n## Round 1\n\n` followed by these lines, one per line, and assert the severity read for each (in order), with `unreadable` empty:
   - `Must 1 [patch]: the writer drops the header — src/export.ts:3 — open` → Must
   - `- should 2 [patch]: x — y — fixed in abc1234` → Should
   - `**Nice** 3: x — y — deferred` → Nice
   - `1. Should — x — open` → Should
   - `2) MUST — x — open` → Must
   - `(Nice) x — y` → Nice
   - `Mustard is not a finding` → prose (no finding)
   - `Confirmed wording-only: src/a.ts` → prose
   - `verdict: converged` → not a finding (a verdict, see the rules below)
   Then parse five more records, each `Round record: 1\n\n## Round 1\n\nNice 9: z — y — deferred\n` followed by one of `Should/Must 1: x`, `Must? x`, `Should or Must 1: x`, `Nice` (the word alone) and `**Must**` (the word alone in emphasis): each yields exactly one `unreadable` entry, whose reason contains `severity` and whose line is that line's. Last, a ```` ``` ```` fence holding `Must 1: inside a fence` inside a round that also says `No findings` yields no finding and no unreadable entry.
2. Title `risk:parsing cycles split at a return from verify and at a closed line and a heading out of place is unreadable`. Assert:
   - Kind `review`: `Round record: 1`, `## Round 1` with one Must, `## Round 2` with `No findings`, `verdict: converged`, `## Return from verify abc1234`, `## Round 1` with one Nice → `versioned` true; two cycles; cycle 1 has 2 rounds, its `verdicts` holds one entry `{ value: 'converged', quoted: false, line: <its line> }`; cycle 2 has `marker: 'abc1234'` and 1 round; `unreadable` empty.
   - A `verdict: accepted-by-owner "ship it"` line gives `{ value: 'accepted-by-owner', quoted: true }`; `verdict: accepted-by-owner` with no quoted sentence gives `quoted: false`.
   - Kind `plan`: `Round record: 1`, `## Round 1 (whole)` with `1. Must — x — fixed`, `## Closed`, `## Round 1 (whole)` with `No findings` → two cycles, cycle 1 `closed` equal to the line of `## Closed`, cycle 2 has 1 round.
   - Each of these is unreadable, with a reason naming the line: `## Notes` in review.md; `## Closed` in review.md; `## Return from verify` in plan-review.md; `## Return from verify` with no sha; `## Round` with no number; a `## Round 2` holding only prose; a round holding both `No findings` and a finding; in review.md a `## Round 3` after `verdict: converged` with no marker between them. In plan-review.md a round after an acceptance verdict in the same segment is readable.
   - A text with no `Round record: 1` line gives `versioned: false`; the same line placed after the first `## ` heading also gives `versioned: false`.
   - CRLF and a BOM give the same record as LF.

**Types**, appended to `packages/core/src/model/snapshot.ts` (type-only file):

```ts
export type Severity = 'Must' | 'Should' | 'Nice';
export interface RoundFinding { severity: Severity; line: number; text: string } // text: the line trimmed, as written
export interface RecordedRound { line: number; findings: RoundFinding[]; noFindings: boolean } // line: of its ## Round heading
export interface RoundVerdict { value: string; quoted: boolean; line: number } // quoted: accepted-by-owner followed by a "sentence"
export interface RoundCycle { line: number; marker?: string; rounds: RecordedRound[]; verdicts: RoundVerdict[]; closed?: number }
export interface RoundRecord {
  file: string;
  kind: 'review' | 'plan';
  versioned: boolean; // a `Round record: 1` line above the first ## heading
  cycles: RoundCycle[]; // always at least one; review: split at ## Return from verify; plan: split after ## Closed
  unreadable: { line: number; reason: string }[];
}
```

Add to `TicketWork`: `rounds?: RoundRecord; // review.md as round records (ST-LN-17)` and `planRounds?: RoundRecord; // plan-review.md`. Add to both `SnapshotInput` and `RepoSnapshot`: `returnFacts?: Record<string, Record<string, boolean>>; // ST-LN-17: ticket id -> each ## Return from verify sha in its review.md -> whether the host confirmed it (Task 3 fills it)`.

**Parser**, `packages/core/src/round/record.ts`:

```ts
export const ROUND_RECORD_LINE = 'Round record: 1';
export function parseRounds(file: string, text: string, kind: 'review' | 'plan'): RoundRecord
```

Rules, in this order:
- `normaliseText` (from `../load/frontmatter.js`), then `scan(normal, 0)` (from `../load/sections.js`) for its sections and fences. Lines inside a fence, and text inside HTML comments (`stripHtmlComments`), are never read.
- `versioned`: a line whose trimmed text equals `ROUND_RECORD_LINE` appears before the first section's heading line.
- Walk the sections in order. The first cycle starts with `line: 1`. By `headingKey(section.heading)`:
  - `/^round(?:\s+([0-9]+)\b.*)?$/`: with no number, unreadable `line <n>: "## Round" names no round number`; otherwise a round of the current cycle. Its position in the cycle (1-based) is its round number; the written number is not used (Ruling 36).
  - review only, `/^return from verify(?:\s+(\S+))?$/`: starts a new cycle `{ line, marker }`; a missing value, or one that is not 7 to 40 hex characters, is unreadable `line <n>: "## Return from verify" names no commit sha` and the cycle gets no `marker`.
  - plan only, `/^closed\b/`: sets `closed` on the current cycle to the heading line and starts a new cycle at the next line.
  - anything else: unreadable `line <n>: "## <heading>" is not a heading a round record holds` followed by `(## Round <n>, ## Return from verify <sha>)` for review or `(## Round <n>, ## Closed)` for plan. Its lines are still read for verdicts and findings as below, attached to the current cycle's last round when there is one.
- Each line of a section, trimmed: a line matching `/^verdict:\s*(\S+)(.*)$/` is a verdict of the current cycle, `quoted` true when the value is `accepted-by-owner` and the rest matches `/^\s+".*\S.*"\s*$/`. Otherwise apply the head rule from the preamble Ruling: strip `/^(?:[-*+>]\s+|\d+[.)]\s*|[*_~`]+|[([]\s*)/` repeatedly; `/^no findings\b/i` on the stripped text sets `noFindings`; otherwise take `/^[A-Za-z]+/`; when it is `must`, `should` or `nice` in any case, strip `/^[*_~`)\]]+/` from what follows it, and the line is unreadable `line <n>: a finding whose severity accord cannot read: "<trimmed line>"` when that rest is empty or matches `/^\s*(?:[/|?]|(?:or|and)\s+(?:must|should|nice)\b)/i`; else it is a finding `{ severity: 'Must' | 'Should' | 'Nice' (capitalised), line, text: trimmed line }`. Every other line is prose. A finding outside any round (above the first round of a cycle) is unreadable `line <n>: a finding outside a ## Round section`.
- After the walk: a round with no finding and no `noFindings` is unreadable `round <position> at line <n> holds no finding and no "No findings" line`; one with both is unreadable `round <position> at line <n> says No findings and lists findings`. Review only: a round whose heading line comes after a verdict line of the same cycle is unreadable `line <n>: a round follows the verdict at line <m> with no ## Return from verify between them`.
- `unreadable` sorted by line.

**Loader**, `packages/core/src/load/snapshot.ts`: `WORK` becomes `/^accord\/tickets\/([^/]+)\/(plan-review|plan|ledger|review)\.md$/` (with its kind type widened). In the loop, `review` also sets `entry.rounds = parseRounds(file, files[file], 'review')`, and `plan-review` sets `entry.planRounds = parseRounds(file, files[file], 'plan')`. Carry `returnFacts` through like `reviewFacts` (spread only when present). An orphan plan-review.md now reports `load.work-orphan` like the other records.

**Exports**, `packages/core/src/index.ts`: `parseRounds`, `ROUND_RECORD_LINE`, and the new types.

Behaviour that must not change: `parseReview`, `parsePlan`, `parseLedger` and the `Review` object, byte for byte (their tests in `packages/core/test/work.test.ts` stay green untouched); a repository without plan-review.md or review.md loads exactly as before, so every golden under `packages/core/test/` and `packages/cli/test/` stays unchanged; non-lane tickets still get no work record.

Consumes: record text. Produces: `parseRounds`, `ROUND_RECORD_LINE`, `RoundRecord` on `work.rounds` and `work.planRounds`, `returnFacts` on the snapshot — read by Tasks 2 to 5.

Done when `packages/core/test/round-record.test.ts`, `packages/core/test/work.test.ts` and the whole core suite pass, and `npm run lint` and `npm run typecheck` pass.

## Task 2: nextRound, fixModel and roundText

covers: @ac-1, @ac-2, D-01, D-02, D-06, D-07, D-08, D-09
files: packages/core/src/round/next.ts (new), packages/core/src/index.ts, packages/core/test/round-next.test.ts (new)
verify: packages/core/test/round-next.test.ts#ac-1-the-round-record-gives-the-round-the-cap-and-the-fix-executor-model-and-the-tier-stays-raised-after-verify (@ac-1), packages/core/test/round-next.test.ts#ac-2-an-unreadable-record-or-a-round-past-the-cap-gets-no-next-round-until-an-owner-allowance-lets-exactly-that-many-run (@ac-2), packages/core/test/round-next.test.ts#risk:complex-branching-a-stop-from-round-3-holds-until-a-no-findings-round-after-an-allowance-and-a-marker-after-an-unaccepted-stop-is-unreadable, packages/core/test/round-next.test.ts#risk:calculation-the-fix-executor-model-tiers-up-by-family-and-refuses-a-model-it-cannot-tier

The pure decision `accord round`, the gates and the hook all read. Consumes Task 1's `RoundRecord` on `work.rounds` / `work.planRounds`, `snapshot.returnFacts`, `work.ledger.rulings`, the ticket's `## Approach` section, and `config.models.executor` / `config.escalation.fix_round_tier_up`. Implements D-01 (the cap restarts per cycle, the tier stays raised), D-07 with D-09 (the stop from round 3 on a round that still reports a Should or a Must), D-08 (a round with no findings starts no stop), D-02 and D-06 (the stop names the Approach and asks about a change of course), and ledger Rulings 4, 6, 7, 8, 10, 13, 17, 20, 21, 23, 26, 27, 29, 37, 39, 40, 42, 43, 46, 47, 48.

**Test first**, in the new `packages/core/test/round-next.test.ts`. Build in-memory repositories with `building(files, 'T-1')`, `laneTicket`, `LANE_S_BODY`, `CONFIG` and `P` from `../../../test/helpers/lane.js`; load with `loadSnapshot({ files, tree: Object.keys(files) })` (plus `returnFacts` when a test supplies it) from `../src/index.js`. The config is `CONFIG + 'models:\n  executor:\n    model: sonnet\nescalation:\n  fix_round_tier_up: 4\n'`. The ledger is `'## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n'` plus any allowance line. A helper `round(n, ...lines)` returns `'## Round ' + n + '\n\n' + lines.join('\n') + '\n\n'`; every review.md starts `'Round record: 1\n\n'`. Finding lines use the review grammar, for example `Should 1 [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235`.

1. Title `ac-1 the round record gives the round the cap and the fix executor model and the tier stays raised after verify`. Lane M T-1; review.md = rounds 1 (a Must), 2 (a Should and a Nice, so it reports more findings than round 3) and 3 (one Nice only). `nextRound(s, 'T-1', 'review')` has `kind: 'next'`, `round: 4`, `cap: 5`, `cycle: 1`, `model: 'opus'`, and `roundText` of it equals `'Round: 4 of 5\nCycle: 1\nFix executor model: opus\n'`. Then append round 4 (one Nice), `verdict: converged\n\n` and `## Return from verify abc1234def\n`, load with `returnFacts: { 'T-1': { abc1234def: true } }`: the answer is `next`, `round: 1`, `cap: 5`, `cycle: 2`, `model: 'opus'`.
2. Title `ac-2 an unreadable record or a round past the cap gets no next round until an owner allowance lets exactly that many run`. For lane M T-1 and for a lane S ticket S-1 (`laneTicket('S-1', { lane: 'S', body: LANE_S_BODY })`), each:
   - review.md with a round holding `Should/Must 1: x — y — open` beside a readable finding: `kind: 'refused'`, `model` undefined, a reason containing `severity`, and `roundText` starting `refused: `.
   - review.md with rounds 1 and 2 (a Must each) and 3, 4, 5 (one Nice each): `kind` is not `next`, `model` undefined, a reason containing `the cap of 5 rounds`, and `roundText` starting `stop: report to owner\n`.
   - Add to the ledger `- Ruling: the owner allows 2 more review rounds after round 5 of cycle 1 — "two more then stop" — cost if wrong: two more rounds`: the answer is `next`, `round: 6`, `cap: 7`. Append round 6 (one Nice): `next`, `round: 7`. Append round 7 (one Nice): `kind` is not `next`, `model` undefined, a reason containing `the cap of 7 rounds`.
3. Title `risk:complex-branching a stop from round 3 holds until a no findings round after an allowance and a marker after an unaccepted stop is unreadable`. Lane M T-1:
   - Rounds 1, 2 (a Must each) and 3 (a Should): `kind: 'stop'`, a reason naming `round 3 of cycle 1`, `findings` `[{ round: 3, lines: [<that Should line>] }]`, `approach` containing `Extend the existing report writer with a csv mode.`, `model: 'sonnet'` with `modelFor: 3`; `roundText` starts `stop: report to owner\n` and contains `Approach:\n`, the Should line, `verdict: accepted-by-owner "<the owner's sentence>"`, `Ruling: the owner allows <n> more review rounds after round 3 of cycle 1 — "<the owner's sentence>" — <cost if wrong>` and `Fix executor model for round 3's findings, if the owner allows more rounds: sonnet`.
   - With the allowance `1 more review rounds after round 3 of cycle 1`: `next`, `round: 4`, `model: 'opus'`. Append round 4 with a Should: `stop`, reason naming `round 4 of cycle 1`. Replace that round 4 with `No findings`: `next`, `round: 5`.
   - Rounds 1 to 3 where round 3 says `No findings`: `next`, `round: 4` (D-08).
   - Rounds 1 to 3 with the round 3 Should, then `verdict: converged`, `## Return from verify abc1234def` (confirmed in `returnFacts`) and round 1: `refused`, a reason containing `did not accept`. With `verdict: accepted-by-owner "go on"` instead: `next`, `cycle: 2`, `round: 2`. With the acceptance but no `returnFacts`: `refused`, a reason containing `cannot confirm`.
   - The same rounds 1 to 3 without the `Round record: 1` line: `refused`, a reason containing `Round record: 1`.
   - Rounds 1 and 2 then `verdict: converged` and no marker: `refused`, a reason containing `verdict: converged`.
   - Lane S S-1, rounds 1 to 3 with the round 3 Should: `stop`, no `approach`, no `model`, and `roundText` contains `lift to lane M` and no `Approach:`.
4. Title `risk:calculation the fix executor model tiers up by family and refuses a model it cannot tier`. `fixModel(s, id, round)` on lane M T-1, with review.md rounds 1 to 3 (a Nice each):
   - executor `haiku`, round 4 → `{ model: 'sonnet' }`; `opus`, round 4 → `{ model: 'opus' }`; `claude-sonnet-4-5`, round 4 → `{ model: 'opus' }`; `claude-sonnet-4-5`, round 3 → `{ model: 'sonnet' }`; `inherit`, round 3 → `{ model: 'inherit' }`; `inherit`, round 4 → `{ refused }` containing `models.executor.model`; no `models:` key, round 4 → `{ model: 'opus' }` (default sonnet); `fix_round_tier_up: 2`, round 2 → `{ model: 'opus' }`.
   - Sticky: rounds 1 to 4, `verdict: converged`, a marker, round 1: `fixModel(s, 'T-1')` (no round: the latest recorded, round 1 of cycle 2) → `{ model: 'opus' }`.
   - Ruling 43: a record whose round 4 holds `Should/Must 1: x` still gives `fixModel(s, 'T-1')` = `{ model: 'opus' }`.
   - Lane S S-1 → `undefined`; lane M with no review.md and no round → `undefined`.

**Interface**, `packages/core/src/round/next.ts`:

```ts
export const ROUND_CAP = 5;
export type RoundKind = 'review' | 'plan';
export interface Allowance { n: number; after: number; cycle: number }
export interface RoundAnswer {
  kind: 'next' | 'stop' | 'refused';
  ticket: string;
  record: RoundKind;
  laneS: boolean;
  cycle: number;     // 1-based; the last cycle of the record
  round: number;     // next: the round given; stop and refused: the latest recorded round (0 when none)
  cap: number;       // ROUND_CAP, or the end of the furthest allowance of this cycle
  reasons: string[]; // stop and refused; empty on next
  findings?: { round: number; lines: string[] }[]; // stop: the stop round's finding lines, then the latest round's when it differs
  approach?: string[]; // stop on a lane M ticket: the ## Approach lines
  model?: string;
  modelFor?: number; // the round `model` is for
}
export function allowancesOf(snapshot: RepoSnapshot, id: string, kind: RoundKind): Allowance[];
export function cycleState(cycle: RoundCycle, allowances: Allowance[], kind: RoundKind): {
  cap: number;
  allowed: (p: number) => boolean;
  stopAt: (q: number) => number | undefined;
};
export function recordProblems(snapshot: RepoSnapshot, id: string, kind: RoundKind): { line: number; reason: string }[];
export function nextRound(snapshot: RepoSnapshot, id: string, kind: RoundKind): RoundAnswer;
export function fixModel(snapshot: RepoSnapshot, id: string, round?: number): { model: string } | { refused: string } | undefined;
export function modelFamily(model: string): 'haiku' | 'sonnet' | 'opus' | undefined; // the family rule of fixModel below
export function planStopOf(cycle: RoundCycle, allowances: Allowance[]): number | undefined;
export function roundText(answer: RoundAnswer): string;
```

Export all of them from `packages/core/src/index.ts`. Use `workOf` from `../gate/work.js`, `AGENT_DEFAULTS` from `../skills/agents.js`, `headingKey` and `stripHtmlComments` from `../load/sections.js`.

**Rules.**
- `allowancesOf`: each of `work.ledger.rulings` matching `/^Ruling: the owner allows ([1-9][0-9]*) more (review|plan critique) rounds after round ([1-9][0-9]*) of cycle ([1-9][0-9]*) — ".*\S.*" — \S/` whose second group is `review` (kind review) or `plan critique` (kind plan). A line that does not match grants nothing (Rulings 27, 37).
- `cycleState`, for a cycle with rounds 1..L (positions):
  - `stopAt(q)`: the largest `s` with `3 <= s <= q` whose round has a Must or Should finding, such that no round `t` with `s < t <= q` has `noFindings`, and, for kind plan, no quoted `accepted-by-owner` verdict of the cycle lies between round `s`'s heading line and round `q + 1`'s heading line (the end of the cycle when `q` is the last round). Undefined when there is none.
  - `allowed(p)`: `(p <= ROUND_CAP && (p === 1 || stopAt(p - 1) === undefined)) || allowances.some((a) => a.after < p && p <= a.after + a.n)`; an allowance lifts the cap and a stop alike, for its own cycle only (Rulings 10, 17).
  - `cap`: `Math.max(ROUND_CAP, ...allowances.map((a) => a.after + a.n))`.
  - The caller passes only the allowances whose `cycle` is this cycle's 1-based index.
- `recordProblems`: `rec.unreadable`, plus, for kind review, for every cycle `i >= 2`: when it has a `marker` and `snapshot.returnFacts?.[id]?.[marker] !== true`, `## Return from verify <sha> names a commit accord cannot confirm` followed by, for lane M, `: it must be an ancestor of HEAD that verification.md recorded as its commit`, for lane S, `: it must be an ancestor of HEAD at which review.md ended with its verdict`; when cycle `i - 1` has no round, `a return from verify with no round before it`; when it has no verdict, `cycle <i-1> has no verdict: line before ## Return from verify`; when `cycleState(cycle i-1).stopAt(its L)` is defined and its last verdict is not a quoted `accepted-by-owner`, `## Return from verify follows the stop at round <s> of cycle <i-1>, which the owner did not accept with verdict: accepted-by-owner "<sentence>"` (Ruling 26). For kind plan, for every cycle with `closed`: when `planStop(cycle)` (below) is defined, `## Closed while the stop at round <s> holds; the owner accepts with verdict: accepted-by-owner "<sentence>" after that round, or a round that reports no findings clears it` (Ruling 24). Each problem's `line` is the marker or `## Closed` heading line, and its reason is prefixed `line <n>: `.
  - `planStop(cycle)` (module-private, exported for Task 4 as `planStopOf(cycle, allowances)`): `stopAt(L)`, else `L` when `L >= cap`, the last round has findings and no quoted acceptance lies after its heading line; else undefined (Ruling 29, AC-4).
- `nextRound(snapshot, id, kind)`, in order:
  1. Not a lane ticket: `refused`, `<id> is not a lane ticket`. Kind plan on lane S: `refused`, `lane S has no plan critique`.
  2. `rec` = `work.rounds` (review) or `work.planRounds` (plan). Absent, or not `versioned` with no round in any cycle: `next`, round 1, cap 5, cycle 1 (with the model for round 1 under the next rule).
  3. Not `versioned`: `refused`, `<file> has no record version line; add the line "Round record: 1" above its first ## heading and ask again: its rounds count as cycle 1` (Ruling 40).
  4. `recordProblems` non-empty: `refused` with every problem's reason, in line order.
  5. `k` = number of cycles, `cyc` = the last; `L` = its rounds. When its last verdict's line is after its last round's heading line (or it has a verdict and no round), and that verdict is a quoted `accepted-by-owner` or `cycleState(...).stopAt(L)` (for plan, `planStopOf`) is undefined — a `verdict: converged` written over a stop does not hide the stop, which step 8 prints — `refused`, `<file> ends cycle <k> with verdict: <value> at line <n>` followed by, for review, `; a new cycle starts with a ## Return from verify <sha> line`, for plan, `; append a ## Closed line`.
  6. `st = cycleState(cyc, allowances of cycle k, kind)`, `p = L + 1`. When `st.allowed(p)`: `next`, `round: p`, `cap: st.cap`; for kind review on a lane M ticket, `fixModel(snapshot, id, p)`: `{ model }` sets `model` and `modelFor: p`; `{ refused }` turns the answer into `refused` with that reason and no model.
  7. Otherwise, when round L has `noFindings`: `refused`, `round <L> of cycle <k> reported no findings and the cap of <cap> rounds is reached; the loop has ended: write the verdict` (Ruling 48).
  8. Otherwise, when `s = st.stopAt(L)` is defined (both kinds): `stop`, reasons `round <s> of cycle <k> still reports a Should or a Must, and from round 3 such a round stops the loop`, plus `the cap of <cap> rounds in cycle <k> is reached` when `L >= st.cap`; `findings` round s's finding texts, then round L's when `L !== s`; `approach` for a lane M ticket; for kind review on a lane M ticket with `L < st.cap`, `fixModel(snapshot, id, L)` as `model` with `modelFor: L` when it gives `{ model }`.
  9. Otherwise: `stop`, reason `the cap of <cap> rounds in cycle <k> is reached and no owner Ruling in the ledger allows more`, `findings` round L's finding texts, `approach` for lane M, no model.
- `fixModel(snapshot, id, round?)`: undefined unless the ticket is lane M. `rec = work.rounds`; `r = round ?? the last cycle's round count`; undefined when `r === 0`. `T = Number(config?.escalation?.fix_round_tier_up ?? '4')`, 4 when not a positive integer. Raised when `r >= T` or any cycle of `rec` has `T` or more rounds (Rulings 4, 43: headings only, never finding lines, so `rec.unreadable` is ignored here). `base = config?.models?.executor?.model ?? AGENT_DEFAULTS.executor.model`; its family is the base itself when it is `haiku`, `sonnet` or `opus` (any case), else the match of `/^claude-(?:[a-z0-9.]+-)*?(haiku|sonnet|opus)(?:-|$)/i`, else none. Not raised: `{ model: family ?? base }`. Raised with no family: `{ refused: 'the executor model "<base>" in accord/config.yml (models.executor.model) cannot be tiered up; set it to haiku, sonnet or opus' }` (Ruling 23). Raised: the next of `haiku`, `sonnet`, `opus`, with `opus` staying `opus` (Ruling 42).
- `roundText`:
  - next: `Round: <round> of <cap>\nCycle: <cycle>\n`, then `Fix executor model: <model>\n` when `model` is set.
  - refused: one line `refused: <reason>\n` per reason.
  - stop: `stop: report to owner\n`; one `Reason: <reason>\n` per reason; per `findings` entry `Findings of round <round>:\n` and its lines; for a lane M ticket `Approach:\n` and its lines (Ruling 8: the whole section, comments stripped, leading and trailing blank lines dropped); then `Ask the owner whether to change course: weigh the options the Approach above rejected or held in reserve against going on.\n` (lane M) or `Ask the owner whether to change course: in lane S the change of course is the lift to lane M (lane-s.md).\n` (lane S, Ruling 20); then `To accept the open findings: end <review.md|plan-review.md> with the line verdict: accepted-by-owner "<the owner's sentence>"\n` and `To allow more rounds: add under ## Rulings in the ledger: Ruling: the owner allows <n> more <review|plan critique> rounds after round <round> of cycle <cycle> — "<the owner's sentence>" — <cost if wrong>\n`; last, when `model` is set, `Fix executor model for round <modelFor>'s findings, if the owner allows more rounds: <model>\n`.

Behaviour that must not change: nothing outside the new module and the export lines; `packages/core/test/round-record.test.ts` stays green.

Produces: the functions above, consumed by Task 3 (`accord round`), Task 4 (gate rules: `cycleState`, `planStopOf`, `recordProblems`, `allowancesOf`) and Task 5 (the hook: `fixModel`).

Done when `packages/core/test/round-next.test.ts` and the core suite pass, and `npm run lint` and `npm run typecheck` pass.

## Task 3: accord round and the return-from-verify git fact

covers: D-01, D-05
files: packages/cli/src/commands/round.ts (new), packages/cli/src/load/fs.ts, packages/cli/src/run.ts, packages/core/src/index.ts, packages/cli/test/round.test.ts (new), packages/cli/test/skill-commands.test.ts
verify: packages/cli/test/round.test.ts#risk:complex-branching-accord-round-exits-0-with-the-round-and-model-and-1-when-git-cannot-confirm-a-return-from-verify

The first end-to-end proof: `accord round <id> [--plan]` on a real git repository prints what Task 2 decides, and the host confirms each `## Return from verify <sha>` marker from git (preamble Ruling on the marker's sha; ledger Rulings 38, 41). Exit 0 for a next round, 1 for a stop or a refusal, 2 for a usage error (the Approach).

**Test first**, in the new `packages/cli/test/round.test.ts`, driving the CLI in-process with `run(argv, cwd)` and the helpers `makeLaneRepo`, `writeFiles`, `commitMsg`, `gitRun`, `cleanup` from `./helpers/repo.js`, and `laneTicket`, `LANE_S_BODY` from `../../../test/helpers/lane.js`. Title `risk:complex-branching accord round exits 0 with the round and model and 1 when git cannot confirm a return from verify`; timeout `120_000`; `cleanup(repo)` in a `finally`.
1. `repo = makeLaneRepo({ 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }), 'accord/tickets/T-1/ledger.md': '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n', 'accord/tickets/T-1/review.md': REVIEW })`, where `REVIEW` = `'Round record: 1\n\n## Round 1\n\nMust 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234\n\n## Round 2\n\nShould 1 [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235\n\n## Round 3\n\nNice 1 [patch]: rename w — src/export.ts:1 — deferred\n'`; `sha1 = commitMsg(repo, 'fixture')`. accord computes opus for round 4 because the executor model is the default sonnet and `escalation.fix_round_tier_up` the default 4.
2. `run(['round', 'T-1'], repo)` equals `{ code: 0, out: 'Round: 4 of 5\nCycle: 1\nFix executor model: opus\n', err: '' }`.
3. Write `accord/tickets/T-1/verification.md` = `'---\nticket: "T-1"\ncommit: "' + sha1 + '"\nreviewed_on: "2026-10-30"\n---\n'`; `sha2 = commitMsg(repo, 'verify: T-1')`. Append to review.md `'\n## Round 4\n\nNice 1 [patch]: a comment typo — src/export.ts:2 — deferred\n\nverdict: converged\n\n## Return from verify ' + sha1 + '\n'`; `commitMsg(repo, 'review: T-1 return from verify')`. `run(['round', 'T-1'], repo)` equals `{ code: 0, out: 'Round: 1 of 5\nCycle: 2\nFix executor model: opus\n', err: '' }`.
4. Replace the marker's sha with `sha2` (an ancestor of HEAD that verification.md never recorded) and commit: the run has `code: 1`, and `out` starts `refused: ` and contains `cannot confirm`. The same with `deadbeefdeadbeef` (no such commit): `code: 1`, `cannot confirm`.
5. `run(['round', 'T-1', '--plan'], repo)` (no plan-review.md) equals `{ code: 0, out: 'Round: 1 of 5\nCycle: 1\n', err: '' }`.
6. `run(['round', 'S-1', '--plan'], repo)` has `code: 2` and `err` containing `lane S has no plan critique`; `run(['round', 'NOPE-1'], repo)` has `code: 2`.

**Command**, the new `packages/cli/src/commands/round.ts`:

```ts
/** ST-LN-17: the next review or plan critique round, its cap and the fix executor's model, or the stop or refusal; exit 0 only for a next round. */
export function round(ctx: CommandContext, id: string, options: { plan?: boolean }): number
```

- `const ticket = requireLaneTicket(ctx, id)` (from `./lane-args.js`; a non-lane or unknown id exits 2).
- `options.plan === true` on a lane S ticket: `throw new UsageError('lane S has no plan critique; accord round ' + id + ' counts its review rounds')`.
- Kind review: `snapshot = withReturnFacts(ctx.root, ctx.snapshot, id)`; kind plan: `ctx.snapshot`.
- `answer = nextRound(snapshot, id, kind)`; `ctx.stdout.write(roundText(answer))`; return `answer.kind === 'next' ? 0 : 1`. Nothing goes to stderr.

**Git fact**, in `packages/cli/src/load/fs.ts`, two exported functions placed after `gitAfterReview`:

```ts
/** ST-LN-17: each ## Return from verify sha of the ticket's review.md -> confirmed by git (ledger Rulings 38, 41). */
export function gitReturnFacts(root: string, id: string, lane: 'M' | 'S', shas: readonly string[]): Record<string, boolean>
/** `snapshot` with returnFacts[id] set when its review.md holds a marker; `snapshot` itself otherwise. */
export function withReturnFacts(root: string, snapshot: RepoSnapshot, id: string): RepoSnapshot
```

- `withReturnFacts`: `shas` = the `marker` of every cycle of `snapshot.work?.[id]?.rounds` that has one; none → return `snapshot`. Otherwise `{ ...snapshot, returnFacts: { ...snapshot.returnFacts, [id]: gitReturnFacts(root, id, lane, shas) } }`, `lane` being `'S'` for a lane S ticket and `'M'` otherwise.
- `gitReturnFacts`: `ancestor = gitAncestors(root, shas)` (the existing module-private function: `git merge-base --is-ancestor <sha> HEAD`, any failure false). A sha that is not an ancestor is false.
  - Lane M: list the commits of HEAD that touch verification.md: `execFileSync('git', ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', '--format=%H', 'HEAD', '--', ':(literal)accord/tickets/' + id + '/verification.md'], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })`, split on `\0`, empty entries dropped; a throw gives no commits. For each commit read the file with `gitFilesAt(root, commit, [path])` (a throw counts as absent), take the frontmatter (the lines between the first line `---` and the next `---`), and its `commit:` value with `/^commit:\s*["']?([0-9a-fA-F]{7,40})["']?\s*$/m`. A sha is true when it is an ancestor and `shaEqual(recorded, sha)` holds for some recorded value.
  - Lane S: a sha is true when it is an ancestor and `gitFilesAt(root, sha, ['accord/tickets/' + id + '/review.md'])` holds a text whose last non-blank line, trimmed, matches `/^verdict:\s*(converged|accepted-by-owner)(\s|$)/`.
- Export `shaEqual` from `packages/core/src/index.ts` beside `isSha`.

**Registration**, in `packages/cli/src/run.ts`, after the `review-package <id>` command:

```ts
  program
    .command('round <id>')
    .description('print the next review round, its cap and the fix executor model, or the stop or refusal; --plan counts plan critique rounds')
    .option('--plan', 'count the plan critique rounds in plan-review.md')
    .action((id: string, options: { plan?: boolean }) => {
      setCode(round(preflight(opts), id, options));
    });
```

**Command list**, `packages/cli/test/skill-commands.test.ts` line 92: add `'round'` after `'review-package'` in the expected array. Nothing else in that file changes.

Behaviour that must not change: every other command, its description and its preflight mode; `accord anchor` is not touched (the Approach rejected adding rounds to it); every existing function in `fs.ts` byte for byte, including `gitAncestors`, `gitFilesAt`, `gitReviewFact` and `gitAfterReview`; `packages/cli/test/skill-commands.test.ts` passes, as do `packages/cli/test/lane-commands.test.ts` and `packages/cli/test/load.test.ts`.

Consumes: `nextRound`, `roundText`, `shaEqual` (core). Produces: `accord round`, which Task 6's skills call; `withReturnFacts`, which Task 4's `gate done` uses.

Done when `packages/cli/test/round.test.ts`, `packages/cli/test/skill-commands.test.ts` and the CLI suite pass after `npm run build`, and `npm run lint` and `npm run typecheck` pass.

## Task 4: Gate rules on round records for gate done and gate plan

covers: @ac-3, @ac-4, D-07, D-09
files: packages/core/src/gate/rounds.ts (new), packages/core/src/gate/rules.ts, packages/cli/src/commands/gate.ts, packages/core/test/round-gate.test.ts (new), packages/cli/test/lane-flow.test.ts, packages/cli/test/lane-s.test.ts, packages/cli/test/branch-fact.test.ts
verify: packages/core/test/round-gate.test.ts#ac-3-a-review-that-stops-converging-stops-for-the-owner-and-gate-done-fails-until-acceptance-or-convergence (@ac-3), packages/core/test/round-gate.test.ts#ac-4-the-plan-critique-loop-has-the-same-cap-and-stop-and-gate-plan-fails-until-acceptance-or-a-no-findings-round (@ac-4), packages/core/test/round-gate.test.ts#risk:complex-branching-gate-done-fails-a-cycle-past-its-cap-and-reads-an-unversioned-record-by-the-old-rules-only-when-done-on-the-default-branch

`gate done` (lanes M and S) and `gate plan` refuse a stop the owner has not lifted, a round run past the cap or past a stop, and an unreadable record, so the cap and the stop hold in Cursor and Codex too (D-07, D-09; ledger Rulings 9, 13, 19, 21, 22, 24, 26, 29, 33, 37, 39, 40, 47). Consumes, from `packages/core/src/round/next.ts` (Task 2): `allowancesOf(snapshot, id, kind): { n, after, cycle }[]` (the owner allowance Rulings of the ledger); `cycleState(cycle, allowances, kind): { cap, allowed(p), stopAt(q) }` (`allowed(p)`: round position p may run; `stopAt(q)`: the round whose stop holds after round q, or undefined); `planStopOf(cycle, allowances): number | undefined` (the plan stop, the cap included); `recordProblems(snapshot, id, kind): { line, reason }[]` (unreadable lines, unconfirmed or unaccepted markers, a `## Closed` during a stop); `nextRound` and `roundText`. From Task 1: `work.rounds` / `work.planRounds` (`RoundRecord`: `file`, `versioned`, `cycles[]` each with `rounds[]` (`line`, `findings[]`, `noFindings`) and `verdicts[]` (`value`, `quoted`, `line`)). From Task 3: `withReturnFacts(root, snapshot, id)` in `packages/cli/src/load/fs.ts`.

**Test first**, in the new `packages/core/test/round-gate.test.ts`, with in-memory repositories: `building`, `done`, `laneTicket`, `LANE_S_BODY`, `CONFIG` and `P` from `../../../test/helpers/lane.js`; `loadSnapshot` (called as `loadSnapshot({ files, tree: Object.keys(files) })`), `gateDone`, `gatePlan`, `nextRound` and `roundText` from `../src/index.js`. `rule(result, id)` = the findings of that rule id. Each assertion on a gate reads only the round rule's findings, since an in-memory ticket fails other Done rules. Every review.md and plan-review.md starts `'Round record: 1\n\n'` unless a step says otherwise; a review round is `'## Round <n>\n\n' + lines + '\n\n'`; a review Must line is `Must 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234`, a Nice line `Nice 1 [patch]: rename w — src/export.ts:1 — deferred`. The ledger is `'## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n'` plus the Ruling line a step names.

1. Title `ac-3 a review that stops converging stops for the owner and gate done fails until acceptance or convergence`. `done(files, 'T-1')`, then review.md = `Round record: 1`, rounds 1 and 2 (a Must each), round 3 (`Should 1 [patch]: a comma is not quoted — src/export.ts:9 — fixed in abc1235`), `verdict: converged`.
   - `nextRound(s, 'T-1', 'review')`, on the record both without and with its `verdict: converged` line, has `kind: 'stop'`; its `roundText` starts `stop: report to owner\n` and contains the round 3 Should line and `Approach:\nExtend the existing report writer with a csv mode.`; `gateDone(s, 'T-1')` has `verdict: 'fail'` and a `gate.review-rounds` finding whose reason contains `round 3 of cycle 1`.
   - The same record ending `verdict: accepted-by-owner "ship it with the comma issue open"` instead: no `gate.review-rounds` finding.
   - Ending, instead, with round 4 `No findings` and `verdict: converged`, and the ledger holding `- Ruling: the owner allows 1 more review rounds after round 3 of cycle 1 — "one more" — cost if wrong: one round`: no `gate.review-rounds` finding. Without that Ruling: a `gate.review-rounds` finding containing `round 4 of cycle 1`.
   - A lane S ticket S-1 (`laneTicket('S-1', { lane: 'S', body: LANE_S_BODY })`) with the same three rounds and `verdict: converged`: `nextRound` is a `stop` and `gateDone` has a `gate.review-rounds` finding; with the quoted acceptance instead, none.
2. Title `ac-4 the plan critique loop has the same cap and stop and gate plan fails until acceptance or a no findings round`. `building(files, 'T-1')`; plan-review.md = `Round record: 1`, `## Round 1 (whole)` with `1. Must — x — fixed`, `## Round 2 (diff)` with `1. Should — y — fixed`, `## Round 3 (diff)` with `1. Should — z — open`.
   - `nextRound(s, 'T-1', 'plan')` is a `stop`; its `roundText` starts `stop: report to owner\n`, contains `1. Should — z — open`, `Approach:\n`, `more plan critique rounds after round 3 of cycle 1`, and no `Fix executor model`; `gatePlan(s, 'T-1')` has a `gate.plan-rounds` finding and `verdict: 'fail'`.
   - Appending `verdict: accepted-by-owner "the plan is good enough"`: no `gate.plan-rounds` finding; appending `## Closed` after it as well: still none (Ruling 39).
   - `## Closed` right after round 3 with no acceptance: a `gate.plan-rounds` finding containing `## Closed while the stop`.
   - The ledger Ruling `- Ruling: the owner allows 1 more plan critique rounds after round 3 of cycle 1 — "one more" — cost if wrong: one round` and `## Round 4 (diff)` with `No findings`: no `gate.plan-rounds` finding (Ruling 47).
   - Five rounds each `1. Nice — n — deferred`: `nextRound(…, 'plan')` is a `stop` with a reason containing `the cap of 5 rounds`, and `gatePlan` has a `gate.plan-rounds` finding (Ruling 29).
   - Those five rounds, then `verdict: accepted-by-owner "enough"`, `## Closed`, `## Round 1 (whole)` with `No findings`: `nextRound` is `next` with `cycle: 2` and `round: 2`, and no `gate.plan-rounds` finding: rounds count only after the last `## Closed`.
3. Title `risk:complex-branching gate done fails a cycle past its cap and reads an unversioned record by the old rules only when done on the default branch`.
   - `done(files, 'T-1')` with a versioned review.md of six rounds, one Nice each, and `verdict: converged`: a `gate.review-rounds` finding containing `round 6 of cycle 1` and `past the cap of 5 rounds`. With `- Ruling: the owner allows 1 more review rounds after round 5 of cycle 1 — "one more" — cost if wrong: one round`: none.
   - The same six rounds without the `Round record: 1` line: no `gate.review-rounds` finding when the snapshot has no `defaultRef`; with `defaultRef: { ref: 'refs/heads/main', snapshot: loadSnapshot(<the files of building(…, 'T-1')>) }` set on the snapshot (T-1 at build there), a finding containing `Round record: 1`; with `defaultRef.snapshot` loaded from the `done` files (T-1 done there), none.
   - The same for plan-review.md and `gatePlan`: unversioned five Nice rounds with a `defaultRef` where T-1 is not done gives a `gate.plan-rounds` finding containing `Round record: 1`.

**Rules**, the new `packages/core/src/gate/rounds.ts`, two `GateRule['check']` functions:

```ts
export const reviewRounds: GateRule['check'];
export const planRounds: GateRule['check'];
```

Both are silent unless `laneTicket(snapshot, id)` (from `./work.js`) holds the ticket and its record (`work.rounds` for review, `work.planRounds` for plan) exists. Every finding has `file` = the record's file and, when it names a line, `line`.
- Unversioned record: silent when no cycle holds a round, when `snapshot.defaultRef` is absent (Ruling below), or when `doneOnDefault(snapshot, id)` (from `../status/stage.js`) is true — the old rules (Rulings 19, 40). Otherwise one finding: `<review.md|plan-review.md> has no record version line; add the line "Round record: 1" above its first ## heading`, and nothing else is checked.
- `recordProblems(snapshot, id, kind)`: one finding per problem, with its line.
- For each cycle `i` (1-based), with `allowancesOf(snapshot, id, kind)` filtered to cycle `i`: the first position `p` for which `cycleState(...).allowed(p)` is false gives `round <p> of cycle <i> ran without an owner Ruling allowing it: ` followed by `past the cap of <cap> rounds` when `p > cap`, else `after the stop at round <stopAt(p - 1)>`, with the round's heading line (Ruling 22).
- Review, last cycle only (earlier cycles are checked through their `## Return from verify` marker by `recordProblems`): when `stopAt(L)` is defined and the cycle's last verdict is not `accepted-by-owner` with `quoted` true: `round <s> of cycle <k> still reports a Should or a Must, so the loop stopped for the owner; Done needs the cycle to end with verdict: accepted-by-owner "<the owner's sentence>", or a round allowed by the owner that reports no findings followed by verdict: converged`, on round s's heading line (AC-3, Rulings 13, 21, 37).
- Plan, last cycle only: when `planStopOf(cycle, allowances)` is defined: `round <s> of plan critique cycle <k> stops the loop for the owner (a Should or a Must from round 3, or the cap of <cap> rounds); gate plan needs verdict: accepted-by-owner "<the owner's sentence>" after that round, or a round allowed by the owner that reports no findings`, on round s's heading line (AC-4, Rulings 29, 39, 47).

Ruling for the ledger: an unversioned record is read by the old rules when the host supplied no default ref (`snapshot.defaultRef` absent: a core caller, or a repository whose default branch does not resolve), since "done on the default branch" cannot be decided there; the CLI's `gate done` and `gate plan` always ask git for the default ref when the record is unversioned — cost if wrong: in a clone with no resolvable default branch an in-flight unversioned record passes the round rules.

**Tables**, `packages/core/src/gate/rules.ts`: `const REVIEW_ROUNDS: GateRule = { id: 'gate.review-rounds', level: 'error', profiles: ['build', 'maintain'], check: reviewRounds };` placed right after `REVIEW_UNCONVERGED` in both `DONE_RULES` and `DONE_S_RULES`; `{ id: 'gate.plan-rounds', level: 'error', profiles: ['build', 'maintain'], check: planRounds }` in `PLAN_RULES` right before the `gate.tests-baseline-missing` row, which stays last.

**CLI**, `packages/cli/src/commands/gate.ts`: before the gate runs, for `done` take the snapshot already built (`forScope`) through `withReturnFacts(ctx.root, …, id)` (Task 3); for `done` and `plan`, when the ticket's record (`work.rounds` for done, `work.planRounds` for plan) exists, is not `versioned` and holds a round, take it through `withDefaultRef(ctx.root, …)` too. `ready` is unchanged.

**Existing CLI tests** that run `gate done` on a repository whose default branch resolves, with an unversioned review.md holding a `## Round` for a ticket not done on that branch, now meet the version-line finding, as an in-flight ticket does. Run the CLI suite; in `packages/cli/test/lane-flow.test.ts`, `packages/cli/test/lane-s.test.ts` and `packages/cli/test/branch-fact.test.ts`, only for a test that fails on `gate.review-rounds`, change its review.md text to the versioned form: prefix `Round record: 1\n\n`, and give a round that holds neither a finding nor `No findings` the line `No findings` (for example `'## Round 1\nverdict: converged\n'` becomes `'Round record: 1\n\n## Round 1\n\nNo findings\n\nverdict: converged\n'`). No other edit to those files; a failure on any other rule is a stop to report.

Behaviour that must not change: every existing gate rule, its id, level, order and reason; `gate ready` and its write of `ac_hash`; `gate plan`'s write of `plan_hash`; `packages/core/test/lane-done.test.ts`, `packages/core/test/lane-s.test.ts`, `packages/core/test/scope.test.ts`, `packages/core/test/lane-plan.test.ts` and every core golden stay green untouched (no `defaultRef` there, so an unversioned record keeps the old rules).

Done when `packages/core/test/round-gate.test.ts`, the core suite and, after `npm run build`, the CLI suite pass, and `npm run lint` and `npm run typecheck` pass.

## Task 5: The pre-tool-use hook refuses a fix executor on the wrong model

covers: @ac-5, D-03
files: packages/core/src/round/dispatch.ts (new), packages/core/src/scaffold/hooks.ts, packages/core/src/index.ts, packages/cli/src/commands/hook.ts, packages/cli/src/run.ts, packages/core/test/hooks.test.ts, packages/cli/test/pre-tool-use.test.ts (new), README.md, packages/cli/README.md
verify: packages/cli/test/pre-tool-use.test.ts#ac-5-in-claude-code-a-fix-executor-dispatched-on-the-wrong-model-is-refused (@ac-5), packages/cli/test/pre-tool-use.test.ts#risk:security-the-pre-tool-use-hook-lets-other-agents-an-open-debug-record-and-every-error-through, packages/core/test/hooks.test.ts#risk:regression-the-pre-tool-use-hook-entry-matches-the-agent-tool-and-a-re-sync-replaces-an-older-one

In Claude Code, a PreToolUse hook refuses an `accord-executor` dispatched while the ticket is at review on a model other than the one accord computes for the latest recorded round (D-03; ledger Rulings 14, 28, 34, 35, 42, 43; the preamble Ruling on the deny shape). Consumes Task 2's `fixModel(snapshot, id, round?): { model: string } | { refused: string } | undefined` (with no round: the latest recorded round of the last cycle; undefined unless lane M with a recorded round) and `modelFamily(model): 'haiku' | 'sonnet' | 'opus' | undefined`, both exported from `packages/core/src/round/next.ts` and the core index. This repository's own `.claude/settings.json` is not touched: its entry lands with the pull request that pins a release holding this event (Ruling 31).

**Test first**, in the new `packages/cli/test/pre-tool-use.test.ts`, driving `run(['hook', 'pre-tool-use'], repo, {}, stdin)` in-process with the helpers of `./helpers/repo.js` (`makeLaneRepo`, `writeFiles`, `commitMsg`, `gitRun`, `cleanup`) and `building`, `P` from `../../../test/helpers/lane.js`. Repository: `files = {}; building(files, 'T-1')` gives the approved ticket text; `repo = makeLaneRepo({ [P('T-1')]: files[P('T-1')], 'accord/tickets/T-1/ledger.md': '## Rulings\n- task 1 done abc1234\n- task 2 done abc1234\n', 'accord/tickets/T-1/review.md': 'Round record: 1\n\n## Round 1\n\nMust 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234\n\n## Round 2\n\nNice 1 [patch]: rename w — src/export.ts:1 — deferred\n\n## Round 3\n\nNice 1 [patch]: a comment typo — src/export.ts:2 — deferred\n\n## Round 4\n\nShould 1 [patch]: a comma is not quoted — src/export.ts:9 — open\n' })`; `gitRun(repo, 'checkout', '-q', '-b', 't/T-1')`; `commitMsg(repo, 'fixture')`. The executor model is the default sonnet and `fix_round_tier_up` the default 4, so accord computes opus for round 4. `input(o)` = `JSON.stringify({ session_id: 's-1', cwd: repo, hook_event_name: 'PreToolUse', tool_name: 'Agent', tool_input: { subagent_type: 'accord-executor', description: 'fix round 4', prompt: 'Brief: b.md', ...o } })`. Timeout `120_000`, `cleanup` in a `finally`.

1. Title `ac-5 in claude code a fix executor dispatched on the wrong model is refused`. With `{ model: 'sonnet' }` and with `{}` (no model): `code` 0 and `JSON.parse(out)` equals `{ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: <r> } }` where `<r>` contains `round 4` and `model "opus"`. With `{ model: 'opus' }`: `{ code: 0, out: '{}\n', err: '' }`.
2. Title `risk:security the pre tool use hook lets other agents an open debug record and every error through`. Each gives `code` 0 and `out` `'{}\n'`: `subagent_type: 'accord-reviewer'` with `model: 'sonnet'`; `tool_name: 'Bash'`; `accord/tickets/T-1/debug.md` = `'# Debug\n\n## Hypothesis\n\nx\n'` with `model: 'sonnet'` (and with `'…\n## Resolved\n\ny\n'` appended instead, the deny of test 1 again); stdin `'not json'`; a ledger with only task 1 done (stage build) with `model: 'sonnet'`; `accord/config.yml` pinned to `accord: "0.0.1"` (stderr contains `allowed`).

**Core check**, the new `packages/core/src/round/dispatch.ts`:

```ts
/** ST-LN-17 D-03: the reason to refuse an accord-executor dispatched with `model` (undefined when none) while `id` is at review; undefined to allow. */
export function checkFixDispatch(snapshot: RepoSnapshot, id: string, model: string | undefined): string | undefined
```

- Undefined unless the ticket is lane M and `progressOf(snapshot, ticket)?.stage === 'review'` (from `../status/stage.js`; export nothing new from there).
- `f = fixModel(snapshot, id)` (the latest recorded round); undefined → undefined. `r` = the round count of the last cycle of `work.rounds`.
- `{ refused }` → `accord: review round <r> of <id> cannot dispatch a fix executor: <refused>`.
- `{ model: m }`: `configured = config?.models?.executor?.model ?? AGENT_DEFAULTS.executor.model`. No dispatched model (undefined or empty): allow when `(modelFamily(m) ?? m) === (modelFamily(configured) ?? configured)`, since the agent file carries the configured model (Ruling 34). A dispatched model: allow when `modelFamily(m)` is undefined (nothing to compare, for example `inherit`) or equals `modelFamily(model) ?? model`. Otherwise `accord: review round <r> of <id> needs the fix executor on <m>; dispatch accord-executor again with model "<m>"`.
- Export `checkFixDispatch` from `packages/core/src/index.ts`.

**Hook event**, `packages/cli/src/commands/hook.ts`: `HOOK_EVENTS` gains `'pre-tool-use'` (last). `hook()` starts `if (event === 'pre-tool-use') return preToolUse(ctx);`. A new module-private `preToolUse(ctx)` follows the shape of `promptExpansion`: an `allow(why?)` that writes `accord hook pre-tool-use: <first line of why>; allowed` (backslashes as `/`) to stderr when given, `{}\n` to stdout, and returns 0; the whole body in `try`, any throw → `allow(message)`. Body:
- Parse `ctx.stdin` as JSON; not an object → `allow('no hook input on stdin')`. `tool_name` not `Agent` or `Task` → `allow()`. `tool_input` not an object, or its `subagent_type` not `accord-executor` → `allow()`. `model` is `tool_input.model` when it is a string.
- `id = activeTicket(ctx.root, ctx.snapshot)` (from `./anchor.js`); undefined → `allow()`.
- Ruling 28: read `accord/tickets/<id>/debug.md` under `ctx.root` (`readFileSync`, a missing file is closed); when the last line matching `/^##\s/` is not `## Resolved` (compared with `headingKey` on the text after `## `), → `allow()`.
- `reason = checkFixDispatch(ctx.snapshot, id, model)`; undefined → `allow()`; else write `JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'deny', permissionDecisionReason: reason } }) + '\n'` and return 0.

**Registration**, `packages/cli/src/run.ts`, in the `hook <event>` action, a branch beside the `prompt-expansion` one: parse `opts.stdin` for a string `cwd` (a parse failure gives none); `ctx = preflight({ ...opts, cwd: <that cwd> ?? opts.cwd }, 'checkout')` inside `try`; on any throw (no accord folder, unreadable config, pin mismatch) write `accord hook pre-tool-use: <first line>; allowed` to stderr and `{}\n` to stdout and exit 0 (Ruling 35); otherwise `setCode(hook(ctx, event))`.

**Settings entry**, `packages/core/src/scaffold/hooks.ts`: `HookEntries` keys gain `'PreToolUse'`; `hookEntries` adds `PreToolUse: [{ matcher: 'Agent|Task', hooks: [{ type: 'command', command: cmd(pkg, 'pre-tool-use') }] }]` after `UserPromptExpansion`; `isAccordHookCommand` accepts `pre-tool-use` too. `packages/core/test/hooks.test.ts`: in `keeps other keys, other events, and a foreign entry ahead of ours`, the PreToolUse expectation becomes `[...existing.hooks.PreToolUse, ...e.PreToolUse]`; add the test `risk:regression the pre tool use hook entry matches the agent tool and a re-sync replaces an older one`: `hookEntries({ name: '@accord-dev/accord', version: '0.2.0' }).PreToolUse` equals `[{ matcher: 'Agent|Task', hooks: [{ type: 'command', command: 'npx --yes @accord-dev/accord@0.2.0 hook pre-tool-use' }] }]`, and merging it over settings holding an `0.0.9` `hook pre-tool-use` command beside `echo hi` keeps `echo hi` once, replaces the old command, and a second merge changes nothing.

**Docs**, `README.md` line 143 and `packages/cli/README.md` line 145, the same edit in both: `(on a version mismatch the \`prompt-expansion\` hook only warns, so the prompt goes on)` becomes `(on a version mismatch the \`prompt-expansion\` and \`pre-tool-use\` hooks only warn, so the prompt or the agent dispatch goes on)`.

Behaviour that must not change: the `session-start`, `session-resume`, `subagent-start` and `prompt-expansion` events, their output and their preflight modes; `mergeHooks` keeps every foreign entry; `packages/cli/test/hook.test.ts`, `packages/cli/test/skills-sync.test.ts` and `packages/cli/test/bin.test.ts` stay green untouched.

Done when the two new test files' cases, `packages/core/test/hooks.test.ts`, and the core and (after `npm run build`) CLI suites pass, and `npm run lint` and `npm run typecheck` pass.

## Task 6: Skills write round records and ask accord round

covers: D-02, D-04, D-05, D-06, D-07
files: packages/core/skills/review/SKILL.md, packages/core/skills/review/record.md, packages/core/skills/accord/lane-s.md, packages/core/skills/plan/SKILL.md, packages/core/skills/plan/critique.md, packages/core/src/generated/skills.ts, packages/core/test/stage-skills.test.ts
verify: packages/core/test/stage-skills.test.ts#risk:regression-the-review-lane-S-and-plan-critique-skills-ask-accord-round-and-write-the-round-record-version-line

Without this task nobody writes the record Tasks 1 to 5 read or asks `accord round`, so the Intent would not hold for any session (the benchmark misses were sessions counting in memory). The skills write each round as it ends (Ruling 25), start each record with the version line, ask `accord round` before every round, pass its model on every fix executor dispatch, take a stop to the owner, and write the owner's answer in the forms accord reads (Rulings 9, 27, 38, 41). Text only; then `npm run gen` and `npm run build`. Do not run `skills sync` and do not touch `.claude/` or `.agents/`: this repository's rendered copies land with the pull request that pins a release holding `accord round` (Ruling 31).

**Test first**, in `packages/core/test/stage-skills.test.ts`, a new top-level test titled `risk:regression the review lane S and plan critique skills ask accord round and write the round record version line`, reading the rendered texts the file already builds (`files`, whitespace collapsed as `flatText` does):
- `.claude/skills/accord-review/SKILL.md` contains `` `accord round <id>` `` and `Fix executor model`, and its step 6 (from `6. **Cap.**` to `7. **Final review.**`) contains `stop: report to owner`.
- `.claude/skills/accord-review/record.md` contains `Round record: 1`, `## Return from verify <sha>`, `` `open` `` before any fix executor is dispatched (the sentence of Ruling 25 below), `verdict: accepted-by-owner "<the owner's sentence>"` and `Ruling: the owner allows <n> more review rounds after round <r> of cycle <k> — "<the owner's sentence>" — <cost if wrong>`.
- `.claude/skills/accord/lane-s.md` contains `` `accord round <id>` ``, `Round record: 1`, `stop: report to owner` and `## Return from verify <sha>`.
- `.claude/skills/accord-plan/critique.md` contains `` `accord round <id> --plan` ``, `Round record: 1`, `stop: report to owner` and `Ruling: the owner allows <n> more plan critique rounds after round <r> of cycle <k>`.
- `.claude/skills/accord-plan/SKILL.md` contains `` `accord round <id> --plan` `` and not `three revision rounds`.

**Skill text.** Keep every sentence the existing tests read unless listed here; each SKILL.md stays at most 5120 bytes (`packages/core/test/skills.test.ts`).
- `packages/core/skills/review/SKILL.md`:
  - Step 4, first bullet: the fresh `accord-executor` is dispatched with `model` set to the model `accord round` printed for this round, after the round is written to `review.md` with every finding `open` and committed, as `./record.md` says.
  - Step 5: drop the sentence `If round 3 still finds a new Must, say whether it traces to the ticket or the plan; if it does, ask the owner before round 4.` (the stop from round 3 replaces it).
  - Step 6 becomes: `6. **Cap.** Before each round run \`accord round <id>\`. Exit 0 prints \`Round: <n> of <cap>\` and \`Fix executor model: <model>\`: run round n and pass that model on every fix executor dispatch of the round. It counts five rounds, after verify counted from the first round after it, and tiers the model up from \`escalation.fix_round_tier_up\`. \`stop: report to owner\` (from round 3 a round that still reports a Should or a Must, or the cap): show the owner what it prints and ask, as \`./ask.md\` says, whether to change course, accept the open findings or allow more rounds; write the answer as \`./record.md\` says and never report the work finished. \`refused:\` fix what it names and run it again.`
  - Step 8: each round is already in `review.md` (step 4); it ends with the verdict as `./record.md` says.
- `packages/core/skills/review/record.md`, added to what it says:
  - The first line of `review.md` is `Round record: 1`, above every heading. Its only headings are `## Round <n>` and `## Return from verify <sha>`.
  - A finding line starts with its severity word, `Must`, `Should` or `Nice`, never two of them or a question mark: accord refuses a severity it cannot read. A round with no findings has the line `No findings`.
  - Each round is written with every finding `open`, and committed, before any fix executor is dispatched; each state then becomes `fixed in <sha>`.
  - Back from verify (`accord anchor` prints `Review base: <sha>`): before the next round, append `## Return from verify <sha>` naming the `commit:` in `verification.md`'s frontmatter; accord confirms it from git, and the rounds after it are a new cycle counted from 1.
  - At a stop the owner's answer is written in one of three forms: accepting the open findings, the last line `verdict: accepted-by-owner "<the owner's sentence>"`; allowing more rounds, under `## Rulings` in the ledger `Ruling: the owner allows <n> more review rounds after round <r> of cycle <k> — "<the owner's sentence>" — <cost if wrong>`, with r and k as the stop printed them; a change of course, a re-plan through `accord-plan`. After a stop, `verdict: converged` needs a round the owner allowed that reports no findings.
- `packages/core/skills/accord/lane-s.md`, step 4 (keep its other sentences, including `At most five rounds`, `stop and report the open findings to the owner` and `the next round is one after the last`): `review.md` starts with the line `Round record: 1`; before each round run `accord round <id>`, which gives the round number; `At most five rounds` is now counted by it, and it stops from round 3 on a round that still reports a Should or a Must: on `stop: report to owner`, commit the round's record, stop and report the open findings to the owner with what it prints, and write the owner's answer as `verdict: accepted-by-owner "<the owner's words>"`, as the Ruling `Ruling: the owner allows <n> more review rounds after round <r> of cycle <k> — "<the owner's words>" — <cost if wrong>`, or as the lift to lane M; on `refused:` fix what it names. Resumed at `review` with `review.md` ending in a verdict (a commit made after it), first append `## Return from verify <sha>` naming the last commit that changed `review.md` (`git log -1 --format=%H -- accord/tickets/<id>/review.md`).
- `packages/core/skills/plan/critique.md`, a paragraph after the first one (keep every existing sentence): `plan-review.md` starts with the line `Round record: 1`. Before each round run `accord round <id> --plan`: exit 0 gives the round; it counts only the rounds after the last `## Closed` line, at most five, and stops from round 3 on a round that still reports a Should or a Must. On `stop: report to owner`, stop and report to the owner with what it prints, as `./ask.md` says; the owner's answer is the line `verdict: accepted-by-owner "<the owner's sentence>"` in `plan-review.md`, the Ruling `Ruling: the owner allows <n> more plan critique rounds after round <r> of cycle <k> — "<the owner's sentence>" — <cost if wrong>`, or a change of course. Never append `## Closed` while a stop holds. On `refused:` fix what it names.
- `packages/core/skills/plan/SKILL.md`, step 6 becomes, shorter than today: `6. **Rounds.** \`accord round <id> --plan\` counts the rounds, as \`./critique.md\` says. When it prints \`stop: report to owner\`, or refuses a round while a Must or Should is still \`open\` or \`unverified\` or \`accord gate plan <id>\` still fails, stop and tell the owner what is still open, and show the revision with the fewest Must findings: its round and its commit, read from \`git log\` since the last \`plan: <id> ready\`, if any. Never continue on a failing plan.`

**Existing expectations** in `packages/core/test/stage-skills.test.ts` that read the replaced text: line 26, `'three revision rounds'` becomes `'\`accord round <id> --plan\`'`; line 343, `'three revision rounds'` becomes `'\`accord round <id> --plan\`'` and `'\`accord gate plan <id>\` still fails, after the third'` becomes `'\`accord gate plan <id>\` still fails'`. Line 28 (`'round 3'`, `'five'`, `'fix_round_tier_up'`), line 571 (step 6 holding `after verify counted from the first round after it`) and lines 776 to 786 (lane S phrases) keep passing unchanged.

Then `npm run gen` (regenerates `packages/core/src/generated/skills.ts`) and `npm run build`, in that order.

Behaviour that must not change: every other skill and agent text; the review stage's reviewers, classes, final review and verdict lines; lane S's other steps; the plan critique loop's dispatch rules; `packages/core/test/skills.test.ts` (byte and line caps, references resolving) stays green.

Done when `packages/core/test/stage-skills.test.ts`, `packages/core/test/skills.test.ts` and the core suite pass.

## Task 7: The benchmark counts review cycles and owner allowances

covers: D-01
files: scripts/compliance.mjs, packages/core/test/benchmark-compliance.test.ts
verify: packages/core/test/benchmark-compliance.test.ts#risk:regression-the-round-cap-counts-each-review-cycle-and-an-owner-allowance-in-the-new-form-covers-the-rounds-it-names

The Intent's measure is that the benchmark finds no cap breach on tickets reviewed after this ships; it must not report a legal allowance or a second cycle as a breach (ledger Ruling 32; D-01 restarts the cap per cycle).

**Test first**, a new top-level test in `packages/core/test/benchmark-compliance.test.ts` titled `risk:regression the round cap counts each review cycle and an owner allowance in the new form covers the rounds it names`. Import `compliance` from `../../../scripts/compliance.mjs` as the file's other tests do, and call it with `runs: []`, `refusals: []`, `commits: []`, `settings: { tierUp: 4, executorModel: 'sonnet' }`, `commitInfo: () => undefined`, `testFile: () => undefined` and these `tickets` (with `rounds(n)` as in the `ac-5` test, and `marker` = `'verdict: converged\n\n## Return from verify abc1234\n\n'`); then read the `round-cap` list of the result:
- `D`: `rounds(4) + marker + rounds(4)`, ledger `''` → no line for D.
- `E`: `rounds(7)`, ledger `'- Ruling: the owner allows 2 more review rounds after round 5 of cycle 1 — "two more" — cost if wrong: two rounds\n'` → no line for E.
- `F`: `rounds(7)`, the same Ruling with `1 more` → one line, starting `- round-cap: F review:` and containing `reached round 7`.
- `G`: `rounds(3) + marker + rounds(6)`, the Ruling `1 more review rounds after round 5 of cycle 1` → one line containing `reached round 6 in cycle 2`.

**Change**, in `scripts/compliance.mjs`, the `round-cap` loop (lines 100 to 104), per ticket:
- Split `t.review` into cycles at each line matching `/^## Return from verify\b.*$/m`; in each cycle count the lines matching `/^## Round \d+/m` (the count is the cycle's last round, as accord counts by position).
- Export `allowanceLimit(ledger, cycle)`: `Math.max(5, ...)` over every ledger line matching `/^- Ruling: the owner allows ([1-9][0-9]*) more review rounds after round ([1-9][0-9]*) of cycle ([1-9][0-9]*) — ".*\S.*" — \S/` whose cycle equals `cycle`, of round plus n.
- The first cycle `k` whose count exceeds `allowanceLimit(t.ledger, k)` while no Ruling passes the existing `allowsPastCap` test gives one line: `- round-cap: ${id} review: reached round ${count}` plus ` in cycle ${k}` when `k > 1`, then the existing ` with no Ruling that allows going past the round cap — accord/tickets/${id}/review.md`. At most one line per ticket, so `mergeCompliance`'s key is unchanged.

Behaviour that must not change: every other rule of `compliance` (`tier-up`, `trailer`, `test-first`, `verify-id`, `reassigned`, `brief-quote`), `allowsPastCap`, `parseCompliance`, `mergeCompliance` and `render`; the file's existing tests (`ac-4`, `ac-5`, and the `risk:` tests) stay green untouched.

Done when `packages/core/test/benchmark-compliance.test.ts` passes and `npm run lint` passes.

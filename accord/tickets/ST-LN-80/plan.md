---
baseline: c37bfa86c27c4f58dec8f844251038a4602eb8c9
plan_hash: "fnv1a64:dcfadd93f8f3a9eb"
---

Review mode `outcome`: one branch, no slices. Every task below can be finished from its own section, this
preamble, the ticket and its ledger.

Order. Task 1 makes `approach-review.md` a round record and gives `accord round <id> --approach` the plan
critique's cap and stop (@ac-4): the CLI half that each round of the approach loop calls. Task 2 rewrites the
critic and the planner: the planner gains the `direction` mode that carries the architect's rules, the critic's
`approach` mode defers implementation detail and reads only the Approach diff from round 2, and its `plan` and
`diff` modes check every Decision and Correction (@ac-5); `architect.md` is deleted. Task 3 rewrites the
approach skill around them, with its own critique loop (@ac-2, @ac-3). Task 4 retires the architect's route:
the planner default becomes opus/high (D-06), `models.architect` draws a lint warning, the deletion of a retired
agent file whose merge-base copy shows no edit is exempt from the scope gates, and the docs follow. Task 5 makes
`accord skills sync` and `accord upgrade` remove a rendered `accord-architect.md` and proves the whole of ac-1 at
the CLI. Task 6 keeps the benchmark scripts working once `accord upgrade` removes this repository's own
`.claude/agents/accord-architect.md`.

Exact text. A string this plan gives in a fenced block is written into the file exactly as the block shows it,
as one line unless the block holds several; its backticks are part of the text.

Rules for every task:
- Test ids. Every test this plan adds is a top-level `it(...)` with no `describe` around it. Its report id is
  the file path from the repository root, `#`, then the `it` title with each whitespace run turned into `-`.
  No title holds `@`, a comma or an apostrophe.
- No existing test is renamed or removed, with one exception: Task 2 drops the `architect` row of
  `AGENT_REQUIRED` (`packages/core/test/agents.test.ts:17-25`), which removes the case
  `packages/core/test/agents.test.ts#agents-name-what-the-spec-requires->-architect-names-every-required-phrase`
  (`accord/tests-baseline.txt:285`). That removal fails nothing: `untracedTests` reads only the ids in the test
  report (`packages/core/src/lint/tests.ts:17-19`), so a baseline id no test reports is never flagged. Several
  existing ids are listed in `accord/tests-baseline.txt` or named by a done ticket's `@test:` tag (SHOW-1,
  ST-LN-4, ST-LN-13, ST-LN-14), and `gate.test-untraced` fails a renamed one at Done. Where a task below changes an
  existing test, it changes the body only and keeps the title, even where the title still names the architect; a
  one-line comment above such a test says why.
- After any edit under `packages/core/agents/` or `packages/core/skills/`, or to `README.md`, run `npm run gen`,
  then `npm run build` (`accord/product/conventions.md`); CLI tests read the built core, so `npm run build` also
  runs before any CLI test. Do not run `skills sync` in this repository and change nothing under `.claude/` or
  `.agents/`: this repository's own renders follow the pin (ticket `## Approach`, Affected).
- Rendered skill text (anything under `packages/core/skills/`) never holds the word `warning`, the words `Ready`
  or `Done` capitalised (`packages/core/test/skills.test.ts:433` and `:438`), the name `accord-architect`, or a
  path that exists only in this repository. A `SKILL.md` stays within 120 lines and 6000 bytes
  (`packages/core/test/skills.test.ts:181`, `:188`); an agent body stays within 60 lines
  (`packages/core/test/agents.test.ts:99-102`).
- `flat(text)` in a test below means `text.replace(/\s+/g, ' ')`. A rendered agent is
  `agentTargets(config()).find((f) => f.path === '.claude/agents/accord-<role>.md')?.text ?? ''` and a rendered
  skill file is `skillTargets(config()).find((f) => f.path === '.claude/skills/<dir>/<file>')?.text ?? ''`, with
  `config()` as in `packages/core/test/agents.test.ts:10-11`; both import from `../src/index.js`.
- Commits follow `accord/product/conventions.md`. End every task with `npm run lint` and `npm run typecheck`,
  then the test command the brief prints.

Names shared by every task:
- The approach critique record is `accord/tickets/<id>/approach-review.md`, in `plan-review.md`'s format: the
  line `Round record: 1` above every heading; headings `## Round <n> (whole)`, `## Round <n> (diff)` and
  `## Closed`; one finding per line, `<n>. <Must|Should|Nice> — <finding> — <state>`; at most one last line
  `verdict: accepted-by-owner "<the owner's sentence>"`.
- Its round kind is `'approach'` and its noun `approach critique`; an owner allowance for it is the ledger line:

  ```text
  Ruling: the owner allows <n> more approach critique rounds after round <r> of cycle <k> — "<the owner's sentence>" — <cost if wrong>
  ```
- The ladder Ruling is the ledger line the approach skill's step 2 writes under `## Rulings` of
  `accord/tickets/<id>/ledger.md` from the planner's direction report, with two or three numbered options in the
  report's order (`; 3. <option>: <what it does>` is left out when the report has two); the last ladder Ruling of
  the ledger is the one that holds. The critic reads no ledger, so its review stays independent:

  ```text
  Ruling: the approach ladder is 1. <option>: <what it does>; 2. <option>: <what it does>; 3. <option>: <what it does>; <option> is Recommended because <the planner's line> — kept so a resumed or revised round critiques the option ## Approach names and nobody picks again — a ruled-out option comes back
  ```
- A `## Closed` heading of `approach-review.md` names the option its cycle critiqued, as the ladder Ruling names
  it: `## Closed <option>: ruled out by <round>.<n>` when a Must that breaks a Veto, Decision, or Correction rules
  it out, `## Closed <option>: the owner picked <other option>`, or `## Closed <option>: the owner's no`. An
  option is ruled out when a `: ruled out by` heading after the last `: the owner's no` heading names it. The
  parser already reads each as `## Closed`: `CLOSED` is `/^closed\b/` on the lowercased heading
  (`packages/core/src/round/record.ts:11`, `packages/core/src/load/sections.ts:13-15`), and the ladder Ruling
  never matches `ALLOWANCE` (`packages/core/src/round/next.ts:30-31`).
- `RETIRED_FILES`, exported from `packages/core/src/skills/agents.ts` and `packages/core/src/index.ts`, is
  `['.claude/agents/accord-architect.md']`: the files accord once rendered and no longer renders.
- `isIntactRender(text: string): boolean`, exported from the same two files, is true when `normaliseText(text)`
  carries a marker (`markerHash` defined) whose hash equals `contentHash(withoutMarker(<the normalised text>))`:
  a copy accord rendered that nobody edited. It is the test `writeSkillFiles` applies inline
  (`packages/cli/src/commands/skills.ts:67-69`), which stays as it is.
- The lint rule is `lint.model-retired`; the sync report state for a removed retired file is `removed`.
- SEVENTH, the critic's seventh plan check, identical in `critic.md` and `planner.md`:

  ```text
  - Check every Decision and every Correction of the ticket: a task that contradicts one is a Must that names the Decision's `D-nn` or quotes the Correction.
  ```
- DIFFCHECK, the critic's Decision check in diff mode:

  ```text
  - On the changed hunks, check every Decision and every Correction of the ticket: a hunk that contradicts one is a Must that names the Decision's `D-nn` or quotes the Correction.
  ```

## Task 1: `approach-review.md` is a round record and `accord round <id> --approach` counts it

covers: @ac-4, D-02, D-04
files: packages/core/src/model/snapshot.ts, packages/core/src/round/record.ts, packages/core/src/load/snapshot.ts, packages/core/src/round/next.ts, packages/cli/src/commands/round.ts, packages/cli/src/run.ts, packages/cli/test/round-approach.test.ts (new), packages/core/test/round-next.test.ts
verify: packages/cli/test/round-approach.test.ts#ac-4-accord-round-approach-counts-approach-critique-rounds-with-the-plan-cap-and-stop (@ac-4), packages/core/test/round-next.test.ts#risk:complex-branching-approach-critique-rounds-take-only-approach-critique-allowances-and-their-own-stop-text

Consumes `approach-review.md` as the preamble describes, and the ledger's owner allowances. Produces:
- `packages/core/src/model/snapshot.ts`: `RoundRecord.kind` (line 218) becomes `'review' | 'plan' | 'approach'`;
  `TicketWork` (line 225) gains `approachRounds?: RoundRecord; // approach-review.md as round records (ST-LN-80)`.
- `packages/core/src/round/record.ts`: `parseRounds(file, text, kind: 'review' | 'plan' | 'approach')`. Every
  kind but `review` reads `## Closed` (line 180 tests `kind !== 'review'`) and names the same allowed headings
  (line 149). Version 2 stays review only (line 142 unchanged).
- `packages/core/src/load/snapshot.ts`: `WORK` (line 27) also matches `approach-review`, and the loop at line
  176 sets `entry.approachRounds = parseRounds(file, files[file], 'approach')`.
- `packages/core/src/round/next.ts`: `RoundKind = 'review' | 'plan' | 'approach'`. The approach record follows
  the plan record wherever plan differs from review: `cycleState` line 59 (`kind !== 'review'`),
  `recordProblems` line 117, `planStopOf` in `stopOf` (line 214), and the record lookups at lines 94 and 181
  (approach reads `approachRounds`). `ALLOWANCE` (line 31) matches `(review|plan critique|approach critique)` and
  `allowancesOf` maps `approach` to `approach critique`, so a plan allowance never extends the approach loop, nor
  the reverse. `nextRound` line 178 refuses lane S for every kind but review, with `lane S has no plan critique`
  or `lane S has no approach critique`. The file its texts name for approach is `approach-review.md`. The
  ended-loop tail (lines 242-245) for approach:

  ```text
  ; the loop has ended: accord-approach goes on to write ## Approach in full and ask the owner, and a round on another option follows a ## Closed line, which starts the next cycle
  ```
  `roundText` for `record: 'approach'` uses `approach-review.md` and `approach critique`, and its two
  change-of-course lines (the plan and review texts at lines 283-290 stay as they are) read:

  ```text
  Ask the owner whether to change course: weigh the other options of the planner's direction report against going on.
  To change course: write that Ruling with <n> the rounds the owner gives the other option, then write that option into ## Approach and critique it through accord-approach
  ```
  `ROUND_CAP` and the stop rule are shared, not copied.
- `packages/cli/src/commands/round.ts`: `options: { plan?: boolean; approach?: boolean }`. Both flags: a
  `UsageError` `give --plan or --approach, not both`. `--approach` on a lane S ticket: a `UsageError`
  `'lane S has no approach critique; accord round ' + id + ' counts its review rounds'`. `--approach` reads
  `ctx.snapshot` as `--plan` does and calls `nextRound(snapshot, id, 'approach')`. Exit codes as today: 0 next,
  1 stop or refusal, 2 usage.
- `packages/cli/src/run.ts` lines 178-184: add `.option('--approach', 'count the approach critique rounds in
  approach-review.md')`, and end the description with `; --plan counts plan critique rounds, --approach approach
  critique rounds`.

Must not change: every output of `accord round <id>` and `accord round <id> --plan`, byte for byte
(`packages/cli/test/round.test.ts`, `packages/core/test/round-next.test.ts`, `round-record.test.ts` and
`round-gate.test.ts` pass unchanged); `gate plan` and `gate done` read no `approach-review.md`
(`packages/core/src/gate/rounds.ts` is not edited, D-01).

Test first, `packages/cli/test/round-approach.test.ts`, one top-level `it` titled
`ac-4 accord round approach counts approach critique rounds with the plan cap and stop`, third argument
`120_000`. Build the sandbox as `packages/cli/test/round.test.ts:13-19` does: `makeLaneRepo` with
`'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY })`, then `commitMsg(repo, 'fixture')`;
clean up in `finally`. With `rec = (...r: string[]) => 'Round record: 1\n\n' + r.join('')` and
`r = (n, mode, line) => '## Round ' + n + ' (' + mode + ')\n\n' + line + '\n\n'`, written with `writeFiles`:
1. No record: `run(['round', 'T-1', '--approach'], repo)` equals `{ code: 0, out: 'Round: 1 of 5\nCycle: 1\n', err: '' }`.
2. Rounds 1 (`whole`, `1. Must — the option drops the header — fixed`) and 2 (`diff`,
   `1. Should — the impact list misses a caller — fixed`): code 0, out `Round: 3 of 5\nCycle: 1\n`.
3. Add round 3 (`diff`, `1. Should — a risk has no undo — open`): code 1; out starts `stop: report to owner\n`
   and holds `Reason: round 3 of cycle 1 still reports a Should or a Must, and from round 3 such a round stops
   the loop`, `end approach-review.md with the line verdict: accepted-by-owner` and `more approach critique
   rounds after round 3 of cycle 1`. The same text written to `accord/tickets/T-1/plan-review.md` makes
   `round T-1 --plan` exit 1 with the same first two lines.
4. Five rounds, each `1. Nice — a wording — deferred`, in both files: `--approach` and `--plan` each exit 1, and
   each out starts `stop: report to owner\n` and holds `Reason: the cap of 5 rounds in cycle 1 is reached`.
5. `round S-1 --approach` exits 2 with `lane S has no approach critique` in err; `round T-1 --plan --approach`
   exits 2.

Then, in `packages/core/test/round-next.test.ts`: `Opts` (line 17) gains `approach?: string`, and `repo` writes
it to `accord/tickets/<id>/approach-review.md`. A top-level `it` titled
`risk:complex-branching approach critique rounds take only approach critique allowances and their own stop text`,
with `five = HEAD + [1, 2, 3, 4, 5].map((n) => round(n, '1. Nice — a wording — deferred')).join('')`:
- `nextRound(repo(undefined, { approach: five, ledger: LEDGER + allow(2, 5, 1, 'plan critique') }), 'T-1', 'approach')`
  has kind `stop`; its `roundText` holds `approach-review.md`, `more approach critique rounds after round 5 of
  cycle 1` and `the other options of the planner's direction report`, and does not hold `plan-review.md`;
- with `allow(2, 5, 1, 'approach critique')` instead it matches `{ kind: 'next', round: 6, cap: 7 }`, while
  `nextRound(repo(undefined, { plan: five, ledger: LEDGER + allow(2, 5, 1, 'approach critique') }), 'T-1', 'plan')`
  still has kind `stop`;
- `HEAD + round(1, '1. Must — the option breaks D-01 — open') + '## Closed option B: ruled out by 1.1\n\n'` as the
  approach record gives `{ kind: 'next', round: 1, cycle: 2 }`, so a `## Closed` heading that names its option
  (preamble) closes the cycle;
- `nextRound(repo(undefined, { id: 'S-1', approach: five }), 'S-1', 'approach')` has kind `refused` and a reason
  holding `lane S has no approach critique`.

## Task 2: The planner's direction mode, the critic's approach rounds and its Decision checks

covers: @ac-5, D-01, D-02, D-03
files: packages/core/agents/architect.md, packages/core/agents/critic.md, packages/core/agents/planner.md, packages/core/src/generated/agents.ts, packages/core/test/approach-fold.test.ts (new), packages/core/test/agents.test.ts, packages/core/test/stage-skills.test.ts
verify: packages/core/test/approach-fold.test.ts#ac-5-the-critic-checks-every-decision-and-correction-in-plan-mode-and-in-diff-mode (@ac-5)

Consumes the three agent sources. Produces the rendered `accord-critic.md` and `accord-planner.md` that Task 3's
skill dispatches, and no `accord-architect.md` among `agentTargets`.

- Delete `packages/core/agents/architect.md`; `npm run gen` drops it from `packages/core/src/generated/agents.ts`.
  `AGENT_DEFAULTS` keeps its `architect` entry until Task 4; no agent routes to it.
- `critic.md` line 11 becomes this one bullet (the sentences on skipping an earlier `## Approach` and on the
  architect's reasoning go):

  ```text
  - Your caller names one mode, `approach`, `plan`, or `diff`, and gives you the path of the ticket file. Read the whole ticket, except that from round 2 of `approach` mode you read `## Approach` only at the changed lines, never in full. In `approach` mode the ticket's `## Approach` holds only the chosen option's name, what it does and its impact list; judge it without its author's reasoning. From round 2 of `approach` mode you also get the paths of a file holding `git diff` of the ticket since the previous round, which shows how `## Approach` changed, and of `accord/tickets/<id>/approach-review.md`; raise new findings only on the changed lines. In `plan` mode you get the path of `accord/tickets/<id>/plan.md`.
  ```
- `critic.md` line 13: `the first, second, third and fifth checks` becomes
  `the first, second, third, fifth and seventh checks`; the rest of the line stays.
- `critic.md` line 14: its text from its start up to and including `that the plan now fixes,` becomes the block
  below, and a space then the unchanged rest of the line follow it, starting `and never repeat`; that rest
  stays word for word, `whether or not the plan changed` included (`packages/core/test/agents.test.ts:194`):

  ```text
  - When you also get `accord/tickets/<id>/plan-review.md`, or `approach-review.md` in `approach` mode, list on one line, `fixed: <round>.<n>, <round>.<n>`, each finding it holds as `open` or `unverified` that the plan or the `## Approach` now fixes,
  ```
- ``Mode `approach`:`` gains, after its last bullet:

  ```text
  - A finding on implementation detail the planner decides in the plan, such as a name, a signature, a file or test layout, or the order of tasks, is marked `defer to plan` and rated Nice, never a Must or a Should.
  ```
- ``Mode `plan`:`` gains SEVENTH as its last line, so the block stays a run of `- Check` lines ended by a blank line.
- ``Mode `diff`:`` gains DIFFCHECK right after the line that starts `- On the changed hunks, check that no Veto is
  violated`, which stays.
- `planner.md` frontmatter `description` becomes:

  ```text
  Drafts a ticket's ## Approach in its direction mode for the approach stage, writing no file, and writes its plan.md, one task per section with covers, files, and verify lines, ordered wiring first and polish last, for the plan stage. Writes nothing else.
  ```
- `planner.md`, right after the re-plan bullet (line 16) and in the same list, these four lines, adding no blank
  line (the body stays within 60 lines, so add no other line):

  ```text
  - In `direction` mode your caller gives you the ticket path, and on a revision also `accord/tickets/<id>/approach-review.md` and the Must and Should findings to fix, each with its `<round>.<n>` label: you write no file, neither `plan.md` nor the ticket, and reply with the `## Approach` draft the main session writes into the ticket, answering each label you were given. When your caller names an option, as on a revision or a resume, you keep that option and its name, revise only it, and pick no other: your reply holds the impact list, that option alone with no `Recommended` line, and the failure scenarios when they apply. Otherwise it holds:
    - First, the impact list: every caller, interface, test, config entry, and export the change must reach, each with `path:line`.
    - Then two or three options, the lightest that works first. Option 1 is the first rung of the ladder that fully works: does it need to exist; already in the repo; standard library or platform; installed dependency; minimum new code. Options 2 and 3 climb further only where a criterion or constraint needs it, and say which. Each option has a short name and says what it does in two or three lines, its cost, its risk, and the criterion it serves (`@ac-n`, `D-nn`, or a named constraint); every added layer names the criterion or constraint that requires it, or you drop it; never cut validation at trust boundaries, data-loss handling, security, accessibility, or anything asked for. Mark one option `Recommended` and say why in one line.
    - When the ticket touches auth, money, migration, or data deletion, three failure scenarios in total, each with the step or state where it starts and how it is undone.
  ```
- `planner.md`: SEVENTH goes right after the line `- Check that an executor holding only the ticket and one
  task could finish that task without asking; a task that fails this is a Should.`

Must not change: every other line of `critic.md` and `planner.md` (the severity sentences, the citation rules,
the `repeats <round>.<n>:` and `withdrawn:` sentences, the six existing checks, the plan rules), so every test in
`packages/core/test/agents.test.ts`, `stage-skills.test.ts` and `lane-s.test.ts` that reads them still finds its
phrase, apart from the body edits below.

Test first, `packages/core/test/approach-fold.test.ts`, a top-level `it` titled
`ac-5 the critic checks every decision and correction in plan mode and in diff mode`. With the rendered critic
split into lines: the lines after ``Mode `plan`:`` up to the first blank line are seven, all start `- Check`, and
the last equals SEVENTH; the lines after ``Mode `diff`:`` up to the first blank line hold DIFFCHECK; both hold
`every Decision and every Correction`, `Must` and `` `D-nn` ``; `flat(critic)` holds
``the first, second, third, fifth and seventh checks``. The rendered planner's lines hold SEVENTH after the line
`Before you reply, run these checks of the critic's plan mode on your plan and fix what fails:`.

Body edits to existing tests, titles kept (preamble):
- `packages/core/test/agents.test.ts:17-25`: drop the `architect` row (the one removal the preamble allows); in the critic row `'text only'` becomes
  `'defer to plan'`; the planner row adds ``'`direction` mode'``, `'first rung'` and `'climb further'`.
- `agents.test.ts:69-74` (`renders the architect and the critic read-only on their spec routes`): assert the
  critic's frontmatter matches `{ name: 'accord-critic', tools: 'Read, Grep, Glob', model: 'opus', effort: 'high' }`
  and that no path of `agentTargets(config())` is `.claude/agents/accord-architect.md`.
- `agents.test.ts:153`: `toHaveLength(7)`.
- `agents.test.ts:250-262` (`ac-3 the scout architect critic and planner read ...`): `names` and `readers` lose
  `'architect'`.
- `packages/core/test/stage-skills.test.ts:372`: the phrase becomes
  ``'`criteria` runs only the first, second, third, fifth and seventh checks'``.

## Task 3: The approach skill: the planner drafts, the critic runs capped rounds, the owner approves

covers: @ac-2, @ac-3, D-01, D-02, D-03
files: packages/core/skills/approach/SKILL.md, packages/core/skills/approach/critique.md (new), packages/core/skills/plan/critique.md, packages/core/skills/accord/SKILL.md, packages/core/src/generated/skills.ts, packages/core/test/approach-fold.test.ts (new), packages/core/test/stage-skills.test.ts
verify: packages/core/test/approach-fold.test.ts#ac-2-the-planner-direction-pass-returns-the-approach-draft-and-writes-no-file (@ac-2), packages/core/test/approach-fold.test.ts#ac-3-approach-critique-defers-detail-to-the-plan-and-reads-only-the-approach-diff-from-round-2 (@ac-3), packages/core/test/approach-fold.test.ts#risk:complex-branching-a-resumed-or-revised-approach-round-keeps-its-option-and-skips-every-ruled-out-one

Consumes Task 2's planner `direction` mode and critic `approach` mode, and Task 1's `accord round <id>
--approach`. Produces the rendered `accord-approach/SKILL.md` and `accord-approach/critique.md`.

`packages/core/skills/approach/SKILL.md`:
- Frontmatter `loads: [approach/critique.md, shared/ask.md]` and `description`:

  ```text
  Use when a lane M ticket has its intent and acceptance criteria and needs an approach. Has the planner draft the lightest approach that works, has a critic argue against it in capped rounds, and takes the owner's explicit yes before accord approve.
  ```
- Step 2 `**Options.**` holds, in this order: the sentences A; what the report holds (an impact list naming file
  and line, two or three options in ladder order with the lightest that works first, each added layer naming the
  criterion or constraint that requires it, and, when the ticket touches auth, money, migration, or data
  deletion, three failure scenarios in total with how each is undone); the chosen option is the one it marks
  `Recommended`, unless the owner has already picked another; sentence B, never its reasons, its risk line, the
  other options or the `Recommended` line, so the critic's review stays independent; sentence G; commit
  `accord/tickets/<id>.md` and `accord/tickets/<id>/ledger.md`; the report is kept for steps 3 and 4.

  ```text
  A: Dispatch `accord-planner` in its `direction` mode with the path of `accord/tickets/<id>.md`. It writes no file.
  B: Write into `## Approach` only the chosen option's name, what it does, and the impact list,
  G: Write the ladder Ruling of `./critique.md` into `accord/tickets/<id>/ledger.md`. When a new session or a revision needs the planner again, dispatch it in `direction` mode with the name of the option `## Approach` names: it keeps that option, and nobody picks again.
  ```
  (The `A: `, `B: ` and `G: ` labels are not written.) Step 2 stays short so `SKILL.md` keeps within its 6000
  bytes: the ladder Ruling's text, the `## Closed` headings and the ruled-out rule live in `./critique.md`.
- Step 3 `**Critique.**`: run the loop in `./critique.md`, running `accord round <id> --approach` before each
  round. One `accord-critic` in a fresh context, mode `approach`, argues the strongest case against the chosen
  option and checks it against Vetoes, Decisions, and Corrections, for every ticket in lane M and above. A Must
  that would break a Veto, Decision, or Correction rules the option out, and the first option of the ladder Ruling
  that is not yet ruled out takes its place, as `./critique.md` says; when none is left, ask the owner.
- Step 4, ``**Write `## Approach`**`` (its heading as today), writes it in full, about fifteen lines: a `- Chosen:` line, the option and why; one
  `- Rejected: <option> — <why>` line per other option the ladder Ruling names, the why taken from its `## Closed`
  heading or the Ruling's `Recommended` line; affected areas, from the impact list; risks, every
  critic finding the chosen option keeps, Must findings first, and for a ticket that touches auth, money,
  migration, or data deletion each of the three failure scenarios and how it is undone; test strategy, which
  criterion is tested at which layer. Commit `accord/tickets/<id>.md` and `accord/tickets/<id>/approach-review.md`.
- Step 5 stays word for word except that its two sentences on another option and on any other no become:

  ```text
  If the owner picks another option, append `## Closed <option>: the owner picked <other option>` to `accord/tickets/<id>/approach-review.md`, write that option into `## Approach` as step 2 says, go back to step 3 with that option, and ask again. On any other no, write the owner's words under `## Corrections` first, append `## Closed <option>: the owner's no` to `approach-review.md`, empty `## Approach` below its heading, go back to `accord-intent` step 8, and restart this stage at step 2.
  ```
- Step 1, step 6 and `## Rules` stay word for word (`stage-skills.test.ts:875-910`, `:1017-1039`).

`packages/core/skills/approach/critique.md` (new), frontmatter `kind: reference`, heading
`# The approach critique loop`, states in this order:
- The record: the main session keeps every critic finding in `accord/tickets/<id>/approach-review.md`, in the
  format of the preamble; the states are `open`, `fixed`, `deferred` for a Nice, `unverified: <reason>`,
  `withdrawn`, `repeated as <round>.<n>`, and `owner: "<the owner's words>"` for one the owner dropped; a finding
  stays `open` or `unverified` until a critic lists it after `fixed:` or `withdrawn:`, or the owner drops it, and
  the planner's word alone closes nothing; a round with no findings says `No findings`; only the sections after
  the last `## Closed` line count.
- The ladder: step 2 of the skill writes the ladder Ruling from the planner's report, its text the preamble's
  block, shown in a `text` fence as one line, with the preamble's note that the third entry is left out when the
  report has two and that the last ladder Ruling holds; the three `## Closed` headings of the preamble, each
  naming the option its cycle critiqued as the ladder Ruling names it; sentence H; then sentence J.
- The count: before each round and before appending `## Closed`, run `accord round <id> --approach`. Exit 0 gives
  the round's number and the cap; it counts only the rounds after the last `## Closed` line, at most five, and
  prints `stop: report to owner` from round 3 on a round that still reports a Should or a Must, and on a fifth
  round that reports any finding. On a stop, report what it prints to the owner as `./ask.md` says, and ask
  whether to change course to another option, accept the open findings, or allow more rounds. The answer is
  written as the last line `verdict: accepted-by-owner "<the owner's sentence>"` of `approach-review.md`, or as
  the owner allowance of the preamble, with r and k as the stop printed them. Another option at a stop takes
  that same allowance, with n the rounds the owner gives it, and is then written into `## Approach` as step 2 of
  the skill says, because `## Closed` is refused while a stop holds. Never append `## Closed` while a stop holds.
  On a `refused:` that says the loop has ended, go to step 4 of the skill; on any other `refused:`, fix what it
  names and run it again.
- `1. **Read.**` Round 1 is `whole`: one `accord-critic` in a fresh context, mode `approach`, with the path of the
  ticket file, whose `## Approach` holds only the draft of step 2. When the ticket touches auth, money,
  migration, or data deletion, ask it for three concrete failure scenarios as well. Then the sentence C.
- `2. **Record.**` Append the round's section and mark each new finding `open`. Then the sentence D. A new
  finding that starts `repeats <round>.<n>:` marks that earlier finding `repeated as <this round>.<n>`. Then the
  sentence E.
- `3. **Ruled out.**` When a Must would break a Veto, Decision, or Correction, the option is out: append
  `## Closed <option>: ruled out by <round>.<n>`, naming that Must, to `approach-review.md`, take the first option
  of the ladder Ruling that is not yet ruled out, write it into `## Approach` as step 2 of the skill says (in a
  new session, from a `direction` dispatch that names that option), commit both files, and start again at round
  1. When no option is left, ask the owner.
- `4. **Converged.**` The loop ends only on a round that reports no Must and no Should and leaves no Must or
  Should open or unverified, or on the owner's acceptance after a stop: go to step 4 of the skill.
- `5. **Fix.**` Otherwise commit `accord/tickets/<id>.md` and `approach-review.md` with the subject
  `approach: <id> round <n>, <m> Must, <s> Should`, `<m>` and `<s>` counting the Musts and the Shoulds after the
  last `## Closed` line that are `open` or `unverified`; the next `diff` round reads from that commit. Dispatch
  `accord-planner` in its `direction` mode with the ticket path, the name of the option `## Approach` names, the
  path of `approach-review.md`, and every Must and Should that is `open` or `unverified`, never a Nice, each
  labelled `<round>.<n>`. Write the revised option, which keeps its name, and the impact list it returns into
  `## Approach`, still without its reasons, and each `unverified: <reason>` it replies into the state of the
  finding with that label. Then go back to step 1.

  ```text
  C: From round 2, even after a Must, the round is `diff`: write `git diff <the previous round's commit> -- accord/tickets/<id>.md`, which holds the amended `## Approach`, into a file outside the working tree, and dispatch one `accord-critic` in a fresh context, mode `approach`, with the paths of the ticket, that file, and `approach-review.md`, never the planner's report.
  D: Mark `fixed` each finding the critic lists after `fixed:`, and `withdrawn` each one it lists after `withdrawn:`.
  E: A Nice, a `defer to plan` one included, is marked `deferred`, goes to the ledger under `## Deferred`, and never to the planner.
  H: An option is ruled out when a `## Closed <option>: ruled out by <round>.<n>` heading after the last `: the owner's no` heading names it.
  J: The option under critique is always the one `## Approach` names: a resumed session or a revision keeps it, and only step 3 below or the owner moves to another.
  ```
  (The `C: `, `D: `, `E: `, `H: ` and `J: ` labels are not written; each sentence may wrap across lines in the file.)

`packages/core/skills/plan/critique.md`: right before `Merge and de-duplicate their findings` (line 36) add the
sentence below; every other line stays.

```text
A critic with no lens or with lens `criteria`, and every `diff` critic, checks the plan against every Decision and every Correction of the ticket.
```

`packages/core/skills/accord/SKILL.md` lines 45-47: the `intent` route becomes the text below, and the rest of
step 4 stays, so a session resumed in mid-critique goes back to the critique (D-01: every lane M draft is
critiqued):

```text
`intent` → `accord-approach` at step 5, the owner's yes, when the ticket's `## Approach` holds a `- Rejected:` line, at step 3 when it holds only the draft of its step 2, otherwise `accord-intent`;
```

Must not change: the plan skill's loop (`stage-skills.test.ts:332-379` passes); step 1, step 5 apart from the two
sentences above, step 6 and `## Rules` of the approach skill; the Continue routes of `/accord`
(`stage-skills.test.ts:1041-1049`).

Tests first: add three top-level `it`s to `packages/core/test/approach-fold.test.ts`, the file Task 2 created;
its ac-5 test and its imports and helpers stay as Task 2 wrote them:
- `ac-2 the planner direction pass returns the approach draft and writes no file`: `flat(planner)` holds each
  P line below. In `flat(skill)` of `.claude/skills/accord-approach/SKILL.md`, the slice from `2. **Options.**`
  to `3. **Critique.**` holds each S line below, and the whole skill does not hold `accord-architect`.
- `ac-3 approach critique defers detail to the plan and reads only the approach diff from round 2`: `flat(critic)`
  holds each R line below; `flat(loop)` of `.claude/skills/accord-approach/critique.md` holds sentences C, D and
  E above, each with its whitespace collapsed, and `` `accord round <id> --approach` ``; `flat(skill)` holds
  `./critique.md` and `` `accord round <id> --approach` ``.
- `risk:complex-branching a resumed or revised approach round keeps its option and skips every ruled-out one`:
  `flat(planner)` holds each Q line below; `flat(skill)` holds sentence G with its whitespace collapsed and each K
  line below; `flat(loop)` holds the ladder Ruling block line of the preamble and sentences H and J, each with its
  whitespace collapsed, and each L line below.

```text
P: `direction` mode
P: you write no file, neither `plan.md` nor the ticket
P: the impact list
P: `path:line`
P: two or three options, the lightest that works first
P: first rung of the ladder
P: three failure scenarios in total
P: how it is undone
P: the `## Approach` draft the main session writes into the ticket
S: Dispatch `accord-planner` in its `direction` mode
S: It writes no file
S: three failure scenarios in total
S: Write into `## Approach` only the chosen option's name, what it does, and the impact list
R: is marked `defer to plan` and rated Nice, never a Must or a Should
R: read `## Approach` only at the changed lines, never in full
R: From round 2 of `approach` mode you also get the paths of a file holding `git diff` of the ticket since the previous round
R: `accord/tickets/<id>/approach-review.md`
R: raise new findings only on the changed lines
R: or `approach-review.md` in `approach` mode
R: `fixed: <round>.<n>, <round>.<n>`
R: `withdrawn: <round>.<n>, <round>.<n>`
Q: you keep that option and its name, revise only it, and pick no other
Q: that option alone with no `Recommended` line
K: the first option of the ladder Ruling that is not yet ruled out
K: `## Closed <option>: the owner picked <other option>`
K: `## Closed <option>: the owner's no`
L: `## Closed <option>: ruled out by <round>.<n>`
L: the name of the option `## Approach` names
```
(Each line is one expected string without its `P: `, `S: `, `R: `, `Q: `, `K: ` or `L: ` label.)

Body edit, title kept: `packages/core/test/stage-skills.test.ts:25`, the `approach` row becomes:

```text
approach: ['accord anchor', 'accord-planner', '`direction` mode', 'accord-critic', '## Approach', 'accord approve', 'accord gate ready', 'accord-plan', 'ladder order', 'not yet ruled out', 'three failure scenarios', 'undone', 'back to step 3', 'Commit `accord/tickets/<id>.md`', 'Decisions, and Corrections as written', 'approved_hash:', './critique.md', '`accord round <id> --approach`'],
```

## Task 4: Retire the architect route: planner default, the lint warning, the scope exemption, the docs

covers: D-01, D-06
files: packages/core/src/skills/agents.ts, packages/core/src/model/snapshot.ts, packages/core/src/index.ts, packages/core/src/lint/config.ts (new), packages/core/src/lint/rules.ts, packages/cli/src/load/fs.ts, packages/cli/test/branch-fact.test.ts, packages/core/test/agents.test.ts, docs/design.md, docs/specs/2026-10-12-workflow-layer-design.md
verify: packages/cli/test/branch-fact.test.ts#risk:data-loss-a-deleted-retired-agent-file-is-exempt-from-the-scope-gates-only-when-its-merge-base-copy-shows-no-edit

Consumes Task 2's deletion of `architect.md`. Produces:
- `packages/core/src/skills/agents.ts`: `AGENT_DEFAULTS` loses `architect`; `planner` becomes
  `{ model: 'opus', effort: 'high' }` (D-06). `export const RETIRED_FILES: readonly string[] = [agentDir +
  '/accord-architect.md'];`, with a comment: rendered by accord before ST-LN-80, removed by `skills sync` and
  `accord upgrade` when its marker is intact. `export function isIntactRender(text: string): boolean` as the
  preamble defines it, importing `contentHash`, `markerHash` and `withoutMarker` from `./render.js` and
  `normaliseText` from `../load/frontmatter.js`. `packages/core/src/index.ts` line 84 also exports both.
- `packages/core/src/model/snapshot.ts`: `RouteKey` (line 233) loses `'architect'`; `AccordConfig.models` (line
  247) becomes `Partial<Record<RouteKey | 'architect', { model: string; effort?: Effort }>>`, its comment saying
  `architect` is still accepted and has no effect (ST-LN-80). `packages/core/schemas/config.schema.json` is not
  edited: its pattern at line 60 already accepts `architect`, which is what keeps an old config loading.
- `packages/core/src/lint/config.ts` (new) exports `modelRetired: Rule['check']`: when
  `snapshot.config?.models?.architect !== undefined`, one draft with `file: 'accord/config.yml'`,
  `pointer: '/models/architect'` and the reason below; otherwise none. `packages/core/src/lint/rules.ts` adds
  `{ id: 'lint.model-retired', level: 'warning', profiles: ['build', 'maintain'], check: modelRetired }`.

  ```text
  models.architect has no effect: accord no longer renders accord-architect, and the planner drafts the approach, so models.planner now applies; remove models.architect
  ```
- `packages/cli/src/load/fs.ts` `gitBranchFact` (line 1267), the host side, since core cannot read the deleted
  file's text: line 6 also imports `isIntactRender` and `RETIRED_FILES`. In the batch read (lines 1369-1381),
  `want(base, c.path)` for every change whose `kind` is `'deleted'` and whose path `RETIRED_FILES` holds. After the
  settings check (line 1418) and before `synced.sort(byCodePoint)`, those paths whose text
  `filesAt(base, <those paths>)` returns passes `isIntactRender` are pushed onto `synced`, with a comment: ST-LN-80,
  a retired file `skills sync` or `accord upgrade` removed is exempt as a synced copy is; a copy someone edited is
  not, so deleting it stays a change the scope gates see. `isExempt` reads `fact.synced` (`packages/core/src/gate/scope.ts:38`),
  so the deletion of an intact copy passes `gate.out-of-scope`, the undeclared files
  (`packages/core/src/round/grounds.ts:124`) and the call-sign read. The merge base's text comes from the git
  tree, which follows no link: a link's blob holds its target path, whose marker is never intact.
- `docs/design.md:184`: the agent list loses `architect`.
- `docs/specs/2026-10-12-workflow-layer-design.md`: line 120 reads `the scout, critic and planner read the listed
  records`; line 142 ends `takes an explicit yes before the approach stage starts`; lines 201-202 say Continue
  resumes at the owner's yes in `accord-approach` when `## Approach` holds a `- Rejected:` line, at its critique
  step when it holds only the draft, otherwise in `accord-intent`; §7 Approach steps 1-4 (lines 234-255) describe
  Task 3's stage: the planner's `direction` mode (impact list with `path:line`, two or three options lightest
  first, three failure scenarios with undo when auth, money, migration or data deletion is touched, no file
  written), the draft of only the chosen option's name, what it does and the impact list, the critic's rounds in
  `approach-review.md` counted by `accord round <id> --approach` with the plan critique's cap and stop,
  `defer to plan` findings rated Nice, `diff` rounds from round 2 with `fixed:` and `withdrawn:`, the ladder
  Ruling in the ledger, a ruled-out option closing the cycle with a `## Closed` heading that names it, a resumed
  session or a revision keeping the option `## Approach` names, then the full brief and the owner's yes as today; line 281 adds every Decision and
  every Correction kept to what the critic checks; the §12 table (lines 522-530) loses the `accord-architect` row,
  and its planner row reads `` | `accord-planner` | `plan.md`; the approach draft in `direction` mode | writes plan only | Opus, high | ``.

Must not change: every other route default; the `agentTargets` output of the other nine agents;
`packages/core/src/gate/scope.ts`, which is not edited, so core exempts a retired path only through `synced`, after
the host's content check; every other entry of `synced` (`packages/cli/test/branch-fact.test.ts` passes
unchanged); the lint findings of every existing fixture (`packages/core/test/lint.test.ts` and its goldens pass
unchanged, since none sets `models.architect`).

Test first, in `packages/cli/test/branch-fact.test.ts`, a top-level `it` titled
`risk:data-loss a deleted retired agent file is exempt from the scope gates only when its merge-base copy shows no edit`,
third argument `120_000`, with the file's `repoWith`, `importCommits` and `checkedOut`. Line 6 also imports
`contentHash`. A helper `rendered()` builds an intact old render:
`head = '---\nname: "accord-architect"\ntools: "Read, Grep, Glob"\nmodel: "opus"\neffort: "high"\n---\n'`,
`body = '\nYou propose how a ticket could be built, lightest first.\n'`, and it returns
`head + '<!-- generated by accord skills sync - do not edit - ' + contentHash(head + body) + ' -->\n' + body`.
For each pair `[rendered(), true]` and `[rendered() + 'a hand edit\n', false]`, `[text, exempt]`, in its own
repository cleaned up in `finally`:
`base = { 'accord/config.yml': CONFIG, 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }), 'src/a.ts': 'a\n', '.claude/agents/accord-architect.md': text }`,
`repo = repoWith(base)`, `T = 'refs/heads/t/S-1'`, then
`importCommits(repo, [{ name: 'base', ref: 'refs/heads/main', message: 'base', files: base, also: [T] }, { name: 'gone', ref: T, from: 'base', message: 'gone', files: { 'src/a.ts': 'a2\n', '.claude/agents/accord-architect.md': null } }])`
and `checkedOut(repo, T)`. `f = gitBranchFact(repo, 'S-1', { rendered: [], scope: false })` holds no `error`,
`f.changes.find((c) => c.path === '.claude/agents/accord-architect.md')?.kind` is `'deleted'`, and
`f.synced.includes('.claude/agents/accord-architect.md')` is `exempt`.

Body edit, title kept: in `packages/core/test/agents.test.ts`, `renders the architect and the critic read-only on
their spec routes` (as Task 2 left it) also asserts that the rendered planner's frontmatter matches
`{ name: 'accord-planner', tools: 'Read, Grep, Glob, Write, Edit', model: 'opus', effort: 'high' }`.

## Task 5: `skills sync` and `accord upgrade` remove the rendered architect agent

covers: @ac-1, D-01, D-05
files: packages/cli/src/commands/skills.ts, packages/cli/src/commands/upgrade.ts, packages/cli/test/retired-agent.test.ts (new), packages/cli/test/upgrade.test.ts, packages/cli/test/skills-sync.test.ts, README.md, packages/cli/README.md
verify: packages/cli/test/retired-agent.test.ts#ac-1-sync-removes-the-rendered-architect-agent-and-lint-accepts-models-architect-with-a-warning (@ac-1), packages/cli/test/retired-agent.test.ts#risk:data-loss-sync-keeps-an-edited-architect-agent-and-reports-it-as-an-orphan, packages/cli/test/retired-agent.test.ts#risk:security-sync-removes-no-retired-agent-through-a-linked-agents-folder, packages/cli/test/upgrade.test.ts#risk:data-loss-upgrade-deletes-the-retired-architect-agent-only-when-its-marker-shows-no-edit

Consumes `RETIRED_FILES` and `isIntactRender` from `@accord-dev/accord-core` (Task 4), and the
`lint.model-retired` rule. Produces:
- `packages/cli/src/commands/skills.ts`: `ReportRow.status` (line 40) gains `'removed'`. A new
  `removeRetired(root: string, out: ReportRow[]): void`: for each path of `RETIRED_FILES`, skip it unless
  `scannable(root, <its folder>)` (line 195, the orphan scan's link check) and `lstatSync(file, { throwIfNoEntry:
  false })?.isFile() === true`; read it, and only when `isIntactRender(text)`, delete it with `rmSync(file)` and
  push `{ status: 'removed', path }`. The read and the `rmSync` sit in one `try` whose `catch` swallows the error,
  leaves the file where it is and pushes no row (a read-only `.claude/agents` on POSIX, `EBUSY` or `EPERM` on
  Windows): sync goes on, prints its whole report, every `overwrote local edits` row included (D-112), exits 0,
  and the orphan scan lists the file it could not remove. It runs whatever `runtimes:` says. `skills()` calls it after `writeHooks` and before `orphans`, so an edited copy is
  still on disk when the scan runs and is reported as an orphan (line 173). The comments that say sync never
  deletes (lines 4-8, 149-151) say instead that it deletes no orphan and removes only a retired file it rendered,
  and the orphan line (line 236) reads `' - no longer declared; accord deletes no orphan - remove it with: rm -rf '`.
- `packages/cli/src/commands/upgrade.ts`: line 47 reads `[CONFIG, WORKFLOW, SETTINGS, ...RETIRED_FILES]`. The
  retired paths whose text read there passes `isIntactRender` are removed from the
  temporary index right after the `update-index --index-info` call (line 101), with
  `gitIn(root, ['update-index', '--force-remove', '--', ...paths], { env })` when there is any. The text comes
  from the git tree, which follows no link: a link's blob holds its target, whose marker is never intact, and a
  path under a linked folder reads as missing.
- `README.md` line 96 becomes the first block line below, and line 121 the second; then `npm run gen` rewrites
  `packages/cli/README.md` (`packages/cli/test/readme.test.ts` checks it).

  ```text
    2. approach (`accord-approach`): the planner drafts the lightest approach that works, a critic argues against it in rounds `accord round <id> --approach` counts, and the owner approves it.
  `skills sync` deletes no copy you may still use. When you remove a runtime, it lists the copies it no longer writes, and you delete them yourself. The one file it deletes is `.claude/agents/accord-architect.md`, an agent accord no longer has, and only while its marker shows nobody edited it: it prints `removed` for it, and lists an edited copy with the others.
  ```
- `packages/cli/test/skills-sync.test.ts` line 227: one comment line above the roster change, its title kept
  (preamble):

  ```text
      // An orphan is never deleted; sync removes only a retired file it rendered (ST-LN-80).
  ```

Must not change: the four write states and their report lines; the orphan report for every other path; exit
codes; the link refusals of `assertNoLink`; `accord upgrade`'s other writes, refusals and its one commit
(`packages/cli/test/upgrade.test.ts` and `skills-sync.test.ts` pass unchanged).

Tests first. In `packages/cli/test/retired-agent.test.ts`, a helper `rendered()` builds an intact old render:
`head = '---\nname: "accord-architect"\ntools: "Read, Grep, Glob"\nmodel: "opus"\neffort: "high"\n---\n'`,
`body = '\nYou propose how a ticket could be built, lightest first.\n'`, and it returns
`head + '<!-- generated by accord skills sync - do not edit - ' + contentHash(head + body) + ' -->\n' + body`.
Each test makes `makeRepo('valid-build')`, sets `runtimes:` in `accord/config.yml` as
`packages/cli/test/skills-sync.test.ts:67-70` does, cleans up in `finally` (a second temporary folder too), and
passes `120_000` as its third argument.
- `ac-1 sync removes the rendered architect agent and lint accepts models architect with a warning`:
  `runtimes: [claude, codex]`; append `models:\n  architect:\n    model: opus\n    effort: high\n` to the config;
  write `rendered()` to `.claude/agents/accord-architect.md`. `skills sync` exits 0, its out holds the line
  `removed .claude/agents/accord-architect.md`, the file is gone, `.claude/agents` holds `accord-planner.md` and
  no `accord-architect.md`, and no file under `.claude/skills`, `.agents/skills` or `.claude/agents` holds
  `accord-architect`. A second `skills sync` prints no `removed` line. `lint --json` exits 0, and its `findings`
  hold exactly one with `rule: 'lint.model-retired'`, `level: 'warning'`, `file: 'accord/config.yml'`,
  `pointer: '/models/architect'` and a reason holding `models.planner`.
- `risk:data-loss sync keeps an edited architect agent and reports it as an orphan`: `runtimes: [claude, codex]`;
  write `rendered() + 'a hand edit\n'`. `skills sync` exits 0, the file keeps its bytes, out holds no `removed`
  line, and err holds `orphan .claude/agents/accord-architect.md`.
- `risk:security sync removes no retired agent through a linked agents folder`: `runtimes: [codex]`; a second
  folder from `mkdtempSync(join(tmpdir(), 'accord-outside-'))` holds `accord-architect.md` = `rendered()`; make
  `.claude` and link `.claude/agents` to that folder with `symlinkSync(outside, <repo>/.claude/agents, 'junction')`
  (as `skills-sync.test.ts:477` does). `skills sync` exits 0, the outside file keeps its bytes, and neither out
  nor err holds `accord-architect`.

In `packages/cli/test/upgrade.test.ts`, a top-level `it` titled
`risk:data-loss upgrade deletes the retired architect agent only when its marker shows no edit`, third argument
`120_000`: for each of `rendered()` (the same helper, written into this file) and `rendered() + 'a hand edit\n'`,
take `const c = copy(pinned, pinnedOther)`, write the text to `.claude/agents/accord-architect.md` in
`c.others[0]`, `commitMsg` it and push it to `origin main` as `refusing()` does at lines 116-119, run `upgrade` in
`c.root` (exit 0), and read
`gitRun(c.remote, 'ls-tree', '-r', '--name-only', 'upgrade/' + v, '--', '.claude/agents/accord-architect.md').trim()`:
empty for the intact copy, the path for the edited one.

## Task 6: The benchmark scripts read no retired agent file that is gone

covers: D-01
files: scripts/round.mjs, scripts/benchmark.mjs, packages/core/test/benchmark-round.test.ts
verify: packages/core/test/benchmark-round.test.ts#risk:regression-the-benchmark-skips-a-retired-agent-whose-rendered-file-is-gone-and-still-needs-every-other-agent-file

Why: `agentSettings` (`scripts/benchmark.mjs:410-416`) reads `.claude/agents/<agent>.md` for every agent of `ROLES`
(`scripts/round.mjs:6-16`, which holds `accord-architect`), and `ac-2 a run holds only when it is no worse than the
current effort on the same sample` calls it on this repository (`packages/core/test/benchmark-round.test.ts:191`).
Once this repository's pin moves past this ticket, `accord upgrade` removes its `.claude/agents/accord-architect.md`
(Task 5) and that read throws `ENOENT`. The five `accord-architect` samples of `scripts/benchmark-samples.json`
stay: they record round 1, and `checkSamples` and the sample counts of `benchmark-samples.test.ts:103` and
`benchmark-worktree.test.ts:576` still need them.

Consumes the rendered agents under `.claude/agents/`. Produces:
- `scripts/round.mjs`: right after `ROLES`, which stays as it is,
  `export const RETIRED = ['accord-architect'];`, with a one-line comment: agents accord no longer renders
  (ST-LN-80); their round-1 samples stay in the list, and the matrix leaves them out once their file is gone.
  `runMatrix` (line 89) maps only the samples whose agent has an entry in `settings`:
  `list.samples.filter((s) => Object.hasOwn(settings, s.agent)).flatMap(...)`, the mapping itself unchanged.
- `scripts/benchmark.mjs`: line 14 also imports `RETIRED` from `./round.mjs`. `agentSettings` skips an agent that
  `RETIRED` holds and whose `.claude/agents/<agent>.md` does not exist (`fs.existsSync`); every other agent's file
  is read as today, so a missing one still throws.

Must not change: `ROLES`, `checkSamples`, `scripts/benchmark-samples.json`; every row `runMatrix` returns when
`settings` has an entry for every agent of the list; what `agentSettings` returns while
`.claude/agents/accord-architect.md` exists, as it does in this repository until its pin moves past this ticket
(`benchmark-round.test.ts`, `benchmark-samples.test.ts` and `benchmark-worktree.test.ts` pass unchanged).

Test first, in `packages/core/test/benchmark-round.test.ts`, an async top-level `it` titled
`risk:regression the benchmark skips a retired agent whose rendered file is gone and still needs every other agent file`.
It imports `scripts/round.mjs` and `scripts/benchmark.mjs` as the tests above it do (`ROLES`, `RETIRED` and
`runMatrix`; `agentSettings`), and works in `tmp = realpathSync.native(mkdtempSync(join(tmpdir(), 'bench-')))`,
removed in `finally` with `rmSync(tmp, { recursive: true, force: true, maxRetries: 5 })`. With
`others = Object.keys(ROLES).filter((a) => a !== 'accord-architect')`, make `<tmp>/.claude/agents` with
`mkdirSync(..., { recursive: true })` and write `'---\nmodel: opus\neffort: high\n---\n'` to
`<tmp>/.claude/agents/<a>.md` for each of `others`:
- `RETIRED` equals `['accord-architect']`;
- `Object.keys(agentSettings(tmp)).sort()` equals `[...others].sort()`;
- `runMatrix(listOf(Object.keys(ROLES)), agentSettings(tmp))` has no row whose `agent` is `accord-architect`, and
  `5 * 3 * others.length` rows (`high` runs at `medium`, `high` and `xhigh`);
- with the same text written to `<tmp>/.claude/agents/accord-architect.md`, `agentSettings(tmp)` has an
  `accord-architect` entry `{ model: 'opus', effort: 'high' }`;
- with `<tmp>/.claude/agents/accord-scout.md` removed, `agentSettings(tmp)` throws.

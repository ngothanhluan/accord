# Ledger

## Rulings
- Ruling: intent: the parts (refresh the step, hand edits, wait for BUG-LN-4, absent workflow out of scope) were confirmed by the owner ("ok") — scope fixed before scoring — none
- Ruling: intent: "the step" is the whole YAML step item named `lint and gate` (name, shell, env and run), matched by name as workflow-script.test.ts already finds it — the name is the one handle a step has — a team that renamed the step gets only the repin and the printed line (D-02)
- Ruling: intent: depends_on BUG-LN-4 so the refreshed step carries its deletion check and `set +e` — refreshing to a script with a known gap ships the gap again — this ticket waits for BUG-LN-4's merge
- Ruling: audit: @ac-1 "that release's" read two ways — reworded to "the newer release's" — none
- Ruling: audit: @ac-2 pin — every pin today's upgrade rewrites outside the step is still rewritten, as today; only the step itself is replaced — keeps today's repin unchanged — a team step pinning accord moves with the upgrade, as it does now
- Ruling: audit: @ac-2 boundary — the step is its own lines; comment and blank lines after its last line are outside and kept (added to the scenario) — a comment the team wrote there survives — none
- Ruling: audit: @ac-3 message — a warning on stderr, so upgrade's three stdout lines that /accord upgrade reads stay as they are; it says to leave exactly one step named `lint and gate` and run upgrade again — a stdout line would change what the skill parses — an owner reading only stdout misses it
- Ruling: audit: "named lint and gate" is the step's `name` value read as YAML, exact case, so a quoted name matches — the same value workflow-script.test.ts reads — a differently cased name gets only the repin and the warning
- Ruling: approach: chosen architect option 1 (yaml-located splice in core) — lightest that meets every criterion — none
- Ruling: approach: critic finding 1 taken — the guard compares the whole re-parsed document, not just the step — an anchor or stray `-` lost outside the step would otherwise push an invalid workflow
- Ruling: approach: critic finding 2 taken — an exactly-one step that cannot be spliced gets its own stderr line — the ac-3 advice would loop forever there — one more message to keep
- Ruling: approach: critic finding 3 taken — the warning says to fix and rerun before merging the upgrade pull request — after the merge upgrade refuses the same version — a longer warning
- Ruling: approach: critic finding 4 taken — @ac-1 compares the whole file to workflowYml — a span test would restate the implementation — none
- Ruling: plan: Task 1 is both the reproduction and the fix, as BUG-LN-3's plan was — a red-only task could not pass its own verify line — Task 1 is larger
- Ruling: plan: `refreshLintStep` returns `{ text }` or `{ refused: 'count' | 'shape' }` — the approach's risk 2 needs two different stderr lines — one more exported type in core
- Ruling: plan: steps are counted across every `jobs.*.steps` list — the ticket names "the workflow's one step" — a team job copying the step gets only the repin and the warning
- Ruling: plan: @ac-1's expected text is the fixture's lines before the step plus the current step, and the test also asserts it equals `workflowYml` — the 0.1.0 bytes before the step were unchecked by the planner — none
- Ruling: plan: a security-lens critic reads the plan beside the plain one — the change overwrites user text (approach failure scenarios) — one more critic
- Ruling: baseline: at 67bb1d0 the full suite (1233 s) had 3 timeouts and no assertion failure — lane-s.test.ts "risk:complex-branching lane S gate done passes a reviewed change…" (130 s of 120 s), show-approval.test.ts "ac-1 every scenario of every real ticket…" (461 s of 300 s), workflow-script.test.ts "code in the diff or an approved ticket: gate done runs…" (85 s of 60 s); run alone the three files pass (34 passed, 1 skipped, 230 s); owner chose (a) "a": record and go on, a timeout of these three at verify is re-run alone, raising the limits is its own backlog ticket — load-only, untouched by this ticket — a real regression in these three could hide behind a timeout
- Ruling: build task 1: the @ac-1 test's expected text applies the 0.1.0-to-<v> repin to the lines before the step, because upgrade repins too, and still asserts expected === fresh when 0.1.0 wrote the same lines — the plan's literal recipe would fail on the pin — none

## Deferred
- Nice (plan round 1.4): Task 1's `expected === fresh` assertion cannot fail; drop it and record whether 0.1.0's lines before the step match today's
- Nice (plan round 2.1): rule 17 should say "every new test", so it does not clash with rule 12 keeping the existing upgrade tests unchanged

## Tasks
- task 1 done 865f65e174e2

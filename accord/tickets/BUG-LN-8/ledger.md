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

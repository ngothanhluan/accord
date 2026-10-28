# Plan review

## Round 1 (whole)
1. Should — `lane_dropped` still fails open on the HEAD read: `fm_at HEAD "$file" || return 1` and a lane grep that needs `S` on the key line skip the approval check for a HEAD written `lane:\n  S`, `lane: !!str S`, a flow mapping, or a symlink; treat an unreadable HEAD or a lane key with no plain value as possibly lane S and go on to the base and branch checks, as `protected_at` does, with a risk:security case (base approved, HEAD `lane:\n  S`, exit 1) — fixed
2. Should — no case seeds lane L or P, so a build that drops the kept L/P clause stays green; add a case (lane L unapproved at the base, lane S at HEAD, exit 1 with `its lane cannot drop after approval`) — fixed
3. Should — the new `ids.md` opening line names `## Moving to lane S`, so `indexOf('## Moving to lane S')` slices start at the opening line: lane-s.test.ts:138-141 fails on `commit every change`, and the new ac-4 `move` slice holds the Dropping section's `accord drop` and `accord new ticket`; anchor the slices on the heading line and name the lane-s.test.ts:138 change, or reword the opening line — fixed
4. Should — Task 4 asserts `anchorText(s, 'MV-1')` starts with `Lane: S`, but the anchor opens with `# Anchor: <id> "<title>"` and a blank line (anchor.ts:29-30), so the executor stops on a false BLOCKED; assert the lines include `Lane: S` — fixed
5. Should — the Task 3 risk:security fail-closed case (file absent at the base, an unreadable flow-mapping lane M commit, HEAD lane S, exit 1) contradicts ac-5's literal first Then; record the reading that unreadable frontmatter counts as possibly approved (ledger Ruling) and keep the case traced to that Ruling — fixed
6. Should — four needles end in a trailing space inside a code span (Task 1 ac-3 `step 6 of ./lane-s.md`, `runs accord worktree open`; Task 2 ac-4 `lane: "S"`, `## Done when`), but the fixed sentences put a comma there, so `includes` fails on correct text; end each needle on the comma or give them in a fenced block — fixed
7. Should — no task runs `npm run typecheck` or `npm run lint`, which CI runs over the test files under strict mode (`catch (e)` with `e.message`, a widened `runtimes` array); add both to Task 4's final run — fixed
8. Nice — renaming the ticket file on the branch hides the approval commit from the walk; record beside the `reset --soft` gap — deferred
9. Nice — the skill-side `-G '^approved_hash:'` matches less than CI's grep (quoted key, space before the colon) — deferred
10. Nice — `ids.md` step 4 says nothing for a rejected push; an agent that force-pushes removes the approval commit — deferred
11. Nice — `ids.md` step 3 points to lane S step 1, which `accord-intent` does not render; say "an empty `## Scope`, which the lane S steps fill at step 1" — deferred
12. Nice — Task 3 does not say each (case, script) pair needs its own sandbox; two runs on one sandbox overwrite `script.sh` and share `calls.log` — deferred

## Round 2 (diff)
No findings

## Closed

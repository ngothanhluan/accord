---
id: "BUG-LN-9"                            # equals the file name: tickets/<id>.md
title: "After compaction a held ticket's session sees only the current intent, not a stale copy from main"
type: "bug" # story | bug
status: draft                              # draft | open | archived | dropped. Document lifecycle only; work status stays in the tracker
lane: "S" # S: one small change, worked from this ticket alone
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# How the dashboard ranks this ticket: high | medium | low; absent means medium.
# priority: medium
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Written by `gate ready`; never edit by hand.
# ac_hash:
ac_hash: "fnv1a64:4b4d2cc88f8e34c8"
---

## Understood
When `accord hook session-resume` runs in the main checkout for a session that holds a ticket (packages/cli/src/commands/hook.ts, the `held` branch), it prints only the ruleset, the `this session works <id>: ...` line and the `enter: <path>` line, and no longer prints `anchorText` read from main's snapshot. Evidence (2026-10-25, a test clone): a Correction committed only on `t/ST-LN-26` was missing from the hook's 25.7 KB anchor but present in the 23.6 KB `accord anchor` that the hook then tells the agent to run in the worktree, so two different copies of the intent landed in context.

## Done when
A hook test with a held ticket whose branch carries a Correction that main lacks shows that the hook output has no `# Anchor:` block and still ends with the `enter:` line, and the existing hook tests pass.

## Decisions
- D-01 Fix only the held branch; keep the anchor injection on compact, resume and clear, and leave the Rulings and the `resume` matcher as they are — "ok, agreed" (owner, 2026-10-25, on queueing option A after the test result)

## Corrections
- "Stop it, no need to run, open the PR. Let the PR run it." (owner, 2026-10-25, on the local affected-test run in step 3)

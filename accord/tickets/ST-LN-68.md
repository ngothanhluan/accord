---
id: "ST-LN-68"                             # equals the file name: tickets/<id>.md
title: "A refused option reaches every teammate and agent before it is proposed again"
type: "story" # story | bug
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
---

## Understood
Queued 2026-10-29 from a review of the pstack skill stack, not yet confirmed: the header of `accord/product/conventions.md` asks for `Rejected: <option> — <reason>` lines, but no workflow writes one and the file holds none. `accord drop <id> --reason` keeps the reason only in the dropped ticket file (packages/cli/src/commands/drop.ts), and the intent interview, `./lane.md`, `./lane-s.md`, `accord-scout` and `accord-architect` never read dropped tickets or `Rejected:` lines before proposing. The verify stage already turns a lasting Correction or Ruling into a convention on the owner's yes (packages/core/skills/verify/SKILL.md step 6), but a refused option has no such path. Today refusals such as ST-LN-24 (cross-ticket file-overlap warnings) and ST-LN-33 (the 25-word sentence cap) live only in one person's private agent memory, so a teammate, or the same owner in Cursor or Codex, can have the same idea proposed again.

## Done when
When a ticket is dropped, or the owner refuses an option during intent or approach, the workflow asks the owner whether it becomes a `Rejected: <option> — <reason>` line in `accord/product/conventions.md` and writes it only on a yes; the intent interview and the approach read those lines and name a matching one to the owner before proposing that option again; lint and the full suite pass.

## Scope
<!-- One repository path per line, never a folder: every file the change is expected to touch, tests and new files included. -->
<!-- Expected, to be confirmed by accord-scout at the start: -->
packages/core/skills/accord/ids.md
packages/core/skills/intent/SKILL.md
packages/core/skills/approach/SKILL.md
packages/core/agents/scout.md
packages/core/src/generated/skills.ts
packages/core/test/skills.test.ts

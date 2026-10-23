---
id: "ST-LN-47"                            # equals the file name: tickets/<id>.md
title: "The auditor runs at high, the critic at xhigh and the scout on sonnet, as benchmark round 1 measured"
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
ac_hash: "fnv1a64:f759b49b6b47be7b"
---

## Understood
In this repository's accord/config.yml only, add a models: block setting auditor to opus at high, critic to opus at xhigh and scout to sonnet at low, then run skills sync so the three .claude/agents files follow; AGENT_DEFAULTS stays unchanged

## Done when
.claude/agents/accord-auditor.md says effort "high", accord-critic.md says effort "xhigh", accord-scout.md says model "sonnet", and no other agent file or AGENT_DEFAULTS changes

## Decisions
- D-01 The auditor and the critic are raised now, in this repository's config — "tôi nghĩ là nâng lên đi."
- D-02 The scout also moves from haiku to sonnet in this repository's config now, unmeasured (round 1 held 0/5 at low, 1/5 at medium on haiku); ST-LN-46 still measures it before any default changes — "A"

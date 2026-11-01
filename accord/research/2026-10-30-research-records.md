# Research records: why research needs a home in the repository

Date: 2026-10-30. Repository at `5c083d3`. Feeds ST-LN-13 and the researcher-agent ticket that follows it.

This is evidence, not a contract. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage; nothing here may be cited as a requirement.

## Question

Where does knowledge made before or beside a ticket (a discussion, a measure, a study, outside library facts) live, and does any stage read it?

## 1. Evidence moved from ST-LN-13's queued intent

ST-LN-13's intent interview (2026-10-30) replaced its queued intent. These lines are kept here verbatim instead of being deleted:

- Owner approved 2026-10-13: an `accord-researcher` agent runs at the approach stage when a ticket touches an outside library, API or version the code cannot answer; writes `accord/tickets/<id>/research.md` with source and date per fact; the architect reads it.
- A library documentation tool first when installed, official docs second, web search third; shipped text describes the tool by function and never names it.
- Widened (owner, 2026-10-25, after the main session proposed it: "ok, do it and open a PR"): knowledge made before a ticket exists, a discussion, a measure or a study, has no home. A ticket's Intent holds five lines, the intent interview replaces the queued intent, and the owner's memory is local to one machine and one runtime. On 2026-10-25 a measure of 129 review findings and a study of GSD fed four tickets and existed only in one session.
- Queued: research is recorded in `accord/research/<date>-<topic>.md`, shared because one study feeds several tickets, with its date and the commit it was made at; a ticket names it under a `research:` key that lint checks exists; the intent interview, architect, critic and planner read it; the interview moves evidence it replaces in the queued intent into the record instead of deleting it. Research is evidence, never a contract. The researcher's output could go there instead of the per-ticket `accord/tickets/<id>/research.md` above; the interview decides.
- Evidence (2026-10-29): in ST-LN-60's intent interview, the main session and `accord-scout` both skipped `accord/research/2026-10-25-plugin-audit.md`, which that ticket named only in free text in its Intent, until the owner asked about it.
- Idea (owner, 2026-10-29): `accord anchor` prints a ticket's research references, so every stage sees them.
- First record: `accord/research/2026-10-25-review-convergence.md`. The ticket schema rejects unknown keys, so `research:` is not usable yet; whether adding it breaks repositories pinned to 0.2.0 is to be checked.

## 2. Facts from the code at `5c083d3`

Found by `accord-scout` for the interview; each with its location.

- The ticket schema rejects unknown keys: `packages/core/schemas/ticket.schema.json:6` (`additionalProperties: false`); no `research` key among its keys (:9-48).
- A schema finding drops the whole frontmatter, not only the bad key: `packages/core/src/load/frontmatter.ts:55-57`; lint then skips the rules that need frontmatter (`packages/core/src/lint/ticket.ts:9`, :53).
- The pin is exact equality on config.yml's `accord` key and refuses every repository-reading command on a mismatch (`packages/cli/src/pin.ts:1,17-18`, `packages/cli/src/run.ts:69-71`). An older CLI therefore never reads a repository pinned to a newer one; the 0.2.0 question above reduces to that refusal. Not run against a published 0.2.0 build.
- The only lint rule that checks a reference exists is `lint.depends-unknown`, level error (`packages/core/src/lint/depends.ts:10-20`, `packages/core/src/lint/rules.ts:56`).
- `accord anchor` prints Intent, Vetoes, Decisions, Corrections and Rulings, and no references (`packages/core/src/status/anchor.ts:10`, :44).
- No shipped skill, agent or template mentions research (grep over `packages/core/{skills,agents,templates}`). Architect, critic and planner receive the ticket path only (`packages/core/agents/architect.md:11`, `critic.md:11`, `planner.md:10-13`).
- Agents are rendered for Claude Code only, with the `tools:` line copied verbatim; no per-repository config adds tools (`packages/core/src/skills/agents.ts:38-63`).
- Eleven tickets name a record only in free text, as an Intent line `- Research: \`accord/research/...\` (evidence, not a contract).` (ST-LN-10, 13, 17, 43, 55, 56, 57, 58, 59, 69, 70).

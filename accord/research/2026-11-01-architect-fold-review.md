# Folding the architect into the plan stage: review for ST-LN-80

Date: 2026-11-01. Repository at `3e768a46`.

Evidence, not a contract. Feeds ST-LN-80; touches ST-LN-71, ST-LN-81, ST-LN-86 and ST-LN-46. Only a ticket's Intent, acceptance criteria, Vetoes, Decisions and Corrections bind any stage.

## Queued Intent of ST-LN-80, replaced by the intent interview (verbatim)

Queued 2026-10-30, not approved; the intent interview replaces this:
- Source: accord/research/2026-10-30-harness-architecture.md section 1. Owner, 2026-10-30: "The critic mechanism repeats in the architect and the planner. Why not gather it in one place? No need for the architect any more. This cuts token use and is faster." (translated).
- Measured: architect plus approach critic are about 11% of a lane M ticket's tokens (planner plus plan critics about 41%); at the first approach approval the owner said a plain yes in 35 of 38 tickets and picked another option in 0; 15 of 26 re-approvals came from the plan stage.
- Against: the approach critic's Musts changed the approach in 112 of 117 cases; for 48 of 94 it is unclear the plan critic would catch them, mostly Decision breaks, since plan mode (packages/core/agents/critic.md, mode `plan`) does not check Decisions.
- Queued intent: drop accord-architect and the approach-mode critic; the planner writes `## Approach` with plan.md; the owner picks the option and answers direction questions before the full plan is written; plan critique also checks every Decision and Correction; the owner approves once after critique. The CLI gates that read `approved_hash` before plan (gate ready) change order, a public interface.
- Open for the interview: what replaces the impact analysis (the scout report of ST-LN-81 or the planner); whether lane-M tickets touching auth, money, migration or data deletion keep a separate direction critique; ST-LN-71 and ST-LN-13 change with this (overlap to settle).

## Review of the queued design

Eight agents in fresh contexts, read-only: five evidence lenses (data re-check, mechanism, alternatives, team fit, late-discovery risk), an advocate, an opponent and a judge. The judge's verdict follows verbatim. Counts marked "measured by lens" were not recounted by the judge; the 2026-10-30 figures could not be re-derived, since their raw rows were not kept.

1. Verdict: SOUND WITH CHANGES. Dropping the architect holds up. Dropping the approach critic and moving the only approval to after critique does not, under quality > cost > speed and CLI-enforced rules.

2. Recommended architecture: drop the architect, keep a capped critic on the short Approach and keep approval before plan.
   1. Intent. No change. The BA or owner runs the interview and says yes in chat (skills/intent/SKILL.md:59-69).
   2. Direction pass. The planner runs in a new short "direction" mode and writes only the `## Approach` draft: an impact list with path:line, 2-3 options lightest first, and failure scenarios with undo for auth, money, migration or data deletion. The architect's rules move into this mode (architect.md:13,14,16,17). The main session writes the section, because the planner cannot edit the ticket (planner.md:10,58). The ST-LN-81 scout report can feed the impact list.
   3. Direction critique. One fresh approach-mode critic reads only the option text (approach/SKILL.md:25-28). It checks every Veto, Decision and Correction (critic.md:18) and stops at the ST-LN-71 round cap. It runs on every lane M ticket, not a routed subset (owner question Q1).
   4. Owner. Picks the option, answers direction questions and says yes. `accord approve` writes `approved_hash` (hash.ts:46). `gate ready` checks approval, open questions and `depends_on` (rules.ts:124-134). This is unchanged and CLI-enforced.
   5. Plan. The planner writes plan.md. The plan critic gains an explicit per-Decision, Correction and ledger-Ruling check in `plan` and `diff` modes (critic.md:21-34), and gets settled approach findings marked "do not re-raise". A plan Must that changes a Decision or the Approach makes the approval stale and forces a re-approval, as approval-stale does today (rules.ts:111, :140).
   6. `gate plan` and the baseline run, then build. No change to gate ready, gate plan, stage.ts:89, approve.ts or the deletion guard.

3. Why
- The plan gate needs approval before plan exists [source]. `PLAN_RULES` holds APPROVAL_MISSING and APPROVAL_STALE (rules.ts:138-141, re-read), and stage.ts:89 returns `intent` until the hash matches (re-read). So "approve once after critique" fails every critique round and shows teammates the wrong stage. Fixing that needs a split `gate plan`, a new stage and a new hash, all public interfaces.
- The CLI would stop enforcing the order [source]. `approve` checks only that the lane is not S (packages/cli/src/commands/approve.ts:9-13, re-read; the path is under cli, not core). "Direction before full plan" would rest on agent recall, which the owner rejects.
- The architect is redundant [source]. The owner picked another option in 0 of 38 tickets (research:53). Plan.md cited architect-named files in 37 of 38, which the research itself calls weak (research:62). Architect and critic both run opus/high (agents.ts:16-17, re-read).
- Early critique pays off, by the lenses' counts [measured by lens; I did not recount].
  - 32 of 40 tickets had an approach Must.
  - Tickets with a Must in plan round 1 ran a median of 4 plan rounds; tickets without ran 2. Ticket size confounds this.
  - Break-even is about one extra plan round. The ~11% gross saving (research:44, source claim; raw rows not kept, research:36) is about 7-9% net once the planner absorbs the impact analysis [judgement].
- A direction change found at plan costs a re-plan of a 44-158 KB plan instead of ~15 Approach lines [measured by lenses]. Examples: BUG-LN-13 ruled its option out; ST-LN-55 round 3 and ST-LN-57 brought new Decisions D-08..D-14.
- The real gap is the checklist, not a missing stage [source, re-read]. Plan mode (critic.md:21-27) names no Decision or Correction. Only the Must severity line covers them (critic.md:36). The CLI checks only that each D-nn is cited (gate/plan.ts:119-127). About 7-10% of plan findings cite a D-nn (37/507 and 31/323 by lens counts).
- Teams: approval before plan lets the BA sign off on AC and direction before the developer plans [source]. A late "no" costs a 15-line rewrite, not a re-plan. The 1-in-38 correction rate comes from a solo owner in the same session (research:53). The research cites no team framework precedent for one approval after the full plan.
- The 15 plan-stage re-approvals (research:55, not recounted) are owner direction decisions that the plan critic surfaced, for example ST-LN-7 D-17/D-18 and ST-LN-63 D-10..D-12. They are not clerical churn, and folding only moves them later.

4. Scope change against the queued intent
- Keep: drop accord-architect; the planner writes `## Approach`; the plan critique checks every Decision and Correction.
- Add: a planner direction mode that carries the architect rules (architect.md:13-17) and failure scenarios with undo; the Decision, Correction and ledger-Ruling check in `diff` mode and in one named lens; "do not re-raise" for settled approach findings; `models.architect` kept as an accepted, deprecated key, because config.schema.json:57-60 has `additionalProperties: false`; stale `.claude/agents/accord-architect.md` cleaned up by `skills sync`; before and after numbers via ST-LN-46.
- Drop: removing the approach critic; "approve once after critique"; moving `gate ready` after plan.
- Other tickets: ST-LN-71 becomes the critic's cap and diff mode inside this design (fold in or keep as the next ticket); ST-LN-81's scout report can feed the impact list; ST-LN-86's researcher attaches to the direction pass; ST-LN-13 is merged (PR #148), nothing changes; ST-LN-46 benchmarks the result; ST-LN-56 fits unchanged; ST-LN-57 is merged and review-only.

5. Unresolved, and what was not checked
- The lenses disagree on routing the critique: the data and alternatives lenses and the advocate wanted it only for risky or large tickets; the risk lens and the opponent on every ticket. The every-ticket choice rests on the risk lens's unverified 1.5-2% figure.
- The 4-versus-2 round gap is confounded by ticket size; no replay measured the cost of a late direction catch.
- Not checked: transcript-based counts (150 Musts over 40 tickets); the ST-LN-26 timings; how `skills sync` removes a dropped agent (skills.ts:146); the build-stage change-of-course re-approval (build/SKILL.md step 6); the claimed undercount of plan-mode D-nn findings.

## Owner choice

Owner, 2026-11-01, of three options put — A: drop the architect, keep a capped direction critic on every lane M ticket, approve before plan, add Decision checks to plan critique; B: as A with the direction critic only on risky or large tickets; C: as queued — answered "option A đi." (translated: "go with option A").

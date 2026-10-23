# Round 1 benchmark

Each sample ran on the agent's current model at its current effort and one step either side. Suggestions only: this report changes no agent definition.

## Runs by agent and effort

| agent | effort | runs | runs held | median min | median input | median cache read | median cache write | median output |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| accord-executor | low | 5 | 5 | 3.2 | 28 | 736791 | 67202 | ~2489 |
| accord-executor | medium | 5 | 5 | 3.9 | 30 | 987765 | 72839 | ~3036 |
| accord-executor | high | 5 | 5 | 4.2 | 30 | 1114624 | 75113 | ~2994 |
| accord-planner | low | 5 | 3 | 1.1 | 10 | 81130 | 43718 | ~1640 |
| accord-planner | medium | 5 | 4 | 2.3 | 12 | 291996 | 56724 | ~5078 |
| accord-planner | high | 5 | 3 | 2.2 | 14 | 266138 | 56639 | ~5624 |
| accord-critic | medium | 5 | 4 | 3.7 | 26 | 489323 | 54392 | ~13322 |
| accord-critic | high | 5 | 5 | 5.5 | 32 | 830826 | 59365 | ~20996 |
| accord-critic | xhigh | 5 | 5 | 12.1 | 62 | 3956371 | 131760 | ~45110 |
| accord-reviewer | medium | 5 | 5 | 2.9 | 14 | 214396 | 49306 | ~2479 |
| accord-reviewer | high | 5 | 5 | 4.8 | 32 | 822780 | 65396 | ~4531 |
| accord-reviewer | xhigh | 5 | 5 | 13.9 | 82 | 3771656 | 133635 | ~12844 |
| accord-final-reviewer | medium | 5 | 5 | 8.9 | 28 | 957411 | 139460 | ~5020 |
| accord-final-reviewer | high | 5 | 5 | 10.9 | 54 | 2288948 | 113951 | ~6112 |
| accord-final-reviewer | xhigh | 5 | 5 | 14.9 | 94 | 5359870 | 200828 | ~31913 |
| accord-auditor | low | 5 | 3 | 0.6 | 4 | 16807 | 17387 | ~555 |
| accord-auditor | medium | 5 | 5 | 0.8 | 4 | 27565 | 6850 | ~627 |
| accord-auditor | high | 5 | 5 | 1.0 | 4 | 27565 | 6629 | ~875 |
| accord-verifier | low | 5 | 5 | 1.6 | 12 | 144764 | 32053 | ~1518 |
| accord-verifier | medium | 5 | 5 | 2.1 | 18 | 271793 | 40770 | ~2642 |
| accord-verifier | high | 5 | 5 | 9.1 | 24 | 364930 | 76464 | ~3455 |
| accord-architect | medium | 5 | 2 | 3.6 | 36 | 905903 | 78126 | ~12929 |
| accord-architect | high | 5 | 1 | 5.2 | 44 | 1317704 | 92651 | ~18642 |
| accord-architect | xhigh | 5 | 3 | 9.0 | 80 | 2707096 | 124391 | ~34510 |
| accord-scout | low | 5 | 0 | 1.2 | 24 | 377145 | 51192 | ~10062 |
| accord-scout | medium | 5 | 1 | 1.9 | 36 | 1078956 | 85574 | ~12911 |

## Suggested effort

| agent | model | current | suggested |
| --- | --- | --- | --- |
| accord-executor | sonnet | medium | low |
| accord-planner | opus | medium | medium |
| accord-critic | opus | high | high |
| accord-reviewer | sonnet | high | medium |
| accord-final-reviewer | opus | high | medium |
| accord-auditor | opus | medium | medium |
| accord-verifier | sonnet | medium | low |
| accord-architect | opus | high | high |
| accord-scout | haiku | low | low |

accord-executor: every effort tried held on all 5 samples; nothing below low was measured.
accord-planner: no effort tried held on all 5 samples.
accord-reviewer: every effort tried held on all 5 samples; nothing below medium was measured.
accord-final-reviewer: every effort tried held on all 5 samples; nothing below medium was measured.
accord-verifier: every effort tried held on all 5 samples; nothing below low was measured.
accord-architect: no effort tried held on all 5 samples.
accord-scout: no effort tried held on all 5 samples.

## Higher effort did better

- accord-critic sample 2 (xhigh): reported 3 Must the current run missed
- accord-critic sample 5 (xhigh): reported 1 Must the current run missed
- accord-auditor sample 3 (high): reported 5 Must the current run missed
- accord-auditor sample 4 (high): reported 2 Must the current run missed

## Samples that held at every effort by default

- accord-critic sample 1: the current-effort run reported no Must, so every effort held there by default.
- accord-critic sample 3: the current-effort run reported no Must, so every effort held there by default.
- accord-critic sample 4: the current-effort run reported no Must, so every effort held there by default.
- accord-reviewer sample 2: the current-effort run reported no Must, so every effort held there by default.
- accord-reviewer sample 3: the current-effort run reported no Must, so every effort held there by default.
- accord-reviewer sample 4: the current-effort run reported no Must, so every effort held there by default.
- accord-reviewer sample 5: the current-effort run reported no Must, so every effort held there by default.
- accord-final-reviewer sample 1: the current-effort run reported no Must, so every effort held there by default.
- accord-final-reviewer sample 2: the current-effort run reported no Must, so every effort held there by default.
- accord-final-reviewer sample 3: the current-effort run reported no Must, so every effort held there by default.
- accord-final-reviewer sample 4: the current-effort run reported no Must, so every effort held there by default.
- accord-final-reviewer sample 5: the current-effort run reported no Must, so every effort held there by default.
- accord-verifier sample 1: the current-effort run marked no criterion fail or blocked, so every effort held there by default.
- accord-verifier sample 2: the current-effort run marked no criterion fail or blocked, so every effort held there by default.
- accord-verifier sample 3: the current-effort run marked no criterion fail or blocked, so every effort held there by default.
- accord-verifier sample 4: the current-effort run marked no criterion fail or blocked, so every effort held there by default.
- accord-verifier sample 5: the current-effort run marked no criterion fail or blocked, so every effort held there by default.

## Samples not held

- accord-planner low: sample 1, sample 5
- accord-planner medium: sample 1
- accord-planner high: sample 3, sample 4
- accord-critic medium: sample 5
- accord-auditor low: sample 1, sample 4
- accord-architect medium: sample 1, sample 2, sample 4
- accord-architect high: sample 1, sample 2, sample 4, sample 5
- accord-architect xhigh: sample 3, sample 5
- accord-scout low: sample 1, sample 2, sample 3, sample 4, sample 5
- accord-scout medium: sample 1, sample 3, sample 4, sample 5

## Holds that rest on a re-run

- executor-1-high: re-ran packages/cli/test/after-verify.test.ts, packages/cli/test/dashboard.test.ts, packages/cli/test/drop.test.ts, packages/cli/test/gate.test.ts, packages/cli/test/hook.test.ts, packages/cli/test/init.test.ts, packages/cli/test/lane-commands.test.ts, packages/cli/test/lane-flow.test.ts, packages/cli/test/load.test.ts, packages/cli/test/new-ticket.test.ts, packages/cli/test/show-approval.test.ts, packages/cli/test/show.test.ts, packages/cli/test/skills-sync.test.ts, packages/cli/test/spawn-surface.test.ts, packages/cli/test/status.test.ts, packages/cli/test/tracker.test.ts, packages/cli/test/trailers.test.ts, packages/cli/test/workflow-script.test.ts, packages/cli/test/worktree.test.ts
- executor-3-medium: re-ran packages/cli/test/hook.test.ts
- executor-4-low: re-ran packages/cli/test/hook.test.ts

## Model and effort per turn

Turns that differ from the dispatched setting: 0

## Runs not judged

None.

## Superseded runs

Dispatched before their worktree was rebuilt; not counted.

- bench r1 executor-1-low (agent a22cb156924ff3227)
- bench r1 executor-1-medium (agent ad6a406414286aa15)
- bench r1 executor-1-high (agent aa19dd4e130b63e10)
- bench r1 executor-2-low (agent af0bcdc8838526f67)
- bench r1 executor-2-medium (agent a992851c1c165af3d)
- bench r1 executor-2-high (agent afc5da87e6fec28b7)
- bench r1 executor-3-low (agent aa6400944a3218b04)
- bench r1 executor-3-medium (agent a47f9a76b7606d41d)
- bench r1 critic-1-medium (agent a36cc58f4d8a4e1b8)
- bench r1 critic-1-high (agent aad01bd8abb59e768)
- bench r1 critic-1-xhigh (agent aae06eb20a31bda4b)
- bench r1 critic-3-medium (agent a3a3a9cf1a7d9261b)
- bench r1 critic-3-high (agent ae042b39d1f9aea7b)
- bench r1 reviewer-1-medium judge (agent a157a16ef50a97573)
- bench r1 verifier-1-low (agent ae47e94acaf3892a5)
- bench r1 verifier-1-medium (agent a23322f3fdfae604c)
- bench r1 verifier-1-high (agent afb732e065888f0be)
- bench r1 verifier-2-low (agent a8be0a66b9c86265b)
- bench r1 verifier-3-low (agent a3a2580c09734df9f)
- bench r1 verifier-3-medium (agent afdf6e64b60e4c3c3)
- bench r1 verifier-3-high (agent a77503247a71ece88)
- bench r1 verifier-5-low (agent ae952330ddd9824e2)

## Compliance

| rule | count |
| --- | ---: |
| tier-up | 12 |
| trailer | 44 |
| test-first | 31 |
| verify-id | 33 |
| round-cap | 2 |
| reassigned | 2 |
| brief-quote | 2 |

### tier-up

- tier-up: ST-LN-3 review round 5 (task 8): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a12d36ee66fec99a6.jsonl
- tier-up: BUG-LN-3 review round 4 (task none, a fix assignment "Fix BUG-LN-3 final review"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4.jsonl
- tier-up: ST-LN-26 review round 4 (task none, a fix assignment "Fix merge review findings"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord-st-ln-26/c0a17689-483d-4eaa-873a-1b356e73e6f2/subagents/agent-adcb02059ae8e5731.jsonl
- tier-up: ST-LN-14 review round 6 (task none, a fix assignment "Fix review round 6 findings"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a16be6a412d626367.jsonl
- tier-up: ST-LN-14 review round 7 (task none, a fix assignment "Fix final review findings"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a42fdce19e5384aab.jsonl
- tier-up: ST-LN-14 review round 8 (task none, a fix assignment "Fix review round 8 findings"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-ae1a242b9c71e5af4.jsonl
- tier-up: ST-LN-14 review round 13 (task none, a fix assignment "Fix root cause 3 and round 13"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a05ad3d18e0a0e5ec.jsonl
- tier-up: ST-LN-14 review round 15 (task none, a fix assignment "ST-LN-14 fix review round 15"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a346b749e7bb18403.jsonl
- tier-up: ST-LN-14 review round 12 (task none, a fix assignment "Fix debug episode 4 root cause 2"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a5f007dc591cb0744.jsonl
- tier-up: ST-LN-14 review round 10 (task none, a fix assignment "Fix review round 10"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a83dd500df5ea2961.jsonl
- tier-up: ST-LN-14 review round 11 (task none, a fix assignment "Fix review round 11"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-ab1a49cb21e02ab89.jsonl
- tier-up: ST-LN-14 review round 14 (task none, a fix assignment "Fix review round 14"): the fix executor asked for sonnet where escalation.fix_round_tier_up asks for opus — C--Work-accord/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-af7e4a08aedc9be8c.jsonl

### trailer

- trailer: ST-LN-6 task ?: commit 3a1c7a2 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 3a1c7a2, shown in C--Work-accord/08fcaf7a-a2ab-47c9-b0fb-f3e242e9b096/subagents/agent-a0625efaf00594b46.jsonl
- trailer: ST-LN-6 task 4: commit 73a1818 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 73a1818, shown in C--Work-accord/08fcaf7a-a2ab-47c9-b0fb-f3e242e9b096/subagents/agent-a66c6d44d462e0baf.jsonl
- trailer: ST-LN-6 task 2: commit 31f687f carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 31f687f, shown in C--Work-accord/08fcaf7a-a2ab-47c9-b0fb-f3e242e9b096/subagents/agent-a9a1d82562de89521.jsonl
- trailer: ST-LN-6 task 3: commit 34962b5 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 34962b5, shown in C--Work-accord/08fcaf7a-a2ab-47c9-b0fb-f3e242e9b096/subagents/agent-aa3248d2933c21a61.jsonl
- trailer: ST-LN-6 task 5: commit 5974603 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 5974603, shown in C--Work-accord/08fcaf7a-a2ab-47c9-b0fb-f3e242e9b096/subagents/agent-ab18390a081d2b8ac.jsonl
- trailer: ST-LN-6 task ?: commit 2d53a22 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 2d53a22, shown in C--Work-accord/08fcaf7a-a2ab-47c9-b0fb-f3e242e9b096/subagents/agent-af0f1cdffc4a16313.jsonl
- trailer: ST-LN-20 task 1: commit 23f2b24 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 23f2b24, shown in C--Work-accord/0faa2b47-22ec-4155-9819-74b1e6fabab9/subagents/agent-a587263c77e25a2b2.jsonl
- trailer: ST-LN-20 task ?: commit b459c73 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit b459c73, shown in C--Work-accord/0faa2b47-22ec-4155-9819-74b1e6fabab9/subagents/agent-a99b1a76b983e2ab2.jsonl
- trailer: ST-LN-20 task 2: commit a08e9d4 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit a08e9d4, shown in C--Work-accord/0faa2b47-22ec-4155-9819-74b1e6fabab9/subagents/agent-ab2c182d881ed0e53.jsonl
- trailer: ST-LN-20 task ?: commit c442f42 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit c442f42, shown in C--Work-accord/0faa2b47-22ec-4155-9819-74b1e6fabab9/subagents/agent-ad06c1e622193e292.jsonl
- trailer: ST-LN-18 task 1: commit 20d87c7 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 20d87c7, shown in C--Work-accord/315082cd-0fb1-4fb3-997c-28ebb64393ca/subagents/agent-a1cf93fed35992581.jsonl
- trailer: ST-LN-18 task 2: commit f854b8f carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit f854b8f, shown in C--Work-accord/315082cd-0fb1-4fb3-997c-28ebb64393ca/subagents/agent-ae9c986b039d42290.jsonl
- trailer: ST-LN-7 task 1: commit 0496cf0 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 0496cf0, shown in C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ac2ea8c2c64fff9ae.jsonl
- trailer: ST-LN-4 task 1: commit cfe4957 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit cfe4957, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a0060c39db1362c88.jsonl
- trailer: IDS-1 task 5: commit 34d8842 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 34d8842, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a0433878b56f7db31.jsonl
- trailer: ST-LN-4 task 2: commit e7ead5c carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit e7ead5c, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a1764a0d8856360e7.jsonl
- trailer: ST-LN-4 task 4: commit 4154519 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 4154519, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a1a5fad522566e38a.jsonl
- trailer: BUG-LN-2 task 1: commit 55db941 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 55db941, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a2d0e877c525bc225.jsonl
- trailer: BUG-LN-2 task 7: commit 0809f58 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 0809f58, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a4126b582ac565e39.jsonl
- trailer: IDS-1 task 4: commit bb53cb9 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit bb53cb9, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a590918bf320910d1.jsonl
- trailer: IDS-1 task ?: commit d194b65 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit d194b65, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a59bd66de2d67047a.jsonl
- trailer: BUG-LN-2 task 6: commit 35ddbdf carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 35ddbdf, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a6749d5420a72fc2d.jsonl
- trailer: ST-LN-4 task ?: commit 6f0249a carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 6f0249a, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a67d61cdd1e27ec50.jsonl
- trailer: IDS-1 task 1: commit 501be00 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 501be00, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- trailer: BUG-LN-2 task 4: commit b5c523c carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit b5c523c, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a8325726d1d76e70c.jsonl
- trailer: BUG-LN-2 task 4: commit 147192b carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 147192b, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a8325726d1d76e70c.jsonl
- trailer: BUG-LN-2 task 3: commit 1902080 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 1902080, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a871e35290e305dfc.jsonl
- trailer: ST-LN-4 task ?: commit 76b6aab carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 76b6aab, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ab52b20505e136dc9.jsonl
- trailer: IDS-1 task 1: commit 32707dd carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 32707dd, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ab88ce7e32808ca77.jsonl
- trailer: ST-LN-4 task 5: commit 74f6896 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 74f6896, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ad1a8c290270d3a91.jsonl
- trailer: BUG-LN-2 task 5: commit 46daac6 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 46daac6, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ad49e6c01643f1407.jsonl
- trailer: IDS-1 task 2: commit ab0aa8a carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit ab0aa8a, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ae9a498f31363f441.jsonl
- trailer: IDS-1 task 3: commit 3e324dd carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 3e324dd, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aeeb44c2343443d02.jsonl
- trailer: ST-LN-4 task 3: commit 91c2f3c carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 91c2f3c, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-af4b3e3562fe8582c.jsonl
- trailer: BUG-LN-2 task 2: commit af39d74 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit af39d74, shown in C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-afc65b467948d63a3.jsonl
- trailer: TAGS-1 task 3: commit 68e6e38 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 68e6e38, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-a16ae2abe51899dac.jsonl
- trailer: TAGS-1 task 1: commit 4151346 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 4151346, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-a1b75bfbb937146d4.jsonl
- trailer: TAGS-1 task ?: commit e50e416 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit e50e416, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-a2c473bd66c53f4c3.jsonl
- trailer: TAGS-1 task 4: commit 04075ee carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 04075ee, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-a42f9f69073ce4311.jsonl
- trailer: TAGS-1 task 1: commit 7972ace carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 7972ace, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ab4adbef105ce64b3.jsonl
- trailer: BASE-1 task 1: commit 60173bc carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 60173bc, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ab931b27ed685d5be.jsonl
- trailer: TAGS-1 task 2: commit 1bcd7b0 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 1bcd7b0, shown in C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-abc29dd4eafcb3a98.jsonl
- trailer: ST-LN-6 task 1: commit c8e6048 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit c8e6048
- trailer: IDS-1 task ?: commit 01455d0 carries "Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>" — commit 01455d0

### test-first

- test-first: ST-LN-20 task 2: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord/0faa2b47-22ec-4155-9819-74b1e6fabab9/subagents/agent-ab2c182d881ed0e53.jsonl
- test-first: ST-LN-7 task 6: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-a5e68e831143e0fe2.jsonl
- test-first: ST-LN-7 task 5: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-a82c8deaa299845fd.jsonl
- test-first: ST-LN-7 task 9: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-a879c895119b05447.jsonl
- test-first: ST-LN-7 task 1: its first edit to a source file (packages/cli/src/load/proc.ts), no test edit seen through Edit or Write — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ac2ea8c2c64fff9ae.jsonl
- test-first: ST-LN-7 task 4: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7.jsonl
- test-first: ST-LN-7 task 3: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae42b225646985eb2.jsonl
- test-first: BUG-LN-3 task 4: its first edit to a source file (packages/core/src/scaffold/workflow.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a039fb9206f028f70.jsonl
- test-first: BUG-LN-1 task 1: its first edit to a source file (packages/core/src/model/snapshot.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a340350bb079b2fcd.jsonl
- test-first: ST-LN-3 task 1: its first edit to a source file (packages/core/src/skills/render.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a519d62d631872479.jsonl
- test-first: BUG-LN-2 task 4: its first edit to a source file (packages/cli/src/load/fs.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a8325726d1d76e70c.jsonl
- test-first: IDS-1 task 1: its first edit to a source file (packages/cli/src/load/fs.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ab88ce7e32808ca77.jsonl
- test-first: ST-LN-1 task 2: its first edit to a source file (packages/cli/src/load/fs.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-ae39681c56cbc16b4.jsonl
- test-first: IDS-1 task 3: its first edit to a source file (packages/cli/src/load/fs.ts), no test edit seen through Edit or Write — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aeeb44c2343443d02.jsonl
- test-first: TAGS-1 task 3: its first edit to a source file (packages/core/src/write/testtag.ts), no test edit seen through Edit or Write — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-a16ae2abe51899dac.jsonl
- test-first: REFS-1 task 2: its first edit to a source file (packages/core/src/gate/refs.ts), no test edit seen through Edit or Write — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-a96ecf64e0b5f13d6.jsonl
- test-first: TAGS-1 task 1: its first edit to a source file (packages/core/src/write/testtag.ts), no test edit seen through Edit or Write — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ab4adbef105ce64b3.jsonl
- test-first: ST-LN-34 task 3: its first edit to a source file (packages/cli/src/run.ts) came before its first edit to a test file — C--Work-accord/cfa22f34-30e9-4ecd-bbc6-b4338a414ecb/subagents/agent-ae030f4c6194d9f6b.jsonl
- test-first: ST-LN-19 task 1: its first edit to a source file (packages/core/src/load/gherkin.ts), no test edit seen through Edit or Write — C--Work-accord/f9a01bf4-dccd-4df4-9462-329f97db879c/subagents/agent-a1b32b039151be6ba.jsonl
- test-first: ST-LN-19 task 3: its first edit to a source file (packages/cli/src/commands/show.ts), no test edit seen through Edit or Write — C--Work-accord/f9a01bf4-dccd-4df4-9462-329f97db879c/subagents/agent-a31797be01db90be6.jsonl
- test-first: ST-LN-19 task 4: its first edit to a source file (packages/cli/src/commands/show.ts), no test edit seen through Edit or Write — C--Work-accord/f9a01bf4-dccd-4df4-9462-329f97db879c/subagents/agent-abc28163b14d68019.jsonl
- test-first: ST-LN-14 task 11: its first edit to a source file (scripts/benchmark.mjs), no test edit seen through Edit or Write — C--Work-accord-st-ln-14/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-a456fef9414e80b47.jsonl
- test-first: ST-LN-14 task 2: its first edit to a source file (scripts/compliance.mjs), no test edit seen through Edit or Write — C--Work-accord-st-ln-14/2c76daea-883d-4bcc-b318-c2e16eae0d09/subagents/agent-ae7d492dd7802c1a9.jsonl
- test-first: ST-LN-27 task 2: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord-st-ln-27/534989db-2e8d-4ed8-aa14-256e70aeed28/subagents/agent-a35dfbff66832ecb8.jsonl
- test-first: ST-LN-27 task 6: its first edit to a source file (packages/cli/src/commands/hook.ts) came before its first edit to a test file — C--Work-accord-st-ln-27/534989db-2e8d-4ed8-aa14-256e70aeed28/subagents/agent-a92ab682925ade099.jsonl
- test-first: ST-LN-27 task 8: its first edit to a source file (packages/cli/src/commands/worktree.ts), no test edit seen through Edit or Write — C--Work-accord-st-ln-27/534989db-2e8d-4ed8-aa14-256e70aeed28/subagents/agent-af2cff15161e82c1e.jsonl
- test-first: ST-LN-30 task 5: its first edit to a source file (packages/cli/src/commands/fetch-limit.ts) came before its first edit to a test file — C--Work-accord-st-ln-30/27360965-f877-4d4a-b925-b29fb899d250/subagents/agent-aaf579c7c1593f1db.jsonl
- test-first: ST-LN-8 task 2: its first edit to a source file (packages/cli/src/commands/gate.ts), no test edit seen through Edit or Write — C--Work-accord-st-ln-8/54bc8e69-8fa8-4bfb-86ca-a40e2e72a6a6/subagents/agent-a5a92e573cfc79ca7.jsonl
- test-first: ST-LN-31 task 4: its first edit to a source file (packages/core/src/gate/lane-s.ts), no test edit seen through Edit or Write — C--Work-accord/6630d237-9633-47a4-9a06-d2d06bdcad82/subagents/agent-ac43042fb74739173.jsonl
- test-first: ST-LN-25 task 4: its first edit to a source file (packages/cli/src/commands/worktree.ts) came before its first edit to a test file — C--Work-accord-st-ln-25/be3afed9-29df-4993-8231-1a073a154d36/subagents/agent-ab1c7406495b0bd5d.jsonl
- test-first: ST-LN-25 task 1: its first edit to a source file (packages/cli/src/commands/registry.ts) came before its first edit to a test file — C--Work-accord-st-ln-25/be3afed9-29df-4993-8231-1a073a154d36/subagents/agent-ac27fb58fc0adce9d.jsonl

### verify-id

- verify-id: ST-LN-7 task 2: accord task-done refused: packages/core/test/schemas.test.ts#risk:parsing-setup-is-a-list-of-non-empty-command-strings is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('config.schema.json') — C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#ac-1-new-ticket-assigns-the-creators-next-number-for-its-type is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('accord new ticket - ids assigned from people') — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#risk:complex-branching-without-people-and-without-an-id-new-ticket-exits-2-and-writes-nothing is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('accord new ticket - ids assigned from people') — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#risk:complex-branching-the-first-ticket-in-a-repository-with-no-commit-gets-number-1 is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('accord new ticket - ids assigned from people') — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#risk:complex-branching-a-ticket-added-and-deleted-on-a-merged-and-deleted-branch-keeps-its-number is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('accord new ticket - ids assigned from people') — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/core/test/schemas.test.ts#risk:parsing-people-maps-an-email-to-2-to-4-capital-letters is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('ids config keys') — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/core/test/schemas.test.ts#risk:parsing-legacy_ids-is-a-list-of-distinct-ticket-ids is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('ids config keys') — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240.jsonl
- verify-id: STALE-1 task 1: accord task-done refused: packages/cli/test/status.test.ts#ac-1-a-ticket-untouched-past-the-window-shows-its-idle-days is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('idle tickets (STALE-1)') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: STALE-1 task 1: accord task-done refused: packages/core/test/lane-status.test.ts#ac-3-the-window-comes-from-stale_days is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('idle days (STALE-1)') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: STALE-1 task 1: accord task-done refused: packages/core/test/lane-status.test.ts#ac-5-the-default-window-is-14-days-and-idle-means-older-than-it is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('idle days (STALE-1)') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: TAGS-1 task 1: accord task-done refused: packages/core/test/work.test.ts#risk:parsing-verify-markers-map-the-test-id-before-them-and-stay-out-of-verify is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('verify markers') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: TAGS-1 task 1: accord task-done refused: packages/core/test/testtag.test.ts#risk:parsing-inserts-the-test-tag-right-after-the-ac-token-and-before-a-comment is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('writeTestTags') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: TAGS-1 task 1: accord task-done refused: packages/core/test/testtag.test.ts#risk:parsing-reads-crlf-and-writes-lf is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('writeTestTags') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/gate.test.ts#ac-1-a-citation-under-a-dot-led-directory-resolves is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 citations') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/gate.test.ts#ac-2-a-citation-starting-with-dot-slash-resolves is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 citations') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/gate.test.ts#ac-4-a-parent-directory-citation-is-reported-as-written is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 citations') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-dot-extension-word-in-prose-is-not-a-candidate is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-run-of-three-dots-before-a-path-is-stripped is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-dot-before-a-quote-is-stripped-with-the-quote is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-backslash-parent-path-is-named-as-written is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#ac-1-new-ticket-assigns-the-creators-next-number-for-its-type is not in node_modules/.cache/accord/junit.xml — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#risk:complex-branching-without-people-and-without-an-id-new-ticket-exits-2-and-writes-nothing is not in node_modules/.cache/accord/junit.xml — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#risk:complex-branching-the-first-ticket-in-a-repository-with-no-commit-gets-number-1 is not in node_modules/.cache/accord/junit.xml — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/cli/test/new-ticket.test.ts#risk:complex-branching-a-ticket-added-and-deleted-on-a-merged-and-deleted-branch-keeps-its-number is not in node_modules/.cache/accord/junit.xml — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/core/test/schemas.test.ts#risk:parsing-people-maps-an-email-to-2-to-4-capital-letters is not in node_modules/.cache/accord/junit.xml — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- verify-id: IDS-1 task 1: accord task-done refused: packages/core/test/schemas.test.ts#risk:parsing-legacy_ids-is-a-list-of-distinct-ticket-ids is not in node_modules/.cache/accord/junit.xml — C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-a70bada2fdcc32c17.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/gate.test.ts#ac-1-a-citation-under-a-dot-led-directory-resolves is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 citations') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/gate.test.ts#ac-2-a-citation-starting-with-dot-slash-resolves is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 citations') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/gate.test.ts#ac-4-a-parent-directory-citation-is-reported-as-written is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 citations') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-dot-extension-word-in-prose-is-not-a-candidate is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-run-of-three-dots-before-a-path-is-stripped is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-dot-before-a-quote-is-stripped-with-the-quote is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl
- verify-id: REFS-1 task 1: accord task-done refused: packages/core/test/refs.test.ts#risk:parsing-a-backslash-parent-path-is-named-as-written is not in node_modules/.cache/accord/junit.xml; the test sits inside describe('REFS-1 leading dot') — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad00410f5da46c158.jsonl

### round-cap

- round-cap: ST-LN-14 review: reached round 9 with no Ruling that allows going past the round cap — accord/tickets/ST-LN-14/review.md
- round-cap: ST-LN-3 review: reached round 6 with no Ruling that allows going past the round cap — accord/tickets/ST-LN-3/review.md

### reassigned

- reassigned: ST-LN-30 task ?: got another assignment through SendMessage ("Bound argv of the untracked check") after it reported DONE, instead of a fresh agent — C--Work-accord-st-ln-30/27360965-f877-4d4a-b925-b29fb899d250/subagents/agent-a68d822e11c4edac4.jsonl
- reassigned: ST-LN-30 task 4: got another assignment through SendMessage ("Tighten ignored-file check in task 4") after it reported DONE, instead of a fresh agent — C--Work-accord-st-ln-30/27360965-f877-4d4a-b925-b29fb899d250/subagents/agent-ab90f1de145e7952b.jsonl

### brief-quote

- brief-quote: ST-LN-5 task 2: the brief's copy of the ticket differs from accord/tickets/ST-LN-5.md as committed when it was dispatched, first at line 45: "  @ac-1 @test:packages/core/test/stage-skills.test.ts#ac-1-the-shared-ask-rule-holds-the-fixed-sentence-beside-every-sta" — C--Work-accord/2f15fc76-08e1-4f90-b4be-702481226959/subagents/agent-af8b638bf4912d287.jsonl
- brief-quote: VID-1 task 3: the brief's copy of the ticket differs from accord/tickets/VID-1.md as committed when it was dispatched, first at line 59: "  @ac-3 @test:packages/cli/test/lane-commands.test.ts#ac-3-gate-plan-fails-on-a-comma-inside-a-verify-id" — C--Work-accord/cc17354f-112e-474f-be39-8636aa1d136a/subagents/agent-ad7ebb4815231bd0f.jsonl


## Measurement notes

- Times and tokens come from one machine running many runs at once: executors ran beside about 10 to 45 node processes, and executor-2 runs at low, medium and high saw packages/cli/test/worktree.test.ts time out at 30 s under that load. Compare efforts within a row with that in mind; the hold of every executor run rests on the round's own suite run in its worktree, which passed for all 15.
- accord-verifier high: verifier-1-high (first dispatch) and verifier-2-high each left a hung bash call running `python3 - <<'E'` with an empty heredoc. The first verifier-1-high run is superseded and not counted; its re-dispatch hung the same way after its final report. verifier-2-high ended 1920 s after dispatch, only after the owner stopped its processes. Its final report came first, so both counted runs are judged on complete transcripts, but their minutes include the hang: the verifier high median of 9.1 min is not a measure of the work.
- Twenty-two runs dispatched before their worktree was rebuilt or their judge brief changed are listed under "Superseded runs" and not counted; the eight executor runs first dispatched under a session worktree lock, which refused their commands, are among them and were dispatched again.
- Judges count differently: some count wrong facts or new items per item, others per criterion, so counts compare within one judge's report, not across rows. Each sample has one run per effort.
- Several judges read Claude Code session transcripts, or listed folders under the bench root, for evidence beyond the files their brief names; one judge ran copies of the scripts against a transcript folder. None of this changes a run under test, but those verdicts rest on more than the brief.
- A run whose session went on after its hand-back once had its later text taken as its report; fixed before this report (the last hand-back is the report), and the one judge it misled (reviewer-1-medium) was dispatched again on the corrected brief.


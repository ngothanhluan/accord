---
ticket: "ST-LN-5"
commit: "271d5e4230d69ff2113ea016ce2754bea6b84659"
reviewed_on: "2026-10-18"
---

## @ac-1 the shared rule sends a question that needs context to plain chat

Result: pass

Evidence: Exists/substantive: packages/core/skills/shared/ask.md:6-12 holds both sentences (wrapped across lines). Test packages/core/test/stage-skills.test.ts:63-79 renders skillTargets for all four runtimes, flattens line breaks plus surrounding space/tab as the Given says, and checks ask.md of all 8 stages in both skillDirs (.agents/skills, .claude/skills) for both verbatim sentences. Wired/data: ran `npx vitest run packages/core/test/stage-skills.test.ts`, 21 passed; the full-suite junit lists the test. The generated src/generated/skills.ts carries the text (grep "plain chat" = 1), and `node packages/cli/dist/cli.js skills sync` leaves git status clean, so the 8 synced .claude/skills/*/ask.md copies match the source (checked accord-intent/ask.md).

## @ac-2 the shared rule says when to ask multiple choice and when to ask an open question

Result: pass

Evidence: Sentence is in packages/core/skills/shared/ask.md:14-18 verbatim (wrapped). Test stage-skills.test.ts:81-96 checks it in ask.md of every stage in both directories on the in-memory render with the same flattening. Passed in the vitest run above; synced copies unchanged by re-sync.

## @ac-3 the shared rule asks for plain words and drops the ASK-1 sentence

Result: pass

Evidence: Plain-words sentence at packages/core/skills/shared/ask.md:20-22 verbatim. Test stage-skills.test.ts:98-114 checks it plus a lowercase absence of "may see only the question and its options" after flattening, for every stage and directory; passed. Independent `grep -rli "may see only"` over .claude and packages/core/skills returned nothing.

## @ac-4 the intent skill takes the kind of question from the shared rule

Result: pass

Evidence: packages/core/skills/intent/SKILL.md:34-35 (and .claude/skills/accord-intent/SKILL.md:34-35) step 5 "One question per message ... follows `./ask.md`". Test stage-skills.test.ts:116-134 splits steps, strips `**`, requires exactly one step starting "One question per message" holding `./ask.md`, and rejects "multiple choice where possible" in any case, per directory; passed. grep for that phrase in .claude and packages/core/skills found nothing.

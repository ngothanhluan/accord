## Round 1

Must 1 [patch]: a ticket file stem with spaces or `|` reaches `$.command.run` as the text of a `/accord pick-up` or `continue` request, so a hostile file name forges the owner's request — packages/core/panel/view.js:46-49 — fixed in 14c0ace
Should 2 [patch]: a formatter rewrote `skills.ts` and `skills-sync.test.ts` to double quotes and new wrapping, burying the panel change; `scaffold/panel.ts` was double-quoted too — packages/cli/src/commands/skills.ts:1, packages/cli/test/skills-sync.test.ts:1 — fixed in 7e1b4bb
Nice 3 [patch]: the orphan report suggests `rm -rf .claude/accord-panel` and removing the `accord` marketplace keys without checking the generated marker — packages/cli/src/commands/skills.ts:214 — deferred
Nice 4 [patch]: `MARKER` accepts any of three marker tails on any form, looser than the html-only match it replaced — packages/core/src/skills/render.ts:30 — deferred
Nice 5 [patch]: `mergePanel` has two stacked JSDoc blocks and a redundant `m !== undefined` check — packages/core/src/scaffold/panel.ts:14 — deferred
Nice 6 [patch]: two tests carry `risk:` names with no matching risk — packages/cli/test/skills-sync.test.ts:863, packages/core/test/panel.test.ts:141 — deferred
Nice 7 [patch]: `clean` is exported from view.js with no outside caller — packages/core/panel/view.js:9 — deferred

## Round 2

No findings

## Round 3

Should 1 [patch]: an open but unplaced pane skips the refresh on `turn.complete` and later draws a stale dashboard, against ac-1 — packages/core/panel/register.js:53 — fixed in c3b0f08
Should 2 [patch]: rows show only id and title and drop the stage, who and blocked-by fields the JSON carries and the CLI prints, against D-01 — packages/core/panel/view.js:41 — fixed in c3b0f08
Nice 3 [patch]: in the /accord named-ticket section, "Then run Pick up or Continue … on that ticket" follows the no-such-ticket sentence and can bind to the missing id — packages/core/skills/accord/SKILL.md:24-26 — deferred

## Round 4

Nice 1 [patch]: the first draw after widening shows the old dashboard until the refresh run finishes — packages/core/panel/register.js:63 — deferred
Nice 2 [patch]: an explicit `/accord-panel` refresh does not clear `stale`, so one redundant sequential run follows — packages/core/panel/register.js:50 — deferred
Nice 3 [patch]: the row-format test is named `risk:parsing` and never covers `idleDays` — packages/core/test/panel.test.ts — deferred

verdict: converged

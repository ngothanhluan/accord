# Ledger

## Rulings
- Ruling: ac-5 names neither the plugin directory's path nor the settings key that enables it; the approach stage chooses both, once Claude Code's project-level plugin loading is checked — the docs do not say how a project-level plugin is enabled — cost if wrong: the plan fixes a path the owner would have named differently.
- Ruling: `ui: false`, since the pane is a terminal or Desktop pane tested headlessly through the mod test runner, with no web prototype for `gate ready` to require — cost if wrong: no design reference is recorded for the pane.
- Ruling: a repository that drops claude from `runtimes` after the panel was installed is left as skills sync leaves any orphan today (reported, never deleted) — cost if wrong: a stale panel stays until removed by hand.
- Ruling: the plugin lives at `.claude/accord-panel/` as marketplace `accord` with plugin `accord-panel` under `plugin/` — the documented two-level layout; a plugin at the marketplace root is undocumented — cost if wrong: one path constant changes, plus orphan handling for the old path.
- Ruling: JSON files carry the generated marker as their `description` value — JSON has no comments, and `claude plugin validate --strict` passed with it in hooks.json and needs a description in marketplace.json — cost if wrong: `/plugin` lists the panel with the marker as its description.
- Ruling: an existing `enabledPlugins["accord-panel@accord"]` is left as the owner set it; only an absent key is set to true — this keeps a deliberate `false` — cost if wrong: a stale `false` hides the panel.
- Ruling: buttons call `$.command.run({ command: "accord", args })`, not `$.prompt.submit` — verified by running that `command.run` runs a skill as a slash command, while submitted text only reaches Claude as words — cost if wrong: none known; the owner checks a press at verify.
- Ruling: the mod runs the CLI by the package spec spliced at render, not by the pin read from config.yml — reading config.yml would break D-04 (the pane reads only the CLI output) — cost if wrong: a worktree whose pin differs from the main checkout shows the pin message.
- Ruling: New request is left out of the pane while the trimmed search text is empty, rather than drawn disabled — Button has no `disabled` prop in the mods API — cost if wrong: the owner may expect a greyed button.
- Ruling: Enter in the search box does nothing — D-05 ties New request to a button, and Enter while searching would start an unwanted request — cost if wrong: one extra press.
- Ruling: the pane opens at an interactive terminal session start; the host shows it only at 144 columns or more (interface.md), otherwise the pane waits undrawn; `$.ui.open` resolves nothing, so the mod reads `isPlaced` from `$.ui.panes()` and a toast names `/accord-panel` (corrected after plan critic rounds 1 and 2); `/accord-panel` reopens it and runs the CLI again — `session.start` carries no viewport — cost if wrong: an inline pane above the prompt in a main-screen terminal.
- Ruling: the CLI runs only while the pane is open, never for a subagent's turn, with one run in flight and at most one queued rerun — a run per turn costs an npx start each — cost if wrong: the pane lags one run behind during a burst of turns.
- Ruling: `$.process.run` gets a 120 s timeout, and a rejection, an unparsable stdout or an empty stderr shows a message as in ac-3 — a first npx fetch can be slow and the CLI output is a trust boundary — cost if wrong: a slow first open shows a message instead of the dashboard.
- Ruling: an existing `extraKnownMarketplaces.accord` with another source is refused with the by-hand message, never overwritten — overwriting would drop the owner's entry — cost if wrong: a team with its own marketplace named accord must rename it by hand.
- Ruling: `/accord continue <id>` on an id with no claim branch says so and offers Pick up — Continue switches to an existing claim branch — cost if wrong: one extra step in chat.
- Ruling: the marketplace path in settings is `./.claude/accord-panel`, relative to the repository — the spike loaded a relative path — cost if wrong: one string changes.
- Ruling: `view.js` never receives `$`; `register.js` builds the elements — the loader's static rules forbid passing `$` to an imported function — cost if wrong: none known.
- Ruling: the source `register.js` holds the literal `ACCORD_PACKAGE_SPEC`, which rendering replaces, and `pluginTargets` throws when it is missing — so a renamed token cannot ship silently — cost if wrong: one constant.
- Ruling: `planHooks` and `writeHooks` keep their names although they now also plan the panel keys — smallest diff — cost if wrong: a misleading function name.
- Ruling: before each run the pane checks it is still open with `$.ui.panes()`, not through a `ui.close` hook — a documented call; a `ui.close` hook is unverified — cost if wrong: one extra call per turn.
- Ruling: the messages read `accord exited N`, `accord did not finish: <message>` and `accord dashboard --json printed no dashboard`; npm's own lines are stderr lines starting with `npm `, ignoring case — cost if wrong: wording.
- Ruling: YOURS, TEAM and READY always show (`none` when empty), UP NEXT when present, EPICS only with rows; while searching, a section with no match is left out — mirrors the CLI text — cost if wrong: layout.
- Ruling: titles and message lines are stripped of control and bidi characters, the same set as the dashboard text — the CLI output is a trust boundary — cost if wrong: none known.
- Ruling: `plugin.json` `version` is the CLI version, so a release changes Claude Code's plugin cache key — cost if wrong: a stale cached pane.
- Ruling: no separate drift test for `generated/panel.ts`; the panel tests run the generated text and every task runs `npm run gen` — cost if wrong: a source edit made without gen goes untested.

- Ruling: a pane reload (`/reload-plugins`) after a sync is not handled; the pane shows Loading until the next turn — plan critic round 3, Nice — cost if wrong: one turn of Loading after a reload.

- Ruling: on a cold npm cache the pane's npx run and the SessionStart hook's npx run may install the same package at once and the pane may show `accord exited 1` until the next run — self-healing, plan critic round 4 Nice — cost if wrong: one failed first open on a fresh machine.
- Ruling: panel.test.ts starts with an eslint-disable of no-explicit-any for the fake host — the host mirrors an untyped mod API — cost if wrong: lint is silent on `any` in that one test file.
- Ruling: the MARKER regex writes the JSON indent as ` {2}` — eslint no-regex-spaces rejects two literal spaces; the match is the same — cost if wrong: none.
- Ruling: after task 1, view.js parses stdout only and ignores exitCode, and `view` ignores `query` — tasks 4 and 5 add the search filter and failure paths — cost if wrong: none once those tasks land.
- Ruling: after task 1, register.js draws the pane through `view(state, '')` with no Input or buttons — the ac-2 and ac-3 tasks add them — cost if wrong: none once those tasks land.
- Ruling: mergePanel spreads existing keys over the defaults, so an owner's `false` and a foreign `accord` marketplace stay untouched — the lightest merge that keeps an existing key's value; task 3 refuses a foreign `accord` source before the merge — cost if wrong: none here.
- Ruling: init's `refusals` parameter is renamed from `agents` to `extra` and carries agent and plugin targets on the greenfield path — the brief's interface says so — cost if wrong: none.
- Ruling: the foreign-marketplace refusal runs only when `extraKnownMarketplaces.accord` exists, and an entry with the same directory source passes, so a second sync reports `unchanged` — the brief compares field by field and never overwrites — cost if wrong: a re-sync refuses its own output.
- Ruling: the orphan suffix is appended only when the orphan path is `pluginDir`; skill-directory and agent-file orphan lines are unchanged — cost if wrong: none.
- Ruling: a section whose rows the search filters out entirely is dropped only while the query is non-empty; an empty section still shows "none" with an empty box — keeps ac-1 unchanged — cost if wrong: a section heading disappears while searching.
- Ruling: the task 4 executor stalled once in a full vitest run; resumed, the full suite finished in 105s with no hang, and no test file was found to hang — likely a killed slow gen+build run — cost if wrong: an intermittent hang returns in CI.
- Ruling: task 5 added its tests and code to the files tasks 1 and 4 created, since the brief still marked them `(new)` — cost if wrong: none.
- Ruling: the fake host gained an `inflight()` helper so the concurrency test can drain pending runs — test-only — cost if wrong: none.
- Ruling: `clean` also applies to ids, so `continue <id>` carries the cleaned id — ids are CLI-validated — cost if wrong: an id with unprintable characters would be submitted altered.
- Ruling: the MENTION comment in the skill-commands test gets two sentences, not one as planned — it names the `/accord` exclusion and why — cost if wrong: none, a comment only.
- Ruling: task 7 ran build, lint, typecheck and the full suite one by one instead of `npm run check`, which runs those same four — cost if wrong: none.
- Ruling: review round 1 runs intent, quality and security reviewers in parallel — the source diff (excluding generated copies) is about 1640 lines, at the 1500 split edge, and sync deletes orphan plugin files and merges the user's settings.json — cost if wrong: one extra reviewer's tokens.
- Ruling: the task 5 Ruling "ids are CLI-validated" was wrong — a ticket id is its file stem, which arrives through git unchecked; since 14c0ace a row gets a Continue or Pick up button only when its id matches `^[A-Za-z0-9][A-Za-z0-9._-]*$` (the pattern new-ticket.ts uses), else it shows as plain text — cost if wrong: a legitimate ticket whose file name holds a space has no button.
- Ruling: review round 1's reformat fix rebuilt skills.ts and skills-sync.test.ts from the 1d635b5 baseline plus the panel edits, with no formatter — the diff against the baseline is now 37 and 129 lines — cost if wrong: none.

## Deferred
- Review round 1 (Nice): the orphan report tells the user to `rm -rf .claude/accord-panel` and remove the `accord` marketplace keys without checking for the generated marker, so it can point at a user-owned folder or a foreign marketplace (skills.ts orphans).
- Review round 1 (Nice): `MARKER` in skills/render.ts now uses one regex with an optional tail for three marker forms, looser than the exact html-only match it replaced.
- Review round 1 (Nice): `mergePanel` in scaffold/panel.ts has two stacked JSDoc blocks (the first orphaned) and a redundant `m !== undefined` check.
- Review round 1 (Nice): two tests carry `risk:` names without a matching risk — `risk:regression the committed panel and settings carry the plugin` (skills-sync.test.ts) and `risk:parsing every panel file carries one marker…` (panel.test.ts); fold into ac-5 or rename.
- Review round 1 (Nice): `clean` is exported from panel/view.js; check whether a test needs the export before removing it.

## Tasks
- task 1 done 4d590c7316ca
- task 2 done 2cbef036a8f5
- task 3 done 64f5c2bd5cce
- task 4 done f1eb1fc10612
- task 5 done c095aa2d98cc
- task 6 done 3dd054e9142b
- task 7 done 6e6607e94adc

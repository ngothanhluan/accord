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
- Ruling: the pane opens at an interactive session start and the host places it (docked in fullscreen, inline otherwise); `/accord-panel` reopens it and runs the CLI again — `session.start` carries no viewport — cost if wrong: an inline pane above the prompt in a main-screen terminal.
- Ruling: the CLI runs only while the pane is open, never for a subagent's turn, with one run in flight and at most one queued rerun — a run per turn costs an npx start each — cost if wrong: the pane lags one run behind during a burst of turns.
- Ruling: `$.process.run` gets a 120 s timeout, and a rejection, an unparsable stdout or an empty stderr shows a message as in ac-3 — a first npx fetch can be slow and the CLI output is a trust boundary — cost if wrong: a slow first open shows a message instead of the dashboard.
- Ruling: an existing `extraKnownMarketplaces.accord` with another source is refused with the by-hand message, never overwritten — overwriting would drop the owner's entry — cost if wrong: a team with its own marketplace named accord must rename it by hand.
- Ruling: `/accord continue <id>` on an id with no claim branch says so and offers Pick up — Continue switches to an existing claim branch — cost if wrong: one extra step in chat.

## Deferred

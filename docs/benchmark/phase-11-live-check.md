# Phase 11 live check (not run before release)

Date: 2026-11-28

## What this report says

The Phase 11 live check (decision D-15) was not run before the 0.23.0 release. It has two parts: a sample app where one `ui: true` ticket runs end to end in Claude Code, and a comparison of two browser tools of the CLI kind, `@playwright/cli` and `agent-browser`, which decides the default `accord init` suggests for a web project (D-13).

Both parts need the owner. The first needs the owner's own interactive Claude Code session. The second needs the owner's own legitimacy check of the two packages before anything is installed: both are new, and `agent-browser` runs a postinstall script, so accord installs neither on anyone's behalf. Nothing was installed, no sample app was built, and no ticket was run.

## The owner's pick

No pick was made. The pick is recorded as `neither-yet`: two tools were not compared and none was approved. `accord init` keeps naming both candidates for a web project that lists no browser test tool, says that nothing is installed without the owner's yes, and prints no install command of either tool. No code changed for this report.

11-ac-15: open (no tool approved, two tools not compared)

## What stays unanswered

- 11-ac-15 stays open. No default was picked from a comparison, and nothing in the 0.23.0 notes says one was.
- Assumption A2 (the name form that `skills:` loads for a plugin skill) is answered only by the probe of plan 11-01, which records `Settled form: open` and `Use: both`. The live dispatch transcripts that would settle one form were not taken.
- Assumption A4 (the screenshot flags of `agent-browser`) is unanswered, which is why init prints no command for either tool.
- 11-ac-16 (the second live check, on this repository: one MCP server or skill added to one role through `agents:`, and one real ticket run with it) is open.

## Steps to run it later

1. Check both packages on npmjs.com and in their source repositories, and decide whether to install them. Install nothing until that yes.
2. Build a small web app outside this repository, give it an `accord/` folder pinned to the released version, and set `ui:` to the owner's skills of choice.
3. Run one `ui: true` ticket in Claude Code from approach to verify. Check that the approach offers visual options, that the executor and reviewer named by `accord brief` are the UI variants, and that verify records a `Tier:` line for each `@ui` scenario.
4. Run the same screenshot task with each browser tool and compare what each takes to set up, how many calls it needs and whether the screenshot shows the state asked for.
5. Record the owner's pick here in English, add its install command from the tool's own documentation to `accord init`, and change the line above to `11-ac-15: held`.
6. For 11-ac-16, add one MCP server or skill to one role through `agents:` in this repository, run one real ticket with it, and record the run in a second report.

The two live-check plans, 11-18 and 11-19, are the written procedure; they are queued in the backlog as work for after the release.

## On this repository

The second live check (11-ac-16) is partly done: only the UI skill mapping was applied to this repository. No `agents:` addition was made on any role, and no real ticket was run with one.

What was applied (PR 410, merged after release 0.23.0):

- `accord/config.yml` now maps `ui.direction` to `ui-ux-pro-max` and `ui.build` and `ui.review` to `impeccable`, written in the plugin skill-name form (`ui-ux-pro-max:ui-ux-pro-max`, `impeccable:impeccable`), because the probe of plan 11-01 left the name form open and that is the form a session's skill list shows.
- `accord skills sync` printed no note about the skill names, and rendered two UI agent files, `.claude/agents/accord-executor-ui.md` and `.claude/agents/accord-reviewer-ui.md`, which were committed.
- One test that pinned the committed agent count (11) was raised to 13 for the two new files.

What was not run:

- One `agents:` addition (an MCP server or a skill) on one role. The choice is the owner's: a skill costs its whole text on every dispatch of that role, and a server on a read-only role may be able to write (D-03), so accord did not pick one on the owner's behalf. A server that needs authorisation, such as the documentation server on the machine that ran this step, could not be proven unattended either.
- A real ticket of this repository run with that addition, and so no transcript showing the agent calling the server's tools or loading the skill's text.
- No defect was found by this check, because nothing past the config render was exercised. Assumption A2 (which name form `skills:` loads) is therefore still answered only by the probe.

11-ac-16: open (agents: addition and real-ticket run not done; owner's choice of server/skill and an interactive session needed)

Steps to run it later:

1. Choose one MCP server or one skill and one role (for example the executor), and write it under `agents:` in `accord/config.yml`.
2. Run `accord lint`, then `accord skills sync`, and read the printed notes: a skill name that cannot be found is reported there.
3. Merge that config change, then in an interactive Claude Code session run `/accord` on a real lane M ticket of this repository.
4. In the executor's transcript, check for a call to the server's tools or for the skill's text in the dispatch. A server on a read-only role must be checked for write access.
5. Record the addition, the role, the ticket id, the evidence from the transcript and the owner's notes (quoted in English, marked `(translated from Vietnamese)`) in this section, and change the line above to `11-ac-16: held`.
6. Run the first real UI ticket as the live proof that `impeccable:impeccable` and `ui-ux-pro-max:ui-ux-pro-max` load in a dispatch, which also answers A2.

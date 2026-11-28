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

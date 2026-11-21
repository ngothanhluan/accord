---
name: accord-config
description: Use when the owner wants to see or change accord's settings for this repository. Walks the settings area by area in a dialog, shows each value with what it controls and any proposal accord's detection makes, and changes a value only through accord config set after a yes.
license: MIT
argument-hint: "[area]"
kind: skill
loads: [shared/ask.md, shared/walk.md]
---

`/accord-config` shows accord's settings for this repository area by area and changes a value only when the owner says yes. It scans nothing and calls no
agent, so it is fast; to have accord look at the repository again, run `/accord-onboard`. The settings live in `accord/config.yml`, and this skill commits nothing.
Read `./ask.md` before the first question.

1. Run `accord worktree check`. On exit 2 with a message that starts `this session works`, show it, stop, and say the team's settings are changed from the main
   checkout, not from a ticket branch. On any other exit 2, show the message and stop.
2. Run `accord config areas`, or `accord config areas <area>` when the owner typed an area id after `/accord-config`. On exit 2, show the message (it names the
   areas) and stop. Each `area:` line opens an area. Under it each key's line holds its value and what it controls, and a `proposal:` line is accord's
   recommendation for that key with its evidence.
3. Go through the areas one at a time, in the order printed. An area whose line ends in (not walked: accord writes these) is shown and skipped: show its keys, say accord
   writes them, and go on. For any other area, show each key's value and what it controls in plain words, with the recommendation and its evidence where a
   `proposal:` line follows the key. Then ask one question per area, as `./ask.md` says: whether to change anything in this area, with what each answer does.
   On a no, go to the next area. On a yes, ask which key, follow `./walk.md` for that key, and ask again for the same area until the answer is no.
4. After the last area, finish as `./walk.md` says. The owner commits the file in the team's usual way.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public interface stops the run and asks the owner. Read `./ask.md` before any question to the owner.
- Write a value only through `accord config set`, after the owner's explicit yes, as `./walk.md` says; never edit `accord/config.yml` by hand.

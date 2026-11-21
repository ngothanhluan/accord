---
name: accord-onboard
description: Use after accord init printed its proposals, or when the owner wants accord to look at the repository again and propose settings. Scans the repository area by area for evidence, merges what it finds with accord init's proposals, walks only the settings accord has a proposal for, one at a time, and writes only what the owner confirms through accord config set.
license: MIT
argument-hint: "[no arguments]"
kind: skill
loads: [onboard/scan.md, shared/ask.md, shared/walk.md]
---

`/accord-onboard` follows an `accord init` run that printed its `proposals:` line (`proposal:` lines, or `proposals: 0`), or the owner's request to have accord propose settings for this
repository. `accord init` only proposes: it writes nothing to `accord/config.yml`. This skill also has you scan the repository, area by area, for the settings `accord init` found nothing for; accord's CLI calls no model, so the scan is yours. It walks only the settings accord has a proposal for, one at a time, and writes a value only after the user's yes. An agent that ran `accord init` itself follows this file right after, and never answers a question for the user. Read `./ask.md` before the first question.

1. Run `accord worktree check`. On exit 2 with a message that starts `this session works`, show it, stop, and say the team's settings are changed from the main
   checkout, not from a ticket branch. On any other exit 2, show the message and stop.
2. **Scan.** Run `accord config areas --json`: it prints every area, each key with what it controls and its value, and `accord init`'s proposals. Scan the areas as `./scan.md` says, and
   write the scan's proposals to a file outside the working tree.
3. **Merge.** Run `accord config areas --proposals "<file>"`. It prints each setting with `accord init`'s `proposal:` lines and the scan's merged in: on the same key, an ancestor or a
   descendant, `accord init`'s proposal wins, since it is deterministic. Each line reads `proposal: <key> = <JSON value>  (evidence: <text>)`. Each scan proposal it refuses prints as a
   `dropped:` line with its reason: show those lines to the owner as printed, and never walk one. On exit 2, show its message, correct the file once and run it again; when it exits 2
   again, show the owner the message, run `accord config areas` and walk only `accord init`'s proposals. When no `proposal:` line is printed, say accord has nothing to propose for
   this repository and go to step 6.
4. Go through the proposals one proposal at a time, in the order printed. Never ask about two at once, and never skip one without asking. Say whether it came from `accord init` or
   the scan, and walk each one as `./walk.md` says, with the proposal as the recommendation: a key that declares a script is walked the same way, and `./walk.md` says that nothing
   runs until the person runs `accord trust`. A key with no proposal is not walked here: a later change of any value, or a key accord proposed nothing for, is `/accord-config`.
5. When the last proposal is answered, finish as `./walk.md` says. This skill commits nothing.
6. Ask one question that stands alone, as `./ask.md` says: whether to run `accord audit` now. Say what it does: it reads
   the repository's files and reports what a machine can see about its conventions and its accord setup, each gap with
   its fix, and it changes nothing. On no, run nothing, and say that `/accord-audit` runs it any time. On yes, run
   `accord audit` and show each `gap:` line with its `- fix:`; when a `conventions-empty` or `conventions-thin` gap is
   listed, offer the conventions draft that `/accord-audit` makes, and run nothing else unasked.
7. Then say that the first ticket starts with `/accord <request>`.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public interface stops the run and asks the owner. Read `./ask.md` before any question to the owner.
- Write a value only through `accord config set`, after the owner's explicit yes, as `./walk.md` says; never edit `accord/config.yml` by hand.

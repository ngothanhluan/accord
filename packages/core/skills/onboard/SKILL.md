---
name: accord-onboard
description: Use after accord init printed its proposals, or when the owner wants accord to propose settings for this repository. Walks only the settings accord has a proposal for, one at a time, and writes only what the owner confirms through accord config set.
license: MIT
argument-hint: "[no arguments]"
kind: skill
loads: [shared/ask.md, shared/walk.md]
---

`/accord-onboard` follows an `accord init` run that printed its `proposals:` line (`proposal:` lines, or `proposals: 0`), or the owner's request to have accord propose settings for this
repository. `accord init` only proposes: it writes nothing to `accord/config.yml`. This skill walks only the settings accord has a proposal for, one at a time, and writes a value only after the user's yes. An agent that ran `accord init` itself follows this file right after, and never answers a question for the user. Read `./ask.md` before the first question.

1. Run `accord worktree check`. On exit 2 with a message that starts `this session works`, show it, stop, and say the team's settings are changed from the main
   checkout, not from a ticket branch. On any other exit 2, show the message and stop.
2. Take the `proposal:` lines of the `accord init` output just printed, or run `accord config areas`, which prints the same detector's `proposal:` lines under the key each one
   is for. Each line reads `proposal: <key> = <JSON value>  (evidence: <text>)`. When there is none (`proposals: 0`), say accord has nothing to propose for this repository and go
   to step 5.
3. Go through the proposals one proposal at a time, in the order printed. Never ask about two at once, and never skip one without asking. Walk each one as `./walk.md` says, with
   the proposal as the recommendation: a key that declares a script is walked the same way, and `./walk.md` says that nothing runs until the person runs `accord trust`. A
   key with no proposal is not walked here: a later change of any value, or a key accord proposed nothing for, is `/accord-config`.
4. When the last proposal is answered, finish as `./walk.md` says. This skill commits nothing. Then say that the first ticket starts with `/accord <request>`.
5. Ask one question that stands alone, as `./ask.md` says: whether to run `accord audit` now. Say what it does: it reads
   the repository's files and reports what a machine can see about its conventions and its accord setup, each gap with
   its fix, and it changes nothing. On no, run nothing, and say that `/accord-audit` runs it any time. On yes, run
   `accord audit` and show each `gap:` line with its `- fix:`; when a `conventions-empty` or `conventions-thin` gap is
   listed, offer the conventions draft that `/accord-audit` makes, and run nothing else unasked.

## Rules

- Anything touching intent, a veto, an acceptance criterion, or a public interface stops the run and asks the owner. Read `./ask.md` before any question to the owner.
- Write a value only through `accord config set`, after the owner's explicit yes, as `./walk.md` says; never edit `accord/config.yml` by hand.

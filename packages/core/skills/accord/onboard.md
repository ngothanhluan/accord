---
kind: reference
---

# Onboarding a repository: `/accord onboard`

Use this after `accord init` printed `proposal:` lines, or when the user types `/accord onboard`. `accord init` only
proposes: it writes nothing to `accord/config.yml`. This file writes only through `accord config set`, and only
after the user's yes. An agent that ran `accord init` itself follows this file right after, and never answers a
question for the user. When the session check of `./worktree.md` says this session works a ticket, stop and say the
team's settings are changed from the main checkout, not from a ticket branch. Read `./ask.md` before the first question.

1. Take the `proposal:` lines of the `accord init` output just printed, or run `accord init` again (it changes
   nothing it already wrote). Each line reads `proposal: <key> = <JSON value>  (evidence: <text>)`. When there is
   none, say accord has nothing to propose for this repository and go to step 5.
2. Go through the proposals one proposal at a time, in the order printed. Never ask about two at once, and never
   skip one without asking.
3. For a proposal, say in plain words what the key controls, show the value and its evidence, and run
   `accord config get <key>` to say what accord uses now (`unset` means accord's own default: say what that does).
   Ask one question that stands alone, with what happens on yes and what happens on no:
   - **Take the proposed value.** The file changes; say what changes for the team.
   - **Keep accord's default.** Nothing is written, and the proposal is not asked again in this run.
   - **Give another value.** The user types it.

   What the keys control:

   | Key | What it controls | What a change keeps working |
   |---|---|---|
   | `git.merge` | how the team merges pull requests, which sets how a ticket branch takes the default branch in | everything, nothing is rewritten |
   | `commits.subjects` | the wording of every commit accord writes | tickets in flight: the old wording is kept as `commits.legacy_subjects` |
   | `branch` | the name shape of a new ticket branch | branches that already exist |
   | `ids` | how new ticket ids are made, or taken from the tracker | ids in use: they are kept as `legacy_ids` |
   | `tracker` | the tracker `accord status` reads, for display only | nothing else reads it |

4. Run `accord config set <key> '<value>'` only after the user's yes, or with a value the user gives. Pass the value
   exactly as the proposal printed it, in single quotes so the shell keeps it as one argument, a string's double
   quotes included (the printed value "squash" is passed as '"squash"'). Show its `changed:` line and every line
   after it verbatim, and say in one sentence what each added line keeps working. When it exits 2, show its reason and
   ask again or skip. On a no, write nothing; never edit `accord/config.yml` by hand, never set a value the user did
   not confirm, and never take silence or "whatever" for a yes.
5. When the last proposal is answered, run `git diff -- accord/config.yml` and show it. Say that this skill does not
   commit: the user commits the file in the team's usual way. Then say that the first ticket starts with
   `/accord <request>`.

## Changing a value later

A request to change ids, commit subjects, sync, strictness, template sections or the tracker, at any time, follows the
same steps with the key the request names (`ids`, `commits.subjects`, `git.merge` or `git.sync`, `strictness`,
`template.sections`, `tracker`, or `people.<email>`): run `accord config get <key>`, ask as in step 3, set through
`accord config set <key> '<value>'` after the yes, and finish with step 5. `accord config unset <key>` takes a key back to
accord's default, asked the same way, and `accord config check` lists every problem in the file. The command, not this
file, applies what a change keeps working (`legacy_ids`, `commits.legacy_subjects`) and refuses a value the schema or the
floor does not allow.

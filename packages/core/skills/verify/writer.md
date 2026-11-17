---
kind: reference
---

# Who writes verification.md

Only a fresh `accord-verifier` subagent writes `accord/tickets/<id>/verification.md`,
dispatched as step 3 says. Resume mode (`./resume.md`) is a fresh dispatch too:
the verifier is dispatched again with the words `resume mode`, and it writes.
The main session never writes or edits the file. It only commits it, and it
removes it when `./resume.md` says to start the verifier over.

## Claude Code

In Claude Code a PreToolUse hook, which `accord init` and `accord skills sync`
install in `.claude/settings.json`, refuses a Write, Edit or MultiEdit of the
file from anything but an `accord-verifier` subagent. When it refuses, dispatch
the verifier as step 3 says and never write the file another way. When the
refusal says Claude Code does not name subagents to hooks, update Claude Code.

## Cursor, Codex and Copilot

In Cursor, Codex and Copilot the rule is not enforced in this tool: no hook
there can tell which agent writes a file, and those tools install no accord
agents yet. Follow it anyway, by dispatching the verifier as step 3 says.

## Known gaps

- A shell command that writes the file is not stopped.
- A verifier continued with `SendMessage` is not told apart from a fresh one.

Neither is a way to verify.

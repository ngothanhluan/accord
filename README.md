# accord

A team contract for AI-assisted software delivery.

Accord defines a small, conventional folder inside your repository where a business analyst, designer, developer, and QA write down what a feature is for, what it must do, how it must look, and how you will know it is done, before an AI agent writes a line of code. A CLI checks that contract deterministically, so an agent cannot skip it.

**Status: design phase.** Nothing is published yet. See [docs/design.md](docs/design.md) for the current design and the reasoning behind it.

## The problem

AI coding agents produce features that pass their own tests and still miss what the user meant. The largest measured cause is not a missing spec but an agent ignoring instructions it already had. The second is a spec that never captured intent, and QA testing without acceptance criteria. Accord attacks both: intent and acceptance criteria are captured up front by the people who hold them, and a Done gate verifies the result against those criteria independently of the agent that built it.

## What it is

- A folder convention: `accord/` at the repo root, with `product/`, `features/`, `tickets/`, `assets/`.
- Plain-text formats a human and a model can both read and a linter can check: EARS for requirements, Gherkin for acceptance criteria, YAML frontmatter with a JSON schema.
- Two gates: **Ready** before work starts, **Done** before QA signs off.
- Role workflows shipped as skill files for Claude Code, Cursor, and Copilot.
- A CLI: `init`, `new`, `lint`, `gate`, `status`.
- Trackers, design tools, and a future multi-repo hub are adapters, never requirements. The default tracker is `none`.

## What it is not

- Not another spec-generation CLI. It sits at the team layer and works alongside Spec Kit, OpenSpec, or your own harness.
- Not a ticket system. Your tracker stays your tracker.
- Not a server. A self-hosted hub with a web UI and MCP write access is a separate, later project.

## License

MIT

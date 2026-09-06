# accord

A team contract for AI-assisted software delivery.

Accord defines a small, conventional folder inside your repository where a business analyst, designer, and developer write down what a feature is for, what it must do, how it must look, and how you will know it is done, before an AI agent writes a line of code; QA verifies against the same acceptance criteria. A CLI checks that contract deterministically, so an agent cannot skip it.

**Status: design phase.** Nothing is published yet. See [docs/design.md](docs/design.md) for the current design and the reasoning behind it.

## The problem

AI coding agents produce features that pass their own tests and still miss what the user meant. The largest measured cause is not a missing spec but an agent ignoring instructions it already had. The second is a spec that never captured intent, and QA testing without acceptance criteria. Accord attacks both: intent and acceptance criteria are captured up front by the people who hold them, and a Done gate verifies the result against those criteria independently of the agent that built it.

## What it is

- A folder convention: a fixed `accord/` folder at the repo root with `config.yml`, `product/` (glossary, business rules), `tickets/<id>.md` (epics, stories, and bugs are all tickets; a story names its epic with `parent:`), `tickets/<id>/verification.md` (the review record), and `assets/<id>/` (designer-owned prototypes). Tracker links are a `tracker:` map keyed by adapter, for example `tracker: { shortcut: "1234" }`.
- Plain-text formats a human and a model can both read and a linter can check: EARS for requirements, Gherkin for acceptance criteria, YAML frontmatter with a JSON schema, fixed headings per ticket: Intent, Requirements, Acceptance criteria, Open questions, Plan.
- Two gates: **Ready** before work starts, **Done** before the card goes to QA: a fresh agent context, not the one that wrote the code, writes `tickets/<id>/verification.md`; the developer ticks `verified:` after a self-test; Done passes only when scenario tags, evidence tags, and `verified` match.
- Role workflows (`ba`, `dev`, `designer`) shipped as skill files for Claude Code, Cursor, Copilot, and Codex; QA verifies on the dev environment and records results in the tracker.
- A CLI: `init`, `new`, `lint`, `gate`, `status`.
- Trackers, design tools, and a future multi-repo hub are adapters, never requirements. The default tracker is `none`.

## What it is not

- Not another spec-generation CLI. It sits at the team layer and works alongside Spec Kit, OpenSpec, or your own harness.
- Not a ticket system. Your tracker stays your tracker.
- Not a database. Git is the only source of truth; a stateless remote MCP server lets non-technical members work the same tickets from their chat app over the GitHub API.

## License

MIT

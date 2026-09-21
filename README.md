# accord

A contract for AI-assisted software delivery.

Accord defines a small, conventional folder inside your repository where what a feature is for, what it must do, how it must look, and how you will know it is done are written down before an agent writes a line of code, and verified against those same acceptance criteria afterwards. A CLI checks that contract deterministically, so an agent cannot skip it.

BA, designer, developer, reviewer are four stages a ticket passes through, not four job titles. One person passes through all four in turn; four people on a team divide them. No gate reads who anyone is, so the same rules hold either way.

**Released:** `@accord-dev/accord@0.1.0`, on npm. See [docs/design.md](docs/design.md) for the design and the reasoning behind it.

## Try it

Nothing to install. Node 22.12 or newer, and:

```sh
npx --yes @accord-dev/accord@0.1.0 --version
```

That prints the version back. `init` in place of `--version` writes the `accord/` folder, the role skill files for the runtimes you name, and a CI workflow pinned to the same release, into whatever repository you run it in.

## The problem

AI coding agents produce features that pass their own tests and still miss what the user meant. The largest measured cause is not a missing spec but an agent ignoring instructions it already had. The second is a spec that never captured intent, and verification done without acceptance criteria to verify against. Accord attacks both: intent and acceptance criteria are captured up front by whoever holds them, and a Done gate verifies the result against those criteria independently of the agent that built it.

## What it is

- A folder convention: a fixed `accord/` folder at the repo root with `config.yml`, `product/` (glossary, business rules), `tickets/<id>.md` (epics, stories, and bugs are all tickets; a story names its epic with `parent:`), `tickets/<id>/verification.md` (the review record), and `assets/<id>/` (designer-owned prototypes). Tracker links are a `tracker:` map keyed by adapter, for example `tracker: { github-issues: "1234" }`.
- Plain-text formats a human and a model can both read and a linter can check: EARS for requirements, Gherkin for acceptance criteria, YAML frontmatter with a JSON schema, fixed headings per ticket: Intent, Requirements, Acceptance criteria, Open questions, Plan.
- Two gates: **Ready** before work starts, **Done** before the work is called finished: a fresh agent context, not the one that wrote the code, writes `tickets/<id>/verification.md`; the developer ticks `verified:` after a self-test; Done passes only when scenario tags, evidence tags, and `verified` match.
- Role workflows (`ba`, `dev`, `designer`) shipped as skill files, one definition each, rendered for every runtime you list.
- A CLI: `init`, `new`, `lint`, `gate`, `status`.
- Trackers, design tools, and a future multi-repo hub are adapters, never requirements. The default tracker is `none`.

## What it is not

- Not another spec-generation CLI. It sits beside whatever agent you already work through, and does not replace it.
- Not a ticket system. Your tracker stays your tracker.
- Not a database. Git is the only source of truth: the contract is files in your repository, versioned with the code it describes.

## License

MIT

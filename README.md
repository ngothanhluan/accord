# accord

A contract for AI-assisted software delivery.

Accord adds a small, fixed folder to your repository. Before an agent writes code, that folder records what a feature is for, what it must do, how it must look, and how you will know it is done. Afterwards the work is verified against those same acceptance criteria. A CLI checks the contract deterministically, so an agent cannot skip it.

BA, designer, developer and reviewer are four stages a ticket passes through, not four job titles. One person can pass through all four, or four people on a team can divide them. No gate reads who anyone is, so the same rules hold either way.

Released: `@accord-dev/accord@0.8.1` on npm. See [docs/design.md](docs/design.md) for the design and the reasoning behind it.

## The problem

AI coding agents produce features that pass their own tests and still miss what the user meant. The largest measured cause is an agent ignoring instructions it already had, not a missing spec. The second is a spec that never captured intent, and verification done without acceptance criteria to check against. Accord addresses both. Whoever holds the intent captures it and the acceptance criteria up front, and a Done gate checks the result against those criteria, independently of the agent that built it.

## What it is

- A folder convention. A fixed `accord/` folder at the repository root holds `config.yml`, `product/` (glossary, business rules, conventions), `tickets/<id>.md` (epics, stories and bugs are all tickets; a story names its epic with `parent:`), `tickets/<id>/` (the ticket's records, such as `tickets/<id>/verification.md`), and `assets/<id>/` (designer-owned prototypes). Tracker links are a `tracker:` map keyed by adapter, for example `tracker: { github-issues: "1234" }`.
- Plain-text formats that a person and a model can both read and a linter can check: EARS for requirements, Gherkin for acceptance criteria, and YAML frontmatter with a JSON schema.
- Gates. Ready passes before work starts. Done passes only when a fresh agent context, not the one that wrote the code, has verified the work against the acceptance criteria and the test evidence matches.
- A workflow shipped as skill files, one definition each, rendered for every coding agent you list: Claude Code, Codex, Cursor and Copilot.
- Lanes sized to the work, each ticket worked in its own git worktree. See [Usage](#usage).
- Tests as evidence, never as a claim. `accord task-done` and `accord gate done` read only the JUnit report that `tests.report` names in `config.yml`. The CLI never runs a test command itself.
- Trackers, design tools and a future multi-repo hub are adapters, never requirements. The default tracker is `none`. `tracker.adapter` also takes `github-issues` (`GITHUB_TOKEN`, or the `gh` CLI), `jira` (`JIRA_EMAIL` and `JIRA_API_TOKEN` for Cloud, or `JIRA_PAT` for Server and Data Center, with an https `url`), `linear` (`LINEAR_API_KEY`) and `script` (a `command` of your own that prints JSON, run only after you allow it with `accord trust`). Tokens come from your environment and are never written to a file. Tracker data is display only: `accord status` shows title, state and labels, a failure is one warning, and it never changes a gate, a lint result or an exit code. See [docs/releases.md](docs/releases.md) for the script contract.

## What it is not

- Not another spec-generation CLI. It sits beside whatever agent you already work through, and does not replace it.
- Not a ticket system. Your tracker stays your tracker.
- Not a database. Git is the only source of truth: the contract is files in your repository, versioned with the code it describes.

## Usage

### 1. Requirements

Node 22.12 or newer. Run accord through npx with an exact version, so nothing needs installing:

```sh
npx --yes @accord-dev/accord@0.8.1 <command>
```

Or install it globally and run `accord <command>`:

```sh
npm i -g @accord-dev/accord@0.8.1
```

The global install must be the same version the repository pins (see [Version pin](#8-version-pin-and-upgrading)).

### 2. Initialise a repository

In the repository root:

```sh
npx --yes @accord-dev/accord@0.8.1 init
```

`init` asks nothing and takes no options. It never overwrites `accord/config.yml`, the product files or the workflow when they exist. The skill, agent and pane copies are accord's own and are rewritten to this version, and the hooks are merged into existing settings. Each path is printed as `created`, `skipped`, `appended`, `updated`, `unchanged` or `overwrote local edits`. It writes:

- `accord/config.yml`, pinned to the running version, with `runtimes: [claude, codex]` and a comment on every key.
- `accord/product/glossary.md`, `accord/product/business-rules.md` and `accord/product/conventions.md`, from templates.
- `.github/workflows/accord.yml`, a GitHub Actions workflow that runs `lint` and `gate done` on the tickets a pull request changes, with the same pinned version.
- The skills: `/accord` and the stage skills `accord-intent` (which holds the discuss stage), `accord-approach`, `accord-plan`, `accord-build`, `accord-review`, `accord-verify` and `accord-debug`, plus `accord-designer` for the `designer` role in `roles:`, and the optional `/accord-audit` (see Daily use). Claude Code reads them from `.claude/skills/`, Codex from `.agents/skills/`.
- For Claude Code only: the accord agents in `.claude/agents/`, the dashboard pane plugin in `.claude/accord-panel/`, and in `.claude/settings.json` the session hooks, one that lets only the `accord-verifier` subagent write `verification.md`, and the keys that enable the pane. Existing settings are kept.
- A short accord block appended to `AGENTS.md` and `CLAUDE.md`, or those files created.

Then edit `accord/config.yml`. Before the first ticket that carries a `@test:` scenario, remove the `# ` from the commented `tests:` and `report:` lines at its end, and set `report:` to the JUnit report your test runner writes.

### 3. Commit what init wrote

```sh
git status   # check the list holds only what init printed
git add accord .github .claude .agents AGENTS.md CLAUDE.md   # leave out any of these init did not print
git commit -m "accord init"
git push
```

Teammates get the same skills, hooks and pane by pulling. The skills run a bare `accord` command. In Claude Code, the session hook tells the agent to run it through `npx` at the pinned version when `accord` is not on PATH. In Codex, Cursor and Copilot there is no such hook, so each person installs the pinned version globally (`npm i -g @accord-dev/accord@0.8.1`).

### 4. Make the accord check a merge gate

accord changes no GitHub setting, so nothing yet stops a pull request from merging when the accord check fails. `accord init` prints these steps; a repository admin does them once on GitHub:

1. Open Settings > Rules > Rulesets and add a branch ruleset that targets the default branch, or open Settings > Branches and add a branch protection rule for it.
2. Turn on "Require status checks to pass" and add the check "lint and gate the tickets this pull request touches"; it is listed once the accord workflow has run on a pull request.
3. Turn on "Require branches to be up to date before merging", so the suite CI runs on a pull request is the suite of what the merge will hold.

`accord-verify` reads these rules with `gh` and says in its report when the check is not required or branches need not be up to date.

### 5. Daily use in your coding agent

Work starts from `/accord` or one of its own commands inside the agent session:

| Command | What it does |
|---|---|
| `/accord` | The dashboard: your tickets, the team's, and what is ready to pick up, with the actions that apply. |
| `/accord-new <request>` | New work. Accord proposes a lane with its reason; you may override it. |
| `/accord-continue <id>` | Resume a ticket at the stage and step it reached. |
| `/accord-pickup <id>` | Claim an unclaimed ticket and start it. |
| `/accord-queue <idea>` | Note an idea as a draft ticket for later, from any session, without starting it or leaving the ticket you are on. |
| `/accord-audit` | Optional. Report what a machine can see about your conventions (linter and its rules, formatter, type checking, tests, languages, folders, PR template, commit rule), each gap with its fix, and draft conventions from the code, line by line, only on your yes. Nothing runs it for you. |
| `/accord-upgrade` | Move the repository to a newer accord release (see [Version pin](#8-version-pin-and-upgrading)). |

Lanes:

- S, a small fix (a bug, a copy change, one flag). The session writes one line for what it understood and one for when it is done, makes the change, runs the affected tests, and runs review rounds with a fresh reviewer until no Must finding is open. Then `gate done` and a pull request.
- M, a feature (one story). It passes through six stages, each a skill you can also call directly:
  1. intent (`accord-intent`): an interview that writes the intent, acceptance criteria, vetoes and decisions, then the discuss stage: it asks the owner every gray area one at a time, with a recommended default and what each choice costs, and writes each answer as a Decision.
  2. approach (`accord-approach`): the planner drafts the lightest approach that works, a critic argues against it in at most two rounds `accord round <id> --approach` counts, and the owner approves the whole ticket once, from `accord show <id> --approval --short`.
  3. plan (`accord-plan`): a task-by-task plan that lists tasks, criteria, files, interfaces and dependencies, checked by `accord gate plan`, and one plan checker checks it in at most three rounds.
  4. build (`accord-build`): one fresh executor per task, each recorded with `accord task-done`.
  5. review (`accord-review`): reviewers until no Must is open and every Should is fixed.
  6. verify (`accord-verify`): a fresh verifier checks each criterion, writes `verification.md`, and `accord gate done` runs once the owner approves.

  `accord-debug` finds a root cause before any fix when something fails for a reason nobody has shown.
- R, research: a question accord cannot answer from the code, with no change asked. `accord new ticket <id> --lane R` writes a ticket with a question, a timebox and a token budget the owner sets, quoted under `## Decisions`. The session researches within them, checks `accord budget <id>` between steps and stops to ask the owner past either, and ends in a record under `accord/research/`, written on its branch after the claim, that the ticket lists under `research:`; an older record listed there is evidence, not the result. There is no approach, plan, critic, review or verification; `accord gate done` refuses a branch that changes the shipped packages.
- L, an epic, proposed when a request names three or more parts that would each be a story of its own: `/accord-new` interviews the owner once (why, for whom, the Vetoes, the Decisions), proposes a split into two to ten stories linked by `depends_on`, and on the owner's yes runs `accord new ticket --type epic --lane L --split <file> --queue`, which queues the epic and every story in one pull request. Each story then runs lane M, picked up in its own worktree. The epic itself gets no approach or plan critique.
- P (a project) is not built yet; accord proposes an epic instead.

A request moves from S to M when it changes a public interface or schema, touches a listed sensitive area or auth, money, migration or data deletion, has more than one plausible reading that one question cannot settle, or is expected to touch more than 5 files or more than 3 code areas, tests and generated copies not counted. A scout reads the code before any lane is proposed; `accord scout check` checks the citations and logged searches of its report and prints the lane numbers, and the report is saved as `accord/tickets/<id>/scout.md`, which `accord approve` requires of a lane M ticket, judged by the same check at the commit that last changed it, unless the file holds a `skipped: <reason>` line. A lane S ticket records the files it expects to touch, and `accord gate done` fails it when it touches others. A lane only rises, except that a lane M ticket whose intent is not yet approved may move to lane S in place, keeping its id, branch and worktree.

Each ticket is worked in its own git worktree, the sibling folder `<repository folder>-<id in lower case>`, prepared by the `setup` commands listed in `config.yml`. `accord worktree open <id>` prints the folder and the `/accord-continue <id>` line to type in a session opened there. Tickets done on the remote main branch have their worktree and branches removed by `accord worktree clean`, which `/accord` runs.

In Claude Code, the pane shows the dashboard beside the chat.

### 6. Other runtimes

`runtimes:` in `accord/config.yml` decides which skill folders accord writes. `claude` writes `.claude/skills/` and also the agents, the pane and the hooks; `codex` writes `.agents/skills/`. Cursor and Copilot read both folders, so the default `runtimes: [claude, codex]` already serves all four tools, and listing `cursor` or `copilot` adds nothing.

After you change `runtimes:`, write the copies again and commit what it prints:

```sh
npx --yes @accord-dev/accord@0.8.1 skills sync
```

`skills sync` deletes no copy you may still use. When you remove a runtime, it lists the copies it no longer writes, and you delete them yourself. The one file it deletes is `.claude/agents/accord-architect.md`, an agent accord no longer has, and only while its marker shows nobody edited it: it prints `removed` for it, and lists an edited copy with the others.

### 7. CLI commands for people and CI

The skills call the CLI for you. These are the commands most useful to run by hand or in CI. Bare `accord` needs the global install at the pinned version; without it, put `npx --yes @accord-dev/accord@0.8.1` in place of `accord`. Run `accord --help` for the full list, and `accord <command> --help` for each one.

| Command | What it does |
|---|---|
| `accord lint [--json]` | Report every finding in the accord folder. |
| `accord gate ready <id>` | Report whether the ticket passes the Ready gate. |
| `accord gate plan <id>` | Report whether the ticket passes the plan gate. |
| `accord gate done <id>` | Report whether the ticket passes the Done gate. |
| `accord status [--json] [--all]` | Print one row per ticket; `--all` includes archived tickets. |
| `accord dashboard [--json]` | Print the ranked dashboard sections for you. |
| `accord show <id> [--json | --approval [--short]]` | Print one ticket: its intent and each criterion with its state. `--approval` prints what the owner approves, and `--short` the shorter view the owner's yes is asked from. |
| `accord scout check <file> [--ticket <id>]` | Check a scout report's citations and logged searches against the files git tracks, and print its lane numbers. `--ticket` leaves that ticket's own files and listed research records out of every search, as for a saved `scout.md`. |
| `accord new ticket [id] [--lane <lane>] [--title <text>] [--queue] [--note <line>] [--related <ids>] [--no-dup-check] [--split <file>]` | Write `accord/tickets/<id>.md` from the template, or from the lane's template under `--lane` (S, M, L, P, or R for research). `--title` sets the title, and a lane S or M ticket or a queued one needs it; before writing, the command prints the most similar tickets and creates nothing until `--related <ids>` or `--related none` is given; `--no-dup-check` lets a script create without that check and says so; `--queue` with up to four `--note <line>` writes a draft on a backlog branch off the default branch instead of the working tree; `--split <file>` writes an epic and its stories in one step. |
| `accord budget <id>` | Report whether a lane R ticket is within its timebox and token budget since its claim commit (exit 1 means stop and ask the owner), and print the `Spent:` line its research record states. Tokens read `not measured` when the checkout's own transcripts do not cover the time since the claim. |
| `accord commit check <file>` | Judge the first line of a commit message file against `commits.message` in `accord/config.yml` (the `conventional` preset or your own pattern): exit 0 when it passes or no rule is set, exit 1 naming the rule and a message that passes, exit 2 when the file cannot be read or the pattern is not in force. Merge commits and `Revert "..."` subjects are exempt where `accord task-done` and `accord gate done` apply the rule: it covers commits on a ticket branch, for a ticket claimed at or after the release that added it. |
| `accord commit message <id>` | Run `commits.message.command`, your script that builds the message (a Jira key, say), only after `accord trust` allowed it, with `ACCORD_TICKET`, `ACCORD_TICKET_FILE`, `ACCORD_BASE_REF` and `ACCORD_ROOT` in its environment: its first output line is the subject and the rest the body. The message goes to a file under `.git`, printed as `message-file: <path>` for `git commit -F`, and is then judged like `accord commit check`. |
| `accord audit` | Report what a machine can see about the repository's conventions and about accord's own setup: `fact: <name>: <value>` lines (`languages`, `layout`, `linter`, `linter-rules`, `formatter`, `typecheck`, `tests`, `pr-template`, `commit-rule`, `conventions`, `npm-latest`, `rendered-files`, `new-key`, `team-audit`), then `gap: <id>: <text> - fix: <fix>` lines: conventions (`conventions-empty`, `conventions-thin`, `no-linter`, `no-formatter`, `typecheck-loose`, `no-pr-template`, `commit-rule-unset`, `subject-breaks-rule`), setup (`pin-mismatch`, `pin-behind-latest`, `config-invalid`, `workflow-missing`, `workflow-pin`, `workflow-timeout`, `render-missing`, `render-edited`, `render-orphan`, `render-retired`, `hook-missing`, `hook-edited`, `hook-doubled`, `script-untrusted`, `script-trust-stale`, `security-file`) and the team's own script (`team-audit`, from `audit.command`, run only after `accord trust audit.command@<digest>`), then `gaps: <n>`. The latest release is read from npm, and an unreachable registry prints `npm-latest: no observation`, never that the version is current. It exits 0 whenever it ran, calls no model, writes nothing in the repository (it never edits the security file, a trust allow or config.yml), and no gate runs it. It runs under a version pin mismatch and reports it as a `pin-mismatch` gap. |
| `accord conventions write <file>` | Append the convention lines the owner accepted in `/accord-audit` (each `- <convention> — enforced by: <rule id or prose>`, at most 300 characters) to `accord/product/conventions.md` as the default branch has it, commit them with the `conventions` subject on a new branch `conventions/<date>` in a temporary worktree and push it, printing `branch:`, `base:` and `title:`. A line already in the file is skipped and named; a line it cannot read, or a branch origin already has, is exit 2. The checkout is not touched and nothing is merged. |
| `accord pr <id>` | Write the title and the body file of a ticket's pull request, for the step that opens it (`gh pr create --title "<title>" --body-file <path>`; accord never calls `gh` itself). It prints `title: <id>: <title>`, `body-file: <path>` (`<git dir>/accord-pr-<id>.md`, one per worktree, never tracked), then `template: <path>`, `script: pr.command` or `template: none`, then one `remaining: <heading>` line per template section the ticket could not fill, for you to write. The body is the repository's PR template with every heading kept and the ticket's id, title, Intent, acceptance criteria and test evidence filled in: `pr.template` in `accord/config.yml` names one tracked file; else a single `pull_request_template` in `.github/`, the root or `docs/` (any case, `_` or `-`); else the first `.md` file of the first `PULL_REQUEST_TEMPLATE/` folder, printed as `template: <path> (first of N; set pr.template to choose)`. `pr.command` is your own script that replaces the template: it runs only after `accord trust`, with `ACCORD_TICKET`, `ACCORD_TICKET_FILE`, `ACCORD_BASE_REF` and `ACCORD_ROOT` in its environment; its first output line is the title and the rest the body; a non-zero exit, a timeout (60 s), more than 1 MiB of output or an empty first line stops with its stderr, with no fallback to the template. With neither, the body is one `- <subject>` line per commit of the branch (an epic's Intent). A title with a double quote, a backtick, `$`, a backslash, a control character or a line break is refused, because the skills pass it inside a quoted argument. |
| `accord trust [<script>@<digest>...] [--revoke]` | With no script named, show each script `accord/config.yml` declares (`tracker.command` under the `script` adapter, `git.sync`, `build.regenerate`, which `accord worktree task merge` prints for the build stage to run only once it is allowed, `commits.message.command`, which builds a commit message, and `pr.command`, which builds a pull request's title and body): its command, a digest of what it covers, the files an allow covers and the ones that changed, and allow nothing. `accord trust git.sync@<digest>`, `accord trust tracker.command@<digest>`, `accord trust commits.message.command@<digest>` or `accord trust pr.command@<digest>`, with the digest the preview printed, allows that script in this repository, and refuses if the files changed since: a local record inside `.git`, never committed, bound to the command and the files it reaches (the script's whole folder, the package.json script `npm run` runs), so a change to either asks again. accord checks only the files it lists; anything else the command loads is not checked, so whoever allows a script must review the pull request that changed it. `--revoke` withdraws the allows. |
| `accord review-package <id> [--base <ref>] [--security [--round <n>]]` | Print the commits, stat and diff a reviewer reads, with the security triggers the diff matched. `--security` prints the security package instead: the checklist, the triggers and only the hunks they match, whole, with their context (a path match is cut at 300 lines, and the cut says how many lines it left out). `--security --round <n>` prints it for the n-th round of `review.md`, over the range `accord round` and `accord gate done` check; a `(final review)` round has none. |
| `accord skills sync` | Write every skill the config declares into `.claude/skills/` and `.agents/skills/`. |
| `accord worktree open <id>` | Find or prepare the ticket's worktree. |
| `accord worktree clean` | Remove worktrees and branches of tickets done on the default branch. |

### 8. Version pin and upgrading

`accord/config.yml` pins an exact version in its `accord:` key, and the CI workflow and Claude Code hooks use the same one. Every command that reads the repository refuses with exit 2 when the running version differs (on a version mismatch the `prompt-expansion` and `pre-tool-use` hooks only warn, so the prompt or the agent dispatch goes on), and names the command to run instead, with the pinned version in place of 0.8.1:

```sh
npx --yes @accord-dev/accord@0.8.1 <command>
```

There is no flag or environment variable that skips the check. Only `--version`, `--help`, `upgrade` and `audit` run regardless: `upgrade` because it runs as the newer version, and `audit` because it only reports (it reports the mismatch as a `pin-mismatch` gap and writes nothing in the repository).

`/accord` says when a newer release is out. `/accord-upgrade` runs `upgrade` as the newer version, which pushes a branch `upgrade/<version>` from the remote default branch with one commit that moves the pin and regenerates the skill files. Your checkout is not touched; merge the pull request to upgrade. A repository still pinned to 0.1.0 runs `npx --yes @accord-dev/accord@0.8.1 upgrade` once by hand.

Exit codes:

| Code | Meaning |
|---|---|
| 0 | Gate passed, or lint clean (warnings allowed). |
| 1 | Gate failed, or lint found errors. The reasons are printed. |
| 2 | Usage or environment error: bad arguments, no accord folder, unreadable config, version mismatch. |

### 9. Running main from a clone

To work on accord itself:

```sh
npm install
npm run build
npm rebuild @accord-dev/accord
```

The last step links the `accord` command that the skills call. After pulling a version bump, run `npm run build` again, or the workspace CLI reports the old version and every command refuses on the pin.

## License

MIT. See [LICENSE](LICENSE).

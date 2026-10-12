# Phase 2: Skills and agents v1 — Implementation Plan

> **For agentic workers:** implement this plan task by task: one fresh implementer per task, an independent review of each task before the next starts, and a whole-branch review at the end. Steps use checkbox (`- [ ]`) syntax for tracking. Task 16 is not an implementer task: the main session runs it with the owner.

**Goal:** Give accord the workflow layer a person actually runs: `/accord` and seven stage skills, nine agents with routed model and effort, a ruleset and anchor injected by hooks, and the phase 2 contract additions (`status: dropped`, the plan `baseline:`, routing and test-command config) — then run one real lane M ticket of accord through it.

**Architecture:** Skills and agents are data in `packages/core` (Markdown sources compiled into generated modules), rendered by pure functions and written by the one CLI path that already writes skill copies (`accord skills sync`, shared with `init`). Hooks call a new `accord hook <event>` command, so no hook needs shell syntax and the logic stays testable in-process. Contract additions follow the phase 1 pattern: schema key, pure core rule, thin CLI.

**Tech Stack:** TypeScript 5.9.3, Node ≥ 22.12, commander 15, yaml 2.9, ajv 8, vitest 5, npm workspaces (`packages/core`, `packages/cli`).

**Spec:** `docs/specs/2026-10-12-workflow-layer-design.md` — sections 2–12, 14–17. Read sections 4, 6, 7, 8, 10, 11, 12, 14 before any skill or agent task; the skill text must say what those sections say.

## Global Constraints

- Node `>=22.12.0`; TypeScript `5.9.3`; ESM only. No new runtime or dev dependency.
- Core (`packages/core/src/**`) imports no Node built-in (eslint `no-restricted-imports`, CORE-01). Filesystem and `git` live in `packages/cli/src/**` only.
- The CLI spawns only `git` (or `gh`) by string literal, with a literal argument array and no `shell:` option (`packages/cli/test/spawn-surface.test.ts`). It never runs a test command and never calls a model.
- Exit codes: 0 pass, 1 lint or gate failure, 2 usage or environment error (`UsageError`).
- Under `--json`, stdout carries the core object verbatim and every notice goes to stderr (D-98).
- Paths in findings and printed output use forward slashes; no `\` is ever printed (D-51).
- Optional fields are omitted, never set to `undefined` (D-54). Caller-supplied ids are looked up with `Object.hasOwn`.
- A gate or lint check returns drafts without `level` or `rule`; the table row stamps both (D-57).
- A ticket without `lane:` produces byte-identical lint, gate, and status results to 0.1.0: no golden under `packages/core/test/__golden__/` changes, except the skill and scaffold outputs Task 7 replaces on purpose.
- Nothing shipped (skills, agents, templates, schemas, source strings, generated files) names another tool, plugin, or planning system (`test/helpers/denied.ts`). Model aliases (`haiku`, `sonnet`, `opus`) and the runtime directory names are allowed.
- YAML numerics stay strings (STACK Decision 2): `stale_days: 14` loads as `"14"`; schemas declare such keys `type: string` with a `pattern`.
- Each rendered `SKILL.md` is at most 120 lines (D-129) and at most 5120 bytes (spec §2: under 5 KB). Detail that does not fit goes into a reference file the skill names (`loads:`).
- Skill bodies follow the existing invariants in `packages/core/test/skills.test.ts`: name commands, not the state a command reports (no capitalised `Ready`/`Done`, no rule ids, no `warning`); every command named is registered (`skill-commands.test.ts`); no reference to a file that exists only in this repository.
- Commits are authored solely by the repository owner: no `Co-Authored-By` line, no trailer. Conventional subject, lower case, as in `git log`.
- Each config key is added in the phase that first reads it. This phase adds `models`, `escalation`, `tests.affected`, `tests.full`, and `stale_days`; `review.max_pr_lines` and `ui.skill` are phase 4.

## Review Focus

1. **The owner's `.claude/settings.json` survives.** Writing hooks must keep every key and every hook entry accord did not write, be a no-op on a second run, and refuse (exit 2, nothing written) when the file is not a JSON object (Task 5 tests "keeps foreign hooks", "second run is unchanged", "refuses invalid JSON").
2. **Hook commands run under bash and PowerShell.** A command carries no quoting, pipe, redirect, `&&`, `$`, or environment variable; only `npx --yes <pkg>@<version> hook <event>` (Task 5 test "commands carry no shell syntax").
3. **A repository still on `roles: [ba, dev]` keeps working.** Its config stays valid, `skills sync` installs the stage set, and the old `accord-ba` and `accord-dev` directories are reported as orphans rather than deleted or silently left (Task 7 tests).
4. **Bad routing is refused, not ignored.** An unknown `models` key, an unknown effort, or a malformed model id is a schema finding; an absent entry falls back to the spec §12 default (Task 1 and Task 6 tests).
5. **Legacy and pre-baseline plans.** A 0.1.0 ticket is untouched by `dropped`, `baseline:`, and the new hooks; a lane plan without `baseline:` fails `gate plan` with a reason that says what to write (Task 2 and Task 3 tests).
6. **A changed plan is refused, and `plan_hash` is written only on a pass.** `gate plan` writes `plan_hash:` into `plan.md` only on a pass and only on a difference, as `ac_hash` is written; `task-done` refuses a plan whose body no longer matches it; `gate.task-file-unknown` and the undeclared-files list read git only through literal argument arrays (Task 9b tests).

## Spec decisions taken in this plan

These refine the spec. Record them in the spec in the same commit as this plan.

- **Stage skills replace `ba` and `dev`; `roles:` stays.** The schema keeps `roles` unchanged so no config breaks. `skills sync` always installs `/accord` and the seven stage skills; `designer` still installs only when listed (UI is phase 4). The orphan scan compares against the directories the render produces, so a leftover `accord-ba` or `accord-dev` is reported with the existing removal hint.
- **Installed names.** The source directory `skills/accord/` installs as `accord` (invoked `/accord`); every other source directory `X` installs as `accord-X`.
- **Agents install for the `claude` runtime only**, at `.claude/agents/accord-<role>.md`, with the same marker-and-hash drift rule as skills. The final reviewer is a second render of the reviewer definition, `accord-final-reviewer`, routed by `models["reviewer.final"]`. Fix rounds 4 and 5 pass a one-tier-higher `model` on the dispatch itself; the tier order is `haiku`, `sonnet`, `opus`; an executor already on `opus` stays on `opus`.
- **Hooks are three CLI events.** `accord hook session-start` (ruleset plus a one-line summary), `accord hook session-resume` (ruleset plus `accord anchor` output, falling back to the summary off a ticket branch), and `accord hook subagent-start` (the ruleset as `additionalContext` JSON). `skills sync` and `init` write them into `.claude/settings.json` for the `claude` runtime as `npx --yes <pkg>@<version> hook <event>`, with matchers `startup`, `resume|clear|compact`, and `accord-.*`. No PreCompact hook (spec §17).
- **The ruleset is a shipped template** (`templates/ruleset.md`); the hook prints it with the pinned invocation line filled in from the CLI's own package name and version, nothing from the repository.
- **`baseline:` ancestry is a host fact.** The CLI runs `git merge-base --is-ancestor <sha> HEAD` for each plan baseline and passes the answers in; core skips the ancestry rule only when the host supplied no facts at all (pure tests), mirroring `git?`.
- **Stale is the dogfood ticket.** `stale_days` lands in the schema in Task 1; the stale signal itself is built in Task 16 through the workflow this plan delivers, so the dogfood exercises a real core-plus-CLI change.
- **This repository's own gate job builds first.** `.github/workflows/accord.yml` here runs `npm ci` and `npm run build` before `npx`, because inside this workspace `npx` resolves the local package (PR #1 and PR #2 both failed on `accord: not found`). The workflow `init` generates for other repositories is unchanged.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `.planning/` | removed; the last commit holding it is named in the commit message | 0 |
| `.github/workflows/accord.yml` (this repo only) | build before gating | 0 |
| `packages/core/schemas/config.schema.json` | + `models`, `escalation`, `tests.affected`, `tests.full`, `stale_days` | 1 |
| `packages/core/schemas/ticket.schema.json` | + `status: dropped` | 2 |
| `packages/core/src/model/snapshot.ts` | config and frontmatter types; `Plan.baseline`; `SnapshotInput.ancestors` | 1, 2, 3 |
| `packages/core/src/lint/dropped.ts`, `lint/rules.ts` | `lint.dropped-reason`, `lint.depends-dropped` | 2 |
| `packages/core/src/status/rows.ts`, `status/stage.ts` | dropped rows skipped by `next`, `isDone` false | 2 |
| `packages/cli/src/commands/status.ts` | dropped hidden with archived | 2 |
| `packages/core/src/load/work.ts` | `baseline:` from plan frontmatter | 3 |
| `packages/core/src/gate/plan.ts`, `gate/rules.ts` | `gate.plan-baseline-missing`, `gate.plan-baseline-unknown` | 3 |
| `packages/cli/src/load/fs.ts` | ancestry facts | 3 |
| `packages/cli/src/commands/review-package.ts` | `--base` defaults to the plan baseline | 3 |
| `packages/core/templates/ruleset.md` | the ruleset text | 4 |
| `packages/core/src/status/session.ts` | `sessionLine`, `rulesetText` | 4 |
| `packages/cli/src/commands/hook.ts`, `run.ts` | `accord hook <event>` | 4 |
| `packages/core/src/scaffold/hooks.ts` | `hookEntries`, `mergeHooks` (pure) | 5 |
| `packages/cli/src/commands/skills.ts`, `init.ts` | write `.claude/settings.json`; agents; orphans | 5, 6, 7 |
| `packages/core/agents/*.md`, `scripts/gen-agents.mjs`, `src/generated/agents.ts` | agent definitions as data | 6, 8–14 |
| `packages/core/src/skills/agents.ts` | `renderAgent`, `agentTargets`, `AGENT_DEFAULTS` | 6 |
| `packages/core/src/skills/targets.ts`, `render.ts` | stage set, installed names | 7 |
| `packages/core/skills/accord/SKILL.md` | `/accord` entry | 7 |
| `packages/core/skills/{intent,approach,plan,build,review,verify,debug}/` | stage skills and their references | 8–14, 9 revision |
| `packages/core/src/load/work.ts`, `gate/plan.ts`, `gate/rules.ts`, `gate/task.ts`, `gate/work.ts`, `gate/index.ts` | `(new)`, `plan_hash`, `gate.task-file-unknown`, `undeclaredFiles` | 9b |
| `packages/cli/src/load/fs.ts`, `commands/gate.ts`, `commands/review-package.ts` | baseline file facts, the `plan_hash` write, `## Undeclared files` | 9b |
| `packages/core/skills/{ba,dev}/` | removed | 7 |
| `packages/core/src/scaffold/pointer.ts` | pointer block text | 7 |
| `packages/core/test/stage-skills.test.ts`, `agents.test.ts`, `hooks.test.ts`, `session.test.ts` | new tests | 4–14 |
| `README.md`, `docs/design.md` | the workflow layer in user-facing words | 15 |

---

### Task 0: Archive the previous planning folder, and build before this repo's gate job

**Files:**
- Delete: `.planning/` (whole directory)
- Modify: `.github/workflows/accord.yml`

- [ ] **Step 1: Record the baseline.** Run `npm ci`, then `npm run build && npm run lint && npm run typecheck && npx vitest run`. Expected: exit 0, 48 files, 1054 tests. Write the counts into the task report.

- [ ] **Step 2: Note the commit that still holds `.planning/`.** `git rev-parse HEAD` — this sha goes into the commit message so the folder is recoverable with `git show <sha>:.planning/...`.

- [ ] **Step 3: Remove it.** `git rm -r -q .planning` (untracked files under it, if any, stay on disk for the owner). Then `grep -rn "\.planning/" --include=*.ts --include=*.mjs --include=*.json packages test` must print nothing; a hit means shipped code reads that folder, and the task stops with `BLOCKED`.

- [ ] **Step 4: Build before gating in this repository's own workflow.** In `.github/workflows/accord.yml`, after the `actions/setup-node` step and before `lint and gate`, add:

```yaml
      # This repository is the accord workspace: npx resolves @accord-dev/accord to the local package,
      # which has no bin until it is installed and built. Other repositories run the published package.
      - run: npm ci
      - run: npm run build
```

Do not edit `packages/core/src/scaffold/workflow.ts`; the generated workflow for other repositories does not change.

- [ ] **Step 5: Verify.** `npm run build && npm run lint && npm run typecheck && npx vitest run` — same counts as Step 1.

- [ ] **Step 6: Commit.**

```bash
git add -A .planning .github/workflows/accord.yml
git commit -m "chore: archive the previous planning folder, and build before this repository's gate job

The folder is recoverable from <sha from step 2>."
```

---

### Task 1: Config keys for routing, test commands, and staleness

**Files:**
- Modify: `packages/core/schemas/config.schema.json`
- Modify: `packages/core/src/model/snapshot.ts` (`AccordConfig`)
- Test: `packages/core/test/schemas.test.ts`

**Interfaces:**
- Produces: `AccordConfig.models?: Partial<Record<RouteKey, { model: string; effort?: Effort }>>`, `AccordConfig.escalation?: { fix_round_tier_up: string }`, `AccordConfig.tests?: { report: string; affected?: string; full?: string }`, `AccordConfig.stale_days?: string`; exported types `RouteKey`, `Effort` from `packages/core/src/index.ts`.

```ts
export type RouteKey =
  | 'scout' | 'auditor' | 'architect' | 'critic' | 'planner'
  | 'executor' | 'reviewer' | 'reviewer.final' | 'verifier' | 'debugger';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';
```

- [ ] **Step 1: Write the failing tests** in `packages/core/test/schemas.test.ts`, using the file's existing `validate` helper pattern (read it first):

```ts
describe('phase 2 config keys', () => {
  const base = { accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'] };
  it('accepts routing, escalation, test commands, and stale_days', () => {
    expect(validate('config', {
      ...base,
      models: { executor: { model: 'sonnet', effort: 'medium' }, 'reviewer.final': { model: 'claude-opus-5-5', effort: 'high' }, scout: { model: 'haiku' } },
      escalation: { fix_round_tier_up: '4' },
      tests: { report: 'reports/junit.xml', affected: 'npx vitest related {files} --run', full: 'npx vitest run' },
      stale_days: '14',
    })).toEqual([]);
  });
  it('refuses an unknown route, an unknown effort, and a malformed model', () => {
    expect(validate('config', { ...base, models: { tester: { model: 'sonnet' } } }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, models: { executor: { model: 'sonnet', effort: 'huge' } } }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, models: { executor: { model: 'Sonnet 5' } } }).length).toBeGreaterThan(0);
  });
  it('refuses a non-numeric stale_days and a tier-up outside 1..5', () => {
    expect(validate('config', { ...base, stale_days: 'soon' }).length).toBeGreaterThan(0);
    expect(validate('config', { ...base, escalation: { fix_round_tier_up: '9' } }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run** `npx vitest run packages/core/test/schemas.test.ts` — expected FAIL (additionalProperties).

- [ ] **Step 3: Extend the schema.** Inside `properties`:

```json
"models": {
  "type": "object",
  "additionalProperties": false,
  "patternProperties": {
    "^(scout|auditor|architect|critic|planner|executor|reviewer|reviewer\\.final|verifier|debugger)$": {
      "type": "object",
      "additionalProperties": false,
      "required": ["model"],
      "properties": {
        "model": { "type": "string", "pattern": "^(haiku|sonnet|opus|inherit|claude-[a-z0-9-]+)$" },
        "effort": { "type": "string", "enum": ["low", "medium", "high", "xhigh", "max"] }
      }
    }
  }
},
"escalation": {
  "type": "object",
  "additionalProperties": false,
  "required": ["fix_round_tier_up"],
  "properties": { "fix_round_tier_up": { "type": "string", "pattern": "^[1-5]$" } }
},
"stale_days": { "type": "string", "pattern": "^[1-9][0-9]{0,3}$" }
```

and in `tests.properties` add `"affected": { "type": "string", "minLength": 1 }` and `"full": { "type": "string", "minLength": 1 }`. Update `AccordConfig` and export `RouteKey`, `Effort`.

- [ ] **Step 4: Run** the schema test, then the full core suite: PASS, no golden diff.

- [ ] **Step 5: Commit** — `feat(core): config keys for model routing, escalation, test commands, and stale_days`.

---

### Task 2: `status: dropped`

**Files:**
- Modify: `packages/core/schemas/ticket.schema.json` (status enum)
- Modify: `packages/core/src/model/snapshot.ts` (`TicketFrontmatter.status`), `packages/core/src/status/rows.ts` (`StatusRow.status`, `nextRows`), `packages/core/src/status/stage.ts` (`isDone`)
- Create: `packages/core/src/lint/dropped.ts`
- Modify: `packages/core/src/lint/rules.ts`
- Modify: `packages/cli/src/commands/status.ts`
- Test: `packages/core/test/lane-lint.test.ts`, `packages/core/test/lane-status.test.ts`, `packages/cli/test/status.test.ts`

**Interfaces:**
- Produces: `status: 'draft' | 'open' | 'archived' | 'dropped'`; lint rules `lint.dropped-reason` (error, both profiles), `lint.depends-dropped` (error, both profiles); exported checks `droppedReason`, `dependsDropped`.

Semantics (spec §3): a dropped ticket carries a `## Dropped` section with at least one non-blank, non-comment line. `next` never lists it; `status` hides it with archived tickets unless `--all`; `isDone` is false for it. A ticket whose own status is neither `dropped` nor `archived` and whose `depends_on` names a dropped ticket is an error at that array pointer. These rules apply to every ticket, lane or not — but no 0.1.0 ticket can be `dropped`, because the value did not exist, so no legacy golden moves.

- [ ] **Step 1: Write the failing core tests.** In `lane-lint.test.ts`:

```ts
describe('dropped (spec §3)', () => {
  const dropped = (body: string) =>
    laneTicket('T-2', { frontmatter: ['status: dropped'], body: LANE_BODY + body });
  it('requires a ## Dropped reason', () => {
    const r = lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-2.md': dropped('') }, tree: [] }));
    expect(r.findings.filter((f) => f.rule === 'lint.dropped-reason')).toHaveLength(1);
    const ok = lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-2.md': dropped('\n## Dropped\nSuperseded by T-3.\n') }, tree: [] }));
    expect(ok.findings.filter((f) => f.rule === 'lint.dropped-reason')).toEqual([]);
  });
  it('a live ticket may not depend on a dropped one', () => {
    const files = {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': laneTicket('T-1', { frontmatter: ['depends_on: ["T-2"]'] }),
      'accord/tickets/T-2.md': dropped('\n## Dropped\nSuperseded.\n'),
    };
    const f = lintSnapshot(loadSnapshot({ files, tree: [] })).findings.filter((x) => x.rule === 'lint.depends-dropped');
    expect(f).toEqual([expect.objectContaining({ file: 'accord/tickets/T-1.md', pointer: '/depends_on/0' })]);
  });
});
```

Read `test/helpers/lane.ts` first: if `laneTicket`'s `frontmatter` option appends rather than replaces a `status:` line, extend the helper so a given `status:` replaces the default, and keep every existing caller's output identical.

In `lane-status.test.ts`: a dropped, approved, readied lane ticket is absent from `nextRows`, and a ticket depending on it has it in `blockedBy`.

In `packages/cli/test/status.test.ts`: `accord status` on a repo with one open and one dropped ticket prints one row and `1 dropped or archived ticket hidden (--all shows them)`; `--all` prints both; `--json` stdout has one element and the note on stderr. A repo with only archived tickets keeps today's exact wording (`archived ticket hidden`) — assert it, so no 0.1.0 output moves.

- [ ] **Step 2: Run** the three files — expected FAIL.

- [ ] **Step 3: Implement.** `lint/dropped.ts`:

```ts
// Spec §3: a dropped ticket says why, and nothing live waits on it. Levels live in rules.ts.
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { Rule } from './rules.js';

export const droppedReason: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    if (t.frontmatter?.status !== 'dropped') return [];
    const s = t.sections.find((x) => headingKey(x.heading) === 'dropped');
    const said = s !== undefined && stripHtmlComments(s.lines).some((l) => l.text.trim() !== '');
    return said ? [] : [{ file: t.file, pointer: '/status', reason: 'a dropped ticket needs a "## Dropped" section saying why' }];
  });

export const dependsDropped: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) => {
    const own = t.frontmatter?.status;
    if (own === 'dropped' || own === 'archived') return [];
    return (t.frontmatter?.depends_on ?? []).flatMap((d, i) =>
      Object.hasOwn(snapshot.tickets, d) && snapshot.tickets[d].frontmatter?.status === 'dropped'
        ? [{ file: t.file, pointer: `/depends_on/${i}`, reason: `depends_on names "${d}", which is dropped; re-plan this ticket without it` }]
        : [],
    );
  });
```

Check `headingKey`'s normalisation in `load/sections.ts` and match it. Add both rows to `RULES` beside the `lint.depends-*` rows. In `nextRows` add `r.status !== 'dropped'`. In `isDone`, return false when the ticket's status is `dropped`. In `status.ts`, hide `archived` and `dropped`; the note says `archived ticket(s) hidden` when every hidden row is archived (today's text) and `dropped or archived ticket(s) hidden` otherwise.

- [ ] **Step 4: Run** the three files, then the full suite. PASS; no golden diff.

- [ ] **Step 5: Commit** — `feat: status dropped, with a stated reason, skipped by next and status, and refused as a dependency`.

---

### Task 3: The plan `baseline:`

**Files:**
- Modify: `packages/core/src/load/work.ts` (`parsePlan`), `packages/core/src/model/snapshot.ts` (`Plan.baseline`, `SnapshotInput.ancestors`, `RepoSnapshot.ancestors`), `packages/core/src/load/snapshot.ts` (carry `ancestors`)
- Modify: `packages/core/src/gate/plan.ts`, `packages/core/src/gate/rules.ts`
- Modify: `test/helpers/lane.ts` (`PLAN` gains a baseline)
- Modify: `packages/cli/src/load/fs.ts`, `packages/cli/src/commands/review-package.ts`, `packages/cli/src/run.ts` (`--base` optional)
- Test: `packages/core/test/work.test.ts`, `packages/core/test/lane-plan.test.ts`, `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Produces: `Plan.baseline?: string`; `SnapshotInput.ancestors?: Record<string, boolean>` (baseline sha → is an ancestor of `HEAD`), carried to `RepoSnapshot.ancestors`; plan rules `gate.plan-baseline-missing`, `gate.plan-baseline-unknown`.

Plan file shape (spec §7):

```markdown
---
baseline: 3f2a9c1
---

## Task 1: …
```

`baseline` is a sha of 7–40 hex digits (`isSha` in `packages/core/src/gate/`). Rules, in `PLAN_RULES` after `gate.plan-empty`:
- `gate.plan-baseline-missing` — the plan has no `baseline:` or it is not a sha. Reason: `plan.md has no baseline:; write the commit the plan was written against (git rev-parse HEAD) into its frontmatter`.
- `gate.plan-baseline-unknown` — only when `snapshot.ancestors` is present: the baseline is absent from it or maps to `false`. Reason: `baseline <sha> is not a commit on the history of HEAD`.

- [ ] **Step 1: Failing tests.**
  - `work.test.ts`: a plan with the frontmatter above parses `baseline: '3f2a9c1'`; CRLF+BOM parses the same; no frontmatter gives no `baseline` key; tasks still parse.
  - `lane-plan.test.ts`: a plan without baseline fails with `gate.plan-baseline-missing`; with baseline and no `ancestors` passes that rule; `ancestors: { '3f2a9c1': false }` fails with `gate.plan-baseline-unknown`; `{ '3f2a9c1': true }` passes.
  - `lane-commands.test.ts` (real git via `makeLaneRepo`, `gitRun`): with `baseline:` set to the first commit, `accord gate plan T-1` passes; with `baseline: 0000000` it fails naming the rule; `accord review-package T-1` with no `--base` prints `(<baseline>...HEAD)` in its title; with no `--base` and no baseline it exits 2 with `no --base given and plan.md records no baseline:`.

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement.**
  - `parsePlan`: split frontmatter with the existing `splitFrontmatter` from `load/frontmatter.ts`, parse with the same yaml options the loader uses, take `baseline` only when it is a string; scan the body as today so task line numbers stay file line numbers (check how `splitFrontmatter` reports its offset and pass it to `scan`).
  - Update `PLAN` in `test/helpers/lane.ts` to open with `---\nbaseline: abc1234\n---\n\n`, and fix any phase 1 test whose line numbers shift.
  - `fs.ts`: after the snapshot's first pass, collect the baselines of every lane plan that pass `isSha`, run `git merge-base --is-ancestor <sha> HEAD` for each (literal array; the sha is validated first, so it cannot read as an option), exit status 0 → true, 1 → false, any other failure → `UsageError` naming the sha. Omit `ancestors` when there is no baseline.
  - `review-package.ts`: `options.base` becomes optional; without it use `workOf(snapshot, id)?.plan?.baseline`, else `UsageError` as above. In `run.ts`, `--base <ref>` stops being required.

- [ ] **Step 4: Run** the three files, then the full suite. PASS.

- [ ] **Step 5: Commit** — `feat: plan baseline, checked against HEAD by gate plan and used as the default review base`.

---

### Task 4: The ruleset, the session line, and `accord hook`

**Files:**
- Create: `packages/core/templates/ruleset.md` (then `node packages/core/scripts/gen-templates.mjs`)
- Create: `packages/core/src/status/session.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/cli/src/commands/hook.ts`
- Modify: `packages/cli/src/run.ts`, `packages/cli/src/commands/anchor.ts` (export `activeTicket`)
- Test: `packages/core/test/session.test.ts`, `packages/cli/test/hook.test.ts`

**Interfaces:**
- Produces (core): `rulesetText(invocation: string): string`; `sessionLine(rows: StatusRow[]): string`.
- Produces (cli): `accord hook session-start | session-resume | subagent-start`; `activeTicket(root: string): string | undefined` exported from `anchor.ts` (the branch logic `anchor` already has, returning the id of `t/<id>`).

`templates/ruleset.md`, verbatim (the one placeholder is `{{invocation}}`):

```markdown
# accord rules

These hold for every reply in this repository, for the main session and for every accord agent.

1. Ask about intent, never guess it. A question that touches the intent, a veto, an acceptance criterion, or
   a public interface stops the work until the owner answers. Any other decision you take is a Ruling,
   written to the ticket's ledger as `Ruling: <what> — <why> — <cost if wrong>`.
2. When the owner corrects you, write the correction verbatim under the ticket's `## Corrections` before
   doing anything else. A correction that exists only in the conversation is lost at the next compaction.
3. Scope is impact: every caller, test, fixture, config entry, and export the change must reach. Anything
   beyond that is extra, and extra is not done.
4. Take the lightest change that fully works: does it need to exist; is it already in the repository; the
   standard library or platform; an installed dependency; then the minimum new code. Never cut validation at
   trust boundaries, data-loss handling, security, accessibility, or anything the owner asked for.
5. Evidence before claims. Say something works only after running what proves it, and show the output. Whoever
   made a change never grades it.
6. Tests: one behaviour test per acceptance criterion, named by its `@test:<id>` tag, written first, at the
   cheapest layer that observes the behaviour. Any other test names a risk with `risk:<kind>`. No test that
   restates the implementation or only asserts on mocks.
7. End every reply with one or two lines: what was skipped, what was not checked, and any risk the owner
   must know.

Run accord as `{{invocation}}` when `accord` is not on PATH.
```

`sessionLine`: count lane rows (status not `archived`/`dropped`) whose stage is `plan`, `build`, `review`, or `verify` and that `nextRows` does not list → in progress; `nextRows(rows).length` → ready. Output `accord: <n> in progress, <m> ready to pick up · type /accord` with no newline; when there is no lane row at all, `accord: no lane tickets yet · type /accord <request> to start one`.

`accord hook` behaviour (all three run through `preflight`, so the pin check applies):
- `session-start`: stdout = ruleset, a blank line, `sessionLine(statusRows(snapshot))`, newline. Exit 0.
- `session-resume`: stdout = ruleset, a blank line, then `anchorText` for `activeTicket(root)` when that is a lane ticket, else the session line. Exit 0. A git failure while reading the branch writes one line to stderr and falls back to the session line — a hook never fails a session over the anchor.
- `subagent-start`: stdout = `JSON.stringify({ hookSpecificOutput: { hookEventName: 'SubagentStart', additionalContext: <ruleset> } })` and a newline.
- The invocation filled into the ruleset is `` `npx --yes ${pkg.name}@${pkg.version}` `` from the CLI's own `package.json`.

- [ ] **Step 1: Failing tests.**
  - `session.test.ts`: `rulesetText('npx --yes @x/accord@1.2.3')` contains that string and no `{{`; it is under 2048 bytes; `deniedNames` over it is empty. `sessionLine` over: no rows; one plan-stage readied row (ready 1, in progress 0); one build row with tasks done (in progress 1); one dropped row (counted nowhere).
  - `hook.test.ts` (in-process `run` helper, lane repo): `hook session-start` output starts with `# accord rules` and ends with the session line; `hook session-resume` on branch `t/T-1` (create it with `gitRun(repo, 'checkout', '-b', 't/T-1')`) contains the ticket's `## Intent` text; on `main` it ends with the session line; `hook subagent-start` stdout parses as JSON with `hookSpecificOutput.hookEventName === 'SubagentStart'` and `additionalContext` starting `# accord rules`; an unknown event exits 2.

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement** `session.ts`, `hook.ts`, the `hook <event>` command in `run.ts` (one command with an `<event>` argument checked against the three names; unknown → `UsageError`), and export `activeTicket` from `anchor.ts` with `anchor` calling it.

- [ ] **Step 4: Run** both files, `skill-commands.test.ts`, and the full suite. PASS.

- [ ] **Step 5: Commit** — `feat: accord hook prints the ruleset with the session line, the anchor, or as subagent context`.

---

### Task 5: Hooks written into `.claude/settings.json`

**Files:**
- Create: `packages/core/src/scaffold/hooks.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/commands/skills.ts`, `packages/cli/src/commands/init.ts`
- Test: `packages/core/test/hooks.test.ts`, `packages/cli/test/skills-sync.test.ts`, `packages/cli/test/init.test.ts`

**Interfaces:**
- Produces: `hookEntries(pkg: { name: string; version: string }): HookEntries`; `mergeHooks(existing: unknown, entries: HookEntries): Record<string, unknown>` (throws `TypeError('settings is not a JSON object')` when `existing` is not a plain object, or when `existing.hooks` exists and is not one); `isAccordHookCommand(command: string): boolean`.

```ts
export type HookEntries = Record<'SessionStart' | 'SubagentStart', { matcher: string; hooks: { type: 'command'; command: string }[] }[]>;

const cmd = (pkg: { name: string; version: string }, event: string) => `npx --yes ${pkg.name}@${pkg.version} hook ${event}`;
export const hookEntries = (pkg: { name: string; version: string }): HookEntries => ({
  SessionStart: [
    { matcher: 'startup', hooks: [{ type: 'command', command: cmd(pkg, 'session-start') }] },
    { matcher: 'resume|clear|compact', hooks: [{ type: 'command', command: cmd(pkg, 'session-resume') }] },
  ],
  SubagentStart: [{ matcher: 'accord-.*', hooks: [{ type: 'command', command: cmd(pkg, 'subagent-start') }] }],
});
export const isAccordHookCommand = (c: string): boolean =>
  /^npx --yes \S+ hook (session-start|session-resume|subagent-start)$/.test(c);
```

`mergeHooks`: copy `existing`; for each event in `entries`, keep every existing entry that has at least one hook whose `command` is not an accord hook command (removing only the accord commands from mixed entries, and dropping an entry left with no hooks), then append the new entries. Every other key and every other event is untouched, and key order is preserved.

CLI, in the shared write path `skills sync` and `init` use (next to `writeSkillFiles`), only when `runtimes` includes `claude`:
1. Path `.claude/settings.json`, through the existing `assertNoLink` pre-pass.
2. Absent → write `JSON.stringify(mergeHooks({}, entries), null, 2) + '\n'`, report `created`.
3. Present → `JSON.parse`; on a parse error or a `TypeError` from `mergeHooks`, throw `UsageError('.claude/settings.json is not a JSON object; nothing was written. Add these hooks by hand:\n' + <entries JSON>)`. If the merged value deep-equals the parsed value (compare `JSON.stringify` of both), report `unchanged` and do not write; else write and report `updated`.

- [ ] **Step 1: Failing tests.**
  - `hooks.test.ts`: `mergeHooks({}, e)` equals `{ hooks: e }`; merging into `{ model: 'x', hooks: { SessionStart: [{ matcher: 'startup', hooks: [{ type: 'command', command: 'echo hi' }] }], PreToolUse: [...] } }` keeps `model`, `PreToolUse`, and the `echo hi` entry before ours; merging twice gives the same object as once; an older accord command (`npx --yes @accord-dev/accord@0.0.9 hook session-start`) is replaced, not duplicated; `mergeHooks([], e)` and `mergeHooks({ hooks: 3 }, e)` throw. **Commands carry no shell syntax:** every command in `hookEntries({ name: '@accord-dev/accord', version: '0.2.0' })` matches `/^npx --yes [@a-z0-9/._-]+@[0-9A-Za-z.-]+ hook [a-z-]+$/`.
  - `skills-sync.test.ts`: with `runtimes: [claude]` sync creates `.claude/settings.json` with three accord commands; a second run reports `unchanged` and leaves the mtime alone; an existing file with a foreign hook keeps it; invalid JSON exits 2, prints the hand-add text, and leaves the file byte-identical; with `runtimes: [codex]` no settings file is written.
  - `init.test.ts`: init's report lists `.claude/settings.json` as `created`.

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement**, reading `skills.ts` and `init.ts` first so the settings row joins the same report list and the same link guard.

- [ ] **Step 4: Run** the three files and the full suite. PASS.

- [ ] **Step 5: Commit** — `feat: skills sync and init write the accord hooks into .claude/settings.json, keeping everything else`.

---

### Task 6: Agents as data, rendered with routed model and effort

**Files:**
- Create: `packages/core/agents/scout.md` (the first definition; Tasks 8–14 add the rest)
- Create: `packages/core/scripts/gen-agents.mjs` (mirror `gen-skills.mjs`: `agents/*.md` → `src/generated/agents.ts` exporting `agents` and `AgentKey`)
- Modify: `packages/core/package.json` / build wiring so `gen-agents.mjs` runs wherever `gen-skills.mjs` runs (read how `gen-skills` is invoked and copy it)
- Create: `packages/core/src/skills/agents.ts`
- Modify: `packages/core/src/index.ts`
- Modify: `packages/cli/src/commands/skills.ts`, `packages/cli/src/commands/init.ts`
- Test: `packages/core/test/agents.test.ts`, `packages/cli/test/skills-sync.test.ts`, `packages/cli/test/init.test.ts` (init's report now lists the agent files)

**Interfaces:**
- Consumes: `RouteKey`, `Effort` (Task 1); `contentHash`, the marker functions, and `splitFrontmatter` as `render.ts` uses them.
- Produces: `AGENT_DEFAULTS: Record<RouteKey, { model: string; effort: Effort }>`; `renderAgent(key: AgentKey, route: { model: string; effort: Effort }, name?: string): string`; `agentTargets(config: AccordConfig): SkillFile[]` (empty unless `runtimes` includes `claude`); `agentDir = '.claude/agents'`.

Source format (`agents/scout.md`):

```markdown
---
name: accord-scout
description: Reads the code and returns facts with file and line, for the intent interview and the approach's impact analysis. Never proposes, never edits.
tools: Read, Grep, Glob
route: scout
---

<body>
```

`route` is an authoring key and never ships. Rendered file: `---`, then `name`, `description`, `tools` (only when the source has it), `model`, `effort`, then `---`, then the same marker line skills carry (hash over the rendered text without the marker, exactly as `renderSkill`), then the body. Route values come from `config.models?.[route]`, falling back per field to `AGENT_DEFAULTS[route]` (an entry with only `model` keeps the default effort). `AGENT_DEFAULTS`, from spec §12:

| route | model | effort |
|---|---|---|
| scout | haiku | low |
| auditor | opus | medium |
| architect | opus | high |
| critic | opus | high |
| planner | opus | medium |
| executor | sonnet | medium |
| reviewer | sonnet | high |
| reviewer.final | opus | high |
| verifier | sonnet | medium |
| debugger | opus | high |

`agentTargets` renders every agent at `.claude/agents/<name>.md`, plus `accord-final-reviewer.md` rendered from `reviewer.md` with route `reviewer.final` and name `accord-final-reviewer` once `reviewer.md` exists (Task 12). Sorted by path.

`agents/scout.md` body (at most 40 lines), stating: you answer the question you were given with facts from the code, each with `path:line`; you read, you never edit, you never propose a design; you list callers, tests, fixtures, config entries, and exports a named change would reach when asked for impact; you say "not found" rather than guessing; your answer is at most 30 lines.

CLI: `skills sync` and `init` write `agentTargets(config)` through `writeSkillFiles` (same four statuses), and the orphan scan also opens `.claude/agents/` and reports any `accord-*.md` file not in the render.

- [ ] **Step 1: Failing tests** (`agents.test.ts`): the rendered scout has frontmatter `{ name: 'accord-scout', description, tools: 'Read, Grep, Glob', model: 'haiku', effort: 'low' }` and no `route`; `models: { scout: { model: 'sonnet' } }` gives `model: sonnet, effort: low`; the marker hash recomputes; `agentTargets` with `runtimes: ['codex']` is `[]`; the generated module matches `agents/` (drift test, as in `skills.test.ts`); `deniedNames` over every render is empty; every agent body is at most 60 lines. In `skills-sync.test.ts`: sync creates `.claude/agents/accord-scout.md`; editing `config.yml` routing then syncing reports `updated`; a stray `.claude/agents/accord-old.md` is reported as an orphan and not deleted.

- [ ] **Step 2: Run** — expected FAIL.

- [ ] **Step 3: Implement.**

- [ ] **Step 4: Run** both files and the full suite. PASS.

- [ ] **Step 5: Commit** — `feat: agent definitions as data, rendered into .claude/agents with routed model and effort`.

---

### Task 7: Stage skills replace the role skills; `/accord`

**Files:**
- Modify: `packages/core/src/skills/targets.ts`, `packages/core/src/skills/render.ts` (accept `kind: skill` as well as `kind: role`)
- Create: `packages/core/skills/accord/SKILL.md`
- Delete: `packages/core/skills/ba/`, `packages/core/skills/dev/`
- Modify: `packages/core/src/scaffold/pointer.ts` (block text)
- Modify: `packages/cli/src/commands/skills.ts` (orphans by rendered names)
- Modify: `packages/core/test/skills.test.ts`, `packages/cli/test/init.test.ts`, `packages/cli/test/skills-sync.test.ts`, `packages/core/test/scaffold.test.ts`, any golden that holds the old skill paths or pointer text
- Create: `packages/core/test/stage-skills.test.ts`
- Regenerate: `node packages/core/scripts/gen-skills.mjs`

**Interfaces:**
- Produces: `STAGES: readonly string[] = ['accord', 'intent', 'approach', 'plan', 'build', 'review', 'verify', 'debug']` (source directory names); `installedName(dir: string): string` (`'accord'` → `'accord'`, otherwise `'accord-' + dir`). `skillTargets` renders every stage whose `SKILL.md` exists, then each listed role that is not `ba` or `dev`.

Invariant changes in `skills.test.ts` (keep every other invariant):
- The first command named in each body: `accord status` for `accord/SKILL.md`, `accord anchor` for every other stage, `accord gate ready` for `designer`. Widen `COMMAND` to every registered command path, longest first: `gate ready|gate done|gate plan|new ticket|skills sync|tests baseline|review-package|task-done|approve|anchor|brief|status|next|lint|hook`.
- Every rendered `SKILL.md` is at most 5120 bytes.
- `VERDICT` becomes `/\b(?:Ready|Done)\b(?! when:)/`: spec §3 requires the lane S write-back label `Done when:`, which names no gate state. Widening `COMMAND` also widens the paragraph rule beside `PROMOTED`; a stage skill keeps `## Open questions`, `assumptions:`, `status: draft`, and `TODO` out of any paragraph that names an accord command.
- The roster cases use `roles: ['ba', 'dev', 'designer']` and `['ba', 'dev']`; the skip-branch case keeps its cast.

`skills/accord/SKILL.md` — frontmatter `name: accord`, `description` (when to use: starting any work in an accord repository, seeing where work stands, or continuing), `license: MIT`, `kind: skill`, `loads: [accord/lanes.md]` if the lane text does not fit. The body must say, in this order:
1. Run `accord status --json`; with no argument, show the dashboard of spec §6 built from it (your tickets in progress with stage and tasks, the team's, those `accord next` lists) and offer Continue, Pick up, New request. Format only; never infer a state the JSON does not hold. Read the name to greet from `git config user.name`.
2. Continue: switch to branch `t/<id>`, run `accord anchor`, and load the stage skill for the stage it prints (`intent`→`accord-intent`, `plan`→`accord-plan`, `build`→`accord-build`, `review`→`accord-review`, `verify`→`accord-verify`). Never re-run a task the ledger records.
3. Pick up: create and push branch `t/<id>` (that is the claim), then continue as above.
4. New request (`/accord <request>`): propose a lane with its reason, out loud (spec §3 table and the lift signals); the owner may override. S: write back "Understood: … / Done when: …", proceed without waiting only when the request has a concrete anchor and one plausible reading, else ask exactly one question; do the change in the main session, run the affected tests, one reviewer pass in a fresh context, a short report. M: `accord new ticket <id> --lane M`, branch `t/<id>`, then `accord-intent`. L and P: not built yet — propose splitting the work into lane M tickets linked by `depends_on`, and say so.
5. Ratchet: complexity found mid-task lifts the lane; stop, say so, re-enter at the new lane's first incomplete stage; a lane never drops.
6. A ticket without `lane:` follows the 0.1.0 contract; offer to add `lane: M` and the lane headings, and do it only on a yes.
7. In lane M the main session orchestrates and never edits product code.

Pointer block, replacing the body between the markers:

```
## accord

Workflows for this repository are installed at `.claude/skills/accord*` and `.agents/skills/accord*`.
Type `/accord` to see where work stands, or `/accord <request>` to start something new.

A ticket is not started before `accord gate ready <id>` passes.
```

`stage-skills.test.ts` starts here and grows in Tasks 8–14: for each stage present, the rendered `SKILL.md` names every phrase in its row of a `REQUIRED` table. Row for `accord`: `accord status --json`, `accord next`, `t/<id>`, `accord new ticket`, `--lane M`, `Understood:`, `Done when:`, `accord anchor`.

- [ ] **Step 1: Failing tests:** the changed invariants; `skillTargets(config({ roles: ['ba', 'dev'] }))` contains `.claude/skills/accord/SKILL.md` and no `accord-ba` or `accord-dev` path; `stage-skills.test.ts` row `accord`; in `skills-sync.test.ts` a repo holding `.claude/skills/accord-ba/SKILL.md` gets it reported as an orphan; `init.test.ts` expectations for the new paths and pointer text.
- [ ] **Step 2: Run** — expected FAIL.
- [ ] **Step 3: Implement and write the skill.** Regenerate the skills module. Update goldens only where they hold skill paths or the pointer block, and list each regenerated golden in the report.
- [ ] **Step 4: Run** the full suite. PASS.
- [ ] **Step 5: Commit** — `feat: stage skills replace the role skills, with /accord as the entry point`.

---

### Tasks 8–14: shared rules for the stage skill and agent tasks

Each of these tasks writes one stage skill (and any reference files it loads) plus its agents, adds its row to `REQUIRED` in `stage-skills.test.ts` (and, from the Task 9 revision on, each agent's row to `AGENT_REQUIRED` in `agents.test.ts`), regenerates the skills and agents modules, and commits once. The implementer reads the spec sections named in the task and writes prose that says exactly what they say — no rule added, none dropped, none softened. Every body:
- opens with `accord anchor` as its first command (the stage re-anchors);
- hands every agent the ticket verbatim, never a summary (spec §4), by file path — `accord brief <id> <n>` output for an executor, the ticket file otherwise;
- states when the run stops and asks (intent, a veto, a criterion, a public interface) and that every other decision is a Ruling in `tickets/<id>/ledger.md` under `## Rulings`;
- ends by naming the next stage skill.

Agent bodies are at most 60 lines, written to the agent ("You …"), and state the agent's access from spec §12, its input, its output format, and what it never does. Each task's test step: run `npx vitest run packages/core/test/stage-skills.test.ts packages/core/test/skills.test.ts packages/core/test/agents.test.ts packages/cli/test/skill-commands.test.ts`, then the full suite.

### Task 8: `accord-intent`, with the auditor

**Files:** Create `packages/core/skills/intent/SKILL.md` (`name: accord-intent`), optionally `packages/core/skills/intent/interview.md`; create `packages/core/agents/auditor.md` (`tools: Read`, `route: auditor`). **Spec:** §4, §6 (re-anchoring), §3 (lanes).

The skill must say:
1. `accord anchor`. If the ticket file does not exist yet, `/accord` creates it first.
2. Look before asking: dispatch `accord-scout` with the questions the code can answer; never ask the owner what the code answers; a question about an existing project cites the file that prompted it.
3. Score ambiguity 0–1 on goal, scope boundary, constraints, acceptance; show the four scores after each round. Floors: no dimension above 0.4. Stop at a total (the mean) of 0.2 or less with no dimension over its floor, or when the owner says "enough" — then write `Ruling: interview stopped by the owner at <score>` into the ledger.
4. One question per message, aimed at the weakest dimension, multiple choice where possible, the recommended option first with its reason.
5. Write each section of the ticket as spec §4's table says: Intent at most five lines; two to five `@ac-n` Gherkin scenarios; Vetoes and Decisions in the owner's words (`- D-01 <decision> — "<the owner's sentence>"`); every correction verbatim in `## Corrections`, before any other action; unchecked `- [ ]` items in `## Open questions`.
6. Write back the understanding, separating what the owner said from what you assumed, and invite correction.
7. Audit once: dispatch `accord-auditor` with only the ticket file; a criterion it reads two ways goes back to the owner as a question.
8. Next: `accord-approach`.

`REQUIRED` row: `accord anchor`, `accord-scout`, `accord-auditor`, `0.2`, `## Corrections`, `## Open questions`, `D-01`, `accord-approach`.

Auditor body: you read only the ticket file you are given; for each `@ac-n` you try to write two different, reasonable readings that would lead to different code; you report per criterion either "one reading" or the two readings and the word that splits them; you never propose fixes and never read code.

- [ ] Steps: write the failing `REQUIRED` row and the agent test expectations → run (FAIL) → write the skill and agent → regenerate → run (PASS) → commit `feat: accord-intent and the auditor`.

### Task 9: `accord-approach`, with the architect and the critic

**Files:** Create `packages/core/skills/approach/SKILL.md` (`name: accord-approach`); `packages/core/agents/architect.md` (`tools: Read, Grep, Glob`, `route: architect`); `packages/core/agents/critic.md` (`tools: Read, Grep, Glob`, `route: critic`). **Spec:** §7 Approach, §2 principle 6.

The skill must say:
1. `accord anchor`.
2. Dispatch `accord-architect` with the ticket file: impact analysis (callers, interfaces, tests, config, exports) and two or three options, the first always the lightest that works; every added layer names the criterion or constraint that requires it, or is dropped.
3. Dispatch `accord-critic` in a fresh context with the ticket and the chosen option: the strongest case against it, checked against Vetoes, Decisions, and Corrections. This runs for every lane M ticket.
4. Write `## Approach`, about fifteen lines: chosen option and why, rejected options and why, affected areas, risks, test strategy (which criterion is tested at which layer).
5. Show the owner the brief and ask for an explicit yes. On yes, run `accord approve <id>`, then `accord gate ready <id>` and work from what it prints. Never run `accord approve` without the owner's yes in this conversation.
6. A later change to Intent, criteria, Vetoes, Decisions, Corrections, or Approach needs a new yes and a new `accord approve`.
7. Next: `accord-plan`.

`REQUIRED` row: `accord anchor`, `accord-architect`, `accord-critic`, `## Approach`, `accord approve`, `accord gate ready`, `accord-plan`.

Architect body: input the ticket; output impact list with `path:line`, then options in the ladder order of spec §2 principle 6, each with cost, risk, and the criterion it serves; mark the recommended one; never edit. Critic body: two modes named by the caller — `approach` (strongest case against the chosen option; check every Veto, Decision, Correction) and `plan` (no veto violated, nothing beyond the criteria, the approved approach followed, a task too big for half an executor's context, and the goal-backward question: assuming every task passes its `verify:` line, does the `## Intent` hold for the person it names — a criterion covered on paper with a step nobody wired or a state nobody reaches is a Must); findings `Must | Should | Nice`, numbered, each with a concrete failing case; no failing case, no finding.

- [ ] Steps as Task 8; commit `feat: accord-approach, the architect, and the critic`.

#### Task 9 revision (owner decision 2026-10-13)

Edits to the files Tasks 8 and 9 wrote. **Spec:** §4 Interview, §7 Approach. Each skill stays under 5120 bytes and 120 lines. Agent phrases are pinned by a new `AGENT_REQUIRED` table in `packages/core/test/agents.test.ts`, asserted over the rendered agent file the same way `REQUIRED` is asserted over a rendered skill.

`packages/core/skills/intent/SKILL.md`:
1. New step after "Look before asking": **Confirm the parts.** Before the first score, list the request's top-level parts and ask the owner to confirm them. Renumber the steps after it.
2. In the stop step, before the "enough" paragraph: before you stop, ask once for the smallest version that still counts as done.

`REQUIRED` row `intent` gains: `top-level parts`, `smallest version`.

`packages/core/skills/approach/SKILL.md`:
1. Step 2: the architect proposes the options in ladder order.
2. Step 3: pass the critic the chosen option's text only (its name and what it does), never the architect's reasoning, risk line, or `Recommended` line, so its review stays independent.
3. Step 3: replace "take the next option" with: take the next option in the architect's ladder order that is not yet ruled out, and run the critic again on it.
4. Step 3: when the ticket touches auth, money, migration, or data deletion, ask the critic for three concrete failure scenarios as well.
5. Step 4: drop "so the owner can switch before saying yes" from the rejected-options line. The risks line adds: for a ticket that touches auth, money, migration, or data deletion, each of the critic's three failure scenarios and how it is undone.
6. Step 5: if the owner picks another option, go back to step 3 with that option, rewrite the brief, and ask again. `accord approve` runs only on a yes to the brief as shown.

`REQUIRED` row `approach` gains: `ladder order`, `text only`, `not yet ruled out`, `three concrete failure scenarios`, `undone`, `back to step 3`.

`packages/core/agents/architect.md`:
1. Replace the ladder line with: Option 1 is the first rung of the ladder that fully works: does it need to exist; already in the repo; standard library or platform; installed dependency; minimum new code. Options 2 and 3, when you give them, climb further only where a criterion or constraint needs it, and say which.
2. Output format: each option gains a line after its name, `<what it does, in two or three lines>`, before the `cost / risk / serves` line. The caller hands the critic the name and these lines only.

`AGENT_REQUIRED` row `architect`: `first rung`, `climb further`, `what it does`.

`packages/core/agents/critic.md`:
1. Input line: in `approach` mode you get the chosen option's text only, its name and what it does; you judge it without the architect's reasoning.
2. Mode `approach` gains: when the ticket touches auth, money, migration, or data deletion, give three concrete failure scenarios, each with the step or state where it starts.
3. Mode `plan`: every item becomes a check — `Check that no Veto is violated.`, `Check that nothing goes beyond the acceptance criteria.`, `Check that the approved ## Approach is followed.`, `Check that each task fits in half an executor's context.`, and the goal-backward item as `Check that, assuming every task passes its verify: line, the ## Intent holds for the person it names`, keeping its Must.
4. Mode `plan` gains: `Check that an executor holding only the ticket and one task could finish that task without asking; a task that fails this is a Should.`
5. The plan round cap (showing the owner the revision with the fewest Must findings) is not the critic's: it does not know rounds. It lands in Task 10's skill.

`AGENT_REQUIRED` row `critic`: `text only`, `three concrete failure scenarios`, `Check that no Veto is violated`, `without asking`, `Should`.

- [ ] Steps: extend `REQUIRED` and add `AGENT_REQUIRED` → run (FAIL) → edit the four files → regenerate the skills and agents modules → run the Task 8–14 test set, then the full suite (PASS) → commit `fix: intent confirms parts and the smallest version; approach keeps the critic independent and re-critiques a switched option`.

---

### Task 9b: Deterministic contract checks

Not a stage skill task: the shared rules for Tasks 8–14 do not apply. **Spec:** §7 Plan, §8 Build, §10 Review.

**Files:**
- Modify: `packages/core/src/load/work.ts` (`parsePlan`: the `(new)` marker, `plan_hash:`, the body hash), `packages/core/src/model/snapshot.ts` (`PlanTask.newFiles`, `Plan.planHash`, `Plan.bodyHash`, `SnapshotInput.baselineFiles`, `RepoSnapshot.baselineFiles`), `packages/core/src/load/snapshot.ts` (carry `baselineFiles`)
- Modify: `packages/core/src/gate/plan.ts`, `packages/core/src/gate/rules.ts` (`gate.task-file-unknown`), `packages/core/src/gate/index.ts` (`GateResult.planHash`), `packages/core/src/gate/task.ts` (plan hash check), `packages/core/src/gate/work.ts` (`undeclaredFiles`), `packages/core/src/index.ts`
- Modify: `packages/cli/src/load/fs.ts` (baseline file facts), `packages/cli/src/commands/gate.ts` (write `plan_hash`), `packages/cli/src/commands/review-package.ts` (`## Undeclared files`)
- Modify: `test/helpers/lane.ts` (`PLAN` gains its `plan_hash:`)
- Test: `packages/core/test/work.test.ts`, `packages/core/test/lane-plan.test.ts`, `packages/core/test/task.test.ts`, `packages/core/test/undeclared.test.ts` (new), `packages/cli/test/lane-commands.test.ts`, `packages/cli/test/lane-flow.test.ts`

**Interfaces:**
- Consumes: `isSha` (`gate/done.ts`), `fnv1a64` (`gate/hash.ts`), `splitFrontmatter`, `tokens`, `planFile`, `workOf`, `laneTicket`, `writeKey` (`cli/src/write/key.ts`), `snapshot.ancestors` (Task 3).
- Produces:

```ts
// model/snapshot.ts
export interface PlanTask { /* existing fields */ files: string[]; newFiles: string[] } // files: every path token, `(new)` dropped; newFiles: the paths followed by `(new)`
export interface Plan { /* existing fields */ planHash?: string; bodyHash: string }   // planHash: frontmatter `plan_hash:` as written; bodyHash: fnv1a64 of the normalised text below the frontmatter
// SnapshotInput and RepoSnapshot
baselineFiles?: Record<string, string[]>; // baseline sha -> the plans' non-new files: paths that exist at that commit
// gate/index.ts
export interface GateResult { /* existing fields */ planHash?: string } // gate plan only: the plan's bodyHash, when the ticket has a plan
// gate/work.ts
export function undeclaredFiles(snapshot: RepoSnapshot, id: string, changed: readonly string[]): string[] | undefined;
```

- Rule `gate.task-file-unknown` (error, both profiles), in `PLAN_RULES` after `gate.task-verify-missing`.

Decisions:
- **The new marker** is the token `(new)` right after the path, on the `files:` line: `files: src/export.ts, src/csv.ts (new)`. `tokens` already splits it off; `parsePlan` attaches it to the token before it. A leading `(new)` marks nothing and is not a path.
- **`gate.task-file-unknown`** runs only when the host supplied `baselineFiles` and it holds the plan's baseline (the baseline rules own a missing or unknown baseline), mirroring `gate.plan-baseline-unknown`. One finding per task and path, at the task's line: `task <n> names <path>, which does not exist at baseline <sha>; correct the path, or write (new) after it if the task creates it`. Paths compare as written.
- **The plan-changed signal is a recorded hash.** `gate plan` writes `plan_hash:` on a pass exactly as `gate ready` writes `ac_hash` (`writeKey`, only on a difference, after the verdict is printed, a write failure exits 2), and `taskVerdict` compares it with `bodyHash`. Justification: plan.md is written after its baseline commit, so the baseline holds no copy to compare, and a recorded hash reuses the one write path accord already has. The hash covers the text below the frontmatter, so writing the key never moves it.
- **Undeclared files** are changed paths that no task's `files:` or `newFiles` names exactly or, for a token ending in `/`, contains. The ticket's own records (`accord/tickets/<id>.md` and everything under `accord/tickets/<id>/`) are never listed. Sorted, unique. `undefined` when the ticket has no plan.

- [ ] **Step 1: Failing tests.**
  - `work.test.ts`: `files: src/a.ts, src/b.ts (new)` parses `files: ['src/a.ts', 'src/b.ts']`, `newFiles: ['src/b.ts']`; `files: (new) src/a.ts` parses `files: ['src/a.ts']`, `newFiles: []`; `plan_hash: fnv1a64:0123456789abcdef` in the frontmatter parses as `planHash`; the LF, CRLF, and BOM+CRLF forms of one plan give one `bodyHash`; changing one `verify:` id changes it; adding or changing `plan_hash:` does not.
  - `lane-plan.test.ts`: with `baselineFiles: { abc1234: ['src/export.ts'] }` the helper plan passes; with `{ abc1234: [] }` it fails with two `gate.task-file-unknown` findings (one per task) naming `src/export.ts` at each task's line; a plan whose task writes `src/export.ts (new)` passes with `{ abc1234: [] }`; no `baselineFiles` skips the rule; `baselineFiles: { other12: [] }` skips it; `gatePlan(...).planHash` equals the plan's `bodyHash`, and is absent for a ticket without a plan.
  - `task.test.ts`: the helper plan with its `plan_hash:` passes; the same plan without `plan_hash:` fails with `plan.md has no plan_hash:; run accord gate plan T-1`; with a different hash it fails with `plan.md changed after accord gate plan last passed; run accord gate plan T-1 again`.
  - `undeclared.test.ts`: a plan naming `src/export.ts` and changed `['src/export.ts', 'src/extra.ts', 'docs/x.md', 'accord/tickets/T-1.md', 'accord/tickets/T-1/ledger.md']` gives `['docs/x.md', 'src/extra.ts']`; a task with `files: src/` declares `src/extra.ts`; a `(new)` path is declared; a ticket without a plan gives `undefined`.
  - `lane-commands.test.ts` (real git via `makeLaneRepo`, `gitRun`): a plan naming `src/nope.ts` fails `accord gate plan T-1` (exit 1) naming `gate.task-file-unknown`; `src/nope.ts (new)` passes; a passing `gate plan` writes `plan_hash:` into `plan.md` and a second run leaves its bytes and mtime unchanged; after `gate plan` passes, editing a `verify:` line in `plan.md` makes `accord task-done T-1 1` exit 1 with `plan.md changed after accord gate plan last passed`, and re-running `gate plan` clears it; `accord review-package T-1` after a commit adding `src/export.ts` and `docs/notes.md` prints `## Undeclared files` followed by `docs/notes.md` only; with nothing undeclared the section reads `(none)`.
  - Existing `task-done` tests in `lane-commands.test.ts` and `lane-flow.test.ts` keep passing through the helper's hashed `PLAN`; a test whose plan text differs runs `accord gate plan` first. List each test changed in the report.

- [ ] **Step 2: Run** the six files — expected FAIL.

- [ ] **Step 3: Implement.**
  - `parsePlan`: for the `files` field, a `(new)` token is dropped from `files` and pushes the token before it onto `newFiles`. Read `plan_hash` from the frontmatter map as `baseline` is read. `bodyHash = fnv1a64(body)` over the normalised body `splitFrontmatter` returns; if importing `gate/hash.ts` from `load/` makes a cycle the lint rejects, move `fnv1a64` to `load/hash.ts` and re-export it from `gate/hash.ts`.
  - `PLAN` in `test/helpers/lane.ts`: compute its body's `fnv1a64` once, write the literal into its frontmatter as `plan_hash: "fnv1a64:…"`, and add a test asserting the literal still equals the parsed `bodyHash`, so an edit to `PLAN` fails loudly.
  - `gate/plan.ts` `taskFileUnknown`; its row in `rules.ts`; `gatePlan` adds `planHash` when the ticket has a plan.
  - `taskVerdict`: after the plan is found, `planHash` absent or different from `bodyHash` fails with the reasons above.
  - `undeclaredFiles` in `gate/work.ts`; export it and the new types from `index.ts`.
  - `fs.ts`: after the ancestry facts, for each baseline that maps to `true`, collect the non-new `files:` paths of every lane plan with that baseline and run `git --literal-pathspecs ls-tree --name-only -z <sha> -- <paths…>` (literal array; the sha is validated by `isSha`; `--literal-pathspecs` keeps a path from reading as pathspec magic). Split on NUL; record `[]` when no path exists or none was asked. A git failure is a `UsageError` naming the sha. Omit `baselineFiles` when no baseline maps to `true`.
  - `gate.ts`: on a passing `gate plan` with `planHash`, `writeKey(ctx.root, plan.file, 'plan_hash', result.planHash)`, with the same stderr lines and exit-2 failure as the `ac_hash` write.
  - `review-package.ts`: run `git diff --name-only -z --no-renames <range> --`, pass the paths to `undeclaredFiles`, and add `## Undeclared files` after `## Stat`: one path per line, `(none)` when empty, `(no plan)` when the ticket has none.

- [ ] **Step 4: Run** the six files, `packages/cli/test/spawn-surface.test.ts`, then the full suite. PASS; no golden of a ticket without `lane:` changes.

- [ ] **Step 5: Commit** — `feat: gate plan checks files at the baseline and records plan_hash; task-done refuses a changed plan; review-package lists undeclared files`.

### Task 10: `accord-plan`, with the planner

**Files:** Create `packages/core/skills/plan/SKILL.md` (`name: accord-plan`); `packages/core/agents/planner.md` (`tools: Read, Grep, Glob, Write, Edit`, `route: planner`). **Spec:** §7 Plan, §7 Slicing. **Depends on:** Task 9b (`(new)`, `plan_hash:`).

The skill must say:
1. `accord anchor`.
2. Dispatch `accord-planner` with the ticket file: it writes `tickets/<id>/plan.md` with frontmatter `baseline: <git rev-parse HEAD>` and one `## Task <n>: <title>` per task, each with `covers:`, `files:`, `verify:` lines, then prose: interface (consumes, produces) and the test written first. A task fits in about half an executor's context.
3. Under `review: human` (absent counts as human) the planner groups tasks into slices, each a pull request of a stated subset of criteria, green on its own; under `review: outcome`, one branch.
4. Run `accord gate plan <id>`; fix what it prints. On a pass it writes `plan_hash:` into `plan.md`; a plan changed later must pass `accord gate plan` again before `accord task-done` records a task.
5. Dispatch `accord-critic` in `plan` mode with the ticket and the plan. Fix every Must and Should.
6. At most three revision rounds; then stop and tell the owner what is still open, showing the revision with the fewest Must findings and the round it came from. Never continue on a failing plan.
7. Before build, run `tests.full` from `accord/config.yml` on the baseline. Show the owner every failing case; the owner decides whether it is fixed first or tracked as its own ticket. Never ignore one on your own.
8. The owner does not need to read the plan. Next: `accord-build`.

`REQUIRED` row: `accord anchor`, `accord-planner`, `baseline:`, `covers:`, `verify:`, `accord gate plan`, `plan_hash:`, `accord-critic`, `three`, `fewest Must`, `tests.full`, `accord-build`.

Planner body: writes only `tickets/<id>/plan.md`; every `@ac-n` and every `D-nn` cited by some task's `covers:`; `verify:` names test report case ids that will exist; a path the task creates is followed by `(new)` on its `files:` line (`files: src/export.ts, src/csv.ts (new)`), and every other path must exist at the baseline; a task that edits an existing file names the behaviour there that must not change; order tasks so the one that proves the approach end to end (the wiring) comes first and polish comes last; no TODO, TBD, placeholder, "for now", "later"; a bug ticket's first task is the failing reproduction test.

`AGENT_REQUIRED` row `planner`: `(new)`, `must not change`, `wiring`, `polish`.

- [ ] Steps as Task 8; commit `feat: accord-plan and the planner`.

### Task 11: `accord-build`, with the executor

**Files:** Create `packages/core/skills/build/SKILL.md` (`name: accord-build`); `packages/core/agents/executor.md` (no `tools` line — it inherits all; `route: executor`). **Spec:** §8, §9. **Depends on:** Task 9b (`task-done` refuses a changed plan).

The skill must say:
1. `accord anchor`; it names the next task.
2. For each task without a ledger line, in order, one at a time: run `accord brief <id> <n>` into a file and dispatch a fresh `accord-executor` with that file only. Never pass chat history.
3. When it reports, run the affected tests yourself with the `tests.affected` command from `accord/config.yml` (`{files}` replaced by the task's files), then `accord task-done <id> <n>`. The executor's claim alone records nothing.
4. `BLOCKED` with a question that touches intent, a veto, a criterion, or a public interface: ask the owner. `BLOCKED: context`: dispatch a fresh executor with the same brief plus the diff and ledger so far. `NEEDS_CONTEXT`: answer and re-dispatch.
5. Files outside the task's `files:` line must be declared with a reason in the report; record a Ruling when you accept them.
6. **Change of course.** When the approved approach cannot work, stop. Write a change note under the ticket's `## Approach`: what failed, which finished tasks still hold, and the proposed new approach. Ask the owner for a new yes; on yes run `accord approve <id>`, then `accord-plan` re-plans only the tasks the change touches. Never re-plan quietly.
7. When `accord task-done` says `plan.md` changed, never run `accord gate plan` to clear it: revert the change and re-dispatch. Only `accord-plan` changes the plan.
8. When every task has a ledger line, next: `accord-review`.

`REQUIRED` row: `accord anchor`, `accord brief`, `accord-executor`, `tests.affected`, `accord task-done`, `BLOCKED: context`, `change note`, `accord approve`, `accord-plan`, `accord-review`.

Executor body (spec §8 rules verbatim in substance): write the task's criterion test first, show it failing then passing, both outputs in the report; fix small bugs met on the way and log them; stop with `BLOCKED` and a question when the work would change architecture or a public interface or cross a veto; never edit the ticket or `plan.md`, and never weaken a criterion test after showing it fail — a test that seems wrong is `BLOCKED` with the reason; at most three attempts per problem; no new package without asking; declare any file outside the plan's list; near the context limit, commit what is finished and return `BLOCKED: context` with what remains; report at most 15 lines: `DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT`, commits, test evidence, files touched, Rulings; never dispatch another agent.

`AGENT_REQUIRED` row `executor`: `plan.md`, `never weaken`, `BLOCKED`.

- [ ] Steps as Task 8; commit `feat: accord-build and the executor`.

### Task 12: `accord-review`, with the reviewer and the final reviewer

**Files:** Create `packages/core/skills/review/SKILL.md` (`name: accord-review`, `loads: [review/record.md]`) and `packages/core/skills/review/record.md` (the `review.md` format); `packages/core/agents/reviewer.md` (`tools: Read, Grep, Glob, Bash`, `route: reviewer`). **Spec:** §10. **Depends on:** Task 9b (`## Undeclared files`).

Size: if the rendered `SKILL.md` passes 5120 bytes, move step 3's reviewer table into `record.md` under `## Choosing reviewers` and keep one line in step 3 naming it; the finding classes and the round 3 rule stay in `SKILL.md`.

The skill must say:
1. `accord anchor`.
2. `accord review-package <id>` into a file (it diffs from the plan's baseline and lists, under `## Undeclared files`, every changed file no task names).
3. Choose reviewers by diff size and risk (spec §10 table): up to about 500 changed lines one `accord-reviewer` with both lenses; 500–1500 an `intent` and a `quality` reviewer in parallel; over 1500 split by area times lens plus one `integration` reviewer; auth, money, migration, or data deletion adds a `security` reviewer at any size. Name the lens in the dispatch. Inputs: the ticket file, the approach, the review package, the ledger; the executor's report is context, never evidence.
4. Merge and de-duplicate findings. Before fixing, mark each one `patch`, `plan-gap`, or `intent-gap`. Only patches enter the fix loop: fix every Must and Should marked `patch` through `accord-build`'s executor path, then re-review only the fix diff with one reviewer. A plan gap goes back to `accord-plan`, where the critic runs again. An intent gap stops the run and asks the owner. Nice findings go to the ledger under `## Deferred`.
5. If round 3 still finds a new Must, say whether it traces to the ticket or the plan; if it does, ask the owner before round 4.
6. At most five rounds; rounds at or after `escalation.fix_round_tier_up` (default 4) dispatch a fresh executor one model tier higher (`haiku` → `sonnet` → `opus`; `opus` stays `opus`). At the cap, stop and report the open findings to the owner; never report the work finished.
7. After convergence, one `accord-final-reviewer` reads the whole package once; one fix and one scoped re-review if needed, then stop.
8. Record every round in `tickets/<id>/review.md` as `./record.md` says, ending `verdict: converged`, or `verdict: accepted-by-owner` followed by the owner's sentence quoted.
9. Next: `accord-verify`.

`record.md`: one `## Round <n>` section per round listing findings `Must|Should|Nice <n> [patch|plan-gap|intent-gap]: <finding> — <file:line> — fixed in <sha> | deferred | open`, then the single last line `verdict: …`.

`REQUIRED` row: `accord anchor`, `accord review-package`, `accord-reviewer`, `accord-final-reviewer`, `Must`, `Should`, `Nice`, `patch`, `plan-gap`, `intent-gap`, `round 3`, `Undeclared files`, `five`, `fix_round_tier_up`, `verdict: converged`, `verdict: accepted-by-owner`, `accord-verify`.

Reviewer body: lens parameter `intent | quality | security | integration | both`; intent findings quote the criterion, veto, or correction violated, and "Extra" covers anything nobody asked for — a spec's silence is not permission; quality covers correctness, safety, simplicity (delete, reuse, standard library, not needed), the test policy (spec §9), and the repository's written conventions and `product/` rules, skipping anything a configured linter or type check already enforces; each path under `## Undeclared files` in the review package is accepted only when the ledger holds a Ruling naming it with a reason, otherwise it is an Extra finding; findings `Must | Should | Nice`, numbered, each with a concrete failing case — no failing case, no finding; read-only except running tests and git. Extend `agents.test.ts`: `accord-final-reviewer.md` exists with `model: opus, effort: high` by default and follows `models["reviewer.final"]`.

`AGENT_REQUIRED` row `reviewer`: `Extra`, `written conventions`, `product/`, `linter`, `Undeclared files`, `Ruling`.

- [ ] Steps as Task 8; commit `feat: accord-review, the reviewer, and the final reviewer`.

### Task 13: `accord-verify`, with the verifier

**Files:** Create `packages/core/skills/verify/SKILL.md` (`name: accord-verify`); `packages/core/agents/verifier.md` (`tools: Read, Grep, Glob, Bash, Write, Edit`, `route: verifier`). **Spec:** §11.

The skill must say:
1. `accord anchor`.
2. Run the full suite with `tests.full` from `accord/config.yml` so the report `tests.report` names is fresh.
3. Dispatch `accord-verifier` in a fresh context with the ticket file: it writes `verification.md`.
4. Build the owner's report: one line per criterion, pass or fail, with evidence; three to five "try this" steps of about two minutes; all Rulings, ordered by their cost if wrong, highest first; deferred items; what was not checked; slow tests.
5. Under `review: outcome` the owner reads the report, tries the steps, and ticks `verified:`; under `review: human` the 0.1.0 human layer stays. Never tick `verified:` for the owner.
6. Run `accord gate done <id>` and work from what it prints.

`REQUIRED` row: `accord anchor`, `tests.full`, `accord-verifier`, `verification.md`, `try this`, `cost if wrong`, `verified:`, `accord gate done`.

Verifier body: distrust summaries; per criterion check exists, substantive (not a stub), wired (reachable from its entry point), and data flows (not hard-coded); what you cannot prove is `Result: blocked`, never pass; write only `verification.md`, in the format of the shipped `verification.md` template (read it from the repository's ticket folder convention).

- [ ] Steps as Task 8; commit `feat: accord-verify and the verifier`.

### Task 14: `accord-debug`, with the debugger

**Files:** Create `packages/core/skills/debug/SKILL.md` (`name: accord-debug`); `packages/core/agents/debugger.md` (`tools: Read, Grep, Glob, Bash, Write`, `route: debugger`). **Spec:** §12 Debugging. Reuse what still applies from the deleted `dev/debug.md` (`git show <Task 6 commit>:packages/core/skills/dev/debug.md`) — but within the 5 KB and 120-line limits.

The skill must say: `accord anchor`; no fix before a root cause; competing hypotheses, each with evidence for and against, ranked before any is tested; one hypothesis is always that the test or measurement itself is wrong; test first the hypothesis whose cheapest probe separates the top two; after one failed fix, dispatch one `accord-debugger` per remaining hypothesis in parallel; state written to `tickets/<id>/debug.md` so it survives compaction; grep every caller and fix the root cause once in shared code; the fix starts with a failing reproduction test; after three failed fixes, stop, question the architecture, and ask the owner; then return to the stage that called it.

`REQUIRED` row: `accord anchor`, `accord-debugger`, `debug.md`, `hypothes`, `measurement`, `cheapest probe`, `parallel`, `reproduction`, `three`.

Debugger body: runs commands and reads; writes only `tickets/<id>/debug.md`; ranks its hypotheses before testing any, always including that the test or measurement is wrong, and runs first the cheapest probe that separates the top two; returns the root cause with evidence, the failing reproduction test it proposes, and the hypotheses ruled out. When dispatched with one hypothesis in a parallel round, it returns its evidence and writes nothing; the skill merges the results into `debug.md`, so parallel debuggers never write one file.

`AGENT_REQUIRED` row `debugger`: `measurement`, `cheapest probe`, `parallel round`.

- [ ] Steps as Task 8; commit `feat: accord-debug and the debugger`.

---

### Task 15: Install in this repository, and user-facing docs

**Files:**
- Modify: `README.md`, `docs/design.md` (a short section on the workflow layer: `/accord`, lanes, stages, agents, hooks, routing keys — in accord's own words, no other tool named)
- Generated by sync: `.claude/skills/accord*/`, `.claude/agents/accord-*.md`, `.claude/settings.json`
- Delete: `.claude/skills/accord-ba/`, `.claude/skills/accord-dev/`
- Modify: `CLAUDE.md` (root) — replace the text between `<!-- accord:start -->` and `<!-- accord:end -->` with the new pointer block from Task 7 (pointer writes only append, so an existing block is updated by hand once)
- Modify: `packages/cli/test/readme.test.ts` if it pins README text

- [ ] **Step 1:** `npm run build`, then `node packages/cli/dist/cli.js skills sync`. Expected report: the eight stage skills and ten agents `created`, `.claude/settings.json` `created`, orphans `accord-ba` and `accord-dev` listed.
- [ ] **Step 2:** `git rm -r -q .claude/skills/accord-ba .claude/skills/accord-dev`, then sync again: everything `unchanged`, no orphan.
- [ ] **Step 3:** run the exact commands `.claude/settings.json` now holds, from the repository root: `npx --yes @accord-dev/accord@0.1.0 hook session-start` prints the ruleset and the session line (inside this workspace npx resolves the local build), and `... hook subagent-start` prints one JSON line. Time the first one; if it takes over three seconds, say so in the report.
- [ ] **Step 4:** Docs and the root `CLAUDE.md` pointer block. Run the full suite (README tests included).
- [ ] **Step 5: Commit** — `chore: install the stage skills, agents, and hooks in this repository; document the workflow layer`.

---

### Task 16: Dogfood — the stale signal, through accord (main session with the owner)

Not an implementer task. The main session runs it in this repository after Task 15 is merged into the phase branch, following the installed skills, with the owner at the two points the workflow asks for them.

- [ ] **Owner setup:** in `.claude/settings.local.json` (not committed), turn off overlapping workflow plugins for this repository; confirm a new session prints the ruleset and the session line.
- [ ] **Run:** `/accord stale signal for tickets and claim branches` → lane M proposed → `accord new ticket STALE-1 --lane M` → `accord-intent` (owner answers, auditor runs) → `accord-approach` (**owner's yes**, `accord approve STALE-1`, `accord gate ready STALE-1`) → `accord-plan` (`accord gate plan STALE-1`, critic) → `accord-build` (executors, `accord task-done`) → `accord-review` (converged) → `accord-verify` (**owner tries the steps and ticks `verified:`**, `accord gate done STALE-1` passes).
- [ ] **Scope of STALE-1** (spec §3 Lifecycle, *Stale*): `status` marks a lane ticket whose stage is not done, whose status is neither `dropped` nor `archived`, and whose newest commit touching `accord/tickets/<id>.md` or `accord/tickets/<id>/` is older than `stale_days` (default 14); a claim branch `t/<id>` whose tip is older than that marks it too. Host facts from git, `now` passed in, core stays pure. The intent interview settles the rest with the owner.
- [ ] **Record what the workflow got wrong** in `docs/plans/2026-10-12-phase-2-dogfood.md`: every place a skill was unclear, a gate blocked something it should not have, or the agent drifted from intent. That file is the input to phase 3's fixtures.
- [ ] **Commit** per the workflow's own steps, then open the phase 2 pull request for the owner.

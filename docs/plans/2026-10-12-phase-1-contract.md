# Phase 1: Contract — Implementation Plan

> **For agentic workers:** implement this plan task by task: one fresh implementer per task, an independent review of each task before the next starts, and a whole-branch review at the end. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend the accord contract and CLI so a ticket carrying `lane:` is gated through approval, a mechanically complete plan, recorded task completion, a converged review, and a traced test suite — the deterministic layer every later phase builds on.

**Architecture:** The `lane` frontmatter key opts a ticket into the new contract; tickets without it keep every 0.1.0 rule, so no existing golden moves. Core stays pure: new loaders parse `plan.md`, `ledger.md`, `review.md`, and `accord/tests-baseline.txt` into the snapshot; new gate tables and lint rules read them. The CLI adds thin commands (`approve`, `gate plan`, `task-done`, `brief`, `review-package`, `tests baseline`, `next`, `anchor`) that follow the existing preflight → pure core → print → exit-code spine and spawn only `git`.

**Tech Stack:** TypeScript 5.9.3, Node ≥ 22.12, commander 15, yaml 2.9, ajv 8, vitest 5, npm workspaces (`packages/core`, `packages/cli`).

**Spec:** `docs/specs/2026-10-12-workflow-layer-design.md` (sections 4–11, 15–17). Read it before Task 1.

## Global Constraints

- Node `>=22.12.0`; TypeScript `5.9.3`; ESM only. No new runtime or dev dependency.
- Core (`packages/core/src/**`) imports no Node built-in (eslint `no-restricted-imports`, CORE-01). Filesystem and `git` live in `packages/cli/src/**` only.
- The CLI spawns only `git` (or `gh`) by string literal, with a literal argument array and no `shell:` option (`packages/cli/test/spawn-surface.test.ts`).
- Exit codes: 0 pass, 1 lint or gate failure or a failed verdict, 2 usage or environment error (`UsageError`).
- Under `--json`, stdout carries the core object verbatim and every notice goes to stderr (D-98).
- Paths in findings and printed output use forward slashes; no `\` is ever printed (D-51).
- Optional fields are omitted, never set to `undefined`, so `JSON.stringify` goldens stay stable (D-54).
- Caller-supplied ids are looked up with `Object.hasOwn`, never `in`.
- A gate or lint check returns drafts without `level` or `rule`; the table row stamps both (D-57).
- Findings sort by file, line, rule, reason, pointer in code-point order (`byFileLineRule`).
- A ticket without `lane:` must produce byte-identical lint, gate, and status results to 0.1.0: every existing golden under `packages/core/test/__golden__/` stays unchanged. A golden diff in any task is a bug in that task, not something to regenerate.
- Nothing shipped (templates, schemas, source strings, generated files) names another tool, plugin, or planning system (`test/helpers/denied.ts`).
- Commits are authored solely by the repository owner: no `Co-Authored-By` line. Conventional subject, lower case, as in `git log`.
- Each config key is added in the phase that first reads it. This phase adds `review.mode` only; `review.max_pr_lines`, `models`, `escalation`, `tests.affected`, and `tests.full` are later phases.

## Review Focus

1. **Legacy tickets unchanged.** A repository whose tickets have no `lane:` must lint, gate, and render `status` exactly as 0.1.0 does. Every task that touches a shared rule ends with the full core suite green and no golden diff (each task's final run step).
2. **Line endings and BOM in the new record files.** A CRLF or BOM `plan.md`, `ledger.md`, or `review.md` must parse identically to LF (Task 2 test "reads CRLF and a BOM the same as LF"; Task 9 ledger CRLF test).
3. **Recording a task twice.** `accord task-done` run twice must leave one ledger line and report "already recorded" (Task 9 CLI test; Task 15 flow test).
4. **A stale test report.** A report written before the current commit must not mark a task done (Task 9 CLI test "refuses a report older than the commit").
5. **Ticket ids with dots and underscores in branch names and paths.** `t/T-1.2_a` must claim ticket `T-1.2_a` (Task 12 CLI claims test), and no new command prints a backslash on Windows (Task 15 printed-paths entries).

## Spec decisions taken in this plan

These refine the spec; the spec was updated in the same commit as this plan.

- `review` is an object, `review: { mode: human | outcome }`, so `review.max_pr_lines` can join it in phase 4. Absent means `human`.
- `task-done` does not run a command. It checks that every case on the task's `verify:` line is `passed` in the test report and that the report is newer than `HEAD`. The CLI spawns only `git`; the report is the same evidence the Done gate reads.
- The test policy is enforced from the report: `lint.test-untraced` (warning, once a lane ticket exists) and `gate.test-untraced` (error at Done for lane tickets), with `accord/tests-baseline.txt` written once by `accord tests baseline` for legacy cases. There is no `accord lint tests` subcommand.
- Dependencies count as done when the dependency's records say `done` in the current tree (Task 12). "Merged" is implied by being present in the tree the command runs on.

## File Structure

| File | Responsibility | Task |
|---|---|---|
| `packages/core/schemas/ticket.schema.json` | + `lane`, `depends_on`, `approved_hash` | 1 |
| `packages/core/schemas/config.schema.json` | + `review.mode` | 1 |
| `packages/core/src/model/snapshot.ts` | new frontmatter/config fields; `PlanTask`, `Plan`, `Ledger`, `Review`, `TicketWork`; snapshot `work`, `testsBaseline`, `claims` | 1, 2 |
| `test/helpers/lane.ts` (repo root) | string builders shared by core and CLI tests | 2 |
| `packages/core/src/load/work.ts` | parse plan, ledger, review, baseline | 2 |
| `packages/core/src/load/snapshot.ts` | route the new files into the snapshot | 2 |
| `packages/core/src/gate/hash.ts` | `fnv1a64`, `approvedInput`, `approvedHash` | 3 |
| `packages/core/test/helpers/approve.ts` | `approved()` test helper | 3 |
| `packages/core/src/load/sections.ts` | lane headings join the duplicate-heading set | 4 |
| `packages/core/src/lint/ticket.ts` | lane heading table | 4 |
| `packages/core/src/lint/depends.ts` | `lint.depends-unknown`, `lint.depends-cycle` | 4 |
| `packages/core/src/gate/ready.ts` | lane Ready rules | 5 |
| `packages/core/src/gate/work.ts` | record paths, `workOf`, `laneTicket`, `VERDICTS`, lane Done rules | 6, 7 |
| `packages/core/src/gate/plan.ts` | plan gate rules, `decisionIds` | 6 |
| `packages/core/src/gate/rules.ts` | `PLAN_RULES`, new Ready/Done rows | 5, 6, 7 |
| `packages/core/src/gate/index.ts` | `gatePlan`, `GateResult.gate` union | 6 |
| `packages/core/src/lint/tests.ts` | `untracedTests`, `lint.test-untraced` | 7 |
| `packages/core/src/gate/refs.ts` | notes optional under `review.mode: outcome` | 7 |
| `packages/core/src/gate/done.ts` | export `reportLoaded`, `reportPath` | 7 |
| `packages/core/src/gate/task.ts` | `taskVerdict` | 9 |
| `packages/core/src/write/ledger.ts` | `recordTaskDone` | 9 |
| `packages/core/src/status/stage.ts` | `progressOf`, `isDone`, `Stage` | 12 |
| `packages/core/src/status/rows.ts` | lane fields on `StatusRow`, `nextRows` | 12 |
| `packages/core/src/status/anchor.ts` | `anchorText` | 13 |
| `packages/core/templates/ticket-lane.md`, `epic-lane.md` | lane templates | 14 |
| `packages/core/src/index.ts` | public exports | 2, 3, 6, 9, 12, 13 |
| `packages/cli/src/write/key.ts` | shared frontmatter write (from `gate.ts`) | 8 |
| `packages/cli/src/commands/{approve,task-done,brief,review-package,tests-baseline,next,anchor}.ts` | new commands | 8–13 |
| `packages/cli/src/commands/{gate,new-ticket}.ts`, `src/run.ts`, `src/load/fs.ts`, `src/render/table.ts` | wiring, claims, columns | 6, 8–14 |
| `packages/cli/test/helpers/repo.ts` | `writeFiles`, `makeLaneRepo`, `gitRun` | 8 |
| `packages/cli/test/lane-commands.test.ts`, `lane-flow.test.ts` | CLI tests | 6, 8–15 |
| `docs/design.md` | pointer to the workflow layer | 15 |

---

### Task 0: Install and record the baseline

**Files:** none changed.

- [ ] **Step 1: Install the locked dependencies**

Run: `npm ci`
Expected: completes without error; `node_modules/.bin/tsdown` exists.

- [ ] **Step 2: Run the full check**

Run: `npm run check`
Expected: build, lint, typecheck, and every test pass. If anything fails here, stop and report it: the plan assumes a green baseline.

---

### Task 1: Schema keys for lane tickets and review mode

**Files:**
- Modify: `packages/core/schemas/ticket.schema.json`
- Modify: `packages/core/schemas/config.schema.json`
- Modify: `packages/core/src/model/snapshot.ts`
- Test: `packages/core/test/schemas.test.ts`

**Interfaces:**
- Produces: `TicketFrontmatter.lane?: 'M' | 'L' | 'P'`, `TicketFrontmatter.depends_on?: string[]`, `TicketFrontmatter.approved_hash?: string`, `AccordConfig.review?: { mode: 'human' | 'outcome' }`.

- [ ] **Step 1: Write the failing tests**

In `packages/core/test/schemas.test.ts`, inside the `describe('ticket.schema.json', …)` block (next to the D-76 test), add:

```ts
  it('lane tickets: lane, depends_on, approved_hash (spec §4, §5)', () => {
    expect(ticket({ lane: 'M', depends_on: ['T-1', 'T-2'], approved_hash: 'fnv1a64:0123456789abcdef' })).toEqual([]);
    expect(ticket({ lane: 'L' })).toEqual([]);
    expect(ticket({ lane: 'P', depends_on: [] })).toEqual([]);
    expect(has(ticket({ lane: 'S' }), '/lane', 'schema.enum')).toBe(true);
    expect(has(ticket({ depends_on: ['T-1', 'T-1'] }), '/depends_on', 'schema.uniqueItems')).toBe(true);
    expect(has(ticket({ depends_on: ['-bad'] }), '/depends_on/0', 'schema.pattern')).toBe(true);
    expect(has(ticket({ depends_on: 'T-1' }), '/depends_on', 'schema.type')).toBe(true);
    expect(has(ticket({ approved_hash: 'abc' }), '/approved_hash', 'schema.pattern')).toBe(true);
  });
```

Inside the config `describe` block, next to the `tests.report` test, add:

```ts
  it('review.mode is human or outcome and the only key (spec §7)', () => {
    const review = (r: unknown) => validate('config', { ...minimal.config, review: r });
    expect(review({ mode: 'outcome' })).toEqual([]);
    expect(review({ mode: 'human' })).toEqual([]);
    expect(has(review({}), '/review', 'schema.required')).toBe(true);
    expect(has(review({ mode: 'both' }), '/review/mode', 'schema.enum')).toBe(true);
    expect(has(review({ mode: 'human', max_pr_lines: 400 }), '/review', 'schema.additionalProperties')).toBe(true);
  });
```

Change the existing keys test to:

```ts
  it('top-level properties are the six D-16 keys plus optional tests (D-72) and review (spec §7)', () => {
    const keys = ['accord', 'profile', 'tracker', 'design', 'roles', 'runtimes'];
    expect(Object.keys(configSchema.properties)).toEqual([...keys, 'tests', 'review']);
    expect(configSchema.required).toEqual(keys);
    for (const key of Object.keys(configSchema.properties)) {
      expect(key).not.toMatch(/key|token|secret|password/i);
    }
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project core schemas`
Expected: FAIL — the new keys are `schema.additionalProperties` errors and the keys list lacks `review`.

- [ ] **Step 3: Add the schema keys**

In `packages/core/schemas/ticket.schema.json`, insert after the `"assumptions"` property and before `"ac_hash"`:

```json
    "lane": { "type": "string", "enum": ["M", "L", "P"] },
    "depends_on": {
      "type": "array",
      "uniqueItems": true,
      "items": { "type": "string", "pattern": "^[A-Za-z0-9][A-Za-z0-9._-]*$" }
    },
    "approved_hash": { "type": "string", "pattern": "^fnv1a64:[0-9a-f]{16}$" },
```

In `packages/core/schemas/config.schema.json`, add after the `"tests"` property (add a comma after its closing brace):

```json
    "review": {
      "type": "object",
      "additionalProperties": false,
      "required": ["mode"],
      "properties": { "mode": { "type": "string", "enum": ["human", "outcome"] } }
    }
```

In `packages/core/src/model/snapshot.ts`, add to `TicketFrontmatter` after `assumptions`:

```ts
  lane?: 'M' | 'L' | 'P'; // spec §3: present opts the ticket into the workflow-layer contract
  depends_on?: string[]; // spec §5: ticket ids that must reach done first
  approved_hash?: string; // spec §4: written by `accord approve`, 'fnv1a64:<16 hex>'
```

and to `AccordConfig` after `tests`:

```ts
  review?: { mode: 'human' | 'outcome' }; // spec §7: absent means 'human', the 0.1.0 behaviour
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project core schemas`
Expected: PASS.

- [ ] **Step 5: Run the core suite**

Run: `npx vitest run --project core`
Expected: PASS with no golden change (`git status` shows no file under `__golden__`).

- [ ] **Step 6: Commit**

```bash
git add packages/core/schemas packages/core/src/model/snapshot.ts packages/core/test/schemas.test.ts
git commit -m "feat(schema): lane, depends_on and approved_hash on tickets, review.mode in config"
```

---

### Task 2: Load plan, ledger, review, and the tests baseline

**Files:**
- Create: `test/helpers/lane.ts`
- Create: `packages/core/src/load/work.ts`
- Modify: `packages/core/src/model/snapshot.ts`
- Modify: `packages/core/src/load/snapshot.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/work.test.ts`

**Interfaces:**
- Produces: `parsePlan(file, text): { plan: Plan; findings: LoadFinding[] }`, `parseLedger(file, text): Ledger`, `parseReview(file, text): Review`, `parseBaseline(text): string[]` in `load/work.ts`. Types `PlanTask`, `Plan`, `Ledger`, `Review`, `TicketWork`. `RepoSnapshot.work?: Record<string, TicketWork>`, `RepoSnapshot.testsBaseline?: string[]`, `RepoSnapshot.claims?: Record<string, string>`, `SnapshotInput.claims?: Record<string, string>`. Finding rules `load.task-duplicate`, `load.work-orphan`.
- Produces (test helpers, root): `REPORT`, `CONFIG`, `LANE_BODY`, `laneTicket(id, opts)`, `PLAN`, `junit(cases)`.

- [ ] **Step 1: Create the shared test strings**

Create `test/helpers/lane.ts`:

```ts
// In-memory lane-ticket repositories for the workflow-layer tests (docs/specs/2026-10-12-workflow-layer-design.md).
// Strings rather than fixture folders: several values (approved_hash, ac_hash) are computed by the code
// under test, and a folder under packages/core/test/fixtures/ would also join the snapshot and lint
// directory scans and add goldens nobody asked for. Both test trees import DOWNWARDS from here.

export const REPORT = 'reports/junit.xml';

export const CONFIG = [
  'accord: "0.1.0"',
  'profile: build',
  'tracker:',
  '  adapter: none',
  'design:',
  '  tokens: ""',
  'roles: [ba, dev]',
  'runtimes: [claude]',
  'tests:',
  `  report: ${REPORT}`,
  'review:',
  '  mode: outcome',
  '',
].join('\n');

export const LANE_BODY = [
  '## Intent',
  'Owners can export their report as CSV.',
  '',
  '## Acceptance criteria',
  '```gherkin',
  'Feature: Export',
  '',
  '  @ac-1 @test:export#writes-csv',
  '  Scenario: export writes a csv',
  '    Given a report',
  '    When the owner exports it',
  '    Then a csv file is written',
  '',
  '  @ac-2 @test:export#escapes-commas',
  '  Scenario: commas are escaped',
  '    Given a cell with a comma',
  '    When the owner exports it',
  '    Then the cell is quoted',
  '```',
  '',
  '## Vetoes',
  '- No new dependency.',
  '',
  '## Decisions',
  '- D-01 Use the existing writer — "reuse what we have"',
  '',
  '## Corrections',
  '',
  '## Open questions',
  '- [x] Delimiter? Comma.',
  '',
  '## Approach',
  'Extend the existing report writer with a csv mode.',
  '',
].join('\n');

/** A ticket file. `lane: ''` omits the key, which makes a 0.1.0 ticket. `frontmatter` lines go before the closing ---. */
export function laneTicket(id: string, opts: { lane?: string; frontmatter?: string[]; body?: string } = {}): string {
  const lane = opts.lane ?? 'M';
  const fm = [
    '---',
    `id: "${id}"`,
    'title: "Export"',
    'type: story',
    'status: open',
    ...(lane === '' ? [] : [`lane: ${lane}`]),
    'ui: false',
    ...(opts.frontmatter ?? []),
    '---',
    '',
  ];
  return fm.join('\n') + (opts.body ?? LANE_BODY);
}

export const PLAN = [
  '# Plan',
  '',
  '## Task 1: Writer csv mode',
  'covers: @ac-1, D-01',
  'files: src/export.ts',
  'verify: export#writes-csv',
  'Add a csv branch to the writer.',
  '',
  '## Task 2: Escaping',
  'covers: @ac-2',
  'files: src/export.ts',
  'verify: export#escapes-commas',
  'Quote cells that contain a comma.',
  '',
].join('\n');

/** A JUnit report; a key 'cls#name' becomes classname="cls" name="name", which scanJUnit reads back as 'cls#name'. */
export function junit(cases: Record<string, 'passed' | 'failed' | 'skipped'>): string {
  const body = Object.entries(cases)
    .map(([id, status]) => {
      const [cls, name] = id.split('#');
      const inner = status === 'failed' ? '<failure/>' : status === 'skipped' ? '<skipped/>' : '';
      return `<testcase classname="${cls}" name="${name}">${inner}</testcase>`;
    })
    .join('');
  return `<testsuites><testsuite name="all">${body}</testsuite></testsuites>\n`;
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/core/test/work.test.ts`:

```ts
// Spec §7-§10 records: plan.md, ledger.md, review.md, and accord/tests-baseline.txt.
import { describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import { parseBaseline, parseLedger, parsePlan, parseReview } from '../src/load/work.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

describe('parsePlan', () => {
  it('reads tasks and their fields, and skips sections that are not tasks', () => {
    const { plan, findings } = parsePlan('p', '# Plan\n\n## Notes\ncovers: @ac-9\n\n' + PLAN);
    expect(findings).toEqual([]);
    expect(plan.tasks.map((t) => [t.n, t.title, t.covers, t.files, t.verify])).toEqual([
      [1, 'Writer csv mode', ['@ac-1', 'D-01'], ['src/export.ts'], ['export#writes-csv']],
      [2, 'Escaping', ['@ac-2'], ['src/export.ts'], ['export#escapes-commas']],
    ]);
  });

  it('takes the first field line, accepts a list marker, and skips fenced lines', () => {
    const text = '## Task 1: A\n```\nverify: fenced#x\n```\n- verify: real#y\nverify: second#z\n';
    expect(parsePlan('p', text).plan.tasks[0].verify).toEqual(['real#y']);
  });

  it('reports a duplicate task number and keeps the first', () => {
    const { plan, findings } = parsePlan('p', '## Task 1: A\n\n## Task 1: B\n');
    expect(plan.tasks.map((t) => t.title)).toEqual(['A']);
    expect(findings).toEqual([
      { file: 'p', line: 3, rule: 'load.task-duplicate', reason: 'duplicate "## Task 1"; the first occurrence is used' },
    ]);
  });

  it('reads CRLF and a BOM the same as LF', () => {
    expect(parsePlan('p', '﻿' + PLAN.replace(/\n/g, '\r\n')).plan).toEqual(parsePlan('p', PLAN).plan);
  });
});

describe('parseLedger, parseReview, parseBaseline', () => {
  it('maps task numbers to the commit of their first done line, and collects Rulings', () => {
    const l = parseLedger(
      'l',
      '## Tasks\n- task 1 done abc1234\n- task 2 done 1234567890\n- task 1 done fffffff\n- task 3 done xyz\n\n## Rulings\n- Ruling: kept the signature — callers — one branch\n',
    );
    expect(l).toEqual({
      file: 'l',
      done: { '1': 'abc1234', '2': '1234567890' },
      rulings: ['Ruling: kept the signature — callers — one branch'],
    });
  });

  it('takes the last verdict line', () => {
    expect(parseReview('r', '## Round 1\nverdict: open\n\n## Round 2\nverdict: converged\n')).toEqual({
      file: 'r',
      verdict: 'converged',
      line: 5,
    });
    expect(parseReview('r', 'no verdict here\n')).toEqual({ file: 'r' });
  });

  it('drops comments and blanks, sorts, and de-duplicates the baseline', () => {
    expect(parseBaseline('# header\nb#2\n\na#1\nb#2\n')).toEqual(['a#1', 'b#2']);
  });
});

describe('loadSnapshot work records', () => {
  const base = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };
  const load = (files: Record<string, string>) => loadSnapshot({ files, tree: Object.keys(files).sort() });

  it('omits work, testsBaseline, and claims when nothing supplies them (D-54)', () => {
    const s = load(base);
    expect('work' in s).toBe(false);
    expect('testsBaseline' in s).toBe(false);
    expect('claims' in s).toBe(false);
  });

  it('keys plan, ledger, and review by ticket folder, and reads the baseline', () => {
    const s = load({
      ...base,
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n',
      'accord/tickets/T-1/review.md': 'verdict: converged\n',
      'accord/tests-baseline.txt': 'old#1\n',
    });
    expect(s.work?.['T-1'].plan?.tasks).toHaveLength(2);
    expect(s.work?.['T-1'].ledger?.done).toEqual({ '1': 'abc1234' });
    expect(s.work?.['T-1'].review?.verdict).toBe('converged');
    expect(s.testsBaseline).toEqual(['old#1']);
  });

  it('reports a work record whose ticket is missing', () => {
    const s = load({ ...base, 'accord/tickets/GONE/plan.md': PLAN });
    expect(s.errors).toContainEqual({
      file: 'accord/tickets/GONE/plan.md',
      rule: 'load.work-orphan',
      reason: 'work record without a ticket: accord/tickets/GONE.md is missing',
    });
  });

  it('carries host claims through', () => {
    expect(loadSnapshot({ files: base, tree: [], claims: { 'T-1': 'a@example.test' } }).claims).toEqual({
      'T-1': 'a@example.test',
    });
  });
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project core work`
Expected: FAIL — `../src/load/work.js` does not exist.

- [ ] **Step 4: Add the model types**

In `packages/core/src/model/snapshot.ts`, add to `SnapshotInput` after `git?`:

```ts
  // Spec §5: host-supplied claims, ticket id -> author of the tip of branch t/<id>. Absent when the host
  // has none, so the D-54 goldens are unchanged.
  claims?: Record<string, string>;
```

Add these interfaces after `Verification`:

```ts
export interface PlanTask {
  n: number; // 3, from '## Task 3: <title>'
  title: string;
  line: number; // Markdown line of the task heading
  covers: string[]; // tokens of the first 'covers:' line: ['@ac-1', 'D-02']
  files: string[]; // tokens of the first 'files:' line
  verify: string[]; // report case ids of the first 'verify:' line
  lines: Line[]; // every line under the heading up to the next '## ' heading, fences included
}

export interface Plan {
  file: string; // 'accord/tickets/LOGIN-1/plan.md'
  tasks: PlanTask[];
}

export interface Ledger {
  file: string; // 'accord/tickets/LOGIN-1/ledger.md'
  done: Record<string, string>; // task number -> commit sha of its first done line
  rulings: string[]; // every 'Ruling: …' line, list marker stripped
}

export interface Review {
  file: string; // 'accord/tickets/LOGIN-1/review.md'
  verdict?: string; // the value of the last 'verdict:' line
  line?: number; // its Markdown line
}

export interface TicketWork {
  plan?: Plan;
  ledger?: Ledger;
  review?: Review;
}
```

Add to `RepoSnapshot` after `git?`:

```ts
  work?: Record<string, TicketWork>; // spec §7-§10, keyed by ticket folder; absent when no record exists
  testsBaseline?: string[]; // spec §9: ids in accord/tests-baseline.txt; absent when the file does not exist
  claims?: Record<string, string>; // carried through from SnapshotInput
```

- [ ] **Step 5: Write the parsers**

Create `packages/core/src/load/work.ts`:

```ts
// Workflow-layer records (docs/specs/2026-10-12-workflow-layer-design.md §7-§10): plan.md, ledger.md,
// review.md under accord/tickets/<id>/, and accord/tests-baseline.txt. Pure string work; every parser
// normalises BOM and CRLF itself (D-38), so every encoding variant parses to one value.
import type { LoadFinding } from '../model/finding.js';
import type { Ledger, Plan, PlanTask, Review } from '../model/snapshot.js';
import { normaliseText } from './frontmatter.js';
import { LIST_MARKER, scan } from './sections.js';

const TASK = /^Task\s+([1-9][0-9]*)\s*:\s*(.*)$/;
const FIELD = /^(covers|files|verify):(.*)$/;
const DONE = /^\s*[-*+]\s+task\s+([1-9][0-9]*)\s+done\s+([0-9a-fA-F]{7,})\s*$/;
const RULING = /^\s*(?:[-*+]\s+)?(Ruling:.*\S)\s*$/;
const VERDICT = /^verdict:\s*(\S+)\s*$/;

type Field = 'covers' | 'files' | 'verify';

/** A field value: tokens separated by whitespace or commas, empty tokens dropped. */
const tokens = (v: string): string[] => v.split(/[\s,]+/).filter((x) => x !== '');

/**
 * One task per `## Task <n>: <title>` section; any other section is prose and is skipped. A field is the
 * first `covers:`, `files:`, or `verify:` line in the section, outside a fence, with an optional list
 * marker. A repeated task number keeps the first section and reports the second.
 */
export function parsePlan(file: string, text: string): { plan: Plan; findings: LoadFinding[] } {
  const { sections, fences } = scan(normaliseText(text), 0);
  const inFence = (n: number) => fences.some((f) => n >= f.open && n <= f.close);
  const findings: LoadFinding[] = [];
  const tasks: PlanTask[] = [];
  for (const s of sections) {
    const m = TASK.exec(s.heading);
    if (!m) continue;
    const n = Number(m[1]);
    if (tasks.some((t) => t.n === n)) {
      findings.push({
        file,
        line: s.line,
        rule: 'load.task-duplicate',
        reason: `duplicate "## Task ${n}"; the first occurrence is used`,
      });
      continue;
    }
    const fields: Partial<Record<Field, string[]>> = {};
    for (const l of s.lines) {
      if (inFence(l.line)) continue;
      const f = FIELD.exec(l.text.replace(LIST_MARKER, '').trim());
      if (f === null) continue;
      const key = f[1] as Field;
      if (fields[key] === undefined) fields[key] = tokens(f[2]);
    }
    tasks.push({
      n,
      title: m[2].trim(),
      line: s.line,
      covers: fields.covers ?? [],
      files: fields.files ?? [],
      verify: fields.verify ?? [],
      lines: s.lines,
    });
  }
  return { plan: { file, tasks }, findings };
}

/** `- task <n> done <sha>` lines, the first per task winning, and every `Ruling:` line, anywhere in the file. */
export function parseLedger(file: string, text: string): Ledger {
  const done: Record<string, string> = {};
  const rulings: string[] = [];
  for (const line of normaliseText(text).split('\n')) {
    const d = DONE.exec(line);
    if (d) {
      if (!Object.hasOwn(done, d[1])) done[d[1]] = d[2];
      continue;
    }
    const r = RULING.exec(line);
    if (r) rulings.push(r[1]);
  }
  return { file, done, rulings };
}

/** The last `verdict:` line decides; a record with none has no verdict. */
export function parseReview(file: string, text: string): Review {
  let review: Review = { file };
  normaliseText(text)
    .split('\n')
    .forEach((line, i) => {
      const m = VERDICT.exec(line.trim());
      if (m) review = { file, verdict: m[1], line: i + 1 };
    });
  return review;
}

/** One report case id per line; blank lines and `#` comments are skipped; sorted and unique. */
export function parseBaseline(text: string): string[] {
  const ids = normaliseText(text)
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l !== '' && !l.startsWith('#'));
  return [...new Set(ids)].sort();
}
```

- [ ] **Step 6: Route the files in the loader**

In `packages/core/src/load/snapshot.ts`:

Add `TicketWork` to the model import list, and add the import:

```ts
import { parseBaseline, parseLedger, parsePlan, parseReview } from './work.js';
```

Add next to the other path patterns:

```ts
const WORK = /^accord\/tickets\/([^/]+)\/(plan|ledger|review)\.md$/;
const BASELINE = 'accord/tests-baseline.txt';
```

After `const verifications: Record<string, Verification> = {};` add:

```ts
  const work: Record<string, TicketWork> = {};
  let testsBaseline: string[] | undefined;
```

In the file loop, add `continue;` as the last statement inside the existing `if (v) { … }` block, then add before the `// D-37` comment:

```ts
    const w = WORK.exec(file);
    if (w) {
      const id = w[1];
      const entry = Object.hasOwn(work, id) ? work[id] : (work[id] = {});
      if (w[2] === 'plan') {
        const r = parsePlan(file, files[file]);
        entry.plan = r.plan;
        errors.push(...r.findings);
      } else if (w[2] === 'ledger') {
        entry.ledger = parseLedger(file, files[file]);
      } else {
        entry.review = parseReview(file, files[file]);
      }
      continue;
    }
    if (file === BASELINE) {
      testsBaseline = parseBaseline(files[file]);
      continue;
    }
```

After the verification-orphan loop add:

```ts
  for (const id of Object.keys(work)) {
    if (Object.hasOwn(tickets, id)) continue;
    for (const record of [work[id].plan, work[id].ledger, work[id].review]) {
      if (record === undefined) continue;
      errors.push({
        file: record.file,
        rule: 'load.work-orphan',
        reason: `work record without a ticket: accord/tickets/${id}.md is missing`,
      });
    }
  }
```

In the returned object, after the `git` spread, add:

```ts
    // Spec §7-§10: spread so a repository with no workflow record keeps its D-54 golden byte-identical.
    ...(Object.keys(work).length === 0 ? {} : { work }),
    ...(testsBaseline === undefined ? {} : { testsBaseline }),
    ...(input.claims === undefined ? {} : { claims: input.claims }),
```

- [ ] **Step 7: Export the types**

In `packages/core/src/index.ts`, add `PlanTask, Plan, Ledger, Review, TicketWork` to the `export type { … } from './model/snapshot.js'` list.

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project core work`
Expected: PASS.

- [ ] **Step 9: Run the core suite**

Run: `npx vitest run --project core`
Expected: PASS, no golden change.

- [ ] **Step 10: Commit**

```bash
git add test/helpers/lane.ts packages/core/src packages/core/test/work.test.ts
git commit -m "feat(load): read plan, ledger, review records and the tests baseline into the snapshot"
```

---

### Task 3: The approval hash

**Files:**
- Modify: `packages/core/src/gate/hash.ts`
- Create: `packages/core/test/helpers/approve.ts`
- Modify: `packages/core/src/index.ts`
- Test: `packages/core/test/hash.test.ts`

**Interfaces:**
- Consumes: `Ticket`, `hashInput` (existing).
- Produces: `fnv1a64(input: string): string`, `APPROVED_SECTIONS`, `approvedInput(ticket: Ticket): string`, `approvedHash(ticket: Ticket): string` (exported from the core index). Test helper `approved(files, id): Record<string, string>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/hash.test.ts` (add the imports at the top of the file, merging with existing ones):

```ts
import { loadSnapshot } from '../src/index.js';
import { approvedHash, fnv1a64 } from '../src/gate/hash.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

describe('approvedHash (spec §4)', () => {
  const ticketOf = (text: string) =>
    loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': text }, tree: [] }).tickets['T-1'];
  const base = ticketOf(laneTicket('T-1'));

  it('is fnv1a64-prefixed and stable', () => {
    expect(approvedHash(base)).toMatch(/^fnv1a64:[0-9a-f]{16}$/);
    expect(approvedHash(ticketOf(laneTicket('T-1')))).toBe(approvedHash(base));
  });

  it.each([
    ['Intent', 'Owners can export their report as CSV.', 'Owners can export as TSV.'],
    ['Vetoes', '- No new dependency.', '- No new file.'],
    ['Decisions', '- D-01 Use the existing writer', '- D-01 Write a new writer'],
    ['Approach', 'Extend the existing report writer with a csv mode.', 'Rewrite the writer.'],
    ['Acceptance criteria', 'Then a csv file is written', 'Then a tsv file is written'],
  ])('moves when %s changes', (_section, from, to) => {
    expect(approvedHash(ticketOf(laneTicket('T-1').replace(from, to)))).not.toBe(approvedHash(base));
  });

  it('moves when a correction is appended', () => {
    const text = laneTicket('T-1').replace('## Corrections\n', '## Corrections\n- "no, CSV only"\n');
    expect(approvedHash(ticketOf(text))).not.toBe(approvedHash(base));
  });

  it('ignores comments, blank lines, indentation, @test tags, and Open questions', () => {
    const text = laneTicket('T-1')
      .replace('## Approach\n', '## Approach\n<!-- guidance -->\n\n   ')
      .replace('@ac-1 @test:export#writes-csv', '@ac-1 @test:export#renamed')
      .replace('- [x] Delimiter? Comma.', '- [x] Delimiter? Semicolon.');
    expect(approvedHash(ticketOf(text))).toBe(approvedHash(base));
  });

  it('fnv1a64 of the empty string is the FNV offset basis', () => {
    expect(fnv1a64('')).toBe('fnv1a64:cbf29ce484222325');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project core hash`
Expected: FAIL — `approvedHash` and `fnv1a64` are not exported.

- [ ] **Step 3: Implement**

In `packages/core/src/gate/hash.ts`, replace the body of `acHash` and add the new functions. The file becomes (header comment kept, imports extended):

```ts
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { ScenarioRef, Ticket } from '../model/snapshot.js';

type Tagged = ScenarioRef & { acTag: string };
const tagged = (s: ScenarioRef): s is Tagged => s.acTag !== undefined;

// U+0000 cannot occur in Markdown source, so the join is injective: no step text can impersonate a
// tag field, and no two different criteria sets share an input string (T-04-02).
const SEP = '\u0000';
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

/** FNV-1a 64-bit over the UTF-8 bytes of `input`, written `fnv1a64:<16 lowercase hex>` (D-75). */
export function fnv1a64(input: string): string {
  let h = OFFSET;
  for (const byte of new TextEncoder().encode(input)) h = ((h ^ BigInt(byte)) * PRIME) & MASK;
  return 'fnv1a64:' + h.toString(16).padStart(16, '0');
}

/**
 * D-77: per scenario carrying an `@ac-n` tag, the bare tag then that scenario's steps, sorted by the
 * numeric part of the tag. Every other tag stays outside, so a `@test:` added after Ready does not
 * move the hash (D-69). Exported for the unit test; the gate calls `acHash`.
 */
export function hashInput(scenarios: readonly ScenarioRef[]): string {
  return scenarios
    .filter(tagged) // a new array, so the caller's order is never disturbed
    // Two scenarios with the same tag keep document order; lint.ac-tag-duplicate has already failed Ready.
    .sort((a, b) => Number(a.acTag.slice(3)) - Number(b.acTag.slice(3)))
    .flatMap((s) => [s.acTag, ...s.steps])
    .join(SEP);
}

/** D-75: `fnv1a64:` plus 16 lowercase hex digits, or undefined when no scenario carries an `@ac-n` tag. */
export function acHash(scenarios: readonly ScenarioRef[]): string | undefined {
  if (!scenarios.some(tagged)) return undefined;
  return fnv1a64(hashInput(scenarios));
}

/** Spec §4: the owner-approved sections, in a fixed order. Open questions is not one of them. */
export const APPROVED_SECTIONS = ['intent', 'acceptance criteria', 'vetoes', 'decisions', 'corrections', 'approach'] as const;

/**
 * Each approved section as its key, its line count, then its non-blank lines, comment-stripped and
 * trimmed. Acceptance criteria use `hashInput`, so a `@test:` tag added during build never stales an
 * approval, exactly as it never stales `ac_hash`. The count keeps the join injective across sections.
 */
export function approvedInput(ticket: Ticket): string {
  return APPROVED_SECTIONS.flatMap((key) => {
    if (key === 'acceptance criteria') return [key, hashInput(ticket.scenarios)];
    const s = ticket.sections.find((x) => headingKey(x.heading) === key);
    const lines =
      s === undefined
        ? []
        : stripHtmlComments(s.lines)
            .map((l) => l.text.trim())
            .filter((t) => t !== '');
    return [key, String(lines.length), ...lines];
  }).join(SEP);
}

/** Spec §4: recorded by `accord approve`; Ready fails when the ticket no longer hashes to it. */
export function approvedHash(ticket: Ticket): string {
  return fnv1a64(approvedInput(ticket));
}
```

In `packages/core/src/index.ts` add:

```ts
export { approvedHash } from './gate/hash.js';
```

- [ ] **Step 4: Add the test helper**

Create `packages/core/test/helpers/approve.ts`:

```ts
// Records approved_hash the way `accord approve` does, so a test can start from an approved lane ticket.
import { loadSnapshot, setFrontmatterKey } from '../../src/index.js';
import { approvedHash } from '../../src/gate/hash.js';

export function approved(files: Record<string, string>, id: string): Record<string, string> {
  const path = 'accord/tickets/' + id + '.md';
  const ticket = loadSnapshot({ files, tree: [] }).tickets[id];
  return { ...files, [path]: setFrontmatterKey(files[path], 'approved_hash', approvedHash(ticket)) };
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run --project core hash`
Expected: PASS, including the existing `acHash` tests (the digest is unchanged).

- [ ] **Step 6: Run the core suite**

Run: `npx vitest run --project core`
Expected: PASS, no golden change.

- [ ] **Step 7: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(gate): approval hash over the owner-approved ticket sections"
```

---

### Task 4: Lint lane headings and dependencies

**Files:**
- Modify: `packages/core/src/load/sections.ts`
- Modify: `packages/core/src/lint/ticket.ts`
- Create: `packages/core/src/lint/depends.ts`
- Modify: `packages/core/src/lint/rules.ts`
- Test: `packages/core/test/lane-lint.test.ts`

**Interfaces:**
- Produces: rule ids `lint.depends-unknown` (error), `lint.depends-cycle` (error); lane heading table used by `lint.heading-missing`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/lane-lint.test.ts`:

```ts
// Spec §4 lane headings and §5 dependencies.
import { describe, expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot } from '../src/index.js';
import { CONFIG, LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';

const load = (files: Record<string, string>) => loadSnapshot({ files, tree: Object.keys(files).sort() });
const rules = (files: Record<string, string>, rule: string) =>
  lintSnapshot(load(files)).findings.filter((f) => f.rule === rule);
const repo = (tickets: Record<string, string>) => ({
  'accord/config.yml': CONFIG,
  ...Object.fromEntries(Object.entries(tickets).map(([id, text]) => ['accord/tickets/' + id + '.md', text])),
});

describe('lane ticket headings (spec §4)', () => {
  it('a lane story needs the lane headings and neither Requirements nor Plan', () => {
    expect(rules(repo({ 'T-1': laneTicket('T-1') }), 'lint.heading-missing')).toEqual([]);
  });

  it('names each missing lane heading', () => {
    const body = LANE_BODY.replace('## Vetoes\n- No new dependency.\n\n', '').replace(/## Approach\n.*\n/, '');
    expect(rules(repo({ 'T-1': laneTicket('T-1', { body }) }), 'lint.heading-missing').map((f) => f.reason)).toEqual([
      'missing "## Approach"',
      'missing "## Vetoes"',
    ]);
  });

  it('a ticket without lane keeps the 0.1.0 headings', () => {
    expect(
      rules(repo({ 'T-1': laneTicket('T-1', { lane: '' }) }), 'lint.heading-missing').map((f) => f.reason),
    ).toEqual(['missing "## Plan"', 'missing "## Requirements"']);
  });

  it('a duplicate lane heading is load.heading-duplicate', () => {
    const s = load(repo({ 'T-1': laneTicket('T-1', { body: LANE_BODY + '## Approach\nagain\n' }) }));
    expect(s.errors.map((e) => e.rule)).toContain('load.heading-duplicate');
  });
});

describe('depends_on (spec §5)', () => {
  const t = (id: string, deps: string[]) =>
    laneTicket(id, { frontmatter: [`depends_on: [${deps.map((d) => `"${d}"`).join(', ')}]`] });

  it('names an unknown id by pointer', () => {
    expect(rules(repo({ A: t('A', ['B', 'NOPE']), B: t('B', []) }), 'lint.depends-unknown')).toEqual([
      {
        file: 'accord/tickets/A.md',
        pointer: '/depends_on/1',
        rule: 'lint.depends-unknown',
        level: 'error',
        reason: 'depends_on names "NOPE", which is not a ticket in accord/tickets/',
      },
    ]);
  });

  it('reports a cycle once, on its smallest member', () => {
    const files = repo({ A: t('A', ['B']), B: t('B', ['C']), C: t('C', ['A']), D: t('D', ['A']) });
    expect(rules(files, 'lint.depends-cycle')).toEqual([
      {
        file: 'accord/tickets/A.md',
        pointer: '/depends_on',
        rule: 'lint.depends-cycle',
        level: 'error',
        reason: 'depends_on forms a cycle among A, B, C',
      },
    ]);
  });

  it('a self-dependency is a cycle', () => {
    expect(rules(repo({ A: t('A', ['A']) }), 'lint.depends-cycle').map((f) => f.reason)).toEqual([
      'depends_on forms a cycle among A',
    ]);
  });

  it('an acyclic graph is silent', () => {
    const files = repo({ A: t('A', ['B', 'C']), B: t('B', ['C']), C: t('C', []) });
    expect(rules(files, 'lint.depends-cycle')).toEqual([]);
    expect(rules(files, 'lint.depends-unknown')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project core lane-lint`
Expected: FAIL — lane headings are reported missing as 0.1.0 headings, and the depends rules do not exist.

- [ ] **Step 3: Extend the duplicate-heading set**

In `packages/core/src/load/sections.ts`, replace the `D07_KEYS` line and its doc comment:

```ts
// The five D-07 headings plus the four lane headings of spec §4; a second occurrence of any is load.heading-duplicate.
const D07_KEYS = new Set([
  'intent', 'requirements', 'acceptance criteria', 'open questions', 'plan',
  'vetoes', 'decisions', 'corrections', 'approach',
]);

/** Identity for ticket sections: a tracked heading, or undefined when untracked. */
```

- [ ] **Step 4: Pick the heading table by lane**

In `packages/core/src/lint/ticket.ts`, add below `REQUIRED`:

```ts
// Spec §4: a ticket with `lane:` drops Requirements and Plan and adds the four owner sections.
const LANE_REQUIRED: Record<'story' | 'bug' | 'epic', string[]> = {
  story: ['Intent', 'Acceptance criteria', 'Vetoes', 'Decisions', 'Corrections', 'Open questions', 'Approach'],
  bug: ['Intent', 'Acceptance criteria', 'Vetoes', 'Decisions', 'Corrections', 'Open questions', 'Approach'],
  epic: ['Intent', 'Vetoes', 'Decisions', 'Corrections', 'Open questions', 'Approach'],
};
```

and in `headingMissing` replace `REQUIRED[t.frontmatter.type]` with:

```ts
    (t.frontmatter.lane === undefined ? REQUIRED : LANE_REQUIRED)[t.frontmatter.type]
```

- [ ] **Step 5: Write the dependency rules**

Create `packages/core/src/lint/depends.ts`:

```ts
// Spec §5: depends_on names tickets in this snapshot and never forms a cycle. Levels live in rules.ts.
import type { RepoSnapshot } from '../model/snapshot.js';
import type { Draft, Rule } from './rules.js';

/** The ids `id` depends on that exist in the snapshot. */
const known = (snapshot: RepoSnapshot, id: string): string[] =>
  (snapshot.tickets[id].frontmatter?.depends_on ?? []).filter((d) => Object.hasOwn(snapshot.tickets, d));

/** One finding per id that names no ticket, at its array pointer. */
export const dependsUnknown: Rule['check'] = (snapshot) =>
  Object.values(snapshot.tickets).flatMap((t) =>
    (t.frontmatter?.depends_on ?? [])
      .map((d, i) => ({ d, i }))
      .filter(({ d }) => !Object.hasOwn(snapshot.tickets, d))
      .map(({ d, i }) => ({
        file: t.file,
        pointer: `/depends_on/${i}`,
        reason: `depends_on names "${d}", which is not a ticket in accord/tickets/`,
      })),
  );

/**
 * Tarjan's strongly connected components over the known edges. A component of two or more tickets, or
 * one ticket that depends on itself, is a cycle; it is reported once, on its smallest id in code-point
 * order, so the finding does not depend on the order tickets were loaded.
 */
export const dependsCycle: Rule['check'] = (snapshot) => {
  const index = new Map<string, number>();
  const low = new Map<string, number>();
  const stack: string[] = [];
  const onStack = new Set<string>();
  const out: Draft[] = [];
  let counter = 0;

  const visit = (v: string): void => {
    index.set(v, counter);
    low.set(v, counter);
    counter++;
    stack.push(v);
    onStack.add(v);
    for (const w of known(snapshot, v)) {
      if (!index.has(w)) {
        visit(w);
        low.set(v, Math.min(low.get(v) ?? 0, low.get(w) ?? 0));
      } else if (onStack.has(w)) {
        low.set(v, Math.min(low.get(v) ?? 0, index.get(w) ?? 0));
      }
    }
    if (low.get(v) !== index.get(v)) return;
    const component: string[] = [];
    let w: string | undefined;
    do {
      w = stack.pop();
      if (w === undefined) break;
      onStack.delete(w);
      component.push(w);
    } while (w !== v);
    if (component.length > 1 || known(snapshot, v).includes(v)) {
      component.sort();
      out.push({
        file: snapshot.tickets[component[0]].file,
        pointer: '/depends_on',
        reason: `depends_on forms a cycle among ${component.join(', ')}`,
      });
    }
  };

  for (const id of Object.keys(snapshot.tickets).sort()) if (!index.has(id)) visit(id);
  return out;
};
```

- [ ] **Step 6: Register the rules**

In `packages/core/src/lint/rules.ts`, import `{ dependsCycle, dependsUnknown } from './depends.js'` and add to `RULES` after `lint.id-mismatch`:

```ts
  { id: 'lint.depends-unknown', level: 'error', profiles: ['build', 'maintain'], check: dependsUnknown },
  { id: 'lint.depends-cycle', level: 'error', profiles: ['build', 'maintain'], check: dependsCycle },
```

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project core lane-lint`
Expected: PASS.

- [ ] **Step 8: Run the core suite**

Run: `npx vitest run --project core`
Expected: PASS, no golden change. If a golden moves because an existing fixture repeats `## Approach`, `## Decisions`, `## Vetoes`, or `## Corrections`, stop and report it rather than regenerating.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src packages/core/test/lane-lint.test.ts
git commit -m "feat(lint): lane headings, unknown dependencies, and dependency cycles"
```

---

### Task 5: Lane rules at Ready

**Files:**
- Modify: `packages/core/src/gate/ready.ts`
- Modify: `packages/core/src/gate/rules.ts`
- Test: `packages/core/test/lane-ready.test.ts`

**Interfaces:**
- Consumes: `approvedHash` (Task 3), test helper `approved` (Task 3).
- Produces: rule ids `gate.approach-empty`, `gate.approval-missing`, `gate.approval-stale` (errors, both profiles); `gate.ears-missing` silent on lane tickets.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/lane-ready.test.ts`:

```ts
// Spec §4, §7: a lane ticket reaches Ready through the owner's approval, not through EARS lines.
import { describe, expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import { gateReady } from '../src/gate/index.js';
import type { GateResult } from '../src/gate/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';

const files = (text = laneTicket('T-1')) => ({
  'accord/config.yml': CONFIG,
  'accord/tickets/T-1.md': text,
  [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
});
const ready = (f: Record<string, string>) => gateReady(loadSnapshot({ files: f, tree: Object.keys(f).sort() }), 'T-1');
const errors = (r: GateResult) => r.findings.filter((x) => x.level === 'error').map((x) => x.rule);

describe('Ready for lane tickets', () => {
  it('an approved lane ticket passes with no EARS line', () => {
    const r = ready(approved(files(), 'T-1'));
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('an unapproved lane ticket fails on gate.approval-missing', () => {
    expect(errors(ready(files()))).toEqual(['gate.approval-missing']);
  });

  it('an edit after approval fails on gate.approval-stale', () => {
    const f = approved(files(), 'T-1');
    f['accord/tickets/T-1.md'] = f['accord/tickets/T-1.md'].replace('csv mode', 'tsv mode');
    const r = ready(f);
    expect(errors(r)).toEqual(['gate.approval-stale']);
    expect(r.findings.find((x) => x.rule === 'gate.approval-stale')?.reason).toMatch(
      /^the approved sections changed since approval: approved_hash records fnv1a64:[0-9a-f]{16}, they hash to fnv1a64:[0-9a-f]{16} now; the owner must approve again$/,
    );
  });

  it('an empty Approach fails on gate.approach-empty', () => {
    const text = laneTicket('T-1').replace('Extend the existing report writer with a csv mode.', '<!-- empty -->');
    expect(errors(ready(approved(files(text), 'T-1')))).toEqual(['gate.approach-empty']);
  });

  it('a ticket without lane keeps gate.ears-missing and has no approval rule', () => {
    const r = ready(files(laneTicket('T-1', { lane: '', body: LANE_BODY + '## Requirements\n\n## Plan\n' })));
    expect(errors(r)).toContain('gate.ears-missing');
    expect(errors(r)).not.toContain('gate.approval-missing');
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project core lane-ready`
Expected: FAIL — `gate.ears-missing` fires on the lane ticket and the approval rules do not exist.

- [ ] **Step 3: Implement the rules**

In `packages/core/src/gate/ready.ts`, add the import `import { approvedHash } from './hash.js';` and a helper after `section`:

```ts
/** Spec §3: the key that opts a ticket into the workflow-layer contract. */
const laneOf = (snapshot: RepoSnapshot, id: string) => ticketOf(snapshot, id)?.frontmatter?.lane;
```

At the top of `earsMissing`'s body add:

```ts
  // Spec §4: a lane ticket has no Requirements section to hold EARS lines.
  if (laneOf(snapshot, id) !== undefined) return [];
```

Append:

```ts
/** Spec §7: the owner approves an approach, so an empty one cannot be approved meaningfully. */
export const approachEmpty: GateRule['check'] = (snapshot, id) => {
  if (laneOf(snapshot, id) === undefined) return [];
  const s = section(snapshot, id, 'approach');
  if (s === undefined) return []; // lint.heading-missing owns the absent heading
  if (stripHtmlComments(s.lines).some((l) => l.text.trim() !== '')) return [];
  return [{ file: ticketFile(id), line: s.line, reason: '"## Approach" is empty; the owner approves an approach' }];
};

/** Spec §4: no approval recorded. */
export const approvalMissing: GateRule['check'] = (snapshot, id) => {
  const fm = ticketOf(snapshot, id)?.frontmatter;
  if (fm?.lane === undefined || fm.approved_hash !== undefined) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/approved_hash',
      reason: 'the owner has not approved this ticket; run accord approve ' + id + ' after the owner says yes',
    },
  ];
};

/** Spec §4: exact comparison, prefix included, as `gate.ac-changed` does (D-75). */
export const approvalStale: GateRule['check'] = (snapshot, id) => {
  const ticket = ticketOf(snapshot, id);
  const recorded = ticket?.frontmatter?.approved_hash;
  if (ticket === undefined || ticket.frontmatter?.lane === undefined || recorded === undefined) return [];
  const now = approvedHash(ticket);
  if (recorded === now) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/approved_hash',
      reason: `the approved sections changed since approval: approved_hash records ${recorded}, they hash to ${now} now; the owner must approve again`,
    },
  ];
};
```

In `packages/core/src/gate/rules.ts`, extend the `./ready.js` import with `approachEmpty, approvalMissing, approvalStale` and append to `READY_RULES`:

```ts
  { id: 'gate.approach-empty', level: 'error', profiles: ['build', 'maintain'], check: approachEmpty },
  { id: 'gate.approval-missing', level: 'error', profiles: ['build', 'maintain'], check: approvalMissing },
  { id: 'gate.approval-stale', level: 'error', profiles: ['build', 'maintain'], check: approvalStale },
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project core lane-ready`
Expected: PASS.

- [ ] **Step 5: Run the core suite**

Run: `npx vitest run --project core`
Expected: PASS, no golden change. `gate.test.ts` asserts the rule tables; if it lists `READY_RULES` ids explicitly, add the three new ids to that list in the same table order.

- [ ] **Step 6: Commit**

```bash
git add packages/core/src packages/core/test
git commit -m "feat(gate): Ready requires the owner's approval for lane tickets"
```

---

### Task 6: The plan gate

**Files:**
- Create: `packages/core/src/gate/work.ts`
- Create: `packages/core/src/gate/plan.ts`
- Modify: `packages/core/src/gate/rules.ts`, `packages/core/src/gate/index.ts`, `packages/core/src/index.ts`
- Modify: `packages/cli/src/commands/gate.ts`, `packages/cli/src/run.ts`
- Test: `packages/core/test/lane-plan.test.ts`

**Interfaces:**
- Consumes: `snapshot.work` (Task 2), `approved` helper (Task 3).
- Produces: in `gate/work.ts`: `planFile(id)`, `ledgerFile(id)`, `reviewFile(id)`, `VERDICTS`, `workOf(snapshot, id): TicketWork | undefined`, `laneTicket(snapshot, id): Ticket | undefined`. In `gate/plan.ts`: `decisionIds(ticket): string[]` and the plan checks. `gatePlan(snapshot, id): GateResult` exported from core; `GateResult.gate: 'ready' | 'plan' | 'done'`. CLI `accord gate plan <id>`. Rule ids: `gate.lane-missing`, `gate.plan-missing`, `gate.plan-empty`, `gate.task-covers-missing`, `gate.task-verify-missing`, `gate.plan-ac-uncovered`, `gate.plan-decision-uncited`, `gate.plan-ref-unknown`, `gate.plan-deferral`.

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/lane-plan.test.ts`:

```ts
// Spec §7: the plan covers every criterion and decision and defers nothing.
import { describe, expect, it } from 'vitest';
import { gatePlan, loadSnapshot } from '../src/index.js';
import type { GateResult } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, LANE_BODY, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

const base = (text = laneTicket('T-1')) =>
  approved(
    {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': text,
      [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    },
    'T-1',
  );
const plan = (f: Record<string, string>, text?: string, id = 'T-1') => {
  const files = text === undefined ? f : { ...f, 'accord/tickets/T-1/plan.md': text };
  return gatePlan(loadSnapshot({ files, tree: Object.keys(files).sort() }), id);
};
const errors = (r: GateResult) => r.findings.filter((f) => f.level === 'error').map((f) => f.rule);

describe('gate plan', () => {
  it('a plan covering every criterion and decision passes', () => {
    const r = plan(base(), PLAN);
    expect(r.gate).toBe('plan');
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('no plan fails on gate.plan-missing', () => {
    expect(errors(plan(base()))).toEqual(['gate.plan-missing']);
  });

  it('a plan with no task fails on gate.plan-empty', () => {
    expect(errors(plan(base(), '# Plan\n'))).toEqual(['gate.plan-empty']);
  });

  it('names an uncovered criterion and an uncited decision', () => {
    const text = PLAN.replace('covers: @ac-1, D-01', 'covers: @ac-1').replace('covers: @ac-2', 'covers: @ac-1');
    expect(plan(base(), text).findings.filter((f) => f.level === 'error').map((f) => [f.rule, f.reason])).toEqual([
      ['gate.plan-ac-uncovered', '@ac-2 is covered by no task'],
      ['gate.plan-decision-uncited', 'D-01 is cited by no task'],
    ]);
  });

  it('names a task without covers or verify at its line', () => {
    const r = plan(base(), '## Task 1: A\nfiles: x.ts\n');
    expect(errors(r)).toEqual(
      expect.arrayContaining(['gate.task-covers-missing', 'gate.task-verify-missing']),
    );
    expect(r.findings.find((f) => f.rule === 'gate.task-verify-missing')?.line).toBe(1);
  });

  it('names covers entries the ticket does not hold', () => {
    const r = plan(base(), PLAN.replace('covers: @ac-2', 'covers: @ac-2, @ac-9, D-07, banana'));
    expect(r.findings.filter((f) => f.rule === 'gate.plan-ref-unknown').map((f) => f.reason)).toEqual([
      'task 2 covers "@ac-9", which is not a criterion or decision of T-1',
      'task 2 covers "D-07", which is not a criterion or decision of T-1',
      'task 2 covers "banana", which is not a criterion or decision of T-1',
    ]);
  });

  it.each(['TODO', 'TBD', 'placeholder', 'v1', 'for now', 'later'])('the deferral word %s fails the plan', (word) => {
    const r = plan(base(), PLAN.replace('Quote cells that contain a comma.', `Quote cells, ${word}.`));
    expect(errors(r)).toEqual(['gate.plan-deferral']);
  });

  it('v10 and "laterally" are not deferrals', () => {
    expect(errors(plan(base(), PLAN.replace('Quote cells that contain a comma.', 'Use v10 laterally.')))).toEqual([]);
  });

  it('a ticket without lane fails on gate.lane-missing', () => {
    const f = base(laneTicket('T-1', { lane: '', body: LANE_BODY + '## Requirements\n\n## Plan\n' }));
    expect(errors(plan(f, PLAN))).toContain('gate.lane-missing');
  });

  it('an unknown ticket fails on gate.ticket-unknown alone', () => {
    expect(errors(plan(base(), PLAN, 'NOPE'))).toEqual(['gate.ticket-unknown']);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project core lane-plan`
Expected: FAIL — `gatePlan` is not exported.

- [ ] **Step 3: Write the record helpers**

Create `packages/core/src/gate/work.ts`:

```ts
// Spec §7-§11: the lane-ticket records under accord/tickets/<id>/ and the rules that read them. Every path
// is built from the snapshot's own ticket id, so no absolute path and no backslash reaches a reason (D-51).
import type { RepoSnapshot, Ticket, TicketWork } from '../model/snapshot.js';

export const planFile = (id: string): string => 'accord/tickets/' + id + '/plan.md';
export const ledgerFile = (id: string): string => 'accord/tickets/' + id + '/ledger.md';
export const reviewFile = (id: string): string => 'accord/tickets/' + id + '/review.md';

/** Spec §10: the two review verdicts Done accepts. */
export const VERDICTS: readonly string[] = ['converged', 'accepted-by-owner'];

/** `Object.hasOwn`, never `in`: the id is caller-supplied. */
export const workOf = (snapshot: RepoSnapshot, id: string): TicketWork | undefined =>
  snapshot.work !== undefined && Object.hasOwn(snapshot.work, id) ? snapshot.work[id] : undefined;

/** The ticket when it exists and carries `lane:`; every workflow-layer rule is silent otherwise. */
export const laneTicket = (snapshot: RepoSnapshot, id: string): Ticket | undefined => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  return t?.frontmatter?.lane === undefined ? undefined : t;
};
```

- [ ] **Step 4: Write the plan checks**

Create `packages/core/src/gate/plan.ts`:

```ts
// Spec §7 plan gate: the plan of an approved lane ticket covers every criterion and decision and defers
// nothing. Mechanical only — whether the plan is good is the critic's question; this gate answers whether
// it is complete. Levels live in rules.ts (D-57).
import { headingKey, LIST_MARKER, stripHtmlComments } from '../load/sections.js';
import type { PlanTask, RepoSnapshot, Ticket } from '../model/snapshot.js';
import type { GateRule } from './rules.js';
import { laneTicket, planFile, workOf } from './work.js';

const DECISION = /^(D-[0-9]+)\b/;
// Letter-or-digit boundaries on both sides: `v10` and `laterally` are not deferrals, `v1.` and `later.` are.
const DEFERRAL = /(?<![\p{L}\p{N}])(TODO|TBD|placeholder|v1|for now|later)(?![\p{L}\p{N}])/iu;

/** `D-nn` at the start of a line under `## Decisions`, list marker and comments stripped; unique, in order. */
export function decisionIds(t: Ticket): string[] {
  const s = t.sections.find((x) => headingKey(x.heading) === 'decisions');
  if (s === undefined) return [];
  const ids = stripHtmlComments(s.lines).flatMap((l) => {
    const m = DECISION.exec(l.text.replace(LIST_MARKER, '').trim());
    return m ? [m[1]] : [];
  });
  return [...new Set(ids)];
}

const acTags = (t: Ticket): string[] => [
  ...new Set(t.scenarios.flatMap((s) => (s.acTag === undefined ? [] : ['@' + s.acTag]))),
];
const tasksOf = (snapshot: RepoSnapshot, id: string): PlanTask[] =>
  laneTicket(snapshot, id) === undefined ? [] : (workOf(snapshot, id)?.plan?.tasks ?? []);

/** The plan gate exists only for lane tickets; a 0.1.0 ticket keeps its `## Plan` section and lint rules. */
export const laneMissing: GateRule['check'] = (snapshot, id) => {
  const t = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
  if (t?.frontmatter === undefined || t.frontmatter.lane !== undefined) return [];
  return [{ file: t.file, pointer: '/lane', reason: 'gate plan applies to lane tickets; this ticket has no lane:' }];
};

export const planMissing: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined || workOf(snapshot, id)?.plan !== undefined) return [];
  return [{ file: planFile(id), reason: 'no plan; write ' + planFile(id) }];
};

export const planEmpty: GateRule['check'] = (snapshot, id) => {
  const plan = laneTicket(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.plan;
  if (plan === undefined || plan.tasks.length > 0) return [];
  return [{ file: plan.file, reason: 'the plan has no "## Task <n>: <title>" section' }];
};

export const taskCoversMissing: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id)
    .filter((t) => t.covers.length === 0)
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no covers: line naming the criteria and decisions it serves`,
    }));

export const taskVerifyMissing: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id)
    .filter((t) => t.verify.length === 0)
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no verify: line naming the report cases that prove it`,
    }));

export const acUncovered: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const tasks = tasksOf(snapshot, id);
  if (t === undefined || tasks.length === 0) return []; // planMissing and planEmpty own those cases
  const covered = new Set(tasks.flatMap((x) => x.covers));
  return acTags(t)
    .filter((a) => !covered.has(a))
    .map((a) => ({ file: planFile(id), reason: `${a} is covered by no task` }));
};

export const decisionUncited: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  const tasks = tasksOf(snapshot, id);
  if (t === undefined || tasks.length === 0) return [];
  const covered = new Set(tasks.flatMap((x) => x.covers));
  return decisionIds(t)
    .filter((d) => !covered.has(d))
    .map((d) => ({ file: planFile(id), reason: `${d} is cited by no task` }));
};

export const refUnknown: GateRule['check'] = (snapshot, id) => {
  const t = laneTicket(snapshot, id);
  if (t === undefined) return [];
  const known = new Set([...acTags(t), ...decisionIds(t)]);
  return tasksOf(snapshot, id).flatMap((x) =>
    x.covers
      .filter((c) => !known.has(c))
      .map((c) => ({
        file: planFile(id),
        line: x.line,
        reason: `task ${x.n} covers "${c}", which is not a criterion or decision of ${id}`,
      })),
  );
};

/** Spec §7: one finding per line, title included, naming the first deferral word on it. */
export const deferral: GateRule['check'] = (snapshot, id) =>
  tasksOf(snapshot, id).flatMap((x) =>
    [{ line: x.line, text: x.title }, ...stripHtmlComments(x.lines)].flatMap((l) => {
      const m = DEFERRAL.exec(l.text);
      return m ? [{ file: planFile(id), line: l.line, reason: `task ${x.n} defers work: "${m[1]}"` }] : [];
    }),
  );
```

- [ ] **Step 5: Add the gate table and entry point**

In `packages/core/src/gate/rules.ts`, import the nine checks from `./plan.js` and add after `READY_RULES`:

```ts
/** Spec §7: the plan gate. Every row is an error: an incomplete plan never reaches an executor. */
export const PLAN_RULES: readonly GateRule[] = [
  TICKET_UNKNOWN,
  { id: 'gate.lane-missing', level: 'error', profiles: ['build', 'maintain'], check: laneMissing },
  { id: 'gate.plan-missing', level: 'error', profiles: ['build', 'maintain'], check: planMissing },
  { id: 'gate.plan-empty', level: 'error', profiles: ['build', 'maintain'], check: planEmpty },
  { id: 'gate.task-covers-missing', level: 'error', profiles: ['build', 'maintain'], check: taskCoversMissing },
  { id: 'gate.task-verify-missing', level: 'error', profiles: ['build', 'maintain'], check: taskVerifyMissing },
  { id: 'gate.plan-ac-uncovered', level: 'error', profiles: ['build', 'maintain'], check: acUncovered },
  { id: 'gate.plan-decision-uncited', level: 'error', profiles: ['build', 'maintain'], check: decisionUncited },
  { id: 'gate.plan-ref-unknown', level: 'error', profiles: ['build', 'maintain'], check: refUnknown },
  { id: 'gate.plan-deferral', level: 'error', profiles: ['build', 'maintain'], check: deferral },
];
```

In `packages/core/src/gate/index.ts`: change `gate: 'ready' | 'done';` to `gate: 'ready' | 'plan' | 'done';`, import `PLAN_RULES`, and add:

```ts
/** Spec §7: the plan gate plus the ticket-scoped lint findings, which include load findings on plan.md. */
export function gatePlan(snapshot: RepoSnapshot, id: string): GateResult {
  return run('plan', PLAN_RULES, [], snapshot, id);
}
```

In `packages/core/src/index.ts` change the gate export to `export { gateDone, gatePlan, gateReady } from './gate/index.js';`.

- [ ] **Step 6: Wire the CLI**

In `packages/cli/src/commands/gate.ts`: import `gatePlan`; change the parameter to `which: 'ready' | 'plan' | 'done'`; and replace the result line with:

```ts
  const result =
    which === 'ready' ? gateReady(ctx.snapshot, id) : which === 'plan' ? gatePlan(ctx.snapshot, id) : gateDone(ctx.snapshot, id);
```

In `packages/cli/src/run.ts` change `for (const which of ['ready', 'done'] as const)` to `for (const which of ['ready', 'plan', 'done'] as const)`.

- [ ] **Step 7: Run the tests to verify they pass**

Run: `npx vitest run --project core lane-plan`
Expected: PASS.

- [ ] **Step 8: Run both suites**

Run: `npx vitest run`
Expected: PASS, no golden change. `packages/cli/test/skill-commands.test.ts` walks the commander tree, so it sees `gate plan` without edits.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src packages/core/test/lane-plan.test.ts packages/cli/src
git commit -m "feat(gate): plan gate — every criterion covered, every decision cited, nothing deferred"
```

---

### Task 7: Lane rules at Done, and the traced-test policy

**Files:**
- Create: `packages/core/src/lint/tests.ts`
- Modify: `packages/core/src/gate/work.ts`, `packages/core/src/gate/done.ts`, `packages/core/src/gate/refs.ts`, `packages/core/src/gate/rules.ts`, `packages/core/src/lint/rules.ts`
- Test: `packages/core/test/lane-done.test.ts`

**Interfaces:**
- Consumes: `workOf`, `laneTicket`, `VERDICTS`, `planFile`, `ledgerFile`, `reviewFile` (Task 6).
- Produces: `untracedTests(snapshot): string[]` and `UNTRACED(id): string` in `lint/tests.ts`; exported `reportLoaded`, `reportPath` from `gate/done.ts`; rule ids `lint.test-untraced` (warning), `gate.task-incomplete`, `gate.review-missing`, `gate.review-unconverged`, `gate.suite-not-passed`, `gate.test-untraced` (errors).

- [ ] **Step 1: Write the failing tests**

Create `packages/core/test/lane-done.test.ts`:

```ts
// Spec §8-§11: Done for a lane ticket needs every task recorded, a converged review, and a traced, green suite.
import { describe, expect, it } from 'vitest';
import { lintSnapshot, loadSnapshot, setFrontmatterKey } from '../src/index.js';
import { gateDone } from '../src/gate/index.js';
import type { GateResult } from '../src/gate/index.js';
import { acHash } from '../src/gate/hash.js';
import { approved } from './helpers/approve.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

const COMMIT = '1234567890abcdef1234567890abcdef12345678';
type Cases = Record<string, 'passed' | 'failed' | 'skipped'>;
const CASES: Cases = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' };
const VERIFICATION = [
  '---',
  'ticket: "T-1"',
  'commit: "1234567"',
  'reviewed_on: "2026-10-12"',
  '---',
  '',
  '## @ac-1 export writes a csv',
  '',
  'Result: pass',
  '',
  'Evidence: export#writes-csv passed in reports/junit.xml',
  '',
  '## @ac-2 commas are escaped',
  '',
  'Result: pass',
  '',
  'Evidence: export#escapes-commas passed in reports/junit.xml',
  '',
].join('\n');

/** A lane ticket that passes Done, with `over` replacing any file afterwards. */
function doneFiles(over: Record<string, string> = {}, cases: Cases = CASES, ticket = laneTicket('T-1')): Record<string, string> {
  const files = approved(
    {
      'accord/config.yml': CONFIG,
      'accord/tickets/T-1.md': ticket,
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done 1234567\n- task 2 done 1234567\n',
      'accord/tickets/T-1/review.md': '## Round 1\nverdict: converged\n',
      'accord/tickets/T-1/verification.md': VERIFICATION,
      [REPORT]: junit(cases),
    },
    'T-1',
  );
  const hash = acHash(loadSnapshot({ files, tree: [] }).tickets['T-1'].scenarios) as string;
  let text = setFrontmatterKey(files['accord/tickets/T-1.md'], 'ac_hash', hash);
  text = setFrontmatterKey(text, 'verified', ['ac-1', 'ac-2']);
  text = setFrontmatterKey(text, 'verified_hash', hash);
  text = setFrontmatterKey(text, 'verified_commit', '1234567');
  return { ...files, 'accord/tickets/T-1.md': text, ...over };
}
const snap = (files: Record<string, string>) =>
  loadSnapshot({
    files,
    tree: Object.keys(files).sort(),
    git: {
      commit: COMMIT,
      authors: { [COMMIT]: 'dev@example.test', 'accord/tickets/T-1/verification.md': 'reviewer@example.test' },
    },
  });
const done = (files: Record<string, string>) => gateDone(snap(files), 'T-1');
const errors = (r: GateResult) => r.findings.filter((f) => f.level === 'error').map((f) => f.rule);

describe('Done for lane tickets', () => {
  it('passes with every task recorded, a converged review, and a traced green suite', () => {
    const r = done(doneFiles());
    expect(errors(r)).toEqual([]);
    expect(r.verdict).toBe('pass');
  });

  it('a task without a completion line fails on gate.task-incomplete', () => {
    const r = done(doneFiles({ 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done 1234567\n' }));
    expect(errors(r)).toEqual(['gate.task-incomplete']);
    expect(r.findings.find((f) => f.rule === 'gate.task-incomplete')?.reason).toBe(
      'task 2 has no completion line in accord/tickets/T-1/ledger.md; run accord task-done T-1 2',
    );
  });

  it('a missing review fails on gate.review-missing; an open one on gate.review-unconverged', () => {
    const missing = doneFiles();
    delete missing['accord/tickets/T-1/review.md'];
    expect(errors(done(missing))).toEqual(['gate.review-missing']);
    expect(errors(done(doneFiles({ 'accord/tickets/T-1/review.md': 'verdict: open\n' })))).toEqual([
      'gate.review-unconverged',
    ]);
  });

  it('accepted-by-owner is a verdict Done accepts', () => {
    expect(errors(done(doneFiles({ 'accord/tickets/T-1/review.md': 'verdict: accepted-by-owner\n' })))).toEqual([]);
  });

  it('a failed case anywhere in the report fails on gate.suite-not-passed', () => {
    const r = done(doneFiles({}, { ...CASES, 'util#risk:parsing-bom': 'failed' }));
    expect(errors(r)).toEqual(['gate.suite-not-passed']);
    expect(r.findings.find((f) => f.rule === 'gate.suite-not-passed')?.reason).toBe(
      '1 test case failed in the report: util#risk:parsing-bom',
    );
  });

  it('an untraced case fails on gate.test-untraced unless the baseline lists it', () => {
    const cases = { ...CASES, 'util#formats-dates': 'passed' } as Cases;
    expect(errors(done(doneFiles({}, cases)))).toEqual(['gate.test-untraced']);
    expect(errors(done(doneFiles({ 'accord/tests-baseline.txt': 'util#formats-dates\n' }, cases)))).toEqual([]);
  });

  it('a risk: case is traced by its name', () => {
    expect(errors(done(doneFiles({}, { ...CASES, 'util#risk:parsing-bom': 'passed' })))).toEqual([]);
  });

  it('review mode human still requires Verification notes', () => {
    const r = done(doneFiles({ 'accord/config.yml': CONFIG.replace('mode: outcome', 'mode: human') }));
    expect(errors(r)).toContain('gate.note-missing');
  });

  it('a ticket without lane gets none of the lane Done rules', () => {
    const r = done(doneFiles({}, CASES, laneTicket('T-1', { lane: '' })));
    for (const rule of ['gate.task-incomplete', 'gate.review-missing', 'gate.suite-not-passed', 'gate.test-untraced']) {
      expect(errors(r)).not.toContain(rule);
    }
  });
});

describe('lint.test-untraced (spec §9)', () => {
  const untraced = (files: Record<string, string>) =>
    lintSnapshot(snap(files)).findings.filter((f) => f.rule === 'lint.test-untraced');

  it('warns once a lane ticket exists', () => {
    expect(untraced(doneFiles({}, { ...CASES, 'util#formats-dates': 'passed' }))).toEqual([
      {
        file: 'reports/junit.xml',
        rule: 'lint.test-untraced',
        level: 'warning',
        reason: 'test "util#formats-dates" is named by no scenario\'s @test:, carries no risk:, and is not in accord/tests-baseline.txt',
      },
    ]);
  });

  it('is silent in a repository with no lane ticket', () => {
    const files = doneFiles({}, { ...CASES, 'util#formats-dates': 'passed' }, laneTicket('T-1', { lane: '' }));
    expect(untraced(files)).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project core lane-done`
Expected: FAIL — the clean case fails on `gate.note-missing` and the new rules do not exist.

- [ ] **Step 3: Export the report helpers**

In `packages/core/src/gate/done.ts`, change `const reportPath = …` to `export const reportPath = …` and `const reportLoaded = …` to `export const reportLoaded = …`. Nothing else changes.

- [ ] **Step 4: Write the traced-test check**

Create `packages/core/src/lint/tests.ts`:

```ts
// Spec §9: every report case traces to a criterion (a scenario's @test:<id>), a named risk (risk: in its
// name), or the adoption baseline (accord/tests-baseline.txt). A warning in lint; gate.test-untraced makes
// it an error at Done for lane tickets.
import { normaliseKey } from '../load/snapshot.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import type { Rule } from './rules.js';

/** Untraced report case ids, sorted in code-point order; [] when no report is loaded. */
export function untracedTests(snapshot: RepoSnapshot): string[] {
  if (snapshot.tests === undefined) return [];
  const named = new Set(
    Object.values(snapshot.tickets).flatMap((t) =>
      t.scenarios.flatMap((s) => s.tags.filter((x) => x.startsWith('@test:')).map((x) => x.slice('@test:'.length))),
    ),
  );
  const baseline = new Set(snapshot.testsBaseline ?? []);
  return Object.keys(snapshot.tests)
    .filter((id) => !named.has(id) && !baseline.has(id) && !id.includes('risk:'))
    .sort();
}

export const UNTRACED = (id: string): string =>
  `test "${id}" is named by no scenario's @test:, carries no risk:, and is not in accord/tests-baseline.txt`;

/** Silent until the repository holds a lane ticket: the first lane ticket opts the repository into the policy. */
export const testUntraced: Rule['check'] = (snapshot) => {
  const report = snapshot.config?.tests?.report;
  if (report === undefined || !Object.values(snapshot.tickets).some((t) => t.frontmatter?.lane !== undefined)) return [];
  return untracedTests(snapshot).map((id) => ({ file: normaliseKey(report), reason: UNTRACED(id) }));
};
```

In `packages/core/src/lint/rules.ts`, import `{ testUntraced } from './tests.js'` and add to `RULES` after `lint.report-missing`:

```ts
  { id: 'lint.test-untraced', level: 'warning', profiles: ['build', 'maintain'], check: testUntraced },
```

- [ ] **Step 5: Write the Done rules**

Append to `packages/core/src/gate/work.ts` (add the imports at the top):

```ts
import { normaliseKey } from '../load/snapshot.js';
import { UNTRACED, untracedTests } from '../lint/tests.js';
import { reportLoaded, reportPath } from './done.js';
import type { GateRule } from './rules.js';

/** Spec §8: every planned task has a completion line written by `accord task-done`. */
export const tasksIncomplete: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined) return [];
  const work = workOf(snapshot, id);
  if (work?.plan === undefined) {
    return [{ file: planFile(id), reason: 'no plan; Done needs every planned task recorded in ' + ledgerFile(id) }];
  }
  const done = work.ledger?.done ?? {};
  return work.plan.tasks
    .filter((t) => !Object.hasOwn(done, String(t.n)))
    .map((t) => ({
      file: planFile(id),
      line: t.line,
      reason: `task ${t.n} has no completion line in ${ledgerFile(id)}; run accord task-done ${id} ${t.n}`,
    }));
};

/** Spec §10: there is no Done without a review record. */
export const reviewMissing: GateRule['check'] = (snapshot, id) => {
  if (laneTicket(snapshot, id) === undefined || workOf(snapshot, id)?.review !== undefined) return [];
  return [{ file: reviewFile(id), reason: 'no review record; Done needs ' + reviewFile(id) }];
};

/** Spec §10: the review loop ended in convergence, or the owner accepted it at the cap. */
export const reviewUnconverged: GateRule['check'] = (snapshot, id) => {
  const review = laneTicket(snapshot, id) === undefined ? undefined : workOf(snapshot, id)?.review;
  if (review === undefined || VERDICTS.includes(review.verdict ?? '')) return [];
  return [
    {
      file: review.file,
      ...(review.line === undefined ? {} : { line: review.line }),
      reason:
        review.verdict === undefined
          ? 'the review record has no verdict: line'
          : `the review verdict is "${review.verdict}"; Done needs converged or accepted-by-owner`,
    },
  ];
};

/** Spec §11: the report is the full suite's output, and any failed case fails Done. */
export const suiteNotPassed: GateRule['check'] = (snapshot, id) => {
  const report = reportPath(snapshot);
  if (laneTicket(snapshot, id) === undefined || report === undefined || !reportLoaded(snapshot)) return [];
  const tests = snapshot.tests ?? {};
  const failed = Object.keys(tests)
    .filter((k) => tests[k] === 'failed')
    .sort();
  if (failed.length === 0) return [];
  const shown = failed.slice(0, 5).join(', ') + (failed.length > 5 ? ', ...' : '');
  return [
    {
      file: normaliseKey(report),
      reason: `${failed.length} test case${failed.length === 1 ? '' : 's'} failed in the report: ${shown}`,
    },
  ];
};

/** Spec §9 at Done: the warning lint gives becomes an error for a lane ticket. */
export const testUntracedAtDone: GateRule['check'] = (snapshot, id) => {
  const report = reportPath(snapshot);
  if (laneTicket(snapshot, id) === undefined || report === undefined || !reportLoaded(snapshot)) return [];
  return untracedTests(snapshot).map((t) => ({ file: normaliseKey(report), reason: UNTRACED(t) }));
};
```

- [ ] **Step 6: Make notes optional under review mode outcome**

In `packages/core/src/gate/refs.ts`, add after the constants:

```ts
/** Spec §11: under review mode outcome a lane ticket's human layer is the bound tick alone; notes are not required. */
const notesOptional = (snapshot: RepoSnapshot, t: Ticket): boolean =>
  t.frontmatter?.lane !== undefined && snapshot.config?.review?.mode === 'outcome';
```

In each of `noteMissing`, `noteUnresolved`, and `notePasted`, replace `if (t === undefined) return [];` with:

```ts
  if (t === undefined || notesOptional(snapshot, t)) return [];
```

- [ ] **Step 7: Register the Done rows**

In `packages/core/src/gate/rules.ts`, import `reviewMissing, reviewUnconverged, suiteNotPassed, tasksIncomplete, testUntracedAtDone` from `./work.js` and add to `DONE_RULES` before the `GATE-05` comment:

```ts
  { id: 'gate.task-incomplete', level: 'error', profiles: ['build', 'maintain'], check: tasksIncomplete },
  { id: 'gate.review-missing', level: 'error', profiles: ['build', 'maintain'], check: reviewMissing },
  { id: 'gate.review-unconverged', level: 'error', profiles: ['build', 'maintain'], check: reviewUnconverged },
  { id: 'gate.suite-not-passed', level: 'error', profiles: ['build', 'maintain'], check: suiteNotPassed },
  { id: 'gate.test-untraced', level: 'error', profiles: ['build', 'maintain'], check: testUntracedAtDone },
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run --project core lane-done`
Expected: PASS.

- [ ] **Step 9: Run the core suite**

Run: `npx vitest run --project core`
Expected: PASS, no golden change. If `gate.test.ts` or `lint.test.ts` list table ids explicitly, add the new ids in table order.

- [ ] **Step 10: Commit**

```bash
git add packages/core/src packages/core/test/lane-done.test.ts
git commit -m "feat(gate): Done needs recorded tasks, a converged review, and a traced green suite"
```

---

### Task 8: `accord approve`, and the shared frontmatter write

**Files:**
- Create: `packages/cli/src/write/key.ts`
- Create: `packages/cli/src/commands/approve.ts`
- Modify: `packages/cli/src/commands/gate.ts`, `packages/cli/src/run.ts`
- Modify: `packages/cli/test/helpers/repo.ts`
- Test: `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Consumes: `approvedHash` (Task 3).
- Produces: `writeKey(root, rel, key, value): boolean` in `cli/src/write/key.ts`; `approve(ctx, id): number`; CLI `accord approve <id>`. Test helpers `writeFiles(repo, files)`, `makeLaneRepo(extra?)`, `gitRun(repo, ...args)`.

- [ ] **Step 1: Add the CLI test helpers**

In `packages/cli/test/helpers/repo.ts` add the imports `mkdirSync, writeFileSync` (from `node:fs`), `dirname` (from `node:path`), and:

```ts
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../../test/helpers/lane.js';
```

Append:

```ts
/** Run git in a sandbox; the same guard as every other spawn in this file. */
export function gitRun(repo: string, ...args: string[]): string {
  return gitIn(repo)(...args);
}

/** Write repo-relative posix paths into the sandbox, creating folders. */
export function writeFiles(repo: string, files: Record<string, string>): void {
  for (const [rel, text] of Object.entries(files)) {
    const abs = join(repo, ...rel.split('/'));
    mkdirSync(dirname(abs), { recursive: true });
    writeFileSync(abs, text);
  }
}

/** A sandbox holding one unapproved lane ticket T-1, its two-task plan, and a green report. */
export function makeLaneRepo(extra: Record<string, string> = {}): string {
  const repo = makeEmptyRepo();
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'accord/tickets/T-1/plan.md': PLAN,
    [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }),
    ...extra,
  });
  return repo;
}
```

- [ ] **Step 2: Write the failing tests**

Create `packages/cli/test/lane-commands.test.ts`:

```ts
// The workflow-layer commands end to end, in-process through runCli (STACK Decision 7), each against its
// own sandbox so a write can never reach a fixture.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';

const ticketText = (repo: string, id = 'T-1') => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8');

describe('accord approve', () => {
  it('writes approved_hash once and is a no-op the second time', async () => {
    const repo = makeLaneRepo();
    try {
      const first = await run(['approve', 'T-1'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toMatch(/^approved accord\/tickets\/T-1\.md at fnv1a64:[0-9a-f]{16}\n$/);
      const text = ticketText(repo);
      expect(text).toMatch(/\napproved_hash: "fnv1a64:[0-9a-f]{16}"\n/);
      const second = await run(['approve', 'T-1'], repo);
      expect(second.code).toBe(0);
      expect(second.out).toMatch(/^already approved accord\/tickets\/T-1\.md/);
      expect(ticketText(repo)).toBe(text);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a ticket without lane, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-2.md': laneTicket('T-2', { lane: '' }) });
    try {
      const r = await run(['approve', 'T-2'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('accord/tickets/T-2.md has no lane:');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses an unknown ticket, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['approve', 'NOPE'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no ticket NOPE in accord/tickets/');
    } finally {
      cleanup(repo);
    }
  });

  it('after approval gate ready passes', async () => {
    const repo = makeLaneRepo();
    try {
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(1);
      await run(['approve', 'T-1'], repo);
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  });
});
```

Later tasks append `describe` blocks to this file and add the names they use to these two import lines.

- [ ] **Step 3: Run the tests to verify they fail**

Run: `npx vitest run --project cli lane-commands`
Expected: FAIL — `approve` is an unknown command (exit 2 from commander, and the approved output is missing).

- [ ] **Step 4: Extract the shared write**

Create `packages/cli/src/write/key.ts`:

```ts
// The one kind of write accord makes to a document a human owns: one frontmatter key, every other byte
// kept. Shared by `gate ready` (ac_hash, D-96) and `approve` (approved_hash, spec §4). Core normalises to
// LF and strips the BOM (D-38); restoring the file's own shape keeps a CRLF ticket a one-line diff.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey } from '@accord-dev/accord-core';

const BOM = '﻿';

/** Writes `key: "value"` into `root/rel` and returns true, or returns false when the bytes would not change. */
export function writeKey(root: string, rel: string, key: string, value: string): boolean {
  const file = join(root, rel);
  const text = readFileSync(file, 'utf8');
  const bom = text.startsWith(BOM) ? BOM : '';
  const crlf = text.includes('\r\n');
  const body = setFrontmatterKey(text, key, value);
  const next = bom + (crlf ? body.replace(/\r?\n/g, '\r\n') : body);
  // T-05-08: writing only on a difference keeps a second run's bytes and mtime unchanged.
  if (next === text) return false;
  writeFileSync(file, next);
  return true;
}
```

In `packages/cli/src/commands/gate.ts`, replace the `try { … }` body with a call to the helper, keeping the messages and the catch:

```ts
    try {
      if (writeKey(ctx.root, rel, 'ac_hash', result.acHash)) {
        // T-05-09, D-98: stderr, so a `--json` consumer's stdout stays one clean document.
        const prev = ctx.snapshot.tickets[id].frontmatter?.ac_hash;
        ctx.stderr.write(
          prev === undefined
            ? 'wrote ac_hash ' + result.acHash + ' to ' + rel + '\n'
            : 'updated ac_hash ' + prev + ' -> ' + result.acHash + ' in ' + rel + '\n',
        );
      }
    } catch (err) {
```

Remove the now-unused `file` constant, the `readFileSync`/`writeFileSync`/`join`/`setFrontmatterKey` imports, and import `writeKey` from `'../write/key.js'`.

- [ ] **Step 5: Write the command**

Create `packages/cli/src/commands/approve.ts`:

```ts
// Spec §4 `accord approve <id>`: records the owner's approval as approved_hash. Run only after the owner
// says yes in so many words; the gate then fails the moment an approved section changes.
import { approvedHash } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { writeKey } from '../write/key.js';

export function approve(ctx: CommandContext, id: string): number {
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError('no ticket ' + id + ' in accord/tickets/');
  const ticket = ctx.snapshot.tickets[id];
  if (ticket.frontmatter === undefined) {
    throw new UsageError(ticket.file + ' has frontmatter errors; run accord lint');
  }
  if (ticket.frontmatter.lane === undefined) {
    throw new UsageError(ticket.file + ' has no lane:, and approval applies to lane tickets only');
  }
  const hash = approvedHash(ticket);
  let wrote: boolean;
  try {
    // T-05-07: the path is the loader's record for a ticket that exists, never the raw argument.
    wrote = writeKey(ctx.root, ticket.file, 'approved_hash', hash);
  } catch (err) {
    throw new UsageError(
      'cannot write approved_hash to ' + ticket.file + ': ' + (err instanceof Error ? err.message : String(err)),
    );
  }
  ctx.stdout.write((wrote ? 'approved ' : 'already approved ') + ticket.file + ' at ' + hash + '\n');
  return 0;
}
```

In `packages/cli/src/run.ts`, import `{ approve } from './commands/approve.js'` and register after the gate loop:

```ts
  program
    .command('approve <id>')
    .description("record the owner's approval of a lane ticket as approved_hash")
    .action((id: string) => {
      setCode(approve(preflight(opts), id));
    });
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `npx vitest run --project cli lane-commands`
Expected: PASS.

- [ ] **Step 7: Run the CLI suite**

Run: `npx vitest run --project cli`
Expected: PASS. `gate.test.ts` covers the refactored write (CRLF, BOM, read-only, second-run no-op).

- [ ] **Step 8: Commit**

```bash
git add packages/cli/src packages/cli/test
git commit -m "feat(cli): accord approve, sharing the frontmatter write with gate ready"
```

---

### Task 9: `accord task-done`

**Files:**
- Create: `packages/core/src/gate/task.ts`
- Create: `packages/core/src/write/ledger.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/cli/src/commands/task-done.ts`
- Modify: `packages/cli/src/run.ts`
- Test: `packages/core/test/task.test.ts`, `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Consumes: `workOf` (Task 6), `parseLedger` (Task 2), `commitAll`, `writeFiles`, `makeLaneRepo` (Task 8).
- Produces: `taskVerdict(snapshot, id, n): { verdict: 'pass' | 'fail'; reasons: string[] }`; `recordTaskDone(text: string | undefined, n: number, sha: string): string | undefined`; both exported from core. CLI `accord task-done <id> <task>`.

- [ ] **Step 1: Write the failing core tests**

Create `packages/core/test/task.test.ts`:

```ts
// Spec §8: a task is done when its verify cases passed; the ledger records it once.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, recordTaskDone, taskVerdict } from '../src/index.js';
import { CONFIG, junit, laneTicket, PLAN, REPORT } from '../../../test/helpers/lane.js';

type Cases = Record<string, 'passed' | 'failed' | 'skipped'>;
const CASES: Cases = { 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' };
const snap = (over: Record<string, string> = {}, cases: Cases | null = CASES) => {
  const files: Record<string, string> = {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
    'accord/tickets/T-1/plan.md': PLAN,
    ...(cases === null ? {} : { [REPORT]: junit(cases) }),
    ...over,
  };
  return loadSnapshot({ files, tree: Object.keys(files).sort() });
};

describe('taskVerdict', () => {
  it('passes when every verify case passed', () => {
    expect(taskVerdict(snap(), 'T-1', 1)).toEqual({ verdict: 'pass', reasons: [] });
  });

  it('names a failed case and a missing case, in verify order', () => {
    const s = snap(
      { 'accord/tickets/T-1/plan.md': PLAN.replace('verify: export#writes-csv', 'verify: export#writes-csv, export#gone') },
      { 'export#writes-csv': 'failed', 'export#escapes-commas': 'passed' },
    );
    expect(taskVerdict(s, 'T-1', 1)).toEqual({
      verdict: 'fail',
      reasons: ['export#writes-csv is recorded failed in reports/junit.xml', 'export#gone is not in reports/junit.xml'],
    });
  });

  it('fails with one reason for a missing plan, task, verify line, or report', () => {
    const noPlan = snap({ 'accord/tickets/T-1/plan.md': '' });
    expect(taskVerdict(snap({}, CASES), 'T-1', 9).reasons).toEqual(['the plan has no "## Task 9"']);
    expect(taskVerdict(snap({ 'accord/tickets/T-1/plan.md': '## Task 1: A\ncovers: @ac-1\n' }), 'T-1', 1).reasons).toEqual([
      'task 1 has no verify: line',
    ]);
    expect(taskVerdict(snap({}, null), 'T-1', 1).reasons).toEqual([
      'no test report is loaded; set tests.report and run the tests',
    ]);
    expect(taskVerdict(noPlan, 'T-1', 1).reasons).toEqual(['the plan has no "## Task 1"']);
    const files = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };
    expect(taskVerdict(loadSnapshot({ files, tree: [] }), 'T-1', 1).reasons).toEqual([
      'no plan at accord/tickets/T-1/plan.md',
    ]);
  });
});

describe('recordTaskDone', () => {
  it('creates the skeleton and appends in order', () => {
    const one = recordTaskDone(undefined, 1, 'abc1234');
    expect(one).toBe('# Ledger\n\n## Tasks\n- task 1 done abc1234\n\n## Rulings\n\n## Deferred\n');
    expect(recordTaskDone(one, 2, 'def5678')).toBe(
      '# Ledger\n\n## Tasks\n- task 1 done abc1234\n- task 2 done def5678\n\n## Rulings\n\n## Deferred\n',
    );
  });

  it('returns undefined when the task already has a line', () => {
    expect(recordTaskDone('## Tasks\n- task 1 done abc1234\n', 1, 'fff0000')).toBeUndefined();
  });

  it('adds a Tasks section to a ledger that has none', () => {
    expect(recordTaskDone('## Rulings\n- Ruling: x\n', 3, 'abc1234')).toBe(
      '## Rulings\n- Ruling: x\n\n## Tasks\n- task 3 done abc1234\n',
    );
  });

  it('reads CRLF and writes LF', () => {
    expect(recordTaskDone('## Tasks\r\n- task 1 done abc1234\r\n', 2, 'abc1234')).toBe(
      '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n',
    );
  });
});
```

- [ ] **Step 2: Run the core tests to verify they fail**

Run: `npx vitest run --project core task`
Expected: FAIL — `taskVerdict` and `recordTaskDone` are not exported.

- [ ] **Step 3: Implement the verdict and the ledger write**

Create `packages/core/src/gate/task.ts`:

```ts
// Spec §8 `task-done`: a task is done when every report case its verify: line names is recorded passed.
// Pure: the CLI adds the two host facts core cannot see — the commit, and whether the report is fresh.
import type { RepoSnapshot } from '../model/snapshot.js';
import { planFile, workOf } from './work.js';

export interface TaskVerdict {
  verdict: 'pass' | 'fail';
  reasons: string[];
}

const fail = (reason: string): TaskVerdict => ({ verdict: 'fail', reasons: [reason] });

export function taskVerdict(snapshot: RepoSnapshot, id: string, n: number): TaskVerdict {
  const plan = workOf(snapshot, id)?.plan;
  if (plan === undefined) return fail('no plan at ' + planFile(id));
  const task = plan.tasks.find((t) => t.n === n);
  if (task === undefined) return fail(`the plan has no "## Task ${n}"`);
  if (task.verify.length === 0) return fail(`task ${n} has no verify: line`);
  const report = snapshot.config?.tests?.report;
  const tests = snapshot.tests;
  if (report === undefined || tests === undefined) return fail('no test report is loaded; set tests.report and run the tests');
  const reasons = task.verify.flatMap((v) =>
    !Object.hasOwn(tests, v)
      ? [`${v} is not in ${report}`]
      : tests[v] !== 'passed'
        ? [`${v} is recorded ${tests[v]} in ${report}`]
        : [],
  );
  return reasons.length === 0 ? { verdict: 'pass', reasons: [] } : { verdict: 'fail', reasons };
}
```

Create `packages/core/src/write/ledger.ts`:

```ts
// Spec §8: the ledger line `task-done` writes. Pure string in, string out; the CLI owns the file.
import { normaliseText } from '../load/frontmatter.js';
import { parseLedger } from '../load/work.js';

const SKELETON = '# Ledger\n\n## Tasks\n\n## Rulings\n\n## Deferred\n';

/**
 * Adds `- task <n> done <sha>` as the last line of `## Tasks`, creating the skeleton when there is no
 * ledger and a Tasks section when the ledger has none. Returns undefined when task n already has a line,
 * so a second run writes nothing. Output is LF.
 */
export function recordTaskDone(text: string | undefined, n: number, sha: string): string | undefined {
  const base = normaliseText(text ?? SKELETON);
  if (Object.hasOwn(parseLedger('', base).done, String(n))) return undefined;
  const entry = `- task ${n} done ${sha}`;
  const lines = base.replace(/\n$/, '').split('\n');
  const at = lines.findIndex((l) => /^##\s+Tasks\s*$/i.test(l));
  if (at < 0) return [...lines, '', '## Tasks', entry].join('\n') + '\n';
  let end = lines.findIndex((l, i) => i > at && /^##\s/.test(l));
  if (end < 0) end = lines.length;
  while (end - 1 > at && lines[end - 1].trim() === '') end--;
  lines.splice(end, 0, entry);
  return lines.join('\n') + '\n';
}
```

In `packages/core/src/index.ts` add:

```ts
export { taskVerdict } from './gate/task.js';
export type { TaskVerdict } from './gate/task.js';
export { recordTaskDone } from './write/ledger.js';
```

- [ ] **Step 4: Run the core tests to verify they pass**

Run: `npx vitest run --project core task`
Expected: PASS.

- [ ] **Step 5: Write the failing CLI tests**

Append to `packages/cli/test/lane-commands.test.ts` (add `utimesSync`, `existsSync` to the `node:fs` import, `commitAll` to the helpers import, and `junit` to the lane import):

```ts
const REPORT_PATH = (repo: string) => join(repo, 'reports', 'junit.xml');
const ledger = (repo: string) => readFileSync(join(repo, 'accord', 'tickets', 'T-1', 'ledger.md'), 'utf8');
/** Make the report newer than HEAD, as running the tests after committing would. */
const freshen = (repo: string) => {
  const later = new Date(Date.now() + 5000);
  utimesSync(REPORT_PATH(repo), later, later);
};

describe('accord task-done', () => {
  it('records a task whose verify cases passed, once', async () => {
    const repo = makeLaneRepo();
    try {
      const sha = commitAll(repo);
      freshen(repo);
      const first = await run(['task-done', 'T-1', '1'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toBe(`recorded task 1 done at ${sha.slice(0, 12)} in accord/tickets/T-1/ledger.md\n`);
      expect(ledger(repo)).toContain(`- task 1 done ${sha.slice(0, 12)}\n`);
      const second = await run(['task-done', 'T-1', '1'], repo);
      expect(second.code).toBe(0);
      expect(second.out).toBe('task 1 of T-1 is already recorded in accord/tickets/T-1/ledger.md\n');
      expect(ledger(repo).match(/task 1 done/g)).toHaveLength(1);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a failed verify case, exit 1, and writes nothing', async () => {
    const repo = makeLaneRepo({
      'reports/junit.xml': junit({ 'export#writes-csv': 'failed', 'export#escapes-commas': 'passed' }),
    });
    try {
      commitAll(repo);
      freshen(repo);
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toBe('task 1 of T-1 is not done:\n  export#writes-csv is recorded failed in reports/junit.xml\n');
      expect(existsSync(join(repo, 'accord', 'tickets', 'T-1', 'ledger.md'))).toBe(false);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a report older than the commit, exit 1', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      const old = new Date('2000-01-01T00:00:00Z');
      utimesSync(REPORT_PATH(repo), old, old);
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(1);
      expect(r.out).toContain('reports/junit.xml was written before the last commit; run the tests again');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a task number that is not one, and a repository with no commit, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      expect((await run(['task-done', 'T-1', 'x'], repo)).code).toBe(2);
      const r = await run(['task-done', 'T-1', '1'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('the repository has no commit');
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 6: Run the CLI tests to verify they fail**

Run: `npx vitest run --project cli lane-commands`
Expected: FAIL — `task-done` is an unknown command.

- [ ] **Step 7: Write the command**

Create `packages/cli/src/commands/task-done.ts`:

```ts
// Spec §8 `accord task-done <id> <n>`: writes the ledger line only when the report shows every verify case
// of task n passed and the report is newer than HEAD. The CLI never runs a test command; the orchestrator
// runs the tests, and this reads the evidence the Done gate reads.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { recordTaskDone, taskVerdict } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

const TASK = /^[1-9][0-9]*$/;

/**
 * shortcut: compares whole seconds (git's %ct), so a report written in the same second as the commit, but
 * before it, counts as fresh; upgrade to a content check if that ever lets a stale report through.
 */
function staleReport(ctx: CommandContext): string | undefined {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined || ctx.snapshot.tests === undefined) return undefined; // taskVerdict reports this
  const committed =
    Number(
      execFileSync('git', ['show', '-s', '--format=%ct', 'HEAD'], {
        cwd: ctx.root,
        encoding: 'utf8',
        stdio: ['ignore', 'pipe', 'pipe'],
      }).trim(),
    ) * 1000;
  const written = Math.floor(statSync(join(ctx.root, report)).mtimeMs / 1000) * 1000;
  return written < committed ? `${report} was written before the last commit; run the tests again` : undefined;
}

export function taskDone(ctx: CommandContext, id: string, task: string): number {
  if (!TASK.test(task)) throw new UsageError('not a task number: ' + task);
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError('no ticket ' + id + ' in accord/tickets/');
  const commit = ctx.snapshot.git?.commit;
  if (commit === undefined) throw new UsageError('the repository has no commit; commit the task before recording it');
  const n = Number(task);
  const verdict = taskVerdict(ctx.snapshot, id, n);
  const stale = verdict.verdict === 'pass' ? staleReport(ctx) : undefined;
  const reasons = [...verdict.reasons, ...(stale === undefined ? [] : [stale])];
  if (reasons.length > 0) {
    ctx.stdout.write(`task ${n} of ${id} is not done:\n` + reasons.map((r) => '  ' + r + '\n').join(''));
    return 1;
  }
  // T-05-07: `id` is a key the loader found on disk, so it is a file stem and never a traversal.
  const rel = 'accord/tickets/' + id + '/ledger.md';
  const file = join(ctx.root, 'accord', 'tickets', id, 'ledger.md');
  const sha = commit.slice(0, 12);
  const next = recordTaskDone(existsSync(file) ? readFileSync(file, 'utf8') : undefined, n, sha);
  if (next === undefined) {
    ctx.stdout.write(`task ${n} of ${id} is already recorded in ${rel}\n`);
    return 0;
  }
  mkdirSync(join(ctx.root, 'accord', 'tickets', id), { recursive: true });
  writeFileSync(file, next);
  ctx.stdout.write(`recorded task ${n} done at ${sha} in ${rel}\n`);
  return 0;
}
```

In `packages/cli/src/run.ts`, import `{ taskDone } from './commands/task-done.js'` and register after `approve`:

```ts
  program
    .command('task-done <id> <task>')
    .description('record a plan task as done when the test report shows its verify cases passed')
    .action((id: string, task: string) => {
      setCode(taskDone(preflight(opts), id, task));
    });
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src packages/core/test/task.test.ts packages/cli/src packages/cli/test
git commit -m "feat(cli): task-done records a task only when the fresh report shows it passed"
```

---

### Task 10: `accord brief` and `accord review-package`

**Files:**
- Create: `packages/cli/src/commands/brief.ts`, `packages/cli/src/commands/review-package.ts`
- Modify: `packages/cli/src/run.ts`
- Test: `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Consumes: `snapshot.work` (Task 2), `normaliseText` (core), `gitRun`, `writeFiles`, `commitAll` (Task 8).
- Produces: CLI `accord brief <id> <task>` and `accord review-package <id> [--base <ref>]` (default `main`).

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/test/lane-commands.test.ts` (add `writeFiles` to the helpers import):

```ts
describe('accord brief', () => {
  it('prints the ticket verbatim, then the one task', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['brief', 'T-1', '2'], repo);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('---\nid: "T-1"\n')).toBe(true);
      expect(r.out).toContain('\n---\n\n## Task 2: Escaping\ncovers: @ac-2\n');
      expect(r.out).not.toContain('Task 1: Writer');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a task the plan does not have, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['brief', 'T-1', '9'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('accord/tickets/T-1/plan.md has no "## Task 9"');
    } finally {
      cleanup(repo);
    }
  });
});

describe('accord review-package', () => {
  it('prints commits, stat, and diff since the base', async () => {
    const repo = makeLaneRepo();
    try {
      const base = commitAll(repo);
      writeFiles(repo, { 'src/x.ts': 'export const x = 1;\n' });
      commitAll(repo);
      const r = await run(['review-package', 'T-1', '--base', base], repo);
      expect(r.code).toBe(0);
      expect(r.out).toContain('## Commits\n');
      expect(r.out).toContain(' fixture\n');
      expect(r.out).toContain('## Stat\n');
      expect(r.out).toContain('src/x.ts');
      expect(r.out).toContain('+export const x = 1;');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a malformed or unknown base, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      expect((await run(['review-package', 'T-1', '--base', 'no such ref'], repo)).code).toBe(2);
      const r = await run(['review-package', 'T-1', '--base', 'deadbeef'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('unknown base ref: deadbeef');
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project cli lane-commands`
Expected: FAIL — unknown commands.

- [ ] **Step 3: Write the commands**

Create `packages/cli/src/commands/brief.ts`:

```ts
// Spec §8 `accord brief <id> <n>`: the whole brief an executor receives — the ticket verbatim, then task n
// of the plan. Never chat history, never a summary.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { normaliseText } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

const TASK = /^[1-9][0-9]*$/;

export function brief(ctx: CommandContext, id: string, task: string): number {
  if (!TASK.test(task)) throw new UsageError('not a task number: ' + task);
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError('no ticket ' + id + ' in accord/tickets/');
  const work = ctx.snapshot.work !== undefined && Object.hasOwn(ctx.snapshot.work, id) ? ctx.snapshot.work[id] : undefined;
  const planPath = 'accord/tickets/' + id + '/plan.md';
  if (work?.plan === undefined) throw new UsageError('no plan at ' + planPath);
  const n = Number(task);
  const t = work.plan.tasks.find((x) => x.n === n);
  if (t === undefined) throw new UsageError(`${planPath} has no "## Task ${n}"`);
  const ticket = normaliseText(readFileSync(join(ctx.root, ctx.snapshot.tickets[id].file), 'utf8'));
  const section = [`## Task ${t.n}: ${t.title}`, ...t.lines.map((l) => l.text)].join('\n');
  ctx.stdout.write(ticket.replace(/\n*$/, '\n') + '\n---\n\n' + section.replace(/\n*$/, '\n'));
  return 0;
}
```

Create `packages/cli/src/commands/review-package.ts`:

```ts
// Spec §10 `accord review-package <id> --base <ref>`: what a reviewer reads — commits, stat, and the diff
// with ten lines of context. git only, literal argument arrays, no shell (CLI-07).
import { execFileSync } from 'node:child_process';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

// No leading '-', so a ref can never be read as a git option; no spaces or shell metacharacters.
const REF = /^[A-Za-z0-9][A-Za-z0-9._/-]*$/;

export function reviewPackage(ctx: CommandContext, id: string, options: { base: string }): number {
  if (!Object.hasOwn(ctx.snapshot.tickets, id)) throw new UsageError('no ticket ' + id + ' in accord/tickets/');
  const base = options.base;
  if (!REF.test(base)) throw new UsageError('not a git ref: ' + base);
  const git = (args: string[]) =>
    execFileSync('git', args, {
      cwd: ctx.root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
  try {
    git(['rev-parse', '--verify', '--quiet', base + '^{commit}']);
  } catch {
    throw new UsageError('unknown base ref: ' + base);
  }
  const range = base + '...HEAD';
  const parts = [
    `# Review package: ${id} (${range})`,
    '## Commits',
    git(['log', '--format=%h %s', base + '..HEAD']).trimEnd() || '(none)',
    '## Stat',
    git(['diff', '--stat', range]).trimEnd() || '(no changes)',
    '## Diff',
    git(['diff', '-U10', range]).trimEnd() || '(no changes)',
  ];
  ctx.stdout.write(parts.join('\n\n') + '\n');
  return 0;
}
```

In `packages/cli/src/run.ts`, import both and register after `task-done`:

```ts
  program
    .command('brief <id> <task>')
    .description('print the ticket and one plan task: the brief an executor receives')
    .action((id: string, task: string) => {
      setCode(brief(preflight(opts), id, task));
    });

  program
    .command('review-package <id>')
    .description('print the commits, stat, and diff a reviewer reads')
    .option('--base <ref>', 'the commit or branch the work started from', 'main')
    .action((id: string, options: { base: string }) => {
      setCode(reviewPackage(preflight(opts), id, options));
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run --project cli`
Expected: PASS, including `spawn-surface.test.ts` (both new spawn sites name `'git'`).

- [ ] **Step 5: Commit**

```bash
git add packages/cli/src packages/cli/test
git commit -m "feat(cli): brief and review-package, the executor's and the reviewer's inputs"
```

---

### Task 11: `accord tests baseline`

**Files:**
- Create: `packages/cli/src/commands/tests-baseline.ts`
- Modify: `packages/core/src/index.ts`, `packages/cli/src/run.ts`
- Test: `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Consumes: `untracedTests` (Task 7).
- Produces: `untracedTests` exported from core; CLI `accord tests baseline`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/cli/test/lane-commands.test.ts` (import `CONFIG` from the lane helpers):

```ts
describe('accord tests baseline', () => {
  const report = junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed', 'util#formats-dates': 'passed' });

  it('writes the untraced cases once and refuses a second time', async () => {
    const repo = makeLaneRepo({ 'reports/junit.xml': report });
    try {
      const first = await run(['tests', 'baseline'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toBe('wrote 1 case id to accord/tests-baseline.txt\n');
      const text = readFileSync(join(repo, 'accord', 'tests-baseline.txt'), 'utf8');
      expect(text.split('\n').filter((l) => l !== '' && !l.startsWith('#'))).toEqual(['util#formats-dates']);
      const second = await run(['tests', 'baseline'], repo);
      expect(second.code).toBe(2);
      expect(second.err).toContain('accord/tests-baseline.txt already exists');
      expect((await run(['lint'], repo)).out).not.toContain('lint.test-untraced');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a repository with no tests.report, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/config.yml': CONFIG.replace(/tests:\n {2}report: .*\n/, '') });
    try {
      const r = await run(['tests', 'baseline'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no tests.report');
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run --project cli lane-commands`
Expected: FAIL — unknown command.

- [ ] **Step 3: Implement**

In `packages/core/src/index.ts` add `export { untracedTests } from './lint/tests.js';`.

Create `packages/cli/src/commands/tests-baseline.ts`:

```ts
// Spec §9 `accord tests baseline`: lists the untraced cases that exist when a project adopts the test
// policy, once. It refuses when the file exists — the baseline only shrinks, so it can never become a
// way past gate.test-untraced.
import { existsSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { untracedTests } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

const REL = 'accord/tests-baseline.txt';
const HEADER =
  '# Test cases that existed before the test policy applied. One report case id per line.\n' +
  '# This file only shrinks: a case removed from the suite or traced to a criterion comes off; nothing is added.\n';

export function testsBaseline(ctx: CommandContext): number {
  const report = ctx.snapshot.config?.tests?.report;
  if (report === undefined) throw new UsageError('no tests.report in accord/config.yml; the baseline is read from the report');
  if (ctx.snapshot.tests === undefined) throw new UsageError(`tests.report "${report}" was not found; run the tests first`);
  const file = join(ctx.root, 'accord', 'tests-baseline.txt');
  if (existsSync(file)) throw new UsageError(REL + ' already exists - the baseline only shrinks; remove lines by hand');
  const ids = untracedTests(ctx.snapshot);
  writeFileSync(file, HEADER + ids.map((i) => i + '\n').join(''));
  ctx.stdout.write(`wrote ${ids.length} case id${ids.length === 1 ? '' : 's'} to ${REL}\n`);
  return 0;
}
```

In `packages/cli/src/run.ts`, import it and register (chained like `skills sync`):

```ts
  program
    .command('tests')
    .description('manage the test policy records')
    .command('baseline')
    .description('write accord/tests-baseline.txt from the untraced cases in the report, once')
    .action(() => {
      setCode(testsBaseline(preflight(opts)));
    });
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/index.ts packages/cli/src packages/cli/test
git commit -m "feat(cli): tests baseline lists legacy untraced cases once, and only shrinks after"
```

---

### Task 12: Stage, dependencies, and claims in `status`; `accord next`

**Files:**
- Create: `packages/core/src/status/stage.ts`
- Modify: `packages/core/src/status/rows.ts`, `packages/core/src/index.ts`
- Modify: `packages/cli/src/load/fs.ts`, `packages/cli/src/render/table.ts`, `packages/cli/src/run.ts`
- Create: `packages/cli/src/commands/next.ts`
- Test: `packages/core/test/lane-status.test.ts`, `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Consumes: `approvedHash`, `acHash` (Task 3), `workOf`, `VERDICTS` (Task 6), `approved` helper (Task 3).
- Produces: `Stage`, `Progress`, `progressOf(snapshot, ticket): Progress | undefined`, `isDone(snapshot, id): boolean` in `status/stage.ts`. `StatusRow` gains optional `lane`, `stage`, `tasksDone`, `tasksTotal`, `dependsOn`, `blockedBy`, `claimedBy`. `nextRows(rows): StatusRow[]` exported from core. CLI `accord next [--json]`; lane columns in the status table.

- [ ] **Step 1: Write the failing core tests**

Create `packages/core/test/lane-status.test.ts`:

```ts
// Spec §5-§6: where each lane ticket stands, what blocks it, and who holds it.
import { describe, expect, it } from 'vitest';
import { loadSnapshot, nextRows, setFrontmatterKey, statusRows } from '../src/index.js';
import { acHash } from '../src/gate/hash.js';
import { approved } from './helpers/approve.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const rows = (files: Record<string, string>, claims?: Record<string, string>) =>
  statusRows(loadSnapshot({ files, tree: [], ...(claims === undefined ? {} : { claims }) }));
const T1 = 'accord/tickets/T-1.md';

describe('stage (spec §6)', () => {
  it('walks intent, plan, build, review, verify, done', () => {
    const base = { 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') };
    expect(rows(base)[0]).toMatchObject({ lane: 'M', stage: 'intent', tasksDone: 0, tasksTotal: 0 });
    const ap = approved(base, 'T-1');
    expect(rows(ap)[0].stage).toBe('plan');
    const building = { ...ap, 'accord/tickets/T-1/plan.md': PLAN, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n' };
    expect(rows(building)[0]).toMatchObject({ stage: 'build', tasksDone: 1, tasksTotal: 2 });
    const built = { ...building, 'accord/tickets/T-1/ledger.md': '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n' };
    expect(rows(built)[0].stage).toBe('review');
    const reviewed = { ...built, 'accord/tickets/T-1/review.md': 'verdict: converged\n' };
    expect(rows(reviewed)[0].stage).toBe('verify');
    const hash = acHash(loadSnapshot({ files: reviewed, tree: [] }).tickets['T-1'].scenarios) as string;
    const ticked = setFrontmatterKey(setFrontmatterKey(reviewed[T1], 'verified', ['ac-1', 'ac-2']), 'verified_hash', hash);
    expect(rows({ ...reviewed, [T1]: ticked })[0].stage).toBe('done');
  });

  it('an edit after approval drops the stage back to intent', () => {
    const ap = approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1');
    expect(rows({ ...ap, [T1]: ap[T1].replace('csv mode', 'tsv mode') })[0].stage).toBe('intent');
  });
});

describe('dependencies and claims (spec §5)', () => {
  const dep = (id: string, deps: string[]) =>
    laneTicket(id, { frontmatter: [`depends_on: [${deps.map((d) => `"${d}"`).join(', ')}]`] });

  it('blockedBy lists dependencies not at done; unknown ids block', () => {
    const files = { 'accord/config.yml': CONFIG, 'accord/tickets/A.md': dep('A', ['B', 'NOPE']), 'accord/tickets/B.md': dep('B', []) };
    expect(rows(files).find((r) => r.id === 'A')).toMatchObject({ dependsOn: ['B', 'NOPE'], blockedBy: ['B', 'NOPE'] });
  });

  it('claimedBy comes from the host claims', () => {
    const files = { 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') };
    expect(rows(files, { 'T-1': 'an@example.test' })[0].claimedBy).toBe('an@example.test');
  });

  it('a ticket without lane gets none of the lane fields', () => {
    const r = rows({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1', { lane: '' }) })[0];
    for (const key of ['lane', 'stage', 'tasksDone', 'tasksTotal', 'dependsOn', 'blockedBy', 'claimedBy']) {
      expect(r).not.toHaveProperty(key);
    }
  });

  it('nextRows keeps approved, unplanned, unblocked, unclaimed tickets', () => {
    const files = approved({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }, 'T-1');
    expect(nextRows(rows(files)).map((r) => r.id)).toEqual(['T-1']);
    expect(nextRows(rows(files, { 'T-1': 'an@example.test' }))).toEqual([]);
    expect(nextRows(rows({ 'accord/config.yml': CONFIG, [T1]: laneTicket('T-1') }))).toEqual([]);
  });
});
```

- [ ] **Step 2: Run the core tests to verify they fail**

Run: `npx vitest run --project core lane-status`
Expected: FAIL — no `stage` field and no `nextRows`.

- [ ] **Step 3: Implement stage and rows**

Create `packages/core/src/status/stage.ts`:

```ts
// Spec §6: where a lane ticket stands, read from its records. A trace, never a verdict (D-91): only
// `gate ready` decides Ready and only `gate done` decides Done.
import { acHash, approvedHash } from '../gate/hash.js';
import { VERDICTS, workOf } from '../gate/work.js';
import type { RepoSnapshot, Ticket } from '../model/snapshot.js';

export type Stage = 'intent' | 'plan' | 'build' | 'review' | 'verify' | 'done';

export interface Progress {
  stage: Stage;
  tasksDone: number;
  tasksTotal: number;
  next?: number; // the lowest task number without a completion line, during build
}

const ticksBound = (ticket: Ticket): boolean => {
  const fm = ticket.frontmatter;
  const hash = acHash(ticket.scenarios);
  return fm !== undefined && (fm.verified ?? []).length > 0 && hash !== undefined && fm.verified_hash === hash;
};

/** undefined for a ticket without lane, or whose frontmatter failed the schema. */
export function progressOf(snapshot: RepoSnapshot, ticket: Ticket): Progress | undefined {
  const fm = ticket.frontmatter;
  if (fm?.lane === undefined) return undefined;
  const work = workOf(snapshot, ticket.id);
  const tasks = [...(work?.plan?.tasks ?? [])].sort((a, b) => a.n - b.n);
  const done = work?.ledger?.done ?? {};
  const open = tasks.filter((t) => !Object.hasOwn(done, String(t.n)));
  const counts = { tasksDone: tasks.length - open.length, tasksTotal: tasks.length };
  if (fm.approved_hash === undefined || fm.approved_hash !== approvedHash(ticket)) return { stage: 'intent', ...counts };
  if (tasks.length === 0) return { stage: 'plan', ...counts };
  if (open.length > 0) return { stage: 'build', ...counts, next: open[0].n };
  if (!VERDICTS.includes(work?.review?.verdict ?? '')) return { stage: 'review', ...counts };
  return { stage: ticksBound(ticket) ? 'done' : 'verify', ...counts };
}

/** A dependency is satisfied when its records say done; a ticket without lane counts when its ticks are bound. */
export function isDone(snapshot: RepoSnapshot, id: string): boolean {
  if (!Object.hasOwn(snapshot.tickets, id)) return false;
  const ticket = snapshot.tickets[id];
  const progress = progressOf(snapshot, ticket);
  return progress === undefined ? ticksBound(ticket) : progress.stage === 'done';
}
```

In `packages/core/src/status/rows.ts`:

Add imports `import { isDone, progressOf } from './stage.js';` and `import type { Stage } from './stage.js';`. Add to `StatusRow` after `tracker?`:

```ts
  lane?: 'M' | 'L' | 'P'; // spec §3
  stage?: Stage; // spec §6, lane tickets only
  tasksDone?: number; // lane tickets only
  tasksTotal?: number; // lane tickets only
  dependsOn?: string[]; // spec §5, as written
  blockedBy?: string[]; // dependsOn entries whose ticket is not done; an unknown id blocks
  claimedBy?: string; // host-supplied author of branch t/<id>
```

In the row mapper, add after `const hash = …`:

```ts
      const progress = progressOf(snapshot, ticket);
      const deps = fm?.depends_on;
      const claims = snapshot.claims;
```

and after the `tracker` spread:

```ts
        ...(fm?.lane === undefined ? {} : { lane: fm.lane }),
        ...(progress === undefined
          ? {}
          : { stage: progress.stage, tasksDone: progress.tasksDone, tasksTotal: progress.tasksTotal }),
        ...(deps === undefined ? {} : { dependsOn: deps, blockedBy: deps.filter((d) => !isDone(snapshot, d)) }),
        ...(claims !== undefined && Object.hasOwn(claims, ticket.id) ? { claimedBy: claims[ticket.id] } : {}),
```

Append:

```ts
/** Spec §6 `accord next`: approved and not yet planned, unblocked, unclaimed, not archived. */
export function nextRows(rows: StatusRow[]): StatusRow[] {
  return rows.filter(
    (r) => r.stage === 'plan' && (r.blockedBy ?? []).length === 0 && r.claimedBy === undefined && r.status !== 'archived',
  );
}
```

In `packages/core/src/index.ts` change the status export to `export { nextRows, statusRows } from './status/rows.js';` and add `export type { Stage } from './status/stage.js';`.

- [ ] **Step 4: Run the core tests to verify they pass**

Run: `npx vitest run --project core`
Expected: PASS, no golden change (the new fields are absent on every existing fixture).

- [ ] **Step 5: Write the failing CLI tests**

Append to `packages/cli/test/lane-commands.test.ts` (import `gitRun` from the helpers):

```ts
describe('status, claims, and next', () => {
  it('a branch t/<id> claims the ticket for its tip author, ids with dots and underscores included', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-1.2_a.md': laneTicket('T-1.2_a') });
    try {
      commitAll(repo);
      gitRun(repo, 'branch', 't/T-1.2_a');
      const rows = JSON.parse((await run(['status', '--json'], repo)).out) as { id: string; claimedBy?: string }[];
      expect(rows.find((r) => r.id === 'T-1.2_a')?.claimedBy).toBe('fixture@example.invalid');
      expect(rows.find((r) => r.id === 'T-1')).not.toHaveProperty('claimedBy');
    } finally {
      cleanup(repo);
    }
  });

  it('the status table gains stage, who, and blocked by columns when a lane ticket exists', async () => {
    const repo = makeLaneRepo();
    try {
      const out = (await run(['status'], repo)).out;
      expect(out.split('\n')[0]).toMatch(/stage\s+who\s+blocked by\s+tracker/);
      expect(out).toContain('intent');
    } finally {
      cleanup(repo);
    }
  });

  it('next lists an approved, unclaimed ticket, and nothing once it is claimed', async () => {
    const repo = makeLaneRepo();
    try {
      await run(['approve', 'T-1'], repo);
      expect((await run(['next'], repo)).out).toContain('T-1');
      commitAll(repo);
      gitRun(repo, 'branch', 't/T-1');
      expect((await run(['next'], repo)).out).toBe('no ticket is ready to pick up\n');
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 6: Run the CLI tests to verify they fail**

Run: `npx vitest run --project cli lane-commands`
Expected: FAIL — no claims, no columns, no `next`.

- [ ] **Step 7: Supply claims, render columns, add `next`**

In `packages/cli/src/load/fs.ts` add before `loadFromFs`:

```ts
/**
 * Spec §5: a branch named t/<id>, local or on any remote, claims ticket <id> for the author of its tip.
 * One spawn, literal arguments. for-each-ref sorts by refname, so refs/remotes/... is read after
 * refs/heads/... and the pushed claim, the one teammates see, wins.
 */
function gitClaims(root: string): Record<string, string> {
  let out: string;
  try {
    out = execFileSync('git', ['for-each-ref', '--format=%(refname)%00%(authoremail)', 'refs/heads/t/', 'refs/remotes/'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch {
    return {};
  }
  const claims: Record<string, string> = {};
  for (const line of out.split('\n')) {
    const [ref, email] = line.split('\0');
    const m = /^refs\/(?:heads|remotes\/[^/]+)\/t\/([^/]+)$/.exec(ref ?? '');
    if (m !== null && email !== undefined) claims[m[1]] = email.replace(/^<|>$/g, '');
  }
  return claims;
}
```

and in `loadFromFs` replace the return with:

```ts
  const claims = gitClaims(root);
  return {
    files,
    tree,
    ...(git === undefined ? {} : { git }),
    // Omitted when empty, so a repository with no ticket branch loads exactly as before.
    ...(Object.keys(claims).length === 0 ? {} : { claims }),
  };
```

In `packages/cli/src/render/table.ts`, add after `COLUMNS`:

```ts
/** Spec §6: shown only when a visible row is a lane ticket, so a 0.1.0 repository's table is unchanged. */
const LANE_COLUMNS: Column[] = [
  {
    head: 'stage',
    budget: 12,
    cell: (r) =>
      r.stage === undefined ? EMPTY_CELL : r.stage === 'build' ? `build ${r.tasksDone ?? 0}/${r.tasksTotal ?? 0}` : r.stage,
  },
  { head: 'who', budget: 28, cell: (r) => r.claimedBy ?? EMPTY_CELL },
  { head: 'blocked by', budget: 28, cell: (r) => ((r.blockedBy ?? []).length === 0 ? EMPTY_CELL : (r.blockedBy ?? []).join(' ')) },
];
```

and in `renderRows`, start with:

```ts
  const columns = rows.some((r) => r.lane !== undefined)
    ? [...COLUMNS.slice(0, -1), ...LANE_COLUMNS, COLUMNS[COLUMNS.length - 1]]
    : COLUMNS;
```

then replace every `COLUMNS` reference inside `renderRows` with `columns`.

Create `packages/cli/src/commands/next.ts`:

```ts
// Spec §6 `accord next`: lane tickets that are approved, unblocked, and unclaimed. Rows come from core.
import { nextRows, statusRows } from '@accord-dev/accord-core';
import { renderRows } from '../render/table.js';
import type { CommandContext } from '../run.js';

export function next(ctx: CommandContext, options: { json?: boolean }): number {
  const rows = nextRows(statusRows(ctx.snapshot));
  if (options.json) {
    ctx.stdout.write(JSON.stringify(rows, null, 2) + '\n');
    return 0;
  }
  ctx.stdout.write(rows.length === 0 ? 'no ticket is ready to pick up\n' : renderRows(rows));
  return 0;
}
```

In `packages/cli/src/run.ts`, import and register after `status`:

```ts
  program
    .command('next')
    .description('list lane tickets that are approved, unblocked, and unclaimed')
    .option('--json', 'print the StatusRow array instead of the table')
    .action((options: { json?: boolean }) => {
      setCode(next(preflight(opts), options));
    });
```

- [ ] **Step 8: Run both suites**

Run: `npx vitest run`
Expected: PASS. The existing `status.test.ts` goldens are unchanged because no 0.1.0 fixture row has `lane`.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src packages/core/test/lane-status.test.ts packages/cli/src packages/cli/test
git commit -m "feat(status): stage, dependencies, and branch claims for lane tickets, and accord next"
```

---

### Task 13: `accord anchor`

**Files:**
- Create: `packages/core/src/status/anchor.ts`
- Modify: `packages/core/src/index.ts`
- Create: `packages/cli/src/commands/anchor.ts`
- Modify: `packages/cli/src/run.ts`
- Test: `packages/core/test/anchor.test.ts`, `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Consumes: `progressOf`, `Stage` (Task 12), `workOf` (Task 6), `Ledger.rulings` (Task 2).
- Produces: `anchorText(snapshot, id): string | undefined` exported from core; CLI `accord anchor [id]`.

- [ ] **Step 1: Write the failing core tests**

Create `packages/core/test/anchor.test.ts`:

```ts
// Spec §6 re-anchoring: the owner's words, verbatim, and where the work stands.
import { describe, expect, it } from 'vitest';
import { anchorText, loadSnapshot } from '../src/index.js';
import { approved } from './helpers/approve.js';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';

const snap = (files: Record<string, string>) => loadSnapshot({ files, tree: [] });
const base = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1') };

describe('anchorText', () => {
  it('prints the four owner sections verbatim, the stage, the next task, and the Rulings', () => {
    const files = {
      ...approved(base, 'T-1'),
      'accord/tickets/T-1/plan.md': PLAN,
      'accord/tickets/T-1/ledger.md':
        '## Tasks\n- task 1 done abc1234\n\n## Rulings\n- Ruling: kept the old writer signature — callers depend on it — one extra branch if wrong\n',
    };
    expect(anchorText(snap(files), 'T-1')).toBe(
      [
        '# Anchor: T-1 "Export"',
        '',
        'Stage: build 1/2, next: task 2 "Escaping"',
        '',
        '## Intent',
        'Owners can export their report as CSV.',
        '',
        '## Vetoes',
        '- No new dependency.',
        '',
        '## Decisions',
        '- D-01 Use the existing writer — "reuse what we have"',
        '',
        '## Corrections',
        '(none)',
        '',
        '## Rulings',
        'Ruling: kept the old writer signature — callers depend on it — one extra branch if wrong',
        '',
      ].join('\n'),
    );
  });

  it('names the next step for a stage without tasks', () => {
    expect(anchorText(snap(base), 'T-1')).toContain('Stage: intent, next: the owner approves the ticket (accord approve)');
  });

  it('is undefined for an unknown ticket and for a ticket without lane', () => {
    expect(anchorText(snap(base), 'NOPE')).toBeUndefined();
    const legacy = { ...base, 'accord/tickets/T-1.md': laneTicket('T-1', { lane: '' }) };
    expect(anchorText(snap(legacy), 'T-1')).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the core tests to verify they fail**

Run: `npx vitest run --project core anchor`
Expected: FAIL — `anchorText` is not exported.

- [ ] **Step 3: Implement**

Create `packages/core/src/status/anchor.ts`:

```ts
// Spec §6 re-anchoring: after a compaction the orchestrator re-reads the owner's words instead of
// remembering them. Comments and blank lines are dropped; every other line is printed as written.
import { workOf } from '../gate/work.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { progressOf } from './stage.js';
import type { Stage } from './stage.js';

const SECTIONS = ['Intent', 'Vetoes', 'Decisions', 'Corrections'];
const NEXT: Record<Exclude<Stage, 'build'>, string> = {
  intent: 'the owner approves the ticket (accord approve)',
  plan: 'write the plan and pass accord gate plan',
  review: 'review to convergence',
  verify: "verification and the owner's tick",
  done: 'nothing; run accord gate done',
};

/** undefined when `id` is not a lane ticket in the snapshot. */
export function anchorText(snapshot: RepoSnapshot, id: string): string | undefined {
  if (!Object.hasOwn(snapshot.tickets, id)) return undefined;
  const ticket = snapshot.tickets[id];
  const progress = progressOf(snapshot, ticket);
  if (progress === undefined) return undefined;
  const work = workOf(snapshot, id);
  let where: string;
  if (progress.stage === 'build') {
    const task = work?.plan?.tasks.find((t) => t.n === progress.next);
    where =
      `build ${progress.tasksDone}/${progress.tasksTotal}` + (task === undefined ? '' : `, next: task ${task.n} "${task.title}"`);
  } else {
    where = `${progress.stage}, next: ${NEXT[progress.stage]}`;
  }
  const out = [`# Anchor: ${id} "${ticket.frontmatter?.title ?? ''}"`, '', `Stage: ${where}`];
  for (const name of SECTIONS) {
    const s = ticket.sections.find((x) => headingKey(x.heading) === headingKey(name));
    const lines = s === undefined ? [] : stripHtmlComments(s.lines).map((l) => l.text).filter((t) => t.trim() !== '');
    out.push('', `## ${name}`, ...(lines.length === 0 ? ['(none)'] : lines));
  }
  const rulings = work?.ledger?.rulings ?? [];
  out.push('', '## Rulings', ...(rulings.length === 0 ? ['(none)'] : rulings));
  return out.join('\n') + '\n';
}
```

In `packages/core/src/index.ts` add `export { anchorText } from './status/anchor.js';`.

- [ ] **Step 4: Run the core tests to verify they pass**

Run: `npx vitest run --project core anchor`
Expected: PASS.

- [ ] **Step 5: Write the failing CLI tests**

Append to `packages/cli/test/lane-commands.test.ts`:

```ts
describe('accord anchor', () => {
  it('anchors the ticket the current branch names', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      gitRun(repo, 'checkout', '-q', '-b', 't/T-1');
      const r = await run(['anchor'], repo);
      expect(r.code).toBe(0);
      expect(r.out.startsWith('# Anchor: T-1 "Export"\n')).toBe(true);
    } finally {
      cleanup(repo);
    }
  });

  it('prints nothing on a branch that names no ticket', async () => {
    const repo = makeLaneRepo();
    try {
      commitAll(repo);
      const r = await run(['anchor'], repo);
      expect(r).toMatchObject({ code: 0, out: '' });
    } finally {
      cleanup(repo);
    }
  });

  it('refuses an explicit id that is not a lane ticket, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['anchor', 'NOPE'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('NOPE is not a lane ticket in accord/tickets/');
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 6: Run the CLI tests to verify they fail**

Run: `npx vitest run --project cli lane-commands`
Expected: FAIL — unknown command.

- [ ] **Step 7: Write the command**

Create `packages/cli/src/commands/anchor.ts`:

```ts
// Spec §6 `accord anchor [id]`: the active ticket's intent, vetoes, decisions, corrections, and position,
// for the SessionStart hook after compaction and for the first step of every stage skill. Without an id
// the active ticket is the current branch t/<id>; on any other branch there is nothing to anchor.
import { execFileSync } from 'node:child_process';
import { anchorText } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

function currentBranch(root: string): string | undefined {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    }).trim();
  } catch {
    return undefined; // an unborn HEAD names no branch yet
  }
}

export function anchor(ctx: CommandContext, id: string | undefined): number {
  if (id !== undefined) {
    const text = anchorText(ctx.snapshot, id);
    if (text === undefined) throw new UsageError(id + ' is not a lane ticket in accord/tickets/');
    ctx.stdout.write(text);
    return 0;
  }
  const m = /^t\/([^/]+)$/.exec(currentBranch(ctx.root) ?? '');
  if (m === null) return 0;
  const text = anchorText(ctx.snapshot, m[1]);
  // A hook must never fail a session start, so a branch naming no lane ticket is a notice, not an error.
  if (text === undefined) ctx.stderr.write(m[1] + ' is not a lane ticket in accord/tickets/; nothing to anchor\n');
  else ctx.stdout.write(text);
  return 0;
}
```

In `packages/cli/src/run.ts`, import and register after `next`:

```ts
  program
    .command('anchor [id]')
    .description("print the active ticket's intent, vetoes, decisions, corrections, and position")
    .action((id: string | undefined) => {
      setCode(anchor(preflight(opts), id));
    });
```

- [ ] **Step 8: Run both suites**

Run: `npx vitest run`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add packages/core/src packages/core/test/anchor.test.ts packages/cli/src packages/cli/test
git commit -m "feat(cli): accord anchor re-reads the active ticket's intent after compaction"
```

---

### Task 14: Lane templates and `new ticket --lane`

**Files:**
- Create: `packages/core/templates/ticket-lane.md`, `packages/core/templates/epic-lane.md`
- Regenerate: `packages/core/src/generated/templates.ts` (via `npm run gen`)
- Modify: `packages/cli/src/commands/new-ticket.ts`, `packages/cli/src/run.ts`
- Test: `packages/core/test/templates.test.ts`, `packages/cli/test/lane-commands.test.ts`

**Interfaces:**
- Produces: template names `ticket-lane.md`, `epic-lane.md`; CLI option `accord new ticket <id> --lane <M|L|P>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/core/test/templates.test.ts`:

```ts
describe('lane templates (spec §4)', () => {
  it.each<[TemplateName, string]>([
    ['ticket-lane.md', 'story'],
    ['epic-lane.md', 'epic'],
  ])('%s validates and declares a lane', (name, type) => {
    const fm = frontmatter(templates[name]);
    expect(validate('ticket', fm)).toEqual([]);
    expect(fm).toMatchObject({ type, status: 'draft' });
    expect(fm?.lane).toMatch(/^[MLP]$/);
  });

  it('lane headings are in spec order', () => {
    expect(headings(templates['ticket-lane.md'])).toEqual([
      '## Intent', '## Acceptance criteria', '## Vetoes', '## Decisions', '## Corrections', '## Open questions', '## Approach',
    ]);
    expect(headings(templates['epic-lane.md'])).toEqual([
      '## Intent', '## Vetoes', '## Decisions', '## Corrections', '## Open questions', '## Approach',
    ]);
  });
});
```

Append to `packages/cli/test/lane-commands.test.ts` (add `makeRepo` to the helpers import):

```ts
describe('accord new ticket --lane', () => {
  it('writes a lane story from ticket-lane.md with the lane set', async () => {
    const repo = makeRepo('valid-build');
    try {
      const r = await run(['new', 'ticket', 'NEW-1', '--lane', 'L'], repo);
      expect(r.code).toBe(0);
      const text = ticketText(repo, 'NEW-1');
      expect(text).toContain('id: "NEW-1"');
      expect(text).toMatch(/\nlane: "L"/);
      expect(text).toContain('\n## Vetoes\n');
      expect(text).not.toContain('\n## Requirements\n');
    } finally {
      cleanup(repo);
    }
  });

  it('an epic with --lane uses epic-lane.md', async () => {
    const repo = makeRepo('valid-build');
    try {
      await run(['new', 'ticket', 'EP-1', '--type', 'epic', '--lane', 'P'], repo);
      const text = ticketText(repo, 'EP-1');
      // setFrontmatterKey double-quotes every string it writes (D-45).
      expect(text).toContain('type: "epic"');
      expect(text).toMatch(/\nlane: "P"/);
      expect(text).not.toContain('## Acceptance criteria');
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run templates lane-commands`
Expected: FAIL — the templates do not exist and `--lane` is an unknown option.

- [ ] **Step 3: Write the templates**

Create `packages/core/templates/ticket-lane.md`:

````markdown
---
id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: story                                # story | bug. An epic uses its own template
status: draft                              # draft | open | archived. Document lifecycle only; work status stays in the tracker
lane: M                                    # M: one feature | L: a story of an epic | P: part of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# The epic this ticket belongs to.
# parent: "EPIC-ID"
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
# Written by `gate ready`; never edit by hand.
# ac_hash:
# Self-test ticks, e.g. [ac-1, ac-2]. Always the last key.
# verified: []
# The AC hash and the commit the ticks were made against.
# verified_hash:
# verified_commit:
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->

## Acceptance criteria
<!-- One fenced gherkin block; every scenario tagged @ac-n with a unique n; 2 to 5 scenarios.
A scenario that is not @ui also carries one @test:<id> tag naming the one test that proves it; add it during build, it is outside the AC hash. -->
```gherkin
Feature: TICKET-ID

  @ac-1
  Scenario: <observable outcome>
    Given ...
    When ...
    Then ...
```

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- About fifteen lines: the chosen option and why, rejected options and why, affected areas, risks, and which criterion is tested at which layer. -->
````

Create `packages/core/templates/epic-lane.md`:

```markdown
---
id: "TICKET-ID"                            # equals the file name: tickets/<id>.md
title: "Short title in business language"
type: epic                                 # an epic groups stories; its stories carry the acceptance criteria
status: draft                              # draft | open | archived. Document lifecycle only; work status stays in the tracker
lane: L                                    # L: an epic | P: an epic of a whole project
# Tickets that must reach done before this one can start.
# depends_on: ["OTHER-ID"]
# Ids in the tracker, a map keyed by adapter name; values are strings.
# tracker: { github-issues: "1234" }
ui: false
# Optional design reference URL for the epic's stories.
# design: "https://example.com/design/..."
# Written by `accord approve` after the owner says yes; never edit by hand.
# approved_hash:
---

## Intent
<!-- At most five lines: why, for whom, how success is measured, and what this does not do. -->

## Vetoes
<!-- What the owner forbids, in the owner's own words, one item per line. They bind every story of the epic. -->

## Decisions
<!-- Settled answers, one per line: - D-01 <decision> — "<the owner's sentence>" -->

## Corrections
<!-- Every correction the owner makes, verbatim, appended and never edited. -->

## Open questions
<!-- `- [ ]` items; Ready stays blocked while any is unchecked. -->

## Approach
<!-- The chosen option and why, rejected options and why, and the split into stories with their depends_on order. -->
```

Run: `npm run gen`
Expected: `generated 9 templates` among the output; `packages/core/src/generated/templates.ts` now holds both new keys.

- [ ] **Step 4: Add the option**

In `packages/cli/src/run.ts`, on the `new ticket` command add after the `--type` option:

```ts
    .addOption(new Option('--lane <lane>', 'write a lane ticket (M, L, or P)').choices(['M', 'L', 'P']))
```

and change the action signature to `(id: string, options: { type: 'epic' | 'story' | 'bug'; lane?: 'M' | 'L' | 'P' })`.

In `packages/cli/src/commands/new-ticket.ts`, change the options type to `{ type: 'epic' | 'story' | 'bug'; lane?: 'M' | 'L' | 'P' }` and replace the `name` and `text` lines with:

```ts
  const name =
    options.lane !== undefined
      ? options.type === 'epic'
        ? ('epic-lane.md' as const)
        : ('ticket-lane.md' as const)
      : options.type === 'epic'
        ? ('epic.md' as const)
        : (`ticket-${ctx.snapshot.config?.profile ?? 'build'}.md` as const);
  let text = setFrontmatterKey(templates[name].replaceAll(PLACEHOLDER, id), 'type', options.type);
  // Spec §3: the lane the caller chose; the template's own value is only a default for reading.
  if (options.lane !== undefined) text = setFrontmatterKey(text, 'lane', options.lane);
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx vitest run`
Expected: PASS, including the templates drift test and the denied-names scan over the new templates.

- [ ] **Step 6: Commit**

```bash
git add packages/core/templates packages/core/src/generated packages/core/test/templates.test.ts packages/cli/src packages/cli/test
git commit -m "feat(templates): lane ticket and epic templates, and new ticket --lane"
```

---

### Task 15: End-to-end flow, printed paths, and docs

**Files:**
- Create: `packages/cli/test/lane-flow.test.ts`
- Modify: `packages/cli/test/spawn-surface.test.ts`
- Modify: `docs/design.md`

- [ ] **Step 1: Write the flow test**

Create `packages/cli/test/lane-flow.test.ts`:

```ts
// One lane ticket through the phase 1 contract, end to end: approve, Ready, plan, two task-done runs,
// and the status row that reads the records back.
import { utimesSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanup, commitAll, makeLaneRepo, run } from './helpers/repo.js';

describe('lane ticket flow', () => {
  it('walks one ticket from unapproved to building', async () => {
    const repo = makeLaneRepo();
    try {
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(1);
      expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
      expect((await run(['gate', 'plan', 'T-1'], repo)).code).toBe(0);
      commitAll(repo);
      const later = new Date(Date.now() + 5000);
      utimesSync(join(repo, 'reports', 'junit.xml'), later, later);
      expect((await run(['task-done', 'T-1', '1'], repo)).code).toBe(0);
      expect((await run(['task-done', 'T-1', '1'], repo)).out).toContain('already recorded');
      const rows = JSON.parse((await run(['status', '--json'], repo)).out) as Record<string, unknown>[];
      expect(rows[0]).toMatchObject({ id: 'T-1', lane: 'M', stage: 'build', tasksDone: 1, tasksTotal: 2 });
      expect((await run(['anchor', 'T-1'], repo)).out).toContain('Stage: build 1/2, next: task 2 "Escaping"');
      expect((await run(['gate', 'done', 'T-1'], repo)).code).toBe(1);
    } finally {
      cleanup(repo);
    }
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx vitest run --project cli lane-flow`
Expected: PASS (every command it uses exists by now).

- [ ] **Step 3: Cover the new commands in the printed-paths guard**

In `packages/cli/test/spawn-surface.test.ts`, add to the `COMMANDS` array (each runs against `valid-build`, which has no lane ticket, so most reach a refusal that prints a path):

```ts
    { name: 'gate plan', argv: ['gate', 'plan', 'LOGIN-1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'approve (refusal)', argv: ['approve', 'LOGIN-1'], guard: 'accord/tickets/LOGIN-1.md' },
    { name: 'task-done (refusal)', argv: ['task-done', 'LOGIN-1', '1'] },
    { name: 'brief (refusal)', argv: ['brief', 'LOGIN-1', '1'], guard: 'accord/tickets/LOGIN-1/plan.md' },
    { name: 'next', argv: ['next'] },
    { name: 'anchor', argv: ['anchor'] },
```

Run: `npx vitest run --project cli spawn-surface`
Expected: PASS. If a guard string is not found, read the actual output and correct the guard to a path that command really prints; do not drop the guard.

- [ ] **Step 4: Point the design document at the workflow layer**

In `docs/design.md`, after the first paragraph under `# Accord design`, add:

```markdown
The workflow layer — lanes, owner approval, the plan gate, task records, review convergence, the traced-test policy, and re-anchoring after compaction — is specified in [specs/2026-10-12-workflow-layer-design.md](specs/2026-10-12-workflow-layer-design.md). Its contract applies to tickets that carry `lane:`; a ticket without it keeps every rule below.
```

- [ ] **Step 5: Run the full check**

Run: `npm run check`
Expected: build, lint, typecheck, and every test pass. Then `git status --short packages/core/test/__golden__` prints nothing.

- [ ] **Step 6: Commit**

```bash
git add packages/cli/test docs/design.md
git commit -m "test(cli): one lane ticket end to end, and printed-path coverage for the new commands"
```

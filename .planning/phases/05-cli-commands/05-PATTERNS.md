# Phase 5: CLI Commands - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 16 (12 new, 4 modified) + 2 test/fixture groups
**Analogs found:** 14 / 16 (two have no in-repo analog — see No Analog Found)

All paths below are git-tracked (`git ls-files` verified) and POSIX-separated.
No RESEARCH.md for this phase; analogs are the Phase 1–4 code.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/cli/src/index.ts` (mod — full rewrite) | entry + commander wiring | request-response | itself (Phase 1 placeholder) + `packages/core/src/index.ts` barrel style | role-match |
| `packages/cli/src/run.ts` (new — `runCli(argv, {cwd, stdout, stderr})`) | in-process entry | request-response | `packages/cli/src/load/fs.ts` (`UsageError` + exit-2 channel) | role-match |
| `packages/cli/src/commands/lint.ts` (new) | command | transform → text/JSON | `packages/core/src/lint/index.ts` (pure-call shape) wrapped per `renderText` | role-match |
| `packages/cli/src/commands/gate.ts` (new — `ready`/`done` + `ac_hash` write) | command + single write | transform + file-I/O | `packages/core/src/gate/index.ts` (call) + `packages/core/src/write/frontmatter.ts` (write primitive) | role-match |
| `packages/cli/src/commands/status.ts` (new) | command | batch transform | `packages/core/src/gate/index.ts` `scoped()` + `packages/core/src/gate/hash.ts` `acHash` | role-match |
| `packages/cli/src/commands/new-ticket.ts` (new) | command (scaffold write) | file-I/O | `packages/core/src/generated/templates.ts` + `packages/cli/src/load/fs.ts` write-side conventions | partial |
| `packages/cli/src/status/rows.ts` **or** `packages/core/src/status/rows.ts` (new — `StatusRow[]`) | model + pure transform | transform | `packages/core/src/gate/index.ts` `GateResult` shape + `scoped()` | exact |
| `packages/cli/src/render/table.ts` (new — ASCII `padEnd`) | renderer | transform | `packages/core/src/lint/render.ts` | exact |
| `packages/cli/src/render/color.ts` (new — `styleText` wrap of `renderText`) | renderer | transform | `packages/core/src/lint/render.ts` (D-60: wrap, never re-render) | exact |
| `packages/cli/src/pin.ts` (new — exact-string version pin, D-94) | guard | transform | `packages/cli/src/load/fs.ts` `UsageError` | role-match |
| `packages/cli/src/root.ts` (new — `git rev-parse --show-toplevel`, D-103) | loader (impure) | subprocess | `packages/cli/src/load/fs.ts` `gitTree`/`gitFacts` | exact |
| `packages/cli/src/tracker/github-issues.ts` (new) | adapter | request-response (network) | none — see No Analog Found | none |
| `packages/core/src/index.ts` (mod) | barrel | — | itself (D-55 pattern) | exact |
| `packages/cli/package.json` (mod — deps if any) | config | — | itself | exact |
| `.claude/CLAUDE.md` (mod — STACK Decision 6 "Version pin" row, D-94) | docs | — | itself | exact |
| `packages/cli/test/cli.test.ts`, `status.test.ts`, `pin.test.ts` (new) | tests | batch | `packages/cli/test/load.test.ts`, `packages/core/test/gate.test.ts` | exact |
| `packages/cli/test/bin.test.ts` (mod — the one real spawn) | spawn test | — | itself | exact |
| `packages/cli/test/fixtures/**` + `packages/cli/test/__golden__/*.json` (new) | fixtures/goldens | — | `packages/core/test/fixtures/gate-*/**`, `packages/core/test/__golden__/*.gate.json` | exact |

## Pattern Assignments

### `packages/cli/src/index.ts` + `run.ts` (entry, request-response)

**Analog:** `packages/cli/src/index.ts` (current placeholder — the shebang and the version read are the only lines that survive) and `packages/cli/src/load/fs.ts` (the exit-2 channel).

**Shebang + own-version read — keep verbatim** (`packages/cli/src/index.ts:1-4`). `tsdown.config.ts` depends on line 1 being exactly this, and `bin.test.ts` asserts it:

```typescript
#!/usr/bin/env node
// Phase 1 placeholder entry: proves the workspace link, ESM, and shebang. Phase 5 replaces it with commander.
import { schemaIds, validate } from '@accord-dev/accord-core';
import pkg from '../package.json' with { type: 'json' };
```

`import pkg from '../package.json' with { type: 'json' }` is the D-94/CLI-06 version source — never a spawn, never `npm view`.

**Exit-2 channel — reuse, do not invent a second** (`packages/cli/src/load/fs.ts:9-16`). The pin mismatch (D-94), the `ac_hash` write failure (D-97), and `new ticket` refusing to overwrite all throw this:

```typescript
/** Environment problem the user must fix (no git, not a repository, no accord/ folder); exit 2 in Phase 5. */
export class UsageError extends Error {
  readonly exitCode = 2;
  constructor(message: string) {
    super(message);
    this.name = 'UsageError';
  }
}
```

`runCli` catches it, prints `err.message` to **stderr**, returns `err.exitCode`. Every other error is exit 1 for a gate/lint verdict per STACK Decision 1; an unexpected throw is exit 2.

**Commander wiring:** no analog in repo. Per STACK Decision 1 / 7, `runCli` must use `exitOverride()` + `configureOutput({ writeOut, writeErr })` bound to the injected `stdout`/`stderr` so nothing reaches `process.*` from a test.

---

### `packages/cli/src/root.ts` (loader, subprocess)

**Analog:** `packages/cli/src/load/fs.ts` `gitTree` (lines 20-35).

**Spawn pattern — copy exactly** (git by name, literal argv, no shell, `stdio: ['ignore','pipe','pipe']`, ENOENT → `UsageError`):

```typescript
function gitTree(root: string): string[] {
  let out: string;
  try {
    out = execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], {
      cwd: root,
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'pipe'],
    });
  } catch (err) {
    const e = err as { code?: string; stderr?: string };
    if (e.code === 'ENOENT') throw new UsageError('git is required but was not found on PATH');
    const stderr = String(e.stderr ?? '').trim();
    throw new UsageError('not a git repository (or git failed): ' + root + '\n' + stderr);
  }
  return [...new Set(out.split('\0').filter((p) => p !== ''))].sort();
}
```

D-103's root resolver is the same body with `['rev-parse', '--show-toplevel']`, `cwd` from the injected `cwd`, and the result normalised with `.split(sep).join('/')` — the posix normalisation used at `fs.ts:49` and `fs.ts:63`:

```typescript
files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
```

The same `catch` shape covers `gh auth token` (D-102) — ENOENT is "no token", never an error.

---

### `packages/cli/src/commands/lint.ts` and `gate.ts` (command, transform)

**Analogs:** `packages/core/src/lint/index.ts`, `packages/core/src/gate/index.ts`, `packages/core/src/lint/render.ts`.

**The result shapes printed verbatim under `--json` (D-98).** Do not wrap, do not add keys. `GateResult` (`packages/core/src/gate/index.ts:12-18`):

```typescript
export interface GateResult {
  gate: 'ready' | 'done';
  ticket: string;
  verdict: 'pass' | 'fail';
  findings: Finding[]; // sorted by file, then line (line-less first), then rule, reason, pointer
  acHash?: string; // absent only when the ticket is unknown or carries no `@ac-n` scenario (D-86)
}
```

`LintResult` (`packages/core/src/lint/index.ts:6-10`):

```typescript
export interface LintResult {
  findings: Finding[];
  errors: number;
  warnings: number;
}
```

`lint` exits 1 when `result.errors > 0` (D-56); `gate` exits 1 when `verdict === 'fail'`.

**Text rendering — call, never re-implement** (`packages/core/src/lint/render.ts:5-13`). The CLI's only addition is `styleText` on the `level` token when `stdout.isTTY`:

```typescript
export function renderText(result: { findings: Finding[] }): string {
  const lines = result.findings.map(
    (f) => `${f.file}${f.line === undefined ? '' : ':' + f.line}: ${f.level} ${f.rule} ${f.reason}`,
  );
  const errors = result.findings.filter((f) => f.level === 'error').length;
  return [...lines, `${errors} errors, ${result.findings.length - errors} warnings`].join('\n') + '\n';
}
```

Note the parameter type `{ findings: Finding[] }` — a `GateResult` renders through it with no adapter, so `lint`, `gate ready`, and `gate done` share one printer.

**The `ac_hash` write (D-96/D-97)** — the primitive is pure and already handles quoting/comments (`packages/core/src/write/frontmatter.ts:15-22`):

```typescript
export type FrontmatterValue = string | boolean | string[];

export function setFrontmatterKey(text: string, key: string, value: FrontmatterValue): string {
```

CLI body: read the ticket file text, `const next = setFrontmatterKey(text, 'ac_hash', result.acHash)`, and write only `if (next !== text)` (D-96 mtime clause). A failed write raises `UsageError` **after** the gate result has already been printed (D-97).

---

### `packages/cli/src/status/rows.ts` + `commands/status.ts` (transform, batch)

**Analogs:** `packages/core/src/gate/index.ts` `scoped()` and `packages/core/src/gate/hash.ts` `acHash`.

**Per-ticket filter from one repo-wide lint (D-91)** — `packages/core/src/gate/index.ts:36-41`. It is module-exported but not on the public barrel; either export it from `packages/core/src/index.ts` (D-55 pattern) or place `statusRows()` in core beside it. Do not re-implement the string comparison in the CLI:

```typescript
export function scoped(findings: Finding[], id: string): Finding[] {
  const file = 'accord/tickets/' + id + '.md';
  const folder = 'accord/tickets/' + id + '/';
  const assets = 'accord/assets/' + id + '/';
  return findings.filter((f) => f.file === file || f.file.startsWith(folder) || f.file.startsWith(assets));
}
```

**Cheap columns (D-91)** — `packages/core/src/gate/hash.ts:33-38`, pure and synchronous:

```typescript
/** D-75: `fnv1a64:` plus 16 lowercase hex digits, or undefined when no scenario carries an `@ac-n` tag. */
export function acHash(scenarios: readonly ScenarioRef[]): string | undefined {
```

`Ready` = `—` when `frontmatter.ac_hash` is absent, `ok` when it equals `acHash(ticket.scenarios)`, else `stale`. `Ticks` = `verified.length`/tagged-scenario count plus `bound` when `verified_hash === acHash(...)`, else `stale`.

**Row fields come straight off `TicketFrontmatter`** (`packages/core/src/model/snapshot.ts:36-51`) — `id`, `type`, `status`, `parent`, `ui`, `tracker`. `status: 'archived'` is the D-93 filter; `type: 'epic'` renders `—` in `Ready`/`Ticks`.

**`StatusRow` shape — mirror `GateResult`:** a flat exported interface with a one-line comment per field, optional keys omitted (not `undefined`) so JSON goldens stay stable. Same `...(x === undefined ? {} : { x })` spread used at `gate/index.ts:77`.

**Sort — code-point compare, never locale** (`packages/core/src/gate/index.ts:21`). D-92 sorts by `(parent, id)`:

```typescript
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
```

**ASCII table** — no analog; build it on `padEnd` per STACK Decision 5, in the shape of `render.ts`: a single pure `renderRows(rows: StatusRow[]): string` returning text ending in `\n`, colour applied by the caller.

---

### `packages/cli/src/commands/new-ticket.ts` (command, file-I/O)

**Analog:** `packages/core/src/generated/templates.ts` (the template source) and `packages/core/src/index.ts` (the export).

Templates are already a frozen record on the public API — do not read `templates/*.md` from disk:

```typescript
export { templates } from './generated/templates.js';
export type { TemplateName } from './generated/templates.js';
```

Keys available: `epic.md`, `ticket-build.md`, `ticket-maintain.md`, `verification.md`, `business-rules.md`, `glossary.md`, `prototype-header.html`.

**D-104 substitution is textual and minimal.** Every template's frontmatter opens with `id: "TICKET-ID"` and the build/maintain templates carry `Feature: TICKET-ID` inside the gherkin fence — a global replace of `TICKET-ID` covers both. `type:` is set with `setFrontmatterKey(text, 'type', '<type>')`, which preserves the trailing `# epic | story | bug ...` comment (that is exactly what D-43/D-45 bought). `--type epic` selects `epic.md`; `story`/`bug` select `ticket-${config.profile}.md`.

Existing-file refusal: `existsSync` check before write, `throw new UsageError('ticket already exists: ' + relPath)` — the posix path, per the `fs.ts:49` normalisation.

---

### `packages/cli/src/pin.ts` (guard, transform)

No code analog; it is a two-string comparison. Shape it as a pure function taking `(pinned: string | undefined, running: string)` returning `string | undefined` (the message), so Phase 8's MCP host reuses it. The message must name both versions and the fix (ROADMAP criterion 3), and the caller throws `UsageError` with it. D-95: called by `lint`, `gate ready`, `gate done`, `status`, `new ticket`; not by `--version`/`--help`. A missing `accord/` folder must keep producing the existing `UsageError` from `fs.ts:44`, so load order is: root → `loadFromFs` → pin check.

---

### Tests

**Analog for golden tests:** `packages/core/test/gate.test.ts:1-30` — an explicit case table, `stableJson`, `toMatchFileSnapshot`, JSON of the structured object, never ANSI:

```typescript
// Phase 4 gate goldens. Gate results are ticket-scoped, so the case table is explicit rather than a
// directory scan. Regenerate one with `npm test -- --project core gate -u -t "<case name>"`.
interface Case {
  name: string;
  fixture: string;
  ticket: string;
  gate: 'ready' | 'done';
}
```

**Analog for CLI write/spawn tests:** `packages/cli/test/load.test.ts:31-45` — `mkdtempSync` sandbox plus the guard that refuses to run `git` outside `tmpdir()`. Any `new ticket` / `ac_hash` write test must copy this guard verbatim; it is the reason a green test run cannot commit the author's working tree:

```typescript
const makeTmp = () => mkdtempSync(join(tmpdir(), 'accord-fs-'));

function gitIn(tmp: string) {
  const root = realpathSync(tmp);
  if (!root.startsWith(realpathSync(tmpdir())) || root === realpathSync(process.cwd())) {
    throw new Error('refusing to run git outside a temporary sandbox: ' + tmp);
  }
```

**Analog for the one real spawn (ROADMAP criterion 4):** `packages/cli/test/bin.test.ts` — extend, do not start over. It already has the shebang assertion and `process.execPath`:

```typescript
const cli = fileURLToPath(new URL('../dist/cli.js', import.meta.url));

it('runs under process.execPath and prints the schema ids', () => {
  const out = execFileSync(process.execPath, [cli], { encoding: 'utf8' });
```

Its two existing assertions (`accord 0.1.0` banner, `schemas: ...`) test the placeholder and must be replaced with the commander surface.

## Shared Patterns

### Purity boundary
**Source:** `packages/core/src/model/snapshot.ts:1-2`, enforced by `packages/core/test/purity.test.ts` and ESLint.
**Apply to:** every file in this phase.
No `node:*` under `packages/core/src`. `node:fs`, `node:child_process`, `fetch`, `process.env`, and `styleText` all live in `packages/cli`. If `statusRows` or the pin comparison goes to core, it must take plain arguments and return plain data.

### POSIX paths
**Source:** `packages/cli/src/load/fs.ts:49`
```typescript
files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
```
**Apply to:** every printed path, every `StatusRow` field, the `new ticket` refusal message. A test asserts no `\` appears on Windows.

### Deterministic ordering
**Source:** `packages/core/src/gate/index.ts:21-30` (`cmp`, `byFileLineRule`)
**Apply to:** `StatusRow[]` sort (D-92) and any tracker result merge. Code-point compare only — goldens must be byte-identical on every host.

### Omit, never `undefined`
**Source:** `packages/core/src/gate/index.ts:77`
```typescript
...(hash === undefined ? {} : { acHash: hash }),
```
**Apply to:** `StatusRow` optional fields and any tracker enrichment. `JSON.stringify` of the result is the golden (D-54), so an explicit `undefined` key moves goldens for nothing.

### Decision citation in comments
**Source:** every core file header, e.g. `packages/core/src/gate/hash.ts:1-4`.
**Apply to:** every new file — a header comment naming the requirement id and the D-numbers it implements.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/cli/src/tracker/github-issues.ts` | adapter | request-response (network) | Nothing in the repo makes a network call. Build on global `fetch` (Node 22), `Promise.all` over one `GET /repos/{owner}/{repo}/issues/{n}` per linked ticket (D-101), token from `GITHUB_TOKEN` then `gh auth token` via the `execFileSync`+ENOENT pattern above (D-102), and every failure path degrading to `—` plus one stderr line with the exit code unchanged (D-100). |
| `packages/cli/src/render/table.ts` | renderer | transform | No table exists yet. `packages/core/src/lint/render.ts` is the *shape* analog (pure, colour-free, returns text ending in `\n`) but not the content; `padEnd` + ASCII only, per STACK Decision 5 and PITFALLS §12. |

Commander wiring itself also has no in-repo analog — `packages/cli/src/index.ts` is a raw `process.argv[2]` check. Follow STACK Decision 1 (`exitOverride`, `configureOutput`, the 0/1/2 table) rather than any existing file.

## Metadata

**Analog search scope:** `packages/core/src/**`, `packages/cli/src/**`, `packages/core/test/**`, `packages/cli/test/**`, `packages/core/templates/**`
**Files scanned:** 17
**Pattern extraction date:** 2026-09-15

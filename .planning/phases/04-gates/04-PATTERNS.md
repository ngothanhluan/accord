# Phase 4: Gates - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 14 (10 new, 4 modified) + 2 test/fixture groups
**Analogs found:** 14 / 14 (every new file has an in-repo analog; no RESEARCH.md needed)

All paths below are git-tracked (`git ls-files` verified) and POSIX-separated.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/gate/rules.ts` (new) | rule table + types | transform | `packages/core/src/lint/rules.ts` | exact |
| `packages/core/src/gate/index.ts` (new) | engine (`gateReady`, `gateDone`) | transform | `packages/core/src/lint/index.ts` | exact |
| `packages/core/src/gate/hash.ts` (new) | utility (FNV-1a 64) | transform | none — see No Analog Found |
| `packages/core/src/gate/refs.ts` (new) | utility (D-82 extract + resolve against `tree`) | transform | `packages/core/src/lint/tokens.ts` `derivedFrom` + `prototypeDerivation` | role-match |
| `packages/core/src/gate/ready.ts` (new) | rule checks | transform | `packages/core/src/lint/ticket.ts` / `tokens.ts` check exports | exact |
| `packages/core/src/gate/done.ts` (new) | rule checks | transform | `packages/core/src/lint/gherkin.ts` (joins scenarios x `snapshot.tests`) | exact |
| `packages/core/src/model/snapshot.ts` (mod) | model (type-only) | — | itself (`tests?` from D-72 is the precedent for `git?`) | exact |
| `packages/core/schemas/ticket.schema.json` (mod) | schema | — | itself (`ac_hash`, `verified` properties) | exact |
| `packages/core/src/index.ts` (mod) | barrel | — | itself (D-55 pattern) | exact |
| `packages/cli/src/load/fs.ts` (mod) | loader (impure) | file-I/O + subprocess | itself (`gitTree` `execFileSync`) | exact |
| `packages/core/test/gate.test.ts` (new) | golden test | batch | `packages/core/test/lint.test.ts` | exact |
| `packages/core/test/hash.test.ts` / `refs.test.ts` (new) | unit test | — | `packages/core/test/tokens.test.ts` | exact |
| `packages/core/test/fixtures/gate-*/**` (new) | fixtures | — | `packages/core/test/fixtures/verification-edges/**` | exact |
| `packages/core/test/__golden__/*.gate.json` (new) | goldens | — | `packages/core/test/__golden__/valid-build.lint.json` | exact |

## Pattern Assignments

### `packages/core/src/gate/rules.ts` (rule table, transform)

**Analog:** `packages/core/src/lint/rules.ts`

**Header + imports** (lines 1–5, 36–37) — decision numbers in the comment, `type`-only imports, `.js` suffixes, checks imported from sibling modules:

```typescript
// CORE-04 rule matrix (D-57): one row per rule id with its level and profiles. The engine stamps
// `rule` and `level` from the row (D-58), so a level literal for a `lint.*` rule appears nowhere else.
import type { Finding, Level } from '../model/finding.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { prototypeDerivation, tokenHardcoded, tokensMissing } from './tokens.js';
```

**Row type — this is the shape D-88 mirrors** (lines 38–46). Note the template-literal id type, which the gate table changes to `` `gate.${string}` ``:

```typescript
/** What a check returns; the engine adds `rule` and `level` from the table row. */
export type Draft = Omit<Finding, 'level' | 'rule'>;

export interface Rule {
  id: `lint.${string}`; // D-59: mirrors the loader's `load.<name>` ids
  level: Level; // D-56
  profiles: readonly ('build' | 'maintain')[]; // D-57: both, for every rule in v0.1
  check: (snapshot: RepoSnapshot) => Draft[]; // pure; reads the snapshot only
}
```

**Table rows** (lines 48–52) — one line per rule, `readonly Rule[]`, no grouping, no nesting:

```typescript
export const RULES: readonly Rule[] = [
  { id: 'lint.id-mismatch', level: 'error', profiles: ['build', 'maintain'], check: idMismatch },
  { id: 'lint.test-tag-missing', level: 'warning', profiles: ['build', 'maintain'], check: testTagMissing },
];
```

Gate deltas: the gate check signature needs the ticket id (`check: (snapshot, id) => Draft[]`), and D-88's `maintain` downgrade list is a second exported `const` of rule ids next to `RULES`, not a column.

---

### `packages/core/src/gate/index.ts` (engine, transform)

**Analog:** `packages/core/src/lint/index.ts` (33 lines — the whole engine)

**Sort + engine** (lines 12–33). Copy `cmp`/`byFileLineRule` verbatim (code-point compare, never `localeCompare`, so goldens match on every OS), and copy the `.map((d) => ({ ...d, rule: r.id, level: r.level }))` stamping:

```typescript
// Code-point order, never a locale-aware compare, so the goldens are identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

const byFileLineRule = (a: Finding, b: Finding): number =>
  cmp(a.file, b.file) ||
  (a.line ?? 0) - (b.line ?? 0) ||
  cmp(a.rule, b.rule) ||
  cmp(a.reason, b.reason) ||
  cmp(a.pointer ?? '', b.pointer ?? '');

/** Pure: reads the snapshot only, never mutates it, and returns the same result on every call. */
export function lintSnapshot(snapshot: RepoSnapshot): LintResult {
  const profile = snapshot.config?.profile ?? 'build';
  const loaded = snapshot.errors.filter((f) => f.rule !== 'schema.if').map((f) => ({ ...f, level: 'error' as const }));
  const linted = RULES.filter((r) => r.profiles.includes(profile)).flatMap((r) =>
    r.check(snapshot).map((d) => ({ ...d, rule: r.id, level: r.level })),
  );
  const findings = [...loaded, ...linted].sort(byFileLineRule);
  const errors = findings.filter((f) => f.level === 'error').length;
  return { findings, errors, warnings: findings.length - errors };
}
```

Gate deltas per D-87/D-89: `const profile = snapshot.config?.profile ?? 'build'` is the same line; the D-89 Ready path calls `lintSnapshot(snapshot)` and filters its findings by ticket scope + `level === 'error'` instead of re-running rules; `verdict` is derived exactly the way `errors` is above (`findings.some((f) => f.level === 'error')`).

**Renderer — reused with no change.** `renderText` (`packages/core/src/lint/render.ts`, lines 4–9) takes a `LintResult`, i.e. `{ findings, errors, warnings }`. D-87 says `GateResult` renders through it unchanged, so `GateResult` must either carry those three fields or the gate must build a `LintResult`-shaped value at the call site — flag this to the planner as the one shape decision D-87 leaves implicit.

---

### `packages/core/src/gate/refs.ts` (utility, transform)

**Analog:** `packages/core/src/lint/tokens.ts` — `derivedFrom` (lines 163–178) is the token-extraction pattern, `prototypeDerivation` (lines 210–225) is the resolve-against-`snapshot.tree` pattern D-82 extends from exact match to suffix match.

**Extract-then-clean pattern** (`derivedFrom`, tokens.ts lines 170–176) — split, trim, strip a leading marker, drop placeholders, normalise:

```typescript
  const paths = entries
    .map((e) => e.trim().replace(/^-\s+/, ''))
    .filter((e) => e !== '' && !(e.startsWith('<') && e.endsWith('>')))
    .map(normaliseKey);
```

**Resolve against the tree + emit a Draft** (`prototypeDerivation`, tokens.ts lines 219–222) — the exact-match form D-82 replaces with a segment-boundary suffix test:

```typescript
      for (const p of d.paths) {
        if (!snapshot.tree.includes(p)) out.push({ file, line: d.line, reason: `"Derived from:" path "${p}" is not in the repository` });
      }
```

**Check export shape** (tokens.ts lines 200–208) — every rule body is `export const <name>: Rule['check'] = (snapshot) => {...}`, guards return `[]` early, findings carry `file` + `line` (+ `pointer` for config/frontmatter):

```typescript
/** D-67: a configured tokens file absent from the snapshot; the allowlist check is skipped. */
export const tokensMissing: Rule['check'] = (snapshot) => {
  const key = tokensKey(snapshot);
  if (key === undefined || key in snapshot.files) return [];
  return [{ file: CONFIG, pointer: '/design/tokens', reason: `...` }];
};
```

Also copy the file-local `const` helpers at the top (`CONFIG`, `SOURCE`, `Set`-based allowlists built from a template literal split on `/\s+/`) — that is how D-74's discretionary "recognised file-extension set" should be expressed.

---

### `packages/core/src/gate/done.ts` (rule checks, transform)

**Analogs:** `packages/core/src/lint/gherkin.ts` (scenario x `snapshot.tests` join, the same join GATE-08 needs) and `packages/core/src/load/verification.ts` for the block shape it consumes.

`parseVerification` already settles what Done must not re-do (verification.ts lines 18–19, 29–39): duplicates by tag, and `load.result-invalid` as a loader finding. Done reads `verification.blocks` (`EvidenceBlock[]`) and never re-scans the Markdown:

```typescript
  // D-40 applied by tag (D-42): the first block with a tag wins, later ones are skipped.
  findings.push(...duplicateHeadings(file, sections, tagOf));
```

`EvidenceBlock` fields the gate consumes (`packages/core/src/model/snapshot.ts` lines 59–65): `acTag`, `name`, `line`, `result?`, `evidence` (already trimmed, may be `''`).

---

### `packages/core/src/model/snapshot.ts` (model, type-only)

**Analog:** itself. The D-72 `tests?` field is the exact precedent for D-78's `git?` — optional, host-supplied, plain record, decision number in the trailing comment (lines 5–8, 91):

```typescript
export interface SnapshotInput {
  files: Record<string, string>; // repo-relative key -> text; everything under accord/ plus the tokens file (D-30)
  tree: string[]; // every path in the repository, content-free (D-30)
}
...
  tests?: Record<string, 'passed' | 'failed' | 'skipped'>; // D-72: absent when no report is in files
```

File header constraint that governs the D-78 addition (lines 1–2): **"Plain records and arrays, never Map/Set, so JSON.stringify of a snapshot is the golden (D-54)."**

D-76's two keys go next to the existing pair (lines 40–41):

```typescript
  ac_hash?: string;
  verified?: string[]; // ['ac-1']
```

---

### `packages/core/schemas/ticket.schema.json` (schema)

**Analog:** itself. `additionalProperties: false` at the top, so both new keys must be declared. Copy the existing shape:

```json
    "ac_hash": { "type": "string", "minLength": 1 },
    "verified": {
      "type": "array",
      "uniqueItems": true,
      "items": { "type": "string", "pattern": "^ac-[1-9][0-9]*$" }
    }
```

`verified_hash` should follow `ac_hash` with a `pattern` for `^fnv1a64:[0-9a-f]{16}$` (D-75 makes the prefix load-bearing); `verified_commit` a hex `pattern` with `minLength: 7` (D-81). No `format:` — the project prefers `pattern` so the schema stays self-contained.

---

### `packages/core/src/index.ts` (barrel)

**Analog:** itself (lines 1–2, 17–20). Values and types exported separately, one comment naming the decision, internals stay private:

```typescript
// D-55 public API: loadSnapshot, lintSnapshot, renderText, the model types, and the Phase 1 exports.
// load/* and lint/* internals (including RULES) stay private.
export { lintSnapshot } from './lint/index.js';
export type { LintResult } from './lint/index.js';
```

Add `export { gateReady, gateDone }` + `export type { GateResult }`. `gate/rules.ts` stays unexported, exactly as `RULES` does.

---

### `packages/cli/src/load/fs.ts` (loader, subprocess + file-I/O)

**Analog:** itself — `gitTree` (lines 19–34) is the pattern for D-78's `git.commit` / `git.authors`:

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

Copy verbatim for `git show -s` and `git log -1 <file>`: `execFileSync('git', ...)` by name (never `.cmd`, never `shell: true`), `-z` or an explicit `--format`, `stdio: ['ignore','pipe','pipe']`, `UsageError` on ENOENT. Path keys are posix-ised with `.split(sep).join('/')` (line 46) — the `git.authors` record keys must go through the same step.

---

### `packages/core/test/gate.test.ts` (golden test, batch)

**Analog:** `packages/core/test/lint.test.ts` (lines 1–45). Fixture discovery by directory scan, `beforeAll` (never collection-time reads, so `-t` filtering stays cheap), regeneration command in the header comment:

```typescript
// Phase 3 lint goldens: one per fixture folder under test/fixtures/ that has an accord/ directory,
// mirroring snapshot.test.ts. Regenerate one with `npm test -- --project core lint -u -t "fixture <name>"`.
const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(fixturesDir, d.name, 'accord')))
  .map((d) => d.name)
  .sort();

for (const name of fixtures) {
  describe('fixture ' + name, () => {
    let v: Variants;
    let result: LintResult;
    // Read inside the hook, never at collection time, so a `-t` filter never touches sibling fixtures.
    beforeAll(() => {
      v = variants(readFixture(name));
      result = lintSnapshot(loadSnapshot(v.lf));
    });
```

Golden serialisation uses `stableJson` from `packages/core/test/helpers/fixture.ts` (lines 53–66, sorted keys at every depth) with `toMatchFileSnapshot`. Existing goldens live at `packages/core/test/__golden__/<fixture>.lint.json`; gate goldens follow as `<fixture>.gate.json`.

**Note for the fixture work:** `readFixture` derives `tree` from the files it reads (`tree: Object.keys(files).sort()`, line 18) — so a gate fixture that needs `test/login.spec.ts` in the tree for D-82 must contain that file on disk, which is exactly the `valid-build` gap CONTEXT flags.

`git` facts (D-78) are not producible by `readFixture`; the gate test must layer them on top of the returned `SnapshotInput`, the way `variants()` returns derived inputs (lines 40–51).

---

### `packages/core/test/hash.test.ts`, `refs.test.ts` (unit tests)

**Analog:** `packages/core/test/tokens.test.ts` (lines 1–5) — imports the module's internals directly (not the barrel), pins the heuristic's edges in one file, `const body = (...lines) => lines.join('\n')` for literals with explicit line numbers in comments:

```typescript
// D-66 to D-68: token extraction, value classification, the prototype scanner, and the `Derived from:` header,
// pinned on the research probe (RESEARCH.md "Token Rule") so the heuristic's edges are visible in one file.
import { describe, expect, it } from 'vitest';
import { derivedFrom, offending, scanPrototype, tokenNames } from '../src/lint/tokens.js';

const body = (...lines: string[]) => lines.join('\n');
```

This is also the home for D-88's downgrade-function unit test with synthetic rows (ROADMAP criterion 5) and for D-85's two Vietnamese cases from CONTEXT `<specifics>`.

## Shared Patterns

### Rule id and level discipline (D-56/D-57/D-58/D-59)
**Source:** `packages/core/src/lint/rules.ts` lines 1–2, 41–46
**Apply to:** every file under `gate/`
A level literal never appears in a check body — the table owns `level`, the engine stamps it. Gate ids are `gate.<kebab-name>` typed as `` `gate.${string}` ``.

### Finding shape
**Source:** `packages/core/src/model/finding.ts` lines 5–12
**Apply to:** every gate check
```typescript
export interface Finding {
  file: string; // repo-relative, forward slashes: 'accord/tickets/LOGIN-1.md'
  line?: number; // 1-based line in that file; absent for file-level findings
  rule: string; // dotted id: 'schema.required', 'load.frontmatter-missing', 'lint.id-mismatch'
  reason: string; // ajv message or loader text
  pointer?: string; // JSON pointer inside frontmatter or config.yml: '' = root, '/tracker', '/verified/2'
  level: Level; // D-56: an error fails lint; a warning never changes the exit code
}
```
Gate checks return `Draft` (`Omit<Finding, 'level' | 'rule'>`). Use `pointer` for frontmatter-scoped reasons (`/verified_hash`, `/ac_hash`) and `line` for Markdown-scoped ones.

### Core purity — no configuration needed
**Source:** `eslint.config.js` lines 5–28; `packages/core/test/purity.test.ts` lines 26–61, 97–104
**Apply to:** every file under `packages/core/src/gate/`
The ESLint block globs `packages/core/src/**/*.ts`, so `gate/` is covered the moment the folder exists — no config edit in this phase. Layer B is `types: []` in `packages/core/tsconfig.json` plus no `@types/node`. This is what forces D-75's hand-written FNV-1a (`node:crypto` is in `nodeBuiltins`). No new purity test is needed; the existing probes already cover any new core folder.

### Determinism for goldens
**Source:** `packages/core/src/lint/index.ts` lines 12–13; `packages/core/src/model/snapshot.ts` lines 1–2
Code-point `cmp`, never `localeCompare`. Plain records/arrays, never `Map`/`Set`, in anything that reaches a golden — this constrains `git.authors` to a `Record` (which D-78 already specifies) and `GateResult.findings` to an array.

### Decision citation in comments
**Source:** every core file's first two lines
Each new file opens with a comment naming the requirement id and the decision numbers it implements, e.g. `// GATE-01/GATE-03 AC hash (D-75, D-77): FNV-1a 64, `fnv1a64:<16 hex>`.`

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/core/src/gate/hash.ts` | utility | transform | No hashing exists anywhere in core. D-75 fully specifies it (FNV-1a 64-bit, ~10 lines, `fnv1a64:` prefix, lowercase hex). Only the file header + export style come from the analogs; the algorithm is written from the decision. Note: JS has no `u64` — use `BigInt` with an explicit `& 0xFFFFFFFFFFFFFFFFn` mask, and pin the pinned-vector test in `hash.test.ts`. |
| `packages/core/src/gate/ready.ts` "scope filter" over `lintSnapshot` output (D-89) | engine | transform | No existing code filters findings by ticket scope. Composition is new; the `Finding.file` prefix test (`accord/tickets/<id>.md`, `accord/tickets/<id>/`, `accord/assets/<id>/`) has no precedent to copy. |

## Metadata

**Analog search scope:** `packages/core/src/{lint,load,model,write,validate}`, `packages/core/schemas`, `packages/core/test`, `packages/cli/src`, `eslint.config.js`
**Files scanned:** 24 tracked source files enumerated; 14 read
**Pattern extraction date:** 2026-09-14

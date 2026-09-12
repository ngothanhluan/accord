# Phase 2: Core Model and Loading - Pattern Map

**Mapped:** 2026-09-06
**Files analyzed:** 17 (13 new, 4 modified)
**Analogs found:** 14 / 17 (3 have only partial analogs; see "No Analog Found")

The Phase 1 codebase is small (5 source files, 5 test files, 1 script). Every analog below was read in full; line numbers are exact. Where Phase 1 has no analog, the closest reusable code is a test helper (`templates.test.ts` already contains a working frontmatter split, `yaml` core-schema parse, and HTML-comment stripper) that Phase 2 promotes into `src/`.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/model/finding.ts` (modify, D-52) | model | - | itself (`src/model/finding.ts`) | exact |
| `packages/core/src/model/snapshot.ts` (new: `SnapshotInput`, `RepoSnapshot`, `Ticket`, `TicketFrontmatter`, `ScenarioRef`, `Verification`, `AccordConfig`) | model | - | `src/model/finding.ts` (comment-per-field interface style) + ARCHITECTURE.md Pattern 2 sketch | role-match |
| `packages/core/src/load/frontmatter.ts` (new) | utility/parser | transform (text -> object + line offset) | `test/templates.test.ts` lines 10-30 (`FRONTMATTER`, `stringNumerics`, `normalise`, `frontmatter()`) | exact (test helper to promote) |
| `packages/core/src/load/sections.ts` (new, fence-aware scanner) | utility/parser | transform (lines -> `Section[]`) | `test/convention.test.ts` lines 17-23 (`section()` line slicer) + `templates.test.ts` line 32-33 | partial |
| `packages/core/src/load/gherkin.ts` (new) | utility/parser | transform (fence -> `ScenarioRef[]`, errors -> `Finding[]`) | none in repo; API verified by probe (see excerpt) | none |
| `packages/core/src/load/verification.ts` (new) | utility/parser | transform (body -> `Verification`) | `load/sections.ts` (same scanner) + `templates/verification.md` layout | partial |
| `packages/core/src/load/snapshot.ts` (new, `loadSnapshot`) | service (pure orchestrator) | batch transform (`SnapshotInput` -> `RepoSnapshot`) | `src/validate/ajv.ts` lines 21-29 (findings mapping) | role-match |
| `packages/core/src/write/frontmatter.ts` (new, `setFrontmatterKey`) | utility | transform (text -> text) | none in repo; `yaml` API verified by probe | none |
| `packages/core/src/validate/ajv.ts` (modify: `path` -> `pointer`) | service | transform | itself | exact |
| `packages/core/src/index.ts` (modify, D-55) | barrel | - | itself | exact |
| `packages/core/test/fixtures/<name>/accord/**` (new fixture folders) | fixture | file-I/O (test only) | `templates/ticket-build.md`, `epic.md`, `verification.md`; `test/fixtures/purity/` (fixture dir convention) | exact |
| `packages/core/test/helpers/fixture.ts` or inline in test (new: dir -> `SnapshotInput`) | test utility | file-I/O | `test/templates.test.ts` lines 9, 127-131 (`fileURLToPath(new URL('../templates/', import.meta.url))`, `readdirSync`, `normalise`) | exact |
| `packages/core/test/snapshot.test.ts` (new; goldens per fixture, CRLF/BOM/backslash variants) | test | golden | `test/schemas.test.ts` lines 44-58, 161-167 | exact |
| `packages/core/test/write.test.ts` (new; `setFrontmatterKey` round-trip goldens) | test | golden (Markdown text) | `test/schemas.test.ts` lines 54-56 (`toMatchFileSnapshot`) | role-match |
| `packages/core/test/schemas.test.ts` + `test/__golden__/*.invalid.json` (modify: `path` -> `pointer`) | test + golden | - | themselves | exact |
| `packages/cli/src/load/fs.ts` (new, D-51) | loader (impure) | file-I/O + child_process | `test/purity.test.ts` lines 63-71 (`execFileSync(process.execPath, ...)`) + `scripts/gen-templates.mjs` lines 5-10 (read dir, normalise) | role-match |
| `packages/cli/test/load.test.ts` (new) | test | file-I/O | `packages/cli/test/bin.test.ts` | role-match |
| `.gitattributes` (modify: drop `crlf-*` line, D-53) | config | - | itself | exact |

## Pattern Assignments

### `packages/core/src/model/finding.ts` (model) and `model/snapshot.ts`

**Analog:** `packages/core/src/model/finding.ts` lines 1-5 (the whole file)

```typescript
export interface Finding {
  path: string; // JSON pointer from ajv instancePath: '' = document root, '/tracker', '/verified/2'
  rule: string; // 'schema.' + ajv keyword, e.g. 'schema.required', 'schema.additionalProperties'
  reason: string; // ajv message, e.g. "must have required property 'repo'"
}
```

**Copy:** plain `interface`, no class, one trailing comment per field giving an example value. D-52 target shape: `{ file: string; line?: number; rule: string; reason: string; pointer?: string }`. Keep the decision number in a comment (`// D-52`), matching the existing `// D-20 seam` convention in `src/validate/index.ts` line 1.

**For `model/snapshot.ts`:** ARCHITECTURE.md lines 180-190 is the sketch, but D-28/D-46 override it: use `Record<string, Ticket>` (not `Map`) and `string[]` (not `Set`) so `JSON.stringify` of the whole snapshot is the golden (D-54). Type-only files carry no imports; `verbatimModuleSyntax` is on (`tsconfig.base.json` line 7), so consumers must `import type`.

---

### `packages/core/src/load/frontmatter.ts` (parser, transform)

**Analog:** `packages/core/test/templates.test.ts` lines 4-5, 10-30. This is working, tested code; move it into `src/` and have the test import it.

**Imports pattern** (lines 4-5):
```typescript
import { parse } from 'yaml';
import type { Tags } from 'yaml';
```

**Core pattern** (lines 10-30):
```typescript
const BOM = String.fromCharCode(0xfeff);
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;

// STACK.md Decision 2: core schema, numerics stay strings (Pitfall 10 typing).
const stringNumerics = (tags: Tags) =>
  tags.filter((t) => !/int|float/.test(typeof t === 'string' ? t : t.tag));

const normalise = (text: string) =>
  (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');

function frontmatter(md: string): Record<string, unknown> | null {
  const m = FRONTMATTER.exec(normalise(md));
  return m ? (parse(m[1], { schema: 'core', customTags: stringNumerics }) as Record<string, unknown>) : null;
}
```

**Phase 2 additions the analog lacks (D-32, D-33, D-38):**
- Return the body line offset: `bodyLineOffset = m[0].split('\n').length - 1` (STACK.md line 94).
- Use `parseDocument(m[1], { schema: 'core', customTags: stringNumerics, lineCounter })` instead of `parse` so `doc.errors` (YAML syntax, with `.linePos`) and JSON-pointer-to-node line mapping are available. Verified on yaml 2.9.0:
  ```typescript
  import { parseDocument, LineCounter, isMap } from 'yaml';
  const lc = new LineCounter();
  const doc = parseDocument(yamlText, { schema: 'core', customTags: stringNumerics, lineCounter: lc });
  // D-33: pointer '/b/c' -> node -> line (1-based within the YAML text; add 1 for the opening `---`)
  const node = doc.getIn(['b', 'c'], true) as { range?: [number, number, number] };
  const { line } = lc.linePos(node.range![0]); // -> { line: 3, col: 6 } for "a: 1\nb:\n  c: 2\n"
  if (!isMap(doc.contents)) { /* D-33: non-map -> line 2 */ }
  ```
- Ajv `instancePath` such as `/verified/2` splits on `/` into the `getIn` path (`['verified', 2]`); for `additionalProperties` the offending key is `error.params.additionalProperty` (ajv `ErrorObject.params`), so point at that key's node rather than the parent.

---

### `packages/core/src/load/sections.ts` (fence-aware scanner, transform)

**Analog (partial):** `packages/core/test/convention.test.ts` lines 15-23 for the "slice lines between headings" shape; `templates.test.ts` lines 32-33 for heading and HTML-comment regexes.

```typescript
// convention.test.ts 17-23
function section(text: string, from: string, to: string): string {
  const lines = text.split('\n');
  const start = lines.findIndex((l) => l.startsWith(from));
  if (start < 0) return '';
  const end = lines.findIndex((l, i) => i > start && l.startsWith(to));
  return lines.slice(start, end < 0 ? undefined : end).join('\n');
}
// templates.test.ts 32-33
const headings = (md: string) => md.split('\n').filter((line) => line.startsWith('## '));
const stripHtmlComments = (text: string) => text.replace(/<!--[\s\S]*?-->/g, '');
```

**What to change:** operate on `{ text: string; line: number }[]` (1-based, offset by `bodyLineOffset`) instead of strings so every `Section` and every EARS line (D-41) keeps its Markdown line; track fence state per STACK.md Decision 4 lines 111-113 (```` ``` ```` or `~~~`, >= 3 chars, closing fence at least as long, info string captured; headings recognised at column 0 only while outside a fence). Heading normalisation for D-39: `line.replace(/^##\s+/, '').replace(/\s+#+\s*$/, '').trim().replace(/\s+/g, ' ').toLowerCase()`. `stripHtmlComments` must be applied per section on the joined text, then re-split, or done with a line-state flag so line numbers survive; the multi-line comments in `templates/ticket-build.md` lines 25-28 and 50-51 are the test case.

---

### `packages/core/src/load/gherkin.ts` (parser, transform)

**Analog:** none in repo. API verified by running `@cucumber/gherkin` 42.0.1 in this session:

```typescript
import { AstBuilder, Errors, GherkinClassicTokenMatcher, Parser, dialects } from '@cucumber/gherkin';
import { IdGenerator } from '@cucumber/messages';

const parser = new Parser(new AstBuilder(IdGenerator.incrementing()), new GherkinClassicTokenMatcher());
try {
  const doc = parser.parse(fenceText);           // fenceText: fence content, `Feature:` prepended if absent
  doc.feature?.language;                          // 'vi' for `# language: vi`
  doc.feature?.children;                          // [{ background? , scenario?, rule? }]; rule.children nests again (D-49)
  // scenario.keyword is DIALECT-NATIVE ("Kịch bản"), so D-50 needs:
  const d = dialects[doc.feature!.language];
  const keyword = d.scenarioOutline.includes(sc.keyword) ? 'Scenario Outline' : 'Scenario';
  // sc.location.line is 1-based within fenceText -> markdownLine = fenceStartLine + sc.location.line - (prependedFeature ? 2 : 1) + 1
} catch (e) {
  if (e instanceof Errors.CompositeParserException) {
    for (const err of e.errors) err.location; // { line: 4, column: 3 }; err.message starts "(4:3): expected: ..."
  }
}
```

Use `IdGenerator.incrementing()` (not `uuid()`) so output is deterministic for goldens. `@cucumber/messages` is a direct dependency of `@cucumber/gherkin` and can be imported without adding it to `package.json` only if the bundler resolves it; safer to add it as an explicit dependency in `packages/core/package.json` (ESLint purity rule does not ban it). Steps for D-47/D-48: `background.steps` then `scenario.steps`, each as `${step.keyword.trim()} ${step.text}` plus `step.docString?.content` and `step.dataTable?.rows[].cells[].value`, plus `scenario.examples[].tableHeader/tableBody`; collapse whitespace with `.replace(/\s+/g, ' ').trim()`.

---

### `packages/core/src/load/verification.ts` (parser, transform)

**Analog (partial):** `load/sections.ts` output. Layout to read: `packages/core/templates/verification.md` lines 10-15.

```markdown
## @ac-1 <scenario name>

Result: pass
<!-- pass | fail | blocked -->

Evidence: <what was run or inspected, may span several lines>
```

Heading regex `^@(ac-[1-9][0-9]*)\b(.*)$` on the normalised section heading; D-42 `Result:` regex `^Result:\s*(pass|fail|blocked)\s*$` on comment-stripped lines; `Evidence:` is the rest of the section from after the label, trimmed. The `verification.schema.json` (`ticket`, `commit`, `reviewed_on`) is validated through the same `frontmatter.ts` + `validate('verification', …)` path as tickets.

---

### `packages/core/src/load/snapshot.ts` (pure orchestrator, batch)

**Analog:** `packages/core/src/validate/ajv.ts` lines 21-29 for "return findings, never throw":

```typescript
export function validate(schemaId: SchemaId, doc: unknown): Finding[] {
  const v = validators[schemaId];
  if (v(doc)) return [];
  return (v.errors ?? []).map((e: ErrorObject) => ({
    path: e.instancePath,          // becomes `pointer` in D-52
    rule: `schema.${e.keyword}`,
    reason: e.message ?? e.keyword,
  }));
}
```

**Copy:** the `rule` namespacing (`schema.<keyword>`); Phase 2 loader rules should follow the same dotted style (`load.frontmatter-missing`, `load.yaml-syntax`, `load.gherkin-parse`, `load.heading-duplicate`, `load.orphan-verification`, `load.result-invalid`, `load.config-missing`). Import `validate` via the seam `../validate/index.js` (never `./ajv.js`; ESLint blocks `ajv/*` outside the seam, `eslint.config.js` lines 32-41).

**Key normalisation (D-29):** `key.replace(/\\/g, '/').replace(/^\.\//, '')`. Then classify with `path.posix`-free string ops (core cannot import `node:path`): ticket = `/^accord\/tickets\/([^/]+)\.md$/`, verification = `/^accord\/tickets\/([^/]+)\/verification\.md$/`. Sort keys before iterating so `tickets`/`errors` order is stable across hosts (D-54).

---

### `packages/core/src/write/frontmatter.ts` (`setFrontmatterKey`, transform)

**Analog:** none in repo. `yaml` 2.9.0 API verified in this session:

```typescript
import { parseDocument, Scalar, isSeq } from 'yaml';
const doc = parseDocument(yamlText, { schema: 'core', customTags: stringNumerics });
doc.set('verified', doc.createNode(['ac-1']));
const seq = doc.get('verified', true);
if (isSeq(seq)) { seq.flow = false; for (const it of seq.items) (it as Scalar).type = Scalar.QUOTE_DOUBLE; }
doc.toString({ lineWidth: 0 });
// -> 'id: "X" # c\nverified:\n  - "ac-1"\n'   (comment survived, block list, quoted items)
```

Empty list (D-44): `seq.flow = true` when `items.length === 0` yields `verified: []`. Key ordering (D-43): `doc.contents.items` is an array of `Pair`s; to insert before `verified`, `splice` a new `Pair` at `items.findIndex(p => p.key.value === 'verified')`. Reassemble as `'---\n' + doc.toString() + '---\n' + body` with the body from `frontmatter.ts` (already LF, no BOM; FMT-08).

---

### `packages/core/src/index.ts` (barrel, D-55)

**Analog:** itself, lines 1-5:
```typescript
export type { Finding } from './model/finding.js';
export { validate, schemaIds } from './validate/index.js';
export type { SchemaId } from './validate/index.js';
export { templates } from './generated/templates.js';
export type { TemplateName } from './generated/templates.js';
```
**Copy:** `.js` suffixes on relative imports (nodenext), separate `export type` lines. Add `loadSnapshot`, `setFrontmatterKey`, and the model types; do not export `load/frontmatter.ts`, `sections.ts`, `gherkin.ts`, `verification.ts`. `test/bundle.test.ts` lines 49-56 asserts `dist/index.d.ts` export lines never mention `ajv`; the same test should be extended to assert the new names appear and `@cucumber` types do not leak (return plain `ScenarioRef`, not gherkin AST types).

---

### `packages/core/test/snapshot.test.ts` and `test/write.test.ts` (golden tests)

**Analog:** `packages/core/test/schemas.test.ts`

**Imports and golden call** (lines 1-3, 54-57):
```typescript
import { describe, expect, it } from 'vitest';
import { schemaIds, validate } from '../src/index.js';
import type { Finding } from '../src/index.js';
// ...
await expect(JSON.stringify(validate('ticket', bad), null, 2)).toMatchFileSnapshot(
  './__golden__/ticket.invalid.json',
);
```

**Determinism test** (lines 161-167):
```typescript
describe('finding order is deterministic', () => {
  it('two consecutive runs on the config probe produce identical output', () => {
    const first = JSON.stringify(validate('config', configProbe));
    const second = JSON.stringify(validate('config', configProbe));
    expect(second).toBe(first);
  });
});
```
**Copy for D-54:** the variant test is the same shape: `JSON.stringify(loadSnapshot(lf))` equals `JSON.stringify(loadSnapshot(crlf))` equals BOM+CRLF equals backslash-keys, then one `toMatchFileSnapshot('./__golden__/<fixture>.snapshot.json')`. For the golden to be key-order stable, build `RepoSnapshot` objects with fixed property order and sorted record keys (a `JSON.stringify` replacer that sorts keys is acceptable in the test). Path invariant (STACK Decision 7): assert `!JSON.stringify(snapshot).includes('\\\\')`.

**Fixture reader** (from `templates.test.ts` lines 1-2, 9, 19-20, 127-131):
```typescript
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const templatesDir = fileURLToPath(new URL('../templates/', import.meta.url));
const normalise = (text: string) => (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
const onDisk = readdirSync(templatesDir).filter((f) => /\.(md|html)$/.test(f)).sort();
```
Extend with `readdirSync(dir, { recursive: true, withFileTypes: true })`, build keys with `'/'` joins (never `path.join`), and produce `{ files, tree }`. Tests may import `node:*` (`tsconfig.test.json` has `types: ["node"]`, ESLint `globals.node` applies to `**/test/**`).

---

### `packages/cli/src/load/fs.ts` (impure loader, D-51)

**Analog:** `packages/core/test/purity.test.ts` lines 63-71 for spawning by `process.execPath`/name with `execFileSync`, and `scripts/gen-templates.mjs` lines 5-10 for directory read + normalise:

```typescript
// purity.test.ts 63-71
execFileSync(process.execPath, [tscBin, '-p', fixture], { cwd: repoRoot, encoding: 'utf8', stdio: 'pipe' });
// gen-templates.mjs 5-10
const root = fileURLToPath(new URL('../', import.meta.url));
const files = readdirSync(dir).filter((f) => /\.(md|html)$/.test(f)).sort();
const text = readFileSync(dir + f, 'utf8').replace(/^FEFF/, '').replace(/\r\n/g, '\n');
```
**For D-51:** `execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'], { cwd: root, encoding: 'utf8' })`, split on `\0`. Spawning `git` by bare name resolves `git.exe` on Windows (no `.cmd`, so no EINVAL; PITFALLS §12). Wrap `ENOENT` into a typed usage error for Phase 5's exit 2. Read `accord/**` with `readdirSync(join(root, 'accord'), { recursive: true })` and emit keys via `path.posix.join` / `.split(sep).join('/')`. CLI imports from `@accord-dev/accord-core` (see `packages/cli/src/index.ts` line 3) and `tsconfig.json` already has `types: ["node"]`.

**Test analog:** `packages/cli/test/bin.test.ts` (uses `fileURLToPath(new URL('../dist/cli.js', import.meta.url))`); the fs loader test should run against a `packages/core/test/fixtures/<name>` folder or a `mkdtemp` copy with `git init` (`bundle.test.ts` lines 34-39 shows the `mkdtempSync`/`rmSync` try/finally pattern).

## Shared Patterns

### Decision citations in comments
**Source:** `src/validate/index.ts` line 1, `src/validate/ajv.ts` line 1, `scripts/gen-templates.mjs` line 1
**Apply to:** every new file
```typescript
// D-20 seam: everything outside this folder reaches the validator through this re-export.
```

### Purity boundary
**Source:** `eslint.config.js` lines 20-29; `packages/core/tsconfig.json` line 3 (`"types": []`)
**Apply to:** all `packages/core/src/**` files. No `node:*`, no bare `fs`/`path`/`child_process`/`util`. String ops replace `path.posix`. `yaml`, `@cucumber/gherkin`, `@cucumber/messages` are fine. The bundle test (`test/bundle.test.ts` lines 19-26, 42-47) re-checks the built `dist/index.js`.

### BOM + CRLF normalisation
**Source:** `test/templates.test.ts` lines 19-20 and `scripts/gen-templates.mjs` line 10
**Apply to:** `load/frontmatter.ts` (single entry point; everything downstream sees LF), test fixture reader, CLI fs loader (may leave it to core; core must do it regardless per D-38).

### Findings, never exceptions
**Source:** `src/validate/ajv.ts` lines 21-29
**Apply to:** every `load/*` parser: catch `CompositeParserException` and `doc.errors`, return `Finding[]` alongside the partial value. Rule ids are dotted (`schema.required` -> `load.<what>`).

### Golden tests
**Source:** `test/schemas.test.ts` lines 54-57, 161-167
**Apply to:** `snapshot.test.ts`, `write.test.ts`. `JSON.stringify(x, null, 2)` then `await expect(...).toMatchFileSnapshot('./__golden__/<name>.json')`; Markdown goldens for `setFrontmatterKey` use the same call with the raw text and a `.md` path.

### `path` -> `pointer` rename touch list (D-52)
- `src/model/finding.ts` line 2
- `src/validate/ajv.ts` line 25
- `test/schemas.test.ts` lines 65, 68, 78-79 (`has()` helper) — every other assertion goes through `has()` so only these lines change
- `test/__golden__/ticket.invalid.json`, `ticket.tracker.invalid.json`, `config.invalid.json`, `verification.invalid.json` (regenerate with `vitest -u` after adding `file`; loader-less `validate()` output needs a `file` value — planner must decide: `validate()` keeps returning `{ pointer, rule, reason }` and the loader adds `file`/`line`, or `validate()` gains a `file` parameter). This is a Finding-shape question for the planner, not a pattern.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `src/load/gherkin.ts` | parser | transform | No gherkin usage in Phase 1; API excerpt above was verified by running 42.0.1 (dialect-native `keyword`, `CompositeParserException.errors[].location`, `dialects` export). |
| `src/write/frontmatter.ts` | utility | text -> text | No write path in Phase 1; `parseDocument`/`Scalar.QUOTE_DOUBLE`/`seq.flow` behaviour verified above. |
| `src/load/sections.ts` fence state machine | parser | transform | Only line-slicing helpers exist; fence tracking is new (STACK Decision 4 lines 111-113 is the spec). |

## Metadata

**Analog search scope:** `packages/core/src/**`, `packages/core/test/**`, `packages/core/scripts/**`, `packages/core/templates/**`, `packages/core/schemas/**`, `packages/cli/src/**`, `packages/cli/test/**`, root `eslint.config.js`, `tsconfig*.json`, `vitest.config.ts`, `.gitattributes`
**Files scanned:** 34 tracked files (all in `git ls-files packages/`), all read in full; no gitignored mirrors referenced
**Library probes:** yaml 2.9.0 (`LineCounter.linePos`, `parseDocument` round-trip, block-list quoting), @cucumber/gherkin 42.0.1 (`Parser`, `dialects`, `Errors.CompositeParserException`), run on the installed `node_modules`
**Pattern extraction date:** 2026-09-06

# Phase 3: Lint - Pattern Map

**Mapped:** 2026-09-14
**Files analyzed:** 24 (9 new source, 5 new test, 10 modified)
**Analogs found:** 21 / 24 (exact or role-match); 3 with no analog (rule table, renderer, and the `Rule` type are new shapes)

Every analog path below was checked with `git ls-files` and is tracked source. No mirror paths.

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/src/lint/index.ts` (new) | service (engine) | transform (snapshot -> result) | `packages/core/src/load/snapshot.ts` | role-match |
| `packages/core/src/lint/rules.ts` (new) | config (data table) | none | `packages/core/src/validate/ajv.ts:12-16` (const record of checkers) | partial |
| `packages/core/src/lint/ears.ts` (new) | utility (classifier) | transform (string -> verdict) | `packages/core/src/load/sections.ts:13-23,133-142` | role-match |
| `packages/core/src/lint/ticket.ts` (new) | service (rule group over `Ticket`) | transform (model -> findings) | `packages/core/src/load/verification.ts:21-58` | exact |
| `packages/core/src/lint/gherkin.ts` (new) | service (rule group over `ScenarioRef`) | transform | `packages/core/src/load/gherkin.ts:15-46` | role-match |
| `packages/core/src/lint/tokens.ts` (new) | utility (line-numbered scanner) | transform (text -> findings) | `packages/core/src/load/sections.ts:25-75,102-131` | role-match |
| `packages/core/src/lint/render.ts` (new) | utility (renderer) | transform (result -> text) | none | no analog |
| `packages/core/src/load/junit.ts` (new) | loader (text scanner) | transform (text -> record) | `packages/core/src/load/config.ts` + `load/verification.ts` | role-match |
| `packages/core/src/model/finding.ts` (modify) | model | none | itself | exact |
| `packages/core/src/model/snapshot.ts` (modify) | model | none | itself (`RepoSnapshot`, `AccordConfig`) | exact |
| `packages/core/src/load/snapshot.ts` (modify) | loader (orchestrator) | transform | itself, lines 62-106 | exact |
| `packages/core/src/index.ts` (modify) | config (barrel) | none | itself | exact |
| `packages/core/schemas/config.schema.json` (modify) | config (schema) | none | its own `design` block, lines 22-27 | exact |
| `packages/cli/src/load/fs.ts` (modify) | loader (host I/O) | file-I/O | its own `tokensPath`, lines 51-69 | exact |
| `packages/core/templates/ticket-build.md`, `ticket-maintain.md` (modify) | template | none | themselves | exact |
| `packages/core/test/lint.test.ts` (new) | test (golden loop) | batch | `packages/core/test/snapshot.test.ts:1-52` | exact |
| `packages/core/test/ears.test.ts`, `junit.test.ts`, `tokens.test.ts`, `render.test.ts` (new) | test (unit table) | request-response | `packages/core/test/sections.test.ts:1-26`, `gherkin.test.ts:1-42` | exact |
| `packages/core/test/fixtures/lint-*/` (new) | test fixture | none | `packages/core/test/fixtures/verification-edges/` | exact |
| `packages/core/test/schemas.test.ts:127-134` (modify) | test | none | itself | exact |
| `packages/core/test/templates.test.ts:70-75` (modify) | test | none | itself | exact |
| `packages/core/test/bundle.test.ts:53-57` (modify) | test | none | itself | exact |
| `packages/core/test/snapshot.test.ts:64-76` (modify) | test | none | itself | exact |
| `packages/cli/test/load.test.ts:51-68,98-114` (modify) | test | file-I/O | itself | exact |

## Pattern Assignments

### `packages/core/src/lint/index.ts` (engine, transform)

**Analog:** `packages/core/src/load/snapshot.ts`

**Imports pattern** (lines 1-15): decision citation on line 1, `import type` for model types, relative `.js` suffix, one import per sibling module.
```typescript
// D-28 input contract, D-29 key normalisation, D-30 tree, D-31 config, D-34 id verbatim, D-37 classification.
import type { Finding } from '../model/finding.js';
import type { RepoSnapshot, ScenarioRef, SnapshotInput, Ticket, TicketFrontmatter, Verification } from '../model/snapshot.js';
import { loadConfig } from './config.js';
import { extractScenarios } from './gherkin.js';
```

**Core orchestration pattern** (lines 62-106): collect into one `errors: Finding[]`, iterate sorted keys for determinism, spread optional fields so JSON never carries `undefined`.
```typescript
export function loadSnapshot(input: SnapshotInput): RepoSnapshot {
  const errors: Finding[] = [];
  ...
  for (const file of Object.keys(files).sort()) {
    ...
      errors.push(...r.findings);
  }
  return { ...(config === undefined ? {} : { config }), tickets, verifications, tree, errors };
}
```
Copy for `lintSnapshot`: `const loaded = snapshot.errors.filter(...).map(f => ({ ...f, level: 'error' as const }))`, then `RULES.flatMap(...)`, sort, return `{ findings, errors, warnings }`. Sort by code-point compare (`a < b ? -1 : a > b ? 1 : 0`), not `localeCompare`, to match how `stableJson` orders keys (`Object.keys().sort()`, `test/helpers/fixture.ts:60`).

**Optional-field spread pattern** (snapshot.ts:54, gherkin.ts:43, verification.ts:55, 63):
```typescript
...(frontmatter === undefined ? {} : { frontmatter }),
...(acTag === undefined ? {} : { acTag }),
```
Use this for `line` and `pointer` on every draft finding so goldens have no `"line": undefined` and D-60's "`:line` omitted" test is `f.line === undefined`.

---

### `packages/core/src/lint/rules.ts` (data table)

**Analog:** partial. The only "table of checkers" in the codebase is `validate/ajv.ts:12-19`:
```typescript
const validators = {
  ticket: ajv.compile(ticketSchema),
  verification: ajv.compile(verificationSchema),
  config: ajv.compile(configSchema),
} as const;

export const schemaIds = ['ticket', 'verification', 'config'] as const;
export type SchemaId = (typeof schemaIds)[number];
```
Copy: `as const` on the table, derive the id union from it (`type RuleId = (typeof RULES)[number]['id']`) so a test can assert every `lint.*` id in a golden appears in the table. The row shape is RESEARCH.md Pattern 1 (`{ id, level, profiles, check }`); the engine stamps `rule` and `level`, so `check` returns `Omit<Finding, 'level' | 'rule'>[]`.

Rule-group files export one `(snapshot) => Draft[]` per rule (or per closely coupled pair); `rules.ts` imports them and is the only place a level appears.

---

### `packages/core/src/lint/ticket.ts` (rule group over `Ticket`)

**Analog:** `packages/core/src/load/verification.ts` (exact: iterates sections, strips comments, finds a labelled line, emits a finding with a fallback line).

**Section-walk pattern** (verification.ts:23-39):
```typescript
for (const section of sections) {
  const m = BLOCK.exec(section.heading);
  if (!m || seen.has(m[1])) continue;
  seen.add(m[1]);
  const lines = stripHtmlComments(section.lines);

  const resultLine = lines.find((l) => /^Result:/.test(l.text));
  ...
  if (!valid) {
    findings.push({
      file,
      line: resultLine?.line ?? section.line,
      rule: 'load.result-invalid',
      reason: 'Result must be pass, fail, or blocked',
    });
  }
}
```
Copy for `lint.open-question`, `lint.sentinel`, `lint.vague-wording`, `lint.note-orphan`, `lint.notes-not-last`, `lint.plan-*`, `lint.*-oversize`: find the section with `headingKey(s.heading) === 'plan'` (sections.ts:13-15), call `stripHtmlComments(section.lines)` (sections.ts:103), test each `Line`, emit at `l.line`; fall back to `section.line` for section-level findings.

**Tag regexes to reuse** (verification.ts:7, gherkin.ts:16):
```typescript
const BLOCK = /^@(ac-[1-9][0-9]*)\b\s*(.*)$/;   // verification.ts; `### @ac-n` blocks: prefix with /^###\s+/
const AC_TAG = /^@ac-[1-9][0-9]*$/;             // gherkin.ts
```

**Frontmatter-level findings** (no line, pointer only) copy `loadSnapshot` line 74 and the ajv seam (`ajv.ts:34` `pointer: e.instancePath`):
```typescript
errors.push({ file: CONFIG, rule: 'load.config-missing', reason: 'accord/config.yml not found in snapshot' });
```
`lint.tick-orphan` -> `pointer: '/verified/' + i`; `lint.assumption-unconfirmed` -> `pointer: '/assumptions/' + i + '/confirmed'`; `lint.id-mismatch` -> `pointer: '/id'`; `lint.tracker-empty` -> `pointer: '/tracker'`. Skip type-dependent rules when `t.frontmatter === undefined` (D-32; the loader already reported why).

**Gap the planner must schedule:** `LIST_MARKER` (sections.ts:133) and `D07_KEYS` (sections.ts:17) are module-private `const`s. Export `LIST_MARKER` (plan rules need it) and either export `D07_KEYS` or add a `requiredHeadings(type)` helper next to `d07Key`. One-line edits in `sections.ts`, no behaviour change.

---

### `packages/core/src/lint/gherkin.ts` (rule group over `ScenarioRef`)

**Analog:** `packages/core/src/load/gherkin.ts:30-46` (reads `tags`, derives `acTag`).
```typescript
const tags = sc.tags.map((t) => t.name);
const acTag = tags.find((t) => AC_TAG.test(t))?.slice(1);
```
Copy the shape for `@test:` and `@ui`: `const testTags = s.tags.filter((t) => t.startsWith('@test:'))`, `const ui = s.tags.includes('@ui')`. All scenario findings sit at `s.line` (Markdown line, already remapped by `toMarkdown`, gherkin.ts:80). Empty step test is `!/\s/.test(step)` on `s.steps` (steps are `collapse(keyword + ' ' + text)`, gherkin.ts:23-28); placeholder step is `/^\S+ \.\.\.$/`.

`lint.ac-tag-multiple` counts `s.tags.filter((t) => AC_TAG.test(t)).length > 1`; export `AC_TAG` from `load/gherkin.ts` rather than duplicating it.

---

### `packages/core/src/lint/ears.ts` (classifier)

**Analog:** `packages/core/src/load/sections.ts:13-15, 136-142` (pure string helpers, no model import).
```typescript
export function headingKey(heading: string): string {
  return heading.trim().replace(/\s+/g, ' ').toLowerCase();
}
```
Same style: one exported pure function, regex constants at top, whitespace-collapse before compare. Port the verified `classifyEars` from RESEARCH.md lines 411-449 verbatim; input is `Line.text` from `ticket.requirements` (already list-marker-stripped by `requirementLines`), finding line is `Line.line`.

---

### `packages/core/src/lint/tokens.ts` (line-numbered text scanner)

**Analog:** `packages/core/src/load/sections.ts:33-75` (scanner that yields 1-based lines) and `:103-131` (comment stripping that preserves line count).

**Line-preserving blanking pattern** (sections.ts:102-131 keeps `{ line, text }` pairs; the tokens scanner works on offsets instead, so blank with spaces and keep `\n`):
```typescript
const blank = (s: string) => s.replace(/[^\n]/g, ' ');
const body = text.replace(/<!--[\s\S]*?-->/g, blank).replace(/<script\b[\s\S]*?<\/script>/gi, blank);
```
(RESEARCH.md lines 548-549.) Input text is already `normaliseText`-ed by the loader (D-65), so drop the BOM/CRLF replace at RESEARCH.md line 544 and never import `frontmatter.ts` here.

**Header parsing** copies verification.ts:29-30 (`lines.find(/^Result:/)` then `exec` the remainder): first `<!-- -->` comment, `/^\s*Derived from:\s*(.*)$/i`, collect until the next `/^\s*[A-Za-z][A-Za-z ]*:/` line. Existence check is `snapshot.tree.includes(path)` (tree is sorted forward-slash strings, snapshot.ts:65).

---

### `packages/core/src/lint/render.ts` (renderer)

**No analog.** Nothing in core renders text today (STACK Decision 5 keeps colour in the CLI). Use RESEARCH.md Pattern 4 (lines 298-304) as written. Keep it one exported function, no `node:` import (`util.styleText` is CLI-only).

---

### `packages/core/src/load/junit.ts` (report scanner)

**Analog:** `packages/core/src/load/config.ts` (text in, typed value plus findings out) and `load/verification.ts` (regex line scanner).
```typescript
export function loadConfig(file: string, text: string): { config?: AccordConfig; findings: Finding[] } {
  const { map, doc, lines, findings } = parseYamlMap(file, normaliseText(text), 0);
  if (map === undefined) return { config: undefined, findings };
  ...
}
```
Copy the signature shape: `scanJUnit(file, text): { tests: Record<string, TestStatus>; findings: Finding[] }` so `load.report-invalid` (A3) travels the same way `load.result-invalid` does. Loader-side ids are `load.<kebab>` (snapshot.ts:74, 100; verification.ts:36). Port the scanner body from RESEARCH.md lines 618-651; the text arrives normalised, so the BOM/CRLF line is unnecessary there too.

---

### `packages/core/src/model/finding.ts` and `model/snapshot.ts` (model)

**Analog:** themselves. Style: one interface per concept, trailing comment per field with the decision id and an example value, `Record`/arrays only (snapshot.ts:2 "never Map/Set, so JSON.stringify of a snapshot is the golden").
```typescript
export interface Finding {
  file: string; // repo-relative, forward slashes: 'accord/tickets/LOGIN-1.md'
  line?: number; // 1-based line in that file; absent for file-level findings
  rule: string; // dotted id: 'schema.required', 'load.frontmatter-missing'
```
Add `level: 'error' | 'warning'; // D-56` to `Finding` (required, not optional; the loader does not set it, so `snapshot.errors` becomes `Omit<Finding, 'level'>[]` or the loader stamps nothing and `RepoSnapshot.errors` keeps the un-levelled type; pick one and cite D-58). Add to `RepoSnapshot`: `files: Record<string, string>; // D-65` and `tests?: Record<string, 'passed' | 'failed' | 'skipped'>; // D-72, absent when no report`. Add to `AccordConfig`: `tests?: { report: string }; // D-72`.

---

### `packages/core/src/load/snapshot.ts` (loader extension)

**Analog:** itself, lines 17-19 (path regex constants) and 62-75 (config-first ordering).
```typescript
const CONFIG = 'accord/config.yml';
const TICKET = /^accord\/tickets\/([^/]+)\.md$/;
const VERIFICATION = /^accord\/tickets\/([^/]+)\/verification\.md$/;
```
Add `const PROTOTYPE = /^accord\/assets\/([^/]+)\/prototype\.html$/;`. After `config` is known (line 75), build `snapshotFiles` from prototype keys plus `normaliseKey(config.design.tokens)` and `normaliseKey(config.tests.report)` when present, each as `normaliseText(files[key])` (`frontmatter.ts:12-14`). Then `tests` from `scanJUnit`. Extend the return on line 105 with the same optional-spread idiom.

---

### `packages/core/schemas/config.schema.json` (schema)

**Analog:** its own `design` block, lines 22-27:
```json
"design": {
  "type": "object",
  "additionalProperties": false,
  "required": ["tokens"],
  "properties": { "tokens": { "type": "string" } }
},
```
Copy as `"tests": { ..., "required": ["report"], "properties": { "report": { "type": "string", "minLength": 1 } } }`. Do not add `tests` to root `required` (line 7). `test/schemas.test.ts:127-134` pins `Object.keys(properties)` to six keys and must become seven; `required` assertion stays six.

---

### `packages/cli/src/load/fs.ts` (host I/O)

**Analog:** itself, lines 51-69 (`tokensPath` containment, first-pass config read).
```typescript
function tokensPath(root: string, tokens: string | undefined): string | undefined {
  if (!tokens) return undefined;
  const rel = tokens.replace(/\\/g, '/').replace(/^\.\//, '');
  const abs = resolve(root, rel);
  const back = relative(root, abs);
  if (back === '' || back.startsWith('..') || isAbsolute(back)) return undefined;
  if (!existsSync(abs) || !statSync(abs).isFile()) return undefined;
  return back.split(sep).join('/');
}

export function loadFromFs(root: string): SnapshotInput {
  const tree = gitTree(root);
  const files = accordFiles(root);
  const tokens = tokensPath(root, loadSnapshot({ files, tree }).config?.design.tokens);
  if (tokens !== undefined) files[tokens] = readFileSync(join(root, tokens), 'utf8');
  return { files, tree };
}
```
Rename to `containedPath` (no logic change), call it twice: `config?.design.tokens` and `config?.tests?.report`. The containment test to copy is `cli/test/load.test.ts:98-114` ("skips a tokens path outside the repository"): rewrite `config.yml` in a temp repo, assert the key is absent.

---

### Templates (`ticket-build.md`, `ticket-maintain.md`)

**Analog:** themselves. Section shape is `## Heading` followed by one `<!-- Role. guidance -->` comment (ticket-build.md:24-28, 46-51). Append `## Verification notes` with a comment naming `### @ac-n` blocks. Constraints pinned by tests: `templates.test.ts:70-75` heading list (add the sixth heading for build and maintain, not epic); `:77-86` build and maintain identical outside comments; `:126-133` drift check requires `npm run gen`; `write.test.ts` goldens derived from the template regenerate with `-u`.

---

### `packages/core/test/lint.test.ts` (golden loop)

**Analog:** `packages/core/test/snapshot.test.ts:1-52` (exact).
```typescript
const fixtures = readdirSync(fixturesDir, { withFileTypes: true })
  .filter((d) => d.isDirectory() && existsSync(join(fixturesDir, d.name, 'accord')))
  .map((d) => d.name).sort();

for (const name of fixtures) {
  describe('fixture ' + name, () => {
    let v: Variants;
    beforeAll(() => { v = variants(readFixture(name)); });   // read in the hook so -t never touches siblings

    it('CRLF, BOM+CRLF, mixed endings, and backslash keys load identically to LF (D-29, D-38)', () => {
      const lf = stableJson(loadSnapshot(v.lf));
      expect(stableJson(loadSnapshot(v.crlf))).toBe(lf);
      ...
    });
    it('matches the golden', async () => {
      await expect(stableJson(loadSnapshot(v.lf))).toMatchFileSnapshot('./__golden__/' + name + '.snapshot.json');
    });
  });
}
```
Copy with `lintSnapshot(loadSnapshot(...))` and `.lint.json`. Add two loop-level assertions: every `finding.rule` starting with `lint.` is a `RULES` id, and `renderText` parses back to `findings` (CORE-05). Regenerate one fixture with `npm test -- --project core lint -u -t "fixture <name>"`.

---

### `ears.test.ts`, `junit.test.ts`, `tokens.test.ts`, `render.test.ts` (unit tables)

**Analog:** `packages/core/test/sections.test.ts:1-26` (inline inputs via a `body(...lines)` helper, `it.each` for shape variants) and `gherkin.test.ts:10-17` (a small factory that builds the model input inline).
```typescript
const body = (...lines: string[]) => lines.join('\n');
...
it.each(['```', '~~~'])('a heading and a bullet inside a %s fence are content, not a section', (mark) => {
```
Import internals directly (`'../src/lint/ears.js'`), not through the barrel; the barrel exposes only `lintSnapshot`, `renderText`, and types (D-55 precedent: `snapshot.test.ts` imports `loadSnapshot` from the barrel, `sections.test.ts` imports helpers from the module).

---

### Fixtures `test/fixtures/lint-*/`

**Analog:** `packages/core/test/fixtures/verification-edges/` (one minimal `accord/config.yml`, one ticket per edge named after the edge: `A.md`, `B.md`, `ORPHAN/`), plus `valid-build/accord/config.yml` for the config shape:
```yaml
accord: "0.1.0"
profile: build
tracker:
  adapter: none
design:
  tokens: src/styles/tokens.css
roles: [ba, dev]
runtimes: [claude, codex, cursor, copilot]
```
`valid-build/src/styles/tokens.css` is one line (`:root { --color-primary: #0055ff; }`); extend it rather than replace it. Adding files to `valid-build` changes the pinned lists at `snapshot.test.ts:64-76` and `cli/test/load.test.ts:51-68`.

## Shared Patterns

### Finding construction
**Source:** `packages/core/src/load/sections.ts:89-94`, `load/snapshot.ts:74`
**Apply to:** every rule file
```typescript
findings.push({
  file,
  line: section.line,
  rule: 'load.heading-duplicate',
  reason: `duplicate heading "## ${section.heading}"; the first occurrence is used`,
});
```
Reasons are one sentence, lower-case start, name the offending value in quotes or verbatim, no trailing period. Line-less findings simply omit `line`.

### Read the model, never re-scan
**Source:** `packages/core/src/load/sections.ts:13-23, 103-131`
**Apply to:** `lint/ticket.ts`, `lint/gherkin.ts`
Heading lookup is `sections.find((s) => headingKey(s.heading) === 'plan')` (snapshot.ts:33); comment-free lines are `stripHtmlComments(section.lines)`; requirement lines are `ticket.requirements`. Fence membership, if a rule needs it, is `fences.some((f) => n >= f.open && n <= f.close)` (sections.ts:137), but `Fence[]` is not on `Ticket`, so sentinel and vague-wording rules scan `section.lines` (fences included per D-73) without needing it.

### Normalised text at the boundary
**Source:** `packages/core/src/load/frontmatter.ts:11-14`, `load/config.ts:10`
**Apply to:** `load/snapshot.ts` when filling `files`; never inside `lint/`
```typescript
export function normaliseText(text: string): string {
  return (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
}
```

### Decision citations
**Source:** every `src/load/*.ts` line 1 and inline (`// D-21: ui defaults to false in the loader`)
**Apply to:** every new file. Header comment lists the decisions the file implements; inline comments cite the decision at the branch it governs.

### Purity guard
**Source:** `eslint.config.js:21-29`, `packages/core/test/bundle.test.ts:42-49`
**Apply to:** everything under `packages/core/src/`. No `node:*`, no bare built-ins; `npm run lint && npm run typecheck` after each `src/` change. `bundle.test.ts:53-57` names list must gain `lintSnapshot`, `renderText`, `LintResult`, `Level`.

### Golden and test commands
**Source:** `packages/core/test/snapshot.test.ts:1-3`
`npm test -- --project core <stem>`; `-u -t "fixture <name>"` regenerates one golden. Fixture reads happen in `beforeAll`, never at collection time.

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/core/src/lint/render.ts` | renderer | transform | Core has no text renderer; use RESEARCH.md Pattern 4 |
| `packages/core/src/lint/rules.ts` (`Rule` type and `RULES` table) | data table | none | No rule table exists; `ajv.ts:12-19` shows the `as const` record idiom only |

## Metadata

**Analog search scope:** `packages/core/src/**`, `packages/core/test/**`, `packages/core/schemas/**`, `packages/core/templates/**`, `packages/cli/src/**`, `packages/cli/test/**`, `eslint.config.js`
**Files scanned:** 21 read in full or by targeted range; 100 tracked package files listed
**Pattern extraction date:** 2026-09-14

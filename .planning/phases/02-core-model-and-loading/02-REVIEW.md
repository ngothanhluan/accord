---
phase: 02-core-model-and-loading
reviewed: 2026-09-06T08:18:02Z
depth: standard
files_reviewed: 25
files_reviewed_list:
  - .gitattributes
  - packages/cli/src/load/fs.ts
  - packages/cli/test/load.test.ts
  - packages/core/src/index.ts
  - packages/core/src/load/config.ts
  - packages/core/src/load/frontmatter.ts
  - packages/core/src/load/gherkin.ts
  - packages/core/src/load/sections.ts
  - packages/core/src/load/snapshot.ts
  - packages/core/src/load/verification.ts
  - packages/core/src/load/yaml.ts
  - packages/core/src/model/finding.ts
  - packages/core/src/model/snapshot.ts
  - packages/core/src/validate/ajv.ts
  - packages/core/src/write/frontmatter.ts
  - packages/core/test/bundle.test.ts
  - packages/core/test/fixtures/valid-build/src/login.ts
  - packages/core/test/frontmatter.test.ts
  - packages/core/test/gherkin.test.ts
  - packages/core/test/helpers/fixture.ts
  - packages/core/test/schemas.test.ts
  - packages/core/test/sections.test.ts
  - packages/core/test/snapshot.test.ts
  - packages/core/test/verification.test.ts
  - packages/core/test/write.test.ts
findings:
  critical: 1
  warning: 4
  info: 3
  total: 8
status: issues_found
---

# Phase 2: Code Review Report

**Reviewed:** 2026-09-06T08:18:02Z
**Depth:** standard
**Files Reviewed:** 25
**Status:** issues_found

## Summary

Reviewed the Phase 2 loader (`packages/core/src/load/*`, `model/*`, `validate/ajv.ts`, `write/frontmatter.ts`), the CLI filesystem loader, and the test suite. The full suite passes (13 files, 195 tests, run with `CI=true` so no golden was written). Project constraints hold: no Node built-in is imported under `packages/core/src`, every stored path goes through `path.posix`-style normalisation, `git` is spawned by name and never `npx`/`.cmd`, and the `.gitattributes` change only removes the `crlf-*` line that D-53 declared unused.

Every finding below was reproduced against the built `packages/core/dist/index.js` or Node's documented behaviour, not inferred. The one Critical item is a crash in `loadSnapshot` on user-controlled fence content, which contradicts D-35 ("parse errors become findings"). The warnings are a second crash path in the YAML layer, a language-header mismatch with the Gherkin parser, and two robustness gaps in the CLI loader on large or partially ignored repositories. The write primitive's edge cases (trailing comments, mid-block comments, flow-to-block lists, 4-space indent) were probed and behaved correctly.

## Narrative Findings (AI reviewer)

## Critical Issues

### CR-01: `# language:` naming an Object.prototype member crashes `loadSnapshot`

**File:** `packages/core/src/load/gherkin.ts:68`
**Issue:** `dialects` is a plain JSON object, so `dialects[lang]` walks the prototype chain. A fence whose first line is `# language: constructor` (or `toString`, `valueOf`, `hasOwnProperty`, ...) yields a function, the `!== undefined` guard on line 70 passes, and `dialect.feature.map` on line 72 throws `TypeError: Cannot read properties of undefined (reading 'map')` outside the `try` on line 83. The whole snapshot load aborts on one ticket, so `lint`/`gate` in Phase 3/5 would exit with an unhandled exception instead of a deterministic 1. `# language: __proto__` does not crash but reaches the parser and produces a misleading `keywords is not iterable` finding. Reproduced against `dist/index.js`.
**Fix:**
```ts
const dialect = Object.hasOwn(dialects, lang) ? dialects[lang] : undefined;
```
Add a fixture line to `gherkin-shapes` (or an inline test) with `# language: constructor` asserting one `load.gherkin-parse` finding and no throw.

## Warnings

### WR-01: `doc.toJS()` can throw through the loader (alias guard)

**File:** `packages/core/src/load/yaml.ts:37`
**Issue:** `yaml` enforces `maxAliasCount: 100` inside `toJS()` and throws `ReferenceError: Excessive alias count indicates a resource exhaustion attack`; the error is not placed in `doc.errors`, so the `doc.errors.length > 0` check on line 22 does not catch it. Frontmatter with an anchor and more than 100 `*alias` references aborts `loadSnapshot` instead of producing a finding. Reproduced against `dist/index.js`. The same unguarded call is made by `setFrontmatterKey` via `parseDocument` only, so the write path is unaffected, but the loader contract (D-32/D-35: broken frontmatter is a finding, never a throw) is violated.
**Fix:**
```ts
let map: Record<string, unknown>;
try {
  map = doc.toJS() as Record<string, unknown>;
} catch (e) {
  findings.push({ file, line: lineOffset + 1, rule: 'load.yaml-syntax', reason: String((e as Error).message).split('\n')[0] });
  return { map: undefined, doc, lines, findings };
}
return { map, doc, lines, findings };
```

### WR-02: language-header detection is stricter than the Gherkin parser's

**File:** `packages/core/src/load/gherkin.ts:15`
**Issue:** `LANGUAGE` is `/^#\s*language:\s*([A-Za-z-]+)/`, but `@cucumber/gherkin` uses `/^\s*#\s*language\s*:\s*([a-zA-Z\-_]+)\s*$/`. A header the parser accepts, such as `# language : vi` or an indented `  # language: vi`, is not recognised by core. Core then treats the fence as `en`, sees no English `Feature:` line, and splices `Feature: <id>` at index 0, *before* the header. The parser now reads an English feature first, the later language comment is inert, and every Vietnamese keyword becomes a `load.gherkin-parse` finding ("expected: #TagLine ... got 'Kịch bản: S'"). The BA is told their valid Gherkin is broken. D-50 promises the header is honoured "using the parser's built-in dialects". Reproduced against `dist/index.js`.
**Fix:** Use the parser's pattern so both sides agree, and keep the `at` computation:
```ts
const LANGUAGE = /^\s*#\s*language\s*:\s*([A-Za-z_-]+)\s*$/;
```
Add a test with `# language : vi` (space before the colon) expecting one scenario and zero findings.

### WR-03: `git ls-files` output over 1 MiB is reported as "not a git repository"

**File:** `packages/cli/src/load/fs.ts:22-31`
**Issue:** `execFileSync` defaults to `maxBuffer: 1024 * 1024`. A repository whose NUL-separated path list exceeds 1 MiB (roughly 25k paths, common with vendored or generated trees that are not ignored) makes Node kill `git` with `code: 'ENOBUFS'` and empty `stderr`. The catch on line 27 only special-cases `ENOENT`, so the user sees `not a git repository (or git failed): <root>` followed by a blank line, which is wrong and unactionable. Reproduced with `maxBuffer: 2048` against this repository.
**Fix:**
```ts
out = execFileSync('git', [...], { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 256 * 1024 * 1024 });
// in catch:
if (e.code === 'ENOBUFS') throw new UsageError('git ls-files output exceeded the buffer limit in ' + root);
```

### WR-04: `files` includes gitignored paths under `accord/` that `tree` excludes

**File:** `packages/cli/src/load/fs.ts:43-46`
**Issue:** `tree` is built from `git ls-files --exclude-standard` (ignored files absent), but `accordFiles` walks the directory with `readdirSync` and reads every regular file. A gitignored `accord/tickets/WIP-1.md` (or an editor backup matching `*.md`) is parsed as a ticket and can raise findings, while the same repository loaded through the GitHub API in Phase 8 never sees it. D-51's stated purpose for using `ls-files` is "GATE-04 parity between CLI and MCP"; the current split breaks that parity for exactly the files a developer chose to hide. The walk also reads binary assets (`accord/assets/<id>/*.png`) into `files` as UTF-8 strings. Note: D-51 literally says "`files` reads every file under `accord/`", so this is a judgement call for the owner; the fix keeps the decision's rationale rather than its wording.
**Fix:** Filter by the tree that was already computed one line earlier:
```ts
function accordFiles(root: string, tree: string[]): Record<string, string> {
  const inTree = new Set(tree);
  ...
    const rel = relative(root, abs).split(sep).join('/');
    if (!inTree.has(rel)) continue;
    files[rel] = readFileSync(abs, 'utf8');
```
and call `accordFiles(root, tree)` in `loadFromFs`. Add a test: gitignore `accord/tickets/WIP.md`, assert it is absent from `files`.

## Info

### IN-01: comments inside a rewritten list are dropped

**File:** `packages/core/src/write/frontmatter.ts:29-44`
**Issue:** When `verified` is rewritten, only the value node's own `comment`/`commentBefore` are carried over. Item comments (`- ac-1 # first`) and comment lines between items are lost, and a comment on the key line (`verified: # list`) is re-emitted on the line below the key. D-43 says comments survive; this is the one place they do not. Reproduced against `dist/index.js`.
**Fix:** Either document the limitation in the D-43 comment block, or when the old value is a seq, copy `comment`/`commentBefore` from each old item whose scalar value matches the new item.

### IN-02: bundle purity regex misses side-effect and dynamic built-in imports

**File:** `packages/core/test/bundle.test.ts:21-26`
**Issue:** The patterns catch `from "node:x"`, `require("node:x")`, `import("node:x")`, and `from "x"` for bare built-ins, but not `import "node:fs";` (no `from`) nor `import("fs")` / `require("fs")` without the `node:` prefix. The ESLint guard covers source, so this only weakens the artifact-level proof.
**Fix:** Add `/import\s*["']node:/` and `new RegExp(`(?:import|require)\\(\\s*["'](${builtins})["']`)`.

### IN-03: tokens-path containment check does not resolve symlinks

**File:** `packages/cli/src/load/fs.ts:52-60`
**Issue:** T-02-20 rejects `../outside.css` lexically via `resolve`/`relative`, but a symlink inside the repository pointing outside passes the check and `readFileSync` follows it. Low risk (the repository owner controls its contents), noted because the threat item claims containment.
**Fix:** Compare `realpathSync(abs)` against `realpathSync(root)` before accepting the path.

---

_Reviewed: 2026-09-06T08:18:02Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_

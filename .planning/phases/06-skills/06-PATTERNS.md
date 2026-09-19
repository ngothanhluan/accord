# Phase 6: Skills - Pattern Map

**Mapped:** 2026-09-15
**Files analyzed:** 27 (17 new, 6 modified, 4 deleted)
**Analogs found:** 21 / 23 code files (the 10 prose source files have 2 partial analogs; see the last table)

Every analog path below was checked with `git ls-files`. All 29 are tracked source in this
repository — no gitignored mirror, no `node_modules` path, no `dist/` path appears anywhere in this
document.

## Upstream Assumptions Corrected

Two paths the prompt asked me to verify do not hold as stated. Recording them rather than
substituting a guess:

1. **`packages/core/test/spawn-surface.test.ts` does not exist.** The guard-the-guard test lives at
   `packages/cli/test/spawn-surface.test.ts` (RESEARCH.md has it right; the mapping brief has it in
   `core`). It must stay in `cli`: it scans `packages/cli/src/` via
   `new URL('../src/', import.meta.url)` (`packages/cli/test/spawn-surface.test.ts:16`), and the
   commander registry SKILL-08 needs is only reachable from the `cli` package.

2. **There is no skill-definition frontmatter schema to model, and CONTEXT.md does not ask for one.**
   The `roles` (required, enum `ba|dev|designer`, `ba` and `dev` both `contains`-required) and
   `runtimes` (required, enum `claude|codex|cursor|copilot`, `minItems: 1`) keys the brief describes
   are **`config.yml`'s**, and they already ship at
   `packages/core/schemas/config.schema.json:28-39`. They are the *input* to `skillTargets(config)`,
   not a schema over skill frontmatter. D-106 validates rendered frontmatter with a **test**
   ("rendered frontmatter contains no key outside the six"), not with ajv, and no decision in
   CONTEXT.md creates a fourth schema. Planner: do not add `packages/core/schemas/skill.schema.json`
   unless you are deliberately widening scope — `schemaIds` at
   `packages/core/src/validate/ajv.ts:18` is a three-element tuple and adding to it moves
   `packages/core/test/schemas.test.ts`.

3. **Core purity is stricter than the brief states.** The brief says core "must not import `node:fs`
   or `node:child_process` outside `src/load/` and `src/scaffold/`". The enforced rule
   (`eslint.config.js:21-29`) bans **all 23 Node built-ins, prefixed or bare, across
   `packages/core/src/**/*.ts` with no directory exemption** — `packages/core/src/load/` is *not*
   exempt (it is a pure parser over strings handed to it; `packages/cli/src/load/fs.ts` is the file
   that touches disk). `packages/core/src/scaffold/` does not exist. The only exemption is
   **outside `src/`**: `eslint.config.js:17` gives `**/scripts/**` Node globals, which is what
   `gen-templates.mjs` relies on and what `gen-skills.mjs` inherits. A second layer backs it:
   `packages/core/tsconfig.json` sets `types: []` and core has no `@types/node`
   (`packages/core/test/purity.test.ts:97-104`).

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `packages/core/scripts/gen-skills.mjs` | codegen script | file-I/O → transform | `packages/core/scripts/gen-templates.mjs` | **exact** |
| `packages/core/src/generated/skills.ts` | generated module | data | `packages/core/src/generated/templates.ts` | **exact** |
| `packages/core/src/skills/render.ts` | service (pure transform) | transform | `packages/core/src/write/frontmatter.ts` | role-match |
| `packages/core/src/skills/targets.ts` | service (pure) | transform (config → list) | `packages/core/src/gate/index.ts` (`run`/`gateReady`) | role-match |
| `packages/core/src/skills/hash.ts` | utility | transform | `packages/core/src/gate/hash.ts` | **exact** |
| `packages/core/src/skills/index.ts` | barrel/seam | — | `packages/core/src/gate/index.ts`, `packages/core/src/validate/index.ts` | **exact** |
| `packages/core/src/index.ts` (modify) | public API | — | itself, lines 18-31 | **exact** |
| `packages/cli/src/commands/skills.ts` | CLI command | file-I/O (compare-then-write) | `packages/cli/src/commands/new-ticket.ts` | **exact** |
| `packages/cli/src/run.ts` (modify) | route/wiring | request-response | itself, lines 77-106 (`gate` / `new ticket` nesting) | **exact** |
| `package.json` (modify `scripts.gen`) | config | — | itself, line 8 | **exact** |
| `packages/core/templates/business-rules.md` (modify) | template data | — | itself, lines 3-4 | **exact** |
| `packages/core/test/skills.test.ts` | test (unit + drift) | — | `packages/core/test/templates.test.ts` | **exact** |
| `packages/cli/test/skills-sync.test.ts` | test (integration, write-path) | file-I/O | `packages/cli/test/new-ticket.test.ts` + `test/helpers/repo.ts` | **exact** |
| `packages/cli/test/skill-commands.test.ts` | test (source/registry scan) | — | `packages/cli/test/spawn-surface.test.ts` | **exact** |
| `packages/cli/test/spawn-surface.test.ts` (modify) | test | — | itself, lines 90-101 | **exact** |
| `packages/core/test/templates.test.ts` (modify) | test | — | itself, lines 95-99 | **exact** |
| wrong-plan fixture (D-115) | fixture | — | `packages/core/test/fixtures/gate-ready/` | role-match |
| `packages/core/skills/{ba,dev,designer,shared}/*.md` (10 files) | prose data | — | `docs/skills/debug.md`, `docs/skills/code-review.md` (2 of 10) | partial — see below |
| `.claude/skills/accord-debug/SKILL.md` (**delete**) | — | — | — | n/a |
| `.claude/skills/accord-code-review/SKILL.md` (**delete**) | — | — | — | n/a |
| `docs/skills/debug.md` (**move**) | — | — | — | n/a |
| `docs/skills/code-review.md` (**move**) | — | — | — | n/a |

---

## Pattern Assignments

### `packages/core/scripts/gen-skills.mjs` (codegen, file-I/O)

**Analog:** `packages/core/scripts/gen-templates.mjs` — 20 lines, and the whole file is the pattern.

**Full file** (`packages/core/scripts/gen-templates.mjs:1-20`):

```javascript
// Emits src/generated/templates.ts from templates/*.{md,html} (D-27). Lives outside src/, so Node built-ins are allowed here.
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../', import.meta.url));
const dir = `${root}templates/`;
const files = readdirSync(dir).filter((f) => /\.(md|html)$/.test(f)).sort();
const body = files
  .map((f) => {
    const text = readFileSync(dir + f, 'utf8').replace(/^﻿/, '').replace(/\r\n/g, '\n');
    return `  ${JSON.stringify(f)}: ${JSON.stringify(text)},`;
  })
  .join('\n');
mkdirSync(`${root}src/generated`, { recursive: true });
writeFileSync(
  `${root}src/generated/templates.ts`,
  `// Generated by scripts/gen-templates.mjs from templates/*. Do not edit.\nexport const templates = {\n${body}\n} as const;\nexport type TemplateName = keyof typeof templates;\n`,
  'utf8',
);
console.log(`generated ${files.length} templates`);
```

**The normalisation the whole phase hangs on** is line 10, and it is exactly two operations in this
order:

```javascript
.replace(/^﻿/, '')     // strip one leading BOM
.replace(/\r\n/g, '\n')     // CRLF → LF
```

RESEARCH.md Pitfall 1 requires `skills sync`'s read-back-and-compare to apply **this same pair**
before hashing. Note there are two spellings of it in the repo and they are behaviourally identical
— pick one and reuse it rather than writing a third:

| Site | Form |
|------|------|
| `packages/core/scripts/gen-templates.mjs:10` | `.replace(/^﻿/, '').replace(/\r\n/g, '\n')` |
| `packages/core/src/load/frontmatter.ts:12-14` | `(text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n')` — exported as `normaliseText`, with `const BOM = String.fromCharCode(0xfeff)` at line 8 |
| `packages/core/test/templates.test.ts:19-20` | same as `normaliseText`, duplicated locally |

**Recommendation for the planner:** `normaliseText` (`packages/core/src/load/frontmatter.ts:12`) is
already pure core and already exported from that module. The `sync` hash path should import it
rather than inline a fourth copy. `gen-skills.mjs` cannot import it (it runs before the build), so
that script copies line 10 verbatim, as `gen-templates.mjs` does.

**Differences the analog does not cover:**
- **Recursive read.** `gen-templates.mjs` uses flat `readdirSync(dir)`. The RESEARCH.md layout is a
  directory per role, so `gen-skills.mjs` needs `readdirSync(dir, { recursive: true, withFileTypes: true })`.
  The working precedent for that call shape is `packages/cli/src/load/fs.ts:43-47`, which also shows
  the posix-key conversion: `relative(root, abs).split(sep).join('/')`. Keys in `skills.ts` must be
  posix (`'ba/SKILL.md'`), never `'ba\\SKILL.md'`.
- **The frontmatter split.** Reuse the regex, do not write a parser:
  `FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/` appears at
  `packages/core/src/load/frontmatter.ts:9` and again at `packages/core/test/templates.test.ts:11`.
  `splitFrontmatter` (`packages/core/src/load/frontmatter.ts:22-27`) already returns
  `{ yaml, body, bodyOffset }` and already normalises first — but again, the script cannot import it.
- **The file filter.** `/\.(md|html)$/` becomes `/\.md$/`.

---

### `packages/core/src/generated/skills.ts` + its drift test

**Analog:** `packages/core/src/generated/templates.ts` and the `describe('generated module')` block in
`packages/core/test/templates.test.ts:125-141`.

**Drift + LF/BOM test** (`packages/core/test/templates.test.ts:125-141`) — copy this block whole:

```typescript
describe('generated module', () => {
  it('generated module matches templates/ (drift)', () => {
    const onDisk = readdirSync(templatesDir).filter((f) => /\.(md|html)$/.test(f)).sort();
    expect(Object.keys(templates), 'template file set drifted: run npm run gen').toEqual(onDisk);
    for (const name of onDisk) {
      const text = normalise(readFileSync(templatesDir + name, 'utf8'));
      expect(templates[name as TemplateName], `${name} drifted: run npm run gen`).toBe(text);
    }
  });

  it('LF and no BOM on disk', () => {
    for (const name of names) {
      const raw = readFileSync(templatesDir + name, 'utf8');
      expect(raw, `${name} has CR`).not.toContain('\r');
      expect(raw.startsWith(BOM), `${name} has BOM`).toBe(false);
    }
  });
});
```

Two things carry over exactly: the **file-set** equality runs before the per-file equality (so an
added-but-not-regenerated source fails with a readable message), and every failure message names
`run npm run gen` — the repo has no `prebuild`/`pretest` regeneration, so this message *is* the
recovery path.

**Directory handle** (`packages/core/test/templates.test.ts:9`) — ESM, never `__dirname`:

```typescript
const templatesDir = fileURLToPath(new URL('../templates/', import.meta.url));
```

**Modification required, not optional** — `package.json:8` currently reads:

```json
"gen": "node packages/core/scripts/gen-templates.mjs",
```

It must become both scripts. RESEARCH.md's Runtime State Inventory flags this: without it
`skills.ts` never regenerates and the drift test is the only thing standing between a stale module
and a green build.

---

### `packages/core/src/skills/hash.ts` (utility, transform)

**Analog:** `packages/core/src/gate/hash.ts` — same algorithm, different question, keep them separate
functions (CONTEXT.md Claude's Discretion says so explicitly).

**Constants and the loop** (`packages/core/src/gate/hash.ts:12-15, 34-36`):

```typescript
const SEP = ' ';
const OFFSET = 0xcbf29ce484222325n;
const PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

// ...
let h = OFFSET;
for (const byte of new TextEncoder().encode(hashInput(scenarios))) h = ((h ^ BigInt(byte)) * PRIME) & MASK;
return 'fnv1a64:' + h.toString(16).padStart(16, '0');
```

**Header comment pattern to copy** (`packages/core/src/gate/hash.ts:1-4`) — it states *why*
`node:crypto` is absent, which is the comment a future reader of `skills/hash.ts` will need for the
same reason:

```typescript
// GATE-01/GATE-03 AC hash (D-75, D-77): FNV-1a 64-bit over the `@ac-n` tags and their steps, written
// `fnv1a64:<16 lowercase hex>`. Hand-written on TextEncoder and BigInt: core is isomorphic, so
// node:crypto is banned (CORE-01), and Web Crypto's subtle.digest would make every gate async for
// forty bytes. The algorithm prefix makes a future change fail loudly instead of comparing wrong.
```

The `'fnv1a64:'` prefix is already the established output shape (`gate/hash.ts:36`) and RESEARCH.md's
proposed marker (`<!-- generated by accord skills sync — do not edit — fnv1a64:… -->`) reuses it,
so the two hashes are visually indistinguishable in the wild. If that matters, the planner should
pick a distinguishing prefix; nothing in the codebase forces either way.

**Security wording constraint** (RESEARCH.md Security Domain V6): the marker text must not say
"verified" or "signed". FNV-1a is a drift detector, not tamper evidence.

---

### `packages/core/src/skills/render.ts` (pure transform)

**Analog:** `packages/core/src/write/frontmatter.ts` — the only existing code in the repo that
*writes* a frontmatter block.

**The rebuild shape** (`packages/core/src/write/frontmatter.ts:64`) — note it hardcodes LF and emits
no BOM (FMT-08), which is what the skill files require:

```typescript
return '---\n' + next + '\n---\n' + body;
```

`renderSkill()` is this plus one line — the marker goes between `'\n---\n'` and `body` (D-111).

**YAML serialisation with the project's quoting convention**
(`packages/core/src/write/frontmatter.ts:5-11, 27-34`) — RESEARCH.md's "Don't Hand-Roll" row says not
to concatenate `key: value` by hand, because `description` is free prose that may contain `:`:

```typescript
import { Document, Scalar, isMap, isScalar, isSeq, parseDocument } from 'yaml';
import { splitFrontmatter, stringNumerics } from '../load/frontmatter.js';

const options = { schema: 'core', customTags: stringNumerics } as const;

// D-45: every string core writes is double-quoted; booleans stay plain. D-44: block list, [] when empty.
const out = new Document({}, options);
const node = out.createNode(value);
if (isScalar(node) && typeof value === 'string') node.type = Scalar.QUOTE_DOUBLE;
```

`{ schema: 'core', customTags: stringNumerics }` is the project-wide parse/serialise option pair
(STACK Decision 2) and appears at `packages/core/src/write/frontmatter.ts:11` and
`packages/core/test/templates.test.ts:29`. `stringNumerics` is re-exported from
`packages/core/src/load/frontmatter.ts:6`, so `skills/render.ts` can import it without reaching into
`load/yaml.ts`.

**Comment convention** — decisions are cited by number inline, as above (`// D-45: …`,
`// D-44 …`). Every file in `packages/core/src/` opens with a header comment naming the requirement
IDs and decision numbers it implements; see `gate/hash.ts:1`, `write/frontmatter.ts:1-4`,
`lint/render.ts:1-3`, `validate/ajv.ts:1`. Match that density.

---

### `packages/core/src/skills/targets.ts` (pure, config → `{ path, text }[]`)

**Analog:** `packages/core/src/gate/index.ts` — the shape of "one shared private `run`, thin exported
entry points, a declared result interface, purity stated in the doc comment".

**Result interface + optional-key spread** (`packages/core/src/gate/index.ts:12-18, 74-80`) — the
`...(x === undefined ? {} : { key: x })` idiom is how this repo keeps `undefined` out of JSON
goldens, and `skillTargets` output will be goldened the same way:

```typescript
export interface GateResult {
  gate: 'ready' | 'done';
  ticket: string;
  verdict: 'pass' | 'fail';
  findings: Finding[]; // sorted by file, then line (line-less first), then rule, reason, pointer
  acHash?: string; // absent only when the ticket is unknown or carries no `@ac-n` scenario (D-86)
}

// ...
return {
  gate,
  ticket: id,
  verdict: findings.some((f) => f.level === 'error') ? 'fail' : 'pass',
  findings,
  ...(hash === undefined ? {} : { acHash: hash }),
};
```

**Purity stated in prose** (`packages/core/src/gate/index.ts:45-50`) — the doc comment that makes the
one-shared-body rule explicit; `skillTargets` has the same "a second copy is how X silently falls out
of the matrix" risk across `.claude/` and `.agents/`:

```typescript
/**
 * The shared gate body. One function, so `downgradeMaintain` keeps exactly one call site and every gate
 * inherits the GATE-07 matrix: a second copy is how one gate silently falls out of that matrix the
 * moment GATE-12 flips a level (D-88). ...
 * Pure: reads the snapshot only, never mutates it, and returns the same result on every call.
 */
```

**Deterministic ordering** (`packages/core/src/gate/index.ts:20-31`): every sort in core is
code-point, never locale-aware, so goldens are host-identical.

```typescript
// Code-point order, never a locale-aware compare, so the goldens are identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
```

**Path construction — the hard invariant.** `skillTargets` must build `'.claude/skills/accord-' + role + '/' + file`
by **string concatenation or `path.posix`**, never `node:path` `join` — and in `packages/core/src` it
cannot import `node:path` at all (`eslint.config.js:22-28`). The existing precedent for composing a
literal posix path in core is `packages/core/src/gate/index.ts:39-41`:

```typescript
const file = 'accord/tickets/' + id + '.md';
const folder = 'accord/tickets/' + id + '/';
const assets = 'accord/assets/' + id + '/';
```

and the reason string concatenation was chosen over a regex is in the doc comment above it
(lines 33-37) — worth reading before designing the orphan-directory match in the CLI.

**Public API registration** (`packages/core/src/index.ts:18-31`) — one `export { }` line plus one
`export type { }` line per module, with the leading comment listing the surface:

```typescript
export { gateDone, gateReady } from './gate/index.js';
export type { GateResult } from './gate/index.js';
export { statusRows } from './status/rows.js';
export type { StatusRow } from './status/rows.js';
export { renderText } from './lint/render.js';
export { templates } from './generated/templates.js';
export type { TemplateName } from './generated/templates.js';
```

The header comment at `packages/core/src/index.ts:1-3` enumerates the API and says what stays private;
it has to be updated in the same edit, not left stale.

---

### `packages/cli/src/commands/skills.ts` (CLI command, compare-then-write file-I/O)

**Analog:** `packages/cli/src/commands/new-ticket.ts` — the only other command that writes.

**Signature and return** (`packages/cli/src/commands/new-ticket.ts:7-11, 18-22, 52`):

```typescript
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { setFrontmatterKey, templates } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { CommandContext } from '../run.js';

export function newTicket(
  ctx: CommandContext,
  id: string,
  options: { type: 'epic' | 'story' | 'bug' },
): number {
  // ...
  return 0;
}
```

`CommandContext` is declared at `packages/cli/src/run.ts:27-33` and carries `{ root, snapshot, stdout, stderr, env }`.
`skills(ctx)` takes the same first parameter and returns `number`.

**The write-and-print pattern, and the posix/native path split**
(`packages/cli/src/commands/new-ticket.ts:44-52`) — this is the excerpt that matters most:

```typescript
const rel = 'accord/tickets/' + id + '.md';
const file = join(ctx.root, rel);
// T-05-15: refusing is the behaviour, not an afterthought — a BA-authored ticket can never be
// destroyed by a second `new ticket`. Exit 2: this is a usage error, not a gate verdict.
if (existsSync(file)) throw new UsageError(rel + ' already exists - nothing was written');
mkdirSync(join(ctx.root, 'accord', 'tickets'), { recursive: true });
writeFileSync(file, text);
ctx.stdout.write(rel + '\n');
return 0;
```

Two rules are visible in six lines and both bind `skills sync`:
1. **`join` is used only to build the native handle passed to `fs`; the *printed* value is the posix
   `rel` string.** `skills sync` prints one line per file, so every printed path must come from the
   `path` field `skillTargets()` produced, never from a `join` result.
2. **`writeFileSync(file, text)` with no encoding argument** — Node defaults to utf8 and writes no
   BOM. Do not pass `'utf8'` explicitly and do not add a BOM.

**What `new-ticket` does NOT model, and where to get it:**
- **Compare-then-write (D-112/D-96).** `new-ticket` refuses; `sync` overwrites. The four states come
  from two equalities (text-matches, hash-matches). Read the existing file with `readFileSync`, apply
  `normaliseText` from core, and **skip `writeFileSync` entirely when unchanged** — D-112 says no
  mtime change. `packages/cli/src/load/fs.ts:52-60` (`containedPath`) is the local precedent for
  "check first, then act".
- **Reading a directory of entries.** `packages/cli/src/load/fs.ts:37-49` (`accordFiles`):

```typescript
if (!statSync(accordDir, { throwIfNoEntry: false })?.isDirectory()) {
  throw new UsageError('no accord/ folder in ' + root);
}
for (const d of readdirSync(accordDir, { recursive: true, withFileTypes: true })) {
  if (!d.isFile()) continue;
  const abs = join(d.parentPath, d.name);
  files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
}
```

  `statSync(..., { throwIfNoEntry: false })?.isDirectory()` is the idiom for "does this directory
  exist" — the orphan scan (D-113) needs it, because `.agents/skills/` may not exist at all on a
  first run. `.split(sep).join('/')` at line 46 is the native→posix conversion for a reported path.

**Structured result, text renderer** (`code_context` §Established Patterns: "`sync`'s reported
statuses should be a structured result the text renderer prints, not strings assembled at the print
site"). Two analogs:
- `packages/core/src/lint/render.ts:6-13` — `renderText(result: { findings: Finding[] }): string`
  takes a structural type so a `GateResult` renders with no adapter.
- `packages/cli/src/commands/status.ts:47-79` — the command computes the structured value once, then
  branches on `--json` vs text, so "the table and the JSON can never disagree" (line 49). Note
  `status` writes the bare array under `--json` (line 57, D-98) and puts the advisory on **stderr**
  (line 58) — which is exactly where D-113's orphan report goes.

---

### `packages/cli/src/run.ts` — registering `skills sync`

**Analog:** the two existing nested-subcommand sites in the same file.

**`gate ready` / `gate done`** (`packages/cli/src/run.ts:75-86`) — parent `.command()` held in a
local, children added in a loop:

```typescript
// Both subcommands route through the same preflight the lint action uses, so the pin check is never
// conditional on which gate was asked for (D-95).
const gates = program.command('gate').description('run one gate against one ticket');
for (const which of ['ready', 'done'] as const) {
  gates
    .command(which + ' <id>')
    .description('report whether the ticket passes the ' + which + ' gate')
    .option('--json', 'print the GateResult object instead of text')
    .action((id: string, options: { json?: boolean }) => {
      code = gate(preflight(opts), which, id, options);
    });
}
```

**`new ticket`** (`packages/cli/src/run.ts:94-106`) — the single-child form, chained directly. This
is the closer analog for `skills sync` (one child, no loop):

```typescript
program
  .command('new')
  .description('scaffold a document a human then fills in')
  .command('ticket <id>')
  .description("write accord/tickets/<id>.md from the active profile's template, filling nothing in")
  .addOption(/* ... */)
  .action((id: string, options: { type: 'epic' | 'story' | 'bug' }) => {
    code = newTicket(preflight(opts), id, options);
  });
```

Note the chaining trap this exposes: `.command('new').command('ticket <id>')` returns the **child**,
so everything after it configures `ticket`, and `new` itself is left with only a description. That is
fine for one child and wrong for two — if `skills` ever gains a second subcommand, it must switch to
the `gates` local-variable form.

**D-121's pin check costs nothing to satisfy.** `preflight(opts)`
(`packages/cli/src/run.ts:39-50`) already does root → snapshot → pin in that order, and the pin is
inside it:

```typescript
function preflight(opts: RunOptions): CommandContext {
  const root = repoRoot(opts.cwd);
  const snapshot = loadSnapshot(loadFromFs(root));
  // D-94: a hard refusal, no flag and no environment variable that skips it. ...
  if (snapshot.config !== undefined) {
    const message = pinMessage(snapshot.config.accord, pkg.version);
    if (message !== undefined) throw new UsageError(message);
  }
  return { root, snapshot, stdout: opts.stdout, stderr: opts.stderr, env: opts.env ?? {} };
}
```

Calling `skills(preflight(opts))` in the action **is** D-121, entire. No new mechanism.
`pinMessage` itself is at `packages/cli/src/pin.ts:14-17` and is pure.

**Cost of extracting the tree (RESEARCH.md Pitfall 2, Option A).** The construction site is
`packages/cli/src/run.ts:52-117`. `runCli` opens with `let code = 0;` (line 53) and **every action
closure assigns to that local** (lines 72, 84, 105, 116); `opts` is also closed over by
`configureOutput` (lines 57-64) and by every `preflight(opts)` call. So extracting
`buildProgram()` means threading both the mutable `code` cell and `opts` through the new function —
e.g. `buildProgram(opts, setCode)` or returning `{ program, getCode }`. That is a real but small
refactor of one file with one caller (`packages/cli/src/index.ts`). Option B (source scan) needs no
production change but cannot reconstruct the `new` → `ticket` chain, for the reason visible at lines
94-98 above.

---

### `packages/cli/test/skill-commands.test.ts` (SKILL-08 scanner)

**Analog:** `packages/cli/test/spawn-surface.test.ts` — the guard-the-guard pattern, verbatim.

**The guard-the-guard assertion** (`packages/cli/test/spawn-surface.test.ts:63-69`) — this is the
excerpt RESEARCH.md Pitfall 2 says must be copied:

```typescript
describe('spawn surface', () => {
  const sites = spawnSites();

  it('has spawn sites to check', () => {
    // A silently empty scan would make both assertions below vacuous.
    expect(sites.length).toBeGreaterThan(0);
  });
```

D-110 widens the scan to every bundled reference file, so the skills version needs **two** such
guards: one on "files scanned > 0" and one on "command mentions found > 0". An empty render output
and a regex that matches nothing both pass a naive scan.

**Allowlist framing, stated in the header** (`packages/cli/test/spawn-surface.test.ts:1-9`) — the
comment explains why the test is a positive allowlist and why the file set is enumerated from disk:

```typescript
// CLI-07 / PITFALLS section 12: the CLI may spawn `git` and `gh` by name with a literal argument
// array, and nothing else — ... This is written as a positive allowlist rather than a denylist, because
// a denylist can be defeated by a spelling it never anticipated, and the source files are enumerated
// from disk so a new CLI file is covered the moment it is added.
```

**Offender reporting, not a bare boolean** (`packages/cli/test/spawn-surface.test.ts:71-79`) — the
failure names the site, which matters because SKILL-08's failures will be found by someone editing
prose, not code:

```typescript
const offenders = sites
  .filter((s) => { /* ... */ })
  .map((s) => `${s.where}: ${s.args.split('\n')[0].trim()}`);
expect(offenders).toEqual([]);
```

**Line-number-preserving comment stripping** (`packages/cli/test/spawn-surface.test.ts:21-27`) — if
the scanner has to skip fenced blocks or HTML comments in skill prose, this is the technique: blank
the line, do not delete it.

```typescript
/** Blank whole-line comments rather than delete them, so reported line numbers stay accurate. */
function stripCommentLines(text: string): string {
  return text
    .split('\n')
    .map((line) => (/^\s*(\/\/|\/\*|\*)/.test(line) ? '' : line))
    .join('\n');
}
```

**Modification required — the `COMMANDS` table** (`packages/cli/test/spawn-surface.test.ts:88-101`).
RESEARCH.md Pitfall 6 says add a `skills sync` row; the table's own comment says why:

```typescript
// Every repository-reading command shipped so far. A single command would leave the next one free to
// print a `path.join` result; this is the assertion that fails on Windows CI the moment one does.
const COMMANDS: { name: string; argv: string[]; guard?: string }[] = [
  // Guard the guard: an output with no path in it would pass the backslash check for free.
  { name: 'lint', argv: ['lint'], guard: 'accord/tickets/' },
  // ...
  { name: 'new ticket', argv: ['new', 'ticket', 'TCK-1'], guard: 'accord/tickets/TCK-1.md' },
];
```

The new row needs a `guard` string that actually appears in `skills sync` output — e.g.
`'.claude/skills/accord-ba/SKILL.md'`.

---

### `packages/cli/test/skills-sync.test.ts` (integration, write-path)

**Analog:** `packages/cli/test/new-ticket.test.ts` + `packages/cli/test/helpers/repo.ts`.

**Sandbox lifecycle** (`packages/cli/test/new-ticket.test.ts:18-33`) — the collect-then-cleanup form
that survives a failing assertion:

```typescript
// Every case makes its own repository; this collects them so a failing assertion still cleans up.
const repos: string[] = [];
function sandbox(fixture = 'valid-build'): string {
  const repo = makeRepo(fixture);
  repos.push(repo);
  return repo;
}
afterEach(() => {
  while (repos.length > 0) cleanup(repos.pop() as string);
});

/** Rewrite the sandbox copy's config.yml; the shared fixture is never touched. */
function setConfig(repo: string, find: RegExp, replace: string): void {
  const file = join(repo, 'accord', 'config.yml');
  writeFileSync(file, readFileSync(file, 'utf8').replace(find, replace));
}
```

`setConfig` is exactly the lever the D-113 orphan test and the `roles:`-filtering tests need: drop
`designer` from `roles:` in the sandbox copy and re-run.

**Byte-exact reads** (`packages/cli/test/new-ticket.test.ts:15`) — for the D-119 byte-identity
assertion and for "did the second run change anything":

```typescript
const bytes = (file: string): string => readFileSync(file, 'latin1'); // byte-exact, no encoding fixups
```

**In-process driver** (`packages/cli/test/helpers/repo.ts:65-74`) — already exists, takes `env`, so
the pin-mismatch case (D-121) needs no new helper:

```typescript
export async function run(
  argv: string[],
  cwd: string,
  env: NodeJS.ProcessEnv = {},
): Promise<{ code: number; out: string; err: string }> {
  const stdout = new PassThrough();
  const stderr = new PassThrough();
  const code = await runCli(argv, { cwd, stdout, stderr, env });
  return { code, out: String(stdout.read() ?? ''), err: String(stderr.read() ?? '') };
}
```

**The sandbox guard** (`packages/cli/test/helpers/repo.ts:17-27`) — already in place and already
handles Windows 8.3 short paths via `realpathSync.native`; nothing to add. Just do not write a
second `execFileSync('git', …)` outside `gitIn`.

**Windows cleanup** (`packages/cli/test/helpers/repo.ts:56-58`):

```typescript
/** git object files are read-only on Windows; retries let rmSync win the race with the index writer. */
export function cleanup(dir: string): void {
  rmSync(dir, { recursive: true, force: true, maxRetries: 5 });
}
```

---

### `packages/core/test/skills.test.ts` (unit, prose assertions)

**Analog:** `packages/core/test/templates.test.ts` — an existing test whose whole job is asserting
things about *prose* files, which is what most of SKILL-01..SKILL-12 turns into.

**Frontmatter helpers** (`packages/core/test/templates.test.ts:10-13, 19-38`):

```typescript
const BOM = String.fromCharCode(0xfeff);
const FRONTMATTER = /^---\n([\s\S]*?)\n---(?:\n|$)/;
// Only the D-04 key names count as keys; a generic `[a-z_]+:` would also match guidance text.
const KEY = /^#? ?(id|title|type|status|parent|tracker|ui|design|assumptions|ac_hash|verified):/;

const normalise = (text: string) =>
  (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');

function frontmatter(md: string): Record<string, unknown> | null {
  const m = FRONTMATTER.exec(normalise(md));
  return m ? (parse(m[1], { schema: 'core', customTags: stringNumerics }) as Record<string, unknown>) : null;
}

const frontmatterKeys = (md: string) =>
  (frontmatterBlock(md) ?? '')
    .split('\n')
    .map((line) => KEY.exec(line)?.[1])
    .filter((key): key is string => key !== undefined);
```

`frontmatterKeys` is the direct analog for D-106's "rendered frontmatter contains nothing outside the
six" test — but read the comment on line 12 first. A naive `[a-z-]+:` would match prose inside the
body. For skills the safer form is to parse the frontmatter block with `yaml` and assert
`Object.keys(parsed)` is a subset of the six, since the rendered block is machine-written and small.

**Prose-content assertions** (`packages/core/test/templates.test.ts:95-99`) — the shape SKILL-04,
SKILL-05, SKILL-06, SKILL-07, SKILL-12 all reduce to, and the place the D-116 line gets asserted:

```typescript
it('ownership guidance is present', () => {
  const businessLanguage = 'never name tables, endpoints, libraries, or screens';
  for (const md of [build, maintain, epic]) expect(md).toContain(businessLanguage);
  for (const md of [build, maintain]) expect(md).toContain('Developer fills this in. BA leaves it empty.');
});
```

**Negative prose assertion across every file** (`packages/core/test/templates.test.ts:101-103`) —
the shape for SKILL-07 ("no other skill text names `verified` as a write") and for the
"No other tools named" project constraint:

```typescript
const legacyFolder = new RegExp('features' + '/');
for (const name of names) expect(templates[name]).not.toMatch(legacyFolder);
```

Note the `new RegExp('features' + '/')` construction on line 102 — the literal is split so the test
file itself does not contain the forbidden string and trip its own scan. That trick will be needed
again if a skills test forbids a word the test must name.

**Ordered-structure assertion** (`packages/core/test/templates.test.ts:32, 70-75`) — the analog for
SKILL-12's "the plan-review step precedes the implementation step":

```typescript
const headings = (md: string) => md.split('\n').filter((line) => line.startsWith('## '));

it('headings are in D-07 order', () => {
  const story = ['## Intent', '## Requirements', '## Acceptance criteria', '## Open questions', '## Plan', '## Verification notes'];
  expect(headings(build)).toEqual(story);
});
```

An `.toEqual()` on an extracted ordered array beats two `indexOf` comparisons: it fails with the
whole actual order printed.

**Byte-identity assertion** (`packages/core/test/templates.test.ts:77-86`) — the existing precedent
for D-119's "the two rendered `prototype.md` copies are byte-identical":

```typescript
expect(buildFm).toBe(maintainFm);
expect(stripHtmlComments(build)).toBe(stripHtmlComments(maintain));
expect(build).not.toBe(maintain);
```

The last line is the part to steal: assert the *difference* too, so a test that would pass on two
empty strings cannot.

**Modification required** — `packages/core/templates/business-rules.md` gains the D-116 line. The
insertion point is inside the existing guidance comment at lines 3-4:

```markdown
<!-- BA. Rules, thresholds, tolerances, rounding, and edge cases already decided; one rule per bullet.
When a story depends on a rule, the ticket cites it instead of restating it. At handover, epic requirements are folded in here. -->
```

Adding a line here moves `packages/core/src/generated/templates.ts` (drift test at
`templates.test.ts:126`) and needs an assertion added next to
`it('ownership guidance is present', …)`.

---

### The wrong-plan fixture (D-115)

**Analog:** `packages/core/test/fixtures/gate-ready/` (20 fixtures exist under
`packages/core/test/fixtures/`, all tracked). `makeRepo(fixture)`
(`packages/cli/test/helpers/repo.ts:30-35`) copies one into a temp git repo by name, and
`packages/cli/test/helpers/repo.ts:15` resolves them from the cli package:

```typescript
const fixtures = fileURLToPath(new URL('../../../core/test/fixtures/', import.meta.url));
```

So a fixture placed under `packages/core/test/fixtures/` is reachable from **both** test packages,
whereas one placed beside the skill tests is not. That is the deciding argument for CONTEXT.md's open
layout question, unless the fixture is never driven through the CLI.

---

## Shared Patterns

### Core purity (applies to every file under `packages/core/src/skills/`)

**Source:** `eslint.config.js:5-29`, `packages/core/test/purity.test.ts`

```javascript
const nodeBuiltins = [
  'fs', 'fs/promises', 'path', 'child_process', 'os', 'url', 'crypto', 'process',
  'util', 'stream', 'events', 'buffer', 'module', 'worker_threads', 'net', 'http', 'https', 'tty',
  'readline', 'zlib', 'assert',
];
const purity = 'core is isomorphic: no Node built-ins (CORE-01)';

{
  files: ['packages/core/src/**/*.ts'],
  rules: {
    '@typescript-eslint/no-restricted-imports': ['error', {
      paths: nodeBuiltins.map((name) => ({ name, message: purity })),
      patterns: [{ group: ['node:*'], message: purity }],
    }],
  },
},
```

Both bare (`'path'`) and prefixed (`'node:path'`) forms are blocked, and `**/src/generated/**` is in
the top-level `ignores` (`eslint.config.js:13`) — so the generated `skills.ts` is exempt from lint
but **not** from `tsc`, which is why it must be plain data with no imports.

`**/scripts/**` gets Node globals at `eslint.config.js:17`. That is the entire exemption
`gen-skills.mjs` needs.

### Posix paths everywhere (D-51)

**Source:** `packages/core/src/gate/index.ts:39-41` (compose), `packages/cli/src/load/fs.ts:46`
(convert), `packages/cli/test/spawn-surface.test.ts:103-122` (enforce)

**Apply to:** `skillTargets()` output, every `sync` status line, every relative reference inside a
rendered skill.

The enforcement is real and runs against live stdout:

```typescript
// Report the offending line, not a bare boolean: this fails on a host the author does not have.
const offender = text.split('\n').find((line) => line.includes('\\'));
expect(offender, `accord ${name} ${stream}: ${offender}`).toBeUndefined();
```

### BOM + CRLF normalisation before any comparison or hash

**Source:** `packages/core/src/load/frontmatter.ts:8-14` (canonical, exported as `normaliseText`)

**Apply to:** `gen-skills.mjs` (copy the inline form from `gen-templates.mjs:10`), the drift test,
and — critically — `skills sync`'s read-back before recomputing the hash (RESEARCH.md Pitfall 1).

```typescript
const BOM = String.fromCharCode(0xfeff);

/** Strip one leading BOM and turn CRLF into LF; neither is ever reported (D-38). */
export function normaliseText(text: string): string {
  return (text.startsWith(BOM) ? text.slice(1) : text).replace(/\r\n/g, '\n');
}
```

The repo's own `.gitattributes` is `* text=auto eol=lf`, which protects this repository but not a
user's, which is the whole point of the pitfall.

### `UsageError` / exit 2 for environment problems

**Source:** `packages/cli/src/load/fs.ts:9-16`

**Apply to:** the pin refusal (already handled by `preflight`) and any filesystem failure during
`sync`.

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

It is caught once, at `packages/cli/src/run.ts:121-125`, which writes `err.message` to stderr and
returns `err.exitCode`. A command never calls `process.exit` and never writes its own exit code for
this class.

### Decision numbers in comments

**Source:** every file in `packages/core/src/` and `packages/cli/src/`.

Examples to match: `packages/core/src/gate/hash.ts:1` (`// GATE-01/GATE-03 AC hash (D-75, D-77): …`),
`packages/cli/src/commands/new-ticket.ts:23-25` (`// T-05-14: this is the only guard between an argv
string and a filesystem write…`), `packages/core/src/write/frontmatter.ts:27` (`// D-45: every string
core writes is double-quoted…`). Comments in this repo explain *why this and not the obvious
alternative*, and they are dense — roughly one explanatory block per non-trivial decision. Match it.

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `packages/core/skills/ba/SKILL.md`, `ba/setup.md`, `ba/story.md`, `ba/ready.md` | prose data | — | No BA workflow prose exists anywhere in the repo. The nearest *content* references are `docs/design.md` §3 (week-zero vs per-story) and the guidance comments in `packages/core/templates/ticket-build.md` — content sources, not pattern analogs. |
| `packages/core/skills/dev/SKILL.md` | prose data | — | Same. `docs/design.md` §4 is the content source. |
| `packages/core/skills/dev/review.md` | prose data | — | The fresh-context review brief has no existing draft; `docs/skills/code-review.md` is the *technique* it loads, not the brief. |
| `packages/core/skills/designer/SKILL.md` | prose data | — | No designer prose exists. |
| `packages/core/skills/shared/prototype.md` | prose data | — | No prototype guidance prose exists. `packages/core/templates/prototype-header.html` is the artifact it describes, not guidance about it. |

**The two that do have analogs** — these are file *moves*, not new writing, and both are tracked:

| New file | Source | Note |
|----------|--------|------|
| `packages/core/skills/dev/debug.md` | `docs/skills/debug.md` (118 lines) | Body graduates verbatim except the single line-24 paragraph named in 06-02 Task 1 step 1 — see that step, not this row, for the replacement text. Opens `# Technique: systematic debugging` (line 1) with no frontmatter. |
| `packages/core/skills/dev/code-review.md` | `docs/skills/code-review.md` (116 lines) | Same shape, `# Technique: code review` at line 1. |

**Current shape of the two files being deleted** (`git ls-files` confirms both tracked):

`.claude/skills/accord-debug/SKILL.md` (129 lines) — frontmatter, then a hand-written
"this is a draft" HTML comment, then the body of `docs/skills/debug.md` with its `# Technique:` H1
removed:

```markdown
---
name: accord-debug
description: Use when encountering any bug, test failure, or unexpected behaviour, before proposing a fix. Finds the root cause first; a symptom fix is a failure.
---

<!-- Draft copy. Source of truth: docs/skills/debug.md in this repo.
     Phase 6 turns that source into core data and renders this file with a
     generated marker and hash; until then this copy is maintained by hand and
     can drift. Edit the source, not this file.
     The method below applies to any codebase. The bindings to ticket files and
     `accord status` activate once `accord init` has run in the repo. -->
```

`.claude/skills/accord-code-review/SKILL.md` (127 lines) — identical structure, pointing at
`docs/skills/code-review.md`.

Three concrete carry-overs for the planner:

1. **The `description` field is already written** for both techniques, in the "Use when …" imperative
   form the spec asks for (RESEARCH.md Fact 3, consequence 3). Reuse these strings for the
   `accord-dev` role's own `description` style rather than inventing a voice.
2. **The delete is a graduation, not a cleanup.** Both files' own comments say Phase 6 replaces them.
   The replacement lands in `accord-dev/debug.md` and `accord-dev/code-review.md` — as *bundled
   references with no frontmatter*, so the 2 frontmatter blocks above do not survive. The 11-line
   draft comment is superseded by the one-line generated marker.
3. **129 and 127 lines are the two techniques' actual sizes**, and D-129 leaves bundled references
   unbounded — so the ceiling applies only to the three `SKILL.md` files, none of which exists yet.

## Metadata

**Analog search scope:** `packages/core/src/`, `packages/core/scripts/`, `packages/core/test/`,
`packages/core/schemas/`, `packages/core/templates/`, `packages/cli/src/`, `packages/cli/test/`,
`.claude/skills/`, `docs/skills/`, repo root config
**Files read in full:** 21
**Tracked-source check:** `git ls-files` run over all 29 cited paths; all 29 returned tracked
**Pattern extraction date:** 2026-09-15

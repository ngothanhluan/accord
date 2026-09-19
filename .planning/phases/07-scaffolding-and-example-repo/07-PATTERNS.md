# Phase 7: Scaffolding and Example Repo - Pattern Map

**Mapped:** 2026-09-17
**Files analyzed:** 9 new/modified
**Analogs found:** 7 / 9

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---|---|---|---|---|
| `packages/cli/src/commands/init.ts` (new) | command | file-I/O (multi-file write + report) | `packages/cli/src/commands/skills.ts` | exact |
| `packages/core/src/scaffold/*.ts` (new: the "what to write" plan) | pure planner | transform (config -> `{path,text}[]`) | `packages/core/src/skills/targets.ts` | exact |
| `packages/core/templates/workflow.yml` or `.github-workflow.yml` (new shipped asset) | template data | static data -> generated record | `packages/core/templates/ticket-build.md` + `scripts/gen-templates.mjs` | role-match (see "No Analog": no YAML asset exists yet) |
| `packages/core/src/generated/templates.ts` (regenerated) | generated data | — | itself | exact |
| `packages/cli/src/run.ts` (modified: `.command('init')`) | wiring | request-response | `program.command('skills')` block, `run.ts:122-129` | exact |
| `packages/core/src/index.ts` (modified: export the scaffold plan) | barrel | — | `index.ts:35-36` (`skillTargets`/`SkillFile`) | exact |
| `packages/cli/test/init.test.ts` (new) | test | file-I/O | `packages/cli/test/skills-sync.test.ts` + `new-ticket.test.ts` | exact |
| `packages/core/test/examples.test.ts` (new, D-147 gate proof) | test | transform | `packages/core/test/gate.test.ts` + `test/helpers/fixture.ts` | exact |
| `examples/<maintain>/`, `examples/<build>/` (new) | fixture repos | data | `packages/core/test/fixtures/valid-build/` | role-match |
| skill definition edits for SKILL-04 (`packages/core/skills/**/*.md`) + a test | content + test | — | `packages/core/test/skills.test.ts` | exact |

## Pattern Assignments

### `packages/cli/src/commands/init.ts` (command, multi-file write)

**Primary analog:** `packages/cli/src/commands/skills.ts` — the only existing multi-file write path.
**Secondary analog:** `packages/cli/src/commands/new-ticket.ts` — the existing-path refusal and the single printed path.

**Imports pattern** — `skills.ts:9-22` (node built-ins first, core barrel, then local, then `type` imports last):

```ts
import { lstatSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { allSkillDirs, contentHash, ... } from '@accord-dev/accord-core';
import { UsageError } from '../load/fs.js';
import type { AccordConfig } from '@accord-dev/accord-core';
import type { CommandContext } from '../run.js';
```

**Signature and return** — every command is `(ctx: CommandContext, ...args) => number` (`skills.ts:105`, `new-ticket.ts:18`). `status` is the only async one.

**Compute-then-render, one status per path** — `skills.ts:120-149`. This is the exact shape D-133 asks for (`created`/`skipped` list, exit 0):

```ts
type Status = 'created' | 'unchanged' | 'updated' | 'overwrote local edits';
// Computed once, then rendered — so a `--json` mode added later cannot disagree with the text.
const results: { status: Status; path: string }[] = [];
...
ctx.stdout.write(results.map((r) => r.status + ' ' + r.path + '\n').join(''));
return 0;
```

**Existence-decides-write** — the D-130 predicate already exists in two forms:

`new-ticket.ts:47-52`:
```ts
if (existsSync(file)) throw new UsageError(rel + ' already exists - nothing was written');
mkdirSync(join(ctx.root, 'accord', 'tickets'), { recursive: true });
writeFileSync(file, text);
ctx.stdout.write(rel + '\n');
```

`skills.ts:123-129` (the non-throwing form `init` wants — skip, do not refuse):
```ts
const file = join(ctx.root, ...path.split('/'));
const found = lstatSync(file, { throwIfNoEntry: false });
if (found === undefined) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, text); // no encoding argument: Node defaults to utf8 and writes no BOM (FMT-08)
  results.push({ status: 'created', path });
```

**Pre-pass guard before the first byte** — `skills.ts:88-118`. `assertNoLink(root, path)` walks *every* component with `lstatSync` (not just the leaf) and throws `UsageError`; the loop over all targets runs before any write so the "nothing was written" message cannot lie:

```ts
for (const { path } of targets) assertNoLink(ctx.root, path);
```

**Path composition and printing** — core paths are forward-slash strings; the CLI converts at the write site only (`skills.ts:123`: `join(ctx.root, ...path.split('/'))`) and prints the forward-slash string, never the joined one. Same in `new-ticket.ts:44-53` (`const rel = 'accord/tickets/' + id + '.md'`).

---

### `packages/core/src/scaffold/*.ts` (pure planner)

**Analog:** `packages/core/src/skills/targets.ts` — the D-107 "core decides, cli writes" precedent.

**Interface to copy** (`targets.ts:10-13`):
```ts
export interface SkillFile {
  path: string; // repo-relative, forward slashes, never a native separator (D-51)
  text: string;
}
```

**Path composition rule** (`targets.ts:30-33`, verbatim):
> Paths are composed by string concatenation: node:path is banned in core (CORE-01) and a `join` would emit a backslash on Windows, which would then be written into a file and printed to a terminal (D-51).

**Deterministic ordering** (`targets.ts:24-25`, `:75`) — a hand-written code-point comparator, never `localeCompare`:
```ts
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);
...
return out.sort((a, b) => cmp(a.path, b.path));
```

**Fixed table, never config-derived path components** (`targets.ts:17-22` + the T-06-01 comment at `:1-4`) — the runtime→directory map is a source literal precisely so no user string can enter a path. The same reasoning applies to `init`'s target list.

**Version string into content:** the running version comes from `pkg.version`, read via an import attribute. `run.ts:9` `import pkg from '../package.json' with { type: 'json' };` and `pin.ts:6` the same. Note `pinMessage(pinned, running)` takes `running` as a parameter *so a test can drive a mismatch without rewriting package.json* (`pin.ts:12-13`) — the scaffold planner should take the version as a parameter for the same reason; core cannot read the CLI's package.json at all.

**Export line to add** — `packages/core/src/index.ts:35-36`:
```ts
export { allSkillDirs, skillDirs, skillTargets } from './skills/targets.js';
export type { SkillFile } from './skills/targets.js';
```

---

### `packages/cli/src/run.ts` (registration)

**Exactly where `.command('init')` goes:** as a new top-level block. `init` is the one command that must run in a repository with **no** `accord/` folder, so it cannot use `preflight` — `preflight` calls `loadFromFs(root)`, whose `accordFiles` throws `UsageError('no accord/ folder in ' + root)` (`load/fs.ts:38-41`) before the pin check. Place the block **before** the `lint` registration at `run.ts:77` (first command = first thing a user runs) and have its action call `repoRoot(opts.cwd)` directly, not `preflight(opts)`.

Surrounding shape to copy (`run.ts:122-129`, the `skills sync` block — note the chaining caveat):

```ts
  // D-121: the same `preflight` every other repository-reading command uses ...  Chained like `new ticket`,
  // which means `.command('sync')` returns the *child*: if `skills` ever gains a second subcommand this
  // must switch to the `gates` local-variable form above.
  program
    .command('skills')
    .description('manage the accord skill copies in this repository')
    .command('sync')
    .action(() => {
      setCode(skills(preflight(opts)));
    });
```

Single-level form to follow for `init` (`run.ts:77-83`):
```ts
  program
    .command('lint')
    .description('report every finding in the accord folder')
    .option('--json', 'print the LintResult object instead of text')
    .action((options: { json?: boolean }) => {
      setCode(lint(preflight(opts), options));
    });
```

D-134 says `init` takes no options, so the action is `.action(() => { setCode(init(...)); })`.

**Exit-code plumbing:** actions never return; they call `setCode(n)` (`run.ts:63`, and the comment at `:58-62` explains why). `UsageError` thrown anywhere inside becomes exit 2 via `runCli`'s catch (`run.ts:153-157`).

**Test coupling:** `buildProgram` is walked by `packages/cli/test/skill-commands.test.ts:33-44` (`commandPaths`), which enumerates real command paths. Adding `init` automatically widens that allowlist — no test edit needed, but a skill may now name `accord init`.

---

### `packages/cli/test/init.test.ts` (write-path test)

**Analogs:** `packages/cli/test/skills-sync.test.ts:1-45` and `packages/cli/test/new-ticket.test.ts:1-33`.

**Sandbox pattern** (identical in both, `new-ticket.test.ts:19-27`):
```ts
const repos: string[] = [];
function sandbox(fixture = 'valid-build'): string {
  const repo = makeRepo(fixture);
  repos.push(repo);
  return repo;
}
afterEach(() => { while (repos.length > 0) cleanup(repos.pop() as string); });
```

**Helpers** — `packages/cli/test/helpers/repo.ts`:
- `makeRepo(fixture)` (`:30-35`) — `mkdtempSync(join(tmpdir(), 'accord-cli-'))`, `cpSync` a *core* fixture (`../../../core/test/fixtures/`), `git init -q`.
- `gitIn` (`:17-27`) refuses to run git outside the tmpdir, using `realpathSync.native` for Windows 8.3 short names.
- `run(argv, cwd, env)` (`:65-74`) — in-process `runCli` with `PassThrough` streams, returns `{ code, out, err }`.
- `commitAll(repo)` (`:43-53`) — needed if the example test drives `gate done` through the CLI.
- `cleanup` (`:57`) — `rmSync({ maxRetries: 5 })` for Windows read-only git objects.

**Byte-exact reads** (both files): `const bytes = (file: string): string => readFileSync(file, 'latin1');`
**Listing assertions**: `skills-sync.test.ts:23-31` `listing(repo)` recursively lists and sorts — the "sorted directory listing" golden shape STACK Decision 7 names.
**`init` in a repo that has no `accord/` folder:** no existing test does this — `makeRepo` always copies a fixture that already has one. A new empty-repo helper (mkdtemp + `git init`, no `cpSync`) is needed; `makeRepo` is the shape to copy, not reuse.

**Printed-path invariant test:** `packages/cli/test/spawn-surface.test.ts:86-127`. Add an `init` row to the `COMMANDS` table at `:89`:
```ts
{ name: 'new ticket', argv: ['new', 'ticket', 'TCK-1'], guard: 'accord/tickets/TCK-1.md' },
{ name: 'skills sync', argv: ['skills', 'sync'], guard: '.claude/skills/accord-dev/SKILL.md' },
```
The assertion (`:110-118`) finds the offending line and reports it, rather than a bare boolean. The same file's `spawnSites()` scan (`:44-61`) enumerates every `.ts` under `packages/cli/src/` and allows only `git`/`gh` as a string literal first argument — a new `init.ts` is covered automatically, and D-139's `npx` may appear only inside the emitted YAML text, never as a spawn.

---

### `packages/core/test/examples.test.ts` (gate proof, D-147)

**Analog:** `packages/core/test/gate.test.ts:1-40` plus `packages/core/test/helpers/fixture.ts:10-19`.

```ts
export function readFixture(name: string): SnapshotInput {
  const root = fileURLToPath(new URL('../fixtures/' + name + '/', import.meta.url));
  ... files[relative(root, abs).split(sep).join('/')] = readFileSync(abs, 'utf8');
  return { files, tree: Object.keys(files).sort() };
}
```
`examples/` is outside `packages/core/test/fixtures/`, so this needs a sibling reader with a different base URL (or a `dir`-taking variant) — do not move the examples under `fixtures/`, D-145 puts them at the repo root.

**Explicit case table, not a directory scan** (`gate.test.ts:1-3, 16-24`) and the `git?: Git` field at `:23` — a fixture on disk cannot carry `git.commit`/`authors`, so `gate done` cases spread them onto the `SnapshotInput` in the test. The examples test needs the same for `gateDone`.

**Goldens:** `stableJson` (`helpers/fixture.ts:54-66`) + `toMatchFileSnapshot` into `packages/core/test/__golden__/<fixture>.<command>.json`. Naming convention visible in the directory: `gate-ready.CLEAN.ready.json`, `wrong-plan.lint.json`. Regeneration command is documented at `gate.test.ts:2`:
> Regenerate one with `npm test -- --project core gate -u -t "<case name>"`.

---

## Shared Patterns

### Exit-2 path
**Source:** `packages/cli/src/load/fs.ts:11-17`
```ts
export class UsageError extends Error {
  readonly exitCode = 2;
  constructor(message: string) { super(message); this.name = 'UsageError'; }
}
```
**Apply to:** `init.ts`. Caught in `run.ts:153-157`. Message convention: lowercase, names the path, ends `- nothing was written` when it is a refusal (`new-ticket.ts:49`, `skills.ts:95-100`).

### Version string
**Source:** `packages/cli/src/run.ts:9` / `packages/cli/src/pin.ts:6`, `:12`
`import pkg from '../package.json' with { type: 'json' };` — `pkg.version` (`0.1.0`) and `pkg.name` (`@accord-dev/accord`). Both the `config.yml` `accord:` value and the workflow's `npx --yes <name>@<version>` (D-135, D-139) come from this one object. Core must receive it as an argument.

### Repo root
**Source:** `packages/cli/src/root.ts:11-26` — `git rev-parse --show-toplevel`, `.trim().split(sep).join('/')`. `init` calls this directly (not `preflight`).

### Frontmatter edit
**Source:** `packages/core/src/write/frontmatter.ts:19` `setFrontmatterKey(text, key, value)` — the only existing core write primitive. Used by `new-ticket.ts:41`. `init` under D-134 writes `config.yml` from a fixed string, so it likely does **not** need this; listed so the planner does not rebuild it.

### Shipped-data records
**Source:** `packages/core/scripts/gen-templates.mjs:7` — `readdirSync(dir).filter((f) => /\.(md|html)$/.test(f))`. A `.yml` asset added under `packages/core/templates/` would be **silently ignored** by this filter; the regex must be widened (or the workflow text kept as a TypeScript literal). `gen-skills.mjs` is the sibling for `skills`. Both normalise: `.replace(/^﻿/, '').replace(/\r\n/g, '\n')` (`gen-templates.mjs:10`).
Note `packages/cli/package.json:7` `"files": ["dist", "README.md"]` — `templates/` is **not** published from the CLI package; the generated records are the only runtime source (`new-ticket.ts:34-36` says so explicitly). `new URL('../templates/', import.meta.url)` appears only in build scripts and tests, never in shipped `src/`.

### Purity guard (correction to CONTEXT.md)
**Source:** `eslint.config.js:20-29`
```js
{
  files: ['packages/core/src/**/*.ts'],
  rules: { '@typescript-eslint/no-restricted-imports': ['error', {
    paths: nodeBuiltins.map((name) => ({ name, message: purity })),
    patterns: [{ group: ['node:*'], message: purity }],
  }] },
},
```
**There is no `src/load/` or `src/scaffold/` exemption.** CONTEXT.md `<code_context>` §"Established Patterns" states "no `node:fs` outside `src/load/` and `src/scaffold/`" — that is not what the config says. The only carve-outs are `**/src/generated/**` (ignored entirely, `eslint.config.js:13`), `packages/core/src/validate/ajv.ts` for the ajv seam (`:32-41`), and `**/scripts/**` + `**/test/**` for globals only. A new `packages/core/src/scaffold/` directory is bound by full purity: **no `node:fs`, no `node:path`**. `packages/core/test/purity.test.ts:26-41` proves the rule fires, by lint-texting a probe at `packages/core/src/__eslint_probe__.ts`.

## No Analog Found

| File | Role | Data Flow | Reason |
|---|---|---|---|
| the generated GitHub Actions workflow (D-136 to D-140) | template data | static text | **Nothing in the codebase emits a workflow or any YAML.** `grep -rn "stringify" packages/*/src` returns only `JSON.stringify` (gate/lint/status `--json`). `yaml` is imported in exactly two places, both read-side: `packages/core/src/write/frontmatter.ts:5` (`parseDocument` for a splice-in-place edit) and the loaders. `packages/core/templates/` holds 7 files, all `.md`/`.html`, none `.yml`. The only workflow in the repo is `.github/workflows/ci.yml` (26 lines, hand-written, not generated) — useful as a *style* reference for step shape (`actions/checkout@v7`, `actions/setup-node@v7`, `runs-on`) but it is not an analog for emitting one. The workflow text should be a fixed string asset, not a serialised object. |
| `accord/config.yml` generation (D-134) | config | static text | Same reason: no code emits YAML. `accord/config.yml` (13 lines, with its Phase-6 header comment about `init` not overwriting it) is the content model to copy verbatim, but nothing generates it today. |

## Metadata

**Analog search scope:** `packages/cli/src/**`, `packages/core/src/**`, `packages/cli/test/**`, `packages/core/test/**`, `eslint.config.js`, `.github/workflows/`, `accord/`
**Files scanned:** ~25 read, 4 greps
**Pattern extraction date:** 2026-09-17

# Phase 6: Skills - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-09-15
**Phase:** 06-skills
**Areas discussed:** Definition source and shape; Technique and review.md packaging; `skills sync`
mechanics; Workflow content depth and proof; BA week-zero setup; Designer↔dev boundary; `## Plan`
granularity; `sync`↔`init` ordering; Skill audience and tone; Coexistence with other tools' skills;
Open questions after Ready; Readiness review placement; Designer skill thickness; Skill text
language; Opening command; Size ceiling

---

## Definition source and shape

| Option | Description | Selected |
|--------|-------------|----------|
| Markdown + codegen | `packages/core/skills/<name>.md` → `gen-skills.mjs` → `generated/skills.ts`; renderer strips frontmatter to the six spec fields and inserts marker + hash | ✓ |
| Structured data in TS | Each role an object `{ name, description, steps[] }`; renderer builds Markdown from it | |
| Keep source in `docs/skills/` | Codegen reads `docs/skills/*.md` directly | |

**User's choice:** Markdown + codegen (D-105).
**Notes:** Deciding argument was that the deliverable is prose and the ROADMAP scope note warns
against inverting content and rendering. `docs/skills/` was rejected because `core` would read
outside its package and `docs/` is not in the published `files:` list.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Authoring keys + strip | Source carries `kind:`, `loads:` alongside `name`/`description`; renderer strips to six spec fields, test asserts | ✓ |
| Six spec fields only | Source already in target shape; role↔technique relation lives in a separate table | |
| No frontmatter | `name` from filename, `description` from first line | |

**User's choice:** Authoring keys + strip (D-106).
**Notes:** Safe with respect to SKILL-10's unverified Codex question because source frontmatter
never ships. `description` judged too load-bearing to infer from a first line.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Render pure in core | `renderSkill()` + `skillTargets(config)` in core; CLI only writes | ✓ |
| Core holds data, CLI renders | All file-building in `packages/cli` | |
| Codegen emits finished files | `gen-skills.mjs` strips and marks at build time; sync is a plain copy | |

**User's choice:** Render pure in core (D-107).
**Notes:** Originally argued from Phase 8 reuse; that argument was later withdrawn when the MCP
removal was confirmed. Recorded in CONTEXT on the narrower ground that the definitions are already
data in core and the transform over them is pure.

---

## Technique and review.md packaging

| Option | Description | Selected |
|--------|-------------|----------|
| Bundled in the role directory | `accord-dev/` holds `SKILL.md`, `debug.md`, `review.md`, `code-review.md`, referenced by relative path | ✓ |
| Technique as sibling skills | Keep `accord-debug/` and `accord-code-review/` as separate skill directories | |
| Inline into `dev/SKILL.md` | One file carrying workflow, debug, review, and code review | |

**User's choice:** Bundled in the role directory (D-108).
**Notes:** The deciding argument was paths, not size — a sibling directory forces an absolute path
correct in only one of the two target directories. Inlining was rejected on correctness: the fresh
review context must receive `review.md` and nothing else. Accepted cost: the author loses
`accord-debug` and `accord-code-review` as standalone invocable skills in this repository.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Adaptive, names no runtime | "Open a fresh context — a subagent where your runtime provides one, otherwise a new session — and hand it `review.md`" | ✓ |
| Always stop for the human | Skill halts and prints an instruction; never self-spawns | |
| Render a per-target sentence | Different instruction written into `.claude/skills/` and `.agents/skills/` | |

**User's choice:** Adaptive (D-109).
**Notes:** A manual step on every ticket is a step people skip and no gate detects. Per-target
rendering would recreate the drift SKILL-01 exists to eliminate.

---

| Option | Description | Selected |
|--------|-------------|----------|
| All files + dangling-path check | SKILL-08 scanner covers `SKILL.md` and every bundled file; plus an assertion that every relative reference resolves | ✓ |
| All files, no path check | Scan CLI commands in all files, exactly SKILL-08's stated scope | |
| `SKILL.md` only | Narrow reading of "skill" | |

**User's choice:** All files + dangling-path check (D-110).
**Notes:** Accepted as a small addition beyond the requirement's letter, because D-108 makes
relative references load-bearing and a dead one breaks the workflow silently.

---

## `skills sync` mechanics

Stated as settled before questioning, not asked: `roles` and `runtimes` are both `required` in
`packages/core/schemas/config.schema.json`, so `sync` must honour them; and the marker must sit
after the closing `---` because frontmatter has to start at line 1.

| Option | Description | Selected |
|--------|-------------|----------|
| Hash in marker, over file content | Hash covers the whole rendered file minus the marker line | ✓ |
| Hash in marker, over source | Hash computed from the definition in core | |
| Hash in a separate manifest | Root-level file mapping path → hash; marker carries only the notice | |

**User's choice:** Hash in marker over file content (D-111).
**Notes:** Only variant that detects both a changed definition and a hand-edited copy. Source
hashing would leave a hand edit invisible, removing the reason for the hash.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Overwrite and report loudly | Per-file status including "overwrote local edits"; no write at all when the hash matches | ✓ |
| Refuse on mismatch, require `--force` | Stop, name the drifted files, exit 2 | |
| Overwrite silently | Always write, no distinction | |

**User's choice:** Overwrite and report (D-112).
**Notes:** The file states its own contract; git is a hard precondition of the CLI so nothing is
unrecoverable; Phase 7's `init` calls the same function and must never be blocked.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Never delete, report orphans | Name any `accord-*` directory no longer declared, with the cleanup command | ✓ |
| Delete orphaned directories | Converge fully; remove marked directories no longer declared | |
| Do nothing, say nothing | `sync` only cares about what it writes | |

**User's choice:** Never delete, report (D-113).
**Notes:** An orphaned skill does keep loading until cleaned up, which is why silence was rejected;
automatic deletion touches files under the user's repository and the directory may hold additions
the generator never wrote.

---

## Workflow content depth and proof

| Option | Description | Selected |
|--------|-------------|----------|
| One page + bundled references | `SKILL.md` is ordered steps and CLI calls; detail in reference files the steps point to | ✓ |
| One full `SKILL.md` per role | Whole workflow in one file; only techniques bundled | |
| Very short `SKILL.md` | Only CLI calls and pointers to templates | |

**User's choice:** One page + bundled references (D-114).
**Notes:** Reuses D-108's mechanism rather than introducing a second concept. A pointer-only skill
cannot carry what ROADMAP criterion 6 requires.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Structural CI test + recorded manual UAT | CI asserts the plan-review step exists, states its constraints, and precedes implementation; wrong-plan fixture checked in; one recorded hand run | ✓ |
| Structural test only | Fully automated; accepts that it proves the text exists | |
| Rewrite criterion 7 | Change the ROADMAP wording to something machine-checkable | |

**User's choice:** Structural test + recorded manual UAT (D-115).
**Notes:** Running a model inside the test suite was ruled out before asking, by the "No API keys"
constraint. Rewriting the criterion was rejected as lowering the phase to match the instrument.

---

## Second round

| Area | Options | Selected |
|---|---|---|
| BA week-zero setup | One `ba` skill branching on `config.profile` ✓ / two roles `ba` + `ba-setup` / drop the setup branch | One skill, branches (D-118) |
| Designer↔dev prototype guidance | One `prototype.md` rendered into both role directories ✓ / only in `accord-designer/` / only in `accord-dev/` | Both (D-119) |
| `## Plan` granularity | Vertical slices per scenario ✓ / technical layers / teach nothing | Vertical slices (D-120) |
| `sync`↔`init`, and the two existing skill directories | Require config + delete the two old directories ✓ / require config + keep them / run without config | Require config, delete (D-121) |

**Notes:** D-118 follows `docs/design.md` §3, where week zero and per-story work are genuinely
different activities. D-119 is forced by two existing rules pulling against each other: §5 lets Dev
or Designer produce the prototype in `maintain`, while D-113 has `sync` honour `roles:`. D-120
states the shape lint already forces (D-74) rather than inventing one, and deliberately does not
prescribe layers, because layering is what SKILL-12's review judges. D-121 accepts that this
repository stops carrying its two standalone skills and starts dogfooding the generated layout.

---

## Third round

| Area | Options | Selected |
|---|---|---|
| Skill audience and tone | Agent + author, solo re-aim ✓ / neutral team-or-solo / team with a non-technical primary reader | Agent + author (D-122) |
| Coexistence with other tools' skills | Never touch, count, or comment ✓ / warn when the directory is crowded | Never touch (D-123) |
| Open question raised after Ready | Skill stops + re-runs `gate ready`, hole recorded as a FINDING ✓ / change the Done gate in this phase / convention only, no finding | Stop + FINDING (D-124) |
| Readiness review placement | Fresh context, same shape as the other two reviews ✓ / inline in the BA workflow / drop it and rely on `gate ready` | Fresh context (D-125) |

**Notes:** Two facts were verified in code before being offered as choices, not inferred.
(1) `.planning/notes/solo-reaim-and-three-layer-done.md` explicitly parks the "replace or stack the
skill surface" question as a Phase 6/7 question — D-123 answers it.
(2) `packages/core/src/gate/rules.ts:98` promotes `lint.open-question` for Ready only, and
`acHash` (D-77) does not move when a question is added, so an open question raised after Ready is
invisible to every gate — the FINDING recorded under D-124. It was also noted that a failing
`gate ready` does not remove a recorded `ac_hash` (D-96 writes only on a pass), so the stop leaves
no durable trace; this limit is written into CONTEXT rather than papered over.

---

## Fourth round

| Area | Options | Selected |
|---|---|---|
| `designer` skill thickness | Thin by design ✓ / thicken with token and `Derived from:` guidance / drop the role | Thin (D-126) |
| Skill text language | English ✓ / Vietnamese / both, rendered from config | English (D-127) |
| Opening command | All three open with `accord gate ready <id>` ✓ / a different command per role | `gate ready` for all three (D-128) |
| Size ceiling | A tested line-count ceiling ✓ / editorial principle only | Tested ceiling (D-129) |

**Notes:** Two candidate questions were dropped before being asked, because the record already
answered them: who writes the `@test:` tag and whether it disturbs `ac_hash` is settled by D-69,
D-77, `packages/core/src/gate/hash.ts`, and the guidance already present in
`packages/core/templates/ticket-build.md`. Thickening the designer skill was rejected because the
token rules are enforced by lint and SKILL-04 forbids restating an enforced rule.

---

## Todos

| Todo | Disposition |
|---|---|
| `.planning/todos/pending/rejected-alternatives-have-no-home.md` | Folded. Resolved as a `Rejected:` line convention in `product/business-rules.md` taught by the BA skill (D-116), rather than a schema change to `assumptions[]`. |
| `.planning/todos/pending/mcp-host-spike.md` | Folded only in order to be closed (D-117). Initially proposed by Claude as an independent non-blocking plan; the user challenged it ("tôi nhớ là ko cần mcp host nữa mà?"), which was verified correct against `03-CONTEXT.md:146`, `04-CONTEXT.md:172`, `05-CONTEXT.md:165`, and `.planning/notes/solo-reaim-and-three-layer-done.md`. The spike is not run; the outstanding roadmap removal is recorded as debt. |

---

## Claude's Discretion

Recorded in full in CONTEXT.md under "Claude's Discretion". In summary: module layout and function
signatures under `packages/core/src/skills/`; the source filenames and whether they sit flat or per
role; the marker's exact wording and hash algorithm; the wording of every `sync` status line; the
number behind the D-129 ceiling; how the SKILL-08 command scanner obtains the command list; the
wrong-plan fixture's location; and the `SKILL.md`-versus-reference split within each workflow.

## Deferred Ideas

Recorded in full in CONTEXT.md under "Deferred Ideas". The two with owner action attached:

- Adding `lint.open-question` and `lint.assumption-unconfirmed` to the Done gate's promoted set —
  the D-124 finding; reopens a closed and verified Phase 4.
- Removing ROADMAP Phase 8, MCP-01..07, and PROJECT.md milestone criterion 2 via `/gsd-phase`, plus
  rewording PROJECT.md and REQUIREMENTS from team contract to the solo re-aim — deferred across
  Phases 3, 4, and 5, and now blocking Phase 9's closure as written.

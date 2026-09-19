// D-55 public API: loadSnapshot, lintSnapshot, gateReady, gateDone, statusRows, renderText, the skill
// renderer and its target list, the model types, and the Phase 1 exports.
// load/*, lint/*, gate/*, and skills/* internals (the rule tables, `scoped`, the marker literal, and
// `skillLoads`) stay private: the CLI recognises a marker through `markerHash`/`withoutMarker` and never
// through a regex of its own (D-107).
export type { Finding, Level, LoadFinding, SchemaFinding } from './model/finding.js';
export type {
  SnapshotInput,
  RepoSnapshot,
  Ticket,
  TicketFrontmatter,
  ScenarioRef,
  Verification,
  VerificationFrontmatter,
  EvidenceBlock,
  Section,
  Line,
  AccordConfig,
} from './model/snapshot.js';
export { loadSnapshot } from './load/snapshot.js';
export { lintSnapshot } from './lint/index.js';
export type { LintResult } from './lint/index.js';
export { gateDone, gateReady } from './gate/index.js';
export type { GateResult } from './gate/index.js';
export { statusRows } from './status/rows.js';
export type { StatusRow } from './status/rows.js';
export { renderText } from './lint/render.js';
export { validate, schemaIds } from './validate/index.js';
export type { SchemaId } from './validate/index.js';
export { templates } from './generated/templates.js';
export type { TemplateName } from './generated/templates.js';
export { setFrontmatterKey } from './write/frontmatter.js';
export type { FrontmatterValue } from './write/frontmatter.js';
export { contentHash, markerHash, renderSkill, withoutMarker } from './skills/render.js';
export { allSkillDirs, skillDirs, skillTargets } from './skills/targets.js';
export type { SkillFile } from './skills/targets.js';
// `ScaffoldFile` is structurally identical to `SkillFile` and deliberately separate: a scaffold file is
// skipped when its path exists (D-130), a skill file is re-rendered against its marker and hash (D-131).
// Borrowing one name for both write contracts would make one of the two doc comments false.
export { initFiles } from './scaffold/init.js';
export type { ScaffoldFile } from './scaffold/init.js';
// CLI-03: not a `ScaffoldFile`, deliberately. The pointer's text depends on what the file already holds
// (D-142), which is the one thing the skip-if-exists write contract above never looks at.
export { POINTER_END, POINTER_FILES, POINTER_START, pointerText } from './scaffold/pointer.js';
export { skills } from './generated/skills.js';
export type { SkillKey } from './generated/skills.js';
// The read-back that `skills sync` compares against a hash must normalise exactly as the write did
// (RESEARCH.md Pitfall 1); re-exported so the CLI reuses this one, rather than hand-rolling a fourth copy.
export { normaliseText } from './load/frontmatter.js';

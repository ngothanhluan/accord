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
  Lane,
  ScenarioRef,
  Verification,
  VerificationFrontmatter,
  EvidenceBlock,
  Section,
  Line,
  AccordConfig,
  RouteKey,
  Effort,
  PlanTask,
  Plan,
  Ledger,
  Review,
  TicketWork,
} from './model/snapshot.js';
export { loadSnapshot } from './load/snapshot.js';
export { loadConfig } from './load/config.js';
export { lintSnapshot } from './lint/index.js';
export type { LintResult } from './lint/index.js';
export { gateDone, gatePlan, gateReady } from './gate/index.js';
export { isSha } from './gate/done.js';
export { approvedHash } from './gate/hash.js';
export type { GateResult } from './gate/index.js';
export { taskVerdict } from './gate/task.js';
export { forbiddenLines, trailerReason } from './gate/trailers.js';
export { planFile, undeclaredFiles, workOf } from './gate/work.js';
export { ID_PREFIX, initialsHolder, initialsOf, nextTicketId, peopleOf } from './lint/ids.js';
export { untracedTests } from './lint/tests.js';
export type { TaskVerdict } from './gate/task.js';
export { recordTaskDone } from './write/ledger.js';
export { writeTestTags } from './write/testtag.js';
export { branchTemplateOf, DEFAULT_BRANCH_TEMPLATE } from './status/branch.js';
export { anchorText } from './status/anchor.js';
export { ticketDetail } from './status/show.js';
export { approvalView } from './status/approval.js';
export type { CriterionDetail, CriterionLabel, TicketDetail } from './status/show.js';
export { rulesetText, sessionLine } from './status/session.js';
export { nextRows, statusRows } from './status/rows.js';
export { dashboard } from './status/dashboard.js';
export type { Dashboard, DashboardSection, DashboardSummary, EpicRow } from './status/dashboard.js';
export type { Stage } from './status/stage.js';
export type { StatusRow } from './status/rows.js';
export { renderText } from './lint/render.js';
export { validate, schemaIds } from './validate/index.js';
export type { SchemaId } from './validate/index.js';
export { templates } from './generated/templates.js';
export type { TemplateName } from './generated/templates.js';
export { setFrontmatterKey } from './write/frontmatter.js';
export { markDropped } from './write/dropped.js';
export type { FrontmatterValue } from './write/frontmatter.js';
export { contentHash, markerHash, renderSkill, withoutMarker } from './skills/render.js';
export { pluginDir, pluginTargets } from './skills/plugin.js';
export { AGENT_DEFAULTS, agentDir, agentTargets, renderAgent } from './skills/agents.js';
export { allSkillDirs, installedName, skillDirs, skillTargets, STAGES } from './skills/targets.js';
export type { SkillFile } from './skills/targets.js';
// `ScaffoldFile` is structurally identical to `SkillFile` and deliberately separate: a scaffold file is
// skipped when its path exists (D-130), a skill file is re-rendered against its marker and hash (D-131).
// Borrowing one name for both write contracts would make one of the two doc comments false.
export { initFiles } from './scaffold/init.js';
export type { ScaffoldFile } from './scaffold/init.js';
// CLI-03: not a `ScaffoldFile`, deliberately. The pointer's text depends on what the file already holds
// (D-142), which is the one thing the skip-if-exists write contract above never looks at.
export { POINTER_END, POINTER_FILES, POINTER_START, pointerText } from './scaffold/pointer.js';
export { refreshLintStep, repinConfig, repinWorkflow } from './scaffold/repin.js';
export type { StepRefresh } from './scaffold/repin.js';
export { mergePanel, panelSettings } from './scaffold/panel.js';
export { hookEntries, isAccordHookCommand, mergeHooks } from './scaffold/hooks.js';
export type { HookEntries } from './scaffold/hooks.js';
export { skills } from './generated/skills.js';
export type { SkillKey } from './generated/skills.js';
export { agents } from './generated/agents.js';
export type { AgentKey } from './generated/agents.js';
// The read-back that `skills sync` compares against a hash must normalise exactly as the write did
// (RESEARCH.md Pitfall 1); re-exported so the CLI reuses this one, rather than hand-rolling a fourth copy.
export { normaliseText } from './load/frontmatter.js';
// The slashed form the loader keys a configured path under (D-51), so the CLI prints the same one.
export { normaliseKey } from './load/snapshot.js';

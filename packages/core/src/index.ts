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
  Severity,
  RoundFinding,
  RecordedRound,
  RoundVerdict,
  RoundCycle,
  RoundRecord,
  BranchChange,
  BranchFact,
  ContentSince,
  ResearchFact,
  RangeCommit,
  HeadFact,
  RoundFacts,
  SecurityFacts,
  SlopFacts,
  RecordPin,
  ClaimPin,
  Discuss,
  DiscussArea,
  PlanFix,
  PlanHunk,
} from './model/snapshot.js';
export { loadSnapshot } from './load/snapshot.js';
export { debugHeadings, debugOpen, UNFINISHED_MARKER, unfinishedEpisode, unfinishedLine } from './load/unfinished.js';
export { isResearchPath, isResearchRecord, recordHeaderFaults, RESEARCH_DIR } from './load/research.js';
export { parseRounds, cycleOpen, ROUND_RECORD_LINE, ROUND_RECORD_LINE_2 } from './round/record.js';
export { APPROACH_CAP_FROM, claimPinBefore, claimPinError, COMMIT_MESSAGE_FROM, DEFERRED_MARK_FROM, DISCUSS_FROM, FIX_RECORD_FROM, GROUNDS_V2_FROM, PLAN_CAP_FROM, PLAN_FORMAT_FROM, PLAN_GROUNDS_FROM, PLAN_LARGE_FROM, PLAN_MODEL_FROM, PLAN_SIZE_FROM, PLAN_WAVES_FROM, RECORD_V2_FROM, RULESET_FROM, SECURITY_TRIGGER_FROM, SLOP_FROM, TASK_REPORT_FROM, TITLE_RULE_FROM, pinAllowsV1, pinBefore, pinOf, rulesetFrom, rulesetOfTicket } from './round/pin.js';
export { parseDiscuss, SLOP_OK } from './load/work.js';
export { FIX_REPORT_CONTRACT, REPORT_CONTRACT, reportReasons } from './gate/task-report.js';
export { groundsDeferred, groundsFrom, groundsOn, groundsProblems, groundsV2 } from './round/grounds.js';
export { fixScopeProblems } from './round/fixscope.js';
export { fixOn, fixProblems } from './round/fix.js';
export type { FixProblem } from './round/fix.js';
export { pendingAddedCode, scopeProblems, skipped as reviewSkipped } from './round/scope.js';
export { slopOn, slopUnresolved } from './slop/gate.js';
export { securityExemptRounds, securityOn, securityProblems, securityUnreviewed } from './round/security.js';
export type { SecurityProblem } from './round/security.js';
export {
  APPROACH_CAP,
  LEGACY_CAP,
  PLAN_CAP,
  ROUND_CAP,
  allowancesOf,
  approvalBlockers,
  approvalFindings,
  approvalProblems,
  blockingFindings,
  capRulesOf,
  cycleState,
  fixModel,
  modelFamily,
  nextRound,
  openFindings,
  planStopOf,
  recordProblems,
  roundCount,
  roundText,
} from './round/next.js';
export type { Allowance, CapRules, RoundAnswer, RoundKind } from './round/next.js';
export { PRESETS, resolveStrictness } from './config/strictness.js';
export type { Strictness } from './config/strictness.js';
export { FLOOR_STAGES, LOCKED, NO_OFF, OVERRIDABLE, STAGE_OF, SWITCHABLE_STAGES, effectiveLevel, floorProblems, levelRefusal, stageOff } from './gate/floor.js';
export type { ConfigStage, RuleLevel, StageName } from './gate/floor.js';
export { checkFixDispatch } from './round/dispatch.js';
export { configPin, loadConfig } from './load/config.js';
export { lintSnapshot } from './lint/index.js';
export type { LintResult } from './lint/index.js';
export { gateDone, gatePlan, gateReady } from './gate/index.js';
export { isSha, ownRecordsOnly, shaEqual } from './gate/done.js';
export { approvedHash, laneRHash } from './gate/hash.js';
export {
  budgetVerdict,
  LANE_R_SECTIONS,
  laneR,
  parseSpent,
  readTimebox,
  readTokenBudget,
  researchBudgetUnanswered,
  researchFieldMissing,
  researchOverBudget,
  sectionValue,
  spentLine,
} from './gate/lane-r.js';
export { parseScoutReport } from './scout/report.js';
export { citationFailures, expandPath, printedClaim, scoutCheck } from './scout/check.js';
export type { AbsentRow, Citation, ScoutReport } from './scout/report.js';
export type { ScoutFacts, ScoutLane, ScoutResult } from './scout/check.js';
export type { GateResult } from './gate/index.js';
export { taskVerdict, ticketTaskVerdict } from './gate/task.js';
export { forbiddenLines, trailerReason } from './gate/trailers.js';
export { planFile, undeclaredFiles, workOf } from './gate/work.js';
export { rulesetChanged, rulesetMissing } from './gate/ruleset.js';
export { PLAN_LARGE_TASKS, SIZE_MULTIPLE, sizeRefusal, TASK_LINE_CAP, taskLength } from './gate/plan.js';
export { afterCycles, buildWaves, DEFAULT_PARALLEL, parallelOf, sequentialReason } from './plan/waves.js';
export { CALL_SIGN, interfaceSigns, matches, outsideScope, scopeLines } from './gate/scope.js';
export { DEFAULT_SECURITY, parseSecurityFile, securityFile, securitySpec } from './security/spec.js';
export type { SecurityCheck, SecurityPattern, SecuritySpec } from './security/spec.js';
export { diffFiles, matchedHunks, securityTriggers, triggerText } from './security/match.js';
export type { DiffFile, DiffHunk, Trigger } from './security/match.js';
export { DEFAULT_SLOP, parseSlop, SLOP_FILE, slopFile, slopSpec, STRUCTURAL_KINDS } from './slop/spec.js';
export type { SlopPattern, SlopSpec } from './slop/spec.js';
export { CONVENTIONS_FILE, PRODUCT_MAX_LINE, RESERVED_HEADINGS, RESERVED_PREFIXES, checkProductText, conventionsFile, lineProblem, notReadLine, withheldFindingLine, withheldLine } from './product/lines.js';
export type { LineProblem, LineProblemKind, LineVerdict, ProductLine } from './product/lines.js';
export {
  BLOCK_ORDER, CHANGED_DUTY, CHANGED_HEADING, CHANGED_WITHHELD_LINE, CONVENTIONS_HEADING, EPIC_DUTY, FINDINGS_DUTY, FINDINGS_HEADING, JUDGE_DUTY, NO_DEFAULT_REF_LINE, REJECTED_DUTY,
  REJECTED_HEADING, RELATED_DUTY, ROLE_BLOCKS, TEST_ONLY_LINE, WRITER_DUTY, WRITER_ROLES, briefText, changedBlock, conventionsBlock, findingsBlock, productBlocks, subagentContext,
} from './product/assemble.js';
export type { BlockKind, ProductChange, ProductInputs, ProductRead, ProductRole, RelatedParts } from './product/assemble.js';
export { DEFAULT_MAX_FILE_LINES, growthHits, isManifest, maxFileLines, newDependencies, orphanCandidates, orphanHits, orphanTerms } from './slop/structural.js';
export type { NewDependency } from './slop/structural.js';
export { isLockfile, LOCKFILES, slopHits, slopLine, slopSkipped, sortHits } from './slop/match.js';
export type { SlopHit } from './slop/match.js';
export { compilePattern, DEFAULT_PATTERN, ID_PREFIX, initialsHolder, initialsOf, initialsOnRefs, nextTicketId, peopleOf, prefixOf, TRACKER_KEY, trackerKeyOk } from './lint/ids.js';
export type { CompiledPattern, IdsConfig } from './lint/ids.js';
export { removableBaseline, untracedTests } from './lint/tests.js';
export type { RemovableWhy } from './lint/tests.js';
export type { TaskVerdict } from './gate/task.js';
export { recordTaskDone } from './write/ledger.js';
export { writeTestTags } from './write/testtag.js';
export { branchTemplateOf, DEFAULT_BRANCH_TEMPLATE } from './status/branch.js';
export { auditLines, CONVENTIONS_THIN, conventionLines, conventionsEmpty } from './audit/conventions.js';
export type { AuditFact, AuditGap } from './audit/conventions.js';
export { CONFIG_KEYS, newKeys, setKeysOf } from './audit/keys.js';
export type { ConfigKeyRow } from './audit/keys.js';
export { CONFIG_AREAS } from './audit/config-areas.js';
export { mergeProposals } from './config/proposals.js';
export type { ConfigProposal, DroppedProposal, MergedProposals } from './config/proposals.js';
export type { ConfigArea, ConfigAreaKey } from './audit/config-areas.js';
export { subjectRuleProblems } from './lint/config.js';
export type { SubjectRuleProblem } from './lint/config.js';
export { DEFAULT_SUBJECTS, effectiveSubject, matchesSubject, OFF_TICKET_BRANCH, renderSubject, SUBJECT_NAMES, subjectCollisions, subjectsFor } from './commits/subjects.js';
export type { SubjectCollision, SubjectName } from './commits/subjects.js';
export { commitRuleLine, commitRuleNotInForce, commitRuleOf, commitRuleProblem, commitRuleRefusal, CONVENTIONAL_EXAMPLE, CONVENTIONAL_PATTERN } from './commits/rule.js';
export type { CommitRule, CommitRuleOf } from './commits/rule.js';
// Phase 8.1 D-01, D-03: the pull request body from the team's template, every heading kept.
export { epicBody, fillTemplate, findTemplate, prFacts, prTitle, prTitleProblem, templateSections, todaysBody } from './pr/template.js';
export type { PrFacts, TemplateSection } from './pr/template.js';
export { anchorText } from './status/anchor.js';
export { EPIC_LESSONS, EPIC_ROLES, epicBlock } from './status/epic.js';
export { ticketDetail } from './status/show.js';
export { approvalShort, approvalView } from './status/approval.js';
export type { CriterionDetail, CriterionLabel, TicketDetail } from './status/show.js';
export { rulesetText, sessionLine } from './status/session.js';
export { nextRows, statusRows } from './status/rows.js';
export { dashboard, isOpenWork } from './status/dashboard.js';
export { BASELINE_LISTED, baselineGap, branchGaps, deferredGaps, draftAge, draftStaleGaps, leftoverGaps, NO_COMMAND_BRANCH, SAFE_BRANCH, SAFE_ID, ticketIdleGaps } from './audit/hygiene.js';
export type { ClaimRefFact, OldDraft } from './audit/hygiene.js';
export { deferredMark, ownerDeferred, ratingOf } from './tickets/deferred.js';
export type { DeferredMark, DeferredRating, OwnerDeferred } from './tickets/deferred.js';
export { rejectedLines, relatedIds, relatedParts, relatedText } from './tickets/related.js';
export { requestWords, similarTickets, STOP_WORDS, ticketFacts } from './tickets/similar.js';
export { DEFAULT_TITLE_RULE, TITLE_PLACEHOLDER, titleProblem, titleRuleLine, titleRuleOf } from './tickets/title.js';
export type { TitleRule } from './tickets/title.js';
export { parseSplit } from './tickets/split.js';
export type { Split, SplitStory } from './tickets/split.js';
export type { SimilarFact, SimilarTicket } from './tickets/similar.js';
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
export { AGENT_DEFAULTS, agentDir, agentTargets, isIntactRender, renderAgent, RETIRED_FILES, RETIRED_SKILL_FOLDERS } from './skills/agents.js';
export { allSkillDirs, installedName, skillDirs, skillTargets, STAGE_FILES, stageFile, STAGES } from './skills/targets.js';
export type { SkillFile } from './skills/targets.js';
// `ScaffoldFile` is structurally identical to `SkillFile` and deliberately separate: a scaffold file is
// skipped when its path exists (D-130), a skill file is re-rendered against its marker and hash (D-131).
// Borrowing one name for both write contracts would make one of the two doc comments false.
export { initFiles } from './scaffold/init.js';
export { ACCORD_CHECK_NAME, requiredCheckSteps } from './scaffold/workflow.js';
export type { ScaffoldFile } from './scaffold/init.js';
// CLI-03: not a `ScaffoldFile`, deliberately. The pointer's text depends on what the file already holds
// (D-142), which is the one thing the skip-if-exists write contract above never looks at.
export { POINTER_END, POINTER_FILES, POINTER_START, pointerText } from './scaffold/pointer.js';
export { refreshLintStep, repinConfig, repinWorkflow } from './scaffold/repin.js';
export type { StepRefresh } from './scaffold/repin.js';
export { insertTeamSections, reservedSections, TEAM_HINT, teamSectionProblems } from './scaffold/sections.js';
export type { TeamSection } from './scaffold/sections.js';
export { addPersonEntry, appendConfigList, flowValue, getConfigValue, idConsequences, parseValue, resolveKeyPath, setConfigValue, unsetConfigValue } from './scaffold/configEdit.js';
export { mergePanel, panelSettings } from './scaffold/panel.js';
export { hookEntries, isAccordHookCommand, mergeHooks, mergeHooksWithNotes, runsAccordHook } from './scaffold/hooks.js';
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

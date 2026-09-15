// D-55 public API: loadSnapshot, lintSnapshot, gateReady, gateDone, statusRows, renderText, the model
// types, and the Phase 1 exports.
// load/*, lint/*, and gate/* internals (including the rule tables and `scoped`) stay private.
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

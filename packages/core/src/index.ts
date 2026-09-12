// D-55 public API: loadSnapshot, the model types, and the Phase 1 exports. load/* internals stay private.
export type { Finding, SchemaFinding } from './model/finding.js';
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
export { validate, schemaIds } from './validate/index.js';
export type { SchemaId } from './validate/index.js';
export { templates } from './generated/templates.js';
export type { TemplateName } from './generated/templates.js';
export { setFrontmatterKey } from './write/frontmatter.js';
export type { FrontmatterValue } from './write/frontmatter.js';

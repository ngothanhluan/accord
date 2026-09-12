// D-28 input contract and the RepoSnapshot model (D-30 to D-32, D-42, D-46). Type-only file.
// Plain records and arrays, never Map/Set, so JSON.stringify of a snapshot is the golden (D-54).
import type { Finding } from './finding.js';

export interface SnapshotInput {
  files: Record<string, string>; // repo-relative key -> text; everything under accord/ plus the tokens file (D-30)
  tree: string[]; // every path in the repository, content-free (D-30)
}

export interface Line {
  line: number; // 1-based Markdown line
  text: string; // the line without its terminator
}

export interface Section {
  heading: string; // raw text after '## ', trailing #s stripped: 'Acceptance criteria'
  line: number; // Markdown line of the heading
  lines: Line[]; // every line after the heading up to the next '## ' heading, fences included
}

export interface ScenarioRef {
  name: string; // 'Đăng nhập thành công'
  keyword: 'Scenario' | 'Scenario Outline'; // English name in every dialect (D-50)
  line: number; // Markdown line of the Scenario keyword (D-46)
  tags: string[]; // every tag on the scenario, raw: ['@ac-1', '@smoke']
  acTag?: string; // first tag matching @ac-n, without the '@': 'ac-1'
  steps: string[]; // Background steps then scenario steps, whitespace-collapsed (D-47, D-48)
}

export interface TicketFrontmatter {
  id: string; // 'LOGIN-1', kept verbatim (D-34)
  title: string;
  type: 'epic' | 'story' | 'bug';
  status: 'draft' | 'open' | 'archived';
  parent?: string; // 'EPIC-1'
  tracker?: Record<string, string>; // { shortcut: '1234' } — values are always strings
  ui: boolean; // defaults to false in the loader, not the schema (D-21)
  design?: string; // 'https://www.figma.com/file/abc'
  assumptions?: { text: string; confirmed: boolean }[];
  ac_hash?: string;
  verified?: string[]; // ['ac-1']
}

export interface Ticket {
  id: string; // file stem: 'LOGIN-1' (D-04)
  file: string; // 'accord/tickets/LOGIN-1.md'
  frontmatter?: TicketFrontmatter; // undefined when the document fails the schema (D-32)
  sections: Section[]; // every '## ' section in document order
  requirements: Line[]; // EARS lines under '## Requirements' (D-41)
  scenarios: ScenarioRef[]; // from gherkin fences under '## Acceptance criteria' (D-36)
}

export interface VerificationFrontmatter {
  ticket: string; // 'LOGIN-1'
  commit: string; // '1234567' — always a string
  reviewed_on: string; // '2026-09-01' — always a string
}

export interface EvidenceBlock {
  acTag: string; // 'ac-1' from '## @ac-1 <name>' (D-42)
  name: string; // the text after the tag, for humans
  line: number; // Markdown line of the block heading
  result?: 'pass' | 'fail' | 'blocked'; // undefined when missing or invalid (finding load.result-invalid)
  evidence: string; // text after 'Evidence:' to the end of the block, trimmed; may be ''
}

export interface Verification {
  ticket: string; // folder name: 'LOGIN-1'
  file: string; // 'accord/tickets/LOGIN-1/verification.md'
  frontmatter?: VerificationFrontmatter; // undefined when the document fails the schema (D-32)
  blocks: EvidenceBlock[];
}

export interface AccordConfig {
  accord: string; // '0.1.0'
  profile: 'build' | 'maintain';
  tracker: { adapter: 'none' | 'github-issues'; repo?: string };
  design: { tokens: string }; // 'src/styles/tokens.css' or ''
  roles: ('ba' | 'dev' | 'designer')[];
  runtimes: ('claude' | 'codex' | 'cursor' | 'copilot')[];
}

export interface RepoSnapshot {
  config?: AccordConfig; // undefined when accord/config.yml is missing or invalid (D-31)
  tickets: Record<string, Ticket>; // keyed by file stem
  verifications: Record<string, Verification>; // keyed by folder name
  tree: string[]; // sorted, forward slashes (D-29, D-30)
  errors: Finding[]; // every loader and schema finding, in file order
}

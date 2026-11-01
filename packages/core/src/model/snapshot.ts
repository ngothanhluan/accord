// D-28 input contract and the RepoSnapshot model (D-30 to D-32, D-42, D-46). Type-only file.
// Plain records and arrays, never Map/Set, so JSON.stringify of a snapshot is the golden (D-54).
import type { LoadFinding } from './finding.js';

export interface SnapshotInput {
  files: Record<string, string>; // repo-relative key -> text; everything under accord/ plus the tokens file (D-30)
  tree: string[]; // every path in the repository, content-free (D-30)
  // D-78: host-supplied git facts, following the D-72 precedent for `tests`. `authors` is keyed by
  // repo-relative posix path, plus one entry keyed by the value of `commit` carrying the gated commit's
  // author. Absent — not undefined — when the host cannot supply it, so the D-54 goldens are unchanged.
  git?: { commit: string; authors: Record<string, string> };
  // Spec §5: host-supplied claims, ticket id -> author of the tip of branch t/<id>. Absent when the host
  // has none, so the D-54 goldens are unchanged.
  claims?: Record<string, string>;
  // Ticket id -> newest committer time (unix seconds) over its records and claim branch. Absent when the host has none.
  lastActivity?: Record<string, number>;
  // Host-supplied ancestry: plan baseline sha -> is it an ancestor of HEAD. Absent when the host supplies none.
  ancestors?: Record<string, boolean>;
  // Host-supplied: baseline sha -> the plans' non-new `files:` paths that exist at that commit. Absent when the host supplies none.
  baselineFiles?: Record<string, string[]>;
  // Host-supplied: a recorded verified_commit or verification commit, as written -> paths changed from it to HEAD.
  // Present only when the sha is an ancestor of HEAD.
  recordsSince?: Record<string, string[]>;
  // Claim branch templates in force ('t/{id}', 'feature/{id}'). Absent when only the default applies.
  branchTemplates?: string[];
  // Ticket id -> short name of the winning claim ref ('feature/ST-AN-2'). Absent when no claim exists.
  claimBranches?: Record<string, string>;
  // The template a new claim is named by; absent when it is 't/{id}'.
  claimTemplate?: string;
  // Ticket id -> the subject of the last commit that touched its plan.md and whether plan.md has no uncommitted
  // change. A plan is ready when clean and the subject is exactly `plan: <id> ready`. Absent when the host supplies none.
  planFacts?: Record<string, { subject?: string; clean: boolean }>;
  // Ticket id -> the commits after its start commit (verified_commit, else verification.md's commit) on its own tip
  // that the default ref does not hold, oldest first. Present only for a ticket whose start commit is not on the default ref.
  afterVerify?: Record<string, AfterVerifyCommit[]>;
  // Ticket id -> its review.md: `clean` when the file is committed with no uncommitted change; `files`, every path changed by
  // the review commit, the last commit whose change to review.md adds or removes a `## Round ` line; absent when the host supplies none.
  reviewFacts?: Record<string, { clean: boolean; files?: string[] }>;
  // ST-LN-62: ticket id -> its branch diff; host-supplied by gate done for a ticket with `lane:`. Absent when the host supplies none.
  branchFacts?: Record<string, BranchFact>;
  // ST-LN-17: ticket id -> each ## Return from verify sha in its review.md -> whether the host confirmed it. Absent when the host supplies none.
  returnFacts?: Record<string, Record<string, boolean>>;
  // ST-LN-57: ticket id -> the round facts the host read from git (heads, ranges, pin). Absent when the host supplies none.
  roundFacts?: Record<string, RoundFacts>;
}

/** ST-LN-57: one commit of a round's range: its kind and the paths it changes (for a merge, the paths its remerge diff shows). */
export interface RangeCommit { sha: string; kind: 'commit' | 'merge' | 'episode'; files: string[] }
/** ST-LN-57: round j's head as the host read it: `high` the nearest code commit below the round's record, `low` the previous head. */
export interface HeadFact { high: string; low?: string; bound?: boolean | 'unknown' } // bound: version 2 only; 'unknown': the head names no commit
export type RoundFacts =
  | { error: string }
  | { pin?: string; pinAt?: string; basePin?: string; baseAt?: string; skip?: 'on-default'; heads: HeadFact[]; ranges: RangeCommit[][] };

/** Full shas, first parent first; `files` are the paths the commit changes (for a merge, the paths its remerge diff
 * shows), absent for a merge whose own changes git could not show. */
export interface AfterVerifyCommit {
  sha: string;
  parents: string[];
  files?: string[];
}

/** ST-LN-62: one path the branch changes from its merge base with the default branch to HEAD, renames split. */
export interface BranchChange {
  path: string;
  kind: 'added' | 'deleted' | 'modified' | 'mode' | 'type'; // 'mode': status M with differing modes; 'type': status T
  lines: number; // the larger of lines added and lines removed under -b --ignore-blank-lines --ignore-cr-at-eol; 0 when binary
  binary?: true;
  calls?: string[]; // added lines, under the same whitespace flags, that the call sign matches; present only when non-empty
  pkg?: { base?: string; head?: string }; // a file named package.json: its text at the merge base and at HEAD, each absent when the file is
}

/** ST-LN-62: the branch diff of one lane ticket, or why the host could not read it. */
export type BranchFact =
  | { error: string }
  | { base: string; changes: BranchChange[]; synced: string[]; baseConfig?: string; scope?: { commit: string; paths: string[] } };

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
  name: string; // 'Connexion réussie'
  keyword: 'Scenario' | 'Scenario Outline'; // English name in every dialect (D-50)
  line: number; // Markdown line of the Scenario keyword (D-46)
  tags: string[]; // every tag on the scenario, raw: ['@ac-1', '@smoke']
  acTag?: string; // first tag matching @ac-n, without the '@': 'ac-1'
  steps: string[]; // Background steps then scenario steps, whitespace-collapsed (D-47, D-48)
}

export type Lane = 'S' | 'M' | 'L' | 'P';

export interface TicketFrontmatter {
  id: string; // 'LOGIN-1', kept verbatim (D-34)
  title: string;
  type: 'epic' | 'story' | 'bug';
  status: 'draft' | 'open' | 'archived' | 'dropped';
  parent?: string; // 'EPIC-1'
  tracker?: Record<string, string>; // { shortcut: '1234' } — values are always strings
  ui: boolean; // defaults to false in the loader, not the schema (D-21)
  design?: string; // 'https://www.figma.com/file/abc'
  assumptions?: { text: string; confirmed: boolean }[];
  lane?: Lane; // spec §3: present opts the ticket into the workflow-layer contract
  depends_on?: string[]; // spec §5: ticket ids that must reach done first
  // ST-LN-13: repository paths of research records under accord/research/; optional
  research?: string[];
  priority?: 'high' | 'medium' | 'low';// how the dashboard ranks this ticket; absent means medium
  approved_hash?: string; // spec §4: written by `accord approve`, 'fnv1a64:<16 hex>'
  ac_hash?: string;
  verified?: string[]; // ['ac-1']
  verified_hash?: string; // D-76: the AC hash the ticks were made against, 'fnv1a64:<16 hex>'
  verified_commit?: string; // D-76: the commit sha those ticks were made against, at least 7 hex characters
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

export interface PlanTask {
  n: number; // 3, from '## Task 3: <title>'
  title: string;
  line: number; // Markdown line of the task heading
  covers: string[]; // tokens of the first 'covers:' line: ['@ac-1', 'D-02']
  files: string[]; // path tokens of the first 'files:' line, `(new)` dropped
  newFiles: string[]; // the paths of that line followed by `(new)`
  verify: string[]; // report case ids of the first 'verify:' line, `(@ac-n)` markers dropped
  maps: { test: string; ac: string }[]; // each `(@ac-n)` marker with the test id before it: { test: 'a#x', ac: '@ac-1' }
  lines: Line[]; // every line under the heading up to the next '## ' heading, fences included
}

export interface Plan {
  file: string; // 'accord/tickets/LOGIN-1/plan.md'
  tasks: PlanTask[];
  preamble: string; // the plan body above the first '## Task n' heading, verbatim
  baseline?: string; // frontmatter `baseline:`, a string as written; absent when there is none
  planHash?: string; // frontmatter `plan_hash:` as written, recorded by `gate plan`; absent when there is none
  bodyHash: string; // fnv1a64 of the normalised text below the frontmatter
}

export interface Ledger {
  file: string; // 'accord/tickets/LOGIN-1/ledger.md'
  done: Record<string, string>; // task number -> commit sha of its first done line
  rulings: string[]; // every 'Ruling: …' line, list marker stripped
  rulingsSection?: string[]; // the '## Rulings' section's non-blank lines as written, comments stripped; absent without one
  wordingOnly?: { path: string; reason: string }[]; // every 'Wording-only: <path> — <reason>' line; absent when none
  deferred?: { round: number; n: number; cycle: number }[]; // '- review <r>.<n>[ cycle <k>]: …' lines of the first '## Deferred' section; absent when none
}

export interface Review {
  file: string; // 'accord/tickets/LOGIN-1/review.md'
  verdict?: string; // the value of the last 'verdict:' line
  line?: number; // its Markdown line
  trailing?: true; // a non-blank line follows the last verdict line
  confirmed?: string[]; // paths of 'Confirmed wording-only: <path>' lines in the last '## Round'; absent when none
  notInterface?: string[]; // paths of 'Not an interface: <path> — <reason>' lines in the last '## Round'; absent when none
}

export type Severity = 'Must' | 'Should' | 'Nice';
export interface RoundFinding {
  severity: Severity;
  line: number;
  text: string; // the line trimmed, as written
  // Version 2 only (ST-LN-57): the parts of the finding line the form names.
  n?: number;
  file?: string; // absent for `none`
  state?: 'open' | 'fixed' | 'deferred';
  carried?: { round: number; n: number };
  risk?: 'data-loss' | 'security';
  test?: string;
  command?: string;
  restsOn?: { kind: 'ac' | 'decision' | 'Veto' | 'Intent' | 'Understood' | 'Done when'; ref: string }; // ref: ac-<n>, D-<nn>, or the quote without its quotes
}
export interface RecordedRound {
  line: number; // of its ## Round heading
  findings: RoundFinding[];
  noFindings: boolean;
  head?: string; // version 2 only (ST-LN-57): the commit the round reviewed up to, lower case
  added?: true; // version 2 only: the heading says (added code round 1)
  final?: true; // version 2 only: the heading says (final review)
}
export interface RoundVerdict { value: string; quoted: boolean; line: number } // quoted: accepted-by-owner followed by a "sentence"
export interface RoundCycle { line: number; marker?: string; rounds: RecordedRound[]; verdicts: RoundVerdict[]; closed?: number }
export interface RoundRecord {
  file: string;
  kind: 'review' | 'plan' | 'approach';
  versioned: boolean; // a `Round record: 1` or `Round record: 2` line above the first ## heading
  version?: 2; // ST-LN-57: set only for `Round record: 2`
  cycles: RoundCycle[]; // always at least one; review: split at ## Return from verify; plan: split after ## Closed
  unreadable: { line: number; reason: string }[];
}

export interface TicketWork {
  plan?: Plan;
  ledger?: Ledger;
  review?: Review;
  rounds?: RoundRecord; // review.md as round records (ST-LN-17)
  planRounds?: RoundRecord; // plan-review.md as round records (ST-LN-17)
  approachRounds?: RoundRecord; // approach-review.md as round records (ST-LN-80)
}

export type RouteKey =
  | 'scout' | 'auditor' | 'architect' | 'critic' | 'planner'
  | 'executor' | 'reviewer' | 'reviewer.final' | 'verifier' | 'debugger';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AccordConfig {
  accord: string; // '0.1.0'
  profile: 'build' | 'maintain';
  tracker: { adapter: 'none' | 'github-issues'; repo?: string };
  design: { tokens: string }; // 'src/styles/tokens.css' or ''
  roles: ('ba' | 'dev' | 'designer')[];
  runtimes: ('claude' | 'codex' | 'cursor' | 'copilot')[];
  tests?: { report: string; affected?: string; full?: string }; // D-72: repo-relative path of the test report; commands the skills run
  review?: { mode: 'human' | 'outcome' }; // spec §7: absent means 'human', the 0.1.0 behaviour
  models?: Partial<Record<RouteKey, { model: string; effort?: Effort }>>; // absent entries use the default routing
  escalation?: { fix_round_tier_up: string }; // '1'..'5'; YAML numerics stay strings
  stale_days?: string; // digits; YAML numerics stay strings
  people?: Record<string, string>; // email -> 2 to 4 capital letters (IDS-1)
  legacy_ids?: string[]; // ticket ids exempt from the id convention (IDS-1)
  branch?: string; // claim branch template with exactly one {id}; absent means 't/{id}'
  setup?: string[]; // D-07: commands run in order in a new worktree
  commits?: { trailers?: 'allow' | 'forbid' }; // ST-LN-8 D-01: absent or allow is off
  generated?: string[]; // ST-LN-62: paths a lane S ticket may change without listing them in ## Scope; an entry ending in / matches the folder
  sensitive?: Record<string, string[]>; // ST-LN-62: area name -> paths whose change fails a lane S ticket; an entry ending in / matches the folder
  disposable?: string[]; // ST-LN-55 D-08, D-12: file and folder names an ignored path may hold at any depth and still be deleted with its worktree; absent means node_modules, dist, .DS_Store, Thumbs.db
}

export interface RepoSnapshot {
  config?: AccordConfig; // undefined when accord/config.yml is missing or invalid (D-31)
  tickets: Record<string, Ticket>; // keyed by file stem
  verifications: Record<string, Verification>; // keyed by folder name
  tree: string[]; // sorted, forward slashes (D-29, D-30)
  errors: LoadFinding[]; // every loader and schema finding, in file order; lint stamps the level (D-58)
  files: Record<string, string>; // D-65: normalised text of every accord/assets/<id>/prototype.html, the config.design.tokens file, and the config.tests.report file, and every accord/research/ file some ticket lists under research:; nothing else
  tests?: Record<string, 'passed' | 'failed' | 'skipped'>; // D-72: absent when no report is in files
  // D-78: carried through from SnapshotInput. Host-supplied, `authors` keyed by repo-relative posix path
  // plus one entry keyed by the value of `commit`; absent, not undefined, when the host cannot supply it.
  git?: { commit: string; authors: Record<string, string> };
  work?: Record<string, TicketWork>; // spec §7-§10, keyed by ticket folder; absent when no record exists
  testsBaseline?: string[]; // spec §9: ids in accord/tests-baseline.txt; absent when the file does not exist
  claims?: Record<string, string>; // carried through from SnapshotInput
  lastActivity?: Record<string, number>; // carried through from SnapshotInput
  ancestors?: Record<string, boolean>; // carried through from SnapshotInput
  baselineFiles?: Record<string, string[]>; // carried through from SnapshotInput
  recordsSince?: Record<string, string[]>; // carried through from SnapshotInput
  commits?: { sha: string; message: string }[]; // ST-LN-8: host-supplied by gate done when commits.trailers is forbid
  branchTemplates?: string[]; // carried through from SnapshotInput
  claimBranches?: Record<string, string>; // carried through from SnapshotInput
  claimTemplate?: string; // carried through from SnapshotInput
  planFacts?: Record<string, { subject?: string; clean: boolean }>; // carried through from SnapshotInput
  afterVerify?: Record<string, AfterVerifyCommit[]>; // carried through from SnapshotInput
  reviewFacts?: Record<string, { clean: boolean; files?: string[] }>; // carried through from SnapshotInput
  branchFacts?: Record<string, BranchFact>; // carried through from SnapshotInput
  returnFacts?: Record<string, Record<string, boolean>>; // carried through from SnapshotInput
  roundFacts?: Record<string, RoundFacts>; // carried through from SnapshotInput
  // BUG-LN-13 D-01: host-supplied after load: the default ref as git names it ('refs/remotes/origin/main', or
  // 'refs/heads/main' in a clone without origin) and a snapshot of the records of the view's tickets and every
  // depends_on entry as that ref holds them. Only the done readers read it; absent when no default ref resolves.
  defaultRef?: { ref: string; snapshot: RepoSnapshot };
}

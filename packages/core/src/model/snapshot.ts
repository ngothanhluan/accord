// D-28 input contract and the RepoSnapshot model (D-30 to D-32, D-42, D-46). Type-only file.
// Plain records and arrays, never Map/Set, so JSON.stringify of a snapshot is the golden (D-54).
import type { SubjectName } from '../commits/subjects.js';
import type { SlopHit } from '../slop/match.js';
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
  // Host-supplied by gate done for the gated ticket: a recorded verified_commit or verification commit that is not an ancestor of HEAD
  // (a rebase or a team script rewrote it), lower case -> what the contents of the ticket's files did since. Absent when the host supplies none.
  contentSince?: Record<string, ContentSince>;
  // Claim branch templates in force ('t/{id}', 'feature/{id}'). Absent when only the default applies.
  branchTemplates?: string[];
  // Ticket id -> short name of the winning claim ref ('feature/ST-AN-2'). Absent when no claim exists.
  claimBranches?: Record<string, string>;
  // The template a new claim is named by; absent when it is 't/{id}'.
  claimTemplate?: string;
  // Ticket id -> the subject of the last commit that touched its plan.md and whether plan.md has no uncommitted
  // change. A plan is ready when clean and the subject is exactly the `plan_ready` subject of the id (`plan: <id> ready`, or the current or a legacy template). Absent when the host supplies none.
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
  // ST-LN-94 CR-01, CR-02: lane R ticket id -> its research fact. Absent when the host supplies none, which counts no record as the result.
  researchFacts?: Record<string, ResearchFact>;
}

/**
 * ST-LN-94 CR-01, CR-02: what git says of a lane R ticket's research. `claimTime` is the author time (seconds, kept by a rebase: REVIEW2 WR-03)
 * of the claim commit accord budget clocks from; `changed` maps each listed record the branch added or changed after that commit to the time
 * (seconds) of its last change: the author time of the last commit that touched it, or the host's clock for a change not yet committed.
 * REVIEW2 CR-01: with no claim commit to read (the default branch after a squash merge), `claimTime` is absent and `changed` holds the records
 * changed from the commit that added the ticket file on. `error` when git could not say, or the ticket has neither commit.
 */
/** ST-LN-96 D-04: `changed` is the ticket's files whose contents differ between the recorded commit and HEAD (empty: none); `absent`: the commit is not in this clone. */
export type ContentSince = { changed: string[] } | { absent: true };

export type ResearchFact = { error: string } | { claimTime?: number; changed: Record<string, number> };

/** ST-LN-57: one commit of a round's range: its kind and the paths it changes (for a merge, the paths its remerge diff shows). */
export interface RangeCommit { sha: string; kind: 'commit' | 'merge' | 'episode'; files: string[] }
/** ST-LN-91 D-11: the pin in accord/config.yml at the commit that first added a `## Round` heading to plan-review.md or approach-review.md, and at that commit's merge base with the default ref; `error` when git could not say. */
export type RecordPin = { pin?: string; basePin?: string } | { error: string };
/**
 * ST-LN-91 D-15: the pin at a ticket's claim commit and at its merge base with the default ref; `{ error }` when git failed reading it.
 * ST-LN-96 D-02: `ruleset` is the string `ruleset` the ticket file first held on its branch (absent when no commit wrote one, or a non-string): the one at the claim commit, else the
 * one in the first commit since the claim that wrote it (the backfill of a ticket claimed before RULESET_FROM), `rulesetCommit` being that commit. A rebase rewrites the claim commit
 * onto the new base, so the config pin at it moves, and the ruleset the first commit wrote does not.
 */
export type ClaimPin = { sha?: string; pin?: string; basePin?: string; ruleset?: string; rulesetCommit?: string } | { error: string };
/** ST-LN-91 D-14: one hunk of `git diff -U0` between two texts of plan.md: the old and new first line and line count (a count of 0 places the hunk after the line named). */
export interface PlanHunk { oldStart: number; oldCount: number; newStart: number; newCount: number }
/** ST-LN-91 D-14: the planner's fix of plan.md as the host read it: the commit it started from, its hunks and both texts; `error` when git could not say. */
export type PlanFix = { base: string; hunks: PlanHunk[]; old?: string; new?: string } | { error: string };
/** ST-LN-57: round j's head as the host read it: `high` the nearest code commit below the round's record, `low` the previous head. */
export interface HeadFact { high: string; low?: string; bound?: boolean | 'unknown' } // bound: version 2 only; 'unknown': the head names no commit
export type RoundFacts =
  | { error: string }
  | { pin?: string; pinAt?: string; basePin?: string; baseAt?: string; skip?: 'on-default'; heads: HeadFact[]; ranges: RangeCommit[][] };
/**
 * ST-LN-36 D-05 (5): the security triggers of each recorded review round's own package, as the host read them from git: one entry per `## Round` of review.md in record order (cycles flattened),
 * `head` the round's typed head and `triggers` the rendered triggers of the package from the previous round's head (round 1: the first round's base) to it; empty for a final review. `error` when git
 * could not say.
 */
export type SecurityFacts = { error: string } | { rounds: { head: string; triggers: string[] }[] };
/**
 * Phase 8.5 D-19: one executor fix report (`.accord-reports/<id>/fix-<k>.md`) as the host read it: its file name and each `places checked: <n>: <place>, <place>…` line, `n` the finding's
 * number (`<n>` or `<round>.<n>`) and `places` the listed places as written, trimmed.
 */
export interface FixReport {
  file: string;
  places: readonly { n: string; places: readonly string[] }[];
}

/**
 * Phase 8.1 D-14, D-17, D-20: the slop hits of a ticket's cumulative diff as the host read them from git (the list `accord review-package` prints under `## Slop`), and how many lines of the team's
 * slop file did not read; `error` when git could not say or the ticket's plan records no baseline. gate.slop-unresolved fails closed on it.
 */
export type SlopFacts = { hits: SlopHit[]; unread: number } | { error: string };

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

export type Lane = 'S' | 'M' | 'L' | 'P' | 'R';

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
  related?: string[]; // ST-LN-22 D-08: ticket ids this ticket continues or builds on; a link only, outside every hash and every gate
  // ST-LN-13: repository paths of research records under accord/research/; optional
  research?: string[];
  priority?: 'high' | 'medium' | 'low';// how the dashboard ranks this ticket; absent means medium
  approved_hash?: string; // spec §4: written by `accord approve`, 'fnv1a64:<16 hex>'
  ac_hash?: string;
  ruleset?: string; // ST-LN-96 D-02: the accord pin the ticket was claimed under, written by the claim; 'x.y.z' (a pre-release is ignored by the readers)
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
  unfinished?: number; // ST-LN-72 D-11: 1-based line of the `<!-- accord: unfinished -->` marker in the raw text; absent when the file does not carry it
}

export interface PlanTask {
  n: number; // 3, from '## Task 3: <title>'
  title: string;
  line: number; // Markdown line of the task heading
  covers: string[]; // tokens of the first 'covers:' line: ['@ac-1', 'D-02']
  files: string[]; // path tokens of the first 'files:' line, `(new)` dropped
  newFiles: string[]; // the paths of that line followed by `(new)`
  // ST-LN-10 D-12: one entry per newFiles path, in `files:` line order: `like` the model path of `(new, like <path>)`, `none` the reason of `(new, no model: <reason>)`, `unread` a `(new…` clause
  // that is neither form, as written; all absent for a bare `(new)`. The model path is never in `files`.
  models: { path: string; like?: string; none?: string; unread?: string }[];
  verify: string[]; // report case ids of the first 'verify:' line, `(@ac-n)` markers dropped
  maps: { test: string; ac: string }[]; // each `(@ac-n)` marker with the test id before it: { test: 'a#x', ac: '@ac-1' }
  // ST-LN-91 D-09: the first `after:` line outside a fence and a comment: the task numbers it names and the tokens it holds that are neither `none` nor a task number; absent with no such line or no token on it
  after?: { line: number; tasks: number[]; unread: string[] };
  lines: Line[]; // every line under the heading up to the next '## ' heading, fences included
}

export interface Plan {
  file: string; // 'accord/tickets/LOGIN-1/plan.md'
  tasks: PlanTask[];
  preamble: string; // the plan body above the first '## Task n' heading, verbatim
  baseline?: string; // frontmatter `baseline:`, a string as written; absent when there is none
  planHash?: string; // frontmatter `plan_hash:` as written, recorded by `gate plan`; absent when there is none
  bodyHash: string; // fnv1a64 of the normalised text below the frontmatter
  unfinished?: number; // ST-LN-72 D-11: 1-based line of the `<!-- accord: unfinished -->` marker in the raw text; absent when the file does not carry it
}

/** ST-LN-72 review round 1: debug.md, read only for the marker of its last open episode. */
export interface Debug {
  file: string; // 'accord/tickets/LOGIN-1/debug.md'
  unfinished?: number; // 1-based line of the `<!-- accord: unfinished -->` marker that is the first line under the last open `## Episode <n>` heading; absent otherwise
}

export interface Ledger {
  file: string; // 'accord/tickets/LOGIN-1/ledger.md'
  done: Record<string, string>; // task number -> commit sha of its first done line
  rulings: string[]; // every 'Ruling: …' line, list marker stripped
  rulingsSection?: string[]; // the '## Rulings' section's non-blank lines as written, comments stripped; absent without one
  wordingOnly?: { path: string; reason: string }[]; // every 'Wording-only: <path> — <reason>' line; absent when none
  // '- <review|plan|approach> <r>.<n>[ cycle <k>]: …' lines of the first '## Deferred' section; failingCase: the line holds ' — failing case: <case>' (ST-LN-91 D-12); absent when none
  deferred?: { kind: 'review' | 'plan' | 'approach'; round: number; n: number; cycle: number; failingCase?: true }[];
  epicLessons?: string[]; // the '## Epic lessons' section's non-blank lines as written, comments stripped (ST-LN-28 D-15); absent when there are none
}

export interface Review {
  file: string; // 'accord/tickets/LOGIN-1/review.md'
  verdict?: string; // the value of the last 'verdict:' line
  line?: number; // its Markdown line
  trailing?: true; // a non-blank line follows the last verdict line
  confirmed?: string[]; // paths of 'Confirmed wording-only: <path>' lines in the last '## Round'; absent when none
  notInterface?: string[]; // paths of 'Not an interface: <path> — <reason>' lines in the last '## Round'; absent when none
  slopJustified?: { kind: string; path: string; line: number; reason: string }[]; // 'slop:<kind> <path>:<line> — <reason>' lines in the last '## Round' (Phase 8.1 D-17); absent when none
}

export type Severity = 'Must' | 'Should' | 'Nice';
export interface RoundFinding {
  severity: Severity;
  line: number;
  text: string; // the line trimmed, as written
  // Version 2 only (ST-LN-57): the parts of the finding line the form names.
  n?: number;
  file?: string; // absent for `none`
  state?: 'open' | 'fixed' | 'deferred' | 'withdrawn' | 'repeated' | 'owner'; // the last three: version 1 plan and approach lines only (ST-LN-91)
  carried?: { round: number; n: number };
  repeatedAs?: { round: number; n: number }; // state 'repeated' with a target (ST-LN-91 RR-CR-01): the round.n the finding was repeated as
  risk?: 'data-loss' | 'security';
  test?: string;
  command?: string;
  restsOn?: { kind: 'ac' | 'decision' | 'Veto' | 'Correction' | 'Intent' | 'Understood' | 'Done when'; ref: string }; // ref: ac-<n>, D-<nn>, or the quote without its quotes
  restsOnAlso?: NonNullable<RoundFinding['restsOn']>[]; // ST-LN-91 round 7 CR-02: the further, different grounds the critic's block names after the first (never a record problem)
  // Version 2 review records only (ST-LN-56 D-08, D-10): the marks of a fixed finding.
  checked?: string[]; // `checked: <place>, <place>…`: each place `<path>` or `<path>:<line>`, at least one
  addressed?: { file: string; line: number }; // the re-reviewer's `addressed: <path>:<line>`
  notAddressed?: { file: string; line: number }; // the re-reviewer's `not addressed: <path>:<line>`
}
export interface RecordedRound {
  line: number; // of its ## Round heading
  findings: RoundFinding[];
  noFindings: boolean;
  head?: string; // version 2 only (ST-LN-57): the commit the round reviewed up to, lower case
  added?: true; // version 2 only: the heading says (added code round 1)
  final?: true; // version 2 only: the heading says (final review)
  security?: 'none' | 'ran'; // version 2 review records only (ST-LN-36 D-05 (3)): `Security: no pattern matched` or `Security: lens security ran`; 'ran' wins when a round holds both
  securityUnread?: { line: number; text: string }[]; // version 2 review records only: a line starting `Security:` that is neither form
  markUnread?: { line: number; text: string }[]; // version 1 plan and approach records (ST-LN-91 round 5): the mark slots of the round (a segment or a block line that starts with a mark key) whose value does not parse
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

/** ST-LN-91 D-04: one gray area of discuss.md: its group, its text, and the `D-nn` ids its answer became. */
export interface DiscussArea {
  line: number; // Markdown line of the list item
  group: string; // the part before the first ' — ', as written
  text: string; // the gray area in plain words
  decisions: string[]; // ['D-07', 'D-08']; empty when the line names none
}
/** ST-LN-91 D-04: accord/tickets/<id>/discuss.md, the ticket's record of every gray area and the Decision it became. */
export interface Discuss {
  file: string; // 'accord/tickets/LOGIN-1/discuss.md'
  areas: DiscussArea[]; // the column-0 list items under every '## Gray areas' heading, in order
  extraHeadings?: number[]; // the lines of every heading of gray areas but the first exact '## Gray areas' (a repeat, or '## Gray areas (cont.)'); absent when there is none
}

export interface TicketWork {
  discuss?: Discuss; // discuss.md (ST-LN-91)
  plan?: Plan;
  debug?: Debug; // debug.md (ST-LN-72)
  ledger?: Ledger;
  review?: Review;
  rounds?: RoundRecord; // review.md as round records (ST-LN-17)
  planRounds?: RoundRecord; // plan-review.md as round records (ST-LN-17)
  approachRounds?: RoundRecord; // approach-review.md as round records (ST-LN-80)
}

export type RouteKey =
  | 'scout' | 'critic' | 'planner'
  | 'executor' | 'reviewer' | 'reviewer.final' | 'verifier' | 'debugger' | 'researcher';
export type Effort = 'low' | 'medium' | 'high' | 'xhigh' | 'max';

export interface AccordConfig {
  accord: string; // '0.1.0'
  profile: 'build' | 'maintain';
  tracker: { adapter: 'none' | 'github-issues' | 'jira' | 'linear' | 'script'; repo?: string; url?: string; command?: string }; // ST-LN-97 D-12: each adapter's own key, enforced by the schema: repo (github-issues), url (jira, https only), command (script)
  design: { tokens: string }; // 'src/styles/tokens.css' or ''
  roles: ('ba' | 'dev' | 'designer')[];
  runtimes: ('claude' | 'codex' | 'cursor' | 'copilot')[];
  tests?: { report: string; affected?: string; full?: string }; // D-72: repo-relative path of the test report; commands the skills run
  build?: { parallel?: string; regenerate?: string }; // ST-LN-92 D-05: parallel, the executors that run at once, '1'..'99', absent means 3; YAML numerics stay strings. D-06: regenerate, the command the build skill runs on a conflict only in generated files; the CLI never runs it
  review?: { mode: 'human' | 'outcome' }; // spec §7: absent means 'human', the 0.1.0 behaviour
  models?: Partial<Record<RouteKey | 'architect' | 'auditor', { model: string; effort?: Effort }>>; // absent entries use the default routing; architect and auditor are still accepted and have no effect (ST-LN-80, Phase 08.6 D-05)
  escalation?: { fix_round_tier_up: string }; // '1'..'5'; YAML numerics stay strings
  stale_days?: string; // digits; YAML numerics stay strings
  stale_draft_days?: string; // digits, default '90': an unclaimed ticket untouched longer is an old draft in accord audit
  people?: Record<string, string>; // email -> 2 to 4 capital letters (IDS-1)
  legacy_ids?: string[]; // ticket ids exempt from the id convention (IDS-1)
  branch?: string; // claim branch template with exactly one {id}; absent means 't/{id}'
  setup?: string[]; // D-07: commands run in order in a new worktree
  commits?: {
    trailers?: 'allow' | 'forbid'; // ST-LN-8 D-01: absent or allow is off
    message?: { preset?: 'conventional'; pattern?: string; example?: string; command?: string }; // Phase 8.1 D-04: the rule every ticket-branch commit's first line follows: the `conventional` preset or a team regex (source, no flags) with a passing example; command is the team script that builds the message, run behind accord trust
    subjects?: Partial<Record<SubjectName, string>>; // ST-LN-50 D-06: the subject template of each commit accord writes, one `{id}`; absent means today's text
    legacy_subjects?: Partial<Record<SubjectName, string[]>>; // ST-LN-50 D-06: earlier templates accord still reads back (claim and plan_ready)
  };
  queue?: { merge?: 'owner' | 'at-once' }; // ST-LN-83 D-03: whether the pull request of a queued draft waits for the owner (the default) or is merged at once, with the merge method of git.merge
  generated?: string[]; // ST-LN-62: paths a lane S ticket may change without listing them in ## Scope; an entry ending in / matches the folder
  sensitive?: Record<string, string[]>; // ST-LN-62: area name -> paths whose change fails a lane S ticket; an entry ending in / matches the folder
  git?: { merge?: 'merge' | 'rebase' | 'squash'; sync?: string }; // ST-LN-96 D-14: how `accord worktree sync` takes main; absent means merge, and squash names the team's PR merge style (the sync is still a merge). D-03: sync is the team's script, one command line
  ids?: { mode?: 'pattern' | 'tracker'; pattern?: string; types?: Partial<Record<'story' | 'bug' | 'epic', string>>; projects?: string[] }; // ST-LN-50 D-05: absent means ST/BUG/EP-<initials>-<n> while people exists; tracker mode takes the Jira or Linear key as the id
  disposable?: string[]; // ST-LN-55 D-08, D-12: file and folder names an ignored path may hold at any depth and still be deleted with its worktree; absent means node_modules, dist, .DS_Store, Thumbs.db; accord's .accord-reports folder is disposable either way (ST-LN-59)
  template?: { sections?: { name: string; after?: string }[] }; // ST-LN-50 D-10: a team's own sections in every new story and bug ticket (scaffold/sections.ts); outside every hash
  titles?: { rule?: string; max_length?: string; language?: 'english' | 'any' }; // ST-LN-22 D-08b: the rule a ticket's title follows (tickets/title.ts), each key falling back on its own: rule is one line of guidance, max_length digits ('1'..'999', absent means 80, YAML numerics stay strings), language english (the default, refusing a letter outside A-Z) or any
  pr?: { template?: string; command?: string }; // Phase 8.1 D-01: template names one tracked pull request template (a repository-relative path) when the folder holds several; command is the team script that builds the title and body instead of the template, run behind accord trust
  slop?: { max_file_lines?: string }; // Phase 8.1 D-14: the line bound of the file-growth slop kind, a digit string of one to six digits that does not start with zero (YAML numerics stay strings); absent means 500
  audit?: { command?: string }; // Phase 8.1 D-19: the team's own audit script, run by `accord audit` behind accord trust; its first output line is a team-audit gap when it exits non-zero
  strictness?: { rounds?: Partial<Record<'approach' | 'plan' | 'review', string>>; levels?: Record<string, 'error' | 'warning' | 'off'>; stages?: Partial<Record<'M' | 'L' | 'P' | 'S' | 'R', Partial<Record<string, 'on' | 'off'>>>> }; // ST-LN-50 D-07: the round cap of each critic record, '1'..'99'; YAML numerics stay strings. D-08: levels maps a rule id to its level; only an overridable rule takes one (gate/floor.ts). D-08: stages maps a lane to the stages a team turned off (`off`); only a stage that is not on the floor, of lane M, L or P, takes effect (gate/floor.ts). All three are read through resolveStrictness
}

export interface RepoSnapshot {
  config?: AccordConfig; // undefined when accord/config.yml is missing or invalid (D-31)
  tickets: Record<string, Ticket>; // keyed by file stem
  verifications: Record<string, Verification>; // keyed by folder name
  tree: string[]; // sorted, forward slashes (D-29, D-30)
  errors: LoadFinding[]; // every loader and schema finding, in file order; lint stamps the level (D-58)
  files: Record<string, string>; // D-65: normalised text of every accord/assets/<id>/prototype.html, the config.design.tokens file, and the config.tests.report file, and every accord/research/ file some ticket lists under research:, and accord/product/security.md (ST-LN-36), accord/product/slop.md (Phase 8.1) and accord/product/conventions.md (Phase 8.5); nothing else
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
  contentSince?: Record<string, ContentSince>; // carried through from SnapshotInput
  commits?: { sha: string; message: string; merge?: boolean }[]; // ST-LN-8: host-supplied by gate done when commits.trailers is forbid; Phase 8.1 D-06: or commits.message is set, with merge true for a commit of two or more parents
  branchTemplates?: string[]; // carried through from SnapshotInput
  claimBranches?: Record<string, string>; // carried through from SnapshotInput
  claimTemplate?: string; // carried through from SnapshotInput
  planFacts?: Record<string, { subject?: string; clean: boolean }>; // carried through from SnapshotInput
  afterVerify?: Record<string, AfterVerifyCommit[]>; // carried through from SnapshotInput
  reviewFacts?: Record<string, { clean: boolean; files?: string[] }>; // carried through from SnapshotInput
  branchFacts?: Record<string, BranchFact>; // carried through from SnapshotInput
  returnFacts?: Record<string, Record<string, boolean>>; // carried through from SnapshotInput
  roundFacts?: Record<string, RoundFacts>; // carried through from SnapshotInput
  securityFacts?: Record<string, SecurityFacts>; // ST-LN-36: host-supplied by gate done after load; absent when the host supplies none (no review record with a round, no git, a ticket claimed before the security record rule's cut-off)
  // Phase 8.5 D-19: host-supplied by `accord round` only, for a ticket claimed at or after PRODUCT_TEXT_FROM and not in lane S, whose review record holds a fixed finding with a `checked:` mark; absent otherwise.
  // `accord gate done` and CI never read it: the reports are machine-local, as the task report is.
  fixReports?: Record<string, readonly FixReport[]>;
  slopFacts?: Record<string, SlopFacts>; // Phase 8.1 D-17: host-supplied by gate done after load; absent when the host supplies none (no review record with a round, no git, review skipped, a ticket claimed before the slop gate's cut-off)
  researchFacts?: Record<string, ResearchFact>; // carried through from SnapshotInput
  // BUG-LN-13 D-01: host-supplied after load: the default ref as git names it ('refs/remotes/origin/main', or
  // 'refs/heads/main' in a clone without origin) and a snapshot of the records of the view's tickets and every
  // depends_on entry as that ref holds them. Only the done readers read it; absent when no default ref resolves.
  defaultRef?: { ref: string; snapshot: RepoSnapshot };
  // ST-LN-93 D-08: host-supplied by gate plan for the gated ticket: the pin in accord/config.yml at the plan's
  // baseline: commit, and at that commit's merge base with the default ref. Absent when the host supplies none.
  planPins?: Record<string, { pin?: string; basePin?: string }>;
  // ST-LN-91 D-15: host-supplied for the ticket (gate ready, accord round --approach, accord approve, accord show --approval --short): the pin in
  // accord/config.yml at its claim commit (the newest commit whose subject is exactly `claim: <id>` that is not on the default ref, else the newest
  // one overall), and at that commit's merge base with the default ref. A ticket with no `claim: <id>` commit has no fact: the commit that added its
  // ticket file is no evidence of when work began. Absent when the host supplies none (no such commit, no git); read only through claimPinBefore.
  claimPins?: Record<string, ClaimPin>;
  // ST-LN-91 D-11: host-supplied by accord round for the ticket it counts: the pin at the first round of its plan-review.md or
  // approach-review.md, else HEAD's, and at that commit's merge base with the default ref. A record with no entry keeps the older grounds rule.
  recordPins?: Record<string, { plan?: RecordPin; approach?: RecordPin }>;
  // ST-LN-91 D-14: host-supplied by accord round --plan: the last commit that changed plan-review.md, the -U0 hunks of plan.md from it to the
  // working tree, and both texts. A ticket with no entry (no such commit, or a pin below the cut-off) is not checked.
  planFix?: Record<string, PlanFix>;
  // ST-LN-16 D-19: host-supplied by the dashboard: ticket id -> the `backlog/*` branch that queued it, for each ticket of `tickets` that no checkout or default branch holds and that was read from that branch's tip. Such a row has no claim.
  queued?: Record<string, { branch: string }>;
}

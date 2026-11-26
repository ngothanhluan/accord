// GATE-02/GATE-03/GATE-08/GATE-11 Done reasons (D-76, D-80, D-81, D-87, docs/design.md §5). Levels live in rules.ts
// (D-57); a check returns a draft and never a level. Done reads `verification.blocks`, which the loader
// has already de-duplicated by tag and validated `Result:` on (D-40, D-42), and never re-scans Markdown.
// Every path is built from the repo-relative ticket id, so no absolute path and no backslash can reach
// a reason (D-51).
import { normaliseText } from '../load/frontmatter.js';
import { headingKey } from '../load/sections.js';
import { normaliseKey } from '../load/snapshot.js';
import { UNFINISHED_MARKER } from '../load/unfinished.js';
import type { AfterVerifyCommit, RepoSnapshot, ScenarioRef, Ticket, TicketFrontmatter, Verification } from '../model/snapshot.js';
import { acHash } from './hash.js';
import type { GateRule } from './rules.js';
import { forbiddenLines, trailerReason } from './trailers.js';
import { commitRuleNotInForce, commitRuleOf, commitRuleProblem, commitRuleRefusal } from '../commits/rule.js';
import { claimPinBefore, COMMIT_MESSAGE_FROM } from '../round/pin.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';
const verificationFile = (id: string) => 'accord/tickets/' + id + '/verification.md';
// `Object.hasOwn`, never `in`: an id is caller-supplied and `in` would answer true for `toString`.
const ticketOf = (snapshot: RepoSnapshot, id: string): Ticket | undefined =>
  Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
export const verificationOf = (snapshot: RepoSnapshot, id: string): Verification | undefined =>
  Object.hasOwn(snapshot.verifications, id) ? snapshot.verifications[id] : undefined;
/** The `## Acceptance criteria` heading line, or undefined when the ticket has no such section. */
const acLine = (snapshot: RepoSnapshot, id: string): number | undefined =>
  ticketOf(snapshot, id)?.sections.find((s) => headingKey(s.heading) === 'acceptance criteria')?.line;
const at = (line: number | undefined) => (line === undefined ? {} : { line });

/** Distinct `ac-n` tags sorted by their numeric part, so a reason reads the same on every host. */
const tagsOf = (tags: readonly string[]): string[] =>
  [...new Set(tags)].sort((a, b) => Number(a.slice(3)) - Number(b.slice(3)));
/** `nothing` for an empty list, otherwise the `@ac-n` tokens in numeric order. */
const fmt = (tags: readonly string[]): string => (tags.length === 0 ? 'nothing' : tags.map((t) => '@' + t).join(' '));

/**
 * Phase 15 D-31: the `ac-n` tags of the slice `gate done --slice n` judges, set by gateDone for a slice below the last one; undefined means the whole ticket. Every Done rule that reads scenarios,
 * evidence blocks or `verified:` entries goes through `inSlice`; the hash, review, suite, scope, security and record rules never do.
 */
export const sliceTags = (snapshot: RepoSnapshot, id: string): readonly string[] | undefined =>
  snapshot.doneSlice !== undefined && Object.hasOwn(snapshot.doneSlice, id) ? snapshot.doneSlice[id] : undefined;
/** True when this run judges the whole ticket or the slice holds `tag`; a scenario with no `ac-n` tag belongs to no slice, so it is always judged. */
export const inSlice = (snapshot: RepoSnapshot, id: string, tag: string | undefined): boolean => {
  const slice = sliceTags(snapshot, id);
  return slice === undefined || tag === undefined || slice.includes(tag);
};

const allScenarioTags = (snapshot: RepoSnapshot, id: string): string[] =>
  tagsOf((ticketOf(snapshot, id)?.scenarios ?? []).flatMap((s) => (s.acTag === undefined ? [] : [s.acTag])));
const scenarioTags = (snapshot: RepoSnapshot, id: string): string[] => allScenarioTags(snapshot, id).filter((t) => inSlice(snapshot, id, t));
const evidenceTags = (snapshot: RepoSnapshot, id: string): string[] =>
  tagsOf((verificationOf(snapshot, id)?.blocks ?? []).map((b) => b.acTag).filter((t) => inSlice(snapshot, id, t)));
const tickTags = (snapshot: RepoSnapshot, id: string): string[] =>
  tagsOf((ticketOf(snapshot, id)?.frontmatter?.verified ?? []).filter((t) => inSlice(snapshot, id, t)));

/** D-81: at least 7 characters and every one of them hexadecimal. Shorter values never compare equal. */
export function isSha(v: string): boolean {
  return v.length >= 7 && /^[0-9a-fA-F]+$/.test(v);
}

/**
 * D-81: equal when, compared case-insensitively, the shorter is a prefix of the longer and both are
 * shas. git abbreviates to variable lengths, so a 7-character value must match a 40-character one.
 */
export function shaEqual(a: string, b: string): boolean {
  if (!isSha(a) || !isSha(b)) return false;
  const x = a.toLowerCase();
  const y = b.toLowerCase();
  return x.length <= y.length ? y.startsWith(x) : x.startsWith(y);
}

/**
 * GATE-02 empty set: three empty sets are trivially equal, which would let a ticket with no scenario
 * pass Done vacuously. This fires on every ticket type, so an `epic` cannot slip through either.
 */
export const noScenarios: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined || allScenarioTags(snapshot, id).length > 0) return [];
  return [
    {
      file: ticketFile(id),
      ...at(acLine(snapshot, id)),
      reason: 'no scenario carries an @ac-n tag, so Done has nothing to be claimed about',
    },
  ];
};

/**
 * GATE-02: the scenario tags, the `## @ac-n` evidence blocks, and `verified` must be the same set.
 * One finding naming each side's gap, mirroring lint.plan-tags-differ, in the fixed order scenarios,
 * evidence, verified. `noScenarios` owns the all-empty case.
 */
export const tagsDiffer: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined) return [];
  const scenarios = scenarioTags(snapshot, id);
  const evidence = evidenceTags(snapshot, id);
  const verified = tickTags(snapshot, id);
  const union = tagsOf([...scenarios, ...evidence, ...verified]);
  // Each set is a subset of the union, so equal size is equal membership.
  if (union.length === 0 || [scenarios, evidence, verified].every((s) => s.length === union.length)) return [];
  const lacks = (set: string[]) => fmt(union.filter((t) => !set.includes(t)));
  return [
    {
      file: ticketFile(id),
      ...at(acLine(snapshot, id)),
      reason: `scenarios lack ${lacks(scenarios)}; evidence lacks ${lacks(evidence)}; verified lacks ${lacks(verified)}`,
    },
  ];
};

/** docs/design.md §5: the Fresh-context layer needs a review record; there is no Done without one. */
export const verificationMissing: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined || verificationOf(snapshot, id) !== undefined) return [];
  return [{ file: verificationFile(id), reason: 'no review record; Done needs ' + verificationFile(id) }];
};

/**
 * The ticket when it carries `lane:` other than S and R: the lanes whose gate tables hold the plan, Done and debug rules of lane M, so the ones the unfinished-marker rules apply to (unfinishedPlan, unfinishedVerification
 * and unfinishedDebug; ST-LN-72 review round 2). The one lane test of the three. It lives here, and work.ts re-exports it next to laneTicket, because work.ts imports this file.
 */
export const stageLaneTicket = (snapshot: RepoSnapshot, id: string): Ticket | undefined => {
  const t = ticketOf(snapshot, id);
  const lane = t?.frontmatter?.lane;
  return lane === undefined || lane === 'S' || lane === 'R' ? undefined : t;
};

/**
 * The verification.md of a lane ticket that runs the Done table of lane M (stageLaneTicket) and still carries UNFINISHED_MARKER; undefined otherwise. The one predicate for gate done's refusal and for the
 * Unfinished line of `accord anchor` (status/anchor.ts).
 */
export const unfinishedVerification = (snapshot: RepoSnapshot, id: string): Verification | undefined => {
  const v = verificationOf(snapshot, id);
  return v?.unfinished === undefined || stageLaneTicket(snapshot, id) === undefined ? undefined : v;
};

/**
 * ST-LN-72 D-11 and D-18: a verification.md that still carries UNFINISHED_MARKER is a record the verifier has not finished, so it never passes Done, at any strictness setting (the rule is on the
 * floor, gate/floor.ts). A lane M, L or P ticket, whatever its claim pin: the owner's decision of 2026-11-16, an exception to D-16 (only a 0.6.0 agent writes the marker, so a ticket claimed earlier cannot be
 * refused wrongly, and exempting it would let a stalled agent's half-written record through after an upgrade).
 * It reads no `config.runtimes`: the rule is a CLI check, so it holds in all four tools whether or not an accord agent is installed.
 */
export const verificationUnfinished: GateRule['check'] = (snapshot, id) => {
  const v = unfinishedVerification(snapshot, id);
  if (v?.unfinished === undefined) return [];
  return [{ file: v.file, line: v.unfinished, reason: `${v.file} still carries the line ${UNFINISHED_MARKER}: the verifier has not finished; the verify stage resumes it, or starts it over when HEAD moved` }];
};

/** docs/design.md §5: `blocked` fails Done exactly as `fail` does. A missing or invalid `Result:` is
 * already load.result-invalid at error in ticket scope, so it needs no rule here (D-58). */
export const resultNotPass: GateRule['check'] = (snapshot, id) => {
  const v = verificationOf(snapshot, id);
  if (v === undefined) return [];
  return v.blocks
    .filter((b) => inSlice(snapshot, id, b.acTag))
    .filter((b) => b.result === 'fail' || b.result === 'blocked')
    .map((b) => ({ file: v.file, line: b.line, reason: `evidence block "@${b.acTag}" records Result: ${b.result}` }));
};

// --- The identity layer: is this tick bound to the acceptance criteria and the commit in front of us? ---

const frontmatterOf = (snapshot: RepoSnapshot, id: string): TicketFrontmatter | undefined =>
  ticketOf(snapshot, id)?.frontmatter;
/** The AC hash as it stands now; undefined only when no scenario carries an `@ac-n` tag (`noScenarios`). */
const computed = (snapshot: RepoSnapshot, id: string): string | undefined =>
  acHash(ticketOf(snapshot, id)?.scenarios ?? []);

/**
 * D-81 and the D-80 no-bypass reasoning: a host that supplies no commit cannot have Done reported as
 * skipped, or deleting one field from the input would remove every commit check at once.
 */
export const commitMissing: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined || snapshot.git?.commit !== undefined) return [];
  return [{ file: ticketFile(id), reason: 'the host supplied no commit for the gated tree; Done cannot bind a tick' }];
};

/**
 * D-81: anything shorter than 7 hex characters is not a sha and never compares equal. One draft per
 * source, so one bad character produces one reason rather than a mismatch finding on top of it.
 */
export const shaTooShort: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined) return [];
  const host = snapshot.git?.commit;
  const tick = frontmatterOf(snapshot, id)?.verified_commit;
  const review = verificationOf(snapshot, id)?.frontmatter?.commit;
  const bad = (v: string) => `"${v}" is not a commit sha; at least 7 hexadecimal characters are needed`;
  return [
    ...(host !== undefined && !isSha(host) ? [{ file: ticketFile(id), reason: 'host commit ' + bad(host) }] : []),
    ...(tick !== undefined && !isSha(tick)
      ? [{ file: ticketFile(id), pointer: '/verified_commit', reason: 'verified_commit ' + bad(tick) }]
      : []),
    ...(review !== undefined && !isSha(review)
      ? [{ file: verificationFile(id), pointer: '/commit', reason: 'the review commit ' + bad(review) }]
      : []),
  ];
};

/** GATE-03: Done cannot tell whether the criteria moved if Ready never recorded where they were. */
export const acHashMissing: GateRule['check'] = (snapshot, id) => {
  const fm = frontmatterOf(snapshot, id);
  if (fm === undefined || fm.ac_hash !== undefined || computed(snapshot, id) === undefined) return [];
  return [{ file: ticketFile(id), pointer: '/ac_hash', reason: 'Ready has recorded no ac_hash for this ticket' }];
};

/**
 * GATE-03: exact string comparison, prefix included, so a change of hash algorithm fails loudly instead
 * of comparing a new digest against an old one and reading as a change of criteria (D-75).
 */
export const acChanged: GateRule['check'] = (snapshot, id) => {
  const recorded = frontmatterOf(snapshot, id)?.ac_hash;
  const now = computed(snapshot, id);
  if (recorded === undefined || now === undefined || recorded === now) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ac_hash',
      reason: `the acceptance criteria changed since Ready: ac_hash records ${recorded}, they hash to ${now} now`,
    },
  ];
};

/** D-76: a tick with no binding is a claim about nothing; there is no compatibility path in v0.1. */
export const tickUnbound: GateRule['check'] = (snapshot, id) => {
  const fm = frontmatterOf(snapshot, id);
  if (fm === undefined || (fm.verified ?? []).length === 0) return [];
  const missing = [
    ...(fm.verified_hash === undefined ? ['verified_hash'] : []),
    ...(fm.verified_commit === undefined ? ['verified_commit'] : []),
  ];
  if (missing.length === 0) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/verified',
      reason: `verified is set but ${missing.join(' and ')} ${missing.length > 1 ? 'are' : 'is'} not recorded`,
    },
  ];
};

/** GATE-11: the ticks were made against criteria that have since moved. */
export const tickStaleHash: GateRule['check'] = (snapshot, id) => {
  const recorded = frontmatterOf(snapshot, id)?.verified_hash;
  const now = computed(snapshot, id);
  if (recorded === undefined || now === undefined || recorded === now) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/verified_hash',
      reason: `the ticks were made against ${recorded}; the acceptance criteria hash to ${now} now`,
    },
  ];
};

/** Every path is the ticket's own file, lies in its folder (spec §11), or is accord/product/conventions.md (ST-LN-8 D-08). */
export const ownRecordsOnly = (id: string, paths: readonly string[]): boolean =>
  paths.every((p) => p === ticketFile(id) || p === 'accord/product/conventions.md' || p.startsWith('accord/tickets/' + id + '/'));

/** A commit that changes a path outside the ticket's own records, or a merge whose own changes git could not show. */
export const handMade = (id: string, c: AfterVerifyCommit): boolean => c.files === undefined || !ownRecordsOnly(id, c.files);

/** A later commit that changed only this ticket's own records (its file and folder) or accord/product/conventions.md is the same reviewed code. */
const onlyOwnRecords = (snapshot: RepoSnapshot, id: string, recorded: string): boolean => {
  const since = snapshot.recordsSince;
  if (since === undefined || !Object.hasOwn(since, recorded)) return false;
  return ownRecordsOnly(id, since[recorded]);
};

/**
 * ST-LN-96 D-04: the recorded commit is not in the gated commit's history, so the host compared the contents of the ticket's files.
 * `{ pass }`: none differs; `{ reason }`: the refusal's wording; undefined: the host supplied no fact for it, and today's reason stands.
 */
const contentVerdict = (
  snapshot: RepoSnapshot,
  recorded: string,
  host: string,
  what: 'ticks' | 'review',
  today: string,
): { pass: true } | { reason: string } | undefined => {
  const facts = snapshot.contentSince;
  const key = recorded.toLowerCase();
  if (facts === undefined || !Object.hasOwn(facts, key)) return undefined;
  const fact = facts[key];
  if ('absent' in fact) return { reason: `${today}; the verified commit is not in this clone, so its contents cannot be compared - verify again` };
  if (fact.changed.length === 0) return { pass: true };
  const made = what === 'ticks' ? 'the ticks were made' : 'the review was written';
  return { reason: `${made} against commit ${recorded}, which is not in the history of the gated commit ${host}; these ticket files changed since: ${fact.changed.join(', ')}` };
};

/** GATE-11: the ticks were made against a different commit. Both values are guarded on `isSha` first,
 * so a too-short value produces `gate.sha-too-short` alone and never two reasons for one typo (D-81). */
export const tickStaleCommit: GateRule['check'] = (snapshot, id) => {
  const tick = frontmatterOf(snapshot, id)?.verified_commit;
  const host = snapshot.git?.commit;
  if (tick === undefined || host === undefined || !isSha(tick) || !isSha(host) || shaEqual(tick, host)) return [];
  if (onlyOwnRecords(snapshot, id, tick)) return [];
  const today = `the ticks were made against commit ${tick}; the gated commit is ${host}`;
  const content = contentVerdict(snapshot, tick, host, 'ticks', today);
  if (content !== undefined && 'pass' in content) return [];
  return [{ file: ticketFile(id), pointer: '/verified_commit', reason: content === undefined ? today : content.reason }];
};

/** Phase 15 D-23: the host read the ticket as done at the merge base with the default branch. Without its fact (no default ref, a git failure) it is false, and today's Done rules stand. */
export const doneAtBase = (snapshot: RepoSnapshot, id: string): boolean =>
  snapshot.baseRecords !== undefined && Object.hasOwn(snapshot.baseRecords, id) && snapshot.baseRecords[id].done;

/**
 * Phase 15 D-23, D-24, D-25: a ticket done at the merge base is not edited. Every path of its file and folder is compared between the base and HEAD, a deletion and an addition
 * included, after the loader's line-ending normalisation; one finding names every changed path. It takes no `claimPinBefore` cut-off: it adds a refusal only for a pull request that
 * changes a done ticket, which no earlier release let through quietly. With it in force `gateDone` runs no other Done rule for the ticket, so no evidence is resolved at HEAD (D-24).
 */
export const doneTicketEdited: GateRule['check'] = (snapshot, id) => {
  if (!doneAtBase(snapshot, id)) return [];
  const fact = (snapshot.baseRecords as NonNullable<RepoSnapshot['baseRecords']>)[id];
  const paths = [...new Set([...Object.keys(fact.records), ...Object.keys(fact.head)])].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const changed = paths.filter((p) => {
    const before = Object.hasOwn(fact.records, p) ? normaliseText(fact.records[p]) : undefined;
    const after = Object.hasOwn(fact.head, p) ? normaliseText(fact.head[p]) : undefined;
    return before !== after;
  });
  if (changed.length === 0) return [];
  return [{ file: ticketFile(id), reason: `${id} is done on the base branch (${fact.base.slice(0, 7)}); a done ticket is not edited - revert the change to ${changed.join(', ')}` }];
};

/** ROADMAP criterion 2 and docs/design.md §5: the review must be of the code being gated. */
export const staleReview: GateRule['check'] = (snapshot, id) => {
  const review = verificationOf(snapshot, id)?.frontmatter?.commit;
  const host = snapshot.git?.commit;
  if (review === undefined || host === undefined || !isSha(review) || !isSha(host) || shaEqual(review, host)) return [];
  if (onlyOwnRecords(snapshot, id, review)) return [];
  const today = `the review was written against commit ${review}; the gated commit is ${host}`;
  const content = contentVerdict(snapshot, review, host, 'review', today);
  if (content !== undefined && 'pass' in content) return [];
  return [{ file: verificationFile(id), pointer: '/commit', reason: content === undefined ? today : content.reason }];
};

// --- The Machine layer: does the report say the test that proves this scenario passed? (GATE-08, D-80) ---

const CONFIG = 'accord/config.yml';

/** ST-LN-8 D-02: under commits.trailers forbid, every commit the host loaded for this branch is read for forbidden lines; undefined commits fail closed. */
export const commitTrailer: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined || snapshot.config?.commits?.trailers !== 'forbid') return [];
  const at = { file: CONFIG, pointer: '/commits/trailers' };
  if (snapshot.commits === undefined) {
    return [{ ...at, reason: 'commits.trailers is forbid, but the host loaded no commits of this branch, so they cannot be checked' }];
  }
  return snapshot.commits.flatMap((c) => forbiddenLines(c.message).map((l) => ({ ...at, reason: trailerReason(c.sha, l) })));
};
/**
 * Phase 8.1 D-06, D-07: under `commits.message` every commit the host loaded for this branch (the first-parent commits not on the default ref) is judged by the one core function
 * `commitRuleProblem`, a merge commit and a `Revert "` subject excepted. Read through claimPinBefore: a ticket claimed before COMMIT_MESSAGE_FROM is not judged. A pattern that is not in
 * force, and commits the host did not load, fail closed; every reason names its fix.
 */
export const commitMessage: GateRule['check'] = (snapshot, id) => {
  if (ticketOf(snapshot, id) === undefined || snapshot.config?.commits?.message === undefined || claimPinBefore(snapshot, id, COMMIT_MESSAGE_FROM)) return [];
  const at = { file: CONFIG, pointer: '/commits/message' };
  const rule = commitRuleOf(snapshot.config);
  if (rule === undefined) return [];
  if ('problem' in rule) return [{ ...at, reason: commitRuleNotInForce(rule.problem) }];
  if (snapshot.commits === undefined) {
    return [{ ...at, reason: "commits.message is set, but the host loaded no commits of this branch, so they cannot be checked - fix: run accord gate done in the ticket's checkout, where git reads the branch" }];
  }
  return snapshot.commits.flatMap((c) => {
    const problem = c.merge === true ? undefined : commitRuleProblem(rule, c.message);
    return problem === undefined ? [] : [{ ...at, reason: commitRuleRefusal(c.sha, problem) }];
  });
};
const isTest = (tag: string) => tag.startsWith('@test:');
/** Every scenario the machine layer applies to: `@ui` leans on the human layer instead (D-90, GATE-09). */
const machineScenarios = (snapshot: RepoSnapshot, id: string): ScenarioRef[] =>
  (ticketOf(snapshot, id)?.scenarios ?? []).filter((s) => !s.tags.includes('@ui') && inSlice(snapshot, id, s.acTag));
/** The configured report path, or undefined when `config.yml` declares no `tests.report`. */
export const reportPath = (snapshot: RepoSnapshot): string | undefined => snapshot.config?.tests?.report;
/** True only when a report was declared *and* its file reached the snapshot; the join runs on nothing else. */
export const reportLoaded = (snapshot: RepoSnapshot): boolean => {
  const report = reportPath(snapshot);
  return report !== undefined && Object.hasOwn(snapshot.files, normaliseKey(report));
};

/**
 * GATE-08: a scenario is either machine-checked or `@ui`. This is a property of the ticket, not of the
 * report, so it fires whether or not a report is configured — the two configuration reasons below
 * suppress the per-scenario join, never this.
 */
export const testTagMissing: GateRule['check'] = (snapshot, id) =>
  machineScenarios(snapshot, id)
    .filter((s) => !s.tags.some(isTest))
    .map((s) => ({
      file: ticketFile(id),
      line: s.line,
      reason: `scenario "${s.name}" carries no @test:<id> tag and is not @ui, so Done cannot check it against the report`,
    }));

/**
 * D-80: no `tests.report` at all fails Done. It is not reported skipped — GATE-06 forbids a bypass, and
 * deleting one line from `config.yml` would otherwise remove the whole Machine layer at once.
 */
export const testsUnconfigured: GateRule['check'] = (snapshot, id) => {
  if (reportPath(snapshot) !== undefined || machineScenarios(snapshot, id).length === 0) return [];
  return [
    {
      file: CONFIG,
      pointer: '/tests',
      reason: 'no test report is declared, so the machine layer cannot run and Done cannot pass; set tests.report',
    },
  ];
};

/** D-80 extended: declaring the key and deleting the file is the same hole, so it closes the same way. */
export const reportMissing: GateRule['check'] = (snapshot, id) => {
  const report = reportPath(snapshot);
  if (report === undefined || reportLoaded(snapshot) || machineScenarios(snapshot, id).length === 0) return [];
  return [{ file: CONFIG, pointer: '/tests/report', reason: `tests.report "${report}" is not in the snapshot` }];
};

/** The `@test:` ids of the machine-checked scenarios, paired with the line to report them on. */
const testIds = (snapshot: RepoSnapshot, id: string): { line: number; testId: string }[] =>
  machineScenarios(snapshot, id).flatMap((s) =>
    s.tags.filter(isTest).map((tag) => ({ line: s.line, testId: tag.slice(6) })),
  );

/**
 * GATE-08: exact code-point lookup with `Object.hasOwn` — no case folding, no basename fallback, no
 * prototype chain (T-04-21). Silent when the report is undeclared or absent, so one configuration
 * problem yields one reason rather than one per scenario, as `tokensMissing` does under D-67.
 */
export const testUnknown: GateRule['check'] = (snapshot, id) => {
  if (!reportLoaded(snapshot)) return [];
  const report = reportPath(snapshot);
  return testIds(snapshot, id)
    .filter(({ testId }) => !Object.hasOwn(snapshot.tests ?? {}, testId))
    .map(({ line, testId }) => ({
      file: ticketFile(id),
      line,
      reason: `@test:${testId} not found in ${report}; ids are classname#name with spaces as '-'`,
    }));
};

/**
 * GATE-08 and docs/design.md §5: only `passed` passes. A muted test fails Done exactly as a failing one
 * does — naming the status verbatim keeps the two distinguishable without softening either.
 */
export const testNotPassed: GateRule['check'] = (snapshot, id) => {
  if (!reportLoaded(snapshot)) return [];
  const tests = snapshot.tests ?? {};
  const report = reportPath(snapshot);
  return testIds(snapshot, id)
    .filter(({ testId }) => Object.hasOwn(tests, testId) && tests[testId] !== 'passed')
    .map(({ line, testId }) => ({
      file: ticketFile(id),
      line,
      reason: `@test:${testId} is recorded ${tests[testId]} in ${report}; Done passes on passed alone`,
    }));
};

// --- GATE-05: was the review written by the same person as the commit it reviews? (D-79) ---

/** D-78: the gated commit's author rides under a key equal to `git.commit`; file authors under their
 * repo-relative posix path. A sha can never collide with a path, so one flat record serves both. */
const authorsOf = (snapshot: RepoSnapshot, id: string): { commitAuthor?: string; fileAuthor?: string } => {
  const git = snapshot.git;
  if (git === undefined) return {};
  const own = (key: string) => (Object.hasOwn(git.authors, key) ? git.authors[key] : undefined);
  return { commitAuthor: own(git.commit), fileAuthor: own(verificationFile(id)) };
};

/**
 * GATE-05 (D-79), warning and never more: docs/design.md §4 makes the reviewer not a role, so in the
 * workflow accord itself prescribes the two identities match on nearly every honest ticket. An error
 * here would block every solo developer, which is why D-79 fixed the level at warning.
 */
export const authorMatch: GateRule['check'] = (snapshot, id) => {
  if (verificationOf(snapshot, id) === undefined) return [];
  const { commitAuthor, fileAuthor } = authorsOf(snapshot, id);
  if (commitAuthor === undefined || fileAuthor === undefined) return [];
  if (commitAuthor.toLowerCase() !== fileAuthor.toLowerCase()) return [];
  return [
    {
      file: verificationFile(id),
      reason: `the review and the gated commit share an author (${fileAuthor}), so no second pair of eyes touched this ticket`,
    },
  ];
};

/** D-80's skipped-as-a-Finding rule: the comparison the host could not supply is reported rather than
 * silently dropped. Suppressed when the review file is missing, because `gate.verification-missing`
 * already owns that case and one absent review should read as one reason. */
export const authorSkipped: GateRule['check'] = (snapshot, id) => {
  if (verificationOf(snapshot, id) === undefined) return [];
  const { commitAuthor, fileAuthor } = authorsOf(snapshot, id);
  const which = [
    ...(commitAuthor === undefined ? ['the gated commit'] : []),
    ...(fileAuthor === undefined ? ['the review file'] : []),
  ];
  if (which.length === 0) return [];
  return [
    {
      file: verificationFile(id),
      reason: `the host supplied no author for ${which.join(' and ')}, so the review and the commit could not be compared`,
    },
  ];
};

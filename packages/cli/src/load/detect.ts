// ST-LN-50 D-11 (TEAM-02): what `accord init` can tell about a repository's conventions from the repository itself.
// Host loader, read-only, bounded, never writes: it returns proposals, and a proposal is only text. The one place
// a value reaches `accord/config.yml` is `accord config set`, which the onboarding skill runs after asking
// the user, so nothing detected here is ever trusted as a value.
//
// Bounded (T-03.1-45, T-03.1-62): at most 200 commits are read per log, in one git process each with a 64 MiB buffer,
// and every git call that logs passes `-c log.showSignature=false --no-show-signature` so its output never depends on
// the user's git config (conventions.md). At most 500 refs are listed. Files are listed with `git ls-files -z` and literal
// pathspecs, at most 200 of them, and each is read up to 1 MiB; a link, a directory or any non-file is skipped. Nothing
// here reaches the network. A git failure of any kind gives no proposal for that key, never a throw: init must still
// finish its own work on a repository whose history cannot be read.
//
// Evidence floor (Ruling, plans 03.1-33 and 03.1-34): a shape is proposed only when at least `MIN_COMMITS` commits (or
// `MIN_BRANCHES` branches) were read and one shape holds at least `MIN_SHARE_PERCENT` percent of them. A weak guess is a
// question the user would answer for nothing; the key stays unproposed and the team sets it later through `accord config`.
// A commitlint config file and a tracker link are not shapes held by a share of something: each is the repository saying so.
//
// Every proposal's value is checked as `accord config set` would check that value (schema, floor, subject collisions) against the repository's
// own config.yml before it is returned, and one that fails is dropped. What init prints is that value as JSON (`"squash"`), which is not
// itself the argument `config set` takes: `config set` stores its argument as typed, so the onboarding skill passes the bare value
// (`accord config set git.merge 'squash'`).
//
// Evidence lines carry counts, fixed names and file names (T-03.1-46); no commit subject or body text is ever repeated.
import { execFileSync } from 'node:child_process';
import { closeSync, lstatSync, openSync, readSync } from 'node:fs';
import { join } from 'node:path';
import { floorProblems, loadConfig, resolveKeyPath, setConfigValue, SUBJECT_NAMES, subjectCollisions } from '@accord-dev/accord-core';
import type { SubjectName } from '@accord-dev/accord-core';
import { defaultRefOf } from './fs.js';

/** One detected value: a dotted config key, its JSON value, and the evidence for it in numbers. */
export interface Proposal {
  key: string;
  value: unknown;
  evidence: string;
}

const MAX_COMMITS = 200;
const MAX_REFS = 500;
const MAX_FILES = 200;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_PROJECTS = 10;
const MIN_COMMITS = 10;
const MIN_BRANCHES = 5;
const MIN_SHARE_PERCENT = 60;

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
};

const holds = (n: number, of: number): boolean => n * 100 >= of * MIN_SHARE_PERCENT;

/** What a repository's own text can put on a terminal: printable ASCII only, so a tracked file name never carries a control sequence. */
const printable = (text: string): string => text.replace(/[^\x20-\x7e]/g, '?');

/** Every proposal this repository supports, in the order the output contract lists the keys: git.merge, commits.subjects, branch, ids, tracker. */
export function detectProposals(root: string): Proposal[] {
  const ref = defaultRefOf(root) ?? 'HEAD';
  const on = shortName(ref);
  const firstParent = readLog(root, ref, ['--first-parent']);
  const own = readLog(root, ref, ['--no-merges']) ?? [];
  const branches = branchNames(root, on);
  const found = [
    firstParent === undefined ? undefined : mergeStyle(firstParent, on),
    subjectsStyle(own, commitlintFile(root)),
    branchShape(branches, on),
    trackerKeys(own, branches),
    trackerLinks(root, own),
  ].filter((p): p is Proposal => p !== undefined);
  return found.filter(accepted(root));
}

/** `refs/heads/main` and `refs/remotes/origin/main` both read as `main` in the evidence. */
const shortName = (ref: string): string => ref.replace(/^refs\/(?:heads|remotes\/origin)\//, '');

function git(root: string, args: string[]): string | undefined {
  try {
    return execFileSync('git', args, { cwd: root, ...GIT });
  } catch {
    return undefined;
  }
}

interface Commit {
  /** how many parents the commit has */
  parents: number;
  subject: string;
  body: string;
}

/** The newest `MAX_COMMITS` commits of `ref` under `extra` (`--first-parent`, `--no-merges`), NUL-separated: parents, subject, body per commit. */
function readLog(root: string, ref: string, extra: string[]): Commit[] | undefined {
  const raw = git(root, ['-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', ...extra, '-n', String(MAX_COMMITS), '--format=%P%x00%s%x00%b', ref]);
  if (raw === undefined) return undefined;
  const tokens = raw.split('\0');
  const commits: Commit[] = [];
  for (let i = 0; i + 2 < tokens.length; i += 3) {
    commits.push({ parents: tokens[i].split(' ').filter((p) => p !== '').length, subject: tokens[i + 1], body: tokens[i + 2] });
  }
  return commits;
}

/**
 * `git.merge` from the first-parent history of `ref`: a history where most commits are merge commits proposes `merge`, and
 * one where most single-parent commits end in ` (#<n>)` (what a squash merge on a host leaves) proposes `squash`. `rebase` is
 * never proposed: a rebased pull request leaves single-parent commits with no mark, which a team that pushes to main directly
 * leaves too, so no count could tell the two apart.
 */
function mergeStyle(commits: Commit[], on: string): Proposal | undefined {
  const total = commits.length;
  if (total < MIN_COMMITS) return undefined;
  const merges = commits.filter((c) => c.parents > 1).length;
  const suffixed = commits.filter((c) => c.parents <= 1 && / \(#[0-9]+\)$/.test(c.subject)).length;
  if (holds(suffixed, total)) return { key: 'git.merge', value: 'squash', evidence: `${suffixed} of ${total} recent commits on ${on} end in (#n)` };
  if (holds(merges, total)) return { key: 'git.merge', value: 'merge', evidence: `${merges} of ${total} recent commits on ${on} are merge commits` };
  return undefined;
}

/** Tracked files under the literal `paths`, at most `MAX_FILES`, NUL-separated. */
function trackedFiles(root: string, paths: string[]): string[] {
  const raw = git(root, ['ls-files', '-z', '--', ...paths.map((p) => `:(literal)${p}`)]);
  return raw === undefined ? [] : raw.split('\0').filter((p) => p !== '').slice(0, MAX_FILES);
}

/** The first `MAX_FILE_BYTES` of a regular file, or undefined for anything else (a link, a folder, a missing or unreadable file). */
function readBounded(root: string, rel: string): string | undefined {
  const abs = join(root, ...rel.split('/'));
  try {
    const stat = lstatSync(abs);
    if (!stat.isFile()) return undefined;
    const fd = openSync(abs, 'r');
    try {
      const buffer = Buffer.alloc(Math.min(stat.size, MAX_FILE_BYTES));
      const read = readSync(fd, buffer, 0, buffer.length, 0);
      return buffer.toString('utf8', 0, read);
    } finally {
      closeSync(fd);
    }
  } catch {
    return undefined;
  }
}

const COMMITLINT_FILES = [
  ...['js', 'cjs', 'mjs', 'ts', 'cts', 'mts', 'json'].map((x) => `commitlint.config.${x}`),
  '.commitlintrc',
  ...['json', 'yaml', 'yml', 'js', 'cjs', 'mjs', 'ts', 'cts', 'mts'].map((x) => `.commitlintrc.${x}`),
];

interface Commitlint {
  /** what the evidence says is there: `commitlint.config.cjs is present`, `package.json has a commitlint key` */
  presence: string;
  /** the config names a `scope-enum` that never mentions accord */
  scopeWithoutAccord: boolean;
}

/**
 * A commitlint config at the repository root: one of the file names commitlint reads, or a `commitlint` key in package.json. The
 * config is read as text, never run: a `scope-enum` that does not mention accord is noticed, nothing more is concluded.
 */
function commitlintFile(root: string): Commitlint | undefined {
  const tracked = new Set(trackedFiles(root, [...COMMITLINT_FILES, 'package.json']));
  const name = COMMITLINT_FILES.find((f) => tracked.has(f));
  const scopeWithoutAccord = (text: string): boolean => text.includes('scope-enum') && !/accord/i.test(text);
  if (name !== undefined) {
    const text = readBounded(root, name);
    return { presence: `${name} is present`, scopeWithoutAccord: text !== undefined && scopeWithoutAccord(text) };
  }
  if (!tracked.has('package.json')) return undefined;
  const text = readBounded(root, 'package.json');
  if (text === undefined) return undefined;
  try {
    const parsed = JSON.parse(text) as unknown;
    if (typeof parsed !== 'object' || parsed === null || !Object.hasOwn(parsed, 'commitlint')) return undefined;
    return { presence: 'package.json has a commitlint key', scopeWithoutAccord: scopeWithoutAccord(JSON.stringify((parsed as Record<string, unknown>).commitlint)) };
  } catch {
    return undefined;
  }
}

const CONVENTIONAL = /^(feat|fix|chore|docs|refactor|test|build|ci|perf|style|revert)(\([^)]+\))?!?: /;

/** Ruling (plan 03.1-34): the subjects accord writes when a repository follows conventional commits, every kind in `SUBJECT_NAMES`, each text distinct. */
const CONVENTIONAL_SUBJECTS: Readonly<Record<SubjectName, string>> = {
  claim: 'chore(accord): claim {id}',
  plan_ready: 'chore(accord): plan {id} ready',
  plan_round: 'chore(accord): plan {id}',
  approach_round: 'chore(accord): approach {id}',
  intent: 'docs(accord): intent {id}',
  ticket_understood: 'docs(accord): understood {id}',
  ticket_question: 'docs(accord): question {id}',
  scout: 'docs(accord): scout {id}',
  drop: 'chore(accord): drop {id}',
  rebind: 'chore(accord): rebind {id}',
  ruleset_backfill: 'chore(accord): ruleset {id}',
  queue: 'chore(accord): queue {id}',
  people: 'chore(accord): people {id}',
};

/**
 * `commits.subjects` when most recent subjects (merge commits left out: their subject is the host's) are `type(scope): text`, or a
 * commitlint config is there: commitlint repositories refuse `claim:` as a commit type, so accord's own commits take the same form.
 */
function subjectsStyle(commits: Commit[], lint: Commitlint | undefined): Proposal | undefined {
  const total = commits.length;
  const conventional = commits.filter((c) => CONVENTIONAL.test(c.subject)).length;
  const byHistory = total >= MIN_COMMITS && holds(conventional, total);
  if (!byHistory && lint === undefined) return undefined;
  const parts = [
    ...(byHistory ? [`${conventional} of ${total} recent commits are type(scope): text`] : []),
    ...(lint === undefined ? [] : [lint.presence + (lint.scopeWithoutAccord ? ' and its scope-enum does not list accord' : '')]),
  ];
  const value = Object.fromEntries(SUBJECT_NAMES.map((name) => [name, CONVENTIONAL_SUBJECTS[name]]));
  return { key: 'commits.subjects', value, evidence: parts.join('; ') };
}

/** The branch names of the repository, local and remote-tracking as one set, without the default branch and `HEAD`; at most `MAX_REFS` refs are read. */
function branchNames(root: string, defaultName: string): string[] {
  const raw = git(root, ['for-each-ref', `--count=${MAX_REFS}`, '--format=%(refname)%00', 'refs/heads', 'refs/remotes']);
  if (raw === undefined) return [];
  const names = raw
    .split('\0')
    .map((r) => r.replace(/^\n/, ''))
    .filter((r) => r !== '')
    .map((r) => r.replace(/^refs\/heads\//, '').replace(/^refs\/remotes\/[^/]+\//, ''));
  return [...new Set(names)].filter((n) => n !== 'HEAD' && n !== defaultName);
}

/** A ticket id as a whole branch segment: `ENG-12`, `ST-LN-50`. A branch named for what it does (`feature/add-export`) carries no id, so its shape says nothing about `{id}`. */
const ID_SEGMENT = /^[A-Z][A-Z0-9_]*(?:-[A-Z0-9_]+)*-[0-9]+$/;

/**
 * `branch` from the most common `<prefix>/<id>` shape among the branch names. The prefix `t` is accord's own (`t/{id}`), so it is
 * never proposed, though a `t/` branch still counts among the branches a shape has to hold a share of.
 */
function branchShape(names: string[], defaultName: string): Proposal | undefined {
  const total = names.length;
  if (total < MIN_BRANCHES) return undefined;
  const counts = new Map<string, number>();
  for (const name of names) {
    const at = name.lastIndexOf('/');
    if (at <= 0 || !ID_SEGMENT.test(name.slice(at + 1))) continue;
    const prefix = name.slice(0, at);
    if (prefix !== 't') counts.set(prefix, (counts.get(prefix) ?? 0) + 1);
  }
  const [top, n] = [...counts.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))[0] ?? ['', 0];
  if (top === '' || !holds(n, total)) return undefined;
  return {
    key: 'branch',
    value: `${top}/{id}`,
    evidence: `${n} of ${total} branches other than ${defaultName} are named ${printable(top)}/<ticket key>`,
  };
}

/** A tracker key (a Jira project key or Linear team key, a hyphen, the number) as a word of its own, so `SHA-256` counts and `xENG-1` does not. */
const KEY_IN_TEXT = /(?<![A-Za-z0-9_-])([A-Z][A-Z0-9_]{0,19})-[1-9][0-9]{0,8}(?![A-Za-z0-9_])/g;

function projectsIn(text: string): string[] {
  return [...text.matchAll(KEY_IN_TEXT)].map((m) => m[1]);
}

/**
 * `ids` in tracker mode, with the projects the keys name, when most recent commit subjects (at least 10 commits) or most branch names
 * (at least 5) carry a tracker key. A source that does not hold the share is not read for projects. More than `MAX_PROJECTS` projects is a
 * history that mentions key-like words (`SHA-256`), not one tracker's keys: no proposal.
 */
function trackerKeys(commits: Commit[], names: string[]): Proposal | undefined {
  const keyed = commits.filter((c) => projectsIn(c.subject).length > 0);
  const keyedBranches = names.filter((n) => projectsIn(n).length > 0);
  const byCommits = commits.length >= MIN_COMMITS && holds(keyed.length, commits.length);
  const byBranches = names.length >= MIN_BRANCHES && holds(keyedBranches.length, names.length);
  if (!byCommits && !byBranches) return undefined;
  const projects = [
    ...new Set([...(byCommits ? keyed.flatMap((c) => projectsIn(c.subject)) : []), ...(byBranches ? keyedBranches.flatMap(projectsIn) : [])]),
  ].sort();
  if (projects.length === 0 || projects.length > MAX_PROJECTS) return undefined;
  const parts = [
    ...(byCommits ? [`${keyed.length} of ${commits.length} recent commits`] : []),
    ...(byBranches ? [`${keyedBranches.length} of ${names.length} branches`] : []),
  ];
  return { key: 'ids', value: { mode: 'tracker', projects }, evidence: `${parts.join(' and ')} carry a ticket key (${projects.join(', ')})` };
}

const LINEAR_LINK = /https?:\/\/linear\.app(?![A-Za-z0-9.-])/gi;
const JIRA_LINK = /https?:\/\/([A-Za-z0-9][A-Za-z0-9-]{0,62})\.atlassian\.net(?![A-Za-z0-9.-])/gi;

/**
 * `tracker` from the first link to linear.app or atlassian.net found in README.md, then the files under `.github`, then the recent commit
 * messages. Jira needs the site (`https://<name>.atlassian.net`), which the link gives; Linear needs nothing more.
 */
function trackerLinks(root: string, commits: Commit[]): Proposal | undefined {
  const tracked = trackedFiles(root, ['README.md', '.github']);
  const sources: { where: string; text: () => string | undefined }[] = [
    ...tracked.filter((f) => f === 'README.md' || f.startsWith('.github/')).sort((x, y) => Number(y === 'README.md') - Number(x === 'README.md')).map((f) => ({ where: printable(f), text: () => readBounded(root, f) })),
    { where: 'commit messages', text: () => commits.map((c) => `${c.subject}\n${c.body}`).join('\n') },
  ];
  for (const { where, text } of sources) {
    const body = text();
    if (body === undefined) continue;
    const linear = [...body.matchAll(LINEAR_LINK)];
    const jira = [...body.matchAll(JIRA_LINK)];
    if (linear.length === 0 && jira.length === 0) continue;
    const jiraFirst = jira.length > 0 && (linear.length === 0 || (jira[0].index ?? 0) < (linear[0].index ?? 0));
    const n = jiraFirst ? jira.length : linear.length;
    const host = jiraFirst ? 'atlassian.net' : 'linear.app';
    const value = jiraFirst ? { adapter: 'jira', url: `https://${jira[0][1].toLowerCase()}.atlassian.net` } : { adapter: 'linear' };
    return { key: 'tracker', value, evidence: `${n} ${host} link${n === 1 ? '' : 's'} in ${where}` };
  }
  return undefined;
}

/**
 * A filter over proposals: the ones `accord config set` would take. Each is applied to the repository's config.yml as `set` applies it, and
 * kept only when the result passes the schema, adds no floor problem, and (for subjects) collides with nothing. With no readable config.yml
 * nothing can be checked, so nothing is kept.
 */
function accepted(root: string): (p: Proposal) => boolean {
  const text = readBounded(root, 'accord/config.yml');
  const before = text === undefined ? undefined : loadConfig('accord/config.yml', text);
  const known = new Set(floorProblems(before?.config).map((p) => p.pointer));
  return (p) => {
    const path = resolveKeyPath(p.key);
    if (text === undefined || path === undefined) return false;
    const after = setConfigValue(text, path, p.value);
    if (after === undefined) return false;
    const loaded = loadConfig('accord/config.yml', after);
    if (loaded.findings.length > 0 || loaded.config === undefined) return false;
    if (floorProblems(loaded.config).some((f) => !known.has(f.pointer))) return false;
    return p.key !== 'commits.subjects' || subjectCollisions(loaded.config).length === 0;
  };
}

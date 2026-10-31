// ST-LN-57: which commit recorded each review round, the pin at the first round, the base pin and each debug
// episode's commits, all read from git along first parents (D-12, ledger Rulings 22 and 26).
import { execFileSync } from 'node:child_process';
import { parseRounds, pinOf } from '@accord-dev/accord-core';
import { catBatch } from './fs.js';
import { reach } from './walk.js';
import type { Walk } from './walk.js';

export interface RecordHistory {
  rounds: string[]; // R_1..R_c, full lower-case shas, c = the rounds committed
  pin?: string; // the pin at R_1; with no committed round, the pin of HEAD's config
  pinAt?: string; // R_1
  basePin?: string; // the pin at the merge base of R_1 (of HEAD) with the default ref, else at the plan's baseline
  baseAt?: string; // the commit the base pin was read at
  episodes: { open: string; end?: string; commits: Set<string> }[]; // empty when no walk is given
}

interface Entry {
  sha: string;
  parents: string[];
  review?: string; // the git status letter of review.md in this commit
  debug?: string; // the same for debug.md
}

const GIT = {
  encoding: 'utf8' as const,
  stdio: ['ignore', 'pipe', 'pipe'] as ['ignore', 'pipe', 'pipe'],
  maxBuffer: 64 * 1024 * 1024,
  env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
};

/** git's first non-blank stderr line without "fatal: ", else the error's own message. */
function whyGit(e: unknown): string {
  const stderr = String((e as { stderr?: string }).stderr ?? '').split('\n').find((l) => l.trim() !== '');
  return (stderr ?? (e as Error).message ?? 'git failed').replace(/^fatal: /, '').trim();
}

/** The first-parent commits from `from` that change review.md or debug.md, newest first, with each file's status. */
function logOf(root: string, from: string, id: string): Entry[] {
  const dir = `accord/tickets/${id}/`;
  const raw = execFileSync(
    'git',
    [
      '-c', 'core.quotePath=false',
      '-c', 'log.showSignature=false', 'log', '--no-show-signature', '-z', '--first-parent', '--diff-merges=first-parent',
      '--format=%x01%H%x00%P', '--name-status', '--no-renames', from, '--',
      ':(literal)' + dir + 'review.md', ':(literal)' + dir + 'debug.md',
    ],
    { cwd: root, ...GIT },
  );
  const tokens = raw.split('\0').map((t) => (t.startsWith('\n') ? t.slice(1) : t));
  const entries: Entry[] = [];
  for (let i = 0; i < tokens.length; i++) {
    if (!tokens[i].startsWith('\x01')) continue;
    const entry: Entry = {
      sha: tokens[i].slice(1).toLowerCase(),
      parents: (tokens[i + 1] ?? '').split(' ').filter((p) => p !== '').map((p) => p.toLowerCase()),
    };
    i += 2;
    while (i + 1 < tokens.length && tokens[i] !== '' && !tokens[i].startsWith('\x01')) {
      const path = tokens[i + 1];
      if (path === dir + 'review.md') entry.review = tokens[i];
      else if (path === dir + 'debug.md') entry.debug = tokens[i];
      i += 2;
    }
    i -= 1; // the loop's own increment lands on the next commit
    entries.push(entry);
  }
  return entries;
}

/** `git merge-base --is-ancestor`: exit 0 is true, exit 1 is false, anything else is an error. */
function isAncestor(root: string, a: string, b: string): boolean {
  try {
    execFileSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: root, ...GIT });
    return true;
  } catch (e) {
    if ((e as { status?: number }).status === 1) return false;
    throw e;
  }
}

/** `git merge-base`: exit 1 means no common commit. */
function mergeBase(root: string, a: string, b: string): string | undefined {
  try {
    return execFileSync('git', ['merge-base', a, b], { cwd: root, ...GIT }).trim().toLowerCase();
  } catch (e) {
    if ((e as { status?: number }).status === 1) return undefined;
    throw e;
  }
}

/** The `## Episode` and `## Resolved` headings of a debug.md text outside fenced blocks, in order. */
function debugHeadings(text: string): ('E' | 'R')[] {
  const kinds: ('E' | 'R')[] = [];
  let fence: string | undefined;
  for (const line of text.split(/\r?\n/)) {
    const f = /^ {0,3}(`{3,}|~{3,})/.exec(line);
    if (f !== null) {
      if (fence === undefined) fence = f[1][0];
      else if (f[1][0] === fence) fence = undefined;
      continue;
    }
    if (fence !== undefined) continue;
    if (/^## Episode\b/.test(line)) kinds.push('E');
    else if (/^## Resolved\b/.test(line)) kinds.push('R');
  }
  return kinds;
}

/** An entry list cut at its newest creation (status A); empty when the newest entry deleted the file. */
function sinceCreated(entries: Entry[], status: (e: Entry) => string | undefined): Entry[] {
  const own = entries.filter((e) => status(e) !== undefined);
  if (own.length === 0 || status(own[0]) === 'D') return [];
  const at = own.findIndex((e) => status(e) === 'A');
  return at < 0 ? own : own.slice(0, at + 1);
}

function read(root: string, id: string, walk: Walk | undefined, headPin: string | undefined, o: { def?: string; baseline?: string }): RecordHistory {
  const reviewPath = `accord/tickets/${id}/review.md`;
  const debugPath = `accord/tickets/${id}/debug.md`;
  const chain: Entry[] = []; // newest first
  const reviewEntries: Entry[] = [];
  for (let from = 'HEAD'; ; ) {
    const log = logOf(root, from, id);
    const own = sinceCreated(log, (e) => e.review);
    reviewEntries.push(...own);
    const adder = own[own.length - 1];
    if (adder === undefined || adder.review !== 'A' || adder.parents.length <= 1) {
      chain.push(...log);
      break;
    }
    // The commit that adds review.md is a merge whose first parent lacks it: go on along the side that holds it.
    const others = adder.parents.slice(1);
    const texts = catBatch(root, others.map((p) => `${p}:${reviewPath}`), 'the record history');
    const side = others.findIndex((_, k) => texts[k] !== undefined);
    if (side < 0 || o.def === undefined || !isAncestor(root, others[side], o.def)) {
      chain.push(...log);
      break;
    }
    chain.push(...log.slice(0, log.indexOf(adder) + 1));
    from = others[side];
  }
  const debugEntries = walk === undefined ? [] : sinceCreated(chain, (e) => e.debug);

  const specs: string[] = [];
  for (const e of reviewEntries) if (e.review !== 'D') specs.push(`${e.sha}:${reviewPath}`, `${e.sha}:accord/config.yml`);
  for (const e of debugEntries) if (e.debug !== 'D') specs.push(`${e.sha}:${debugPath}`);
  const texts = specs.length === 0 ? [] : catBatch(root, specs, 'the record history');
  const at = new Map(specs.map((s, i) => [s, texts[i]]));

  // R_j: the last commit at which the number of rounds rose to j, oldest to newest.
  const rounds: string[] = [];
  const configAt = new Map<string, string | undefined>();
  for (const e of [...reviewEntries].reverse()) {
    const text = at.get(`${e.sha}:${reviewPath}`);
    configAt.set(e.sha, at.get(`${e.sha}:accord/config.yml`));
    const count = text === undefined ? 0 : parseRounds(reviewPath, text, 'review').cycles.reduce((n, c) => n + c.rounds.length, 0);
    if (count < rounds.length) rounds.length = count;
    while (rounds.length < count) rounds.push(e.sha);
  }

  const history: RecordHistory = { rounds, episodes: [] };
  if (rounds.length === 0) {
    history.pin = headPin;
  } else {
    const cfg = configAt.get(rounds[0]);
    history.pinAt = rounds[0];
    if (cfg !== undefined) history.pin = pinOf(cfg);
  }

  const baseAt = o.def !== undefined ? mergeBase(root, rounds[0] ?? 'HEAD', o.def) : o.baseline;
  if (baseAt !== undefined) {
    const cfg = catBatch(root, [`${baseAt}:accord/config.yml`], 'the record history')[0];
    const basePin = cfg === undefined ? undefined : pinOf(cfg);
    if (basePin !== undefined) {
      history.basePin = basePin;
      history.baseAt = baseAt;
    }
  }

  if (walk !== undefined) history.episodes = episodesOf(walk, chain, debugEntries, rounds, (sha) => at.get(`${sha}:${debugPath}`));
  return history;
}

function episodesOf(walk: Walk, chain: Entry[], debugEntries: Entry[], rounds: string[], debugText: (sha: string) => string | undefined): RecordHistory['episodes'] {
  const index = new Map(chain.map((e, i) => [e.sha, i]));
  const oldest = [...debugEntries].reverse();
  const kinds = oldest.map((e) => debugHeadings(debugText(e.sha) ?? ''));
  const total = Math.max(0, ...kinds.map((k) => k.filter((x) => x === 'E').length));
  const out: RecordHistory['episodes'] = [];
  for (let n = 1; n <= total; n++) {
    const opened = oldest.findIndex((_, i) => kinds[i].filter((x) => x === 'E').length >= n);
    const open = oldest[opened].sha;
    // Resolved after the n-th Episode heading, in the oldest commit that holds it.
    const resolved = oldest.findIndex((_, i) => {
      if (i < opened) return false;
      let seen = 0;
      return kinds[i].some((x) => {
        if (x === 'E') seen++;
        return x === 'R' && seen >= n;
      });
    });
    const resolvedAt = resolved < 0 ? undefined : oldest[resolved].sha;
    // The first review round recorded after the episode opened: the oldest record commit newer than the opening one.
    const openIdx = index.get(open)!;
    const recorded = rounds
      .filter((r) => (index.get(r) ?? Infinity) < openIdx)
      .sort((a, b) => index.get(b)! - index.get(a)!)[0];
    const rIdx = recorded === undefined ? -1 : index.get(recorded)!;
    const zIdx = resolvedAt === undefined ? -1 : (index.get(resolvedAt) ?? -1);
    let end: string | undefined;
    let included = false;
    if (recorded !== undefined && (resolvedAt === undefined || rIdx >= zIdx)) end = recorded;
    else if (resolvedAt !== undefined) {
      end = resolvedAt;
      included = true;
    }
    const from = end ?? walk.order[0];
    const commits = new Set<string>();
    if (from !== undefined) {
      const before = reach(walk, open);
      for (const sha of reach(walk, from)) if (!before.has(sha)) commits.add(sha);
      if (end !== undefined && !included) commits.delete(end);
    }
    out.push({ open, ...(end !== undefined ? { end } : {}), commits });
  }
  return out;
}

/** The record history of one ticket, or the reason git could not be read. */
export function readHistory(
  root: string,
  id: string,
  walk: Walk | undefined,
  headPin: string | undefined,
  o: { def?: string; baseline?: string },
): RecordHistory | { error: string } {
  try {
    return read(root, id, walk, headPin, o);
  } catch (e) {
    return { error: 'git failed reading the record history: ' + whyGit(e) };
  }
}

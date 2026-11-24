// Phase 08.9 D-02 clarification, D-03, D-04, D-08: the fact tables of one offline dry `worktree clean` (the clean `accord audit` runs), each read once per clean.
// Owner ruling 2026-11-24 (snapshot once, CONTEXT D-08): the batched dry clean reads git once and uses that snapshot for the whole run, so a ref that moves while the
// audit runs is reported as the snapshot saw it and the next audit sees the change. Only facts about refs and commits are answered here; every judgement step stays
// per branch in worktree.ts. A lookup answers a value, `null` for "absent" (an answer), or `undefined` for "unknown", and unknown always runs today's read. A table whose
// git call fails answers unknown for the rest of that clean and is not read again (D-03). Every value lives in the object readCleanFacts returns, which lives as long as
// one clean call (D-04); nothing is kept at module level and nothing is written to disk. Nothing here starts a process when readCleanFacts is called: a table is read
// on the first question it must answer.
import { execFileSync } from 'node:child_process';
import { isResearchPath, loadSnapshot, SAFE_ID } from '@accord-dev/accord-core';
import { catBatch } from './fs.js';

/** What one offline dry clean asks about refs and commits; each answer is git's own, or `undefined` (unknown) so the caller reads it as it did before. */
export interface CleanFacts {
  /** The sha `git rev-parse --verify -q refs/heads/<branch>` prints (a ref pointing at any object type), `null` when git would find no ref, `undefined` when this cannot say. */
  localTip(branch: string): string | null | undefined;
  /** What `git merge-base --is-ancestor <sha> <ref>` answers for the default ref `ref`, `undefined` when `sha` is not a tip the refs table lists as a commit. */
  onRef(sha: string): boolean | undefined;
  /**
   * The commit each full-length `verified_commit` in `raws` names, from one `git cat-file --batch-check` fed `<raw>^{commit}`: the object name for a commit, `null` for a missing one
   * (what `rev-parse --verify -q <raw>^{commit}` failing means). A raw that is not 40 or 64 lower-case hex characters is left out, so is any other answer; the whole map is
   * `undefined` when the call fails. A short name's resolution is git's disambiguation, not batched.
   */
  commitsOf(raws: readonly string[]): ReadonlyMap<string, string | null> | undefined;
  /**
   * What researchNotOn reads for the dropped branches in `items` (the tip each is judged at, and its ticket id), asked once with all of them: the ticket file at each tip
   * from one `git cat-file --batch`, then the object name of every research path those tickets list, at the tip and at the default ref, from one `git cat-file --batch-check`.
   * `undefined` when the first call fails; a read the second call failed to answer is left out of the answers, so the caller reads it as it did before.
   */
  researchAt(items: readonly { tip: string; id: string }[]): ResearchAnswers | undefined;
  /**
   * For each full-length tip in `tips`, the count `git rev-list --count <tip> --not --remotes=origin` prints, from one `git rev-list --parents --stdin` fed every tip and the
   * `^` of every sha the refs table lists under refs/remotes/origin/. `undefined` when this cannot say (a failed call, an origin ref that is not a commit).
   */
  notOnOrigin(tips: readonly string[]): ReadonlyMap<string, number> | undefined;
  /** The tree of the default ref's commit (what `git rev-parse <ref>^{tree}` prints), from one `git cat-file --batch-check`; `undefined` when this cannot say. */
  refTree(): string | undefined;
  /**
   * The answer of `read(path)`, a detached worktree's stopped-rebase check, read on the first question for that path and replayed (its value, or the error it threw) on every
   * later one. `read` comes from the caller, so nothing here depends on the commands that use it.
   */
  rebaseOf(path: string, read: (path: string) => string | undefined): string | undefined;
}

/** The answers of one research read: git's own text or object name, `null` for "no such file or path", `undefined` for "not asked or not answered". */
export interface ResearchAnswers {
  /** The text of `accord/tickets/<id>.md` at `tip`. */
  ticket(tip: string, id: string): string | null | undefined;
  /** The object name of `<commit>:<path>`, `commit` being a tip as asked or the default ref's name as the caller knows it. */
  blob(commit: string, path: string): string | null | undefined;
}

/** A full object name: the only text that is written to a stdin line of git here. */
const FULL_SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
/** Characters that give a branch name a meaning to `git rev-parse` beyond a ref name (revision syntax); such a name is left to today's read. */
const REVISION_SYNTAX = /[\s^~:?*[\\]|\.\.|@\{/;

/** A path that holds a line break or a NUL cannot be written to a stdin line. */
const UNFIT_LINE = /[\0\r\n]/;
/** A `cat-file --batch-check` line for an object that exists: its full name, its type, its size. */
const FOUND_OBJECT = /^[0-9a-f]{40}([0-9a-f]{24})? \w+ \d+$/;

type Entry = { oid: string; type: string };

/** The spawn options of fs.ts `missingShas`: literal argument list, no shell, the 64 MiB buffer, no lazy fetch. */
function git(root: string, args: string[], input?: string): string {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 64 * 1024 * 1024,
    env: { ...process.env, GIT_NO_LAZY_FETCH: '1' },
    ...(input === undefined ? {} : { input }),
  });
}

/** The tables of one clean of the repository at `root` whose default ref is `ref` (a full ref name); no process starts until a table is asked. */
export function readCleanFacts(root: string, ref: string): CleanFacts {
  // undefined: not read yet; null: the call failed, every question it serves is unknown
  let refs: Map<string, Entry> | null | undefined;
  let reach: { tips: Set<string>; unreached: Set<string> } | null | undefined;
  let research: ResearchAnswers | null | undefined;
  let lacking: Map<string, number> | null | undefined;
  let tree: string | null | undefined;
  const rebases = new Map<string, { value: string | undefined } | { error: unknown }>();

  /** The refs table: one for-each-ref with no pattern, read at the first question and never again. */
  const table = (): Map<string, Entry> | null => {
    if (refs !== undefined) return refs;
    try {
      const read = new Map<string, Entry>();
      for (const row of git(root, ['for-each-ref', '--format=%(objectname)%00%(objecttype)%00%(refname)']).split(/\r?\n/)) {
        const [oid, type, name] = row.split('\0');
        if (oid !== undefined && type !== undefined && name !== undefined && name !== '') read.set(name, { oid: oid.toLowerCase(), type });
      }
      refs = read;
    } catch {
      refs = null;
    }
    return refs;
  };

  /**
   * The onRef table: one `rev-list --stdin` fed every commit tip under refs/heads/ and refs/remotes/origin/ the refs table lists, then `^` and the sha it lists for `ref`.
   * It prints every commit a fed tip reaches that `ref` does not, so a fed tip it does not print is one `ref` reaches.
   */
  const reached = (): { tips: Set<string>; unreached: Set<string> } | null => {
    if (reach !== undefined) return reach;
    reach = null;
    const t = table();
    const head = t?.get(ref);
    if (t === null || head === undefined || head.type !== 'commit' || !FULL_SHA.test(head.oid)) return reach;
    const tips = new Set<string>();
    for (const [name, e] of t) {
      if (e.type === 'commit' && FULL_SHA.test(e.oid) && (name.startsWith('refs/heads/') || name.startsWith('refs/remotes/origin/'))) tips.add(e.oid);
    }
    try {
      const out = git(root, ['rev-list', '--stdin'], [...tips, '^' + head.oid].map((l) => l + '\n').join(''));
      reach = { tips, unreached: new Set(out.split(/\r?\n/).map((l) => l.trim().toLowerCase()).filter((l) => l !== '')) };
    } catch {
      reach = null;
    }
    return reach;
  };

  return {
    localTip(branch) {
      if (branch === '' || REVISION_SYNTAX.test(branch)) return undefined;
      const t = table();
      if (t === null) return undefined;
      const full = 'refs/heads/' + branch;
      const hit = t.get(full);
      if (hit !== undefined) return hit.oid;
      // the names git rev-parse also tries for `refs/heads/<branch>`, in its own lookup rules; any of them listed is a ref git could have answered with
      const others = [`refs/${full}`, `refs/tags/${full}`, `refs/heads/${full}`, `refs/remotes/${full}`, `refs/remotes/${full}/HEAD`];
      return others.some((n) => t.has(n)) ? undefined : null;
    },
    onRef(sha) {
      const lower = sha.toLowerCase();
      if (!FULL_SHA.test(lower)) return undefined;
      const r = reached();
      if (r === null || !r.tips.has(lower)) return undefined;
      return !r.unreached.has(lower);
    },
    commitsOf(raws) {
      const asked = [...new Set(raws.filter((r) => FULL_SHA.test(r)))];
      const answers = new Map<string, string | null>();
      if (asked.length === 0) return answers;
      let out: string[];
      try {
        out = git(root, ['cat-file', '--batch-check'], asked.map((r) => r + '^{commit}\n').join('')).split(/\r?\n/);
      } catch {
        return undefined;
      }
      asked.forEach((raw, i) => {
        const line = out[i] ?? '';
        const found = /^([0-9a-f]{40}(?:[0-9a-f]{24})?) commit \d+$/.exec(line);
        if (found !== null) answers.set(raw, found[1]);
        else if (line === raw + '^{commit} missing') answers.set(raw, null);
      });
      return answers;
    },
    researchAt(items) {
      if (research !== undefined) return research ?? undefined;
      research = null;
      // only a full sha and a safe ticket id reach a stdin line (T-08.9-34)
      const asked = [...new Map(items.filter((i) => FULL_SHA.test(i.tip) && SAFE_ID.test(i.id)).map((i) => [i.tip + ':' + i.id, i])).values()];
      if (asked.length === 0) return undefined;
      let texts: (string | undefined)[];
      try {
        texts = catBatch(root, asked.map((i) => `${i.tip}:accord/tickets/${i.id}.md`), 'the dropped tickets');
      } catch {
        return undefined;
      }
      const tickets = new Map<string, string | null>();
      const specs = new Map<string, string>();
      const head = table()?.get(ref);
      const defaultSha = head !== undefined && head.type === 'commit' && FULL_SHA.test(head.oid) ? head.oid : undefined;
      asked.forEach((i, n) => {
        const text = texts[n];
        tickets.set(i.tip + ':' + i.id, text ?? null);
        if (text === undefined) return;
        const parsed = loadSnapshot({ files: { ['accord/tickets/' + i.id + '.md']: text }, tree: [] }).tickets;
        if (!Object.hasOwn(parsed, i.id)) return;
        // a path that is not a research path, or that holds a line break or a NUL, is left to today's per-path read
        for (const p of [...new Set(parsed[i.id].frontmatter?.research ?? [])].filter((x) => isResearchPath(x) && !UNFIT_LINE.test(x))) {
          specs.set(`${i.tip}:${p}`, `${i.tip}:${p}`);
          if (defaultSha !== undefined) specs.set(`${ref}:${p}`, `${defaultSha}:${p}`);
        }
      });
      const blobs = new Map<string, string | null>();
      if (specs.size > 0) {
        const keys = [...specs.keys()];
        try {
          const out = git(root, ['cat-file', '--batch-check'], keys.map((k) => specs.get(k) + '\n').join('')).split(/\r?\n/);
          keys.forEach((k, n) => {
            const line = out[n] ?? '';
            if (FOUND_OBJECT.test(line)) blobs.set(k, line.slice(0, line.indexOf(' ')));
            else if (line === specs.get(k) + ' missing') blobs.set(k, null);
          });
        } catch {
          // the blob reads are left to today's per-path reads; the ticket texts stay answered
        }
      }
      research = {
        ticket: (tip, id) => tickets.get(tip + ':' + id),
        blob: (commit, path) => blobs.get(commit + ':' + path),
      };
      return research;
    },
    notOnOrigin(tips) {
      if (lacking !== undefined) return lacking ?? undefined;
      const asked = [...new Set(tips.filter((t) => FULL_SHA.test(t)))];
      if (asked.length === 0) return new Map();
      lacking = null;
      const t = table();
      if (t === null) return undefined;
      const origin = new Set<string>();
      for (const [name, e] of t) {
        if (!name.startsWith('refs/remotes/origin/')) continue;
        if (e.type !== 'commit' || !FULL_SHA.test(e.oid)) return undefined;
        origin.add(e.oid);
      }
      const parents = new Map<string, string[]>();
      try {
        const out = git(root, ['rev-list', '--parents', '--stdin'], [...asked, ...[...origin].map((o) => '^' + o)].map((l) => l + '\n').join(''));
        for (const row of out.split(/\r?\n/)) {
          const [commit, ...up] = row.trim().toLowerCase().split(' ');
          if (commit !== undefined && commit !== '') parents.set(commit, up.filter((u) => u !== ''));
        }
      } catch {
        return undefined;
      }
      // a commit a tip reaches that origin does not reach has every commit between them unreached too, so a walk inside the listed commits is exact
      const counts = new Map<string, number>();
      for (const tip of asked) {
        const seen = new Set<string>();
        const stack = parents.has(tip) ? [tip] : [];
        while (stack.length > 0) {
          const next = stack.pop()!;
          if (seen.has(next)) continue;
          seen.add(next);
          for (const up of parents.get(next) ?? []) if (parents.has(up) && !seen.has(up)) stack.push(up);
        }
        counts.set(tip, seen.size);
      }
      lacking = counts;
      return lacking;
    },
    refTree() {
      if (tree !== undefined) return tree ?? undefined;
      tree = null;
      const head = table()?.get(ref);
      if (head === undefined || head.type !== 'commit' || !FULL_SHA.test(head.oid)) return undefined;
      try {
        const line = git(root, ['cat-file', '--batch-check'], head.oid + '^{tree}\n').split(/\r?\n/)[0] ?? '';
        if (/^[0-9a-f]{40}([0-9a-f]{24})? tree \d+$/.test(line)) tree = line.slice(0, line.indexOf(' '));
      } catch {
        // the tree is read per branch, as before
      }
      return tree ?? undefined;
    },
    rebaseOf(path, read) {
      let answer = rebases.get(path);
      if (answer === undefined) {
        try {
          answer = { value: read(path) };
        } catch (error) {
          answer = { error };
        }
        rebases.set(path, answer);
      }
      if ('error' in answer) throw answer.error;
      return answer.value;
    },
  };
}

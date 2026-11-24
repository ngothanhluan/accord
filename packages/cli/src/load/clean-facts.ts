// Phase 08.9 D-02 clarification, D-03, D-04, D-08: the fact tables of one offline dry `worktree clean` (the clean `accord audit` runs), each read once per clean.
// Owner ruling 2026-11-24 (snapshot once, CONTEXT D-08): the batched dry clean reads git once and uses that snapshot for the whole run, so a ref that moves while the
// audit runs is reported as the snapshot saw it and the next audit sees the change. Only facts about refs and commits are answered here; every judgement step stays
// per branch in worktree.ts. A lookup answers a value, `null` for "absent" (an answer), or `undefined` for "unknown", and unknown always runs today's read. A table whose
// git call fails answers unknown for the rest of that clean and is not read again (D-03). Every value lives in the object readCleanFacts returns, which lives as long as
// one clean call (D-04); nothing is kept at module level and nothing is written to disk. Nothing here starts a process when readCleanFacts is called: a table is read
// on the first question it must answer.
import { execFileSync } from 'node:child_process';

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
}

/** A full object name: the only text that is written to a stdin line of git here. */
const FULL_SHA = /^[0-9a-f]{40}([0-9a-f]{24})?$/;
/** Characters that give a branch name a meaning to `git rev-parse` beyond a ref name (revision syntax); such a name is left to today's read. */
const REVISION_SYNTAX = /[\s^~:?*[\\]|\.\.|@\{/;

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
  };
}

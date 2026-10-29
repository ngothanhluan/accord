// ST-LN-63 Task 2: the commands the goldens and the git counts are recorded for, and the helpers that run them.
// Each run key is `<place> <argv joined by spaces>`; a place is a folder of a sample copy.
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { spawnLog } from './git-spawns.js';
import { gitRun, run } from './repo.js';
import { samples } from './samples.js';
import type { Sample, SampleCopy } from './samples.js';

/** The runs, in this order. `main` is a MIXED copy's root, `wt-<id>` that ticket's linked worktree in the same copy. */
export const RUNS: string[] = [
  'main status',
  'main status --json',
  'main lint',
  'main lint --json',
  'main dashboard',
  'main dashboard --json',
  'main show A-6',
  'main show A-6 --json',
  'main show A-13 --json',
  'main anchor A-6',
  'main anchor',
  'main gate done A-8 --json',
  'wt-A-7 status --json',
  'wt-A-7 anchor',
  'wt-A-7 lint --json',
  'wt-A-7 dashboard --json',
  'wt-A-7 show A-7 --json',
  'wt-A-7 gate plan A-7 --json',
  'wt-A-7 gate done A-7',
  'wt-A-7 gate done A-7 --json',
  'wt-A-3 gate plan A-3',
  'wt-A-3 gate plan A-3 --json',
  'wt-A-4 gate plan A-4 --json',
  'wt-S-1 gate done S-1',
  'wt-S-1 gate done S-1 --json',
  'side status',
  'side status --json',
  'side lint --json',
  'side dashboard --json',
  'side show F-1 --json',
  'side anchor F-1',
  'side-local status',
  'side-local status --json',
  'side-local lint --json',
  'side-local dashboard --json',
  'side-local show F-1 --json',
  'side-local anchor F-1',
  'main worktree open A-1',
  'main worktree clean',
  'wt-A-7 worktree merge A-7',
  'main new ticket N-1 --lane M --worktree',
];

/** The four runs that change the repository, each on its own fresh MIXED copy. */
const FRESH = new Set(RUNS.slice(-4));
const WORKTREES = ['A-3', 'A-4', 'A-7', 'S-1'];

export interface RunResult {
  code: number;
  out: string;
  err: string;
  /** The git argument arrays accord started during the run. */
  argv: string[][];
  /** For the four fresh-copy runs: the refs of the copy then of its remote after the run. */
  refs?: string[];
}

export interface Counted {
  code: number;
  out: string;
  err: string;
  argv: string[][];
}

/** Runs the command with counting on only around it, so the test's own setup is never counted; returns a copy of the git calls. */
export async function counted(argv: string[], cwd: string): Promise<Counted> {
  spawnLog.calls = [];
  spawnLog.on = true;
  try {
    const r = await run(argv, cwd, {});
    return { ...r, argv: spawnLog.calls.map((a) => [...a]) };
  } finally {
    spawnLog.on = false;
  }
}

const win = process.platform === 'win32';
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Every spelling of one folder: as given, forward slashes, `realpathSync.native`, and that with forward slashes. */
function spellings(dir: string): string[] {
  let real = dir;
  try {
    real = realpathSync.native(dir);
  } catch {
    // the folder is gone (a cleaned template): only the given spelling is left
  }
  return [...new Set([dir, dir.replaceAll('\\', '/'), real, real.replaceAll('\\', '/')])];
}

/**
 * Replaces what differs between runs and nothing else (D-07): each temporary folder of the template and of the copy
 * with `<root>` or `<remote>`, and each run of 7 to 40 hex characters that is a prefix of a known commit with
 * `<sha:NAME>` (40 long) or `<short:NAME>`. `extra` maps further known shas to their names.
 */
export function normalise(text: string, sample: Sample, copy: SampleCopy, extra: Record<string, string> = {}): string {
  const folders: [string, string][] = [];
  for (const [dir, tag] of [
    [sample.root, '<root>'],
    [copy.root, '<root>'],
    [sample.remote, '<remote>'],
    [copy.remote, '<remote>'],
  ] as const) for (const s of spellings(dir)) folders.push([s, tag]);
  folders.sort((a, b) => b[0].length - a[0].length);
  let out = text;
  for (const [s, tag] of folders) out = out.replace(new RegExp(escapeRe(s), win ? 'gi' : 'g'), tag);
  const known: Record<string, string> = { ...extra, ...sample.names };
  const shas = Object.keys(known);
  return out.replace(/(?<![0-9a-fA-F])[0-9a-f]{7,40}(?![0-9a-fA-F])/g, (run) => {
    const sha = shas.find((s) => s.startsWith(run));
    if (sha === undefined) return run;
    return run.length === 40 ? `<sha:${known[sha]}>` : `<short:${known[sha]}>`;
  });
}

interface Place {
  cwd: string;
  copy: SampleCopy;
  sample: Sample;
}

const parse = (key: string) => {
  const [place, ...argv] = key.split(' ');
  return { place, argv };
};

/** Runs the keys in `RUNS` order and returns, per key, what the command printed and the git calls it started. */
export async function runSample(keys: string[] = RUNS): Promise<Record<string, RunResult>> {
  const { mixed, side } = samples();
  const wanted = RUNS.filter((k) => keys.includes(k));
  const unknown = keys.filter((k) => !RUNS.includes(k));
  if (unknown.length > 0) throw new Error('no such run key: ' + unknown.join(', '));
  const copies: SampleCopy[] = [];
  const result: Record<string, RunResult> = {};
  try {
    let shared: { copy: SampleCopy; at: Map<string, string> } | undefined;
    let sideCopy: SampleCopy | undefined;
    let localCopy: SampleCopy | undefined;
    const make = (from: Sample): SampleCopy => {
      const c = from.copy();
      copies.push(c);
      return c;
    };
    for (const key of wanted) {
      const { place, argv } = parse(key);
      let at: Place;
      let withRefs = false;
      if (FRESH.has(key)) {
        const copy = make(mixed);
        const worktree = place.startsWith('wt-') ? copy.worktree(place.slice(3)) : copy.root;
        at = { cwd: worktree, copy, sample: mixed };
        withRefs = true;
      } else if (place === 'main' || place.startsWith('wt-')) {
        if (shared === undefined) {
          const copy = make(mixed);
          shared = { copy, at: new Map(WORKTREES.map((id) => [id, copy.worktree(id)])) };
        }
        const cwd = place === 'main' ? shared.copy.root : shared.at.get(place.slice(3));
        if (cwd === undefined) throw new Error('no worktree for run key: ' + key);
        at = { cwd, copy: shared.copy, sample: mixed };
      } else if (place === 'side') {
        sideCopy ??= make(side);
        at = { cwd: sideCopy.root, copy: sideCopy, sample: side };
      } else if (place === 'side-local') {
        if (localCopy === undefined) {
          localCopy = make(side);
          gitRun(localCopy.root, 'remote', 'remove', 'origin');
        }
        at = { cwd: localCopy.root, copy: localCopy, sample: side };
      } else throw new Error('no such place in run key: ' + key);
      const r = await counted(argv, at.cwd);
      const refs = withRefs
        ? [at.copy.root, at.copy.remote].flatMap((d) => gitRun(d, 'for-each-ref', '--format=%(objectname) %(refname)').split('\n').filter((l) => l !== ''))
        : undefined;
      // Refs whose commit is not a fixture commit are named by the ref, copy's first (a remote ref of another sha under a taken name says so).
      const extra: Record<string, string> = {};
      for (const line of refs ?? []) {
        const [sha, ref] = line.split(' ');
        if (at.sample.names[sha] !== undefined || extra[sha] !== undefined) continue;
        const taken = Object.values(extra).includes('ref:' + ref);
        extra[sha] = taken ? 'ref:remote:' + ref : 'ref:' + ref;
      }
      const n = (t: string) => normalise(t, at.sample, at.copy, extra);
      result[key] = {
        code: r.code,
        out: n(r.out),
        err: n(r.err),
        argv: r.argv.map((a) => a.map(n)),
        ...(refs === undefined ? {} : { refs: refs.map(n) }),
      };
    }
  } finally {
    for (const c of copies) c.cleanup();
  }
  return result;
}

const GOLDEN = fileURLToPath(new URL('../__golden__/st-ln-63/', import.meta.url));
export const goldenPath = (name: string) => GOLDEN + name;

/** Reads a golden file; it is recorded once at the ST-LN-63 baseline, so an absent file is an error and never a reason to write it. */
export function readGolden<T = unknown>(name: string): T {
  const path = goldenPath(name);
  if (!existsSync(path)) throw new Error(`${path} is missing: it is recorded once at the ST-LN-63 baseline and never rewritten`);
  return JSON.parse(readFileSync(path, 'utf8')) as T;
}

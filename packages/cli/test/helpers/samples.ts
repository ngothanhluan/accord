// ST-LN-63 Task 1: sample repositories with tickets at several stages, for the counting and golden tests.
// Every commit is written by `git fast-import` (exact bytes, one process per phase); a new phase starts only where a file
// must hold the sha of a commit made before it. Dates are the build's start time minus a fixed offset per commit, so idle
// days are the same in every run while shas differ between runs.
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, realpathSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { loadSnapshot, setFrontmatterKey } from '@accord-dev/accord-core';
import { AC, CONFIG, gateReadyIn, junit, LANE_S_BODY, laneTicket, P, PLAN, ready, REPORT } from '../../../../test/helpers/lane.js';
import type { Files } from '../../../../test/helpers/lane.js';
import { cleanup, gitRun } from './repo.js';
import { copyClone } from './worktree.js';
import type { Clone } from './worktree.js';

export type Kind =
  | 'intent'
  | 'plan'
  | 'build-missing-file'
  | 'plan-foreign-baseline'
  | 'review'
  | 'verify-merged'
  | 'verify-straight'
  | 'verify-merged-before'
  | 'done-merged'
  | 'done-squash'
  | 'done-rebased'
  | 'done-extra'
  | 'dropped'
  | 'lane-s';

export interface TicketSpec {
  id: string;
  kind: Kind;
}

export interface SampleCopy {
  root: string;
  remote: string;
  worktree(id: string): string;
  cleanup(): void;
}

export interface Sample {
  root: string;
  remote: string;
  /** Each fixture commit's full sha, mapped to the name the builder gave it (`main-1`, `A-6-review`, `A-6-merge`, ...). */
  names: Record<string, string>;
  /** The ids whose branch holds a merge commit that is not on main, in ticket order. */
  withMerge: string[];
  /** The sha of the fixture commit with that name. */
  shaOf(name: string): string;
  copy(): SampleCopy;
  cleanup(): void;
}

export const MIXED: TicketSpec[] = [
  { id: 'A-1', kind: 'intent' },
  { id: 'A-2', kind: 'plan' },
  { id: 'A-3', kind: 'build-missing-file' },
  { id: 'A-4', kind: 'plan-foreign-baseline' },
  { id: 'A-5', kind: 'review' },
  { id: 'A-6', kind: 'verify-merged' },
  { id: 'A-7', kind: 'verify-straight' },
  { id: 'A-8', kind: 'done-merged' },
  { id: 'A-9', kind: 'done-squash' },
  { id: 'A-10', kind: 'done-rebased' },
  { id: 'A-11', kind: 'done-extra' },
  { id: 'A-12', kind: 'dropped' },
  { id: 'A-13', kind: 'verify-merged-before' },
  { id: 'S-1', kind: 'lane-s' },
];

export const SIDE: TicketSpec[] = [
  { id: 'F-1', kind: 'verify-straight' },
  { id: 'F-2', kind: 'review' },
  { id: 'F-3', kind: 'verify-merged' },
  { id: 'F-4', kind: 'plan' },
];

/** Six times the build of MIXED and SIDE together, measured on the owner's Windows machine (preamble). */
export const SAMPLE_BUILD_LIMIT = 60_000;

const MAIN = 'refs/heads/main';
const ROOT_COMMIT = 'main-1';
const WITH_MERGE: Kind[] = ['verify-merged', 'verify-merged-before'];

type Ops = Record<string, string | null>;

interface Commit {
  name: string;
  mark: number;
  ref: string;
  from?: string;
  merge?: string;
  ops: Ops;
  msg: string;
  ts: number;
  tree: Map<string, string>;
}

function inSandbox(dir: string): string {
  const real = realpathSync.native(dir);
  if (!real.startsWith(realpathSync.native(tmpdir())) || real === realpathSync.native(process.cwd())) {
    throw new Error('refusing to run git outside a temporary sandbox: ' + dir);
  }
  return real;
}

/** The commits of a sample, as a graph with a file tree per commit; `flush` writes the pending ones with one `git fast-import`. */
class Dag {
  private readonly commits = new Map<string, Commit>();
  private readonly shas = new Map<string, string>();
  private pending: Commit[] = [];
  private readonly tips = new Map<string, string>();
  private count = 0;

  constructor(
    private readonly root: string,
    private readonly marks: string,
    private readonly start: number,
  ) {}

  tip(ref: string): string | undefined {
    return this.tips.get(ref);
  }

  commit(name: string): Commit {
    const c = this.commits.get(name);
    if (c === undefined) throw new Error('no fixture commit named ' + name);
    return c;
  }

  names(): Record<string, string> {
    return Object.fromEntries([...this.shas].map(([name, sha]) => [sha, name]));
  }

  sha(name: string): string {
    const sha = this.shas.get(name);
    if (sha === undefined) throw new Error(`fixture commit ${name} is not written yet: a file that holds its sha belongs in a later phase`);
    return sha;
  }

  add(ref: string, name: string, o: { from?: string; merge?: string; ops?: Ops; msg: string }): string {
    if (this.commits.has(name)) throw new Error('fixture commit named twice: ' + name);
    const from = o.from ?? this.tips.get(ref);
    const ops = o.ops ?? {};
    const tree = new Map(from === undefined ? [] : this.commit(from).tree);
    for (const [path, text] of Object.entries(ops)) {
      if (text === null) tree.delete(path);
      else tree.set(path, text);
    }
    this.count += 1;
    const c: Commit = {
      name,
      mark: this.count,
      ref,
      ...(from === undefined ? {} : { from }),
      ...(o.merge === undefined ? {} : { merge: o.merge }),
      ops,
      msg: o.msg,
      // A fixed offset per commit in definition order: parents come before children, so time never runs backwards.
      ts: this.start - (1000 - this.count) * 20,
      tree,
    };
    this.commits.set(name, c);
    this.pending.push(c);
    this.tips.set(ref, name);
    return name;
  }

  /** The operations that turn the tree of `base` into the tree of `to`. */
  delta(to: string, base: string): Ops {
    const a = this.commit(to).tree;
    const b = this.commit(base).tree;
    const ops: Ops = {};
    for (const [path, text] of a) if (b.get(path) !== text) ops[path] = text;
    for (const path of b.keys()) if (!a.has(path)) ops[path] = null;
    return ops;
  }

  flush(): void {
    if (this.pending.length === 0) return;
    const chunks: Buffer[] = [];
    const line = (text: string) => chunks.push(Buffer.from(text + '\n'));
    const data = (text: string) => {
      const bytes = Buffer.from(text);
      line(`data ${bytes.length}`);
      chunks.push(bytes, Buffer.from('\n'));
    };
    for (const c of this.pending) {
      const who = `fixture <fixture@example.invalid> ${c.ts} +0000`;
      line(`commit ${c.ref}`);
      line(`mark :${c.mark}`);
      line(`author ${who}`);
      line(`committer ${who}`);
      data(c.msg + '\n');
      if (c.from !== undefined) line(`from :${this.commit(c.from).mark}`);
      if (c.merge !== undefined) line(`merge :${this.commit(c.merge).mark}`);
      for (const [path, text] of Object.entries(c.ops)) {
        if (text === null) line(`D ${path}`);
        else {
          line(`M 100644 inline ${path}`);
          data(text);
        }
      }
      line('');
    }
    execFileSync('git', ['fast-import', '--quiet', `--export-marks=${this.marks}`, `--import-marks-if-exists=${this.marks}`], {
      cwd: inSandbox(this.root),
      input: Buffer.concat(chunks),
      stdio: ['pipe', 'pipe', 'pipe'],
      maxBuffer: 64 * 1024 * 1024,
    });
    const byMark = new Map<number, string>();
    for (const l of readFileSync(this.marks, 'utf8').split('\n')) {
      const m = /^:(\d+) ([0-9a-f]{40,64})$/.exec(l);
      if (m !== null) byMark.set(Number(m[1]), m[2]);
    }
    for (const c of this.pending) {
      const sha = byMark.get(c.mark);
      if (sha === undefined) throw new Error('git fast-import exported no mark for ' + c.name);
      this.shas.set(c.name, sha);
    }
    this.pending = [];
  }
}

const REVIEWED = '## Round 1\nverdict: converged\n';
const UNFINISHED = '## Round 1\nNo verdict yet.\n';
const recordsOf = (id: string) => ({
  ticket: P(id),
  plan: `accord/tickets/${id}/plan.md`,
  ledger: `accord/tickets/${id}/ledger.md`,
  review: `accord/tickets/${id}/review.md`,
  verification: `accord/tickets/${id}/verification.md`,
});
const codeOf = (id: string) => `src/${id}.ts`;
const codeText = (id: string, n: number) => `export const ${id.replace(/\W/g, '_')} = ${n};\n`;
const ledgerText = (tasks: number) => '## Tasks\n' + Array.from({ length: tasks }, (_, i) => `- task ${i + 1} done abc1234\n`).join('');
const verificationText = (id: string, sha: string) =>
  [
    '---',
    `ticket: "${id}"`,
    `commit: "${sha}"`,
    'reviewed_on: "2026-10-12"',
    '---',
    '',
    '## @ac-1 writes a csv',
    '',
    'Result: pass',
    '',
    'Evidence: fixture',
    '',
    '## @ac-2 escapes commas',
    '',
    'Result: pass',
    '',
    'Evidence: fixture',
    '',
  ].join('\n');

const laneSBody = (id: string) => LANE_S_BODY + `\n## Scope\n${codeOf(id)}\n`;
const draftText = (t: TicketSpec) => (t.kind === 'lane-s' ? laneTicket(t.id, { lane: 'S', body: laneSBody(t.id) }) : laneTicket(t.id));
const droppedText = (id: string) => laneTicket(id, { frontmatter: ['status: dropped'] }) + '\n## Dropped\nSuperseded by another ticket.\n';

/** The ticket as `accord approve` and `accord gate ready` leave it; a lane S ticket gets its ac_hash from `gate ready`. */
function readyText(t: TicketSpec, config: string): string {
  const files: Files = { 'accord/config.yml': config };
  if (t.kind === 'lane-s') {
    files[P(t.id)] = draftText(t);
    if (gateReadyIn(files, t.id) !== 'pass') throw new Error('lane S fixture ticket does not pass gate ready: ' + t.id);
  } else ready(files, t.id);
  return files[P(t.id)];
}

/** plan.md for the ticket, its plan_hash equal to the body hash core computes, so a passing `gate plan` writes nothing. */
function planText(t: TicketSpec, config: string, baseline: string, missing = false): string {
  let text = PLAN.replaceAll('files: src/export.ts', `files: ${codeOf(t.id)}`);
  if (missing) {
    const at = text.indexOf('## Task 2');
    text = text.slice(0, at) + text.slice(at).replace(`files: ${codeOf(t.id)}`, 'files: src/missing.ts');
  }
  text = text.replace('baseline: abc1234', `baseline: ${baseline}`);
  const files: Files = { 'accord/config.yml': config, [P(t.id)]: readyText(t, config), [recordsOf(t.id).plan]: text };
  const hash = loadSnapshot({ files, tree: Object.keys(files) }).work?.[t.id]?.plan?.bodyHash;
  if (hash === undefined) throw new Error('core read no plan for fixture ticket ' + t.id);
  return text.replace(/plan_hash: "[^"]*"/, `plan_hash: "${hash}"`);
}

interface Build {
  dag: Dag;
  config: string;
  template: string;
  specs: TicketSpec[];
}

const branchOf = (b: Build, id: string) => b.template.replace('{id}', id);

/** One phase of one ticket's history; phase 1 holds what needs the root commit's sha, phase 2 what needs a phase 1 sha. */
function step(b: Build, t: TicketSpec, phase: number): void {
  const { dag, config } = b;
  const id = t.id;
  const r = recordsOf(id);
  const ref = 'refs/heads/' + branchOf(b, id);
  const nm = (s: string) => `${id}-${s}`;
  const add = (name: string, ops: Ops, msg: string, o: { from?: string; merge?: string } = {}) => dag.add(ref, nm(name), { ops, msg, ...o });
  const task = (n: number) => add(`task-${n}`, { [r.ledger]: ledgerText(n), [codeOf(id)]: codeText(id, n) }, `task ${n}: ${id}`);
  const review = (text: string) => add('review', { [r.review]: text }, `review: ${id} converged`);
  const planReady = (baseline: string, missing = false) => add('plan', { [r.plan]: planText(t, config, baseline, missing) }, `plan: ${id} ready`);
  const moveMain = () => {
    const name = dag.add(MAIN, `main-${id}`, { ops: { [`main/${id}.txt`]: `main moved while ${id} was open\n` }, msg: `main: change while ${id} is open` });
    return name;
  };
  const mergeMain = (second: string) =>
    add('merge', dag.delta(second, ROOT_COMMIT), `Merge branch 'main' into ${branchOf(b, id)}`, { merge: second });
  const approve = () => dag.add(ref, nm('approve'), { from: ROOT_COMMIT, ops: { [r.ticket]: readyText(t, config) }, msg: `approve: ${id}` });
  const record = () => {
    const sha = dag.sha(nm('review'));
    const done = t.kind.startsWith('done');
    let text = setFrontmatterKey(readyText(t, config), 'verified_commit', sha);
    if (done) {
      text = setFrontmatterKey(text, 'verified', ['ac-1', 'ac-2']);
      text = setFrontmatterKey(text, 'verified_hash', AC);
    }
    return add('verify', { [r.ticket]: text, [r.verification]: verificationText(id, sha) }, `verify: ${id}`);
  };

  if (phase === 0) {
    if (t.kind === 'intent') return;
    if (t.kind === 'lane-s') {
      dag.add(ref, nm('ready'), { from: ROOT_COMMIT, ops: { [r.ticket]: readyText(t, config) }, msg: `ready: ${id}` });
      add('code', { [codeOf(id)]: codeText(id, 1) }, `change: ${id}`);
      add('review', { [r.review]: REVIEWED }, `review: ${id} converged`);
      return;
    }
    approve();
    return;
  }

  if (phase === 1) {
    switch (t.kind) {
      case 'plan':
        add('plan', { [r.plan]: planText(t, config, dag.sha(ROOT_COMMIT)) }, `plan: ${id} draft`);
        break;
      case 'build-missing-file':
        planReady(dag.sha(ROOT_COMMIT), true);
        task(1);
        break;
      case 'review':
        planReady(dag.sha(ROOT_COMMIT));
        task(1);
        task(2);
        review(UNFINISHED);
        break;
      case 'verify-merged': {
        planReady(dag.sha(ROOT_COMMIT));
        task(1);
        task(2);
        review(REVIEWED);
        mergeMain(moveMain());
        break;
      }
      case 'verify-straight':
        planReady(dag.sha(ROOT_COMMIT));
        task(1);
        task(2);
        review(REVIEWED);
        moveMain();
        break;
      case 'verify-merged-before':
        planReady(dag.sha(ROOT_COMMIT));
        task(1);
        task(2);
        mergeMain(moveMain());
        add('code', { [codeOf(id)]: codeText(id, 3) }, `change: ${id}`);
        review(REVIEWED);
        break;
      case 'done-merged':
      case 'done-squash':
      case 'done-rebased':
      case 'done-extra':
        planReady(dag.sha(ROOT_COMMIT));
        task(1);
        task(2);
        review(REVIEWED);
        break;
      case 'dropped':
        add('code', { [codeOf(id)]: codeText(id, 1) }, `change: ${id}`);
        dag.add(MAIN, nm('drop'), { ops: { [r.ticket]: droppedText(id) }, msg: `drop: ${id}` });
        break;
      default:
        break;
    }
    return;
  }

  switch (t.kind) {
    case 'plan-foreign-baseline': {
      const foreign = b.specs.slice(0, b.specs.indexOf(t)).reverse().find((s) => s.kind === 'plan');
      if (foreign === undefined) throw new Error('plan-foreign-baseline needs an earlier plan ticket in the list');
      planReady(dag.sha(`${foreign.id}-plan`));
      break;
    }
    case 'verify-straight':
      record();
      break;
    case 'done-merged':
      record();
      dag.add(MAIN, nm('merge'), { merge: nm('verify'), ops: dag.delta(nm('verify'), ROOT_COMMIT), msg: `Merge branch '${branchOf(b, id)}'` });
      break;
    case 'done-squash':
      record();
      dag.add(MAIN, nm('squash'), { ops: dag.delta(nm('verify'), ROOT_COMMIT), msg: `${id}: export csv (#${id.replace(/\D/g, '')})` });
      break;
    case 'done-rebased': {
      record();
      for (const s of ['approve', 'plan', 'task-1', 'task-2', 'review', 'verify']) {
        const c = dag.commit(nm(s));
        dag.add(MAIN, nm('replay-' + s), { ops: c.ops, msg: c.msg });
      }
      break;
    }
    case 'done-extra':
      record();
      dag.add(MAIN, nm('squash'), { ops: dag.delta(nm('verify'), ROOT_COMMIT), msg: `${id}: export csv (#${id.replace(/\D/g, '')})` });
      add('extra', { [codeOf(id)]: codeText(id, 4) }, `change after verify: ${id}`);
      break;
    default:
      break;
  }
}

function git(dir: string, ...args: string[]): string {
  return gitRun(dir, ...args);
}

export function buildSample(tickets: TicketSpec[], opts: { template?: string; ahead?: string[] } = {}): Sample {
  const template = opts.template ?? 't/{id}';
  const config = CONFIG + (opts.template === undefined ? '' : `branch: "${opts.template}"\n`);
  const remote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sample-remote-')));
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sample-')));
  const marksDir = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sample-marks-')));
  git(remote, 'init', '--bare', '-q', '-b', 'main');
  git(remote, 'config', 'gc.auto', '0');
  git(remote, 'config', 'receive.autogc', 'false');
  git(root, 'init', '-q', '-b', 'main');
  for (const [k, v] of [
    ['user.email', 'fixture@example.invalid'],
    ['user.name', 'fixture'],
    ['commit.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
    ['gc.auto', '0'],
    ['maintenance.auto', 'false'],
  ]) git(root, 'config', k, v);

  const dag = new Dag(root, join(marksDir, 'marks').replaceAll('\\', '/'), Math.floor(Date.now() / 1000));
  const build: Build = { dag, config, template, specs: tickets };
  const mainFiles: Ops = { 'accord/config.yml': config, [REPORT]: junit({ 'export#writes-csv': 'passed', 'export#escapes-commas': 'passed' }) };
  for (const t of tickets) {
    mainFiles[P(t.id)] = draftText(t);
    mainFiles[codeOf(t.id)] = codeText(t.id, 0);
  }
  dag.add(MAIN, ROOT_COMMIT, { ops: mainFiles, msg: 'init: accord and the draft tickets' });
  for (const phase of [0, 1, 2]) {
    for (const t of tickets) step(build, t, phase);
    dag.flush();
  }

  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-q', 'origin', 'refs/heads/*:refs/heads/*');
  git(root, 'remote', 'set-head', 'origin', 'main');
  git(root, 'reset', '-q', '--hard');
  for (const id of opts.ahead ?? []) {
    const ref = 'refs/heads/' + branchOf(build, id);
    const tip = dag.tip(ref);
    const ledger = recordsOf(id).ledger;
    const before = tip === undefined ? undefined : dag.commit(tip).tree.get(ledger);
    if (before === undefined) throw new Error(`${id} has no ledger to change on its local branch`);
    dag.add(ref, `${id}-ahead`, { ops: { [ledger]: before + '\n## Rulings\n- Ruling: a local commit the pushed branch lacks — fixture — none\n' }, msg: `ledger: ${id} ruling` });
  }
  dag.flush();

  const withMerge = tickets.filter((t) => WITH_MERGE.includes(t.kind)).map((t) => t.id);
  const template0: Clone = {
    root,
    remote,
    sibling: (id) => `${dirname(root)}/${root.split(/[\\/]/).pop()}-${id.toLowerCase()}`,
    git: (...args) => git(root, ...args),
    otherClone: () => {
      throw new Error('a sample has no other clone');
    },
    cleanupAll: () => {},
  };
  return {
    root,
    remote,
    names: dag.names(),
    withMerge,
    shaOf: (name) => dag.sha(name),
    copy() {
      const c = copyClone(template0);
      return {
        root: c.root,
        remote: c.remote,
        worktree(id) {
          const t = tickets.find((x) => x.id === id);
          if (t === undefined || t.kind === 'intent') throw new Error(`${id} has no branch to open a worktree on`);
          const path = c.sibling(id);
          git(c.root, 'worktree', 'add', path, branchOf(build, id));
          return path;
        },
        cleanup: () => c.cleanupAll(),
      };
    },
    cleanup() {
      for (const d of [root, remote, marksDir]) cleanup(d);
    },
  };
}

let built: { mixed: Sample; side: Sample } | undefined;

/** MIXED and SIDE, built once per test file and kept at module level. */
export function prepareSamples(): { mixed: Sample; side: Sample } {
  built ??= { mixed: buildSample(MIXED), side: buildSample(SIDE, { template: 'feature/{id}', ahead: ['F-1'] }) };
  return built;
}

export function samples(): { mixed: Sample; side: Sample } {
  if (built === undefined) throw new Error('call prepareSamples in beforeAll first');
  return built;
}

/** Task 7: the 20 tickets of ac-1. A merge after review: B-6, B-17; before review: B-8, B-19; at verify with none: B-7, B-18. */
export const TWENTY: TicketSpec[] = [
  { id: 'B-1', kind: 'intent' },
  { id: 'B-2', kind: 'plan' },
  { id: 'B-3', kind: 'build-missing-file' },
  { id: 'B-4', kind: 'plan-foreign-baseline' },
  { id: 'B-5', kind: 'review' },
  { id: 'B-6', kind: 'verify-merged' },
  { id: 'B-7', kind: 'verify-straight' },
  { id: 'B-8', kind: 'verify-merged-before' },
  { id: 'B-9', kind: 'done-merged' },
  { id: 'B-10', kind: 'done-squash' },
  { id: 'B-11', kind: 'done-rebased' },
  { id: 'B-12', kind: 'done-extra' },
  { id: 'B-13', kind: 'dropped' },
  { id: 'B-14', kind: 'lane-s' },
  { id: 'B-15', kind: 'plan' },
  { id: 'B-16', kind: 'review' },
  { id: 'B-17', kind: 'verify-merged' },
  { id: 'B-18', kind: 'verify-straight' },
  { id: 'B-19', kind: 'verify-merged-before' },
  { id: 'B-20', kind: 'done-squash' },
];

/** The build of TWENTY and its two one-ticket repositories took 7.4 s on the owner's Windows machine; this is over twenty times that (preamble: at least six). */
export const TWENTY_BUILD_LIMIT = 180_000;

/**
 * The one-ticket repository of ac-1 (D-09): the ticket's branch with the same commits, a merge commit included, and a
 * main that holds the branch's own main commits and only that ticket's file and records, so its stage and its commits
 * after review are the same in both repositories. Branches are named `t/<id>`, as in `buildSample`'s default.
 */
export function oneTicketFrom(sample: Sample, id: string): Sample {
  const branch = `refs/heads/t/${id}`;
  const base = git(sample.root, 'merge-base', branch, MAIN).trim();
  const listed = git(sample.root, 'ls-tree', '-r', '-z', '--name-only', base, '--', 'accord/tickets').split('\0').filter((p) => p !== '');
  const dropped = listed.filter((p) => p !== `accord/tickets/${id}.md` && !p.startsWith(`accord/tickets/${id}/`));
  const ts = Number(git(sample.root, 'show', '-s', '--format=%ct', base).trim()) + 20;

  const remote = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sample-remote-')));
  const root = realpathSync.native(mkdtempSync(join(tmpdir(), 'accord-sample-')));
  git(remote, 'init', '--bare', '-q', '-b', 'main');
  git(remote, 'config', 'gc.auto', '0');
  git(remote, 'config', 'receive.autogc', 'false');
  git(root, 'init', '-q', '-b', 'main');
  for (const [k, v] of [
    ['user.email', 'fixture@example.invalid'],
    ['user.name', 'fixture'],
    ['commit.gpgsign', 'false'],
    ['core.autocrlf', 'false'],
    ['gc.auto', '0'],
    ['maintenance.auto', 'false'],
  ]) git(root, 'config', k, v);

  git(root, 'fetch', '-q', sample.root, `${branch}:${branch}`, `refs/remotes/origin/t/${id}:refs/st-ln-63/origin-tip`);
  const who = `fixture <fixture@example.invalid> ${ts} +0000`;
  const message = `main: only ${id} and its records`;
  const lines = [`commit ${MAIN}`, `author ${who}`, `committer ${who}`, `data ${Buffer.byteLength(message) + 1}`, message, `from ${base}`, ...dropped.map((p) => `D ${p}`), '', ''];
  execFileSync('git', ['fast-import', '--quiet'], { cwd: inSandbox(root), input: Buffer.from(lines.join('\n')), stdio: ['pipe', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 });
  git(root, 'reset', '-q', '--hard');
  git(root, 'remote', 'add', 'origin', remote);
  git(root, 'push', '-q', 'origin', `${MAIN}:${MAIN}`, `refs/st-ln-63/origin-tip:${branch}`);
  git(root, 'update-ref', '-d', 'refs/st-ln-63/origin-tip', git(root, 'rev-parse', branch).trim());
  git(root, 'fetch', '-q', 'origin');
  git(root, 'remote', 'set-head', 'origin', 'main');

  const oneMain = git(root, 'rev-parse', MAIN).trim();
  const template0: Clone = {
    root,
    remote,
    sibling: (other) => `${dirname(root)}/${root.split(/[\\/]/).pop()}-${other.toLowerCase()}`,
    git: (...args) => git(root, ...args),
    otherClone: () => {
      throw new Error('a sample has no other clone');
    },
    cleanupAll: () => {},
  };
  return {
    root,
    remote,
    names: { ...sample.names, [oneMain]: 'one-main' },
    withMerge: sample.withMerge.includes(id) ? [id] : [],
    shaOf: (name) => (name === 'one-main' ? oneMain : sample.shaOf(name)),
    copy() {
      const c = copyClone(template0);
      return {
        root: c.root,
        remote: c.remote,
        worktree(other) {
          if (other !== id) throw new Error(`${other} has no branch in the one-ticket repository of ${id}`);
          const path = c.sibling(id);
          git(c.root, 'worktree', 'add', path, `t/${id}`);
          return path;
        },
        cleanup: () => c.cleanupAll(),
      };
    },
    cleanup() {
      for (const d of [root, remote]) cleanup(d);
    },
  };
}

// ST-LN-50 D-11 (TEAM-02), t2-ac-8: `accord init` detects values from the repository and PRINTS them as
// proposals, one line each with its evidence; it writes none of them. Only `accord config set` writes a value
// (the onboarding skill, plan 03.1-35, asks first). This file is the tracer for one detector, the merge style.
//
// The histories are built with `git commit-tree -F <file>` over the empty tree, so forty commits cost forty
// short processes rather than forty `add`/`commit` rounds, and a message still reaches git through a file,
// never `-m` (conventions.md). Identity and signing come from `-c` flags, never from the host's git config.
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initFiles } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const CONFIG = join('accord', 'config.yml');
const SCAFFOLD_CONFIG = initFiles({ name: pkg.name, version: pkg.version }).find((f) => f.path === 'accord/config.yml')?.text ?? '';

const repos: string[] = [];
afterEach(() => {
  // No retries (owner rule): a sandbox this file made must be removable at once on Windows, so a lingering handle fails here.
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

/** Identity and signing come from `-c` flags, never from the host's git config. */
const IDENTITY = ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false'];

type Shape = 'squash' | 'plain' | 'merge';

/**
 * A repository whose `main` holds `shapes.length` first-parent commits, oldest first: `squash` is a single-parent
 * commit whose subject ends ` (#<n>)`, `plain` a single-parent commit with no suffix, `merge` a merge commit
 * (second parent: one shared side commit, which is not on the first-parent line). No `accord/` folder, no remote.
 */
function history(shapes: Shape[]): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    const tree = gitRun(repo, 'write-tree').trim();
    const commit = (message: string, parents: string[]): string => {
      const file = join(folder, 'msg.txt');
      writeFileSync(file, message + '\n');
      return gitRun(repo, ...IDENTITY, 'commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-F', file).trim();
    };
    const side = commit('side: work on a pull request branch', []);
    let tip: string | undefined;
    shapes.forEach((shape, i) => {
      const n = i + 1;
      const parents = tip === undefined ? [] : [tip];
      // Not conventional-commit subjects: the other detectors (plan 03.1-34) would add a subjects proposal to the output these cases read.
      if (shape === 'merge') tip = commit(`Merge pull request #${n} from team/topic-${n}`, [...parents, side]);
      else tip = commit(shape === 'squash' ? `change ${n} (#${n})` : `change ${n}`, parents);
    });
    if (tip !== undefined) gitRun(repo, 'update-ref', 'refs/heads/main', tip);
    return repo;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

const repeat = (shape: Shape, n: number): Shape[] => Array.from({ length: n }, () => shape);
/** The last two lines init printed: the proposal (or the last file line) and the closing line. */
const tail = (out: string): string[] => out.split('\n').filter((l) => l !== '').slice(-2);
const SQUASH_LINE = 'proposal: git.merge = "squash"  (evidence: 37 of 40 recent commits on main end in (#n))';
const squashHistory = (): string => history([...repeat('plain', 3), ...repeat('squash', 37)]);

describe('accord init proposes values and writes none of them', () => {
  it('risk:complex-branching init proposes the merge style and writes nothing (ST-LN-50 t2-ac-8)', async () => {
    const repo = squashHistory();
    const first = await run(['init'], repo);
    expect(first.code).toBe(0);
    expect(first.err).toBe('');
    // After its file list: the proposal with its evidence in numbers, then the count and that none was written.
    expect(tail(first.out)).toEqual([SQUASH_LINE, 'proposals: 1, none written to accord/config.yml; type /accord onboard to confirm them one by one']);
    // Nothing written: the new config.yml is the scaffold, byte for byte.
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toBe(SCAFFOLD_CONFIG);
    // A second run prints the same proposal and leaves the config byte-identical.
    const second = await run(['init'], repo);
    expect(second.code).toBe(0);
    expect(tail(second.out)).toEqual([SQUASH_LINE, 'proposals: 1, none written to accord/config.yml; type /accord onboard to confirm them one by one']);
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toBe(SCAFFOLD_CONFIG);
  });

  it('risk:boundary a repository with too little history gets no merge-style proposal (ST-LN-50 t2-ac-8)', async () => {
    const repo = history(repeat('squash', 6));
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(out).not.toContain('proposal: git.merge');
    expect(tail(out).at(-1)).toBe('proposals: 0');
  });

  it('risk:boundary a mixed history with no shape at 60 percent gets no merge-style proposal (ST-LN-50 t2-ac-8)', async () => {
    const repo = history([...repeat('plain', 20), ...repeat('squash', 20)]);
    const { out } = await run(['init'], repo);
    expect(out).not.toContain('proposal: git.merge');
    expect(tail(out).at(-1)).toBe('proposals: 0');
  });

  it('risk:complex-branching merge commits on the first-parent line propose merge (ST-LN-50 t2-ac-8)', async () => {
    const repo = history([...repeat('plain', 10), ...repeat('merge', 30)]);
    const { code, out } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(tail(out)).toEqual([
      'proposal: git.merge = "merge"  (evidence: 30 of 40 recent commits on main are merge commits)',
      'proposals: 1, none written to accord/config.yml; type /accord onboard to confirm them one by one',
    ]);
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toBe(SCAFFOLD_CONFIG);
  });

  it('risk:regression the printed value is one `accord config set` accepts (ST-LN-50 t2-ac-8)', async () => {
    const repo = squashHistory();
    const { out } = await run(['init'], repo);
    const printed = /^proposal: (git\.merge) = (.*?) {2}\(evidence: /m.exec(out);
    expect(printed).not.toBeNull();
    const value = JSON.parse(printed?.[2] as string) as string;
    const set = await run(['config', 'set', 'git.merge', value], repo);
    expect(set.err).toBe('');
    expect(set.code).toBe(0);
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toContain('squash');
  });

  it('risk:regression the value exactly as the proposal printed it, JSON quotes included, is one `accord config set` accepts (the onboard skill step 4)', async () => {
    const repo = squashHistory();
    const { out } = await run(['init'], repo);
    const printed = /^proposal: (git\.merge) = (.*?) {2}\(evidence: /m.exec(out);
    expect(printed).not.toBeNull();
    expect(printed?.[2]).toBe('"squash"');
    const set = await run(['config', 'set', 'git.merge', printed?.[2] as string], repo);
    expect(set.err).toBe('');
    expect(set.code).toBe(0);
    expect(set.out).toBe('changed: git.merge unset -> squash\n');
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toContain('merge: squash');
    expect(readFileSync(join(repo, CONFIG), 'utf8')).not.toContain('"squash"');
  });
});

interface Build {
  /** first-parent commits, oldest first, every one single-parent over one shared tree */
  subjects: string[];
  /** a message body per commit index */
  bodies?: Record<number, string>;
  /** tracked files (repo-relative posix path to text), staged into the shared tree */
  files?: Record<string, string>;
  /** extra local branches, all at the tip */
  branches?: string[];
}

/** A repository whose `main` holds `subjects` as single-parent commits; files are tracked, branches point at the tip. No `accord/` folder, no remote. */
function build({ subjects, bodies = {}, files = {}, branches = [] }: Build): string {
  const repo = makeEmptyRepo();
  repos.push(repo);
  const folder = mkdtempSync(join(tmpdir(), 'accord-msg-'));
  try {
    gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    writeFiles(repo, files);
    if (Object.keys(files).length > 0) gitRun(repo, 'add', '--', ...Object.keys(files));
    const tree = gitRun(repo, 'write-tree').trim();
    let tip = '';
    subjects.forEach((subject, i) => {
      const file = join(folder, 'msg.txt');
      writeFileSync(file, subject + (bodies[i] === undefined ? '' : '\n\n' + bodies[i]) + '\n');
      tip = gitRun(repo, ...IDENTITY, 'commit-tree', tree, ...(tip === '' ? [] : ['-p', tip]), '-F', file).trim();
    });
    if (tip !== '') gitRun(repo, 'update-ref', 'refs/heads/main', tip);
    for (const b of branches) gitRun(repo, 'update-ref', `refs/heads/${b}`, tip);
    return repo;
  } finally {
    rmSync(folder, { recursive: true, force: true });
  }
}

/** Every line init printed that belongs to the proposal contract. */
const proposalLines = (out: string): string[] => out.split('\n').filter((l) => l.startsWith('proposal: ') || l.startsWith('proposals: '));
const CLOSING = 'proposals: 1, none written to accord/config.yml; type /accord onboard to confirm them one by one';
const plain = (n: number): string[] => Array.from({ length: n }, (_, i) => `change ${i + 1}`);

const SUBJECTS_PROPOSED = {
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
};

describe('accord init proposes the other conventions (ST-LN-50 t2-ac-8)', () => {
  it('risk:complex-branching init proposes every detected convention and writes none (ST-LN-50 t2-ac-8)', async () => {
    // 38 conventional squash commits that name a ticket key, 2 plain squash commits; 8 ticket branches; commitlint; a Linear link.
    const subjects = Array.from({ length: 40 }, (_, i) => (i < 38 ? `feat(api): ENG-${i + 1} add export ${i + 1} (#${i + 1})` : `update docs (#${i + 1})`));
    const repo = build({
      subjects,
      branches: Array.from({ length: 8 }, (_, i) => `feature/ENG-${i + 1}`),
      files: {
        'commitlint.config.cjs': "module.exports = { extends: ['@commitlint/config-conventional'] };\n",
        'README.md': '# Acme\n\nIssues live in https://linear.app/acme/issue/ENG-3 for now.\n',
      },
    });
    const { code, out, err } = await run(['init'], repo);
    expect(code).toBe(0);
    expect(err).toBe('');
    const lines = proposalLines(out);
    expect(lines).toEqual([
      'proposal: git.merge = "squash"  (evidence: 40 of 40 recent commits on main end in (#n))',
      `proposal: commits.subjects = ${JSON.stringify(SUBJECTS_PROPOSED)}  (evidence: 38 of 40 recent commits are type(scope): text; commitlint.config.cjs is present)`,
      'proposal: branch = "feature/{id}"  (evidence: 8 of 8 branches other than main are named feature/<ticket key>)',
      'proposal: ids = {"mode":"tracker","projects":["ENG"]}  (evidence: 38 of 40 recent commits and 8 of 8 branches carry a ticket key (ENG))',
      'proposal: tracker = {"adapter":"linear"}  (evidence: 1 linear.app link in README.md)',
      'proposals: 5, none written to accord/config.yml; type /accord onboard to confirm them one by one',
    ]);
    // Nothing written: the config is the scaffold, byte for byte.
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toBe(SCAFFOLD_CONFIG);
    // Each printed key and value, as printed, is accepted by `accord config set` in a copy of the repository.
    const copy = mkdtempSync(join(tmpdir(), 'accord-copy-'));
    repos.push(copy);
    cpSync(repo, copy, { recursive: true });
    for (const line of lines.slice(0, -1)) {
      const m = /^proposal: (\S+) = (.*?) {2}\(evidence: /.exec(line);
      expect(m).not.toBeNull();
      const value = JSON.parse(m?.[2] as string) as unknown;
      const set = await run(['config', 'set', m?.[1] as string, typeof value === 'string' ? value : JSON.stringify(value)], copy);
      expect({ key: m?.[1], err: set.err, code: set.code }).toEqual({ key: m?.[1], err: '', code: 0 });
    }
  });

  it('risk:boundary a Jira link in the README proposes the jira adapter with its url (ST-LN-50 t2-ac-8)', async () => {
    const repo = build({ subjects: plain(3), files: { 'README.md': 'Work is tracked in https://acme.atlassian.net/browse/OPS-2 .\n' } });
    const { out } = await run(['init'], repo);
    expect(proposalLines(out)).toEqual(['proposal: tracker = {"adapter":"jira","url":"https://acme.atlassian.net"}  (evidence: 1 atlassian.net link in README.md)', CLOSING]);
    const copy = mkdtempSync(join(tmpdir(), 'accord-copy-'));
    repos.push(copy);
    cpSync(repo, copy, { recursive: true });
    const set = await run(['config', 'set', 'tracker', '{"adapter":"jira","url":"https://acme.atlassian.net"}'], copy);
    expect({ err: set.err, code: set.code }).toEqual({ err: '', code: 0 });
  });

  it('risk:boundary a link in a commit message proposes the tracker too (ST-LN-50 t2-ac-8)', async () => {
    const repo = build({ subjects: plain(3), bodies: { 1: 'Closes https://linear.app/acme/issue/ENG-9' } });
    const { out } = await run(['init'], repo);
    expect(proposalLines(out)).toEqual(['proposal: tracker = {"adapter":"linear"}  (evidence: 1 linear.app link in commit messages)', CLOSING]);
  });

  it('risk:boundary a repository with 3 branches gets no branch or ids proposal (ST-LN-50 t2-ac-8)', async () => {
    const repo = build({ subjects: plain(12), branches: ['feature/ENG-1', 'feature/ENG-2', 'feature/ENG-3'] });
    const { out } = await run(['init'], repo);
    expect(proposalLines(out)).toEqual(['proposals: 0']);
  });

  it('risk:boundary conventional subjects below 60 percent, with no commitlint, give no subjects proposal (ST-LN-50 t2-ac-8)', async () => {
    // One subject carries a terminal escape: no evidence line may repeat repository text.
    const subjects = [...Array.from({ length: 20 }, (_, i) => `fix: change ${i + 1}`), ...plain(19), 'change \u001b[2J'];
    const repo = build({ subjects });
    const { out } = await run(['init'], repo);
    expect(proposalLines(out)).toEqual(['proposals: 0']);
    expect(out).not.toContain('\u001b');
  });

  it('risk:boundary a commitlint config alone is evidence, and a scope-enum without accord is named (ST-LN-50 t2-ac-8)', async () => {
    const repo = build({
      subjects: plain(6),
      files: { 'commitlint.config.js': "module.exports = { rules: { 'scope-enum': [2, 'always', ['api', 'web']] } };\n" },
    });
    const { out } = await run(['init'], repo);
    expect(proposalLines(out)).toEqual([
      `proposal: commits.subjects = ${JSON.stringify(SUBJECTS_PROPOSED)}  (evidence: commitlint.config.js is present and its scope-enum does not list accord)`,
      CLOSING,
    ]);
  });

  it('risk:boundary a commitlint key in package.json is evidence (ST-LN-50 t2-ac-8)', async () => {
    const repo = build({ subjects: plain(6), files: { 'package.json': '{"name":"acme","commitlint":{"extends":["@commitlint/config-conventional"]}}\n' } });
    const { out } = await run(['init'], repo);
    expect(proposalLines(out)).toEqual([
      `proposal: commits.subjects = ${JSON.stringify(SUBJECTS_PROPOSED)}  (evidence: package.json has a commitlint key)`,
      CLOSING,
    ]);
  });

  it('risk:boundary a file is read only up to 1 MiB (ST-LN-50 t2-ac-8)', async () => {
    const link = '\nhttps://acme.atlassian.net/browse/OPS-2\n';
    const past = build({ subjects: plain(3), files: { 'README.md': 'x'.repeat(1024 * 1024) + link } });
    expect(proposalLines((await run(['init'], past)).out)).toEqual(['proposals: 0']);
    const within = build({ subjects: plain(3), files: { 'README.md': 'x'.repeat(1024 * 1024 - 100) + link } });
    expect(proposalLines((await run(['init'], within)).out)).toHaveLength(2);
  });

  it('risk:regression no detector reaches the network (ST-LN-50 t2-ac-8)', () => {
    const source = readFileSync(new URL('../src/load/detect.ts', import.meta.url), 'utf8');
    expect(source).not.toMatch(/from 'node:(?:http|https|http2|net|tls|dns|dgram)'|\bfetch\(|XMLHttpRequest/);
  });
});

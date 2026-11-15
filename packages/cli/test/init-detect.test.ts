// ST-LN-50 D-11 (TEAM-02), t2-ac-8: `accord init` detects values from the repository and PRINTS them as
// proposals, one line each with its evidence; it writes none of them. Only `accord config set` writes a value
// (the onboarding skill, plan 03.1-35, asks first). This file is the tracer for one detector, the merge style.
//
// The histories are built with `git commit-tree -F <file>` over the empty tree, so forty commits cost forty
// short processes rather than forty `add`/`commit` rounds, and a message still reaches git through a file,
// never `-m` (conventions.md). Identity and signing come from `-c` flags, never from the host's git config.
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { initFiles } from '@accord-dev/accord-core';
import { afterEach, describe, expect, it } from 'vitest';
import pkg from '../package.json' with { type: 'json' };
import { gitRun, makeEmptyRepo, run } from './helpers/repo.js';

const CONFIG = join('accord', 'config.yml');
const SCAFFOLD_CONFIG = initFiles({ name: pkg.name, version: pkg.version }).find((f) => f.path === 'accord/config.yml')?.text ?? '';

const repos: string[] = [];
afterEach(() => {
  // No retries (owner rule): a sandbox this file made must be removable at once on Windows, so a lingering handle fails here.
  while (repos.length > 0) rmSync(repos.pop() as string, { recursive: true, force: true });
});

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
    const identity = ['-c', 'user.email=fixture@example.invalid', '-c', 'user.name=fixture', '-c', 'commit.gpgsign=false'];
    gitRun(repo, 'symbolic-ref', 'HEAD', 'refs/heads/main');
    const tree = gitRun(repo, 'write-tree').trim();
    const commit = (message: string, parents: string[]): string => {
      const file = join(folder, 'msg.txt');
      writeFileSync(file, message + '\n');
      return gitRun(repo, ...identity, 'commit-tree', tree, ...parents.flatMap((p) => ['-p', p]), '-F', file).trim();
    };
    const side = commit('side: work on a pull request branch', []);
    let tip: string | undefined;
    shapes.forEach((shape, i) => {
      const n = i + 1;
      const parents = tip === undefined ? [] : [tip];
      if (shape === 'merge') tip = commit(`Merge pull request #${n} from team/topic-${n}`, [...parents, side]);
      else tip = commit(shape === 'squash' ? `fix: change ${n} (#${n})` : `fix: change ${n}`, parents);
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
    expect(tail(first.out)).toEqual([SQUASH_LINE, 'proposals: 1, none written to accord/config.yml']);
    // Nothing written: the new config.yml is the scaffold, byte for byte.
    expect(readFileSync(join(repo, CONFIG), 'utf8')).toBe(SCAFFOLD_CONFIG);
    // A second run prints the same proposal and leaves the config byte-identical.
    const second = await run(['init'], repo);
    expect(second.code).toBe(0);
    expect(tail(second.out)).toEqual([SQUASH_LINE, 'proposals: 1, none written to accord/config.yml']);
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
      'proposals: 1, none written to accord/config.yml',
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
});

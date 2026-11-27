// Phase 11 plan 04 (11-ac-5, D-04, D-05): `accord review-package` prints `## Team lenses`, the list of lenses to dispatch, decided from config, files and git alone. Real git in temporary sandboxes.
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { builtInTools, ONE_TOOLS_TASK, plannedTools } from './helpers/repos-build.js';
import { reposCopy, useRepoSandboxes } from './helpers/repos.js';

useRepoSandboxes();

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const DB = '---\npaths: [src/db/]\non_finding: warn\n---\n\n- Every query uses parameters.\n';
const DB_SECTION = '## Team lenses\n\n### Lens db\non_finding: warn; paths: src/db/; dispatch accord-reviewer with lens db\n\n- Every query uses parameters.';

function identity(repo: string): void {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
}

/** The text of `## Team lenses` up to the next `## ` heading; undefined when the package has none. */
const section = (out: string): string | undefined => {
  const at = out.indexOf('## Team lenses');
  if (at < 0) return undefined;
  const next = out.indexOf('\n## ', at + 1);
  return out.slice(at, next < 0 ? undefined : next).trimEnd();
};

interface Box {
  repo: string;
  /** The default branch's commit the plan's baseline names. */
  base: string;
}

/** main holds the config, T-1 (lane `lane`, M by default) and `lenses`; the checkout is left on main. */
function sandbox(lenses: Record<string, string>, lane = 'M'): Box {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  identity(repo);
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1', { lane }),
    'src/run.ts': 'export const one = 1;\n',
    ...Object.fromEntries(Object.entries(lenses).map(([name, text]) => [`accord/lenses/${name}.md`, text])),
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  return { repo, base };
}

/** A lane M branch from main's tip that records the plan and changes `files`. */
function branch(box: Box, files: Record<string, string>): void {
  gitRun(box.repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(box.repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', box.base), ...files });
  commitMsg(box.repo, 'plan and code');
}

it('risk:regression a lens on the default branch is printed with its mode, paths and checklist for a round-1 package that touches its paths (11-ac-5, D-04, D-05)', async () => {
  const box = sandbox({ db: DB });
  branch(box, { 'src/db/x.ts': 'export const q = 1;\n' });
  const r = await run(['review-package', 'T-1', '--out', 'package-1.md'], box.repo);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  const text = readFileSync(join(box.repo, '.accord-reports', 'T-1', 'package-1.md'), 'utf8');
  expect(section(text)).toBe(DB_SECTION);
  // the section sits right after the security triggers, and no lens text carries a backslash
  expect(text.indexOf('## Security triggers')).toBeLessThan(text.indexOf('## Team lenses'));
  expect(text.indexOf('## Team lenses')).toBeLessThan(text.indexOf('## Slop'));
  expect(section(text)).not.toContain('\\');
}, 120_000);

it('risk:regression a lens whose paths the diff does not touch is not printed: the section holds (none) (11-ac-5, D-05)', async () => {
  const box = sandbox({ db: DB });
  branch(box, { 'src/ui/a.ts': 'export const a = 1;\n' });
  const r = await run(['review-package', 'T-1'], box.repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(section(r.out)).toBe('## Team lenses\n\n(none)');
}, 120_000);

const EVERY = '---\non_finding: block\n---\n\n- Every change names its rollback.\n';
const EVERY_SECTION = '## Team lenses\n\n### Lens every\non_finding: block; paths: every lane M ticket; dispatch accord-reviewer with lens every\n\n- Every change names its rollback.';
const LATER = '## Team lenses\n\n(none: later rounds re-check the fixes of the lenses round 1 and the final review ran)';

it('risk:regression a lens with no paths is printed in the round-1 package and the final-review package of a lane M and a lane L ticket, and never for lane S (11-ac-5, D-04)', async () => {
  for (const lane of ['M', 'L']) {
    const box = sandbox({ every: EVERY }, lane);
    branch(box, { 'src/ui/a.ts': 'export const a = 1;\n' });
    const first = await run(['review-package', 'T-1'], box.repo);
    expect(first.code, first.out + first.err).toBe(0);
    expect(section(first.out), lane).toBe(EVERY_SECTION);
    const final = await run(['review-package', 'T-1', '--base', box.base], box.repo);
    expect(final.code, final.out + final.err).toBe(0);
    expect(section(final.out), lane).toBe(EVERY_SECTION);
  }

  // lane S: the base is the default branch, and the package has no lens section at all
  const repo = makeEmptyRepo();
  dirs.push(repo);
  identity(repo);
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }), 'src/run.ts': 'export const one = 1;\n', 'accord/lenses/every.md': EVERY });
  commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/S-1');
  writeFiles(repo, { 'src/run.ts': 'export const one = 2;\n' });
  commitMsg(repo, 'change');
  const s = await run(['review-package', 'S-1'], repo);
  expect(s.code, s.out + s.err).toBe(0);
  expect(s.out).not.toContain('## Team lenses');
}, 180_000);

it('risk:regression a repository with no lens file prints no ## Team lenses section, so its package is what it was before lenses existed (11-ac-5, D-04)', async () => {
  const box = sandbox({});
  branch(box, { 'src/db/x.ts': 'export const q = 1;\n' });
  const r = await run(['review-package', 'T-1'], box.repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(r.out).not.toContain('Team lenses');
}, 120_000);

it('risk:regression a package after a recorded round names no lens, and the final review of the whole ticket names the lens the fix touched (11-ac-5, D-04)', async () => {
  const box = sandbox({ db: DB });
  // round 1 touched only src/ui/; its fix touched src/db/
  branch(box, { 'src/ui/a.ts': 'export const a = 1;\n' });
  const one = gitRun(box.repo, 'rev-parse', 'HEAD').trim();
  const first = await run(['review-package', 'T-1'], box.repo);
  expect(section(first.out)).toBe('## Team lenses\n\n(none)');
  writeFiles(box.repo, { 'accord/tickets/T-1/review.md': `Round record: 2\n\n## Round 1 head ${one}\n\nNo findings\n\nSecurity: no pattern matched\n\nverdict: converged\n` });
  commitMsg(box.repo, 'review: round 1');
  writeFiles(box.repo, { 'src/db/x.ts': 'export const q = 1;\n' });
  commitMsg(box.repo, 'fix');

  const next = await run(['review-package', 'T-1'], box.repo);
  expect(next.code, next.out + next.err).toBe(0);
  expect(next.out).toContain('src/db/x.ts');
  expect(section(next.out)).toBe(LATER);
  expect(next.out).not.toContain('### Lens db');

  const final = await run(['review-package', 'T-1', '--base', box.base], box.repo);
  expect(final.code, final.out + final.err).toBe(0);
  expect(section(final.out)).toBe(DB_SECTION);
}, 180_000);

const SLICES = ['## Slice 1: Writer', 'tasks: 1', 'covers: @ac-1', '', '## Slice 2: Escaping', 'tasks: 2', 'covers: @ac-2', '', '## Slice 3: Docs', 'tasks: 2', 'covers: @ac-2', ''].join('\n');

it("risk:regression a slice package matches that slice's own diff, and the final review of the last slice matches the whole ticket (11-ac-5, Lens Ruling)", async () => {
  // slice 1 (t/T-1) changes src/db/, slices 2 and 3 only src/ui/
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/lenses/db.md': DB });
  dirs.push(repo);
  identity(repo);
  const base = commitAll(repo);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', base);
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('baseline: abc1234', `baseline: ${base}`) + SLICES });
  commitMsg(repo, 'plan: T-1');
  writeFiles(repo, { 'src/db/one.ts': 'export const one = 1;\n' });
  commitMsg(repo, 'feat: slice one');
  gitRun(repo, 'switch', '-q', '-c', 'slice/T-1/2');
  writeFiles(repo, { 'src/ui/two.ts': 'export const two = 2;\n' });
  commitMsg(repo, 'feat: slice two');
  gitRun(repo, 'switch', '-q', '-c', 'slice/T-1/3');
  writeFiles(repo, { 'src/ui/three.ts': 'export const three = 3;\n' });
  commitMsg(repo, 'feat: slice three');

  // slice 3 on its own diff: no db lens, though slice 1 changed src/db/
  const three = await run(['review-package', 'T-1'], repo);
  expect(three.code, three.out + three.err).toBe(0);
  expect(three.out).toContain('src/ui/three.ts');
  expect(three.out).not.toContain('src/db/one.ts');
  expect(section(three.out)).toBe('## Team lenses\n\n(none)');
  // the final review of the last slice reads the whole ticket from the plan's baseline
  const final = await run(['review-package', 'T-1', '--base', base], repo);
  expect(final.code, final.out + final.err).toBe(0);
  expect(section(final.out)).toBe(DB_SECTION);
  // slice 1, on the claim branch, reads from the baseline and names the lens
  gitRun(repo, 'switch', '-q', 't/T-1');
  const one = await run(['review-package', 'T-1'], repo);
  expect(one.code, one.out + one.err).toBe(0);
  expect(section(one.out)).toBe(DB_SECTION);
}, 180_000);

it('risk:regression a <name>:<path> entry matches the ## Repository <name> diff of that repository, and a plain entry never matches another repository (11-ac-5, Lens Ruling)', async () => {
  const r = reposCopy();
  writeFiles(r.svc, {
    'accord/lenses/tools-src.md': '---\npaths: [tools:src/]\n---\n\n- Tools check.\n',
    'accord/lenses/tools-docs.md': '---\npaths: [tools:docs/]\n---\n\n- Tools docs.\n',
    'accord/lenses/plain-src.md': '---\npaths: [src/]\n---\n\n- Plain src.\n',
    'accord/lenses/plain-docs.md': '---\npaths: [docs/]\n---\n\n- Plain docs.\n',
  });
  commitAll(r.svc);
  r.git(r.svc, 'push', '-q', 'origin', 'main');
  await plannedTools(r, ONE_TOOLS_TASK);
  await builtInTools(r);
  // this repository changes docs/ only; tools changed src/Tools.cs
  writeFiles(r.svc, { 'docs/a.md': 'a\n' });
  commitAll(r.svc);
  const res = await run(['review-package', 'ST-9'], r.svc);
  expect(res.code, res.out + res.err).toBe(0);
  expect(res.out).toContain('## Repository tools');
  const text = section(res.out) as string;
  expect(text).toContain('### Lens plain-docs');
  expect(text).toContain('### Lens tools-src\non_finding: ask; paths: tools:src/; dispatch accord-reviewer with lens tools-src');
  expect(text).not.toContain('### Lens tools-docs');
  expect(text).not.toContain('### Lens plain-src');
  expect(text.indexOf('### Lens plain-docs')).toBeLessThan(text.indexOf('### Lens tools-src'));
  expect(text).not.toContain('\\');
}, 240_000);

it("risk:security the default branch's copy of a lens decides: a branch that edits or deletes one still gets it, a lens only the branch adds is named and not run, and a link is never read (11-ac-5, Ruling R4)", async () => {
  const box = sandbox({ db: DB, gone: '---\non_finding: block\n---\n\n- Gone check.\n' });
  // a link at the default branch: mode 120000, its blob the text of a target
  const scratch = mkdtempSync(join(tmpdir(), 'accord-lens-'));
  try {
    writeFileSync(join(scratch, 'target.txt'), 'db.md');
    const oid = gitRun(box.repo, 'hash-object', '-w', join(scratch, 'target.txt')).trim();
    gitRun(box.repo, 'update-index', '--add', '--cacheinfo', `120000,${oid},accord/lenses/link.md`);
    writeFileSync(join(scratch, 'msg.txt'), 'a link\n');
    gitRun(box.repo, 'commit', '-q', '-F', join(scratch, 'msg.txt'), '--cleanup=verbatim');
  } finally {
    cleanup(scratch);
  }
  const base = gitRun(box.repo, 'rev-parse', 'HEAD').trim();
  gitRun(box.repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(box.repo, {
    'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base),
    'src/db/x.ts': 'export const q = 1;\n',
    'accord/lenses/db.md': '---\npaths: [nothing/]\n---\n\n- Edited on the branch.\n',
    'accord/lenses/extra.md': '- Only on the branch.\n',
  });
  gitRun(box.repo, 'rm', '-q', 'accord/lenses/gone.md');
  commitMsg(box.repo, 'plan, code and lens edits');

  const r = await run(['review-package', 'T-1'], box.repo);
  expect(r.code, r.out + r.err).toBe(0);
  const text = section(r.out) as string;
  // db: the default copy's paths and body, not the branch's edit; gone: still run though the branch deleted it
  expect(text).toContain('### Lens db\non_finding: warn; paths: src/db/; dispatch accord-reviewer with lens db\n\n- Every query uses parameters.');
  expect(text).not.toContain('Edited on the branch');
  expect(text).toContain('### Lens gone\non_finding: block; paths: every lane M ticket; dispatch accord-reviewer with lens gone');
  // extra: only on the branch, so named and not run
  expect(text).not.toContain('### Lens extra');
  expect(text).not.toContain('Only on the branch');
  expect(text).toContain('branch only, applies after merge: extra');
  // the link is never read, and is not reported as a file the branch added
  expect(text).not.toContain('### Lens link');
  expect(text).not.toContain('branch only, applies after merge: link');
  expect(text).not.toContain('\\');
}, 180_000);

it('risk:regression with no default branch the lenses of the checkout are read and the section says so (11-ac-5, Ruling R4)', async () => {
  const box = sandbox({ db: DB });
  // no origin, and the only branch is neither main nor master
  gitRun(box.repo, 'branch', '-M', 'trunk');
  branch(box, { 'src/db/x.ts': 'export const q = 1;\n' });
  const r = await run(['review-package', 'T-1'], box.repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(section(r.out)).toBe(DB_SECTION + '\n\n(read from this checkout: no default branch)');
}, 120_000);

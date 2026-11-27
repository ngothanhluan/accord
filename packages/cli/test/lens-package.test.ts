// Phase 11 plan 04 (11-ac-5, D-04, D-05): `accord review-package` prints `## Team lenses`, the list of lenses to dispatch, decided from config, files and git alone. Real git in temporary sandboxes.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { CONFIG, laneTicket, PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

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

/** main holds the config, T-1 (lane M) and `lenses`; the checkout is left on main. */
function sandbox(lenses: Record<string, string>): Box {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  identity(repo);
  writeFiles(repo, {
    'accord/config.yml': CONFIG,
    'accord/tickets/T-1.md': laneTicket('T-1'),
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

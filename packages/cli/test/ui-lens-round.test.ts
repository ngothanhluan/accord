// Phase 11 G3 (D-07, D-08, 11-ac-9): the review package of a `ui: true` lane M, L or P ticket prints the built-in `ui` lens under `## Team lenses` in round 1 and in the final review, with the D-08 checklist,
// and names `accord-reviewer-ui` when `ui.review` is set; a `ui: false` ticket and a lane S ticket print none. Real git in temporary sandboxes.
// Skill-name form (11-A2-PROBE.md, `Use: both`): each case that names a real skill runs with the bare name and with the plugin name.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { UI_LENS } from '@accord-dev/accord-core';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const FORMS = ['impeccable', 'impeccable:impeccable'] as const;
const DB = '---\npaths: [src/db/]\non_finding: warn\n---\n\n- Every query uses parameters.\n';
const DB_BLOCK = '### Lens db\non_finding: warn; paths: src/db/; dispatch accord-reviewer with lens db\n\n- Every query uses parameters.';
const PLAIN_LINE = 'on_finding: block; on every ui: true ticket; dispatch accord-reviewer with lens ui and the checklist below';
const MAPPED_LINE = 'on_finding: block; on every ui: true ticket; dispatch accord-reviewer-ui with lens ui: its review skill judges the craft, and the checklist below stays its contract';
const uiBlock = (line: string): string => `## Team lenses\n\n### Lens ui (built in)\n${line}\n\n${UI_LENS.body.trim()}`;
const LATER = '## Team lenses\n\n(none: later rounds re-check the fixes of the lenses round 1 and the final review ran)';

const identity = (repo: string): void => {
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
};

/** The text of `## Team lenses` up to the next `## ` heading; undefined when the package has none. */
const section = (out: string): string | undefined => {
  const at = out.indexOf('## Team lenses');
  if (at < 0) return undefined;
  const next = out.indexOf('\n## ', at + 1);
  return out.slice(at, next < 0 ? undefined : next).trimEnd();
};

interface Box {
  repo: string;
  base: string;
}

/** main holds the config (`ui` is the text appended to it), T-1 (lane `lane`, `ui: true` unless `isUi` is false) and `lenses`; a branch then changes `files`, so the checkout is on t/T-1. */
function sandbox(o: { ui?: string; isUi?: boolean; lane?: string; lenses?: Record<string, string>; files?: Record<string, string> } = {}): Box {
  const lane = o.lane ?? 'M';
  const repo = makeEmptyRepo();
  dirs.push(repo);
  identity(repo);
  const ticket = laneTicket('T-1', lane === 'S' ? { lane, body: LANE_S_BODY } : { lane });
  writeFiles(repo, {
    'accord/config.yml': CONFIG + (o.ui ?? ''),
    'accord/tickets/T-1.md': o.isUi === false ? ticket : ticket.replace('ui: false', 'ui: true'),
    'src/run.ts': 'export const one = 1;\n',
    ...Object.fromEntries(Object.entries(o.lenses ?? {}).map(([name, text]) => [`accord/lenses/${name}.md`, text])),
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  writeFiles(repo, { ...(lane === 'S' ? {} : { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base) }), ...(o.files ?? { 'src/a.ts': 'export const a = 1;\n' }) });
  commitMsg(repo, 'plan and code');
  return { repo, base };
}

it('risk:regression a ui: true lane M ticket with no lens file and no ui.review prints the built-in ui lens with its checklist for the plain reviewer (11-ac-9, D-08)', async () => {
  const box = sandbox();
  const r = await run(['review-package', 'T-1', '--out', 'package-1.md'], box.repo);
  expect(r.err).toBe('');
  expect(r.code).toBe(0);
  const text = readFileSync(join(box.repo, '.accord-reports', 'T-1', 'package-1.md'), 'utf8');
  expect(section(text)).toBe(uiBlock(PLAIN_LINE));
  expect(section(text)).toContain('narrow width');
  expect(text.indexOf('## Security triggers')).toBeLessThan(text.indexOf('## Team lenses'));
  expect(text.indexOf('## Team lenses')).toBeLessThan(text.indexOf('## Slop'));
  expect(section(text)).not.toContain('\\');
  // the final review of the whole ticket prints it as well
  const final = await run(['review-package', 'T-1', '--base', box.base], box.repo);
  expect(final.code, final.out + final.err).toBe(0);
  expect(section(final.out)).toBe(uiBlock(PLAIN_LINE));
}, 180_000);

for (const form of FORMS) {
  it(`risk:regression ui.review ${form} makes the ui lens line say dispatch accord-reviewer-ui, its skill judging the craft and the checklist staying the contract (11-ac-9, D-07)`, async () => {
    const box = sandbox({ ui: `ui:\n  review: ${form}\n` });
    const r = await run(['review-package', 'T-1'], box.repo);
    expect(r.code, r.out + r.err).toBe(0);
    expect(section(r.out)).toBe(uiBlock(MAPPED_LINE));
    // the skill is never named in the package: the role is
    expect(r.out).not.toContain(form);
  }, 120_000);
}

it('risk:regression a ui: false ticket prints no ui lens, a lane S ticket no section, and a later round the later-rounds line (11-ac-9, D-08)', async () => {
  const plain = sandbox({ isUi: false });
  const none = await run(['review-package', 'T-1'], plain.repo);
  expect(none.code, none.out + none.err).toBe(0);
  expect(none.out).not.toContain('Team lenses');
  expect(none.out).not.toContain('Lens ui');

  // with a team lens only that one is printed for a ui: false ticket
  const team = sandbox({ isUi: false, lenses: { db: DB }, files: { 'src/db/x.ts': 'export const q = 1;\n' } });
  const only = await run(['review-package', 'T-1'], team.repo);
  expect(section(only.out)).toBe(`## Team lenses\n\n${DB_BLOCK}`);

  const s = sandbox({ lane: 'S' });
  const lane = await run(['review-package', 'T-1'], s.repo);
  expect(lane.code, lane.out + lane.err).toBe(0);
  expect(lane.out).not.toContain('## Team lenses');

  // a package after a recorded round re-checks the fixes and names no lens
  const box = sandbox();
  const one = gitRun(box.repo, 'rev-parse', 'HEAD').trim();
  writeFiles(box.repo, { 'accord/tickets/T-1/review.md': `Round record: 2\n\n## Round 1 head ${one}\n\nNo findings\n\nSecurity: no pattern matched\n\nLens: ui ran\n\nverdict: converged\n` });
  commitMsg(box.repo, 'review: round 1');
  writeFiles(box.repo, { 'src/b.ts': 'export const b = 1;\n' });
  commitMsg(box.repo, 'fix');
  const later = await run(['review-package', 'T-1'], box.repo);
  expect(later.code, later.out + later.err).toBe(0);
  expect(section(later.out)).toBe(LATER);
  expect(later.out).not.toContain('### Lens ui');
}, 300_000);

it('risk:regression the ui lens comes before the team lenses and the team lens keeps its own line (11-ac-9, D-08)', async () => {
  const box = sandbox({ lenses: { db: DB }, files: { 'src/db/x.ts': 'export const q = 1;\n' } });
  const r = await run(['review-package', 'T-1'], box.repo);
  expect(r.code, r.out + r.err).toBe(0);
  expect(section(r.out)).toBe(`${uiBlock(PLAIN_LINE)}\n\n${DB_BLOCK}`);
}, 120_000);

// Phase 11 G3 (D-07, D-08, 11-ac-9): the review package of a `ui: true` lane M, L or P ticket prints the built-in `ui` lens under `## Team lenses` in round 1 and in the final review, with the D-08 checklist,
// and names `accord-reviewer-ui` when `ui.review` is set; a `ui: false` ticket and a lane S ticket print none. From the cut-off release (0.23.0, mocked below) `accord round` and `accord gate done` refuse a round 1
// or a `(final review)` round of a `ui: true` ticket that records no `Lens: ui ran`, as for a team lens, and the lens's findings block as a built-in review's. Real git in temporary sandboxes.
// Skill-name form (11-A2-PROBE.md, `Use: both`): each case that names a real skill runs with the bare name and with the plugin name.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, expect, it, vi } from 'vitest';
import { UI_LENS } from '@accord-dev/accord-core';
import { CONFIG, LANE_S_BODY, laneTicket, PLAN, pinned } from '../../../test/helpers/lane.js';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.23.0' } };
});

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

// Task 2: the record rule. A ticket claimed under 0.23.0 on its own branch: main holds the config, the ui: true T-1 and the lens files; the branch has the claim, the plan and one code commit, then review.md.
const REVIEW = 'accord/tickets/T-1/review.md';
const record = (head: string, ...lines: string[]): string => `Round record: 2\n\n## Round 1 head ${head}\n\n${['No findings', 'Security: no pattern matched', ...lines].join('\n')}\n`;
const CODE = { 'src/a.ts': 'export const a = 1;\n' };

function claimed(o: { claim?: string; ui?: string; lenses?: Record<string, string>; code?: Record<string, string>; review: (head: string) => string }): { repo: string; base: string; head: string } {
  const repo = makeEmptyRepo();
  dirs.push(repo);
  identity(repo);
  writeFiles(repo, {
    'accord/config.yml': pinned(o.claim ?? '0.23.0') + (o.ui ?? ''),
    'accord/tickets/T-1.md': laneTicket('T-1').replace('ui: false', 'ui: true'),
    'src/run.ts': 'export const one = 1;\n',
    ...Object.fromEntries(Object.entries(o.lenses ?? {}).map(([name, text]) => [`accord/lenses/${name}.md`, text])),
  });
  const base = commitMsg(repo, 'base');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'switch', '-q', '-c', 't/T-1');
  commitMsg(repo, 'claim: T-1', undefined, true);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', base), ...(o.claim === undefined ? {} : { 'accord/config.yml': pinned('0.23.0') + (o.ui ?? '') }), ...(o.code ?? CODE) });
  const head = commitMsg(repo, 'code');
  writeFiles(repo, { [REVIEW]: o.review(head) });
  commitMsg(repo, 'round 1');
  return { repo, base, head };
}

interface Found { rule: string; level: string; file?: string; line?: number; reason: string }
async function doneFindings(repo: string, rule: string): Promise<Found[]> {
  const r = await run(['gate', 'done', 'T-1', '--json'], repo);
  return (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === rule);
}
const LENS_RULE = 'gate.lens-unreviewed';

it('risk:regression accord round and gate done refuse round 1 of a ui: true ticket with no Lens: ui ran, naming the plain reviewer and the command that rebuilds its package, and answer once it is recorded (11-ac-9, D-05, D-08)', async () => {
  const box = claimed({ review: (h) => record(h) });
  const refused = await run(['round', 'T-1'], box.repo);
  expect(refused.err).toBe('');
  expect(refused.code).toBe(1);
  expect(refused.out).toContain('refused:');
  expect(refused.out).toContain('round 1 of cycle 1');
  expect(refused.out).toContain('lens ui (on_finding block)');
  expect(refused.out).toContain('dispatch accord-reviewer with lens ui');
  expect(refused.out).toContain('accord review-package T-1 --lens ui --round 1');
  const found = await doneFindings(box.repo, LENS_RULE);
  expect(found).toHaveLength(1);
  expect(found[0]).toMatchObject({ level: 'error', file: REVIEW });
  expect(found[0].reason).toContain('lens ui (on_finding block)');
  expect(found[0].reason).toContain('accord review-package T-1 --lens ui --round 1');

  // the command the refusal prints runs as written, and its package holds the built-in ui lens alone, over round 1's range
  const printed = /accord (review-package T-1 --lens ui --round 1 --out \S+)/.exec(refused.out);
  expect(printed, refused.out).not.toBeNull();
  const ok = await run(printed![1].split(' '), box.repo);
  expect(ok.err).toBe('');
  expect(ok.code).toBe(0);
  const text = readFileSync(join(box.repo, '.accord-reports', 'T-1', 'lens-ui-1.md'), 'utf8');
  expect(section(text)).toBe(uiBlock(PLAIN_LINE));
  expect(text).toContain(`${box.base.slice(0, 12)}...${box.head.slice(0, 12)}`);
  expect(text).toContain('src/a.ts');

  writeFiles(box.repo, { [REVIEW]: record(box.head, 'Lens: ui ran') });
  commitMsg(box.repo, 'lens review');
  const next = await run(['round', 'T-1'], box.repo);
  expect(next.out).not.toContain('refused:');
  expect(next.out).toContain('Round: 2');
  expect(next.code).toBe(0);
  expect(await doneFindings(box.repo, LENS_RULE)).toEqual([]);
}, 300_000);

for (const form of FORMS) {
  it(`risk:regression with ui.review ${form} the refusal names accord-reviewer-ui and the package of that command says so (11-ac-9, D-07)`, async () => {
    const box = claimed({ ui: `ui:\n  review: ${form}\n`, review: (h) => record(h) });
    const refused = await run(['round', 'T-1'], box.repo);
    expect(refused.code).toBe(1);
    expect(refused.out).toContain('dispatch accord-reviewer-ui with lens ui');
    expect(refused.out).not.toContain('dispatch accord-reviewer with lens ui');
    expect((await doneFindings(box.repo, LENS_RULE))[0].reason).toContain('dispatch accord-reviewer-ui with lens ui');
    const printed = /accord (review-package T-1 --lens ui --round 1 --out \S+)/.exec(refused.out);
    const ok = await run(printed![1].split(' '), box.repo);
    expect(ok.code, ok.out + ok.err).toBe(0);
    expect(section(readFileSync(join(box.repo, '.accord-reports', 'T-1', 'lens-ui-1.md'), 'utf8'))).toBe(uiBlock(MAPPED_LINE));
  }, 300_000);
}

it('risk:regression a (final review) round of a ui: true ticket needs Lens: ui ran, a later fix round does not, and a ticket claimed before 0.23.0 is not asked (11-ac-9, D-05)', async () => {
  const box = claimed({ review: (h) => record(h, 'Lens: ui ran') });
  writeFiles(box.repo, { 'src/b.ts': 'export const b = 2;\n' });
  const fix = commitMsg(box.repo, 'fix');
  const text = (finalLine: string): string =>
    `${record(box.head, 'Lens: ui ran')}\n## Round 2 head ${fix} (final review)\n\nNo findings\nSecurity: no pattern matched\n${finalLine}\n\n## Round 3 head ${fix}\n\nNo findings\nSecurity: no pattern matched\n`;
  writeFiles(box.repo, { [REVIEW]: text('') });
  commitMsg(box.repo, 'rounds');
  const refused = await doneFindings(box.repo, LENS_RULE);
  expect(refused).toHaveLength(1);
  expect(refused[0].reason).toContain('round 2 of cycle 1');
  expect(refused[0].reason).toContain('accord review-package T-1 --lens ui --round 2');
  writeFiles(box.repo, { [REVIEW]: text('Lens: ui ran') });
  commitMsg(box.repo, 'final review lens');
  expect(await doneFindings(box.repo, LENS_RULE)).toEqual([]);

  const old = claimed({ claim: '0.22.0', review: (h) => record(h) });
  expect(await doneFindings(old.repo, LENS_RULE)).toEqual([]);
  const round = await run(['round', 'T-1'], old.repo);
  expect(round.out).not.toContain('lens ui');
  expect(round.out).not.toContain('--lens');
}, 300_000);

const MUST = 'Must 1: the empty state renders blank — src/a.ts:3 — open';

/** A claimed ui: true ticket with three rounds on real git; round 3 is a final review that holds `finding`. */
function threeRounds(finding: string, lenses: Record<string, string> = {}): string {
  const box = claimed({ lenses, review: (h) => record(h, 'Lens: ui ran') });
  writeFiles(box.repo, { 'src/b.ts': 'export const b = 2;\n' });
  const fix1 = commitMsg(box.repo, 'fix 1');
  writeFiles(box.repo, { 'src/c.ts': 'export const c = 3;\n' });
  const fix2 = commitMsg(box.repo, 'fix 2');
  writeFiles(box.repo, {
    [REVIEW]: `${record(box.head, 'Lens: ui ran')}\n## Round 2 head ${fix1}\n\nNo findings\nSecurity: no pattern matched\n\n## Round 3 head ${fix2} (final review)\n\n${finding}\nSecurity: no pattern matched\nLens: ui ran\n`,
  });
  commitMsg(box.repo, 'rounds');
  return box.repo;
}
const reviewRounds = (repo: string): Promise<Found[]> => doneFindings(repo, 'gate.review-rounds');

it('risk:regression an open Must of the ui lens, which carries no mark, stops the loop at round 3 and blocks Done as a built-in finding does, and a lens: ui mark is refused (11-ac-9, D-06, D-08)', async () => {
  const repo = threeRounds(MUST);
  const stopped = await run(['round', 'T-1'], repo);
  expect(stopped.out).toContain('stop: report to owner');
  expect(stopped.out).not.toContain('ask:');
  expect(stopped.out).not.toContain('warn:');
  expect(await reviewRounds(repo)).toHaveLength(1);

  const marked = threeRounds(`${MUST} — lens: ui`);
  const refused = await run(['round', 'T-1'], marked);
  expect(refused.code).toBe(1);
  expect(refused.out).toContain('refused:');
  expect(refused.out).toContain("lens ui is a built-in lens, and a built-in lens's finding carries no lens mark");
}, 300_000);

it('risk:security a repository file accord/lenses/ui.md changes neither the printed checklist, the mode nor the record rule of a ui: true ticket (11-ac-9, D-08, T-11-27)', async () => {
  const weaker = '---\non_finding: warn\n---\n\n- A weaker checklist the repository wrote.\n';
  const repo = threeRounds(MUST, { ui: weaker });
  // the mode is the built-in one: the Must still stops the loop, and no warn line is printed
  const stopped = await run(['round', 'T-1'], repo);
  expect(stopped.out).toContain('stop: report to owner');
  expect(stopped.out).not.toContain('warn:');
  const pkg = await run(['review-package', 'T-1', '--lens', 'ui', '--round', '1', '--out', 'lens-ui-1.md'], repo);
  expect(pkg.code, pkg.out + pkg.err).toBe(0);
  const text = readFileSync(join(repo, '.accord-reports', 'T-1', 'lens-ui-1.md'), 'utf8');
  expect(section(text)).toBe(uiBlock(PLAIN_LINE));
  expect(text).not.toContain('weaker');

  // with the lens not recorded, it is the built-in one the refusal names
  const skipped = claimed({ lenses: { ui: weaker }, review: (h) => record(h) });
  const refused = await run(['round', 'T-1'], skipped.repo);
  expect(refused.out).toContain('lens ui (on_finding block)');
  expect(refused.out).not.toContain('on_finding warn');
}, 300_000);

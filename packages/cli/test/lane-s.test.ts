import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, gitRun, makeEmptyRepo, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, junit, LANE_S_BODY, laneTicket, REPORT } from '../../../test/helpers/lane.js';

type F = { rule: string; reason: string; file: string; level: string };

it('ac-2 a lane S ticket is written and passes gate ready without acceptance criteria', async () => {
  const repo = makeLaneRepo();
  try {
    const made = await run(['new', 'ticket', 'S-1', '--lane', 'S'], repo);
    expect(made.code).toBe(0);
    expect(made.out).toBe('accord/tickets/S-1.md\n');
    const file = join(repo, 'accord', 'tickets', 'S-1.md');
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('id: "S-1"');
    expect(text).toMatch(/^lane: "?S"?/m);
    expect(text).toMatch(/^title: ".+"/m);
    expect(text.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## Understood', '## Done when', '## Scope']);
    expect(text).not.toMatch(/^approved_hash:/m);
    const errorsOn = async () =>
      (JSON.parse((await run(['lint', '--json'], repo)).out).findings as F[]).filter(
        (f) => f.file === 'accord/tickets/S-1.md' && f.level === 'error',
      );
    expect(await errorsOn()).toEqual([]);
    const ready = await run(['gate', 'ready', 'S-1', '--json'], repo);
    expect(ready.code).toBe(1);
    const findings = JSON.parse(ready.out).findings as F[];
    const empties = findings.filter((f) => f.rule === 'gate.section-empty');
    expect(empties).toHaveLength(2);
    expect(empties.some((f) => f.reason.includes('"## Understood"'))).toBe(true);
    expect(empties.some((f) => f.reason.includes('"## Done when"'))).toBe(true);
    expect(findings.some((f) => f.rule === 'gate.approval-missing')).toBe(false);
    const half = text.replace('## Understood\n', '## Understood\nThe export button writes a csv file.\n');
    writeFileSync(file, half);
    const r2 = await run(['gate', 'ready', 'S-1', '--json'], repo);
    expect(r2.code).toBe(1);
    const e2 = (JSON.parse(r2.out).findings as F[]).filter((f) => f.rule === 'gate.section-empty');
    expect(e2).toHaveLength(1);
    expect(e2[0].reason).toContain('"## Done when"');
    writeFileSync(file, half.replace('## Done when\n', '## Done when\nPressing export saves report.csv.\n'));
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);
    const after = readFileSync(file, 'utf8');
    expect(after).toMatch(/^ac_hash: "?fnv1a64:[0-9a-f]{16}"?/m);
    expect(after).not.toMatch(/^approved_hash:/m);
    expect(await errorsOn()).toEqual([]);
  } finally {
    cleanup(repo);
  }
}, 120_000);

function repoWith(files: Record<string, string>): string {
  const repo = makeEmptyRepo();
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'an');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  writeFiles(repo, files);
  return repo;
}

it('ac-3 the dashboard lists a queued and a claimed lane S ticket with a lane column', async () => {
  const repo = repoWith({
    'accord/config.yml': CONFIG,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
    'accord/tickets/S-2.md': laneTicket('S-2', { lane: 'S', body: LANE_S_BODY }),
  });
  try {
    commitMsg(repo, 'base');
    const main = gitRun(repo, 'branch', '--show-current').trim();
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);
    commitMsg(repo, 'ready: S-1');
    gitRun(repo, 'switch', '-q', '-c', 't/S-2');
    writeFiles(repo, { 'src/s2.txt': 's2\n' });
    commitMsg(repo, 'claim: S-2');
    gitRun(repo, 'switch', '-q', main);
    const j = JSON.parse((await run(['dashboard', '--json'], repo)).out);
    const ids = (...secs: { rows: { id: string; lane?: string }[] }[]) => secs.flatMap((x) => x.rows.map((r) => r.id));
    expect(ids(j.ready, j.upNext)).toContain('S-1');
    expect(ids(j.yours, j.team)).toContain('S-2');
    for (const sec of [j.yours, j.team, j.ready, j.upNext]) for (const r of sec.rows) expect(r.lane).toBe('S');
    const text = (await run(['dashboard'], repo)).out.split('\n');
    const cols = (l: string) => l.trim().split(/ {2,}/);
    for (const h of ['YOURS', 'TEAM', 'READY', 'UP NEXT']) {
      const next = text[text.indexOf(h) + 1];
      if (next !== '  none') expect(cols(next)).toEqual(['id', 'lane', 'title', 'stage', 'who', 'blocked by']);
    }
    const s1 = cols(text.find((l) => l.startsWith('  S-1')) as string);
    expect(s1[1]).toBe('S');
    expect(s1[3]).toBe('build');
    expect(cols(text.find((l) => l.startsWith('  S-2')) as string)[1]).toBe('S');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching lane S gate done passes a reviewed change and fails on a commit after it an unclean review lines after the verdict a failed suite and edited sections', async () => {
  const REVIEW = '## Round 1\n\nNo findings\n\nverdict: converged\n';
  const RP = 'accord/tickets/S-1/review.md';
  const PASSED = junit({ 'a#b': 'passed' });
  const repo = repoWith({
    'accord/config.yml': CONFIG,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
    'src/a.ts': 'a\n',
    [REPORT]: PASSED,
  });
  try {
    const fails = async (rule: string) => {
      const r = await run(['gate', 'done', 'S-1', '--json'], repo);
      expect(r.code).toBe(1);
      expect((JSON.parse(r.out).findings as F[]).map((f) => f.rule)).toContain(rule);
    };
    const passes = async () => expect((await run(['gate', 'done', 'S-1'], repo)).code).toBe(0);
    const hard = () => gitRun(repo, 'reset', '-q', '--hard', 'HEAD~1');
    commitMsg(repo, 'base');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);
    commitMsg(repo, 'ready: S-1');
    writeFiles(repo, { 'src/a.ts': 'b\n' });
    commitMsg(repo, 'change');
    writeFiles(repo, { [RP]: REVIEW });
    commitMsg(repo, 'review: S-1');
    await passes();
    writeFiles(repo, { 'accord/tickets/S-1/ledger.md': '## Rulings\n' });
    commitMsg(repo, 'ledger');
    await passes();
    hard();
    writeFiles(repo, { 'src/b.ts': 'b\n' });
    commitMsg(repo, 'after review');
    await fails('gate.commit-after-review');
    hard();
    gitRun(repo, 'switch', '-q', '--detach');
    writeFiles(repo, { 'src/d.ts': 'd\n' });
    commitMsg(repo, 'after review detached');
    await fails('gate.commit-after-review');
    gitRun(repo, 'switch', '-q', 't/S-1');
    writeFiles(repo, { [REPORT]: junit({ 'a#b': 'failed' }) });
    await fails('gate.suite-not-passed');
    writeFiles(repo, { [REPORT]: PASSED });
    writeFiles(repo, { [RP]: REVIEW.replace('No findings', 'No findings here') });
    await fails('gate.review-uncommitted');
    writeFiles(repo, { [RP]: REVIEW });
    gitRun(repo, 'reset', '-q', '--soft', 'HEAD~1');
    await fails('gate.review-uncommitted');
    commitMsg(repo, 'review: S-1');
    writeFiles(repo, { [RP]: REVIEW + 'x\n' });
    commitMsg(repo, 'trailing');
    await fails('gate.review-trailing');
    hard();
    const t = join(repo, 'accord', 'tickets', 'S-1.md');
    writeFiles(repo, { 'accord/tickets/S-1.md': readFileSync(t, 'utf8').replace('writes a csv file', 'writes a tsv file') });
    commitMsg(repo, 'edit');
    await fails('gate.sections-changed');
    hard();
    hard();
    writeFiles(repo, { [RP]: REVIEW, 'src/c.ts': 'c\n' });
    commitMsg(repo, 'review: S-1');
    await fails('gate.review-commit-code');
    hard();
    writeFiles(repo, { [RP]: '## Round 5\n\nMust 1: x — src/a.ts:1 — open\n\nverdict: accepted-by-owner "ship it"\n' });
    commitMsg(repo, 'review: S-1');
    await passes();
    hard();
    writeFiles(repo, { [RP]: '## Round 1\n\nNo findings\n' });
    commitMsg(repo, 'review: S-1 round 1');
    writeFiles(repo, { 'src/e.ts': 'e\n' });
    commitMsg(repo, 'fix after round');
    writeFiles(repo, { [RP]: REVIEW });
    commitMsg(repo, 'review: S-1 verdict');
    await fails('gate.commit-after-review');
    gitRun(repo, 'reset', '-q', '--hard', 'HEAD~2');
    writeFiles(repo, { [RP]: REVIEW });
    commitMsg(repo, 'review: S-1 verdict');
    await passes();
    gitRun(repo, 'reset', '-q', '--hard', 'HEAD~2');
    writeFiles(repo, { [RP]: '## Round 1\n\nNo findings\n', 'src/e.ts': 'e\n' });
    commitMsg(repo, 'review: S-1 round 1');
    writeFiles(repo, { [RP]: REVIEW });
    commitMsg(repo, 'review: S-1 verdict');
    await fails('gate.review-commit-code');
    const r = await run(['gate', 'done', 'S-1', '--json'], repo);
    const found = JSON.parse(r.out).findings as F[];
    expect(found.find((f) => f.rule === 'gate.review-commit-code')?.reason).toContain('src/e.ts');
    expect(found.some((f) => f.rule === 'gate.commit-after-review')).toBe(false);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:security approve refuses a lane S ticket and writes nothing', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }) });
  try {
    const file = join(repo, 'accord', 'tickets', 'S-1.md');
    const before = readFileSync(file);
    const r = await run(['approve', 'S-1'], repo);
    expect(r.code).toBe(2);
    expect(r.err).toContain('lane S');
    expect(r.err).toContain('accord gate ready S-1');
    expect(readFileSync(file).equals(before)).toBe(true);
    expect((await run(['approve', 'T-1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching the review package of a lane S ticket starts at the fork point from the default branch', async () => {
  const repo = repoWith({
    'accord/config.yml': CONFIG,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY }),
    'src/a.ts': 'a\n',
  });
  try {
    commitMsg(repo, 'base');
    const main = gitRun(repo, 'branch', '--show-current').trim();
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    writeFiles(repo, { 'src/b.ts': 'b\n' });
    commitMsg(repo, 'change');
    gitRun(repo, 'switch', '-q', main);
    writeFiles(repo, { 'src/c.ts': 'c\n' });
    commitMsg(repo, 'main moves');
    gitRun(repo, 'switch', '-q', 't/S-1');
    const r = await run(['review-package', 'S-1'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toContain('src/b.ts');
    expect(r.out).toContain('(no plan)');
    expect(r.out).not.toContain('src/c.ts');
    expect((await run(['review-package', 'S-1', '--base', 'HEAD~1'], repo)).code).toBe(0);
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:complex-branching the review package lists the out-of-scope files and interface signs gate done would name', async () => {
  const repo = repoWith({
    'accord/config.yml': CONFIG,
    'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: LANE_S_BODY + '\n## Scope\nsrc/a.ts\n' }),
    'src/a.ts': 'a\n',
    'accord/tickets/T-1.md': laneTicket('T-1'),
  });
  try {
    commitMsg(repo, 'base');
    gitRun(repo, 'branch', '-M', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/S-1');
    expect((await run(['gate', 'ready', 'S-1'], repo)).code).toBe(0);
    commitMsg(repo, 'ready: S-1');
    writeFiles(repo, { 'src/a.ts': 'changed\n', 'src/b.ts': 'b\n', 'schemas/x.json': '{}\n' });
    commitMsg(repo, 'change');
    const first = await run(['review-package', 'S-1'], repo);
    expect(first.code).toBe(0);
    expect(first.out).toContain(
      '## Out-of-scope files\n\nschemas/x.json\nsrc/b.ts\n\n## Interface signs\n\nschemas/x.json: a new schema file\n\n## Stat',
    );
    gitRun(repo, 'rm', '-q', 'src/b.ts', 'schemas/x.json');
    commitMsg(repo, 'remove');
    const clean = await run(['review-package', 'S-1'], repo);
    expect(clean.code).toBe(0);
    expect(clean.out).toContain('## Out-of-scope files\n\n(none)');
    expect(clean.out).toContain('## Interface signs\n\n(none)');
    gitRun(repo, 'switch', '-q', 'main');
    gitRun(repo, 'switch', '-q', '-c', 't/T-1');
    writeFileSync(join(repo, 'accord/tickets/T-1.md'), readFileSync(join(repo, 'accord/tickets/T-1.md'), 'utf8') + '\nmore\n');
    writeFiles(repo, { 'schemas/y.json': '{}\n' });
    commitMsg(repo, 'change T-1');
    const other = await run(['review-package', 'T-1', '--base', 'main'], repo);
    expect(other.code).toBe(0);
    expect(other.out).toContain('## Interface signs\n\nschemas/y.json: a new schema file');
    expect(other.out).not.toContain('## Out-of-scope files');
    gitRun(repo, 'branch', '-m', 'main', 'trunk');
    const cannot = await run(['review-package', 'T-1', '--base', 'HEAD~1'], repo);
    expect(cannot.code).toBe(0);
    expect(cannot.out).toContain('## Interface signs\n\n(cannot tell: none of origin/HEAD');
  } finally {
    cleanup(repo);
  }
}, 120_000);

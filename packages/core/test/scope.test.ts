// ST-LN-62 Task 1: gate done holds a lane S ticket to the scope its scout recorded. The branch diff is a hand-built fact.
import { expect, it } from 'vitest';
import { gateDone } from '../src/gate/index.js';
import { laneSHash } from '../src/gate/hash.js';
import { loadSnapshot } from '../src/load/snapshot.js';
import type { BranchChange, BranchFact } from '../src/model/snapshot.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';

const SCOPE = LANE_S_BODY + '\n## Scope\npackages/core/src/status/dashboard.ts\n';
const H = laneSHash(
  loadSnapshot({ files: { 'accord/tickets/S-1.md': laneTicket('S-1', { lane: 'S', body: SCOPE }) }, tree: [] }).tickets['S-1'],
);
const S1 = laneTicket('S-1', { lane: 'S', body: SCOPE, frontmatter: ['ac_hash: "' + H + '"'] });

const ch = (path: string, lines = 1, kind: BranchChange['kind'] = 'modified'): BranchChange => ({ path, kind, lines });
const fact = (changes: BranchChange[], extra: Record<string, unknown> = {}, id = 'S-1'): BranchFact =>
  ({
    base: 'b'.repeat(40),
    changes: [ch('accord/tickets/' + id + '.md'), ...changes],
    synced: [],
    scope: { commit: 'c'.repeat(40), paths: ['packages/core/src/status/dashboard.ts'] },
    ...extra,
  }) as BranchFact;
const snap = (files: Record<string, string>, facts?: Record<string, BranchFact>) =>
  loadSnapshot({ files: { 'accord/config.yml': CONFIG, ...files }, tree: [], ...(facts === undefined ? {} : { branchFacts: facts }) });
const found = (s: ReturnType<typeof snap>, id: string, rule: string) => gateDone(s, id).findings.filter((f) => f.rule === rule);
const WITH_GEN = CONFIG + 'generated:\n  - docs/gen/\n';

it('ac-2 gate done fails a lane S ticket that touched a file outside its recorded scope', () => {
  const changes = [
    ch('packages/core/src/status/dashboard.ts', 3),
    ch('packages/core/src/gate/rules.ts', 2),
    ch('accord/tickets/S-1/review.md', 4, 'added'),
    ch('.claude/skills/accord/SKILL.md', 4),
    ch('docs/gen/out.txt', 5),
    ch('src/ws.ts', 0),
  ];
  const extra = { synced: ['.claude/skills/accord/SKILL.md'], baseConfig: WITH_GEN };
  const s = snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': fact(changes, extra) });
  const r = found(s, 'S-1', 'gate.out-of-scope');
  expect(r).toHaveLength(1);
  expect(r[0].level).toBe('error');
  expect(r[0].file).toBe('accord/tickets/S-1.md');
  expect(r[0].reason).toContain('packages/core/src/gate/rules.ts');
  expect(r[0].reason).toContain('must be lifted to lane M');
  expect(gateDone(s, 'S-1').verdict).toBe('fail');
  const clean = snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': fact(changes.filter((c) => !c.path.endsWith('rules.ts')), extra) });
  expect(found(clean, 'S-1', 'gate.out-of-scope')).toEqual([]);
});

it('risk:complex-branching gate done fails closed on a missing or failed branch diff a diff without the ticket file and an absent or empty scope', () => {
  const files = { 'accord/tickets/S-1.md': S1 };
  const s1 = (facts?: Record<string, BranchFact>) => snap(files, facts);
  const unknown = found(s1(), 'S-1', 'gate.branch-unknown');
  expect(unknown).toHaveLength(1);
  expect(unknown[0].reason).toBe('the host loaded no branch diff for this ticket, so the files it changed cannot be checked');
  expect(found(snap({ 'accord/tickets/T-1.md': laneTicket('T-1') }), 'T-1', 'gate.branch-unknown')).toHaveLength(1);
  const plain = snap({ 'accord/tickets/X-1.md': laneTicket('X-1', { lane: '' }) });
  expect(found(plain, 'X-1', 'gate.branch-unknown')).toEqual([]);
  expect(found(plain, 'X-1', 'gate.out-of-scope')).toEqual([]);

  const boom = s1({ 'S-1': { error: 'boom' } });
  expect(found(boom, 'S-1', 'gate.branch-unknown').map((f) => f.reason)).toEqual(['boom']);
  expect(found(boom, 'S-1', 'gate.out-of-scope')).toEqual([]);

  // Since Task 9 a diff without the ticket file fails only lane S; lane M fails only an empty branch diff.
  const noTicket = s1({ 'S-1': { ...fact([]), changes: [ch('src/x.ts')] } as BranchFact });
  const nt = found(noTicket, 'S-1', 'gate.branch-unknown');
  expect(nt).toHaveLength(1);
  expect(nt[0].reason).toContain('does not change accord/tickets/S-1.md');
  expect(found(noTicket, 'S-1', 'gate.out-of-scope')).toEqual([]);

  const noScope = found(s1({ 'S-1': fact([], { scope: undefined }) }), 'S-1', 'gate.out-of-scope');
  expect(noScope).toHaveLength(1);
  expect(noScope[0].reason).toContain('no commit on this branch records ac_hash');
  const empty = found(s1({ 'S-1': fact([], { scope: { commit: 'c'.repeat(40), paths: [] } }) }), 'S-1', 'gate.out-of-scope');
  expect(empty).toHaveLength(1);
  expect(empty[0].reason).toContain('## Scope held no path');

  // generated: only counts when the merge-base config lists it.
  const headOnly = snap({ 'accord/config.yml': WITH_GEN, ...files }, { 'S-1': fact([ch('docs/gen/out.txt', 5)]) });
  const h = found(headOnly, 'S-1', 'gate.out-of-scope');
  expect(h).toHaveLength(1);
  expect(h[0].reason).toContain('docs/gen/out.txt');
  // .claude/settings.json is never exempted by a generated: entry.
  const claude = s1({ 'S-1': fact([ch('.claude/settings.json')], { baseConfig: CONFIG + 'generated:\n  - .claude/\n' }) });
  const c = found(claude, 'S-1', 'gate.out-of-scope');
  expect(c).toHaveLength(1);
  expect(c[0].reason).toContain('.claude/settings.json');
  expect(found(s1({ 'S-1': fact([ch('src/x.sh', 0, 'mode')]) }), 'S-1', 'gate.out-of-scope')).toHaveLength(1);
  expect(found(s1({ 'S-1': fact([{ ...ch('img/a.png', 0), binary: true }]) }), 'S-1', 'gate.out-of-scope')).toHaveLength(1);
});

it('ac-3 a wording-only file outside the scope passes only when declared and confirmed', () => {
  const L = '## Rulings\n- Wording-only: README.md — fixes a typo\n';
  const V = '## Round 1\n\nConfirmed wording-only: README.md\n\nverdict: converged\n';
  const w = (change: BranchChange, ledger?: string, review?: string) =>
    found(
      snap(
        {
          'accord/tickets/S-1.md': S1,
          ...(ledger === undefined ? {} : { 'accord/tickets/S-1/ledger.md': ledger }),
          ...(review === undefined ? {} : { 'accord/tickets/S-1/review.md': review }),
        },
        { 'S-1': fact([change]) },
      ),
      'S-1',
      'gate.out-of-scope',
    );
  expect(w(ch('README.md', 3), L, V)).toEqual([]);
  const missing = w(ch('README.md', 3), L, V.replace('Confirmed wording-only: README.md\n', ''));
  expect(missing).toHaveLength(1);
  expect(missing[0].reason).toContain('README.md');
  expect(missing[0].reason).toContain('Confirmed wording-only: README.md');
  expect(missing[0].reason).toContain('must be lifted to lane M');
  expect(
    w(ch('README.md', 3), L, '## Round 1\n\nConfirmed wording-only: README.md\n\n## Round 2\n\nNo findings\n\nverdict: converged\n'),
  ).toHaveLength(1);
  const big = w(ch('README.md', 4), L, V);
  expect(big).toHaveLength(1);
  expect(big[0].reason).toContain('changes 4 lines, more than 3');
  const added = w(ch('README.md', 1, 'added'), L, V);
  expect(added).toHaveLength(1);
  expect(added[0].reason).toContain('is new');
  const deleted = w(ch('README.md', 0, 'deleted'), L, V);
  expect(deleted).toHaveLength(1);
  expect(deleted[0].reason).toContain('is deleted');
  const undeclared = w(ch('README.md', 3), undefined, V);
  expect(undeclared).toHaveLength(1);
  expect(undeclared[0].reason).toContain('README.md is changed on this branch but not listed in ## Scope');
});

it('ac-4 gate done fails a lane S ticket that touched a listed sensitive area', () => {
  const B = CONFIG + 'sensitive:\n  interface:\n    - packages/cli/src/run.ts\n    - packages/core/schemas/\n';
  const L = '## Rulings\n- Wording-only: packages/cli/src/run.ts — fixes a typo\n';
  const V = '## Round 1\n\nConfirmed wording-only: packages/cli/src/run.ts\n\nverdict: converged\n';
  const withScope = (path: string) => ({ scope: { commit: 'c'.repeat(40), paths: ['packages/core/src/status/dashboard.ts', path] } });
  const run = (changes: BranchChange[], extra: Record<string, unknown> = {}, config = CONFIG, files: Record<string, string> = {}) =>
    found(
      snap({ 'accord/config.yml': config, 'accord/tickets/S-1.md': S1, ...files }, { 'S-1': fact(changes, { baseConfig: B, ...extra }) }),
      'S-1',
      'gate.sensitive-touched',
    );
  const declared = run([ch('packages/cli/src/run.ts', 2)], withScope('packages/cli/src/run.ts'), CONFIG, {
    'accord/tickets/S-1/ledger.md': L,
    'accord/tickets/S-1/review.md': V,
  });
  expect(declared).toHaveLength(1);
  expect(declared[0].level).toBe('error');
  expect(declared[0].file).toBe('accord/tickets/S-1.md');
  expect(declared[0].reason).toContain('interface');
  expect(declared[0].reason).toContain('packages/cli/src/run.ts');
  expect(declared[0].reason).toContain('must be lifted to lane M');
  const folder = run([ch('packages/core/schemas/x.json', 1)]);
  expect(folder).toHaveLength(1);
  expect(folder[0].reason).toContain('packages/core/schemas/');
  const headOnly = run([ch('packages/cli/src/run.ts', 1)], { baseConfig: undefined }, B);
  expect(headOnly).toHaveLength(1);
  expect(run([ch('packages/cli/src/run.ts', 0)])).toEqual([]);
  const exemptBase = WITH_GEN + 'sensitive:\n  interface:\n    - docs/gen/\n    - .claude/skills/accord/SKILL.md\n';
  const exempt = run([ch('docs/gen/out.txt', 2), ch('.claude/skills/accord/SKILL.md', 2)], { baseConfig: exemptBase, synced: ['.claude/skills/accord/SKILL.md'] });
  expect(exempt).toHaveLength(2);
  expect(exempt.map((f) => f.reason).join('\n')).toContain('docs/gen/out.txt');
  const lane = found(
    snap({ 'accord/config.yml': B, 'accord/tickets/T-1.md': laneTicket('T-1') }, { 'T-1': fact([ch('packages/cli/src/run.ts', 2)], { baseConfig: B }, 'T-1') }),
    'T-1',
    'gate.sensitive-touched',
  );
  expect(lane).toEqual([]);
});

it('ac-5 a sign of a new interface outside the list needs the list updated or a reviewers reason', () => {
  const CALL = 'program.' + "command('x')";
  const PKG = {
    base: '{"bin":{"old":"a.js"},"exports":"./i.js"}',
    head: '{"bin":{"old":"a.js","tool":"t.js"},"exports":{".":"./i.js","./extra":"./e.js"}}',
  };
  const changesOf = (id: string): BranchChange[] => [
    ch('schemas/thing.json', 1, 'added'),
    ch('src/a.schema.json', 1, 'added'),
    { ...ch('pkg/package.json', 2), pkg: PKG },
    { ...ch('src/cli.ts', 1), calls: [CALL] },
    { ...ch('docs/how.md', 1), calls: [CALL] },
    { ...ch('accord/tickets/' + id + '/notes.txt', 1, 'added'), calls: [CALL] },
  ];
  const T1 = laneTicket('T-1');
  const sign = (id: string, file: string, extra: Record<string, unknown> = {}, files: Record<string, string> = {}, config = CONFIG) =>
    found(snap({ 'accord/config.yml': config, ['accord/tickets/' + id + '.md']: file, ...files }, { [id]: fact(changesOf(id), extra, id) }), id, 'gate.interface-sign');
  const reasons = (fs: { reason: string }[]) => fs.map((f) => f.reason);
  const NAMES = ['schemas/thing.json', 'src/a.schema.json', '"tool"', '"./extra"', 'src/cli.ts'];

  const lane = sign('S-1', S1);
  expect(lane).toHaveLength(5);
  expect(lane.every((f) => f.level === 'error' && f.file === 'accord/tickets/S-1.md')).toBe(true);
  NAMES.forEach((n) => expect(reasons(lane).filter((r) => r.includes(n))).toHaveLength(1));
  expect(reasons(lane).every((r) => r.includes('must be lifted to lane M'))).toBe(true);
  expect(reasons(lane).join('\n')).not.toContain('docs/how.md');
  expect(reasons(lane).join('\n')).not.toContain('accord/tickets/S-1/');
  expect(reasons(lane).join('\n')).not.toContain('"."');
  expect(gateDone(snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': fact(changesOf('S-1')) }), 'S-1').verdict).toBe('fail');

  const other = sign('T-1', T1);
  expect(other).toHaveLength(5);
  for (const p of ['schemas/thing.json', 'src/a.schema.json', 'pkg/package.json', 'pkg/package.json', 'src/cli.ts']) {
    expect(reasons(other).some((r) => r.includes('Not an interface: ' + p + ' — <reason>'))).toBe(true);
  }
  expect(gateDone(snap({ 'accord/tickets/T-1.md': T1 }, { 'T-1': fact(changesOf('T-1'), {}, 'T-1') }), 'T-1').verdict).toBe('fail');

  const R = '## Round 1\n\nNot an interface: src/cli.ts — test harness only\n\nverdict: converged\n';
  const excused = sign('T-1', T1, {}, { 'accord/tickets/T-1/review.md': R });
  expect(excused).toHaveLength(4);
  expect(reasons(excused).join('\n')).not.toContain('src/cli.ts');

  const HEAD = CONFIG + 'sensitive:\n  interface:\n    - schemas/\n';
  const listedM = sign('T-1', T1, {}, {}, HEAD);
  expect(listedM).toHaveLength(4);
  expect(reasons(listedM).join('\n')).not.toContain('schemas/thing.json');
  const listedS = sign('S-1', S1, {}, {}, HEAD);
  expect(reasons(listedS).join('\n')).not.toContain('schemas/thing.json');
  const touched = found(snap({ 'accord/config.yml': HEAD, 'accord/tickets/S-1.md': S1 }, { 'S-1': fact(changesOf('S-1')) }), 'S-1', 'gate.sensitive-touched');
  expect(reasons(touched).join('\n')).toContain('schemas/thing.json');

  const BASE = CONFIG + 'sensitive:\n  interface:\n    - pkg/package.json\n';
  for (const [id, file] of [['S-1', S1], ['T-1', T1]] as const) {
    expect(reasons(sign(id, file, { baseConfig: BASE })).join('\n')).not.toContain('pkg/package.json');
  }

  const plain = snap({ 'accord/tickets/X-1.md': laneTicket('X-1', { lane: '' }) }, { 'X-1': fact(changesOf('X-1'), {}, 'X-1') });
  expect(found(plain, 'X-1', 'gate.interface-sign')).toEqual([]);
});

it('risk:regression gate done reads lane M work from a branch diff that lacks the ticket file and fails an empty branch diff in every lane', () => {
  const M = { 'accord/tickets/T-1.md': laneTicket('T-1') };
  const mFact = (changes: BranchChange[]) => ({ ...fact([], {}, 'T-1'), changes }) as BranchFact;
  const m = snap(M, {
    'T-1': mFact([ch('src/x.ts', 2), ch('accord/tickets/T-1/plan.md', 3, 'added'), ch('accord/tickets/T-1/ledger.md', 1, 'added')]),
  });
  expect(found(m, 'T-1', 'gate.branch-unknown')).toEqual([]);
  expect(found(snap(M, { 'T-1': mFact([ch('src/ws.ts', 0)]) }), 'T-1', 'gate.branch-unknown')).toEqual([]);
  const emptyM = found(snap(M, { 'T-1': mFact([]) }), 'T-1', 'gate.branch-unknown');
  expect(emptyM).toHaveLength(1);
  expect(emptyM[0].reason).toContain('adds no change over the merge base');
  expect(emptyM[0].reason).toContain('never on the default branch');

  const sFact = (changes: BranchChange[]) => ({ ...fact([]), changes }) as BranchFact;
  const s = snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': sFact([ch('packages/core/src/status/dashboard.ts', 2), ch('src/x.ts', 1)]) });
  const noTicket = found(s, 'S-1', 'gate.branch-unknown');
  expect(noTicket).toHaveLength(1);
  expect(noTicket[0].reason).toContain('does not change accord/tickets/S-1.md');
  expect(found(s, 'S-1', 'gate.out-of-scope')).toEqual([]);

  const emptyS = snap({ 'accord/tickets/S-1.md': S1 }, { 'S-1': sFact([]) });
  const eS = found(emptyS, 'S-1', 'gate.branch-unknown');
  expect(eS).toHaveLength(1);
  expect(eS[0].reason).toContain('adds no change over the merge base');
  expect(eS[0].reason).not.toContain('does not change');
  expect(found(emptyS, 'S-1', 'gate.out-of-scope')).toEqual([]);
});

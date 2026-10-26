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

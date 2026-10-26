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

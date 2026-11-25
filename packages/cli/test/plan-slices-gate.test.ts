// Phase 15 D-09: `accord gate plan` reads the `## Slice <n>` sections of plan.md and refuses a criterion that no slice delivers, on real git.
import { expect, it } from 'vitest';
import { SLICES_FROM } from '@accord-dev/accord-core';
import { claimedUnder, cleanup, commitAll, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket, PLAN } from '../../../test/helpers/lane.js';

interface Found { rule: string; level: string; reason?: string }

const SLICE_ONE = '\n## Slice 1: Export\ntasks: 1, 2\ncovers: @ac-1\n';

it('risk:regression gate plan refuses a criterion no slice delivers, on a ticket claimed at SLICES_FROM (D-09)', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    claimedUnder(repo, SLICES_FROM);
    await run(['approve', 'T-1'], repo);
    const first = commitAll(repo);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', first) + SLICE_ONE });
    commitAll(repo);
    const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
    expect(r.code).toBe(1);
    const found = (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.slice-ac-uncovered');
    expect(found).toHaveLength(1);
    expect(found[0].level).toBe('error');
    expect(found[0].reason).toContain('@ac-2');
  } finally {
    cleanup(repo);
  }
});

it('risk:regression gate plan reads no slice rule on a ticket claimed before SLICES_FROM (D-09)', async () => {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  try {
    claimedUnder(repo, '0.20.3');
    await run(['approve', 'T-1'], repo);
    const first = commitAll(repo);
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': PLAN.replace('abc1234', first) + SLICE_ONE });
    commitAll(repo);
    const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
    expect((JSON.parse(r.out).findings as Found[]).filter((f) => f.rule.startsWith('gate.slice-'))).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

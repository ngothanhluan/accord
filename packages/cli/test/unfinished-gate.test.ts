// ST-LN-72 72-ac-1, plan half: `accord gate plan` on real git refuses a plan.md that still carries `<!-- accord: unfinished -->`, from UNFINISHED_FROM, naming the file.
// The CLI here runs as the cut-off release (0.6.0) while the package is still 0.5.1, so the new rule is read at the version that ships it.
import { expect, it, vi } from 'vitest';
import { UNFINISHED_FROM, UNFINISHED_MARKER } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

interface Found { rule: string; level: string; reason?: string; file?: string; line?: number }
const gate = async (repo: string): Promise<{ code: number; found: Found[]; out: string }> => {
  const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
  return { code: r.code, out: r.out, found: (JSON.parse(r.out).findings as Found[]).filter((f) => f.rule === 'gate.plan-unfinished') };
};
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

/** A plan that satisfies every other plan rule; `first` is its first body line, right after the frontmatter. */
const plan = (first: string | undefined): string =>
  [
    '---',
    'baseline: abc1234',
    '---',
    ...(first === undefined ? [] : [first]),
    '',
    '# Plan',
    '',
    '## Task 1: Writer csv mode',
    'covers: @ac-1, @ac-2, D-01',
    'files: src/export.ts',
    'verify: export#writes-csv (@ac-1) export#escapes-commas (@ac-2)',
    'after: none',
    'Add a csv branch to the writer.',
    '',
  ].join('\n');

/** An approved ticket claimed under `claimPin`, then its plan committed against the baseline commit. */
async function planned(text: string, claimPin = UNFINISHED_FROM): Promise<{ repo: string; baseline: string }> {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1') });
  await run(['approve', 'T-1'], repo);
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, 'notes.txt': 'work after the claim\n' });
  const baseline = commitAll(repo);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': text.replace('abc1234', baseline) });
  commitAll(repo);
  return { repo, baseline };
}

it('ac-1 gate plan on real git refuses a plan still being written and passes it once the marker is gone (ST-LN-72 72-ac-1)', async () => {
  const { repo, baseline } = await planned(plan(UNFINISHED_MARKER));
  try {
    const got = await gate(repo);
    expect(got.code).toBe(1);
    expect(got.found).toHaveLength(1);
    expect(got.found[0].level).toBe('error');
    expect(got.found[0].file).toBe('accord/tickets/T-1/plan.md');
    expect(got.found[0].line).toBe(4);
    expect(got.found[0].reason).toContain('accord/tickets/T-1/plan.md');
    expect(got.found[0].reason).toContain(UNFINISHED_MARKER);

    // the planner's last step: the line is removed and the plan committed; nothing else was wrong with it
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': plan(undefined).replace('abc1234', baseline) });
    commitAll(repo);
    const done = await gate(repo);
    expect(done.found).toEqual([]);
    expect(done.code).toBe(0);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression gate plan prints the same unfinished finding on every run, and a marker above the frontmatter is still refused (ST-LN-72 72-ac-1)', async () => {
  const { repo } = await planned(`${UNFINISHED_MARKER}\n${plan(undefined)}`);
  try {
    const first = await gate(repo);
    const second = await gate(repo);
    expect(first.code).toBe(1);
    expect(first.found.map((f) => f.line)).toEqual([1]);
    expect(second.out).toBe(first.out);
  } finally {
    cleanup(repo);
  }
});

it('risk:complex-branching a ticket claimed before 0.6.0 keeps its marked plan unrefused on real git (ST-LN-72 72-ac-1)', async () => {
  const { repo } = await planned(plan(UNFINISHED_MARKER), '0.5.1');
  try {
    expect((await gate(repo)).found).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

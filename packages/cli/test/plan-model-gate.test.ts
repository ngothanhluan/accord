// ST-LN-10 10-ac-1: `accord gate plan` on real git asks each new path of a plan task for a model file, from PLAN_MODEL_FROM, and checks the model at the plan baseline.
// The CLI here runs as the cut-off release (0.6.0) while the package is still 0.5.1, so the new rule is read at the version that ships it.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it, vi } from 'vitest';
import { PLAN_MODEL_FROM } from '@accord-dev/accord-core';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.6.0' } };
});

interface Found { rule: string; level: string; reason?: string; file?: string }
const MODEL_RULES = ['gate.task-model-missing', 'gate.task-model-unknown'];
const gate = async (repo: string): Promise<{ code: number; found: Found[] }> => {
  const r = await run(['gate', 'plan', 'T-1', '--json'], repo);
  return { code: r.code, found: (JSON.parse(r.out).findings as Found[]).filter((f) => MODEL_RULES.includes(f.rule)) };
};
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);

const plan = (second: string): string =>
  [
    '---',
    'baseline: abc1234',
    '---',
    '',
    '# Plan',
    '',
    '## Task 1: Writer csv mode',
    'covers: @ac-1, D-01',
    'files: src/export.ts, src/c.ts (new)',
    'verify: export#writes-csv (@ac-1)',
    'after: none',
    'Add a csv branch to the writer.',
    '',
    '## Task 2: Escaping',
    'covers: @ac-2',
    `files: ${second}`,
    'verify: export#escapes-commas (@ac-2)',
    'after: 1',
    'Quote cells that contain a comma.',
    '',
  ].join('\n');

/** An approved ticket claimed at the cut-off whose baseline commit holds src/json.ts, then its plan committed. */
async function planned(text: string, head = CONFIG, claimPin = PLAN_MODEL_FROM): Promise<{ repo: string; baseline: string }> {
  const repo = makeLaneRepo({ 'accord/tickets/T-1.md': laneTicket('T-1'), 'src/json.ts': 'export const json = 1;\n' });
  await run(['approve', 'T-1'], repo);
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': head, 'notes.txt': 'work after the claim\n' });
  const baseline = commitAll(repo);
  writeFiles(repo, { 'accord/tickets/T-1/plan.md': text.replace('abc1234', baseline) });
  commitAll(repo);
  return { repo, baseline };
}

it('risk:complex-branching gate plan on real git refuses a missing and an unknown model and passes a real one (ST-LN-10 10-ac-1)', async () => {
  const { repo, baseline } = await planned(plan('src/csv.ts (new, like src/nope.ts)'));
  try {
    const got = await gate(repo);
    expect(got.code).toBe(1);
    const missing = got.found.filter((f) => f.rule === 'gate.task-model-missing');
    expect(missing).toHaveLength(1);
    expect(missing[0].reason).toContain('task 1');
    expect(missing[0].reason).toContain('src/c.ts');
    expect(missing[0].file).toBe('accord/tickets/T-1/plan.md');
    const unknown = got.found.filter((f) => f.rule === 'gate.task-model-unknown');
    expect(unknown).toHaveLength(1);
    expect(unknown[0].reason).toContain('task 2');
    expect(unknown[0].reason).toContain('src/csv.ts');
    expect(unknown[0].reason).toContain('src/nope.ts');
    expect(unknown[0].reason).toContain(baseline);

    // The plan rewritten to a model that exists at the baseline, and a reason for the other path: neither finding.
    const fixed = plan('src/csv.ts (new, like src/json.ts)').replace('src/c.ts (new)', 'src/c.ts (new, no model: first of its kind)');
    writeFiles(repo, { 'accord/tickets/T-1/plan.md': fixed.replace('abc1234', baseline) });
    commitAll(repo);
    expect((await gate(repo)).found).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression gate plan prints the same model findings on every run (ST-LN-10 10-ac-1)', async () => {
  const { repo } = await planned(plan('src/csv.ts (new, like src/nope.ts)'));
  try {
    const first = await run(['gate', 'plan', 'T-1', '--json'], repo);
    const second = await run(['gate', 'plan', 'T-1', '--json'], repo);
    expect(first.code).toBe(1);
    expect(JSON.parse(first.out).findings.filter((f: Found) => MODEL_RULES.includes(f.rule))).toHaveLength(2);
    expect(second.out).toBe(first.out);
    expect(second.code).toBe(first.code);
  } finally {
    cleanup(repo);
  }
});

it('risk:regression the model rule holds in a repository whose runtimes install no accord agent (ST-LN-10 10-ac-1)', async () => {
  // agentTargets installs agent files for the claude runtime only (D-18): the model rule is a CLI check, so it answers the same for the other three tools.
  const text = plan('src/csv.ts (new, like src/json.ts)');
  const answers: Found[][] = [];
  for (const runtimes of ['runtimes: [claude]', 'runtimes: [codex, cursor, copilot]']) {
    const { repo } = await planned(text, CONFIG.replace('runtimes: [claude]', runtimes));
    try {
      expect(readFileSync(join(repo, 'accord', 'config.yml'), 'utf8')).toContain(runtimes);
      const got = await gate(repo);
      expect(got.code).toBe(1);
      answers.push(got.found);
    } finally {
      cleanup(repo);
    }
  }
  expect(answers[0].map((f) => f.rule)).toEqual(['gate.task-model-missing']);
  expect(answers[1]).toEqual(answers[0]);
  expect(answers[1][0].reason).toContain('task 1');
  expect(answers[1][0].reason).toContain('src/c.ts');
});

it('risk:complex-branching a ticket claimed before 0.6.0 keeps the bare (new) on real git (ST-LN-10 10-ac-1)', async () => {
  const { repo } = await planned(plan('src/csv.ts (new, like src/nope.ts)'), CONFIG, '0.5.1');
  try {
    const got = await gate(repo);
    expect(got.found).toEqual([]);
  } finally {
    cleanup(repo);
  }
});

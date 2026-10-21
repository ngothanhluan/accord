import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const root = fileURLToPath(new URL('../../../', import.meta.url));
const fixtures = join(root, 'packages/core/test/fixtures/benchmark');

it('ac-4 the compliance check finds the four known breaches', async () => {
  const { readSessions } = (await import(new URL('../../../scripts/benchmark.mjs', import.meta.url).href)) as {
    readSessions: (dirs: string[]) => { runs: unknown[]; refusals: unknown[] };
  };
  const { compliance, render } = (await import(new URL('../../../scripts/compliance.mjs', import.meta.url).href)) as {
    compliance: (input: unknown) => unknown;
    render: (result: unknown) => string;
  };
  const s = readSessions([join(fixtures, 'projects', 'C--Work-accord')]);
  const commits = JSON.parse(readFileSync(join(fixtures, 'commits.json'), 'utf8')) as { sha: string; at: number; message: string }[];
  const read = (p: string) => (existsSync(p) ? readFileSync(p, 'utf8') : '');
  const tickets = Object.fromEntries(
    ['BUG-LN-3', 'ST-LN-7'].map((id) => [id, { review: read(join(root, 'accord/tickets', id, 'review.md')), ledger: read(join(root, 'accord/tickets', id, 'ledger.md')) }]),
  );
  const schemas = readFileSync(join(fixtures, 'schemas.test.ts.txt'), 'utf8');
  const out = render(
    compliance({
      runs: s.runs,
      refusals: s.refusals,
      commits: [],
      tickets,
      settings: { tierUp: 4, executorModel: 'sonnet' },
      commitInfo: (short: string) => commits.find((c) => c.sha.startsWith(short)),
      testFile: (p: string) => (p === 'packages/core/test/schemas.test.ts' ? schemas : undefined),
    }),
  );
  const lines = out.split('\n');
  const one = (...parts: string[]) => {
    const hit = lines.filter((l) => parts.every((p) => l.includes(p)));
    expect(hit, parts.join(' | ')).toHaveLength(1);
    return hit[0];
  };
  one('- tier-up: ', 'BUG-LN-3 review round 4', 'asked for sonnet where escalation.fix_round_tier_up asks for opus', 'C--Work-accord/c3d77780-626d-4476-ae0d-3058eca7e240/subagents/agent-aae0cafc466e597f4.jsonl');
  one('- trailer: ', 'ST-LN-7 task 1', 'commit 0496cf0', 'Co-Authored-By');
  const testFirst = one('- test-first: ', 'ST-LN-7 task 4', 'C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3/subagents/agent-ae0a4407a746836a7.jsonl');
  expect(testFirst).not.toMatch(/[A-Za-z]:[\\/]/);
  expect(testFirst).not.toContain('<home>');
  one('- verify-id: ', 'ST-LN-7 task 2', 'inside describe(', 'C--Work-accord/4c922939-083e-4f93-af28-1fbb994a4bf3.jsonl');
  expect(out).toContain('| tier-up | 1 |');
  for (const rule of ['trailer', 'test-first', 'verify-id']) expect(out).toContain(`| ${rule} |`);

  const script = readFileSync(join(root, 'scripts/compliance.mjs'), 'utf8');
  for (const named of ['BUG-LN-3', 'ST-LN-7', '0496cf0', 'ca75fa2', 'aae0caf', 'ae0a440']) expect(script).not.toContain(named);

  const files = [...(readdirSync(join(fixtures, 'projects'), { recursive: true }) as string[]).map((f) => join(fixtures, 'projects', f)), join(fixtures, 'commits.json')].filter((f) => statSync(f).isFile());
  expect(files.length).toBeGreaterThan(5);
  for (const f of files) {
    for (const line of readFileSync(f, 'utf8').split('\n')) {
      expect(line).not.toMatch(/[A-Za-z]:[\\/]+Users[\\/]/i);
      expect(line).not.toMatch(/\/[a-z]\/Users\//i);
      expect(line).not.toMatch(/[\w.+-]+@[\w-]+(\.[\w-]+)+/);
      expect(line).not.toMatch(/"thinking"/);
    }
  }
});

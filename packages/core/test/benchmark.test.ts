import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';

const repo = fileURLToPath(new URL('../../../', import.meta.url));
const sentence = (n: number, mark = '') => `${Array.from({ length: n }, (_, i) => (i === 3 && mark ? mark : `word${i}`)).join(' ')}.`;
const lines = (...rs: object[]) => rs.map((r) => JSON.stringify(r)).join('\n') + '\n';
const text = (timestamp: string, gitBranch: string, body: string) => ({
  type: 'assistant', timestamp, gitBranch, message: { content: [{ type: 'text', text: body }] },
});
const s30 = sentence(30), s40 = sentence(40), s28 = sentence(28, 'pass'), s50 = sentence(50);

function run(withBranch: boolean, withAgent: boolean): string {
  const dir = mkdtempSync(join(tmpdir(), 'bench-'));
  try {
    writeFileSync(join(dir, 'a.jsonl'), lines(
      { type: 'summary' },
      { type: 'user', timestamp: '2026-10-19T23:59:00.000Z', gitBranch: 'main', message: { content: 'hi' } },
      text('2026-10-20T00:01:00.000Z', 'main', `${s30}\nDone.`),
    ));
    if (withBranch) {
      writeFileSync(join(dir, 'b.jsonl'), lines(
        text('2026-10-20T08:00:00.000Z', 't/ST-LN-33', `${s40} ${s28} one two three four five.`),
      ));
    }
    if (withAgent) {
      const sub = join(dir, 'a', 'subagents');
      mkdirSync(sub, { recursive: true });
      writeFileSync(join(sub, 'agent-1.jsonl'), lines(text('2026-10-20T09:00:00.000Z', 't/ST-LN-33', s50)));
      writeFileSync(join(sub, 'agent-1.meta.json'), JSON.stringify({ agentType: 'accord-critic', description: 'critic ST-LN-33' }));
    }
    return execFileSync(process.execPath, [join(repo, 'scripts', 'benchmark.mjs'), dir], { cwd: repo, encoding: 'utf8' });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

it('ac-4 the benchmark report shows the sentence lengths of each main session', () => {
  const out = run(true, true);
  const section = out.slice(out.indexOf('## Sentence length in owner-facing text'));
  const all = section.split('\n');
  expect(section).toContain('start (UTC) | branch | sentences | over 25 words | % over 25 | longest (words)');
  const rows = all.slice(all.findIndex((l) => l.startsWith('| --- ')) + 1).filter((l) => l.startsWith('| '));
  expect(rows).toEqual(['| 2026-10-19 | main | 2 | 1 | 50% | 30 |', '| 2026-10-20 | t/ST-LN-33 | 3 | 2 | 67% | 40 |']);
  expect(all.filter((l) => l.startsWith('- '))).toEqual([`- 40 words: "${s40}"`, `- 30 words: "${s30}"`, `- 28 words: "${s28}"`]);
  expect(section).not.toContain(s50);
  const rest = all.filter((l) => !(l.startsWith('- ') && l.includes('words: "'))).join('\n');
  expect(rest).not.toMatch(/\b(pass|fail)\b/i);
}, 60000);

it('risk:complex-branching the benchmark prints its report for a folder with main sessions and no subagent run', () => {
  const out = run(false, false);
  expect(out).toContain('0 subagent runs');
  expect(out).toContain('| 2026-10-19 | main | 2 | 1 | 50% | 30 |');
}, 60000);

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';

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
    expect(text.split('\n').filter((l) => l.startsWith('## '))).toEqual(['## Understood', '## Done when']);
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

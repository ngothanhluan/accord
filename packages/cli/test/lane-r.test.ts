// ST-LN-94 94-ac-1, D-13: `accord new ticket --lane R` writes the research template, and `accord gate ready` gates it on real git.
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, makeEmptyRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

type F = { rule: string; reason: string; file: string; level: string };

const fill = (text: string) =>
  text
    .replace('## Question\n', '## Question\nDoes the critic need a second round?\n')
    .replace('## Timebox\n', '## Timebox\n4 hours\n')
    .replace('## Token budget\n', '## Token budget\n800k weighted tokens\n');
const DECISION = '- D-01 Timebox 4 hours, token budget 800k weighted tokens — "four hours and 800k is enough"\n';
const decide = (text: string) => text.replace(/(## Decisions\n(?:<!--[\s\S]*?-->\n)?)/, '$1' + DECISION);

it('risk:complex-branching accord new ticket --lane R writes the research template and gate ready gates it (ST-LN-94 94-ac-1)', async () => {
  const repo = makeEmptyRepo();
  writeFiles(repo, { 'accord/config.yml': CONFIG });
  try {
    const made = await run(['new', 'ticket', 'R-1', '--lane', 'R'], repo);
    expect(made.code).toBe(0);
    expect(made.out).toBe('accord/tickets/R-1.md\n');
    const file = join(repo, 'accord', 'tickets', 'R-1.md');
    const text = readFileSync(file, 'utf8');
    expect(text).toContain('id: "R-1"');
    expect(text).toMatch(/^lane: "?R"?/m);
    const heads = text.split('\n').filter((l) => l.startsWith('## '));
    for (const h of ['## Question', '## Timebox', '## Token budget', '## Decisions']) expect(heads).toContain(h);
    expect(heads).not.toContain('## Approach');
    expect(heads).not.toContain('## Acceptance criteria');

    const first = await run(['gate', 'ready', 'R-1', '--json'], repo);
    expect(first.code).toBe(1);
    const missing = (JSON.parse(first.out).findings as F[]).filter((f) => f.rule === 'gate.research-field-missing');
    expect(missing).toHaveLength(3);
    for (const name of ['Question', 'Timebox', 'Token budget']) expect(missing.some((f) => f.reason.includes(`"## ${name}"`)), name).toBe(true);

    writeFileSync(file, decide(fill(text)));
    const done = await run(['gate', 'ready', 'R-1', '--json'], repo);
    expect(JSON.parse(done.out).findings).toEqual([]);
    expect(done.code).toBe(0);
    expect(done.err).toContain('wrote ac_hash');
    expect(readFileSync(file, 'utf8')).toMatch(/^ac_hash: "?fnv1a64:[0-9a-f]{16}"?/m);
  } finally {
    cleanup(repo);
  }
}, 120_000);

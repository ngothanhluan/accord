// Phase 8.1 U-2: the config text `accord audit` reads is hostile input; a ruff `select` list is found in time linear in the file, however many `select=[` it repeats.
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, expect, it } from 'vitest';
import { machineFacts } from '../src/load/audit-facts.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) rmSync(dirs.pop() as string, { recursive: true, force: true });
});

const sandbox = (name: string, text: string): string => {
  const dir = mkdtempSync(join(tmpdir(), 'accord-facts-'));
  dirs.push(dir);
  writeFileSync(join(dir, name), text);
  return dir;
};

it('risk:resource a 640 KB ruff config of repeated select=[ is read at once (U-2)', () => {
  const hostile = 'select=['.repeat(80_000);
  for (const text of [hostile, hostile + ']', '[tool.ruff]\n' + hostile]) {
    const name = text.startsWith('[tool.ruff]') ? 'pyproject.toml' : 'ruff.toml';
    const root = sandbox(name, text);
    const started = Date.now();
    const facts = machineFacts(root, [name]);
    expect(Date.now() - started, 'a quadratic scan took 20 s on this input').toBeLessThan(2000);
    expect(facts.linters.map((l) => l.tool)).toContain('ruff');
  }
});

it('risk:parsing the ruff select lists are still read, select and extend-select, one list at a time (U-2)', () => {
  const root = sandbox('ruff.toml', '[lint]\nselect = ["E", "F"]\nextend-select = [\n  "B",\n  "UP",\n]\nignore = ["E501"]\n');
  expect(machineFacts(root, ['ruff.toml']).rules).toEqual(['B', 'E', 'F', 'UP']);
});

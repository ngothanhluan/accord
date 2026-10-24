// base-stages.json is the stage map of d5db8c3 computed with core; fingerprints.json holds each ticket's records as ST-LN-48 left them, and a ticket whose records changed since is skipped.
// If a deliberate change to core's stage logic makes this test fail, delete this file and packages/core/test/fixtures/st-ln-48/: they guarded only ST-LN-48's translation.
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { expect, it } from 'vitest';
import { loadSnapshot, statusRows, type SnapshotInput } from '../src/index.js';
import { readDir } from './helpers/fixture.js';

export function accordInput(dir: URL): SnapshotInput {
  const files: Record<string, string> = {};
  for (const [k, v] of Object.entries(readDir(new URL('accord/', dir)).files)) files['accord/' + k] = v;
  return { files, tree: Object.keys(files).sort() };
}

export function stagesOf(input: SnapshotInput): Record<string, string> {
  const out: Record<string, string> = {};
  for (const row of statusRows(loadSnapshot(input))) {
    if (row.stage !== undefined && row.id !== 'ST-LN-48') out[row.id] = row.stage;
  }
  return out;
}

export function fingerprint(files: Record<string, string>, id: string): string {
  const paths = [
    `accord/tickets/${id}.md`,
    `accord/tickets/${id}/ledger.md`,
    `accord/tickets/${id}/plan.md`,
    `accord/tickets/${id}/review.md`,
    `accord/tickets/${id}/verification.md`,
  ];
  const h = createHash('sha256');
  for (const p of paths) h.update(p + '\n' + (files[p] ?? '').replace(/\r\n/g, '\n') + '\0');
  return h.digest('hex');
}

const read = (n: string): Record<string, string> =>
  JSON.parse(readFileSync(new URL('./fixtures/st-ln-48/' + n, import.meta.url), 'utf8'));

it('ac-3 every ticket keeps the stage it had on the base commit', () => {
  const base = read('base-stages.json');
  const prints = read('fingerprints.json');
  const input = accordInput(new URL('../../../', import.meta.url));
  const now = stagesOf(input);
  const compared = Object.keys(base).filter(
    (id) => Object.hasOwn(prints, id) && prints[id] === fingerprint(input.files, id),
  );
  expect(compared.length).toBeGreaterThan(0);
  expect(compared.filter((id) => now[id] !== base[id]).map((id) => `${id}: ${base[id]} -> ${now[id]}`)).toEqual([]);
});

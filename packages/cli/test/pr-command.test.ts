// Phase 8.1 G2 (D-01, D-03): `accord pr <id>` writes a pull request title and a body file from the team's template and the ticket; the skills only pass them to `gh pr create`.
// Real git in tmp sandboxes; nothing here reaches the real origin and `gh` is never spawned.
import { readFileSync } from 'node:fs';
import { afterEach, expect, it } from 'vitest';
import { CONFIG } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, makeLaneRepo, run } from './helpers/repo.js';

const dirs: string[] = [];
afterEach(() => {
  while (dirs.length > 0) cleanup(dirs.pop() as string);
});

const TEMPLATE = ['## Description', '<!-- What does this change? -->', '', '## Acceptance criteria', '', '## Screenshots', '<!-- add screenshots -->', ''].join('\n');

function sandbox(extra: Record<string, string> = {}): string {
  const repo = makeLaneRepo({ 'accord/config.yml': CONFIG, ...extra });
  dirs.push(repo);
  commitAll(repo);
  return repo;
}

it('risk:complex-branching accord pr writes a body from the team template that holds id title Intent and criteria (8.1-ac-1)', async () => {
  const repo = sandbox({ '.github/pull_request_template.md': TEMPLATE });
  const r = await run(['pr', 'T-1'], repo);
  expect(r.code, r.out + r.err).toBe(0);

  const lines = r.out.trimEnd().split('\n');
  const file = /^body-file: (.+)$/m.exec(r.out)?.[1] ?? '';
  expect(lines.map((l) => l.split(':')[0])).toEqual(['title', 'body-file', 'template', 'remaining']);
  expect(lines[0]).toBe('title: T-1: Export');
  expect(file).not.toBe('');
  expect(file).not.toContain('\\');
  expect(lines[2]).toBe('template: .github/pull_request_template.md');
  expect(lines[3]).toBe('remaining: Screenshots');

  const body = readFileSync(file, 'utf8');
  for (const text of ['T-1', 'Export', 'Owners can export their report as CSV.', 'export writes a csv', 'commas are escaped']) expect(body, text).toContain(text);
  let at = -1;
  for (const heading of TEMPLATE.split('\n').filter((l) => l.startsWith('## '))) {
    const next = body.split('\n').indexOf(heading, at + 1);
    expect(next, `the heading ${heading} is kept in order`).toBeGreaterThan(at);
    at = next;
  }
});

// The workflow-layer commands end to end, in-process through runCli (STACK Decision 7), each against its
// own sandbox so a write can never reach a fixture.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { cleanup, makeLaneRepo, run } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';

const ticketText = (repo: string, id = 'T-1') => readFileSync(join(repo, 'accord', 'tickets', id + '.md'), 'utf8');

describe('accord approve', () => {
  it('writes approved_hash once and is a no-op the second time', async () => {
    const repo = makeLaneRepo();
    try {
      const first = await run(['approve', 'T-1'], repo);
      expect(first.code).toBe(0);
      expect(first.out).toMatch(/^approved accord\/tickets\/T-1\.md at fnv1a64:[0-9a-f]{16}\n$/);
      const text = ticketText(repo);
      expect(text).toMatch(/\napproved_hash: "fnv1a64:[0-9a-f]{16}"\n/);
      const second = await run(['approve', 'T-1'], repo);
      expect(second.code).toBe(0);
      expect(second.out).toMatch(/^already approved accord\/tickets\/T-1\.md/);
      expect(ticketText(repo)).toBe(text);
    } finally {
      cleanup(repo);
    }
  });

  it('refuses a ticket without lane, exit 2', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/T-2.md': laneTicket('T-2', { lane: '' }) });
    try {
      const r = await run(['approve', 'T-2'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('accord/tickets/T-2.md has no lane:');
    } finally {
      cleanup(repo);
    }
  });

  it('refuses an unknown ticket, exit 2', async () => {
    const repo = makeLaneRepo();
    try {
      const r = await run(['approve', 'NOPE'], repo);
      expect(r.code).toBe(2);
      expect(r.err).toContain('no ticket NOPE in accord/tickets/');
    } finally {
      cleanup(repo);
    }
  });

  it('after approval gate ready passes', async () => {
    const repo = makeLaneRepo();
    try {
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(1);
      await run(['approve', 'T-1'], repo);
      expect((await run(['gate', 'ready', 'T-1'], repo)).code).toBe(0);
    } finally {
      cleanup(repo);
    }
  });
});

// Phase 10 D-01, 10-ac-3, 10-ac-11: `accord round <id> --approach` and `--plan` on real git. A ticket whose claim commit holds 0.24.0 gets one critique round of each kind;
// a ticket claimed under 0.23.1 answers as it did at b4477211, byte for byte.
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { cleanup, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { CONFIG } from '../../../test/helpers/lane.js';

const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const rec = (...rounds: string[][]): string =>
  'Round record: 1\n\n' + rounds.map((lines, i) => `## Round ${i + 1} (${i === 0 ? 'whole' : 'diff'})\n\n${lines.join('\n')}\n\n`).join('');

/** The claim commit under `claimPin`, then the record (when given) committed under CONFIG: the shape of a ticket claimed at one release and worked on at another. */
function claimed(claimPin: string, files: Record<string, string> = {}): string {
  const repo = makeLaneRepo();
  writeFiles(repo, { 'accord/config.yml': pinned(claimPin) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': CONFIG, ...(Object.keys(files).length === 0 ? { 'notes.txt': 'work after the claim\n' } : files) });
  commitMsg(repo, 'T-1 critique');
  return repo;
}

it('risk:regression accord round --approach gives round 1 of 1 to a ticket claimed at 0.24.0 (10-ac-3, D-01)', async () => {
  const repo = claimed('0.24.0');
  try {
    expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 1 of 1\nCycle: 1\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --approach refuses an ordinary round 2 and names the one critique round of D-01 (10-ac-3, D-01)', async () => {
  const repo = claimed('0.24.0', { [APPROACH]: rec(['1. Should — the impact list misses a caller — fixed']) });
  try {
    const answer = await run(['round', 'T-1', '--approach'], repo);
    expect(answer.code).toBe(1);
    expect(answer.out.startsWith('refused:')).toBe(true);
    expect(answer.out.split('\n')[0]).toContain('D-01');
    expect(answer.out).toContain('one approach critique round');
    expect(answer.out).toContain('Findings still open: none');
    expect(answer.out).not.toContain('stop: report to owner');
  } finally {
    cleanup(repo);
  }
}, 120_000);

it('risk:regression accord round --approach keeps round 2 of 2 for a ticket claimed under 0.23.1 (10-ac-11)', async () => {
  const repo = claimed('0.23.1', { [APPROACH]: rec(['1. Should — the impact list misses a caller — fixed']) });
  try {
    expect(await run(['round', 'T-1', '--approach'], repo)).toEqual({ code: 0, out: 'Round: 2 of 2\nCycle: 1\n', err: '' });
  } finally {
    cleanup(repo);
  }
}, 120_000);

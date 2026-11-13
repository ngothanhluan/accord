// ST-LN-91 round 6 (owner decision 2026-11-13): the corpus of review probes (test/helpers/approach-corpus.ts) through the real CLI, on real git. Each row is run as `accord approve T-1`
// and `accord show T-1 --approval --short` against a ticket claimed at the row's pin; the exit code, the Blocking findings and the Risks are what the owner decisions require.
// Every row runs in packages/core/test/approach-record-corpus.test.ts on the same functions the CLI calls; a git repository per ticket costs about a second, so the CLI runs one row
// per shape: each outcome, each claim, lane S and lane L, the colon form, the indented note, the column-0 line, a non-kind risk value and the normal record.
// The CLI runs as the cut-off release (0.4.1), as cutoff-pin.test.ts does: only then does a ticket claimed under 0.4.0 differ from one claimed now.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { APPROACH_CAP_FROM } from '@accord-dev/accord-core';
import { ROWS } from '../../../test/helpers/approach-corpus.js';
import type { Row } from '../../../test/helpers/approach-corpus.js';
import { CONFIG, LANE_S_BODY, laneTicket } from '../../../test/helpers/lane.js';
import { cleanup, commitAll, commitMsg, makeLaneRepo, run, writeFiles } from './helpers/repo.js';

vi.mock('../package.json', async (orig) => {
  const m = await orig<{ default: Record<string, unknown> }>();
  return { default: { ...m.default, version: '0.4.1' } };
});

const pinned = (v: string): string => CONFIG.replace(/accord: "[^"]*"/, `accord: "${v}"`);
const APPROACH = join('accord', 'tickets', 'T-1', 'approach-review.md');
const TICKET = join('accord', 'tickets', 'T-1.md');

function recordOf(r: Row): string {
  const second = r.r2 === null ? '' : '## Round 2 (diff)\n\n' + (r.r2 ?? ['No findings']).join('\n') + '\n\n';
  return 'Round record: 1\n\n## Round 1 (whole)\n\n' + r.r1.join('\n') + '\n\n' + second + (r.tail ?? '');
}

/** A ticket claimed under `claim`, with a placeholder approach record committed at the running version's pin; each row then rewrites the record in the checkout. */
function claimed(claim: string, lane: string): string {
  const extra = lane === 'M' ? {} : { [TICKET]: laneTicket('T-1', lane === 'S' ? { lane, body: LANE_S_BODY } : { lane }) };
  const repo = makeLaneRepo(extra);
  writeFiles(repo, { 'accord/config.yml': pinned(claim) });
  commitMsg(repo, 'claim: T-1');
  writeFiles(repo, { 'accord/config.yml': pinned(APPROACH_CAP_FROM), [APPROACH]: 'Round record: 1\n\n## Round 1 (whole)\n\n1. Should — a — fixed\n\n## Round 2 (diff)\n\nNo findings\n\n' });
  commitAll(repo, 'T-1 approach record');
  return repo;
}

/** The lines of one `## <heading>` section of the short view, the `- ` bullet and the `round <n>: ` prefix removed. */
function section(out: string, heading: string): string[] {
  const parts = ('\n' + out).split('\n## ');
  const body = parts.find((p) => p.startsWith(heading + '\n'));
  if (body === undefined) return [];
  return body
    .split('\n\n')
    .slice(1)
    .join('\n')
    .split('\n')
    .filter((l) => l.startsWith('- round '))
    .map((l) => l.replace(/^- round \d+: /, ''));
}

const CLI_ROWS = new Set([
  'r1-CR02-no-findings-round-2',
  'r1-CR02-round-1-only',
  'r2-A-unmarked-repeat',
  'r2-B-owner-drop-with-words',
  'r2-D-legacy-open-risk',
  'r2-S-lane-s-leftover',
  'r2-lane-L-capped',
  'r3-H2-rests-on-risk',
  'r3-NM2-unreadable-severity',
  'r4-F3-normal-record',
  'r4-N1-critic-block-verbatim',
  'r5-B1-risks-plural',
  'r5-B3-security-risk-prose',
  'r6-CR01-colon-risk-before-state',
  'r6-CR01-colon-bad-slot-before-state',
  'r6-CR02-indented-risk-note-under-fixed',
  'r6-WR01-risk-none-after-ground',
  'r6-WR02-column-0-rests-on-under-finding',
  'r6-WR02-rests-on-risk-no-colon',
  'r6-X7-bold-severity-and-mark',
  'r6-N-prose-nice-open',
  'legacy-form-12',
  'r7-CR01-one-off-date-loss-after-state',
  'r7-CR01-one-off-block-date-loss',
  'r8-VR01-E1-data-slash-loss',
  'r8-VR01-E6-block-securi-space-ty',
  'r7-CR02-G1-line-ac-block-D',
  'r7-CR02-G4-open-two-block-grounds-r2',
]);
const SHAPES = ROWS.filter((r) => CLI_ROWS.has(r.id));
const repos = new Map<string, string>();
const key = (r: Row): string => (r.claim ?? '0.4.1') + '/' + (r.lane ?? 'M');
beforeAll(() => {
  expect(SHAPES, 'every named row exists').toHaveLength(CLI_ROWS.size);
  for (const r of SHAPES) if (!repos.has(key(r))) repos.set(key(r), claimed(r.claim ?? '0.4.1', r.lane ?? 'M'));
}, 120_000);
afterAll(() => {
  for (const repo of repos.values()) cleanup(repo);
});

for (const r of SHAPES) {
  it('risk:security corpus through the CLI ' + r.id + ' is ' + r.out + ' (' + r.src + ')', async () => {
    const repo = repos.get(key(r))!;
    const ticket = readFileSync(join(repo, TICKET));
    writeFiles(repo, { [APPROACH]: recordOf(r) });
    const first = r.r1[0].trim();
    const short = await run(['show', 'T-1', '--approval', '--short'], repo);
    const approve = await run(['approve', 'T-1'], repo);
    // `approve` stamps the ticket when it approves: put the ticket back for the next row.
    writeFiles(repo, { [TICKET]: ticket.toString('utf8') });
    expect(short.code, r.id + ' show exit').toBe(0);
    const blocking = section(short.out, 'Blocking findings');
    const risks = section(short.out, 'Risks');
    switch (r.out) {
      case 'BLOCK':
        expect(approve.code, r.id + ' approve exit: ' + approve.out + approve.err).toBe(1);
        expect(approve.out).toContain('Blocking findings:');
        expect(blocking, r.id + ' blocking').toEqual((r.block ?? [first]).map((x) => x.trim()));
        expect(risks, r.id + ' risks').toEqual((r.list ?? []).map((x) => x.trim()));
        break;
      case 'LIST':
        expect(approve.code, r.id + ' approve exit: ' + approve.out + approve.err).toBe(0);
        expect(blocking, r.id + ' blocking').toEqual([]);
        expect(risks, r.id + ' risks').toEqual((r.list ?? [first]).map((x) => x.trim()));
        break;
      case 'PASS':
        expect(approve.code, r.id + ' approve exit: ' + approve.out + approve.err).toBe(0);
        expect(blocking, r.id + ' blocking').toEqual([]);
        expect(risks, r.id + ' risks').toEqual([]);
        break;
      case 'PROBLEM':
        expect(approve.code, r.id + ' approve exit').toBe(1);
        expect(approve.out, r.id + ' names the record problem').toContain('Record problems');
        expect(short.out).toContain('record problem:');
        break;
      case 'LEGACY':
        expect(approve.code, r.id + ' approve exit: ' + approve.out + approve.err).toBe(0);
        expect(blocking, r.id + ' blocking').toEqual([]);
        expect(risks, r.id + ' risks').toEqual((r.list ?? []).map((x) => x.trim()));
        break;
      case 'LANE-S':
        expect(approve.code, r.id + ' approve exit: lane S needs no approval').toBe(2);
        expect(blocking, r.id + ' blocking').toEqual([]);
        break;
    }
  }, 60_000);
}

// A ticket with no `claim:` commit gets the new rules (owner decision 2026-11-12, fail closed): an open data-loss finding blocks.
it('risk:security corpus through the CLI no claim commit means the capped rules: an open data-loss finding blocks (round 6 NC)', async () => {
  const repo = makeLaneRepo();
  try {
    writeFiles(repo, { 'accord/config.yml': pinned(APPROACH_CAP_FROM), [APPROACH]: 'Round record: 1\n\n## Round 1 (whole)\n\n1. Must — rows — open — risk: data-loss\n\n## Round 2 (diff)\n\nNo findings\n\n' });
    commitAll(repo, 'rounds, no claim commit');
    const approve = await run(['approve', 'T-1'], repo);
    expect(approve.code).toBe(1);
    expect(approve.out).toContain('Blocking findings:');
  } finally {
    cleanup(repo);
  }
}, 60_000);

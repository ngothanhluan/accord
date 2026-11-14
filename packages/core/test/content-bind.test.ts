// ST-LN-96 t1-ac-4, D-04, D-16 Option A: when the recorded verified commit is not in the gated commit's history (a rebase or a team
// script rewrote it), gate done judges the ticket's file contents, supplied by the host as `contentSince`, instead of the sha.
import { expect, it } from 'vitest';
import { loadSnapshot } from '../src/index.js';
import type { ContentSince } from '../src/index.js';
import { gateDone } from '../src/gate/index.js';
import { readFixture } from './helpers/fixture.js';

const HOST = '1234567890abcdef1234567890abcdef12345678';
const GIT = { commit: HOST, authors: {} };
// COMMIT's ticks and REVIEW's verification.md both name 9999999.
const RECORDED = '9999999';

const stale = (id: string, since?: Record<string, ContentSince>) => {
  const snapshot = loadSnapshot({ ...readFixture('gate-done'), git: GIT, ...(since === undefined ? {} : { contentSince: since }) });
  return gateDone(snapshot, id).findings.filter((f) => f.rule === 'gate.tick-stale-commit' || f.rule === 'gate.stale-review');
};

const TODAY = {
  COMMIT: `the ticks were made against commit ${RECORDED}; the gated commit is ${HOST}`,
  REVIEW: `the review was written against commit ${RECORDED}; the gated commit is ${HOST}`,
};
const RULE = { COMMIT: 'gate.tick-stale-commit', REVIEW: 'gate.stale-review' };
const NOT_IN_HISTORY = {
  COMMIT: `the ticks were made against commit ${RECORDED}, which is not in the history of the gated commit ${HOST}; these ticket files changed since: `,
  REVIEW: `the review was written against commit ${RECORDED}, which is not in the history of the gated commit ${HOST}; these ticket files changed since: `,
};

for (const id of ['COMMIT', 'REVIEW'] as const) {
  it(`risk:complex-branching the ${id === 'COMMIT' ? 'ticks stand' : 'review stands'} after a rewrite when the ticket's files are unchanged (ST-LN-96 t1-ac-4)`, () => {
    expect(stale(id, { [RECORDED]: { changed: [] } })).toEqual([]);
  });

  it(`risk:complex-branching the ${id === 'COMMIT' ? 'ticks' : 'review'} are refused after a rewrite naming every changed ticket file (ST-LN-96 t1-ac-4)`, () => {
    const found = stale(id, { [RECORDED]: { changed: ['src/a.ts', 'src/b.ts'] } });
    expect(found.map((f) => f.rule)).toEqual([RULE[id]]);
    expect(found[0].reason).toBe(NOT_IN_HISTORY[id] + 'src/a.ts, src/b.ts');
  });

  it(`risk:security a rewritten commit that is not in this clone refuses the ${id === 'COMMIT' ? 'ticks' : 'review'}, never passes them (ST-LN-96 t1-ac-4)`, () => {
    const found = stale(id, { [RECORDED]: { absent: true } });
    expect(found.map((f) => f.rule)).toEqual([RULE[id]]);
    expect(found[0].reason).toBe(`${TODAY[id]}; the verified commit is not in this clone, so its contents cannot be compared - verify again`);
  });

  it(`risk:regression with no content fact the ${id === 'COMMIT' ? 'ticks' : 'review'} reason is today's, byte for byte (ST-LN-96 t1-ac-4)`, () => {
    const found = stale(id);
    expect(found.map((f) => f.rule)).toEqual([RULE[id]]);
    expect(found[0].reason).toBe(TODAY[id]);
    // A fact for another commit does not apply to this one.
    expect(stale(id, { abcdef1: { changed: [] } })[0].reason).toBe(TODAY[id]);
  });
}

it('risk:security the fact is keyed by the lower-case sha, and a recorded upper-case sha finds it (ST-LN-96 t1-ac-4)', () => {
  const base = readFixture('gate-done');
  // COMMIT records 9999999; record the same sha in upper case and the lower-case key must still apply.
  const files = Object.fromEntries(Object.entries(base.files).map(([k, v]) => [k, k === 'accord/tickets/COMMIT.md' ? v.replace('"9999999"', '"ABCDEF1"') : v]));
  const snapshot = loadSnapshot({ ...base, files, git: GIT, contentSince: { abcdef1: { changed: [] } } });
  expect(gateDone(snapshot, 'COMMIT').findings.filter((f) => f.rule === 'gate.tick-stale-commit')).toEqual([]);
});

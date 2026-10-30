// ST-LN-17 Task 1: review.md and plan-review.md read as round records.
import { expect, it } from 'vitest';
import { cycleOpen, parseRounds } from '../src/index.js';

const REVIEW = 'accord/tickets/T-1/review.md';
const PLAN = 'accord/tickets/T-1/plan-review.md';
const review = (text: string) => parseRounds(REVIEW, text, 'review');
const plan = (text: string) => parseRounds(PLAN, text, 'plan');

it('risk:parsing a finding line is read by its head and a doubtful severity is unreadable', () => {
  const lines = [
    'Must 1 [patch]: the writer drops the header — src/export.ts:3 — open',
    '- should 2 [patch]: x — y — fixed in abc1234',
    '**Nice** 3: x — y — deferred',
    '1. Should — x — open',
    '2) MUST — x — open',
    '(Nice) x — y',
    'Mustard is not a finding',
    'Confirmed wording-only: src/a.ts',
    'verdict: converged',
  ];
  const r = review('Round record: 1\n\n## Round 1\n\n' + lines.join('\n') + '\n');
  expect(r.unreadable).toEqual([]);
  const found = r.cycles[0].rounds[0].findings;
  expect(found.map((f) => f.severity)).toEqual(['Must', 'Should', 'Nice', 'Should', 'Must', 'Nice']);
  expect(found.map((f) => f.text)).toEqual(lines.slice(0, 6));
  expect(found.map((f) => f.line)).toEqual([5, 6, 7, 8, 9, 10]);
  expect(r.cycles[0].rounds[0].noFindings).toBe(false);

  const doubtful = ['Should/Must 1: x', 'Must? x', 'Should or Must 1: x', 'Nice', '**Must**'];
  for (const bad of doubtful) {
    const d = review('Round record: 1\n\n## Round 1\n\nNice 9: z — y — deferred\n' + bad + '\n');
    expect(d.unreadable, bad).toHaveLength(1);
    expect(d.unreadable[0].reason, bad).toContain('severity');
    expect(d.unreadable[0].line, bad).toBe(6);
  }

  const fenced = review('Round record: 1\n\n## Round 1\n\n```\nMust 1: inside a fence\n```\nNo findings\n');
  expect(fenced.unreadable).toEqual([]);
  expect(fenced.cycles[0].rounds[0].findings).toEqual([]);
  expect(fenced.cycles[0].rounds[0].noFindings).toBe(true);
});

it('risk:parsing cycles split at a return from verify and at a closed line and a heading out of place is unreadable', () => {
  const two =
    'Round record: 1\n\n## Round 1\n\nMust 1: x — y — fixed\n\n## Round 2\n\nNo findings\n\nverdict: converged\n\n' +
    '## Return from verify abc1234\n\n## Round 1\n\nNice 1: x — y — deferred\n';
  const r = review(two);
  expect(r.versioned).toBe(true);
  expect(r.unreadable).toEqual([]);
  expect(r.cycles).toHaveLength(2);
  expect(r.cycles[0].rounds).toHaveLength(2);
  expect(r.cycles[0].verdicts).toEqual([{ value: 'converged', quoted: false, line: 11 }]);
  expect(r.cycles[0].marker).toBeUndefined();
  expect(r.cycles[1].marker).toBe('abc1234');
  expect(r.cycles[1].rounds).toHaveLength(1);
  expect(cycleOpen(r.cycles[0])).toBe(false);
  expect(cycleOpen(r.cycles[1])).toBe(true);
  expect(cycleOpen(review(two + 'verdict: converged\n').cycles[1])).toBe(false);

  const quoted = review('Round record: 1\n\n## Round 1\n\nNice 1: x\n\nverdict: accepted-by-owner "ship it"\n');
  expect(quoted.cycles[0].verdicts[0]).toMatchObject({ value: 'accepted-by-owner', quoted: true });
  const bare = review('Round record: 1\n\n## Round 1\n\nNice 1: x\n\nverdict: accepted-by-owner\n');
  expect(bare.cycles[0].verdicts[0]).toMatchObject({ value: 'accepted-by-owner', quoted: false });

  const p = plan('Round record: 1\n\n## Round 1 (whole)\n\n1. Must — x — fixed\n\n## Closed\n\n## Round 1 (whole)\n\nNo findings\n');
  expect(p.unreadable).toEqual([]);
  expect(p.cycles).toHaveLength(2);
  expect(p.cycles[0].closed).toBe(7);
  expect(p.cycles[0].rounds).toHaveLength(1);
  expect(p.cycles[1].rounds).toHaveLength(1);

  const head = 'Round record: 1\n\n';
  const bad: { kind: 'review' | 'plan'; text: string; reason: string }[] = [
    { kind: 'review', text: head + '## Round 1\n\nNo findings\n\n## Notes\n\nsome words\n', reason: '"## Notes"' },
    { kind: 'review', text: head + '## Round 1\n\nNo findings\n\n## Closed\n', reason: '"## Closed"' },
    { kind: 'plan', text: head + '## Round 1\n\nNo findings\n\n## Return from verify abc1234\n', reason: '"## Return from verify abc1234"' },
    { kind: 'review', text: head + '## Round 1\n\nNo findings\n\n## Return from verify\n\n## Round 1\n\nNo findings\n', reason: 'names no commit sha' },
    { kind: 'review', text: head + '## Round\n\nNo findings\n', reason: 'names no round number' },
    { kind: 'review', text: head + '## Round 1\n\nNo findings\n\n## Round 2\n\nsome prose only\n', reason: 'round 2 at line 7' },
    { kind: 'review', text: head + '## Round 1\n\nNo findings\nMust 1: x — y — open\n', reason: 'says No findings and lists findings' },
    { kind: 'review', text: head + '## Round 1\n\nNo findings\n\nverdict: converged\n\n## Round 3\n\nNo findings\n', reason: 'follows the verdict at line 7' },
  ];
  for (const b of bad) {
    const u = parseRounds(b.kind === 'plan' ? PLAN : REVIEW, b.text, b.kind).unreadable;
    expect(u.length, b.reason).toBeGreaterThan(0);
    expect(u.map((x) => x.reason).join('\n'), b.reason).toContain(b.reason);
    expect(u.every((x) => x.reason.startsWith('line ') || x.reason.startsWith('round ')), b.reason).toBe(true);
  }

  const accepted = plan(head + '## Round 1\n\nShould 1: x — y — open\n\nverdict: accepted-by-owner "go"\n\n## Round 2\n\nNo findings\n');
  expect(accepted.unreadable).toEqual([]);

  expect(review('## Round 1\n\nNo findings\n').versioned).toBe(false);
  expect(review('## Round 1\n\nRound record: 1\nNo findings\n').versioned).toBe(false);
  expect(review('Round record: 1\n').versioned).toBe(true);

  const lf = 'Round record: 1\n\n## Round 1\n\nMust 1: x — y — open\n\n## Round 2\n\nNo findings\n';
  expect(review(lf.replace(/\n/g, '\r\n'))).toEqual(review(lf));
  expect(review('﻿' + lf.replace(/\n/g, '\r\n'))).toEqual(review(lf));
});

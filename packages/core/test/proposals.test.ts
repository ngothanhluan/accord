// Phase 8.4 D-07, D-08: `mergeProposals` merges the onboarding scan's proposals with `accord init`'s in code: init's wins on the same key, an ancestor or a descendant,
// and the first scan proposal for a key wins over a later overlapping one. Pure: no file is read here.
import { describe, expect, it } from 'vitest';
import { mergeProposals } from '../src/index.js';

describe('mergeProposals keeps init first and drops overlapping scan proposals', () => {
  it("risk:complex-branching init's proposal wins over the scan's on the same key an ancestor or a descendant (D-08)", () => {
    const init = [{ key: 'git', value: { merge: 'squash' }, evidence: '37 of 40 commits' }];
    const scan = [
      { key: 'git', value: { merge: 'rebase' }, evidence: '3 workflow files' },
      { key: 'git.merge', value: 'merge', evidence: 'the last 12 pull requests' },
      { key: 'stale_days', value: '21', evidence: 'the last 21 days' },
    ];
    const merged = mergeProposals(init, scan);
    expect(merged.proposals).toEqual([init[0], scan[2]]);
    expect(merged.dropped).toEqual([
      { ...scan[0], reason: 'accord init proposes git' },
      { ...scan[1], reason: 'accord init proposes git' },
    ]);

    // an init key below the scan's key: the scan's ancestor is dropped, a sibling is kept
    const below = mergeProposals(
      [
        { key: 'git.merge', value: 'squash', evidence: '37 of 40 commits' },
        { key: 'commits.subjects', value: { claim: 'x' }, evidence: '12 of 20 commits' },
      ],
      [
        { key: 'git', value: { merge: 'rebase' }, evidence: '3 workflow files' },
        { key: 'commits.message', value: { preset: 'conventional' }, evidence: '12 commits' },
      ],
    );
    expect(below.dropped).toEqual([{ key: 'git', value: { merge: 'rebase' }, evidence: '3 workflow files', reason: 'accord init proposes git.merge' }]);
    expect(below.proposals.map((p) => p.key)).toEqual(['git.merge', 'commits.subjects', 'commits.message']);
  });

  it('risk:regression the first scan proposal for a key is kept and a later overlapping one is dropped (D-08)', () => {
    const merged = mergeProposals([], [
      { key: 'tests', value: { full: 'npm test' }, evidence: '2 files' },
      { key: 'tests.full', value: 'npm run test:all', evidence: '2 files' },
    ]);
    expect(merged.proposals.map((p) => p.key)).toEqual(['tests']);
    expect(merged.dropped).toEqual([{ key: 'tests.full', value: 'npm run test:all', evidence: '2 files', reason: 'the scan already proposes tests' }]);
  });

  it("risk:regression an empty scan list merges to exactly init's proposals (D-08)", () => {
    const init = [{ key: 'git.merge', value: 'squash', evidence: '37 of 40 commits' }];
    expect(mergeProposals(init, [])).toEqual({ proposals: init, dropped: [] });
    expect(mergeProposals([], [])).toEqual({ proposals: [], dropped: [] });
  });
});

describe('mergeProposals drops a scan proposal that is not valid before the key rules', () => {
  const none = (key: string, evidence: string, value: unknown = 'x') => mergeProposals([], [{ key, value, evidence }]);

  it('risk:parsing mergeProposals drops a scan proposal with no config key a key accord writes or no evidence (D-07)', () => {
    expect(none('nosuch.key', '2 files').dropped.map((d) => d.reason)).toEqual(['no config key nosuch.key']);
    expect(none('accord', '2 files').dropped.map((d) => d.reason)).toEqual(['accord writes accord']);
    expect(none('git.merge', '').dropped.map((d) => d.reason)).toEqual(['no evidence with a file and line or a count']);
    expect(none('git.merge', 'no number here').dropped.map((d) => d.reason)).toEqual(['no evidence with a file and line or a count']);
    const long = '2 files ' + 'x'.repeat(501 - '2 files '.length);
    expect(long.length).toBe(501);
    expect(none('git.merge', long).dropped.map((d) => d.reason)).toEqual(['evidence over 500 characters']);
    expect(none('git.merge', long.slice(0, 500)).dropped).toEqual([]);
    // the order: a missing key is named before a missing evidence
    expect(none('nosuch.key', '').dropped.map((d) => d.reason)).toEqual(['no config key nosuch.key']);
  });

  it('risk:parsing mergeProposals keeps a scan evidence only when it cites a path and line or counts things (D-07)', () => {
    for (const evidence of ['Node 22', 'v3', 'Python 3.12', 'Node 22 is the runtime', '37 of 40', '22']) {
      const merged = none('git.merge', evidence, 'squash');
      expect(merged.dropped.map((d) => d.reason), evidence).toEqual(['no evidence with a file and line or a count']);
      expect(merged.proposals, evidence).toEqual([]);
    }
    for (const evidence of ['37 of 40 commits', 'the last 40 pull requests were squash-merged', '2 workflow files', 'src/a.ts:2', 'Node 22 and 3 files']) {
      const merged = none('git.merge', evidence, 'squash');
      expect(merged.dropped, evidence).toEqual([]);
      expect(merged.proposals.map((p) => p.evidence), evidence).toEqual([evidence]);
    }
  });

  it('risk:security mergeProposals hands each remaining scan proposal to the refusal callback and drops it with that reason (D-08)', () => {
    const seen: string[] = [];
    const refuse = (p: { key: string }) => {
      seen.push(p.key);
      return p.key === 'stale_days' ? 'x refused' : undefined;
    };
    const merged = mergeProposals(
      [{ key: 'git.merge', value: 'squash', evidence: '37 of 40 commits' }],
      [
        { key: 'git', value: { merge: 'rebase' }, evidence: '3 workflow files' },
        { key: 'nosuch.key', value: 'x', evidence: '3 workflow files' },
        { key: 'stale_days', value: '21', evidence: 'the last 21 days' },
        { key: 'setup', value: ['npm ci'], evidence: '2 workflow files' },
      ],
      refuse,
    );
    expect(seen).toEqual(['stale_days', 'setup']);
    expect(merged.proposals.map((p) => p.key)).toEqual(['git.merge', 'setup']);
    expect(merged.dropped.map((d) => [d.key, d.reason])).toEqual([
      ['git', 'accord init proposes git.merge'],
      ['nosuch.key', 'no config key nosuch.key'],
      ['stale_days', 'x refused'],
    ]);
  });

  it('risk:parsing a scan evidence written with backslashes is kept with forward slashes (D-07)', () => {
    const merged = none('git.merge', 'src\\load\\config.ts:8', 'squash');
    expect(merged.dropped).toEqual([]);
    expect(merged.proposals).toEqual([{ key: 'git.merge', value: 'squash', evidence: 'src/load/config.ts:8' }]);
    const dropped = none('nosuch.key', 'src\\a.ts:1');
    expect(dropped.dropped).toEqual([{ key: 'nosuch.key', value: 'x', evidence: 'src/a.ts:1', reason: 'no config key nosuch.key' }]);
  });
});

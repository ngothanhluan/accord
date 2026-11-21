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

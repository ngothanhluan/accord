// Phase 8.5 D-14, R-9 (08.5-06): which repository a pull request link names, and whether it is the clone's own. Pure: the CLI reads origin's URL and passes the text.
import { describe, expect, it } from 'vitest';
import { fetchLine, parseRepoUrl, pullRequestOf, repositoryOf } from '../src/product/repo.js';

const LINK = 'https://github.com/acme/widget/pull/7';

describe('pullRequestOf', () => {
  it('risk:security a pull request link is accepted only in the github https shape (R-9 D-14)', () => {
    expect(pullRequestOf(LINK)).toEqual({ owner: 'acme', repo: 'widget', n: 7 });
    expect(pullRequestOf(LINK + '/')).toEqual({ owner: 'acme', repo: 'widget', n: 7 });
    expect(pullRequestOf('https://github.com/Acme/Widget.js/pull/1234567890')).toEqual({ owner: 'Acme', repo: 'Widget.js', n: 1234567890 });
    const refused = [
      'http://github.com/acme/widget/pull/7',
      'ssh://git@github.com/acme/widget/pull/7',
      'git@github.com:acme/widget',
      'ext::sh -c x',
      'file:///tmp/x',
      '-https://github.com/a/b/pull/1',
      'https://github.com/acme/widget/pull/0',
      'https://github.com/acme/widget/pull/01',
      'https://github.com/acme/widget/pull/12345678901',
      'https://github.com/acme/widget/issues/7',
      'https://github.com/-acme/widget/pull/7',
      'https://github.com/acme/../pull/7',
      'https://github.com/acme/./pull/7',
      'https://github.com/acme/widget.git/pull/7',
      'https://github.com/acme/widget/pull/7/files',
      'https://github.com/acme/widget/pull/7?x=1',
      'https://github.com/acme/widget/pull/7 ',
      'https://github.com/acme/wid get/pull/7',
      'https://github.com/' + 'a'.repeat(40) + '/widget/pull/7',
      'https://github.com/acme/' + 'w'.repeat(101) + '/pull/7',
      'https://github.com/acme/widget/pull/7' + '/'.repeat(300),
      // a different host is unparsable on purpose (A6): GitHub Enterprise and the like get no conventions
      'https://ghe.example.com/acme/widget/pull/7',
      '',
    ];
    for (const link of refused) expect(pullRequestOf(link), JSON.stringify(link)).toBeUndefined();
  });
});

describe('parseRepoUrl and repositoryOf', () => {
  it('risk:security origin and the pull request are compared by host owner and repository (R-9 D-14)', () => {
    const same = [
      'https://github.com/Acme/Widget.git',
      'https://github.com/acme/widget/',
      'https://github.com/acme/widget',
      'https://GitHub.com/acme/widget.git/',
      'https://user@github.com/acme/widget.git',
      'ssh://git@github.com/acme/widget.git',
      'ssh://git@github.com:22/acme/widget',
      'git@github.com:acme/widget.git',
      'github.com:acme/widget',
    ];
    for (const origin of same) {
      expect(parseRepoUrl(origin), origin).toEqual({ host: 'github.com', owner: expect.stringMatching(/^acme$/i), repo: expect.stringMatching(/^widget$/i) });
      expect(repositoryOf(pullRequestOf(LINK), origin), origin).toEqual({ kind: 'this' });
    }
    // another repository, a fork among them: a clone whose origin is the fork, the other way round, is `other` too
    expect(repositoryOf(pullRequestOf('https://github.com/someone/fork/pull/7'), 'https://github.com/acme/widget.git')).toEqual({ kind: 'other', owner: 'someone', repo: 'fork' });
    expect(repositoryOf(pullRequestOf(LINK), 'https://github.com/someone/fork.git')).toEqual({ kind: 'other', owner: 'acme', repo: 'widget' });
    // an origin on another host is another repository's, never this one
    expect(repositoryOf(pullRequestOf(LINK), 'https://ghe.example.com/acme/widget.git')).toEqual({ kind: 'other', owner: 'acme', repo: 'widget' });
    // a form accord does not read, or no origin at all
    for (const origin of ['file:///srv/repo', '/srv/repo', 'C:/srv/repo', '', undefined]) {
      const where = repositoryOf(pullRequestOf(LINK), origin);
      expect(where.kind, String(origin)).toBe('unknown');
      expect(where.kind === 'unknown' ? where.why : '').toBe("origin's URL is not a form accord reads");
      expect(parseRepoUrl(origin ?? ''), String(origin)).toBeUndefined();
    }
    // a link accord cannot read says so before it looks at origin
    const bad = repositoryOf(pullRequestOf('ext::sh -c x'), 'https://github.com/acme/widget.git');
    expect(bad).toEqual({ kind: 'unknown', why: 'not a https://github.com/<owner>/<repo>/pull/<n> link' });
  });

  it('risk:security the fetch line is built from the validated parts only and names no remote that is not github over https (R-9 D-14)', () => {
    const pull = pullRequestOf('https://github.com/someone/fork/pull/3');
    expect(fetchLine({ kind: 'this' }, pullRequestOf(LINK))).toBe('origin pull/7/head');
    expect(fetchLine({ kind: 'other', owner: 'someone', repo: 'fork' }, pull)).toBe('https://github.com/someone/fork.git pull/3/head');
    expect(fetchLine({ kind: 'unknown', why: 'x' }, pull)).toBeUndefined();
    expect(fetchLine({ kind: 'this' }, undefined)).toBeUndefined();
  });
});

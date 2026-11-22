// Review 08.5 WR-05: an origin written with a host alias of github.com is this repository's, an owner may hold an underscore, and a host accord cannot place is not called another repository.
import { expect, it } from 'vitest';
import { pullRequestOf, repositoryOf } from '../src/product/repo.js';

const LINK = 'https://github.com/acme/app/pull/5';

it('risk:security an origin on a github.com alias is this repository when owner and repository match (review WR-05)', () => {
  const same = [
    'git@github.com-work:acme/app.git',
    'git@github.com-personal:Acme/App',
    'ssh://git@ssh.github.com:443/acme/app.git',
    'ssh://git@ssh.github.com/acme/app',
    'https://ssh.github.com/acme/app.git',
  ];
  for (const origin of same) expect(repositoryOf(pullRequestOf(LINK), origin), origin).toEqual({ kind: 'this' });
  // the same alias with another repository is another repository
  expect(repositoryOf(pullRequestOf(LINK), 'git@github.com-work:acme/other.git')).toEqual({ kind: 'other', owner: 'acme', repo: 'app' });
  expect(repositoryOf(pullRequestOf(LINK), 'ssh://git@ssh.github.com:443/someone/app.git')).toEqual({ kind: 'other', owner: 'acme', repo: 'app' });
  // a lookalike host is not an alias
  expect(repositoryOf(pullRequestOf(LINK), 'git@github.com.evil.example:acme/app.git').kind).not.toBe('this');
  expect(repositoryOf(pullRequestOf(LINK), 'git@notgithub.com:acme/app.git').kind).not.toBe('this');
});

it('risk:security a host accord cannot place is unknown when owner and repository match, and another repository when they differ (review WR-05)', () => {
  const same = repositoryOf(pullRequestOf(LINK), 'git@gh-work:acme/app.git');
  expect(same.kind).toBe('unknown');
  expect(same.kind === 'unknown' ? same.why : '').toBe("origin's host is not github.com");
  expect(repositoryOf(pullRequestOf(LINK), 'https://ghe.example.com/acme/app.git').kind).toBe('unknown');
  expect(repositoryOf(pullRequestOf(LINK), 'git@gh-work:someone/else.git')).toEqual({ kind: 'other', owner: 'acme', repo: 'app' });
});

it('risk:parsing a pull request of an owner with an underscore is read (review WR-05)', () => {
  expect(pullRequestOf('https://github.com/jane_corp/app/pull/9')).toEqual({ owner: 'jane_corp', repo: 'app', n: 9 });
  expect(pullRequestOf('https://github.com/_jane/app/pull/9')).toBeUndefined();
  expect(repositoryOf(pullRequestOf('https://github.com/jane_corp/app/pull/9'), 'git@github.com:jane_corp/app.git')).toEqual({ kind: 'this' });
});

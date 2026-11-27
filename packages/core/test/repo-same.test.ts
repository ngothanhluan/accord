// Phase 08.9.3 D-01: two remote URLs name one repository when both are a form `parseRepoUrl` reads, owner and repository match (case-insensitively, `.git` and a trailing slash ignored)
// and the hosts match or both are github.com. A form it cannot read is never the same: a path is not an identity.
import { expect, it } from 'vitest';
import { sameRepository } from '../src/index.js';

const TOOLS = 'https://github.com/acme/tools.git';

it('risk:parsing the https, ssh:// and scp forms of one github.com repository are the same (D-01)', () => {
  for (const other of [
    'https://github.com/acme/tools',
    'https://github.com/acme/tools/',
    'ssh://git@github.com/acme/tools.git',
    'ssh://git@ssh.github.com:443/acme/tools.git',
    'git@github.com:acme/tools.git',
    'git@github.com:acme/tools',
  ]) {
    expect(sameRepository(TOOLS, other), other).toBe(true);
    expect(sameRepository(other, TOOLS), other).toBe(true);
  }
});

it('risk:parsing the case of owner and repository is ignored (D-01)', () => {
  expect(sameRepository(TOOLS, 'https://github.com/Acme/Tools.git')).toBe(true);
  expect(sameRepository('git@github.com:ACME/TOOLS', TOOLS)).toBe(true);
});

it('risk:security a github.com-<alias> host is github.com, and a lookalike host is not (D-01)', () => {
  expect(sameRepository(TOOLS, 'git@github.com-work:acme/tools')).toBe(true);
  expect(sameRepository('git@github.com-work:acme/tools', 'git@github.com-personal:acme/tools.git')).toBe(true);
  expect(sameRepository(TOOLS, 'git@github.com.evil.example:acme/tools.git')).toBe(false);
  expect(sameRepository(TOOLS, 'https://github.com.evil.example/acme/tools.git')).toBe(false);
  expect(sameRepository(TOOLS, 'git@notgithub.com:acme/tools.git')).toBe(false);
});

it('risk:security another owner or another repository is not the same, whatever the host (D-01)', () => {
  expect(sameRepository(TOOLS, 'https://github.com/acme/tools2.git')).toBe(false);
  expect(sameRepository(TOOLS, 'https://github.com/acme/tool.git')).toBe(false);
  expect(sameRepository(TOOLS, 'https://github.com/other/tools.git')).toBe(false);
  // a fork is another repository
  expect(sameRepository(TOOLS, 'https://github.com/someone/tools.git')).toBe(false);
});

it('risk:parsing a host that is not github.com matches only itself (D-01)', () => {
  expect(sameRepository('https://git.example.com/acme/tools.git', 'git@git.example.com:acme/tools')).toBe(true);
  expect(sameRepository('https://git.example.com/acme/tools.git', 'https://other.example.com/acme/tools.git')).toBe(false);
  expect(sameRepository('https://git.example.com/acme/tools.git', TOOLS)).toBe(false);
});

it('risk:security a form accord cannot read is never the same, and never throws (D-01)', () => {
  for (const bad of ['', 'C:/Work/tools', '../tools', 'file:///tmp/tools', 'ext::sh -c x', 'tools']) {
    expect(sameRepository(TOOLS, bad), bad).toBe(false);
    expect(sameRepository(bad, TOOLS), bad).toBe(false);
    expect(sameRepository(bad, bad), bad).toBe(false);
  }
  expect(sameRepository(TOOLS, 'https://github.com/acme/' + 'a'.repeat(300))).toBe(false);
});

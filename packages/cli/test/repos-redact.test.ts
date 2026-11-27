// Phase 08.9.3 review WR-01: a remote URL may carry `user:token@` (a CI clone's origin, a declared remote someone pasted). Every URL the repository commands print, in `repos status`, the not-found line with its
// `git clone`, the refusal lines and the `repos set` refusal, goes through one helper that drops the credential, so a token never reaches an agent transcript or a CI log. Real git in temporary sandboxes, no network.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { expect, it } from 'vitest';
import { redactUrl } from '../src/load/repos.js';
import { cleanup, commitAll, gitRun, run, writeFiles } from './helpers/repo.js';
import { reposCopy, TOOLS_URL, useRepoSandboxes, type Repos } from './helpers/repos.js';

useRepoSandboxes();

const SECRET_URL = 'https://user:secret@github.com/acme/tools.git';
const SHOWN = 'https://***@github.com/acme/tools.git';
const OTHER_SECRET = 'https://user:secret@github.com/acme/other.git';

/** The main checkout declares `tools` by a URL that carries a credential. */
function declaredWithSecret(r: Repos): void {
  const file = join(r.svc, 'accord', 'config.yml');
  writeFiles(r.svc, { 'accord/config.yml': readFileSync(file, 'utf8').replace(TOOLS_URL, SECRET_URL) });
  commitAll(r.svc);
}

const nothingSecret = (r: { out: string; err: string }, label: string): void => {
  expect(r.out + r.err, label).not.toContain('secret');
  expect(r.out + r.err, label).not.toContain('user:');
};

it('risk:security redactUrl drops the user and password of an https URL, keeps a plain ssh user, and hides the password of any other (WR-01)', () => {
  expect(redactUrl('https://user:secret@github.com/o/r.git')).toBe('https://***@github.com/o/r.git');
  expect(redactUrl('https://ghp_token@github.com/o/r')).toBe('https://***@github.com/o/r');
  expect(redactUrl('https://x-access-token:ghp_AAA@github.com:8443/o/r')).toBe('https://***@github.com:8443/o/r');
  expect(redactUrl('https://user:p@ss@github.com/o/r')).toBe('https://***@github.com/o/r');
  // an ssh user is a name, not a secret, and the clone line needs it
  expect(redactUrl('ssh://git@github.com/o/r.git')).toBe('ssh://git@github.com/o/r.git');
  expect(redactUrl('git@github.com:o/r.git')).toBe('git@github.com:o/r.git');
  expect(redactUrl('ssh://git:secret@github.com/o/r.git')).toBe('ssh://git:***@github.com/o/r.git');
  expect(redactUrl('user:secret@github.com:o/r.git')).toBe('***@github.com:o/r.git');
  // nothing to hide: unchanged
  for (const plain of ['https://github.com/o/r.git', 'github.com:o/r', 'C:/Work/tools', '']) expect(redactUrl(plain)).toBe(plain);
});

it('risk:security repos status and the git clone line of a declared remote that carries a credential never print it (WR-01)', async () => {
  const r = reposCopy();
  declaredWithSecret(r);
  cleanup(r.tools);
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  nothingSecret(status, 'not found');
  expect(status.out).toContain(`git clone '${SHOWN}'`);
});

it('risk:security the refusal of a clone whose origin differs names both URLs without a credential, in repos status and in repos set (WR-01)', async () => {
  const r = reposCopy();
  declaredWithSecret(r);
  // the declared remote carries the credential
  gitRun(r.tools, 'config', 'remote.origin.url', 'https://github.com/acme/other.git');
  const set = await run(['repos', 'set', 'tools', r.tools], r.svc);
  expect(set.code).toBe(2);
  nothingSecret(set, 'set, declared');
  expect(set.err).toContain(SHOWN);
  gitRun(r.tools, 'config', 'remote.origin.url', TOOLS_URL);
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  gitRun(r.tools, 'config', 'remote.origin.url', 'https://github.com/acme/other.git');
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  nothingSecret(status, 'status, declared');
  expect(status.out).toContain(SHOWN);
  expect(status.out).toContain('https://github.com/acme/other.git');

  // the clone's origin carries the credential
  gitRun(r.tools, 'config', 'remote.origin.url', OTHER_SECRET);
  const refused = await run(['repos', 'status'], r.svc);
  expect(refused.code).toBe(2);
  nothingSecret(refused, 'status, origin');
  expect(refused.out).toContain('https://***@github.com/acme/other.git');
  const viaSet = await run(['repos', 'set', 'tools', r.tools], r.svc);
  expect(viaSet.code).toBe(2);
  nothingSecret(viaSet, 'set, origin');
});

it('risk:security a stored path that is no longer a clone ends in a git clone line without the credential (WR-01)', async () => {
  const r = reposCopy();
  declaredWithSecret(r);
  expect((await run(['repos', 'set', 'tools', r.tools], r.svc)).code).toBe(0);
  cleanup(r.tools);
  const status = await run(['repos', 'status'], r.svc);
  expect(status.code).toBe(2);
  expect(status.out).toContain('is no longer a clone');
  nothingSecret(status, 'no longer a clone');
  expect(status.out).toContain(`git clone '${SHOWN}'`);
});

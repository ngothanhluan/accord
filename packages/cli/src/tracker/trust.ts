// WR-02: where a tracker credential may go is not decided by the checked-out branch. `tracker.url` is a repository file, so a
// pull request can change it, and `accord status` on that branch would then send the Jira token to the new host. The credential
// is sent only to the url the default branch's accord/config.yml names; a team that moves Jira lands the new value on the default
// branch first. When no default ref resolves there is nothing reviewed to compare with (a repository with no main yet, a plain
// folder), and the working value stands.
import { loadConfig } from '@accord-dev/accord-core';
import { catBatch, defaultRefOf } from '../load/fs.js';

/** The url as one comparable string (scheme, lower-case host, port, path without trailing slashes), or undefined when it does not parse. */
function normal(url: string | undefined): string | undefined {
  if (url === undefined) return undefined;
  try {
    const u = new URL(url);
    return u.origin + u.pathname.replace(/\/+$/, '');
  } catch {
    return undefined;
  }
}

/**
 * The warning that says why the Jira credential is not sent to `url`, or undefined when it may be: no default ref resolves, or the default
 * ref's accord/config.yml names the same `tracker.url`. A default ref whose config cannot be read, has no `tracker.url` or does not parse fails
 * closed, because the value on this branch then has not been reviewed.
 */
export function jiraUrlRefusal(root: string, url: string): string | undefined {
  let ref: string | undefined;
  let reviewed: string | undefined;
  try {
    ref = defaultRefOf(root);
    if (ref === undefined) return undefined;
    const text = catBatch(root, [ref + ':accord/config.yml'], 'the default branch config')[0];
    reviewed = text === undefined ? undefined : normal(loadConfig('accord/config.yml', text).config?.tracker?.url);
  } catch {
    reviewed = undefined;
  }
  const mine = normal(url);
  if (mine !== undefined && mine === reviewed) return undefined;
  return 'tracker jira: tracker.url is not the one on the default branch, so no request was sent and no credential left this machine; merge the url to the default branch first';
}

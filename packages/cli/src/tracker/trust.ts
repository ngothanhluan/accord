// WR-02: where the Jira credential goes is not decided by the checked-out branch. `tracker.url` is a repository file, so a pull request can change it, and `accord status`
// on that branch would then send the Jira token to the new host. The credential is sent only to the url the default branch's accord/config.yml names; a team that
// moves Jira lands the new value on the default branch first. When no default ref resolves there is nothing reviewed to compare with (a repository with no main yet, a
// plain folder), and the working value stands. A repository script (`tracker.command`) is a different matter, decided by `accord trust` (load/script-trust.ts), not here.
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

/** The `tracker` block of the default ref's accord/config.yml; `undefined` when no default ref resolves, `null` when it cannot be read or has none. */
function reviewedTracker(root: string): { url?: string } | null | undefined {
  try {
    const ref = defaultRefOf(root);
    if (ref === undefined) return undefined;
    const text = catBatch(root, [ref + ':accord/config.yml'], 'the default branch config')[0];
    return text === undefined ? null : (loadConfig('accord/config.yml', text).config?.tracker ?? null);
  } catch {
    return null;
  }
}

/**
 * The warning that says why the Jira credential is not sent to `url`, or undefined when it may be: no default ref resolves, or the default
 * ref's accord/config.yml names the same `tracker.url`. A default ref whose config cannot be read, has no `tracker.url` or does not parse fails
 * closed, because the value on this branch then has not been reviewed.
 */
export function jiraUrlRefusal(root: string, url: string): string | undefined {
  const reviewed = reviewedTracker(root);
  if (reviewed === undefined) return undefined;
  const mine = normal(url);
  if (mine !== undefined && mine === normal(reviewed?.url ?? undefined)) return undefined;
  return 'tracker jira: tracker.url is not the one on the default branch, so no request was sent and no credential left this machine; merge the url to the default branch first';
}

// WR-02, WR-03: what a tracker may be sent, and what a tracker may run, is not decided by the checked-out branch. `tracker.url` is a repository file, so a
// pull request can change it, and `accord status` on that branch would then send the Jira token to the new host. The credential
// is sent only to the url the default branch's accord/config.yml names; a team that moves Jira lands the new value on the default
// branch first. The same holds for `tracker.command` (WR-03): `accord status` runs on any checkout, a pull request branch included,
// so a command only that branch holds is not run. When no default ref resolves there is nothing reviewed to compare with (a repository
// with no main yet, a plain folder), and the working value stands.
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
function reviewedTracker(root: string): { url?: string; command?: string } | null | undefined {
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

/**
 * The warning that says why the tracker script `command` is not run, or undefined when it may be: no default ref resolves, or the default ref's
 * accord/config.yml names exactly this `tracker.command`. Anything else (a changed command, one the default branch lacks, an unreadable config)
 * fails closed: the script runs with the user's whole environment, so only a command that has been reviewed onto the default branch runs.
 */
export function scriptCommandRefusal(root: string, command: string): string | undefined {
  const reviewed = reviewedTracker(root);
  if (reviewed === undefined) return undefined;
  if (reviewed?.command === command) return undefined;
  return 'tracker script: tracker.command is not the one on the default branch, so it was not run; merge the command to the default branch first';
}

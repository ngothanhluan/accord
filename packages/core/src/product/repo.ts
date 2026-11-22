// Phase 8.5 D-14, R-9 (08.5-06): which repository a pull request link names, and whether it is this clone's own. A pull request of another repository must never be judged by, or be given, this
// repository's conventions, so the answer comes from this code and never from the model: the CLI reads origin's URL and the link, and passes the text. Pure: no I/O, no `node:` import.

/** A pull request link that passed `pullRequestOf`: the three parts the CLI builds a fetch line from. */
export interface PullRequest {
  owner: string;
  repo: string;
  n: number;
}
/** The repository a pull request belongs to, compared with origin: this clone's, another's, or one accord cannot tell (with the reason, fixed text). */
export type RepositoryOf = { kind: 'this' } | { kind: 'other'; owner: string; repo: string } | { kind: 'unknown'; why: string };

/** The reason said when a link is not in the one shape accord reads. Fixed text: it never quotes the link. */
export const NOT_A_PULL_LINK = 'not a https://github.com/<owner>/<repo>/pull/<n> link';
/** The reason said when origin is missing or its URL is not a form accord reads. */
export const ORIGIN_UNREADABLE = "origin's URL is not a form accord reads";

/** Bounds, not a size cap on repository text: no link or origin URL of any real repository comes near them. */
const MAX_LINK = 300;
const OWNER = /^[A-Za-z0-9][A-Za-z0-9-]{0,38}$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const PULL_LINK = /^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/([1-9][0-9]{0,9})\/?$/;

/**
 * R-9: the parts of a pull request link, or undefined. Only `https://github.com/<owner>/<repo>/pull/<n>` (one optional trailing slash) is accepted, at most 300 characters (checked first):
 * no other scheme, host, `ext::` or `file:` transport, no value that starts with `-`, no `.` or `..` repository and none ending `.git`. Every part is character-limited, so what the CLI
 * builds from them (a fetch line) can name nothing but a github.com repository over https.
 */
export function pullRequestOf(url: string): PullRequest | undefined {
  if (url.length > MAX_LINK) return undefined;
  const m = PULL_LINK.exec(url);
  if (m === null) return undefined;
  const [, owner, repo, n] = m;
  if (!OWNER.test(owner) || !REPO.test(repo) || repo === '.' || repo === '..' || repo.toLowerCase().endsWith('.git')) return undefined;
  return { owner, repo, n: Number(n) };
}

const HOST = '([A-Za-z0-9](?:[A-Za-z0-9.-]*[A-Za-z0-9])?)';
const PATH = '([A-Za-z0-9][A-Za-z0-9._-]*)/([A-Za-z0-9._-]+?)(?:\\.git)?/?';
const HTTPS = new RegExp(`^https://(?:[^/@\\s]+@)?${HOST}(?::\\d+)?/${PATH}$`);
const SSH = new RegExp(`^ssh://(?:[^/@\\s]+@)?${HOST}(?::\\d+)?/${PATH}$`);
const SCP = new RegExp(`^(?:[^/@:\\s]+@)?${HOST}:${PATH}$`);

/**
 * R-9: host, owner and repository of a remote's URL, or undefined for any other form. Read: `https://<host>/<owner>/<repo>[.git][/]`, `ssh://[<user>@]<host>[:<port>]/<owner>/<repo>[.git]`, and
 * the scp form `[<user>@]<host>:<owner>/<repo>[.git]` (its host must hold a dot, so a Windows path such as `C:/dir/repo` is no remote). The host is lower-cased; owner and repository are
 * as typed (the comparison is case-insensitive).
 */
export function parseRepoUrl(url: string): { host: string; owner: string; repo: string } | undefined {
  if (url.length > MAX_LINK) return undefined;
  for (const form of [HTTPS, SSH, SCP]) {
    const m = form.exec(url);
    if (m === null) continue;
    if (form === SCP && !m[1].includes('.')) continue;
    return { host: m[1].toLowerCase(), owner: m[2], repo: m[3] };
  }
  return undefined;
}

/**
 * R-9, D-14: whether the pull request is this clone's own. `pull` undefined (the link was not in the accepted shape) and an origin that is missing or not a form `parseRepoUrl` reads are
 * `unknown`; github.com with the same owner and repository (case-insensitively) is `this`; anything else is `other`, a fork included: a clone whose origin is the fork is another repository
 * to a pull request of the upstream, and the other way round.
 */
export function repositoryOf(pull: PullRequest | undefined, origin: string | undefined): RepositoryOf {
  if (pull === undefined) return { kind: 'unknown', why: NOT_A_PULL_LINK };
  const where = origin === undefined ? undefined : parseRepoUrl(origin);
  if (where === undefined) return { kind: 'unknown', why: ORIGIN_UNREADABLE };
  if (where.host === 'github.com' && where.owner.toLowerCase() === pull.owner.toLowerCase() && where.repo.toLowerCase() === pull.repo.toLowerCase()) return { kind: 'this' };
  return { kind: 'other', owner: pull.owner, repo: pull.repo };
}

/**
 * R-9: where to fetch the pull request's commits from, for the skill to run (the CLI runs no network command): `origin pull/<n>/head` for this repository's pull request, and
 * `https://github.com/<owner>/<repo>.git pull/<n>/head` for another repository's, built from the validated parts only; undefined when the repository cannot be told.
 */
export function fetchLine(where: RepositoryOf, pull: PullRequest | undefined): string | undefined {
  if (pull === undefined || where.kind === 'unknown') return undefined;
  return where.kind === 'this' ? `origin pull/${pull.n}/head` : `https://github.com/${where.owner}/${where.repo}.git pull/${pull.n}/head`;
}

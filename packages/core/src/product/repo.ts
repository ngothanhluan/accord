// Phase 8.5 D-14, R-9 (08.5-06): red stub, replaced by the real module in the green commit.
export interface PullRequest {
  owner: string;
  repo: string;
  n: number;
}
export type RepositoryOf = { kind: 'this' } | { kind: 'other'; owner: string; repo: string } | { kind: 'unknown'; why: string };

export function pullRequestOf(_url: string): PullRequest | undefined {
  return undefined;
}
export function parseRepoUrl(_url: string): { host: string; owner: string; repo: string } | undefined {
  return undefined;
}
export function repositoryOf(_pull: PullRequest | undefined, _origin: string | undefined): RepositoryOf {
  return { kind: 'unknown', why: '' };
}
export function fetchLine(_where: RepositoryOf, _pull: PullRequest | undefined): string | undefined {
  return undefined;
}

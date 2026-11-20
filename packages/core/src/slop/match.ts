// Phase 8.1 D-14, D-20: which added lines of a package's diff text match the slop patterns. Pure: it reads the `-U10` diff text the host already produced, never git.
// Every added line of every changed text file is judged, test files included; only Markdown, generated files and dependency lockfiles are skipped (copyGeneratedOrMarkdown, LOCKFILES).
import { copyGeneratedOrMarkdown, diffFiles, SCAN_LINE_LIMIT } from '../security/match.js';
import type { SlopPattern, SlopSpec } from './spec.js';

/**
 * D-20 (plan-level Ruling): a dependency lockfile is written by its package manager, never by hand, so for the slop scan it is a generated file even when `generated:` does not list it. Base names,
 * compared with the last segment of a path exactly, in any folder. The manifests (`package.json`, `*.csproj`, `requirements*.txt`, `pyproject.toml`, `go.mod`, `Cargo.toml`, `Gemfile`,
 * `composer.json`) are not lockfiles and stay scanned. The list lives here, not in the security skip, so the security triggers keep theirs exactly.
 */
export const LOCKFILES: readonly string[] = [
  'package-lock.json',
  'npm-shrinkwrap.json',
  'yarn.lock',
  'pnpm-lock.yaml',
  'packages.lock.json',
  'poetry.lock',
  'Pipfile.lock',
  'Cargo.lock',
  'composer.lock',
  'Gemfile.lock',
  'go.sum',
];

/** True when the last segment of `path` is exactly a lockfile name of LOCKFILES. */
export const isLockfile = (path: string): boolean => LOCKFILES.includes(path.slice(path.lastIndexOf('/') + 1));

/** The one slop skip: Markdown, a `generated:` path, an exact rendered copy, and a dependency lockfile. Test files are not skipped. Line counts and the orphan list reuse it. */
export const slopSkipped = (path: string, generated: readonly string[], exempt: readonly string[]): boolean => copyGeneratedOrMarkdown(path, generated, exempt) || isLockfile(path);

export interface SlopHit {
  /** the pattern's id, or a structural kind: `slop:<kind>` in the package. */
  kind: string;
  path: string;
  line: number;
  label: string;
}

/** The extension of a path with its dot, lower-cased; empty when the name holds none. */
const extensionOf = (path: string): string => {
  const name = path.slice(path.lastIndexOf('/') + 1);
  const dot = name.lastIndexOf('.');
  return dot < 0 ? '' : name.slice(dot).toLowerCase();
};

/** Code point order, so the same input sorts the same on every runtime. */
export function cmp(a: string, b: string): number {
  const x = [...a];
  const y = [...b];
  for (let i = 0; i < Math.min(x.length, y.length); i++) {
    const d = (x[i].codePointAt(0) as number) - (y[i].codePointAt(0) as number);
    if (d !== 0) return d < 0 ? -1 : 1;
  }
  return x.length === y.length ? 0 : x.length < y.length ? -1 : 1;
}

/** Hits in path, line, kind order; the same hit twice is one. */
export function sortHits(hits: readonly SlopHit[]): SlopHit[] {
  const seen = new Set<string>();
  const out: SlopHit[] = [];
  for (const h of hits) {
    const key = `${h.kind}\0${h.path}\0${h.line}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(h);
  }
  return out.sort((a, b) => cmp(a.path, b.path) || a.line - b.line || cmp(a.kind, b.kind));
}

/** The line patterns of a spec as regular expressions; a pattern that does not compile (parseSlop reported it as a problem) matches nothing. */
function compile(spec: SlopSpec): { p: SlopPattern; re: RegExp }[] {
  const out: { p: SlopPattern; re: RegExp }[] = [];
  for (const p of spec.patterns) {
    try {
      out.push({ p, re: new RegExp(p.source, p.flags) });
    } catch {
      // not compiled: matches nothing
    }
  }
  return out;
}

/**
 * The slop hits of a package: each pattern of `spec` over the added lines of every changed text file its scope allows. A binary file has no added text lines in the diff, so it gives no hit.
 * A line is matched on its first SCAN_LINE_LIMIT characters; slop is a quality signal, not a security boundary, so the rest of a longer line adds no hit.
 */
export function slopHits(spec: SlopSpec, diffText: string, options: { generated: readonly string[]; exempt?: readonly string[] }): SlopHit[] {
  const res = compile(spec);
  const hits: SlopHit[] = [];
  for (const f of diffFiles(diffText)) {
    if (f.binary || f.path === undefined || slopSkipped(f.path, options.generated, options.exempt ?? [])) continue;
    const ext = extensionOf(f.path);
    const scoped = res.filter(({ p }) => p.exts === undefined || p.exts.includes(ext));
    if (scoped.length === 0) continue;
    for (const l of f.added) {
      const head = l.text.length > SCAN_LINE_LIMIT ? l.text.slice(0, SCAN_LINE_LIMIT) : l.text;
      for (const { p, re } of scoped) if (re.test(head)) hits.push({ kind: p.id, path: f.path, line: l.line, label: p.label });
    }
  }
  return sortHits(hits);
}

/** The line form of a hit, as `accord review-package` prints it under `## Slop` and as 08.1-06's justification line names it. */
export const slopLine = (h: SlopHit): string => `- slop:${h.kind} ${h.path}:${h.line} — ${h.label}`;

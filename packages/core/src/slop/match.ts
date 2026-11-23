// Phase 8.1 D-14, D-20: which added lines of a package's diff text match the slop patterns. Pure: it reads the `-U10` diff text the host already produced, never git.
// Every added line of every changed text file is judged, test files included; only Markdown, generated files and dependency lockfiles are skipped (copyGeneratedOrMarkdown, LOCKFILES).
import { budgetLabel, copyGeneratedOrMarkdown, diffFiles, KNOWN_BINARY, overlapMeter, SCAN_LINE_LIMIT, SCAN_OVERLAP_BUDGET } from '../security/match.js';
import { DEFAULT_SLOP } from './spec.js';
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
 * WR-02: the kind of the hit a line or a file the scan could not read whole gets, as the security scan reports `cannot` (fail closed). It is not a pattern and not in the `Removed:` list, so only a
 * fix or a justification line (`slop:unscanned <path>:<line> — <reason>`) clears it; padding a line past SCAN_LINE_LIMIT or hiding a NUL byte in a code file cannot.
 */
export const UNSCANNED = 'unscanned';
const LONG_LINE = `line longer than ${SCAN_LINE_LIMIT} characters, only its first ${SCAN_LINE_LIMIT} were scanned`;
const BINARY_FILE = 'binary file, its lines were not scanned';

/**
 * The slop hits of a package: each pattern of `spec` over the added lines of every changed text file its scope allows. A line is matched on its first SCAN_LINE_LIMIT characters (which bounds the time
 * a pattern may take); a longer line, and a file git calls binary that is not a known image, font or archive and has no text section of the same path, are an `unscanned` hit (WR-02), never silence.
 */
export function slopHits(spec: SlopSpec, diffText: string, options: { generated: readonly string[]; exempt?: readonly string[]; overlapBudget?: number }): SlopHit[] {
  const res = compile(spec);
  // Phase 08.8 D-12: a pattern accepted with two overlapping repeats has a total budget over the package (SCAN_OVERLAP_BUDGET); past it the pattern stops and one `unscanned` hit marks the first line it left unread
  const allow = overlapMeter(res.map(({ re }) => re), options.overlapBudget ?? SCAN_OVERLAP_BUDGET, DEFAULT_SLOP.patterns);
  const budgetReported = new Set<number>();
  const hits: SlopHit[] = [];
  const files = diffFiles(diffText);
  for (const f of files) {
    if (f.path === undefined || slopSkipped(f.path, options.generated, options.exempt ?? [])) continue;
    const ext = extensionOf(f.path);
    const scoped = res.map((r, i) => ({ ...r, i })).filter(({ p }) => p.exts === undefined || p.exts.includes(ext));
    if (scoped.length === 0) continue;
    if (f.binary) {
      if (!KNOWN_BINARY.has(ext.slice(1)) && !files.some((g) => !g.binary && g.path === f.path)) hits.push({ kind: UNSCANNED, path: f.path, line: 1, label: BINARY_FILE });
      continue;
    }
    for (const l of f.added) {
      const long = l.text.length > SCAN_LINE_LIMIT;
      const head = long ? l.text.slice(0, SCAN_LINE_LIMIT) : l.text;
      if (long) hits.push({ kind: UNSCANNED, path: f.path, line: l.line, label: LONG_LINE });
      for (const { p, re, i } of scoped) {
        if (!allow(i, head.length)) {
          if (!budgetReported.has(i)) {
            budgetReported.add(i);
            hits.push({ kind: UNSCANNED, path: f.path, line: l.line, label: budgetLabel(p.id) });
          }
        } else if (re.test(head)) hits.push({ kind: p.id, path: f.path, line: l.line, label: p.label });
      }
    }
  }
  return sortHits(hits);
}

/** The line form of a hit, as `accord review-package` prints it under `## Slop` and as 08.1-06's justification line names it. */
export const slopLine = (h: SlopHit): string => `- slop:${h.kind} ${h.path}:${h.line} — ${h.label}`;

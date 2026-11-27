// Phase 8.1 G2 (D-02, D-03, 8.1-ac-3): the four skill steps that open a pull request take its title and body from `accord pr`; the three short-body sites keep their fixed text,
// and no other skill source may open a pull request unseen. The scan reads the skill sources themselves, line by line, so a wrapped phrase cannot hide a flag.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { expect, it } from 'vitest';
import { skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const skillsDir = fileURLToPath(new URL('../skills/', import.meta.url));

/** The six sites D-02 changes (the fifth is the slice pull request of Phase 15, `slices.md`, the sixth the pull request of another repository, `repos.md`): they follow the team's template or script, so each holds `accord pr`, `--title` and `--body-file`. */
const FOLLOW = ['accord/lane-s.md', 'accord/lane-r.md', 'accord/verify-ci.md', 'accord/new-epic.md', 'accord/slices.md', 'accord/repos.md'] as const;

/**
 * The closed list of fixed-body sites (D-02): the one `gh pr create` line each holds, exactly as it stood at 0128bd1a. A team template asks for testing or screenshot sections that do not apply to them.
 * A change to one of these lines, or a new `gh pr create` in a source that is in neither list, fails the scan by name. 08.1-03 adds `audit/draft.md`, the conventions-draft pull request, with its fixed line
 * (CONTEXT Ruling (plan check, 2026-11-20)).
 */
const EXEMPT: Readonly<Record<string, string>> = {
  // a queued draft's pull request is merged at once and its short body is the idea
  'accord/queue.md': '4. Open the pull request when `gh` is available with `gh pr create --head <branch> --base <base> --title "<title>" --body "<the idea>"`, using the lines it printed; otherwise show the `branch:` line and ask the owner to open it.',
  // the pin pull request moves one version pin and regenerates skill files: one fixed sentence
  'accord/upgrade.md': '   `gh pr create --head <branch> --base <base> --title "<title>" --body "Moves the version pin and regenerates the skill files."`,',
  // drop and move pull requests carry the owner's reason
  'accord/ids.md': '   `gh pr create --head <branch> --base <base> --title "<title>" --body "<reason>"` when `gh` is available,',
  // conventions-draft PR: fixed body, CONTEXT Ruling (plan check, 2026-11-20): a team template asks for testing or screenshot sections that do not apply to a conventions.md change
  'audit/draft.md': '7. Open the pull request when `gh` is available with `gh pr create --head <branch> --base <base> --title "<title>" --body "Convention lines the owner accepted in /accord-audit."`, using the lines it printed; otherwise show the `branch:` line and ask the owner to open it.',
};

/** Every skill source with the lines that hold `gh pr create`, keyed by its posix path under packages/core/skills/. */
function sites(): Map<string, { lines: string[]; text: string }> {
  const found = new Map<string, { lines: string[]; text: string }>();
  const sources = readdirSync(skillsDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
  expect(sources.length, 'nothing was scanned').toBeGreaterThan(0);
  for (const e of sources) {
    const text = readFileSync(join(e.parentPath, e.name), 'utf8').replace(/\r\n/g, '\n');
    const lines = text.split('\n').filter((l) => l.includes('gh pr create'));
    if (lines.length > 0) found.set(relative(skillsDir, join(e.parentPath, e.name)).split(sep).join('/'), { lines, text });
  }
  return found;
}

it('risk:regression no D-02 site opens a PR with --fill or an inline body and the short-body sites are unchanged (8.1-ac-3)', () => {
  const found = sites();
  const bad: string[] = [];
  for (const path of FOLLOW) {
    const site = found.get(path);
    if (site === undefined) {
      bad.push(`${path}: holds no gh pr create line`);
      continue;
    }
    if (!/\baccord pr\b/.test(site.text)) bad.push(`${path}: does not run accord pr`);
    for (const line of site.lines) {
      if (!line.includes('--title')) bad.push(`${path}: a gh pr create line without --title: ${line.trim()}`);
      if (!line.includes('--body-file')) bad.push(`${path}: a gh pr create line without --body-file: ${line.trim()}`);
      if (/--fill\b/.test(line)) bad.push(`${path}: a gh pr create line with the fill flag: ${line.trim()}`);
      if (/--body\s/.test(line)) bad.push(`${path}: a gh pr create line with an inline --body: ${line.trim()}`);
    }
  }
  expect(bad).toEqual([]);
  for (const [path, expected] of Object.entries(EXEMPT)) expect(found.get(path)?.lines, path).toEqual([expected]);
});

it('risk:regression every gh pr create site in the skill sources is a D-02 site or a named fixed-body exemption (D-02)', () => {
  const found = sites();
  const listed = new Set<string>([...FOLLOW, ...Object.keys(EXEMPT)]);
  // a source with a gh pr create line that neither list names is a pull request nobody classified
  expect([...found.keys()].filter((path) => !listed.has(path)).sort(), 'a skill source opens a pull request and is in neither list').toEqual([]);
  // and the lists name only sources that still open one, so a stale name cannot make the scan pass for the wrong reason
  expect([...listed].filter((path) => !found.has(path)).sort()).toEqual([]);
  // each fixed-body site equals its expected line exactly: neither the fill flag nor an inline body of its own can appear there unseen
  for (const [path, expected] of Object.entries(EXEMPT)) expect(found.get(path)?.lines, `${path} changed`).toEqual([expected]);
});

// Phase 08.8 D-16 (item 6): the path `accord pr` prints can hold a space, so every `--body-file` a skill writes is followed by a double-quoted path, in the sources and in every rendered copy.
it('risk:security every body file a skill passes to gh is quoted (D-16)', () => {
  const flat = (text: string): string => text.replace(/\s+/g, ' ');
  const unquoted = (text: string): string[] => [...flat(text).matchAll(/--body-file(?! "[^"]+")[^ ]*(?: \S+)?/g)].map((m) => m[0]);
  const bad: string[] = [];
  let seen = 0;
  const sources = readdirSync(skillsDir, { recursive: true, withFileTypes: true }).filter((e) => e.isFile());
  expect(sources.length, 'nothing was scanned').toBeGreaterThan(0);
  for (const e of sources) {
    const path = relative(skillsDir, join(e.parentPath, e.name)).split(sep).join('/');
    const text = readFileSync(join(e.parentPath, e.name), 'utf8');
    seen += flat(text).split('--body-file').length - 1;
    for (const hit of unquoted(text)) bad.push(`source ${path}: ${hit}`);
  }
  // the five sites the UAT named each hold a quoted body file, so a rename cannot empty the scan
  for (const path of [...FOLLOW, 'review-pr/SKILL.md']) {
    if (!flat(readFileSync(join(skillsDir, path), 'utf8')).includes('--body-file "')) bad.push(`source ${path}: holds no quoted --body-file`);
  }
  expect(seen, 'no source holds a --body-file').toBeGreaterThanOrEqual(5);
  const rendered = skillTargets({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev', 'review-pr'], runtimes: ['claude', 'cursor', 'codex', 'copilot'] } as AccordConfig);
  let renderedSeen = 0;
  for (const file of rendered) {
    renderedSeen += flat(file.text).split('--body-file').length - 1;
    for (const hit of unquoted(file.text)) bad.push(`rendered ${file.path}: ${hit}`);
  }
  expect(renderedSeen, 'no rendered copy holds a --body-file').toBeGreaterThanOrEqual(5);
  expect(bad).toEqual([]);
});

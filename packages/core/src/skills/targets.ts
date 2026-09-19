// SKILL-03 target layout (D-108, D-113, D-119): which files `accord skills sync` writes, and where, for one
// repository's `roles:` and `runtimes:`. The runtime-to-directory table is fixed in source and is never read
// from config — a configurable target path is a free-text path component, and there is then nothing stopping
// a `..` segment from reaching outside the repository (T-06-01).
import { renderSkill, skillLoads } from './render.js';
import { skills } from '../generated/skills.js';
import type { SkillKey } from '../generated/skills.js';
import type { AccordConfig } from '../model/snapshot.js';

export interface SkillFile {
  path: string; // repo-relative, forward slashes, never a native separator (D-51)
  text: string;
}

// Claude Code reads .claude/skills/ only; Codex reads .agents/skills/ only; Cursor and Copilot read both.
// One text, two paths — never two texts (D-108).
const DIRS: Record<AccordConfig['runtimes'][number], readonly string[]> = {
  claude: ['.claude/skills'],
  codex: ['.agents/skills'],
  cursor: ['.claude/skills', '.agents/skills'],
  copilot: ['.claude/skills', '.agents/skills'],
};

// Code-point order, never a locale-aware compare, so the output is identical on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * Every file this configuration installs, sorted by path. A role with no definition in the generated module
 * contributes nothing, so a roster naming a role whose workflow has not been authored yet is not an error.
 *
 * Paths are composed by string concatenation: node:path is banned in core (CORE-01) and a `join` would emit
 * a backslash on Windows, which would then be written into a file and printed to a terminal (D-51).
 *
 * Pure: reads the config and the generated module only, and returns the same list on every call.
 */
/**
 * The target directories this configuration declares, whether or not any role renders into them. The
 * orphan scan (D-113) needs exactly this: a roster whose every role is still unauthored writes no file
 * and must still be able to report an `accord-*` directory a previous roster left behind.
 */
export function skillDirs(config: AccordConfig): string[] {
  return [...new Set(config.runtimes.flatMap((r) => DIRS[r]))].sort(cmp);
}

/**
 * Every directory the table can produce, for any roster at all. This is the set the orphan scan (D-113)
 * opens: a directory abandoned by dropping a runtime is by definition no longer in the declared subset,
 * so a scan over `skillDirs(config)` can never reach it. `skillDirs(config)` remains the **write** set —
 * it is what `skillTargets` composes its paths from, and that is unchanged.
 *
 * Takes no argument on purpose. It reads the `DIRS` literal and nothing else, so T-06-01 holds a
 * fortiori here: widening the scan drops the config input rather than adding one, and no user-supplied
 * string can enter a path through this function.
 */
export function allSkillDirs(): string[] {
  return [...new Set(Object.values(DIRS).flat())].sort(cmp);
}

export function skillTargets(config: AccordConfig): SkillFile[] {
  const dirs = skillDirs(config);
  const out: SkillFile[] = [];
  for (const role of config.roles) {
    const key = (role + '/SKILL.md') as SkillKey;
    if (!Object.hasOwn(skills, key)) continue;
    // D-108: the rendered filename is the entry's basename, which is what makes a `./prototype.md`
    // reference inside the role's SKILL.md resolve in both target directories rather than one.
    const loaded = skillLoads(key).map((entry) => ({ name: entry.split('/').at(-1) as string, text: renderSkill(entry) }));
    const text = renderSkill(key);
    for (const dir of dirs) {
      const base = dir + '/accord-' + role + '/';
      out.push({ path: base + 'SKILL.md', text });
      for (const file of loaded) out.push({ path: base + file.name, text: file.text });
    }
  }
  return out.sort((a, b) => cmp(a.path, b.path));
}

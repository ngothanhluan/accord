// Phase 8.3 D-03, D-04: the render path of a folded name. Every one of the ten names is a file of the accord folder (`accord/<name>.md`, children `accord/<name>-<child>.md`);
// 08.3-21 dropped the pre-fold branch, so a stale caller fails loudly. Test-only, pure apart from reading the generated module.
import { skills, STAGES } from '../../src/index.js';

/** The ten names that folded into the accord folder. */
const FOLDED_NAMES = ['queue', 'continue', 'pickup', 'new', 'intent', 'approach', 'plan', 'build', 'review', 'verify'] as const;

function checked(name: string): string {
  if ((STAGES as readonly string[]).includes(name)) {
    throw new Error(`stage-files: '${name}' is still one of STAGES and keeps its own folder, so it has no folded path`);
  }
  if (!(FOLDED_NAMES as readonly string[]).includes(name)) {
    throw new Error(`stage-files: '${name}' is not a name that folded into accord (${FOLDED_NAMES.join(', ')})`);
  }
  return name;
}

/**
 * The path of `name`'s own file, or of one of its children, in the render of `dir`: `<dir>/accord/<name>.md` and `<dir>/accord/<name>-<child>.md`.
 * `keys` are the keys of the generated skills module; one that still renders `<name>/SKILL.md` is a render from before the fold, and the call throws.
 * Any name but the ten throws.
 */
export function stagePathIn(keys: ReadonlySet<string>, name: string, child?: string, dir = '.claude/skills'): string {
  checked(name);
  if (keys.has(`${name}/SKILL.md`)) throw new Error(`stage-files: '${name}' has not folded: ${name}/SKILL.md is still rendered`);
  if (child === undefined) return `${dir}/accord/${name}.md`;
  return `${dir}/accord/${name}-${child.replace(/\.md$/, '')}.md`;
}

const KEYS: ReadonlySet<string> = new Set(Object.keys(skills));

/** `stagePathIn` over the keys of the generated skills module. */
export function stagePath(name: string, child?: string, dir = '.claude/skills'): string {
  return stagePathIn(KEYS, name, child, dir);
}

/** A file rendered beside `name`'s own file (`lane.md`, `ids.md`, `ask.md`, ...): the folder `stagePath(name)` is in. */
export function besidePath(name: string, file: string, dir = '.claude/skills'): string {
  return `${stagePathIn(KEYS, name, undefined, dir).replace(/\/[^/]+$/, '')}/${file}`;
}

/** Whether a rendered path is a file of one of the named stages: `accord/<name>.md` or `accord/<name>-*.md`. */
export function ofStage(path: string, names: readonly string[]): boolean {
  return names.some((name) => ['.claude/skills', '.agents/skills'].some((dir) => path.startsWith(stagePath(name, undefined, dir).slice(0, -'.md'.length))));
}

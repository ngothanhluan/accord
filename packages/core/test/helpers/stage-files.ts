// Phase 8.3 D-03, D-04: the render path of a folded name, before or after its fold, decided by the keys of the
// generated skills module. Tests read a stage's or command's render only through it, so a fold moves no test path;
// 08.3-21 keeps only the folded branch. Test-only, pure apart from reading the generated module.
import { skills } from '../../src/index.js';

/** The ten names that fold into the accord folder, in the order the phase folds them. */
const FOLDED_NAMES = ['queue', 'continue', 'pickup', 'new', 'intent', 'approach', 'plan', 'build', 'review', 'verify'] as const;

function checked(name: string): string {
  if (!(FOLDED_NAMES as readonly string[]).includes(name)) {
    throw new Error(`stage-files: '${name}' is not a name that folds into accord (${FOLDED_NAMES.join(', ')})`);
  }
  return name;
}

/**
 * The path of `name`'s own file, or of one of its children, in the render of `dir`.
 * `name` has folded when `<name>/SKILL.md` is not a key: its folder is `accord`, its own file `<name>.md`.
 * Before the fold the folder is `accord-<name>` and the own file `SKILL.md`. A child is `<name>-<child>.md` once
 * `accord/<name>-<child>.md` is a key (moved early, or folded), else `<child>.md`, in the same folder.
 * Any other name throws.
 */
export function stagePathIn(keys: ReadonlySet<string>, name: string, child?: string, dir = '.claude/skills'): string {
  checked(name);
  const folded = !keys.has(`${name}/SKILL.md`);
  const folder = folded ? `${dir}/accord` : `${dir}/accord-${name}`;
  if (child === undefined) return `${folder}/${folded ? `${name}.md` : 'SKILL.md'}`;
  const bare = child.replace(/\.md$/, '');
  return `${folder}/${keys.has(`accord/${name}-${bare}.md`) ? `${name}-${bare}.md` : `${bare}.md`}`;
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

/**
 * Whether a rendered path is a file of one of the named stages: in the stage's own folder before its fold,
 * `accord/<name>.md` or `accord/<name>-*.md` after it.
 */
export function ofStage(path: string, names: readonly string[]): boolean {
  return names.some((name) =>
    ['.claude/skills', '.agents/skills'].some((dir) => {
      const own = stagePath(name, undefined, dir);
      return path.startsWith(own.endsWith('/SKILL.md') ? own.slice(0, -'SKILL.md'.length) : own.slice(0, -'.md'.length));
    }),
  );
}

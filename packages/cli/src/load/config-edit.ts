// The one definition of when an edit of accord/config.yml is refused: `accord config set` and `unset` (commands/config.ts `commit`) and the proposals check (`refusal` in detect.ts,
// which `accord init`, `accord config areas` and `accord config areas --proposals` use) all call `editRefusal`, so a proposal config set would refuse is never shown as one, and the
// two cannot drift (Phase 8.4 review WR-03). It reads no file: the caller gives it the text before and after the edit.
import { floorProblems, loadConfig } from '@accord-dev/accord-core';
import type { LoadFinding } from '@accord-dev/accord-core';

export const CONFIG_FILE = 'accord/config.yml';

export const describeFinding = (f: LoadFinding): string => `${f.pointer !== undefined && f.pointer !== '' ? f.pointer + ' ' : ''}${f.reason}`;

/** `/strictness/levels/gate.design-missing` as the dotted key a person types. */
const dotted = (pointer: string): string => pointer.slice(1).split('/').join('.');

/**
 * ST-LN-50 D-08, D-09, D-10: the `strictness.levels` keys the engines would ignore (a floor rule, a stage's rule, an unknown rule, a Ready-promoted rule turned off).
 * An edit is refused when one stands at the key it edits or is new; one already in the file and not touched by this edit does not stop the edit, so a file
 * holding two of them can be cleaned up one `unset` at a time. `accord config check` and `accord lint` still name every one.
 */
function refusedByFloor(path: string[], before: string, after: string): { pointer: string; reason: string }[] {
  const edited = '/' + path.join('/');
  const known = new Set(floorProblems(loadConfig(CONFIG_FILE, before).config).map((p) => p.pointer));
  return floorProblems(loadConfig(CONFIG_FILE, after).config).filter((p) => p.pointer === edited || p.pointer.startsWith(edited + '/') || !known.has(p.pointer));
}

/** Why an edit of the key at `path` that turns `before` into `after` is refused: the schema's findings on the whole result, then the floor problems the edit touches or adds. `undefined` when it is taken. */
export function editRefusal(path: string[], before: string, after: string): { kind: 'schema' | 'floor'; text: string } | undefined {
  const found = loadConfig(CONFIG_FILE, after).findings;
  if (found.length > 0) return { kind: 'schema', text: found.map(describeFinding).join('; ') };
  const floor = after === before ? [] : refusedByFloor(path, before, after);
  if (floor.length > 0) return { kind: 'floor', text: floor.map((p) => `${dotted(p.pointer)}: ${p.reason}`).join('; ') };
  return undefined;
}

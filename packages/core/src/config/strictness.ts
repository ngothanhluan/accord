// ST-LN-50 D-07, D-09: what a team sets under `strictness` in accord/config.yml, resolved in one place. The profile gives a preset, the team's keys come on top,
// and every reader (today the round caps in round/next.ts, later the rule levels and the stages) asks resolveStrictness and nowhere else, so no reader
// knows which of the two a value came from. Pure: the config arrives parsed, nothing is read here.
import type { RoundKind } from '../round/next.js';
import { levelRefusal } from '../gate/floor.js';
import type { AccordConfig } from '../model/snapshot.js';

/**
 * The resolved strictness: `rounds` holds the cap of each record the team set; an absent record keeps the cap its claim pin's rules give. `levels` holds the level of each
 * OVERRIDABLE rule the team set (gate/floor.ts); a key the floor names is never in it.
 */
export interface Strictness {
  rounds: Partial<Record<RoundKind, number>>;
  levels: Record<string, 'error' | 'warning' | 'off'>;
}

/**
 * The preset of each profile. Neither carries round values or levels: the claim pin's rules decide the caps and the rule tables decide the levels, so `profile` changes neither, as
 * today (D-09: an existing repository changes nothing).
 */
export const PRESETS: Record<'build' | 'maintain', Strictness> = {
  build: { rounds: {}, levels: {} },
  maintain: { rounds: {}, levels: {} },
};

const ROUND_KINDS: readonly RoundKind[] = ['approach', 'plan', 'review'];
const CAP = /^[1-9][0-9]?$/;

/**
 * The profile's preset with each team key on top. A round cap is a number from 1 to 99 (the schema's `^[1-9][0-9]?$`: never 0, never a negative); a
 * value that is not one is read as unset, so a hand-built config the schema has not seen never opens an unbounded loop or a zero-round one. A level is kept only when the floor lets it stand (levelRefusal): a key naming a LOCKED, a STAGE_OWNED or an
 * unknown rule, or turning off a Ready-promoted one, is dropped, so a hand-edited config cannot lower the floor.
 */
export function resolveStrictness(config?: AccordConfig): Strictness {
  const preset = PRESETS[config?.profile === 'maintain' ? 'maintain' : 'build'];
  const rounds: Strictness['rounds'] = { ...preset.rounds };
  const team = config?.strictness?.rounds;
  for (const kind of ROUND_KINDS) {
    const value = team?.[kind];
    if (typeof value === 'string' && CAP.test(value)) rounds[kind] = Number(value);
  }
  const levels: Strictness['levels'] = { ...preset.levels };
  const teamLevels = config?.strictness?.levels;
  if (teamLevels !== undefined && teamLevels !== null && typeof teamLevels === 'object') {
    for (const [id, value] of Object.entries(teamLevels)) {
      if ((value === 'error' || value === 'warning' || value === 'off') && levelRefusal(id, value) === undefined) levels[id] = value;
    }
  }
  return { rounds, levels };
}

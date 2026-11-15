// ST-LN-50 D-07, D-09: what a team sets under `strictness` in accord/config.yml, resolved in one place. The profile gives a preset, the team's keys come on top,
// and every reader (today the round caps in round/next.ts, later the rule levels and the stages) asks resolveStrictness and nowhere else, so no reader
// knows which of the two a value came from. Pure: the config arrives parsed, nothing is read here.
import type { RoundKind } from '../round/next.js';
import type { AccordConfig } from '../model/snapshot.js';

/** The resolved strictness: `rounds` holds the cap of each record the team set; an absent record keeps the cap its claim pin's rules give. */
export interface Strictness {
  rounds: Partial<Record<RoundKind, number>>;
}

/**
 * The preset of each profile. Neither carries round values: the claim pin's rules decide the caps, so `profile` changes no cap, as today (D-09: an
 * existing repository changes nothing).
 */
export const PRESETS: Record<'build' | 'maintain', Strictness> = {
  build: { rounds: {} },
  maintain: { rounds: {} },
};

const ROUND_KINDS: readonly RoundKind[] = ['approach', 'plan', 'review'];
const CAP = /^[1-9][0-9]?$/;

/**
 * The profile's preset with each team key on top. A round cap is a number from 1 to 99 (the schema's `^[1-9][0-9]?$`: never 0, never a negative); a
 * value that is not one is read as unset, so a hand-built config the schema has not seen never opens an unbounded loop or a zero-round one.
 */
export function resolveStrictness(config?: AccordConfig): Strictness {
  const preset = PRESETS[config?.profile === 'maintain' ? 'maintain' : 'build'];
  const rounds: Strictness['rounds'] = { ...preset.rounds };
  const team = config?.strictness?.rounds;
  for (const kind of ROUND_KINDS) {
    const value = team?.[kind];
    if (typeof value === 'string' && CAP.test(value)) rounds[kind] = Number(value);
  }
  return { rounds };
}

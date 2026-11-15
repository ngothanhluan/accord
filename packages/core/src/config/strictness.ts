// ST-LN-50 D-07, D-09: what a team sets under `strictness` in accord/config.yml, resolved in one place. The profile gives a preset, the team's keys come on top,
// and every reader (today the round caps in round/next.ts, later the rule levels and the stages) asks resolveStrictness and nowhere else, so no reader
// knows which of the two a value came from. Pure: the config arrives parsed, nothing is read here.
import type { RoundKind } from '../round/next.js';
import { levelRefusal, SWITCHABLE_STAGES } from '../gate/floor.js';
import type { StageName } from '../gate/floor.js';
import type { AccordConfig } from '../model/snapshot.js';

/**
 * The resolved strictness: `rounds` holds the cap of each record the team set; an absent record keeps the cap its claim pin's rules give. `levels` holds the level of each
 * OVERRIDABLE rule the team set (gate/floor.ts); a key the floor names is never in it. `stages` holds, per lane M, L and P, the stages the team turned off (D-08): never a floor
 * stage (intent, build, verify), and never a key of lane S or lane R, whose every stage is the floor.
 */
export interface Strictness {
  rounds: Partial<Record<RoundKind, number>>;
  levels: Record<string, 'error' | 'warning' | 'off'>;
  stages: Record<'M' | 'L' | 'P', Set<StageName>>;
}

/**
 * D-88/GATE-07: the token and size rules that `maintain` softens to warnings. Defined here, as the data of PRESETS.maintain, and re-exported by gate/rules.ts, so the gate
 * module graph (which reaches this file through round/next.ts) is never read while this file is still being evaluated. Disjoint from READY_PROMOTE.
 */
export const MAINTAIN_DOWNGRADE: readonly string[] = ['lint.token-hardcoded', 'lint.intent-oversize', 'lint.requirements-oversize', 'lint.scenarios-oversize'];

/**
 * The preset of each profile, as data: `build` holds no level (the rule tables decide), `maintain` holds the four MAINTAIN_DOWNGRADE rules at warning. Neither carries round
 * values: the claim pin's rules decide the caps. A team's key on the same rule wins over the preset (resolveStrictness), and the floor is never in a preset (D-09: an existing
 * repository changes nothing; a rule on the floor takes no level from anywhere).
 */
export const PRESETS: Record<'build' | 'maintain', Omit<Strictness, 'stages'>> = {
  build: { rounds: {}, levels: {} },
  maintain: { rounds: {}, levels: Object.fromEntries(MAINTAIN_DOWNGRADE.map((id) => [id, 'warning' as const])) },
};

const ROUND_KINDS: readonly RoundKind[] = ['approach', 'plan', 'review'];
const CAP = /^[1-9][0-9]?$/;

/**
 * The profile's preset with each team key on top. A round cap is a number from 1 to 99 (the schema's `^[1-9][0-9]?$`: never 0, never a negative); a
 * value that is not one is read as unset, so a hand-built config the schema has not seen never opens an unbounded loop or a zero-round one. A level is kept only when the floor lets it stand (levelRefusal): a key naming a LOCKED, a STAGE_OWNED or an
 * unknown rule, or turning off a Ready-promoted one, is dropped, so a hand-edited config cannot lower the floor. A stage is off only when the team's key for lane M, L or P says `off` and the stage is one a team
 * may switch (SWITCHABLE_STAGES); no preset turns one off, and a key for a floor stage or for lane S or R never enters `stages`.
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
  const stages: Strictness['stages'] = { M: new Set(), L: new Set(), P: new Set() };
  const teamStages = config?.strictness?.stages;
  if (teamStages !== undefined && teamStages !== null && typeof teamStages === 'object') {
    for (const lane of ['M', 'L', 'P'] as const) {
      const keys = Object.hasOwn(teamStages, lane) ? teamStages[lane] : undefined;
      if (keys === undefined || keys === null || typeof keys !== 'object') continue;
      for (const stage of SWITCHABLE_STAGES) if (Object.hasOwn(keys, stage) && keys[stage] === 'off') stages[lane].add(stage);
    }
  }
  return { rounds, levels, stages };
}

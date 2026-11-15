// ST-LN-50 D-08: "status and the owner's reports always name the stages that are off". One line per lane that has a stage off, read from the same
// resolveStrictness the gates read, so what a view names is what the engines skip. With no stage off there is no line and every view is as it was.
import { resolveStrictness } from '@accord-dev/accord-core';
import type { AccordConfig } from '@accord-dev/accord-core';

/** `stages off for lane <L>: <a>, <b>` for each of the lanes M, L and P (in that order) that has one, the stages in the order they run. `only` limits it to one lane. */
export function stagesOffLines(config: AccordConfig | undefined, only?: string): string[] {
  const stages = resolveStrictness(config).stages;
  return (['M', 'L', 'P'] as const)
    .filter((lane) => only === undefined || only === lane)
    .flatMap((lane) => (stages[lane].size === 0 ? [] : ['stages off for lane ' + lane + ': ' + [...stages[lane]].join(', ')]));
}

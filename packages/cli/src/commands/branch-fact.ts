// ST-LN-62: the host half of the scope check. Builds the branch fact `accord gate done` hands to the pure core rules.
import { agentTargets, pluginTargets, skillTargets } from '@accord-dev/accord-core';
import type { BranchFact } from '@accord-dev/accord-core';
import pkg from '../../package.json' with { type: 'json' };
import { gitBranchFact } from '../load/fs.js';
import type { CommandContext } from '../run.js';
import { hooksPlanFor, SETTINGS } from './skills.js';

/** `known`: the default ref the caller already read (`review-package`), so the fact does not read it again. */
export function branchFactFor(ctx: CommandContext, id: string, known?: { defaultRef: string | undefined }): BranchFact {
  const config = ctx.snapshot.config;
  const scope = Object.hasOwn(ctx.snapshot.tickets, id) && ctx.snapshot.tickets[id].frontmatter?.lane === 'S';
  if (config === undefined) return gitBranchFact(ctx.root, id, { rendered: [], scope, ...(known === undefined ? {} : { known }) });
  return gitBranchFact(ctx.root, id, {
    rendered: [...skillTargets(config), ...agentTargets(config), ...pluginTargets(config, pkg)],
    scope,
    ...(known === undefined ? {} : { known }),
    settings: {
      path: SETTINGS,
      // What `accord skills sync` would write over the settings file's merge-base text; the same plan `writeHooks` applies.
      expected: (base) => {
        try {
          const plan = hooksPlanFor(base, config);
          return plan === undefined ? undefined : plan.status === 'unchanged' ? base : plan.text;
        } catch {
          return undefined;
        }
      },
    },
  });
}

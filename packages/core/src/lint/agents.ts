// Phase 11 D-02, D-17 (11-ac-2): an `agents:` entry of accord/config.yml that breaks a role's rule is an error, so a hand edit never passes unseen.
// The same problems `accord skills sync` refuses, from the one core function (`agentsProblems`), pointed at the entry: `/agents/<role>/<field>/<index>`.
// LOCKED (gate/floor.ts): a team that could lower it would hand a read-only role a write tool, or run a command from a committed file on every teammate's machine.
import { agentsProblems, agentsRefusal } from '../skills/agents.js';
import type { Rule } from './rules.js';

export const agentsConfig: Rule['check'] = (snapshot) =>
  agentsProblems(snapshot.config).map((p) => ({
    file: 'accord/config.yml',
    pointer: `/agents/${p.role}/${p.field}/${p.index}`,
    // one text per problem through the same function sync prints, minus the closing "nothing was written", which is about a write lint never makes
    reason: agentsRefusal([p]).split('\n').slice(0, -1).join('\n'),
  }));

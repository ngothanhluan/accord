// ST-LN-96 D-02: the tool blocks a hand edit of a ticket's `ruleset`. While the ticket's claim commit is reachable, the field is compared with the pin
// at that commit (the claim fact the host reads); after a squash no claim commit is reachable, no fact is supplied, and both rules stay silent.
// Levels live in rules.ts (D-57); a check returns a draft and never a level.
import type { RepoSnapshot } from '../model/snapshot.js';
import { pinBefore, RULESET_FROM } from '../round/pin.js';
import type { GateRule } from './rules.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';
const PLAIN = /^\d+\.\d+\.\d+$/;

/** The claim fact of `id` when the host read one with a pin: its commit (12 characters) and the pin. Undefined for no ticket, no fact, an `{ error }` fact or a config with no pin. */
function claimOf(snapshot: RepoSnapshot, id: string): { sha: string; pin: string } | undefined {
  const fact = Object.hasOwn(snapshot.claimPins ?? {}, id) ? snapshot.claimPins![id] : undefined;
  if (fact === undefined || 'error' in fact || fact.pin === undefined) return undefined;
  return { sha: (fact.sha ?? '').slice(0, 12), pin: fact.pin };
}

/** The ticket's `ruleset` as written, or undefined when the ticket is unknown or has no such key. */
function rulesetOf(snapshot: RepoSnapshot, id: string): { known: boolean; value?: unknown } {
  if (!Object.hasOwn(snapshot.tickets, id)) return { known: false };
  const fm = snapshot.tickets[id].frontmatter;
  return fm !== undefined && Object.hasOwn(fm, 'ruleset') ? { known: true, value: fm.ruleset } : { known: true };
}

/** The ticket's `ruleset` differs from the pin at its reachable claim commit: the claim writes it and nobody edits it by hand. */
export const rulesetChanged: GateRule['check'] = (snapshot, id) => {
  const own = rulesetOf(snapshot, id);
  const claim = claimOf(snapshot, id);
  if (!own.known || typeof own.value !== 'string' || claim === undefined || own.value === claim.pin) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ruleset',
      reason: `ruleset "${own.value}" differs from accord ${claim.pin} at the claim commit ${claim.sha}; the claim writes ruleset and it is never edited by hand - restore "${claim.pin}"`,
    },
  ];
};

/** The claim commit was made under a release that writes `ruleset` (a plain pin not before RULESET_FROM) and the ticket has none: a hand edit removed it. */
export const rulesetMissing: GateRule['check'] = (snapshot, id) => {
  const own = rulesetOf(snapshot, id);
  const claim = claimOf(snapshot, id);
  if (!own.known || own.value !== undefined || claim === undefined || !PLAIN.test(claim.pin) || pinBefore(RULESET_FROM, claim.pin)) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ruleset',
      reason: `the claim commit ${claim.sha} was made under accord ${claim.pin}, which writes ruleset, and the ticket has none - restore ruleset: "${claim.pin}"`,
    },
  ];
};

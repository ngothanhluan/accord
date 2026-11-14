// ST-LN-96 D-02: the tool blocks a hand edit of a ticket's `ruleset`. While the ticket's claim commit is reachable, the field is compared with the `ruleset` the ticket
// file FIRST held on its branch (the claim fact the host reads: the claim commit's, else the first commit since the claim that wrote one, the sync-time backfill of a
// ticket claimed before RULESET_FROM; a rebase replays those commits' content, so it still matches), and with the config pin at the claim commit only when no commit
// ever wrote one; after a squash no claim commit is reachable, no fact is supplied, and both rules stay silent.
// Levels live in rules.ts (D-57); a check returns a draft and never a level.
import type { RepoSnapshot } from '../model/snapshot.js';
import type { GateRule } from './rules.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';

type Claim = { sha: string; pin: string; ruleset?: string; at?: string };

/**
 * The claim fact of `id` when the host read one with a pin: its commit (12 characters), the pin and the `ruleset` the ticket file first held on its branch with the
 * commit (12 characters) that wrote it (undefined when no commit did). Undefined for no ticket, no fact, an `{ error }` fact or a config with no pin.
 */
function claimOf(snapshot: RepoSnapshot, id: string): Claim | undefined {
  const fact = Object.hasOwn(snapshot.claimPins ?? {}, id) ? snapshot.claimPins![id] : undefined;
  if (fact === undefined || 'error' in fact || fact.pin === undefined) return undefined;
  const sha = (fact.sha ?? '').slice(0, 12);
  if (fact.ruleset === undefined) return { sha, pin: fact.pin };
  return { sha, pin: fact.pin, ruleset: fact.ruleset, at: (fact.rulesetCommit ?? '').slice(0, 12) || sha };
}

/** Where the first-held ruleset was written: the claim commit itself, or a later commit (the backfill). */
const where = (c: Claim): string => (c.at === undefined || c.at === c.sha ? `at the claim commit ${c.sha}` : `first at commit ${c.at}, after the claim commit ${c.sha},`);

/** The ticket's `ruleset` as written, or undefined when the ticket is unknown or has no such key. */
function rulesetOf(snapshot: RepoSnapshot, id: string): { known: boolean; value?: unknown } {
  if (!Object.hasOwn(snapshot.tickets, id)) return { known: false };
  const fm = snapshot.tickets[id].frontmatter;
  return fm !== undefined && Object.hasOwn(fm, 'ruleset') ? { known: true, value: fm.ruleset } : { known: true };
}

/**
 * The ticket's `ruleset` differs from the one its branch first wrote: the `ruleset` the ticket file holds at its reachable claim commit, else the first commit since the claim that wrote one
 * (the backfill), else (no commit wrote one) the pin at the claim commit. The claim and the backfill write it and nobody edits it by hand.
 */
export const rulesetChanged: GateRule['check'] = (snapshot, id) => {
  const own = rulesetOf(snapshot, id);
  const claim = claimOf(snapshot, id);
  if (!own.known || typeof own.value !== 'string' || claim === undefined) return [];
  if (claim.ruleset !== undefined) {
    if (own.value === claim.ruleset) return [];
    return [
      {
        file: ticketFile(id),
        pointer: '/ruleset',
        reason: `ruleset "${own.value}" differs from the ruleset "${claim.ruleset}" the ticket held ${where(claim)}; the claim writes ruleset and it is never edited by hand - restore "${claim.ruleset}"`,
      },
    ];
  }
  if (own.value === claim.pin) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ruleset',
      reason: `ruleset "${own.value}" differs from accord ${claim.pin} at the claim commit ${claim.sha}; the claim writes ruleset and it is never edited by hand - restore "${claim.pin}"`,
    },
  ];
};

/**
 * The ticket's branch wrote a `ruleset` (at its reachable claim commit, or in the first commit since that wrote one) and the ticket has none now: a hand edit removed it. A claim at or after
 * RULESET_FROM always writes the field; a claim before it wrote none until its backfill, so the rule stays silent for a ticket no commit ever gave one, also after a rebase moved the config pin
 * at the claim commit.
 */
export const rulesetMissing: GateRule['check'] = (snapshot, id) => {
  const own = rulesetOf(snapshot, id);
  const claim = claimOf(snapshot, id);
  if (!own.known || own.value !== undefined || claim === undefined || claim.ruleset === undefined) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/ruleset',
      reason: `the ticket held ruleset "${claim.ruleset}" ${where(claim)} and has none now - restore ruleset: "${claim.ruleset}"`,
    },
  ];
};

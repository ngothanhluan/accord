// ST-LN-57: the accord release that cut over to version 2 review records, and the pin reads that decide which version a record may be.
import { normaliseText, splitFrontmatter } from '../load/frontmatter.js';
import { parseYamlMap } from '../load/yaml.js';
import type { RepoSnapshot } from '../model/snapshot.js';

/** The release that ships version 2 records: a version 1 record is allowed only while its pin is below it. */
export const RECORD_V2_FROM = '0.3.1';

const PLAIN = /^(\d+)\.(\d+)\.(\d+)$/;

/** The top-level `accord:` string of a config.yml text, read even when the config fails its schema; undefined when there is none. */
export function pinOf(configText: string): string | undefined {
  const pin = parseYamlMap('accord/config.yml', normaliseText(configText), 0).map?.accord;
  return typeof pin === 'string' ? pin : undefined;
}

/** ST-LN-96 D-02: the top-level `ruleset:` string of a ticket's frontmatter text, read even when the ticket fails its schema; undefined when there is none or it is not a string. */
export function rulesetOfTicket(ticketText: string): string | undefined {
  const yaml = splitFrontmatter(ticketText).yaml;
  if (yaml === null) return undefined;
  const ruleset = parseYamlMap('accord/tickets', yaml, 0).map?.ruleset;
  return typeof ruleset === 'string' ? ruleset : undefined;
}

/** -1, 0 or 1; both arguments are plain x.y.z. */
function compare(a: string, b: string): number {
  const x = PLAIN.exec(a)!.slice(1).map(Number);
  const y = PLAIN.exec(b)!.slice(1).map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1;
  return 0;
}

/** ST-LN-93 D-08: the release that ships the plan size rule: a ticket with no `Expected size:` line is allowed only while its pin is below it. */
export const PLAN_SIZE_FROM = '0.4.1';

/**
 * ST-LN-91 D-11 and D-14: the release from which a Must or Should of round 2 or later cites a ticket line (or a test, a command or a risk tag), and a
 * planner's fix stays inside the tasks its findings name. A record whose first round was recorded under a pin below it keeps the older rules.
 */
export const GROUNDS_V2_FROM = '0.4.1';

/**
 * ST-LN-91 D-04 and D-12: the release that ships the discuss stage: a lane M ticket claimed under a pin below it needs no
 * `accord/tickets/<id>/discuss.md`, and one claimed at or after it does. Read through claimPinBefore, never the working-tree pin.
 */
export const DISCUSS_FROM = '0.4.1';

/**
 * ST-LN-91 D-02, D-12 and D-15: the release that caps the approach critic at two rounds: a ticket whose claim pin is below it keeps five
 * approach rounds and the stop from round 3, whatever pin its approach record began under. Read through claimPinBefore.
 */
export const APPROACH_CAP_FROM = '0.4.1';

/**
 * ST-LN-91 D-09, D-12 and D-15: the release that ships the plan format rules (an `after:` line per task, no fenced block other than an interfaces
 * block, at most TASK_LINE_CAP non-blank lines per task). A ticket whose claim pin is below it keeps the older plan format, whatever pin its
 * plan baseline holds. Read through claimPinBefore.
 */
export const PLAN_FORMAT_FROM = '0.4.1';

/**
 * ST-LN-91 D-07, D-12 and D-15: the release that caps plan critique at three rounds, stops it after a round whose Must + Should count did not fall, and
 * has the plan skill dispatch one plan checker at round 1 (`Critics: plan checker`). A ticket whose claim pin is below it keeps five plan critique rounds,
 * the stop from round 3 and the 0.4.0 round 1, whatever pin its plan-review.md began under. Read through claimPinBefore.
 */
export const PLAN_CAP_FROM = '0.4.1';

/**
 * ST-LN-91 D-19, D-12 and D-15: the release from which the plan checker's round 1 is asked for grounds. A lane ticket other than lane S whose claim pin is not before it has
 * the Must and Should of its plan record's round 1 rest on a ticket line, a test, a command or a risk tag, or be written deferred with a failing case; a ticket claimed earlier
 * keeps GROUNDS_V2_FROM's rule from round 2, read from the pin at the record's first round. Read through claimPinBefore.
 */
export const PLAN_GROUNDS_FROM = '0.4.1';

/**
 * ST-LN-96 D-02: the release from which the claim writes `ruleset: "<pin>"` into the ticket, in the claim commit, and every claimPinBefore reader reads it first. A ticket claimed
 * under a pin below it has no such field and keeps the claim-commit reader. A repository pinned below it is never given the field (its published schema refuses it).
 */
export const RULESET_FROM = '0.5.0';

/** True only when `pin` is a plain x.y.z below `from` and, when `basePin` is a plain x.y.z, not below `basePin`: the rules before `from` hold. */
export function pinBefore(from: string, pin: string | undefined, basePin?: string): boolean {
  if (pin === undefined || !PLAIN.test(pin) || compare(pin, from) >= 0) return false;
  return basePin === undefined || !PLAIN.test(basePin) || compare(pin, basePin) >= 0;
}

/**
 * ST-LN-91 D-15: true when the ticket `id` was claimed under rules older than `from`, so it keeps them until it is done, whatever the
 * working-tree pin says after an upgrade. The reader of the claim pin for every Phase 3 rule that follows the claim: the discuss rule (DISCUSS_FROM), the
 * approach cap with its `## Closed` and no-allowance rules and the approval block that goes with it (APPROACH_CAP_FROM), the plan format rules (PLAN_FORMAT_FROM:
 * the `after:` line, the interfaces block, the task length), the plan cap with its count stop and the plan checker at round 1 (PLAN_CAP_FROM), and the plan
 * checker's round-1 grounds rule (PLAN_GROUNDS_FROM, D-19). ST-LN-96 D-02: the read order is fixed. First the ticket's own frontmatter `ruleset` when it is a plain x.y.z (written
 * at the claim from RULESET_FROM, so a squash or a rebase merge, which drops or rewrites the claim commit, cannot change the rules the ticket was claimed under); a `ruleset` that
 * is not a plain x.y.z is ignored. Then the chain below, unchanged. The five constants are one release, and a test names the equality (D-15). Other rules follow the record or the plan instead and do not ask this pin: the Phase 2 grounds rule (which a ticket claimed earlier keeps) and the plan fix scope read the pin at the first round of the record
 * (GROUNDS_V2_FROM, `recordPins`, and the round facts of review.md), the version 2 review record reads it at the first review round (RECORD_V2_FROM),
 * and the plan size rule reads the pin at the plan's baseline commit (PLAN_SIZE_FROM, `planPins`). So a record begun after an upgrade, on a ticket
 * claimed before it, gets the grounds rule and keeps the five approach rounds. The chain: the host's claim fact (`claimPins[id]`: the pin at the
 * ticket's claim commit, the newest `claim: <id>` commit that is not on the default ref, else the newest overall, and at that commit's merge base with the
 * default ref; a ticket with no claim commit has no fact); a fact with `error` is false (the new rules apply, fail closed); with no fact (no claim commit, no git)
 * the working-tree pin decides, as `planSizeMissing` falls back.
 */
export function claimPinBefore(snapshot: RepoSnapshot, id: string, from: string): boolean {
  const own = Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].frontmatter?.ruleset : undefined;
  if (own !== undefined && PLAIN.test(own)) return pinBefore(from, own);
  const fact = Object.hasOwn(snapshot.claimPins ?? {}, id) ? snapshot.claimPins![id] : undefined;
  if (fact !== undefined && 'error' in fact) return false;
  const { pin, basePin } = fact ?? { pin: snapshot.config?.accord, basePin: undefined };
  return pinBefore(from, pin, basePin);
}

/** ST-LN-91 WR-01: the git error text when the host failed to read the claim pin of `id` (the new rules then apply), else undefined. */
export function claimPinError(snapshot: RepoSnapshot, id: string): string | undefined {
  const fact = Object.hasOwn(snapshot.claimPins ?? {}, id) ? snapshot.claimPins![id] : undefined;
  return fact !== undefined && 'error' in fact ? fact.error : undefined;
}

/**
 * ST-LN-91 WR-04: the sentence a plan answer (`accord round --plan`, `accord gate plan`) adds when git failed reading the claim pin of `id`: the git error, and that
 * the new plan rules apply because of it (fail closed). Undefined when the claim pin was read, so a ticket that has one is answered as before.
 */
export function claimPinNote(snapshot: RepoSnapshot, id: string): string | undefined {
  const error = claimPinError(snapshot, id);
  return error === undefined ? undefined : `${error}; the claim pin could not be read, so the new plan rules apply`;
}

/** True only when `pin` is a plain x.y.z below RECORD_V2_FROM and, when `basePin` is a plain x.y.z, not below `basePin`. */
export function pinAllowsV1(pin: string | undefined, basePin?: string): boolean {
  return pinBefore(RECORD_V2_FROM, pin, basePin);
}

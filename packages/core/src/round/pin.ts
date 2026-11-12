// ST-LN-57: the accord release that cut over to version 2 review records, and the pin reads that decide which version a record may be.
import { normaliseText } from '../load/frontmatter.js';
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

/** True only when `pin` is a plain x.y.z below `from` and, when `basePin` is a plain x.y.z, not below `basePin`: the rules before `from` hold. */
export function pinBefore(from: string, pin: string | undefined, basePin?: string): boolean {
  if (pin === undefined || !PLAIN.test(pin) || compare(pin, from) >= 0) return false;
  return basePin === undefined || !PLAIN.test(basePin) || compare(pin, basePin) >= 0;
}

/**
 * ST-LN-91 D-15: true when the ticket `id` was claimed under rules older than `from`, so it keeps them until it is done, whatever the
 * working-tree pin says after an upgrade. The one reader of the claim pin for every Phase 3 rule (the discuss rule, the approach cap,
 * the plan format rules, the plan cap, its stop and the `Critics:` line): no rule asks any other pin, so the rules of one ticket never
 * disagree. The chain: the host's claim fact (`claimPins[id]`: the pin at the ticket's claim commit, else at the commit that added its
 * ticket file, and at that commit's merge base with the default ref); a fact with `error` is false (the new rules apply, fail closed);
 * with no fact (no claim commit, no git) the working-tree pin decides, as `planSizeMissing` falls back.
 */
export function claimPinBefore(snapshot: RepoSnapshot, id: string, from: string): boolean {
  const fact = Object.hasOwn(snapshot.claimPins ?? {}, id) ? snapshot.claimPins![id] : undefined;
  if (fact !== undefined && 'error' in fact) return false;
  const { pin, basePin } = fact ?? { pin: snapshot.config?.accord, basePin: undefined };
  return pinBefore(from, pin, basePin);
}

/** True only when `pin` is a plain x.y.z below RECORD_V2_FROM and, when `basePin` is a plain x.y.z, not below `basePin`. */
export function pinAllowsV1(pin: string | undefined, basePin?: string): boolean {
  return pinBefore(RECORD_V2_FROM, pin, basePin);
}

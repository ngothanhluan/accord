// Phase 8.4 D-07, D-08: the onboarding scan's proposals merged with the ones `accord init` detects. Init's wins on a related key, because it is
// deterministic; the scan's own proposals never overlap each other either, so the walk never asks about two keys where one covers the other.
// A scan proposal is also dropped, before those key rules, when it names no config key, a key accord writes itself (`walk: false`), carries evidence over 500 characters,
// evidence with a line break or any control or format character (the evidence is one line, so no scout report can be built from it) or evidence that holds neither a citation nor a count (D-07). A citation is a `path:line` that `parseScoutReport`, the parser `accord scout check` uses, reads, so the CLI can
// resolve it against the tracked files. A count is a standalone whole number, optionally `<n> of <m>`, followed by a word for what it counts (COUNT) that is not a function word
// (NOT_COUNTED): a version such as `Node 22`, `v3` or `Python 3.12` is a number and no evidence, and `Node 22 is the runtime` counts nothing. The shape check is syntax and cannot tell
// whether a count is true, which the owner judges on reading it. Every backslash of a scan evidence becomes `/` first, so a Windows path is kept and printed with `/`.
// After the key rules an optional `refuse` callback (the CLI's checks) may drop one more. Pure: no file is read here, the CLI reads the scan's file and passes the entries in.
import { CONFIG_AREAS } from '../audit/config-areas.js';
import { resolveKeyPath } from '../scaffold/configEdit.js';
import { parseScoutReport } from '../scout/report.js';

/** One proposed setting: a dotted key, a JSON value and the evidence for it. */
export interface ConfigProposal {
  key: string;
  value: unknown;
  evidence: string;
}

/** A scan proposal that was refused, with the reason it prints after `dropped:`. */
export interface DroppedProposal extends ConfigProposal {
  reason: string;
}

export interface MergedProposals {
  /** `accord init`'s proposals, the very objects passed in, then the kept scan proposals in their order. A caller tells the two apart by identity with `init`. */
  proposals: ConfigProposal[];
  /** The refused scan proposals in the scan's order. */
  dropped: DroppedProposal[];
}

/** Two dotted keys are related when equal, or when one starts with the other followed by a dot (an ancestor and its descendant). */
function related(a: string, b: string): boolean {
  return a === b || a.startsWith(b + '.') || b.startsWith(a + '.');
}

/** A drop rule returns the reason to drop a scan proposal, or `undefined` to let it pass to the next rule. */
type DropRule = (p: ConfigProposal) => string | undefined;

const MAX_EVIDENCE = 500;

/** A line break, a control character, a format mark (bidi, zero-width) or a line or paragraph separator: evidence holds none, so it is one line of plain text that can never carry rows of its own. */
const NOT_PLAIN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u;

/** A whole number standing alone, optionally `of <m>`, then the word it counts (group 1). Every match of it is tested, not only the first. */
const COUNT = /(?<![\p{L}\p{N}.:/_-])\d+(?:\s+of\s+\d+)?(?![\p{L}\p{N}.:/_-])\s+(\p{L}{2,})(?!\p{L})/gu;

/** Function words that follow a number without being what it counts: `Node 22 is the runtime` holds no count. */
const NOT_COUNTED = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it', 'its', 'not', 'of', 'on', 'or', 'the', 'to', 'was', 'were', 'with',
]);

function hasCitation(evidence: string): boolean {
  return parseScoutReport('## Files\n\n## Facts\n- ' + evidence + '\n').citations.length > 0;
}

function hasCount(evidence: string): boolean {
  for (const m of evidence.matchAll(COUNT)) {
    if (!NOT_COUNTED.has(m[1].toLowerCase())) return true;
  }
  return false;
}

/** The area that holds a top-level key accord writes itself, as `walk: false` marks it. */
function writtenByAccord(segment: string): boolean {
  return CONFIG_AREAS.some((a) => a.walk === false && a.keys.some((k) => k.key === segment));
}

/**
 * Merge the scan's proposals into `accord init`'s. Each scan proposal gets its evidence's backslashes turned into `/`, then goes through an ordered list of rules and the first reason drops it:
 * no config key, a key accord writes, evidence over 500 characters, evidence with a line break or a control character, evidence with no citation and no count, an init proposal's key related to its key (`accord init proposes <key>`),
 * an earlier kept scan proposal's key related to its key (`the scan already proposes <key>`), then the reason `refuse` returns. `refuse` is never called for an init proposal or a dropped one.
 */
export function mergeProposals(
  init: readonly ConfigProposal[],
  scan: readonly ConfigProposal[],
  refuse?: (p: ConfigProposal) => string | undefined,
): MergedProposals {
  const kept: ConfigProposal[] = [];
  const dropped: DroppedProposal[] = [];
  const rules: DropRule[] = [
    (p) => (resolveKeyPath(p.key) === undefined ? `no config key ${p.key}` : undefined),
    (p) => {
      const first = p.key.split('.')[0];
      return writtenByAccord(first) ? `accord writes ${first}` : undefined;
    },
    (p) => (p.evidence.length > MAX_EVIDENCE ? `evidence over ${MAX_EVIDENCE} characters` : undefined),
    (p) => (NOT_PLAIN.test(p.evidence) ? 'evidence holds a line break or a control character' : undefined),
    (p) => (hasCitation(p.evidence) || hasCount(p.evidence) ? undefined : 'no evidence with a file and line or a count'),
    (p) => {
      const hit = init.find((i) => related(i.key, p.key));
      return hit === undefined ? undefined : `accord init proposes ${hit.key}`;
    },
    (p) => {
      const hit = kept.find((k) => related(k.key, p.key));
      return hit === undefined ? undefined : `the scan already proposes ${hit.key}`;
    },
    (p) => refuse?.(p),
  ];
  for (const original of scan) {
    const p: ConfigProposal = { ...original, evidence: String(original.evidence ?? '').replace(/\\/g, '/') };
    let reason: string | undefined;
    for (const rule of rules) {
      reason = rule(p);
      if (reason !== undefined) break;
    }
    if (reason === undefined) kept.push(p);
    else dropped.push({ ...p, reason });
  }
  return { proposals: [...init, ...kept], dropped };
}

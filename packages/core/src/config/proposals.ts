// Phase 8.4 D-07, D-08: the onboarding scan's proposals merged with the ones `accord init` detects. Init's wins on a related key, because it is
// deterministic; the scan's own proposals never overlap each other either, so the walk never asks about two keys where one covers the other.
// Pure: no file is read here, the CLI reads the scan's file and passes the entries in.

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
  /** `accord init`'s proposals unchanged, then the kept scan proposals in their order. */
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

/**
 * Merge the scan's proposals into `accord init`'s. Each scan proposal goes through an ordered list of rules and the first reason drops it:
 * an init proposal's key is related to its key (`accord init proposes <key>`), or an earlier kept scan proposal's key is (`the scan already proposes <key>`).
 */
export function mergeProposals(init: readonly ConfigProposal[], scan: readonly ConfigProposal[]): MergedProposals {
  const kept: ConfigProposal[] = [];
  const dropped: DroppedProposal[] = [];
  const rules: DropRule[] = [
    (p) => {
      const hit = init.find((i) => related(i.key, p.key));
      return hit === undefined ? undefined : `accord init proposes ${hit.key}`;
    },
    (p) => {
      const hit = kept.find((k) => related(k.key, p.key));
      return hit === undefined ? undefined : `the scan already proposes ${hit.key}`;
    },
  ];
  for (const p of scan) {
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

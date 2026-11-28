// Phase 11 D-10, D-11, D-16 (11-ac-11): a `Result: pass` block of a `@ui` scenario names the tier its evidence came from and holds what that tier needs. command, verifier and manual are the screenshot
// tiers: at least one file `accord/tickets/<id>/evidence/ac-<n>-<state>.<png|jpg|jpeg|webp>` for the scenario, and `Evidence commit:` equal (by prefix) to verification.md's `commit:`. `owner check` needs the owner's
// words (`Owner: "<words>"`) and an Evidence that cites a repository path the check exercised. The rule reads `snapshot.tree` and the parsed blocks only: no file is opened, no file name is joined into a path, and
// it never asks which tool made a file or when (the gate checks that the files exist, by name). A `blocked` or `fail` block is gate.result-not-pass's. Levels live in rules.ts.
import type { RepoSnapshot } from '../model/snapshot.js';
import { claimPinBefore, UI_EVIDENCE_FROM } from '../round/pin.js';
import { shaEqual, stageLaneTicket, verificationOf, inSlice } from './done.js';
import { candidates, resolves } from './refs.js';
import type { GateRule } from './rules.js';

/** The four tiers a `@ui` pass names, in the order of D-10 (a, b, c) and D-16. */
export const UI_TIERS = ['command', 'verifier', 'manual', 'owner check'] as const;
const SCREENSHOT_TIERS: readonly string[] = ['command', 'verifier', 'manual'];
const EXTENSIONS = 'png|jpg|jpeg|webp';
const verificationFile = (id: string) => 'accord/tickets/' + id + '/verification.md';

/** True when a tree path is an evidence file of the scenario `tag` (`ac-2`) of ticket `id`: directly in the ticket's evidence folder, `<tag>-<state>.<ext>` with a lower-case state of letters, digits and hyphens. */
export const isEvidenceFile = (path: string, id: string, tag: string): boolean => {
  const folder = 'accord/tickets/' + id + '/evidence/';
  return path.startsWith(folder) && new RegExp(`^${tag}-[a-z0-9][a-z0-9-]*\\.(?:${EXTENSIONS})$`).test(path.slice(folder.length));
};

/** The `ac-n` tags of the `@ui` scenarios of ticket `id` this run judges. */
const uiTags = (snapshot: RepoSnapshot, id: string): Set<string> =>
  new Set(
    (Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].scenarios : []).flatMap((s) =>
      s.tags.includes('@ui') && s.acTag !== undefined && inSlice(snapshot, id, s.acTag) ? [s.acTag] : [],
    ),
  );

/**
 * Phase 11 D-10, D-11, D-16: on a `ui: true` lane M, L or P ticket claimed at or after UI_EVIDENCE_FROM (claimPinBefore: a failed claim read applies the rule), each `Result: pass` block of a `@ui` scenario in the run's
 * slice must name one of the four tiers; a screenshot tier needs a file in the ticket's evidence folder and `Evidence commit:` equal to the verified commit; `owner check` needs a quoted `Owner:` line and a cited
 * repository path. One finding per missing thing, each naming the scenario.
 */
export const uiEvidenceMissing: GateRule['check'] = (snapshot, id) => {
  const ticket = stageLaneTicket(snapshot, id);
  const v = verificationOf(snapshot, id);
  if (ticket === undefined || ticket.frontmatter?.ui !== true || v === undefined || claimPinBefore(snapshot, id, UI_EVIDENCE_FROM)) return [];
  const tags = uiTags(snapshot, id);
  const verified = v.frontmatter?.commit;
  const folder = 'accord/tickets/' + id + '/evidence/';
  const out: { file: string; line: number; reason: string }[] = [];
  for (const b of v.blocks) {
    if (b.result !== 'pass' || !tags.has(b.acTag)) continue;
    const here = `@ui scenario "@${b.acTag}" is recorded Result: pass`;
    const refuse = (reason: string): void => void out.push({ file: verificationFile(id), line: b.line, reason: `${here} ${reason}` });
    if (b.tier === undefined) {
      refuse(`with no Tier: line; name one of ${UI_TIERS.join(', ')}`);
    } else if (SCREENSHOT_TIERS.includes(b.tier)) {
      if (!snapshot.tree.some((p) => isEvidenceFile(p, id, b.acTag))) {
        refuse(`at Tier: ${b.tier}, but there is no file ${folder}${b.acTag}-<state>.png (or .jpg, .jpeg, .webp; <state> is lower-case letters, digits and hyphens)`);
      }
      if (b.evidenceCommit === undefined || verified === undefined || !shaEqual(b.evidenceCommit, verified)) {
        refuse(`at Tier: ${b.tier}, but its Evidence commit is ${b.evidenceCommit ?? 'not recorded'} and the verified commit is ${verified ?? 'not recorded'}; the screenshots must be taken at the verified commit`);
      }
    } else {
      const missing = [
        ...(b.owner === undefined ? ['an Owner: "<the owner\'s words>" line with the words in quotes'] : []),
        ...(candidates(b.evidence, snapshot).some((c) => resolves(c, snapshot) && !Object.hasOwn(snapshot.tests ?? {}, c)) ? [] : ['an Evidence that cites a repository path the check exercised']),
      ];
      if (missing.length > 0) refuse(`at Tier: owner check, which needs ${missing.join(' and ')}`);
    }
  }
  return out;
};

// GATE-01 Ready reasons (D-89, docs/design.md §5). Levels live in rules.ts (D-57); a check returns a
// draft and never a level. Every path here is constructed from the repo-relative ticket id, so no
// absolute path and no backslash can reach a reason (D-51).
import { classifyEars } from '../lint/ears.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, Section, Ticket } from '../model/snapshot.js';
import { doneOnDefault } from '../status/stage.js';
import { approvedHash } from './hash.js';
import type { GateRule } from './rules.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';
// `Object.hasOwn`, never `in`: an id is caller-supplied and `in` would answer true for `toString`.
const ticketOf = (snapshot: RepoSnapshot, id: string): Ticket | undefined =>
  Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
const section = (snapshot: RepoSnapshot, id: string, key: string): Section | undefined =>
  ticketOf(snapshot, id)?.sections.find((s) => headingKey(s.heading) === key);
/** Spec §3: the key that opts a ticket into the workflow-layer contract. */
const laneOf = (snapshot: RepoSnapshot, id: string) => ticketOf(snapshot, id)?.frontmatter?.lane;

/** The gated id is not in the snapshot; this is the whole Ready result. */
export const ticketUnknown: GateRule['check'] = (snapshot, id) =>
  ticketOf(snapshot, id) === undefined ? [{ file: ticketFile(id), reason: 'no ticket ' + id + ' in the snapshot' }] : [];

/**
 * docs/design.md §5: `ui: false` is silent on both profiles. On `maintain` the prototype must exist;
 * on `build` either the prototype or a non-empty `design:` URL satisfies it.
 */
export const designMissing: GateRule['check'] = (snapshot, id) => {
  const frontmatter = ticketOf(snapshot, id)?.frontmatter;
  if (frontmatter === undefined || !frontmatter.ui) return [];
  const proto = 'accord/assets/' + id + '/prototype.html';
  const hasProto = Object.hasOwn(snapshot.files, proto);
  const hasLink = typeof frontmatter.design === 'string' && frontmatter.design !== '';
  const file = ticketFile(id);
  if ((snapshot.config?.profile ?? 'build') === 'maintain') {
    if (hasProto) return [];
    return [{ file, pointer: '/ui', reason: `ui: true needs ${proto}; on this profile a design: URL is not enough` }];
  }
  if (hasProto || hasLink) return [];
  return [{ file, pointer: '/ui', reason: `ui: true needs a non-empty design: URL or ${proto}` }];
};

/**
 * GATE-01 clause 2. An absent `## Intent` is already lint.heading-missing at error, so this rule only
 * answers the case the heading hides: present, and empty once HTML comments are stripped.
 */
export const intentEmpty: GateRule['check'] = (snapshot, id) => {
  const s = section(snapshot, id, 'intent');
  if (s === undefined) return [];
  if (stripHtmlComments(s.lines).some((l) => l.text.trim() !== '')) return [];
  return [{ file: ticketFile(id), line: s.line, reason: '"## Intent" is empty; Ready needs the intent written' }];
};

/**
 * GATE-01 clause 3. `classifyEars` owns what an EARS line is (D-61 to D-64); this rule only asks
 * whether any requirement line is one. lint.ears-unclassified fires per unclassifiable line, so it says
 * nothing at all about a section holding no line worth classifying.
 */
export const earsMissing: GateRule['check'] = (snapshot, id) => {
  // Spec §4: a lane ticket has no Requirements section to hold EARS lines.
  if (laneOf(snapshot, id) !== undefined) return [];
  const s = section(snapshot, id, 'requirements');
  const ticket = ticketOf(snapshot, id);
  if (s === undefined || ticket === undefined) return [];
  if (ticket.requirements.some((l) => 'pattern' in classifyEars(l.text))) return [];
  return [
    {
      file: ticketFile(id),
      line: s.line,
      reason: '"## Requirements" has no EARS line; at least one must name "the system shall"',
    },
  ];
};

/** Spec §7: the owner approves an approach, so an empty one cannot be approved meaningfully. */
export const approachEmpty: GateRule['check'] = (snapshot, id) => {
  if (laneOf(snapshot, id) === undefined) return [];
  const s = section(snapshot, id, 'approach');
  if (s === undefined) return []; // lint.heading-missing owns the absent heading
  if (stripHtmlComments(s.lines).some((l) => l.text.trim() !== '')) return [];
  return [{ file: ticketFile(id), line: s.line, reason: '"## Approach" is empty; the owner approves an approach' }];
};

/** D-04: a lane S ticket is Ready when Understood and Done when are written; each empty one is named. */
export const sectionEmpty: GateRule['check'] = (snapshot, id) => {
  if (laneOf(snapshot, id) !== 'S') return [];
  return ['Understood', 'Done when'].flatMap((name) => {
    const s = section(snapshot, id, headingKey(name));
    if (s === undefined || stripHtmlComments(s.lines).some((l) => l.text.trim() !== '')) return [];
    return [{ file: ticketFile(id), line: s.line, reason: `"## ${name}" is empty; a lane S ticket needs it written before any change` }];
  });
};

/** Spec §4: no approval recorded. */
export const approvalMissing: GateRule['check'] = (snapshot, id) => {
  const fm = ticketOf(snapshot, id)?.frontmatter;
  if (fm?.lane === undefined || fm.lane === 'S' || fm.approved_hash !== undefined) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/approved_hash',
      reason: 'the owner has not approved this ticket; run accord approve ' + id + ' after the owner says yes',
    },
  ];
};

/** Spec §4: exact comparison, prefix included, as `gate.ac-changed` does (D-75). */
export const approvalStale: GateRule['check'] = (snapshot, id) => {
  const ticket = ticketOf(snapshot, id);
  const recorded = ticket?.frontmatter?.approved_hash;
  if (ticket === undefined || ticket.frontmatter?.lane === undefined || ticket.frontmatter.lane === 'S' || recorded === undefined) return [];
  const now = approvedHash(ticket);
  if (recorded === now) return [];
  return [
    {
      file: ticketFile(id),
      pointer: '/approved_hash',
      reason: `the approved sections changed since approval: approved_hash records ${recorded}, they hash to ${now} now; the owner must approve again`,
    },
  ];
};

/** BUG-LN-13 D-06: each prerequisite not done on the default ref the host read, or with none read in this checkout. One lint already reports (unknown, dropped in the checkout) is left to lint's reason; one dropped on the default ref asks for a re-plan, since its merge never comes. */
export const dependsUnmerged: GateRule['check'] = (snapshot, id) => {
  const deps = ticketOf(snapshot, id)?.frontmatter?.depends_on ?? [];
  const onRef = snapshot.defaultRef?.snapshot;
  const where = snapshot.defaultRef === undefined ? 'in this checkout' : 'on ' + snapshot.defaultRef.ref.replace(/^refs\/(?:remotes|heads)\//, '');
  return deps.flatMap((d, i) => {
    const at = { file: ticketFile(id), pointer: '/depends_on/' + i };
    const here = ticketOf(snapshot, d);
    if (here === undefined || here.frontmatter?.status === 'dropped') return [];
    if (onRef !== undefined && ticketOf(onRef, d)?.frontmatter?.status === 'dropped') {
      return [{ ...at, reason: `depends_on names "${d}", which is dropped ${where}; re-plan this ticket without it` }];
    }
    if (doneOnDefault(snapshot, d)) return [];
    return [
      {
        ...at,
        reason: `depends_on names "${d}", which is not done ${where}; wait until its pull request merges, run git fetch, then run accord gate ready ${id} again; never remove it from depends_on`,
      },
    ];
  });
};

// GATE-01 Ready reasons (D-89, docs/design.md §5). Levels live in rules.ts (D-57); a check returns a
// draft and never a level. Every path here is constructed from the repo-relative ticket id, so no
// absolute path and no backslash can reach a reason (D-51).
import { classifyEars } from '../lint/ears.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot, Section, Ticket } from '../model/snapshot.js';
import type { GateRule } from './rules.js';

const ticketFile = (id: string) => 'accord/tickets/' + id + '.md';
// `Object.hasOwn`, never `in`: an id is caller-supplied and `in` would answer true for `toString`.
const ticketOf = (snapshot: RepoSnapshot, id: string): Ticket | undefined =>
  Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id] : undefined;
const section = (snapshot: RepoSnapshot, id: string, key: string): Section | undefined =>
  ticketOf(snapshot, id)?.sections.find((s) => headingKey(s.heading) === key);

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

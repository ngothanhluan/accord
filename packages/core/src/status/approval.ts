// ST-LN-19: the Markdown view the owner approves, six sections, the criteria compacted so a step that
// several scenarios share is printed once with their ids. Nothing is escaped (D-09).
import { APPROVED_SECTIONS } from '../gate/hash.js';
import { leadSteps } from '../load/gherkin.js';
import { headingKey, LIST_MARKER, scan, stripHtmlComments } from '../load/sections.js';
import type { Ticket } from '../model/snapshot.js';

const TITLES = ['Intent', 'Acceptance criteria', 'Vetoes', 'Decisions', 'Corrections', 'Approach'];

interface Node {
  step: string;
  ids: number[]; // indexes into the trie's scenario list, in document order
  kids: Node[];
}

function prose(ticket: Ticket, key: string): string[] {
  const s = ticket.sections.find((x) => headingKey(x.heading) === key);
  const raw = s === undefined ? [] : stripHtmlComments(s.lines);
  // Fenced blocks print as the file holds them: blank lines kept, no blank added inside.
  const { fences } = scan(raw.map((l) => l.text).join('\n'), (raw[0]?.line ?? 1) - 1);
  const inFence = (n: number): boolean => fences.some((f) => n >= f.open && n < f.close);
  const lines = raw.map((l) => ({ t: l.text.trimEnd(), fenced: inFence(l.line) })).filter((l) => l.fenced || l.t !== '');
  if (lines.length === 0) return ['none', ''];
  return lines.flatMap((l, i) =>
    l.fenced || (LIST_MARKER.test(l.t) && i + 1 < lines.length && LIST_MARKER.test(lines[i + 1].t)) ? [l.t] : [l.t, ''],
  );
}

function criteria(ticket: Ticket): string[] {
  const section = ticket.sections.find((x) => headingKey(x.heading) === 'acceptance criteria');
  const leads: Record<number, number> = {};
  if (section !== undefined) {
    const { fences } = scan(section.lines.map((l) => l.text).join('\n'), section.line);
    for (const f of fences) if (f.info.split(/\s+/)[0] === 'gherkin') Object.assign(leads, leadSteps(ticket.id, f));
  }
  const scenarios = ticket.scenarios;
  if (scenarios.length === 0) return ['none', ''];
  const tagCount = new Map<string, number>();
  for (const s of scenarios) if (s.acTag !== undefined) tagCount.set(s.acTag, (tagCount.get(s.acTag) ?? 0) + 1);
  const root: Node = { step: '', ids: [], kids: [] };
  const shared: number[] = []; // per scenario, how many leading steps are shared
  scenarios.forEach((s, i) => {
    shared.push(0);
    if (s.acTag === undefined || tagCount.get(s.acTag) !== 1) return;
    let node = root;
    for (const step of s.steps.slice(0, leads[s.line] ?? 0)) {
      let kid = node.kids.find((k) => k.step === step);
      if (kid === undefined) node.kids.push((kid = { step, ids: [], kids: [] }));
      kid.ids.push(i);
      node = kid;
    }
  });
  const out: string[] = [];
  const emit = (node: Node, depth: number): void => {
    for (const k of node.kids) {
      if (k.ids.length < 2) continue;
      out.push(`- ${k.step} (${k.ids.map((i) => scenarios[i].acTag).join(', ')})`);
      for (const i of k.ids) shared[i] = depth + 1;
      emit(k, depth + 1);
    }
  };
  emit(root, 0);
  if (out.length > 0) out.push('');
  scenarios.forEach((s, i) => {
    out.push(`**${s.acTag === undefined ? '' : s.acTag + ' '}${s.name}**`, ...s.steps.slice(shared[i]).map((t) => `- ${t}`), '');
  });
  return out;
}

export function approvalView(ticket: Ticket): string {
  const out = APPROVED_SECTIONS.flatMap((key, i) => [`## ${TITLES[i]}`, '', ...(key === 'acceptance criteria' ? criteria(ticket) : prose(ticket, key))]);
  return out.join('\n');
}

/** The lines of one section as the short view prints them: HTML comments and blank lines left out, `none` when nothing is left. */
function plain(ticket: Ticket, key: string): string[] {
  const s = ticket.sections.find((x) => headingKey(x.heading) === key);
  const lines = (s === undefined ? [] : stripHtmlComments(s.lines)).map((l) => l.text.trimEnd()).filter((t) => t !== '');
  return lines.length === 0 ? ['none'] : lines;
}

/**
 * ST-LN-91 D-06: the short view the owner approves from: the Intent, one line per criterion (its ac id and name, never its steps),
 * every Decision, the approach findings still open as `risks` (given as recorded) and the path of the full ticket. It only prints:
 * approved_hash and APPROVED_SECTIONS are untouched, so the yes still binds the whole ticket as written. D-22: `blocking` are the open
 * data-loss and security findings; with any, a `## Blocking findings` part follows the risks, and with none the view is as before. `note` (one line)
 * is printed in that part: the git error that made the capped rules apply when the claim pin could not be read.
 */
export function approvalShort(ticket: Ticket, risks: string[], blocking: string[] = [], note?: string): string {
  const criteria = ticket.scenarios.map((s) => `- ${s.acTag === undefined ? '' : s.acTag + ' '}${s.name}`);
  const out = [
    '## Intent', '', ...plain(ticket, 'intent'), '',
    '## Criteria', '', ...(criteria.length === 0 ? ['none'] : criteria), '',
    '## Decisions', '', ...plain(ticket, 'decisions'), '',
    '## Risks', '', ...(risks.length === 0 ? ['none'] : risks.map((r) => `- ${r}`)), '',
    ...(blocking.length === 0
      ? []
      : ['## Blocking findings', '', 'accord approve refuses while one is open; the owner may only say no.', ...(note === undefined ? [] : [note]), ...blocking.map((b) => `- ${b}`), '']),
    `Full ticket: ${ticket.file}`,
  ];
  return out.join('\n') + '\n';
}

// ST-LN-6: the full detail of one lane ticket, the one shape the text output, the JSON and the panel read.
import { acHash } from '../gate/hash.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import { statusRows } from './rows.js';
import type { Stage } from './stage.js';

export type CriterionLabel = 'failing' | 'blocked' | 'verified' | 'passing' | 'not run' | 'untested';
export interface CriterionDetail {
  id: string | null; // 'ac-1'; null for a scenario with no @ac-n tag
  title: string;
  steps: string[]; // as stored: keyword as written, then the text
  label: CriterionLabel;
  test: string | null; // the first @test: tag, without '@test:'
  testResult: 'passed' | 'failed' | 'skipped' | null;
  ticked: boolean; // id is in frontmatter verified:
  verification: 'pass' | 'fail' | 'blocked' | null;
}
export interface TicketDetail {
  id: string;
  title: string;
  stage: Stage;
  lane: 'M' | 'L' | 'P';
  tasksDone: number;
  tasksTotal: number;
  branch: string;
  holder: string | null;
  blockedBy: string[];
  intent: string[];
  criteria: CriterionDetail[];
}

/** undefined unless `id` is a lane ticket in the snapshot. */
export function ticketDetail(snapshot: RepoSnapshot, id: string): TicketDetail | undefined {
  if (!Object.hasOwn(snapshot.tickets, id)) return undefined;
  const ticket = snapshot.tickets[id];
  const fm = ticket.frontmatter;
  const row = statusRows(snapshot).find((r) => r.id === id);
  if (fm === undefined || row?.lane === undefined || row.stage === undefined) return undefined;
  const section = ticket.sections.find((x) => headingKey(x.heading) === headingKey('Intent'));
  const intent = section === undefined ? [] : stripHtmlComments(section.lines).map((l) => l.text).filter((t) => t.trim() !== '');
  const bound = fm.verified_hash === acHash(ticket.scenarios);
  const blocks = Object.hasOwn(snapshot.verifications, id) ? snapshot.verifications[id].blocks : [];
  const criteria = ticket.scenarios.map((s): CriterionDetail => {
    const cid = s.acTag ?? null;
    const test = s.tags.find((t) => t.startsWith('@test:'))?.slice('@test:'.length) ?? null;
    const testResult = test !== null && snapshot.tests !== undefined && Object.hasOwn(snapshot.tests, test) ? snapshot.tests[test] : null;
    const ticked = cid !== null && (fm.verified ?? []).includes(cid);
    const verification = (cid === null ? undefined : blocks.find((b) => b.acTag === cid)?.result) ?? null;
    const label: CriterionLabel =
      testResult === 'failed' || verification === 'fail' ? 'failing'
      : verification === 'blocked' ? 'blocked'
      : ticked && bound ? 'verified'
      : testResult === 'passed' ? 'passing'
      : test !== null ? 'not run'
      : 'untested';
    return { id: cid, title: s.name, steps: s.steps, label, test, testResult, ticked, verification };
  });
  return {
    id, title: row.title ?? '', stage: row.stage, lane: row.lane,
    tasksDone: row.tasksDone ?? 0, tasksTotal: row.tasksTotal ?? 0, branch: row.branch ?? '',
    holder: row.claimedBy ?? null, blockedBy: row.blockedBy ?? [], intent, criteria,
  };
}

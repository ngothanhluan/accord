// ST-LN-6: the full detail of one lane ticket, the one shape the text output, the JSON and the panel read.
import { acHash } from '../gate/hash.js';
import { headingKey, stripHtmlComments } from '../load/sections.js';
import type { Lane, RepoSnapshot } from '../model/snapshot.js';
import { reviewSummary } from './review.js';
import type { ReviewSummary } from './review.js';
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
/** Phase 08.7 D-04: one line of the ticket's session log; the CLI host fills it from git, the agent report files and the gate run record (08.7-05), core never does. */
export interface TicketLogEntry { at: number; kind: 'commit' | 'gate' | 'report'; text: string; fail?: true }
export interface TicketDetail {
  id: string;
  title: string;
  stage: Stage;
  lane: Lane;
  tasksDone: number;
  tasksTotal: number;
  branch: string;
  holder: string | null;
  blockedBy: string[];
  intent: string[];
  question?: string[]; // ST-LN-94: lane R only, the ## Question lines; intent stays empty for lane R
  criteria: CriterionDetail[];
  stagesOff?: string[]; // Phase 08.7 D-07: the stages the team turned off for this ticket's lane, the row's own list; absent when none is off
  review?: ReviewSummary; // Phase 08.7 D-04: the review rounds counted per round and severity; absent without a review record
  log?: TicketLogEntry[]; // Phase 08.7 D-04: filled by the CLI host (08.7-05), never by core
}

/** undefined unless `id` is a lane ticket in the snapshot. `blockedBy` is decided on the default branch the host read (`snapshot.defaultRef`), else by `plain`, the checkout-only snapshot (BUG-LN-2 D-04, D-05, BUG-LN-13 D-01). */
export function ticketDetail(snapshot: RepoSnapshot, id: string, plain?: RepoSnapshot): TicketDetail | undefined {
  if (!Object.hasOwn(snapshot.tickets, id)) return undefined;
  const ticket = snapshot.tickets[id];
  const fm = ticket.frontmatter;
  const row = statusRows(snapshot, undefined, plain).find((r) => r.id === id);
  if (fm === undefined || row?.lane === undefined || row.stage === undefined) return undefined;
  const lines = (name: string): string[] => {
    const section = ticket.sections.find((x) => headingKey(x.heading) === headingKey(name));
    return section === undefined ? [] : stripHtmlComments(section.lines).map((l) => l.text).filter((t) => t.trim() !== '');
  };
  const laneR = row.lane === 'R';
  const intent = laneR ? [] : lines('Intent');
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
  const review = reviewSummary(snapshot, id);
  return {
    id, title: row.title ?? '', stage: row.stage, lane: row.lane,
    tasksDone: row.tasksDone ?? 0, tasksTotal: row.tasksTotal ?? 0, branch: row.branch ?? '',
    holder: row.claimedBy ?? null, blockedBy: row.blockedBy ?? [], intent, ...(laneR ? { question: lines('Question') } : {}), criteria,
    ...(row.stagesOff === undefined ? {} : { stagesOff: row.stagesOff }), ...(review === undefined ? {} : { review }),
  };
}

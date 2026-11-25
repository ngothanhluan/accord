// Phase 08.9.2 Ruling-narrow, Ruling-oracle: the repository the narrow-load tests read. Every cross-ticket read of RESEARCH F-6 has a ticket in it: an epic with children, a story in build,
// dependencies that are unfinished, finished, dropped and unknown, a dependency cycle, a dependency two steps away, an archived ticket, a lane S and a lane R ticket, and a claim branch
// that exists on origin only. `extra` plain draft tickets are added on top, so a test can show that a command does not open more files as the repository grows.
import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { commitMsg, gitRun, makeLaneRepo } from './repo.js';
import { building, discussFiles, done, laneTicket, LANE_S_BODY, P } from '../../../../test/helpers/lane.js';
import type { Files } from '../../../../test/helpers/lane.js';

/** The story in build, a child of the epic, with a claim branch of its own. */
export const STORY = 'B-1';
/** The epic of STORY and its two sibling stories. */
export const EPIC = 'E-1';
/** The ticket whose claim branch exists on origin only. */
export const ORIGIN_ONLY = 'O-1';
/** A ticket filed only on its claim branch, and one that names a parent and a dependency there; a ticket on the default branch whose claim copy adds a dependency. */
export const CLAIM_ONLY = 'N-1';
export const CLAIM_RELATED = 'N-2';
export const CLAIM_ADDS = 'M-1';

const R_BODY = ['## Question', 'Does the critic need a second round?', '', '## Timebox', '4 hours', '', '## Token budget', '800k weighted tokens', ''].join('\n');
const RECORD = 'accord/research/2026-11-20-R-1.md';
const REVIEW = ['Round record: 1', '', '## Round 1', '', 'Must 1 [patch]: the writer drops the header — src/export.ts:3 — fixed in abc1234', '', '## Round 2', '', 'Nice 1 [patch]: rename w — src/export.ts:1 — deferred', '', '## Round 3', '', 'Nice 1 [patch]: a comment typo — src/export.ts:2 — deferred', '', '## Round 4', '', 'Should 1 [patch]: a comma is not quoted — src/export.ts:9 — open', ''].join('\n');

/** A sandbox on `main` (with a faked `origin/main`) holding the cross-ticket cases above plus `extra` plain draft tickets. The caller removes it with `cleanup`. */
export function narrowFixture(extra = 0): string {
  const files: Files = {};
  // an epic with three children: the story in build and two siblings
  files[P(EPIC)] = laneTicket(EPIC, { lane: 'L' }).replace('type: story', 'type: epic');
  building(files, STORY, { frontmatter: ['parent: "E-1"'] });
  files['accord/tickets/' + STORY + '/ledger.md'] = '## Tasks\n- task 1 done abc1234\n';
  files[P('C-1')] = laneTicket('C-1', { frontmatter: ['parent: "E-1"'] });
  files[P('C-2')] = laneTicket('C-2', { frontmatter: ['parent: "E-1"', 'status: draft'] });
  // the siblings' lessons reach the story's anchor from the default branch, so a narrow load must hand that read every ticket id
  files['accord/tickets/C-1/ledger.md'] = ['## Rulings', '(none)', '', '## Epic lessons', '- Lesson: keep the cart on one page — "one cart per user"', ''].join('\n');
  files['accord/tickets/C-2/ledger.md'] = ['## Rulings', '(none)', '', '## Epic lessons', '- Lesson: guests pay without an account — "guests must be able to pay"', ''].join('\n');
  // a ticket that depends on an unfinished one, a finished one, a dropped one and one that does not exist
  files[P('U-1')] = laneTicket('U-1', { frontmatter: ['status: draft'] });
  done(files, 'F-1');
  files[P('DR-1')] = laneTicket('DR-1', { frontmatter: ['status: dropped'] });
  files[P('W-1')] = laneTicket('W-1', { frontmatter: ['depends_on: ["U-1", "F-1", "DR-1", "NOPE-1"]'] });
  // a dependency two steps away, and a cycle
  files[P('U-2')] = laneTicket('U-2', { frontmatter: ['depends_on: ["U-1"]'] });
  files[P('Z-1')] = laneTicket('Z-1', { frontmatter: ['depends_on: ["U-2"]'] });
  files[P('Y-1')] = laneTicket('Y-1', { frontmatter: ['status: draft', 'depends_on: ["Y-2"]'] });
  files[P('Y-2')] = laneTicket('Y-2', { frontmatter: ['status: draft', 'depends_on: ["Y-1"]'] });
  // an archived ticket, a lane S ticket and a lane R ticket with its record
  done(files, 'A-1', { frontmatter: ['status: archived'] });
  files[P('S-1')] = laneTicket('S-1', { lane: 'S', body: LANE_S_BODY });
  files[P('R-1')] = laneTicket('R-1', { lane: 'R', body: R_BODY, frontmatter: [`research: ["${RECORD}"]`] });
  files[RECORD] = ['# Critic rounds', '', 'Date: 2026-11-20', 'Repository at `1c5704ee`', '', 'The critic needs one round.', ''].join('\n');
  files[P(ORIGIN_ONLY)] = laneTicket(ORIGIN_ONLY);
  files[P(CLAIM_ADDS)] = laneTicket(CLAIM_ADDS, { frontmatter: ['status: draft'] });
  // a ticket that depends on the claimed story and on the one claimed on origin only, so `show` reads their claim-branch copies
  files[P('V-1')] = laneTicket('V-1', { frontmatter: ['depends_on: ["B-1", "O-1"]'] });
  for (let i = 1; i <= extra; i++) {
    const id = 'X-' + String(i).padStart(3, '0');
    files[P(id)] = laneTicket(id, { frontmatter: ['status: draft'] });
  }
  // a lane M ticket needs its discuss record to pass Ready, so the fixture holds both verdicts
  Object.assign(files, discussFiles(STORY, 'C-1', 'C-2', 'U-1', 'F-1', 'W-1', 'U-2', 'Z-1', 'Y-1', 'Y-2', ORIGIN_ONLY, 'V-1'));
  const repo = makeLaneRepo(files);
  gitRun(repo, 'config', 'user.email', 'an@example.com');
  gitRun(repo, 'config', 'user.name', 'fixture');
  gitRun(repo, 'config', 'commit.gpgsign', 'false');
  commitMsg(repo, 'fixture');
  gitRun(repo, 'branch', '-M', 'main');
  gitRun(repo, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  // the story's claim branch, here too; a ticket claimed on origin only
  // the story's claim branch holds one more done task than the checkout, so `show` of it reads a different copy there than on main
  gitRun(repo, 'switch', '-q', '-c', 't/' + STORY);
  writeFileSync(join(repo, 'accord/tickets/' + STORY + '/ledger.md'), '## Tasks\n- task 1 done abc1234\n- task 2 done abc1234\n');
  // and a review record with four rounds, so the executor dispatch check of a hook in the story's worktree has an answer to refuse with
  writeFileSync(join(repo, 'accord/tickets/' + STORY + '/review.md'), REVIEW);
  commitMsg(repo, 'claim: ' + STORY, undefined, true);
  gitRun(repo, 'switch', '-q', 'main');
  // a ticket filed only on its claim branch (none in the checkout), one whose claim branch names a parent and a dependency, and a ticket whose claim copy adds a dependency its checkout copy lacks:
  // `show` reads these from the claim branch, and a relation they name that the narrow set does not hold is read in full
  for (const [id, frontmatter] of [
    [CLAIM_ONLY, []],
    [CLAIM_RELATED, ['parent: "E-1"', 'depends_on: ["U-1"]']],
    [CLAIM_ADDS, ['depends_on: ["U-1"]']],
  ] as const) {
    gitRun(repo, 'switch', '-q', '-c', 't/' + id);
    writeFileSync(join(repo, 'accord/tickets/' + id + '.md'), laneTicket(id, { frontmatter: ['status: draft', ...frontmatter] }));
    commitMsg(repo, 'claim: ' + id);
    gitRun(repo, 'switch', '-q', 'main');
  }
  gitRun(repo, 'switch', '-q', '-c', 't/' + ORIGIN_ONLY);
  commitMsg(repo, 'claim: ' + ORIGIN_ONLY, undefined, true);
  gitRun(repo, 'update-ref', 'refs/remotes/origin/t/' + ORIGIN_ONLY, gitRun(repo, 'rev-parse', 'HEAD').trim());
  gitRun(repo, 'switch', '-q', 'main');
  gitRun(repo, 'branch', '-D', 't/' + ORIGIN_ONLY);
  return repo;
}

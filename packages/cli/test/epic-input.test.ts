// ST-LN-28 D-13: the epic's Vetoes and Decisions reach a story's anchor and the SubagentStart hook, built by the CLI from the default branch.
import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, commitAll, gitRun, makeLaneRepo, run, writeFiles } from './helpers/repo.js';
import { laneTicket } from '../../../test/helpers/lane.js';

const VETOES = ['- No new dependency.', '- No emoji.'];
const D1 = '- D-01 One cart — "one cart per user"';
const D2 = '- D-02 Guest checkout stays — "guests must be able to pay"';

function epic(id: string, decisions: string[]): string {
  const body = ['## Intent', 'Group the checkout stories.', '', '## Vetoes', ...VETOES, '', '## Decisions', ...decisions, '', '## Corrections', ''].join('\n');
  return laneTicket(id, { lane: 'L', body }).replace('type: story', 'type: epic').replace('title: "Export"', 'title: "Checkout epic"');
}
const BLOCK = (decisions: string[]): string => ['## Epic E-1 "Checkout epic"', '### Vetoes', ...VETOES, '### Decisions', ...decisions, '### Epic lessons', '(none)'].join('\n');

const repos: string[] = [];
afterEach(() => {
  for (const r of repos.splice(0)) cleanup(r);
});

/**
 * E-1 holds both Decisions on the default branch; S-1 (parent E-1) is on its own branch t/S-1, whose working tree holds an older E-1 with one Decision.
 * No origin: the default ref is the local main (or master) branch.
 */
function storyRepo(): string {
  const repo = makeLaneRepo({ 'accord/tickets/E-1.md': epic('E-1', [D1, D2]), 'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "E-1"'] }) });
  repos.push(repo);
  commitAll(repo, 'main');
  gitRun(repo, 'checkout', '-q', '-b', 't/S-1');
  writeFiles(repo, { 'accord/tickets/E-1.md': epic('E-1', [D1]) });
  commitAll(repo, 'older epic copy on the story branch');
  return repo;
}

describe('accord anchor and the epic', () => {
  it('ac-8 accord anchor prints a story\'s epic rules (ST-LN-28 7-ac-8)', async () => {
    const repo = storyRepo();
    // on the story's branch: the epic block, from the default branch's copy, after Corrections and before Research and Rulings
    const here = await run(['anchor'], repo);
    expect(here.code).toBe(0);
    expect(here.out).toContain('# Anchor: S-1');
    expect(here.out).toContain('## Corrections\n(none)\n\n' + BLOCK([D1, D2]) + '\n\n## Rulings\n(none)\n');
    // by id from the same checkout
    const named = await run(['anchor', 'S-1'], repo);
    expect(named.out).toBe(here.out);
    // a ticket without parent: the anchor is unchanged
    const plain = await run(['anchor', 'T-1'], repo);
    expect(plain.code).toBe(0);
    expect(plain.out).not.toContain('Epic');
    expect(plain.out.endsWith('## Corrections\n(none)\n\n## Rulings\n(none)\n')).toBe(true);
  });

  it('ac-8 a story whose parent is no epic gets one line in its anchor (ST-LN-28 7-ac-8)', async () => {
    const repo = makeLaneRepo({ 'accord/tickets/S-1.md': laneTicket('S-1', { frontmatter: ['parent: "T-1"'] }) });
    repos.push(repo);
    commitAll(repo, 'main');
    const r = await run(['anchor', 'S-1'], repo);
    expect(r.code).toBe(0);
    expect(r.out).toContain('\n\nparent T-1 is not an epic in this clone\n\n## Rulings');
    expect(r.out).not.toContain('### Vetoes');
  });
});

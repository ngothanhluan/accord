// Phase 8.1 G3a (D-12, 8.1-ac-9): no gate reads conventions.md or the linter, so `gate ready` says the same whatever either holds.
import { expect, it } from 'vitest';
import { gateReady, loadSnapshot } from '../src/index.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const FILLED = '# Conventions\n\n- Use named exports — enforced by: no-default-export\n- Tests sit beside the code — enforced by: prose\n';
const EMPTY = '# Conventions\n\n<!-- One rule per line. -->\n';

const ready = (conventions: string, linter: boolean) => {
  const files = { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': laneTicket('T-1'), 'accord/product/conventions.md': conventions };
  const tree = [...Object.keys(files), ...(linter ? ['eslint.config.js'] : [])];
  return gateReady(loadSnapshot({ files, tree }), 'T-1');
};

it('risk:regression gate ready is the same with or without conventions and a linter (8.1-ac-9)', () => {
  const base = ready(EMPTY, false);
  // the comparison is over a real verdict for the ticket, not over an unknown-ticket stub
  expect(base.ticket).toBe('T-1');
  expect(['pass', 'fail']).toContain(base.verdict);
  for (const [conventions, linter] of [[FILLED, false], [EMPTY, true], [FILLED, true]] as const) {
    expect(ready(conventions, linter)).toEqual(base);
  }
});

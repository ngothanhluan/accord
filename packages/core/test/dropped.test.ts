import { expect, it } from 'vitest';
import { markDropped } from '../src/index.js';
import { LANE_BODY, laneTicket } from '../../../test/helpers/lane.js';

const T = (body: string) => laneTicket('T-1', { body });
const S = (t: string) => t.replace('status: open', 'status: "dropped"');

it('risk:parsing the dropped writer replaces or places the section and reads a reason already written', () => {
  expect(markDropped(T(LANE_BODY), 'no longer needed')).toBe(S(T(LANE_BODY)) + '\n## Dropped\nno longer needed\n');
  const B1 = '## Intent\nx\n\n## Dropped\nold reason\nmore\n\n## Approach\ny\n';
  expect(markDropped(T(B1), 'new')).toBe(S(T('## Intent\nx\n\n## Dropped\nnew\n\n## Approach\ny\n')));
  expect(markDropped(T('## Intent\nx\n\n## Verification notes\nn\n'), 'r')).toBe(
    S(T('## Intent\nx\n\n## Dropped\nr\n\n## Verification notes\nn\n')),
  );
  expect(markDropped(T(B1))).toBe(S(T(B1)));
  expect(markDropped(T(LANE_BODY))).toBeUndefined();
  expect(markDropped(T('## Intent\nx\n\n## Dropped\n<!-- why -->\n'))).toBeUndefined();
  expect(markDropped(T('## Intent\nx\n\n## Acceptance criteria\n```gherkin\n## Dropped\nFeature: a\n```\n'))).toBeUndefined();
});

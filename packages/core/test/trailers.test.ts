import { expect, it } from 'vitest';
import { forbiddenLines } from '../src/index.js';

it('risk:parsing a forbidden line is found by letter case and leading whitespace and never in the subject', () => {
  expect(forbiddenLines('Co-Authored-By: A <a@example.com>\n\nplain body\n')).toEqual([]);
  expect(forbiddenLines('Generated with care\n')).toEqual([]);
  expect(forbiddenLines('feat: x\n\nAdds the parser.\nCo-Authored-By: Bot <bot@example.com>\n')).toEqual(['Co-Authored-By: Bot <bot@example.com>']);
  expect(forbiddenLines('feat: x\n\n   co-authored-BY: Bot <b@example.com>  \n')).toEqual(['co-authored-BY: Bot <b@example.com>']);
  expect(forbiddenLines('feat: x\n\n\tSigned-off-by: A\nReviewed-by: B\nAcked-by: C\nX2-by: D\n')).toEqual(['Signed-off-by: A', 'Reviewed-by: B', 'Acked-by: C', 'X2-by: D']);
  expect(forbiddenLines('feat: x\n\nsee 🤖 GENERATED WITH [Claude Code](https://claude.com/claude-code)\r\n')).toEqual(['see 🤖 GENERATED WITH [Claude Code](https://claude.com/claude-code)']);
  expect(forbiddenLines('feat: x\n\nbuild: tidy\nOwner: "yes"\nCo-Authored: x\nwritten by: me\nCo_Authored-By: x\nby: x\n')).toEqual([]);
});

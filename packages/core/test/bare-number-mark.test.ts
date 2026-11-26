// Phase 08.9.1 D-03: the audit's fix text for an undecided deferred item names the `#<n>` mark for an id that is only digits.
import { expect, it } from 'vitest';
import { deferredGaps, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

it('risk:regression the audit fix names the #<n> mark for a bare-number id (08.9.1 D-03)', () => {
  const [gap] = deferredGaps([{ id: 'D-1', items: [{ rating: 'Must', text: 'x (Must)' }] }]);
  expect(gap.fix).toContain(' → #<new id>');
  expect(gap.fix).toContain(' → <new id>');
  expect(gap.fix).toContain(' → declined');
});

it('risk:regression the verify and audit skills name the #<n> mark for a bare-number id (08.9.1 D-03)', () => {
  const bad: string[] = [];
  for (const runtime of ['claude', 'codex'] as const) {
    const files = skillTargets(config(runtime));
    const verify = files.find((f) => f.path.endsWith('/accord/verify-deferred.md'));
    const audit = files.find((f) => f.path.endsWith('/accord-audit/SKILL.md'));
    if (verify === undefined) bad.push(runtime + ': verify-deferred.md is not rendered');
    else {
      const text = verify.text.replace(/\s+/g, ' ');
      if (!text.includes('` → #<new id>`')) bad.push(runtime + ': verify-deferred.md lacks the # mark');
      if (!text.includes("append ` → <new id>` to the end of that item's line in `accord/tickets/<id>/ledger.md`")) bad.push(runtime + ': verify-deferred.md lost its pinned phrase');
    }
    if (audit === undefined) bad.push(runtime + ': accord-audit/SKILL.md is not rendered');
    else {
      const text = audit.text.replace(/\s+/g, ' ');
      const at = text.indexOf('`deferred-undecided`: ');
      const step = text.slice(at, at + 1100);
      if (at < 0) bad.push(runtime + ': no deferred-undecided step');
      for (const p of ['` → #<new id>`', '` → <new id>`', '` → declined`'])
        if (at >= 0 && !step.includes(p)) bad.push(runtime + ' deferred step lacks: ' + p);
    }
  }
  expect(bad).toEqual([]);
});

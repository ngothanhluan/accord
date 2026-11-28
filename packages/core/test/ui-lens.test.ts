// Phase 11 G3 (D-08, 11-ac-9): the built-in `ui` lens is core data (templates/lens-ui.md), parsed once into UI_LENS; `lensesFor` adds it first for a `ui: true` lane M, L or P ticket, and a repository file
// `accord/lenses/ui.md` (a lint error) never replaces it. The CLI reads this; no model decides whether the lens runs.
import { describe, expect, it } from 'vitest';
import { templates } from '../src/generated/templates.js';
import { lensesFor, parseLens, UI_LENS } from '../src/index.js';
import type { LensFile } from '../src/index.js';

const file = (name: string, text: string): LensFile => parseLens(`accord/lenses/${name}.md`, text);
const DB = file('db', '---\npaths: [src/db/]\non_finding: warn\n---\n\n- Every query uses parameters.\n');
const REPO_UI = file('ui', '---\non_finding: warn\n---\n\n- A weaker checklist the repository wrote.\n');
const at = (over: Partial<{ lane: string | undefined; ui: boolean; changed: string[] }> = {}) => ({ lane: 'M' as string | undefined, changed: ['src/a.ts'], others: [], ui: true, ...over });

describe('the ui lens checklist (11-ac-9, D-08)', () => {
  it('risk:regression the checklist holds each D-08 item, names roles only and reads with no problem (11-ac-9, D-08)', () => {
    const read = parseLens('accord/lenses/lens-ui.md', templates['lens-ui.md']);
    expect(read.problems).toEqual([]);
    expect(UI_LENS.name).toBe('ui');
    expect(UI_LENS.mode).toBe('block');
    expect(UI_LENS.paths).toBeUndefined();
    expect(UI_LENS.problems).toEqual([]);
    const text = UI_LENS.body.toLowerCase();
    for (const item of ['empty', 'loading', 'error', 'overflow', 'narrow width', 'keyboard', 'focus', 'contrast', 'labels', "the project's own components and tokens", 'design reference']) {
      expect(text, item).toContain(item);
    }
    // every checklist line is a list item, so the lens never opens a heading inside the package
    for (const line of UI_LENS.body.split('\n').filter((l) => l.trim() !== '')) expect(line.startsWith('- '), line).toBe(true);
    // 999.6: the lens names roles and checks, never another tool or a skill
    for (const name of ['impeccable', 'playwright', 'figma', 'storybook', 'cursor', 'codex', 'copilot', 'claude', 'skill']) expect(text, name).not.toContain(name);
    expect(UI_LENS.body).not.toContain('\\');
  });
});

describe('the ui trigger of lensesFor (11-ac-9, D-08)', () => {
  it('risk:regression a ui: true lane M, L or P ticket gets the ui lens first, before the team lenses (11-ac-9, D-08)', () => {
    for (const lane of ['M', 'L', 'P']) {
      expect(lensesFor([DB], at({ lane, changed: ['src/db/x.ts'] })).map((l) => l.name), lane).toEqual(['ui', 'db']);
      expect(lensesFor([], at({ lane })).map((l) => l.name), lane).toEqual(['ui']);
    }
    expect(lensesFor([], at())[0]).toBe(UI_LENS);
  });

  it('risk:regression a ui: false or unmarked ticket and a lane S ticket get no ui lens (11-ac-9, D-08)', () => {
    expect(lensesFor([DB], at({ ui: false, changed: ['src/db/x.ts'] })).map((l) => l.name)).toEqual(['db']);
    expect(lensesFor([], { lane: 'M', changed: [], others: [] })).toEqual([]);
    for (const lane of ['S', 'R', undefined]) expect(lensesFor([DB], at({ lane, changed: ['src/db/x.ts'] })), String(lane)).toEqual([]);
  });

  it('risk:security a repository file named ui never replaces the built-in lens, nor runs on a ticket that is not ui (11-ac-9, D-08, T-11-27)', () => {
    const picked = lensesFor([REPO_UI, DB], at({ changed: ['src/db/x.ts'] }));
    expect(picked.map((l) => l.name)).toEqual(['ui', 'db']);
    expect(picked[0]).toBe(UI_LENS);
    expect(picked[0].mode).toBe('block');
    expect(picked[0].body).not.toContain('weaker');
    expect(lensesFor([REPO_UI], at({ ui: false })).map((l) => l.name)).toEqual([]);
  });
});

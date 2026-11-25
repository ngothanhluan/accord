// Phase 08.9.2 D-02: `/accord-onboard` asks the one plain question whether anyone on the team works in this repository without accord, and on a yes proposes `hook_mode` quiet,
// written only through `accord config set` after the owner's yes. The rule is asserted over the RENDERED onboard skill in every runtime, whitespace collapsed, and its size.
import { expect, it } from 'vitest';
import { skillDirs, skillTargets } from '../src/index.js';
import type { AccordConfig } from '../src/index.js';

const RUNTIMES: AccordConfig['runtimes'] = ['claude', 'codex', 'cursor', 'copilot'];
const MAX_BYTES = 6000; // the rendered limit of packages/core/test/skills.test.ts
const config = (runtime: AccordConfig['runtimes'][number]): AccordConfig => ({
  accord: '0.1.0',
  profile: 'build',
  tracker: { adapter: 'none' },
  design: { tokens: '' },
  roles: ['ba', 'dev'],
  runtimes: [runtime],
});

const flat = (text: string): string => text.replace(/\s+/g, ' ');
/** Every render of the onboard SKILL.md under a runtime: one per skill directory the runtime loads. */
const onboardFiles = (runtime: AccordConfig['runtimes'][number]) => {
  const wanted = new Set(skillDirs(config(runtime)).map((dir) => `${dir}/accord-onboard/SKILL.md`));
  return skillTargets(config(runtime)).filter((f) => wanted.has(f.path));
};
const PHRASES = ['works in this repository without accord', 'accord config set hook_mode quiet', "after the owner's yes"];

// Phase 08.9.2 D-02: the onboard skill asks the hook mode question and writes quiet only through config set after a yes, within the rendered size limit.
it("risk:regression onboard asks the hook mode question and writes quiet only through config set after a yes (D-02)", () => {
  const bad: string[] = [];
  for (const runtime of RUNTIMES) {
    const files = onboardFiles(runtime);
    if (files.length === 0) bad.push(`${runtime}: no rendered onboard skill`);
    for (const file of files) {
      const text = flat(file.text);
      for (const phrase of PHRASES) if (!text.includes(phrase)) bad.push(`${runtime} ${file.path}: lacks "${phrase}"`);
      const bytes = Buffer.byteLength(file.text, 'utf8');
      if (bytes > MAX_BYTES) bad.push(`${runtime} ${file.path}: ${bytes} bytes, over ${MAX_BYTES}`);
    }
  }
  expect(bad).toEqual([]);
});

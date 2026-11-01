// Agent definitions as data: rendering, routing, and the drift gate against agents/.
import { readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { parse } from 'yaml';
import { agents, agentTargets, contentHash, markerHash, renderAgent, rulesetText, skillTargets, withoutMarker } from '../src/index.js';
import type { AccordConfig, AgentKey } from '../src/index.js';

const agentsDir = fileURLToPath(new URL('../agents/', import.meta.url));
const config = (over: Partial<AccordConfig> = {}): AccordConfig =>
  ({ accord: '0.1.0', profile: 'build', tracker: { adapter: 'none' }, design: { tokens: '' }, roles: ['ba', 'dev'], runtimes: ['claude'], ...over }) as AccordConfig;
const frontmatter = (text: string): Record<string, unknown> => parse(text.split('---\n')[1]) as Record<string, unknown>;
const bodyOf = (text: string): string => withoutMarker(text).split('\n---\n').slice(1).join('\n---\n');
const scout = (c: AccordConfig): string => agentTargets(c).find((f) => f.path === '.claude/agents/accord-scout.md')?.text ?? '';

// What each agent must name, asserted over the RENDERED agent file, as REQUIRED is over a rendered skill.
const AGENT_REQUIRED: Record<string, readonly string[]> = {
  executor: ['plan.md', 'never weaken', 'BLOCKED', 'findings'],
  critic: ['defer to plan', 'three concrete failure scenarios', 'Check that no Veto is violated', 'without asking', 'Should'],
  planner: ['(new)', 'must not change', 'wiring', 'polish', 'highest existing number', 'Keep `baseline:` as it is', '`direction` mode', 'first rung', 'climb further'],
  reviewer: ['Extra', 'written conventions', 'product/', 'linter', 'Undeclared files', 'Ruling', 'lane S'],
  verifier: ['distrust', 'Substantive', 'Wired', 'Data flows', 'Result: blocked', 'verification.md'],
  debugger: ['measurement', 'cheapest probe', 'parallel round', '## Episode <n>'],
};

describe('agents name what the spec requires', () => {
  for (const [role, phrases] of Object.entries(AGENT_REQUIRED)) {
    it(`${role} names every required phrase`, () => {
      const text = agentTargets(config()).find((f) => f.path === `.claude/agents/accord-${role}.md`)?.text ?? '';
      expect(text.length, `accord-${role}.md is missing from the render output`).toBeGreaterThan(0);
      expect(phrases.filter((p) => !text.includes(p))).toEqual([]);
    });
  }
});

it('ac-5 the planner and the executor say a test name holds no at sign and no comma', () => {
  for (const role of ['planner', 'executor']) {
    const text = agentTargets(config()).find((f) => f.path === `.claude/agents/accord-${role}.md`)?.text ?? '';
    expect(text.length, `accord-${role}.md is missing from the render output`).toBeGreaterThan(0);
    expect(text, role).toContain('A test name never holds `@` or a comma.');
  }
});

it('ac-5 the verifier states how to cite a file', () => {
  const text = agentTargets(config()).find((f) => f.path === '.claude/agents/accord-verifier.md')?.text ?? '';
  expect(text.length, 'accord-verifier.md is missing from the render output').toBeGreaterThan(0);
  expect(text).toContain('Cite a file by its path from the repository root, with `:n` or `:n-m` after it for a line or a range of lines.');
});

describe('rendered agents', () => {
  it('renders scout with routed defaults and no authoring key', () => {
    const fm = frontmatter(scout(config()));
    expect(fm).toEqual({
      name: 'accord-scout',
      description: expect.stringContaining('Reads the code'),
      tools: 'Read, Grep, Glob',
      model: 'haiku',
      effort: 'low',
    });
    expect(scout(config())).not.toContain('route');
  });

  it('renders the auditor read-only on its spec route', () => {
    const text = agentTargets(config()).find((f) => f.path === '.claude/agents/accord-auditor.md')?.text ?? '';
    expect(frontmatter(text)).toMatchObject({ name: 'accord-auditor', tools: 'Read', model: 'opus', effort: 'medium' });
  });

  // Title kept for the baseline: the architect is gone, so this now asserts the critic only and that no architect file renders.
  it('renders the architect and the critic read-only on their spec routes', () => {
    const text = agentTargets(config()).find((f) => f.path === '.claude/agents/accord-critic.md')?.text ?? '';
    expect(frontmatter(text)).toMatchObject({ name: 'accord-critic', tools: 'Read, Grep, Glob', model: 'opus', effort: 'high' });
    expect(agentTargets(config()).map((f) => f.path)).not.toContain('.claude/agents/accord-architect.md');
  });

  it('renders the final reviewer from the reviewer definition, routed by reviewer.final', () => {
    const final = (c: AccordConfig): string => agentTargets(c).find((f) => f.path === '.claude/agents/accord-final-reviewer.md')?.text ?? '';
    expect(frontmatter(final(config()))).toMatchObject({ name: 'accord-final-reviewer', tools: 'Read, Grep, Glob, Bash', model: 'opus', effort: 'high' });
    const routed = config({ models: { 'reviewer.final': { model: 'sonnet', effort: 'max' }, reviewer: { model: 'haiku' } } });
    expect(frontmatter(final(routed))).toMatchObject({ model: 'sonnet', effort: 'max' });
    const reviewer = agentTargets(routed).find((f) => f.path === '.claude/agents/accord-reviewer.md')?.text ?? '';
    expect(frontmatter(reviewer)).toMatchObject({ name: 'accord-reviewer', model: 'haiku', effort: 'high' });
  });

  it('a models entry with only model keeps the default effort', () => {
    const fm = frontmatter(scout(config({ models: { scout: { model: 'sonnet' } } })));
    expect(fm).toMatchObject({ model: 'sonnet', effort: 'low' });
  });

  it('the marker hash recomputes', () => {
    const text = scout(config());
    expect(markerHash(text)).toBe(contentHash(withoutMarker(text)));
  });

  it('installs for the claude runtime only', () => {
    expect(agentTargets(config({ runtimes: ['codex'] }))).toEqual([]);
  });

  it('stays short', () => {
    const files = agentTargets(config());
    for (const f of files) expect(bodyOf(f.text).split('\n').length, f.path).toBeLessThanOrEqual(60);
  });

  it('every agent renders a model and an effort line', () => {
    for (const key of Object.keys(agents) as AgentKey[]) {
      const lines = renderAgent(key, { model: 'haiku', effort: 'low' }).split('\n');
      expect(lines.some((l) => l.startsWith('model:')), key).toBe(true);
      expect(lines.some((l) => l.startsWith('effort:')), key).toBe(true);
    }
  });

  it('frontmatter keys come in a fixed order', () => {
    const lines = scout(config()).split('\n');
    const keys = lines.slice(1, lines.indexOf('---', 1)).map((l) => l.split(':')[0]);
    expect(keys).toEqual(['name', 'description', 'tools', 'model', 'effort']);
  });

  it('generated module matches agents/ (drift)', () => {
    const onDisk = readdirSync(agentsDir).filter((n) => n.endsWith('.md')).sort();
    expect(Object.keys(agents), 'agent file set drifted: run npm run gen').toEqual(onDisk);
    for (const name of onDisk) {
      const text = readFileSync(new URL(name, new URL('../agents/', import.meta.url)), 'utf8').replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
      expect(agents[name as AgentKey], `${name} drifted: run npm run gen`).toBe(text);
    }
  });
});

it('ac-3 the critic and both reviewers define must should and nice by consequence', () => {
  const sentences = [
    'Must: left as is, the Intent does not hold, a criterion is not reached, or a Veto, Decision or Correction is broken.',
    'Should: left as is, a defect ships or an executor is blocked, which a later stage would catch at a higher cost.',
    'Nice: no defect, only a clearer or smaller way.',
  ];
  for (const role of ['critic', 'reviewer', 'final-reviewer']) {
    const path = `.claude/agents/accord-${role}.md`;
    const text = (agentTargets(config()).find((f) => f.path === path)?.text ?? '').replace(/\s+/g, ' ');
    expect(text, `${path} is empty`).not.toBe('');
    for (const s of sentences) expect(text, `${path} lacks: ${s}`).toContain(s);
  }
});

it('ac-4 the planner runs every plan check of the critic before it replies', () => {
  const text = (path: string): string => agentTargets(config()).find((f) => f.path === path)?.text ?? '';
  const critic = text('.claude/agents/accord-critic.md').split('\n');
  const planner = text('.claude/agents/accord-planner.md').split('\n');
  expect(critic.join(''), 'critic is empty').not.toBe('');
  expect(planner.join(''), 'planner is empty').not.toBe('');
  const from = critic.indexOf('Mode `plan`:');
  expect(from).toBeGreaterThanOrEqual(0);
  const rest = critic.slice(from + 1);
  const run = rest.slice(0, rest.indexOf(''));
  const checks = run.filter((l) => l.startsWith('- Check'));
  expect(checks).toHaveLength(7);
  expect(checks).toEqual(run);
  const intro = planner.indexOf("Before you reply, run these checks of the critic's plan mode on your plan and fix what fails:");
  expect(intro).toBeGreaterThanOrEqual(0);
  for (const c of checks) expect(planner.indexOf(c), `planner lacks: ${c}`).toBeGreaterThan(intro);
});

it('ac-5 an api a finding relies on carries a citation the planner confirms', () => {
  const cfg = config();
  const agent = (path: string): string => agentTargets(cfg).find((f) => f.path === path)?.text ?? '';
  const flat = (s: string): string => s.replace(/\s+/g, ' ');
  const criticRaw = agent('.claude/agents/accord-critic.md');
  const plannerRaw = agent('.claude/agents/accord-planner.md');
  const loopPath = '.claude/skills/accord-plan/critique.md';
  const loopRaw = skillTargets(cfg).find((f) => f.path === loopPath)?.text ?? '';
  expect(criticRaw, 'critic is empty').not.toBe('');
  expect(plannerRaw, 'planner is empty').not.toBe('');
  expect(loopRaw, `${loopPath} is empty`).not.toBe('');
  const critic = flat(criticRaw);
  const planner = flat(plannerRaw);
  const loop = flat(loopRaw);
  expect(critic).toContain(
    'A finding, or a fix you propose, that relies on a host or library API cites where that API is defined: a file and line in the working tree, `node_modules` included, as `path:line`, or the URL of the document outside it.',
  );
  for (const s of [
    'A fix the critic proposes that relies on a host or library API is applied only when reading the cited place confirms that API.',
    'A fix with no citation, a citation you cannot read, or a citation that does not confirm the API is reported as `unverified: <reason>`, not applied.',
    "A fix whose API is cited only by a URL is applied only when you are given the owner's words saying to apply it.",
  ]) expect(planner, `planner lacks: ${s}`).toContain(s);
  expect(planner).toContain('its `<round>.<n>` label, which you reply with');
  expect(loop).toContain('goes to the owner at once');
  expect(loop).toContain('On apply its state becomes `open, owner: "<the owner\'s words>"`');
  expect(plannerRaw).toMatch(/^tools: "Read, Grep, Glob, Write, Edit"$/m);
  expect(criticRaw).toMatch(/^tools: "Read, Grep, Glob"$/m);
});

it('risk:regression-of-a-real-bug a false-positive open finding can be withdrawn by the critic', () => {
  const flat = (s: string): string => s.replace(/\s+/g, ' ');
  const agent = (path: string): string => flat(agentTargets(config()).find((f) => f.path === path)?.text ?? '');
  const critic = agent('.claude/agents/accord-critic.md');
  const planner = agent('.claude/agents/accord-planner.md');
  expect(critic).toContain('A finding it holds as `open` or `unverified` that no longer holds, whether or not the plan changed, goes on one line');
  expect(planner).toContain('A finding you cannot fix without failing one of the checks below is reported as `unverified: <reason>` naming the check, not applied.');
});

it('ac-1 the executor is told how verify ids match what it must not touch and to read the conventions', () => {
  const flat = (s: string): string => s.replace(/\s+/g, ' ');
  const agent = (path: string): string => flat(agentTargets(config()).find((f) => f.path === path)?.text ?? '');
  const executor = agent('.claude/agents/accord-executor.md');
  const planner = agent('.claude/agents/accord-planner.md');
  const rules = flat(rulesetText('npx --yes @x/accord@1.2.3'));
  expect(executor).not.toBe('');
  expect(planner).not.toBe('');
  for (const s of [
    'A `verify:` id must equal, character for character, the id accord builds from the JUnit report',
    "the testcase's classname, then `#`, then its name",
    'every enclosing describe title',
    'are each trimmed',
    'each run of whitespace in them becomes `-`.',
    'missing or is the empty string before trimming',
    'read the JUnit report and find each verify id',
    'never run `accord task-done`, and you never create, change, delete or rename',
    "the repository's top-level `accord/` folder",
    'An `accord/` folder inside a test fixture or an example is not it',
    'Read `accord/product/` before you start',
    'follow `accord/product/conventions.md` in every commit',
  ]) expect(executor, `executor lacks: ${s}`).toContain(s);
  expect(planner).toContain('Read `accord/product/` before you plan');
  expect(planner).toContain("You never put a file under the repository's top-level `accord/` folder on a task's `files:` line");
  expect(planner).toContain('the main session writes those files');
  expect(planner).toContain('An `accord/` folder inside a test fixture or an example is not it');
  expect(rules).toContain('Every commit, by the main session or any agent, follows `accord/product/conventions.md` when that file exists.');
});

it('ac-4 the executor runs only the test command its brief prints and never tests.full on its own', () => {
  const flat = (s: string): string => s.replace(/\s+/g, ' ');
  const rendered = agentTargets(config({ runtimes: ['claude', 'codex', 'cursor', 'copilot'] })).filter((f) => f.path.endsWith('/accord-executor.md'));
  expect(rendered.length).toBeGreaterThan(0);
  const committed = readFileSync(new URL('../../../.claude/agents/accord-executor.md', import.meta.url), 'utf8');
  const texts: [string, string][] = [
    ['core', agents['executor.md']],
    ...rendered.map((f): [string, string] => [f.path, f.text]),
    ['committed', committed],
  ];
  for (const [name, text] of texts) expect(text, `${name} is empty`).not.toBe('');
  for (const [name, text] of texts) {
    for (const phrase of [
      'Run only the test command your brief prints for your task',
      'never run `tests.full` on your own',
      "`tests.full` belongs to the plan's baseline run and to verify",
      "you run it only when your brief prints it as your task's command",
      'When your brief prints no test command',
      'run only the test files you wrote or changed, never `tests.full`',
    ]) expect(flat(text), `${name} lacks: ${phrase}`).toContain(phrase);
  }
});

it('ac-3 the scout architect critic and planner read the research records and no other agent is told to', () => {
  const S =
    "Read every record the ticket's frontmatter `research:` key lists, when it has one: a record is evidence, not a contract, and holds at the commit it names, so check a claim against the code before you rely on it.";
  const files = agentTargets(config({ runtimes: ['claude', 'codex', 'cursor', 'copilot'] }));
  const names = ['auditor', 'critic', 'debugger', 'executor', 'final-reviewer', 'planner', 'reviewer', 'scout', 'verifier'];
  expect(files.map((f) => f.path).sort()).toEqual(names.map((n) => `.claude/agents/accord-${n}.md`));
  const readers = ['scout', 'critic', 'planner'];
  for (const f of files) {
    const role = f.path.replace('.claude/agents/accord-', '').replace('.md', '');
    if (readers.includes(role)) expect(f.text.replace(/\s+/g, ' '), f.path).toContain(S);
    else expect(f.text, f.path).not.toMatch(/research/i);
  }
});

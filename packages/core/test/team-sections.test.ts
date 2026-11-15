// ST-LN-50 t2-ac-7, D-10: `template.sections` adds a team's own sections to the story and bug ticket templates. A team section never replaces a section accord
// requires or ships, never gives acceptance criteria another form than the Gherkin block, and sits outside every hash, so a change to the config changes no
// approval in flight. Pure text in, text out.
import { describe, expect, it } from 'vitest';
import { approvedHash, insertTeamSections, loadConfig, loadSnapshot, lintSnapshot, reservedSections, teamSectionProblems, templates } from '../src/index.js';
import { scan } from '../src/load/sections.js';
import { acHash } from '../src/gate/hash.js';
import { CONFIG, laneTicket } from '../../../test/helpers/lane.js';

const HINT = '<!-- A team section from accord/config.yml template.sections; accord does not check its content. -->';
const SECTIONS = [{ name: 'Problem', after: 'Intent' }, { name: 'Out of scope', after: 'Vetoes' }, { name: 'Already on main' }];
const headings = (text: string): string[] => scan(text, 0).sections.map((s) => s.heading);
const STORY_TEMPLATES = ['ticket-build.md', 'ticket-maintain.md', 'ticket-lane.md', 'ticket-lane-s.md', 'ticket-lane-r.md'] as const;

/** The headings each shipped story and bug template gets from SECTIONS: after the anchor, else before Open questions, else before Verification notes, else at the end. */
const EXPECTED: Record<(typeof STORY_TEMPLATES)[number], string[]> = {
  'ticket-build.md': ['Intent', 'Problem', 'Requirements', 'Acceptance criteria', 'Out of scope', 'Already on main', 'Open questions', 'Plan', 'Verification notes'],
  'ticket-maintain.md': ['Intent', 'Problem', 'Requirements', 'Acceptance criteria', 'Out of scope', 'Already on main', 'Open questions', 'Plan', 'Verification notes'],
  'ticket-lane.md': ['Intent', 'Problem', 'Acceptance criteria', 'Vetoes', 'Out of scope', 'Decisions', 'Corrections', 'Already on main', 'Open questions', 'Approach'],
  'ticket-lane-s.md': ['Understood', 'Done when', 'Scope', 'Problem', 'Out of scope', 'Already on main'],
  'ticket-lane-r.md': ['Question', 'Timebox', 'Token budget', 'Decisions', 'Vetoes', 'Out of scope', 'Corrections', 'Problem', 'Already on main'],
};

describe('insertTeamSections (ST-LN-50 t2-ac-7)', () => {
  it('risk:complex-branching team sections are inserted in every story and bug template (ST-LN-50 t2-ac-7)', () => {
    for (const name of STORY_TEMPLATES) {
      const text = templates[name];
      const out = insertTeamSections(text, SECTIONS);
      expect(headings(out), name).toEqual(EXPECTED[name]);
      // each team section holds exactly one HTML comment hint line, then a blank line
      const lines = out.split('\n');
      for (const team of SECTIONS) {
        const at = lines.indexOf('## ' + team.name);
        expect(lines[at + 1], name + ' ' + team.name).toBe(HINT);
        expect(lines[at + 2], name + ' ' + team.name).toBe('');
      }
      // the sections the template had are untouched: taking the team's blocks out gives the template back byte for byte
      let rest = out;
      for (const team of SECTIONS) rest = rest.replace('## ' + team.name + '\n' + HINT + '\n\n', '').replace('## ' + team.name + '\n' + HINT + '\n', '');
      expect(rest.replace(/\n+$/, '\n'), name).toBe(text.replace(/\n+$/, '\n'));
      // Verification notes stays last wherever the template has it
      if (text.includes('\n## Verification notes\n')) expect(headings(out).at(-1), name).toBe('Verification notes');
      // the file still ends with one newline
      expect(out.endsWith('\n') && !out.endsWith('\n\n'), name).toBe(true);
    }
  });

  it('risk:complex-branching an empty or absent list returns the text unchanged, and a team section can be placed after another or kept before Verification notes (ST-LN-50 t2-ac-7)', () => {
    const text = templates['ticket-build.md'];
    expect(insertTeamSections(text, [])).toBe(text);
    expect(insertTeamSections(text, undefined)).toBe(text);
    // two entries on one anchor keep the order the config gives them
    expect(headings(insertTeamSections(text, [{ name: 'Alpha', after: 'Intent' }, { name: 'Beta', after: 'Intent' }])).slice(0, 4)).toEqual(['Intent', 'Alpha', 'Beta', 'Requirements']);
    // an entry may name an earlier team section
    expect(headings(insertTeamSections(text, [{ name: 'Alpha', after: 'Intent' }, { name: 'Beta', after: 'alpha' }])).slice(0, 4)).toEqual(['Intent', 'Alpha', 'Beta', 'Requirements']);
    // after: Verification notes would end the file with something else: the section goes before it instead
    const last = headings(insertTeamSections(text, [{ name: 'Alpha', after: 'Verification notes' }]));
    expect(last.slice(-2)).toEqual(['Alpha', 'Verification notes']);
    // a heading is matched the way accord matches one, by key, and a fenced "## " line is not a heading
    const fenced = text.replace('```gherkin', '```gherkin\n## Intent');
    expect(headings(insertTeamSections(fenced, [{ name: 'Problem', after: 'INTENT' }]))).toContain('Problem');
    expect(headings(insertTeamSections(text, [{ name: 'Problem', after: 'intent' }]))[1]).toBe('Problem');
  });

  it('risk:complex-branching team sections are outside the approval and acceptance-criteria hashes (ST-LN-50 t2-ac-7)', () => {
    const plain = laneTicket('T-1');
    const withTeam = insertTeamSections(plain, [...SECTIONS, { name: 'Notes for QA', after: 'Approach' }]);
    expect(withTeam).not.toBe(plain);
    const a = loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': plain }, tree: [] }).tickets['T-1'];
    const b = loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': withTeam }, tree: [] }).tickets['T-1'];
    expect(b.sections.map((s) => s.heading)).toContain('Problem');
    expect(approvedHash(b)).toBe(approvedHash(a));
    expect(acHash(b.scenarios)).toBe(acHash(a.scenarios));
    // and lint raises nothing for a ticket that holds them
    const lint = lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': CONFIG, 'accord/tickets/T-1.md': withTeam }, tree: [] }));
    expect(lint.findings.filter((f) => f.level === 'error')).toEqual([]);
  });
});

describe('required sections and the Gherkin form stay (ST-LN-50 t2-ac-7)', () => {
  it('risk:security a team section can never replace a required one (ST-LN-50 t2-ac-7)', () => {
    const refused = ['Acceptance criteria', 'acceptance criteria', 'ACCEPTANCE CRITERIA', 'Intent', 'Done when', 'Verification notes', 'Acceptance checklist', 'Approach', 'Scope', 'Token budget'];
    for (const name of refused) {
      const found = teamSectionProblems([{ name }]);
      expect(found, name).toHaveLength(1);
      expect(found[0].pointer, name).toBe('/template/sections/0/name');
      expect(found[0].reason, name).toContain(name);
    }
    expect(teamSectionProblems([{ name: 'Acceptance checklist' }])[0].reason).toContain('Gherkin');
    expect(teamSectionProblems([{ name: 'Intent' }])[0].reason).toContain('cannot replace');
    for (const name of ['Problem', 'Out of scope', 'Already on main']) expect(teamSectionProblems([{ name }]), name).toEqual([]);
    // a duplicate name is named at the second entry
    expect(teamSectionProblems([{ name: 'Problem' }, { name: 'problem' }])).toMatchObject([{ pointer: '/template/sections/1/name' }]);
    expect(teamSectionProblems(undefined)).toEqual([]);

    // the reserved set holds every heading of every shipped ticket and epic template
    const reserved = reservedSections();
    for (const name of [...STORY_TEMPLATES, 'epic.md', 'epic-lane.md'] as const) for (const h of headings(templates[name])) expect(reserved.has(h.toLowerCase()), h).toBe(true);

    // a refused entry is never inserted
    const text = templates['ticket-build.md'];
    expect(insertTeamSections(text, [{ name: 'Acceptance criteria' }, { name: 'Intent', after: 'Intent' }])).toBe(text);
    expect(headings(insertTeamSections(text, [{ name: 'Acceptance criteria' }, { name: 'Problem' }])).filter((h) => h.toLowerCase().includes('acceptance'))).toEqual(['Acceptance criteria']);

    // the schema takes no key but name and after, so no form can be given
    const cfg = (entry: string): number => loadConfig('accord/config.yml', CONFIG + 'template:\n  sections:\n    - ' + entry + '\n').findings.length;
    expect(cfg('name: Problem')).toBe(0);
    expect(cfg('{ name: Problem, after: Intent }')).toBe(0);
    expect(cfg('{ name: Acceptance criteria, form: checkbox }')).toBeGreaterThan(0);
    expect(cfg('{ name: Problem, required: true }')).toBeGreaterThan(0);
    expect(cfg('{ name: "## Problem" }')).toBeGreaterThan(0);
    expect(cfg('{ name: problem }')).toBeGreaterThan(0);
    expect(cfg('{ after: Intent }')).toBeGreaterThan(0);
  });

  it('risk:security lint.template-section is an error at accord/config.yml for a reserved or acceptance-named section (ST-LN-50 t2-ac-7)', () => {
    const lintOf = (sections: string) =>
      lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': CONFIG + 'template:\n  sections:\n' + sections }, tree: [] })).findings.filter((f) => f.rule === 'lint.template-section');
    expect(lintOf('    - name: Problem\n')).toEqual([]);
    const found = lintOf('    - name: Acceptance criteria\n    - name: Problem\n    - name: Vetoes\n');
    expect(found.map((f) => [f.file, f.level, f.pointer])).toEqual([
      ['accord/config.yml', 'error', '/template/sections/0/name'],
      ['accord/config.yml', 'error', '/template/sections/2/name'],
    ]);
    expect(found[0].reason).toContain('Acceptance criteria');
    // lint.config-floor does not name them a second time
    const both = lintSnapshot(loadSnapshot({ files: { 'accord/config.yml': CONFIG + 'template:\n  sections:\n    - name: Vetoes\n' }, tree: [] })).findings;
    expect(both.filter((f) => f.rule === 'lint.config-floor')).toEqual([]);
  });
});

// D-28 input contract, D-29 key normalisation, D-30 tree, D-31 config, D-34 id verbatim, D-37 classification, D-65 raw files.
import type { LoadFinding } from '../model/finding.js';
import type {
  RepoSnapshot,
  ScenarioRef,
  SnapshotInput,
  Ticket,
  TicketFrontmatter,
  Verification,
} from '../model/snapshot.js';
import { loadConfig } from './config.js';
import { loadFrontmatter, normaliseText } from './frontmatter.js';
import { extractScenarios } from './gherkin.js';
import { scanJUnit } from './junit.js';
import { d07Key, duplicateHeadings, headingKey, requirementLines, scan } from './sections.js';
import { parseVerification } from './verification.js';

const CONFIG = 'accord/config.yml';
// A3: a configured report with none of these is garbage, reported once rather than once per scenario.
const REPORT_TAG = /<testsuites?\b|<testcase\b/;
const TICKET = /^accord\/tickets\/([^/]+)\.md$/;
const VERIFICATION = /^accord\/tickets\/([^/]+)\/verification\.md$/;
export const PROTOTYPE = /^accord\/assets\/([^/]+)\/prototype\.html$/;

/** D-29: backslashes become slashes and a leading ./ is dropped; the separator is never an error. */
export const normaliseKey = (k: string): string => k.replace(/\\/g, '/').replace(/^\.\//, '');

function parseTicket(id: string, file: string, text: string): { ticket: Ticket; findings: LoadFinding[] } {
  const fm = loadFrontmatter<TicketFrontmatter>(file, text, 'ticket');
  const findings = [...fm.findings];
  // D-21: ui defaults to false in the loader; D-34: id is kept verbatim.
  const frontmatter = fm.value === undefined ? undefined : { ...fm.value, ui: fm.value.ui ?? false };

  const { sections, fences } = scan(fm.body, fm.bodyOffset);
  findings.push(...duplicateHeadings(file, sections, d07Key));

  const requirementsSection = sections.find((s) => headingKey(s.heading) === 'requirements');
  const requirements = requirementsSection ? requirementLines(requirementsSection, fences) : [];

  // D-36: only gherkin fences between the first `## Acceptance criteria` heading and the next heading.
  const scenarios: ScenarioRef[] = [];
  const acIndex = sections.findIndex((s) => headingKey(s.heading) === 'acceptance criteria');
  if (acIndex >= 0) {
    const from = sections[acIndex].line;
    const to = sections[acIndex + 1]?.line ?? Number.POSITIVE_INFINITY;
    for (const fence of fences) {
      if (fence.open < from || fence.open > to) continue;
      if (fence.info.split(/\s+/)[0] !== 'gherkin') continue;
      const r = extractScenarios(file, id, fence);
      scenarios.push(...r.scenarios);
      findings.push(...r.findings);
    }
  }

  const ticket: Ticket = {
    id,
    file,
    ...(frontmatter === undefined ? {} : { frontmatter }),
    sections,
    requirements,
    scenarios,
  };
  return { ticket, findings };
}

export function loadSnapshot(input: SnapshotInput): RepoSnapshot {
  const files: Record<string, string> = {};
  for (const key of Object.keys(input.files).sort()) files[normaliseKey(key)] = input.files[key];
  const tree = [...new Set(input.tree.map(normaliseKey))].sort();
  const errors: LoadFinding[] = [];

  let config: RepoSnapshot['config'];
  if (CONFIG in files) {
    const r = loadConfig(CONFIG, files[CONFIG]);
    config = r.config;
    errors.push(...r.findings);
  } else {
    errors.push({ file: CONFIG, rule: 'load.config-missing', reason: 'accord/config.yml not found in snapshot' });
  }

  // D-65: keep only the files rules read raw, normalised (D-38) so every encoding variant yields one golden.
  const snapshotFiles: Record<string, string> = {};
  for (const file of Object.keys(files).sort()) if (PROTOTYPE.test(file)) snapshotFiles[file] = normaliseText(files[file]);
  const tokens = config === undefined ? '' : normaliseKey(config.design.tokens);
  if (tokens !== '' && tokens in files) snapshotFiles[tokens] = normaliseText(files[tokens]);

  // D-72: tests is absent without a report, {} for a garbage one, so lint can tell the two apart.
  let tests: RepoSnapshot['tests'];
  const report = config?.tests === undefined ? '' : normaliseKey(config.tests.report);
  if (report !== '' && report in files) {
    snapshotFiles[report] = normaliseText(files[report]);
    tests = scanJUnit(snapshotFiles[report]);
    if (!REPORT_TAG.test(snapshotFiles[report])) {
      errors.push({
        file: report,
        line: 1,
        rule: 'load.report-invalid',
        reason: 'report has no <testsuite> or <testcase> element',
      });
    }
  }

  const tickets: Record<string, Ticket> = {};
  const verifications: Record<string, Verification> = {};
  for (const file of Object.keys(files).sort()) {
    const t = TICKET.exec(file);
    if (t) {
      const r = parseTicket(t[1], file, files[file]);
      tickets[t[1]] = r.ticket;
      errors.push(...r.findings);
      continue;
    }
    const v = VERIFICATION.exec(file);
    if (v) {
      const r = parseVerification(v[1], file, files[file]);
      verifications[v[1]] = r.verification;
      errors.push(...r.findings);
    }
    // D-37: anything else is ignored.
  }

  for (const id of Object.keys(verifications)) {
    if (id in tickets) continue;
    errors.push({
      file: verifications[id].file,
      rule: 'load.verification-orphan',
      reason: `verification record without a ticket: accord/tickets/${id}.md is missing`,
    });
  }

  return {
    ...(config === undefined ? {} : { config }),
    tickets,
    verifications,
    tree,
    errors,
    files: snapshotFiles,
    ...(tests === undefined ? {} : { tests }),
    // D-78: host facts pass straight through, spread so an absent `git` stays absent in the D-54 golden.
    ...(input.git === undefined ? {} : { git: input.git }),
  };
}

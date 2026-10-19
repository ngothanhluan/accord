// D-35 parse errors as findings, D-36 fence input, D-46 to D-50 ScenarioRef extraction.
import { AstBuilder, Errors, GherkinClassicTokenMatcher, Parser, dialects } from '@cucumber/gherkin';
import type { LoadFinding } from '../model/finding.js';
import type { ScenarioRef } from '../model/snapshot.js';
import type { Fence } from './sections.js';

// The AST types are inferred from the parser so nothing from the messages package is named here.
type GherkinDoc = ReturnType<Parser<unknown>['parse']>;
type Feature = NonNullable<GherkinDoc['feature']>;
type Child = Feature['children'][number];
type Scenario = NonNullable<Child['scenario']>;
type Step = Scenario['steps'][number];
type Row = { readonly cells: readonly { readonly value: string }[] };

const LANGUAGE = /^#\s*language:\s*([A-Za-z-]+)/;
export const AC_TAG = /^@ac-[1-9][0-9]*$/;

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const row = (r: Row) => '| ' + r.cells.map((c) => c.value).join(' | ') + ' |';
const collapse = (s: string) => s.replace(/\s+/g, ' ').trim();

/** D-48: keyword, text, doc string, and data table rows as one whitespace-collapsed string. */
function stepText(step: Step): string {
  const parts = [step.keyword.trim(), step.text];
  if (step.docString) parts.push('"""' + step.docString.content + '"""');
  if (step.dataTable) parts.push(...step.dataTable.rows.map(row));
  return collapse(parts.join(' '));
}

function scenarioRef(sc: Scenario, background: string[], lang: string, toMarkdown: (p: number) => number): ScenarioRef {
  const tags = sc.tags.map((t) => t.name);
  const acTag = tags.find((t) => AC_TAG.test(t))?.slice(1);
  const steps = [...background, ...sc.steps.map(stepText)];
  for (const ex of sc.examples) {
    const rows: Row[] = [ex.tableHeader, ...ex.tableBody].filter((r) => r !== undefined);
    steps.push(collapse(['Examples:', ...rows.map(row)].join(' ')));
  }
  return {
    name: sc.name,
    keyword: dialects[lang].scenarioOutline.includes(sc.keyword) ? 'Scenario Outline' : 'Scenario',
    line: toMarkdown(sc.location.line),
    tags,
    ...(acTag === undefined ? {} : { acTag }),
    steps,
  };
}

/** D-47, D-49: a Background feeds every later scenario in its container; a Rule nests the same way. */
function walk(children: readonly Child[], inherited: string[], lang: string, toMarkdown: (p: number) => number): ScenarioRef[] {
  const out: ScenarioRef[] = [];
  let background = inherited;
  for (const child of children) {
    if (child.background) background = [...background, ...child.background.steps.map(stepText)];
    else if (child.scenario) out.push(scenarioRef(child.scenario, background, lang, toMarkdown));
    else if (child.rule) out.push(...walk(child.rule.children, background, lang, toMarkdown));
  }
  return out;
}

type Parsed = { toMarkdown: (p: number) => number } & ({ doc: GherkinDoc } | { error: unknown });

/** The dialect lookup, the prepended `Feature:` line, and the parse; never throws. */
function parseFence(ticketId: string, fence: Fence): Parsed {
  const lines = fence.content.map((l) => l.text);
  const firstText = lines.find((l) => l.trim() !== '') ?? '';
  const lang = LANGUAGE.exec(firstText)?.[1] ?? 'en';
  const dialect = dialects[lang];
  let prepended = 0;
  if (dialect !== undefined) {
    // D-50 unknown dialect: leave the text alone so the parser reports it at (1:1).
    const featureLine = new RegExp('^\\s*(' + dialect.feature.map(escape).join('|') + '):');
    const next = lines.find((l) => l.trim() !== '' && !/^\s*[#@]/.test(l));
    if (next === undefined || !featureLine.test(next)) {
      const at = LANGUAGE.test(firstText) ? lines.indexOf(firstText) + 1 : 0;
      lines.splice(at, 0, `${dialect.feature[0]}: ${ticketId}`);
      prepended = 1;
    }
  }
  const toMarkdown = (p: number) => fence.open + p - prepended;
  let n = 0;
  const parser = new Parser(new AstBuilder(() => String(++n)), new GherkinClassicTokenMatcher());
  try {
    return { toMarkdown, doc: parser.parse(lines.join('\n')) };
  } catch (error) {
    return { toMarkdown, error };
  }
}

export function extractScenarios(
  file: string,
  ticketId: string,
  fence: Fence,
): { scenarios: ScenarioRef[]; findings: LoadFinding[] } {
  const parsed = parseFence(ticketId, fence);
  if ('doc' in parsed) {
    const feature = parsed.doc.feature;
    if (!feature) return { scenarios: [], findings: [] };
    return { scenarios: walk(feature.children, [], feature.language, parsed.toMarkdown), findings: [] };
  }
  const e = parsed.error;
  const errors = e instanceof Errors.CompositeParserException ? e.errors : [e];
  const findings = errors.map((err) => {
    const g = err as { location?: { line?: number }; message?: string };
    return {
      file,
      line: parsed.toMarkdown(g.location?.line ?? 1),
      rule: 'load.gherkin-parse',
      reason: String(g.message ?? err).replace(/^\(\d+:\d+\):\s*/, ''),
    };
  });
  return { scenarios: [], findings };
}

/** Phase of each step in order; And, But, and `*` take the phase of the step before, a first one counts as Context. */
function phases(steps: readonly Step[], before: string[]): string[] {
  const out = [...before];
  for (const st of steps) {
    const t = st.keywordType as string | undefined;
    out.push(t === 'Context' || t === 'Action' || t === 'Outcome' ? t : (out[out.length - 1] ?? 'Context'));
  }
  return out;
}

function walkLead(children: readonly Child[], inherited: string[], toMarkdown: (p: number) => number, out: Record<number, number>): void {
  let background = inherited;
  for (const child of children) {
    if (child.background) background = phases(child.background.steps, background);
    else if (child.scenario) {
      const all = phases(child.scenario.steps, background);
      const first = all.indexOf('Outcome');
      out[toMarkdown(child.scenario.location.line)] = first < 0 ? all.length : first;
    } else if (child.rule) walkLead(child.rule.children, background, toMarkdown, out);
  }
}

/** For each scenario (keyed by its Markdown line), how many leading entries of its `steps` come before its first Then. */
export function leadSteps(ticketId: string, fence: Fence): Record<number, number> {
  const parsed = parseFence(ticketId, fence);
  const out: Record<number, number> = {};
  if ('doc' in parsed && parsed.doc.feature) walkLead(parsed.doc.feature.children, [], parsed.toMarkdown, out);
  return out;
}

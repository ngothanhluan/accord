// D-35 parse errors as findings, D-36 fence input, D-46 to D-50 ScenarioRef extraction.
import { AstBuilder, Errors, GherkinClassicTokenMatcher, Parser, dialects } from '@cucumber/gherkin';
import type { Finding } from '../model/finding.js';
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
const AC_TAG = /^@ac-[1-9][0-9]*$/;

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

export function extractScenarios(
  file: string,
  ticketId: string,
  fence: Fence,
): { scenarios: ScenarioRef[]; findings: Finding[] } {
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
    const doc = parser.parse(lines.join('\n'));
    const feature = doc.feature;
    if (!feature) return { scenarios: [], findings: [] };
    return { scenarios: walk(feature.children, [], feature.language, toMarkdown), findings: [] };
  } catch (e) {
    const errors = e instanceof Errors.CompositeParserException ? e.errors : [e];
    const findings = errors.map((err) => {
      const g = err as { location?: { line?: number }; message?: string };
      return {
        file,
        line: toMarkdown(g.location?.line ?? 1),
        rule: 'load.gherkin-parse',
        reason: String(g.message ?? err).replace(/^\(\d+:\d+\):\s*/, ''),
      };
    });
    return { scenarios: [], findings };
  }
}

// ST-LN-25: the pin writers `accord upgrade` uses. Pure text in, text out; a text they cannot rewrite safely gives undefined.
import { LineCounter, isMap, parseDocument } from 'yaml';
import { stringNumerics } from '../load/yaml.js';
import { workflowYml } from './workflow.js';

const ACCORD_LINE = /^accord:[ \t]*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s#'"]+)([ \t]+#[^\r\n]*)?[ \t]*(\r?)$/gm;

/** `config.yml` with its one top-level `accord:` line set to `version`; undefined unless exactly one line matches. */
export function repinConfig(text: string, version: string): string | undefined {
  if ([...text.matchAll(ACCORD_LINE)].length !== 1) return undefined;
  return text.replace(ACCORD_LINE, (_m, comment: string | undefined, cr: string) => `accord: "${version}"${comment ?? ''}${cr}`);
}

/** The workflow with each `<name>@<from>` that is not a longer version set to `<name>@<to>`. */
export function repinWorkflow(text: string, name: string, from: string, to: string): string {
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(esc(name + '@' + from) + '(?![0-9A-Za-z.+-])', 'g'), () => name + '@' + to);
}

// BUG-LN-8: `accord upgrade` swaps the step named `lint and gate` for the one the running release's init writes.
export type StepRefresh = { text: string } | { refused: 'count' | 'shape' };

const STEP = 'lint and gate';
type Doc = { jobs: Record<string, { steps: unknown[] }> };
type Located = { js: Doc; job: string; index: number; start: number; end: number; indent: number };

/** Where the one step named `lint and gate` sits, as whole lines (1-based): its `- ` line to the last line of its last value. */
function locate(src: string): Located | 'count' | undefined {
  const lc = new LineCounter();
  const doc = parseDocument(src, { schema: 'core', customTags: stringNumerics, lineCounter: lc });
  if (doc.errors.length > 0) return undefined;
  const js = doc.toJS() as Doc;
  const hits: { job: string; index: number }[] = [];
  const jobs = js !== null && typeof js === 'object' ? js.jobs : undefined;
  if (jobs !== null && typeof jobs === 'object') {
    for (const [job, body] of Object.entries(jobs)) {
      const steps = (body as { steps?: unknown } | null)?.steps;
      if (!Array.isArray(steps)) continue;
      steps.forEach((s, index) => {
        if (s !== null && typeof s === 'object' && (s as { name?: unknown }).name === STEP) hits.push({ job, index });
      });
    }
  }
  if (hits.length !== 1) return 'count';
  const { job, index } = hits[0];
  const node = doc.getIn(['jobs', job, 'steps', index], true);
  if (!isMap(node) || node.flow || node.anchor !== undefined || !node.range) return undefined;
  const [from, to] = node.range;
  const lineStart = src.lastIndexOf('\n', from - 1) + 1;
  const dash = /^( *)- +/.exec(src.slice(lineStart, from));
  if (dash === null || dash[0].length !== from - lineStart) return undefined;
  const last = src.slice(from, to).trimEnd().length;
  return { js, job, index, start: lc.linePos(from).line, end: lc.linePos(from + Math.max(last - 1, 0)).line, indent: dash[1].length };
}

/** The workflow with its one step named `lint and gate` replaced by the step `workflowYml(name, version)` writes. */
export function refreshLintStep(text: string, name: string, version: string): StepRefresh {
  try {
    const old = locate(text);
    if (old === 'count') return { refused: 'count' };
    const freshText = workflowYml(name, version);
    const fresh = locate(freshText);
    if (old === undefined || fresh === undefined || fresh === 'count') return { refused: 'shape' };
    const shift = old.indent - fresh.indent;
    const cut = freshText
      .split('\n')
      .slice(fresh.start - 1, fresh.end)
      .map((l) => (l === '' ? l : shift >= 0 ? ' '.repeat(shift) + l : l.slice(-shift)));
    const lines = text.split('\n');
    const crlf = text.includes('\r\n');
    // Every old line but the last of a CRLF file ends in \r; the last span line keeps its own ending.
    const cr = crlf && lines[old.end - 1].endsWith('\r') ? '\r' : '';
    const body = cut.join(crlf ? '\r\n' : '\n') + cr;
    const result = [...lines.slice(0, old.start - 1), body, ...lines.slice(old.end)].join('\n');
    const next = locate(result);
    if (next === undefined || next === 'count') return { refused: 'shape' };
    const swapped = structuredClone(old.js);
    swapped.jobs[old.job].steps[old.index] = fresh.js.jobs[fresh.job].steps[fresh.index];
    return JSON.stringify(next.js) === JSON.stringify(swapped) ? { text: result } : { refused: 'shape' };
  } catch {
    return { refused: 'shape' };
  }
}

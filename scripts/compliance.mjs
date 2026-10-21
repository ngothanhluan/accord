// Process-compliance rules over parsed transcripts and git (ST-LN-14). Pure: no file, no spawn, no import.
// The rules are general; none names a ticket, a task or a commit.
export const RULES = ['tier-up', 'trailer', 'test-first', 'verify-id'];

const TIERS = ['haiku', 'sonnet', 'opus'];
const lower = (p) => String(p).replace(/\\/g, '/').toLowerCase();
const EXEC = 'accord-executor';

export function describeOf(text, slug) {
  if (text === undefined) return undefined;
  const lines = text.split('\n');
  const indent = (l) => l.length - l.trimStart().length;
  const call = /^\s*(?:it|test)(?:\.[A-Za-z]+(?:\([^)]*\))?)*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/;
  const at = lines.findIndex((l) => { const m = l.match(call); return m && m[2].trim().replace(/\s+/g, '-') === slug; });
  if (at < 0) return undefined;
  // shortcut: indentation stands in for brace depth; a test file formatted differently needs a parser.
  for (let i = at - 1; i >= 0; i--) {
    const m = lines[i].match(/^\s*describe(?:\.[A-Za-z]+)*\(\s*(['"`])((?:\\.|(?!\1).)*)\1/);
    if (m && indent(lines[i]) < indent(lines[at])) return m[2];
  }
  return undefined;
}

export function compliance({ runs, refusals, commits, tickets, settings, commitInfo, testFile }) {
  const out = Object.fromEntries(RULES.map((r) => [r, []]));
  const kept = runs.filter((r) => r.agent?.startsWith('accord-') && !r.desc.startsWith('bench r'));
  const label = (r) => `${r.ticket || '?'} task ${r.task ?? '?'}`;
  const execs = kept.filter((r) => r.agent === EXEC);
  const runCommits = (r) => {
    const found = new Map();
    for (const short of r.commits) {
      const c = commitInfo(short);
      if (c && r.start !== null && c.at >= r.start - 60000 && c.at <= r.end + 60000) found.set(c.sha, c);
    }
    return [...found.values()];
  };

  for (const r of execs) {
    const mine = runCommits(r);
    const seen = new Set();
    for (const [id, t] of Object.entries(tickets)) {
      for (const sec of t.review.split(/^## Round (?=\d)/m).slice(1)) {
        const n = Number(sec.match(/^\d+/)[0]);
        const hit = [...sec.matchAll(/fixed in ([0-9a-f]{7,40})/g)].some((m) => mine.some((c) => c.sha.startsWith(m[1])));
        if (!hit || seen.has(`${id}#${n}`) || n < settings.tierUp) continue;
        seen.add(`${id}#${n}`);
        const base = TIERS.indexOf(settings.executorModel);
        const expected = base < 0 ? settings.executorModel : TIERS[Math.min(base + 1, TIERS.length - 1)];
        const asked = r.dispatch?.model || r.metaModel || settings.executorModel; // parseRun gives '' for an absent model
        if (asked !== expected) out['tier-up'].push(`- tier-up: ${id} review round ${n}: the fix executor asked for ${asked} where escalation.fix_round_tier_up asks for ${expected} — ${r.file}`);
      }
    }
  }

  const bySha = new Map();
  for (const r of execs) for (const c of runCommits(r)) if (!bySha.has(c.sha)) bySha.set(c.sha, { c, r });
  for (const c of commits) {
    if (bySha.has(c.sha)) continue;
    const subject = c.message.split('\n')[0];
    const lab = `${subject.match(/\b([A-Z]+(?:-[A-Z]+)?-\d+)\b/)?.[1] ?? '?'} task ${subject.match(/task (\d+)/)?.[1] ?? '?'}`;
    bySha.set(c.sha, { c, r: null, lab });
  }
  for (const { c, r, lab } of bySha.values()) {
    for (const line of c.message.split('\n').slice(1)) {
      if (!/^\s*co-authored-by:/i.test(line) && !/generated with/i.test(line)) continue;
      const s = c.sha.slice(0, 7);
      out.trailer.push(`- trailer: ${r ? label(r) : lab}: commit ${s} carries "${line.trim()}" — commit ${s}${r ? `, shown in ${r.file}` : ''}`);
    }
  }

  for (const r of execs) {
    if (!r.task || r.fix || !r.dispatch?.cwd) continue;
    const cwd = lower(r.dispatch.cwd);
    // A checkout is the dispatch cwd or a sibling folder named <cwd>-<suffix>.
    const rel = (p) => {
      const l = lower(p);
      const end = l.startsWith(`${cwd}/`) ? cwd.length : l.startsWith(`${cwd}-`) ? l.indexOf('/', cwd.length) : -1;
      if (end < 0 || l.slice(cwd.length, end).includes('/')) return null;
      return String(p).replace(/\\/g, '/').slice(end + 1);
    };
    const own = r.edits.map((e) => rel(e.path)).filter((p) => p);
    const isTest = (p) => /(^|\/)(test|tests|__tests__)\//.test(p) || /\.(test|spec)\.[cm]?[jt]sx?$/.test(p);
    const firstSrc = own.find((p) => !isTest(p) && /\.(ts|mts|cts|tsx|js|mjs|cjs|jsx)$/.test(p));
    const firstTest = own.findIndex(isTest);
    // shortcut: edits made through Bash are not seen.
    if (firstSrc && (firstTest < 0 || own.indexOf(firstSrc) < firstTest)) out['test-first'].push(`- test-first: ${label(r)}: its first edit to a source file (${firstSrc}) came before its first edit to a test file — ${r.file}`);
  }

  for (const f of refusals) {
    for (const reason of f.reasons) {
      const m = reason.match(/^(\S+?)#(\S+) is not in (\S+)$/);
      if (!m) continue;
      const d = describeOf(testFile(m[1], f.ts), m[2]);
      out['verify-id'].push(`- verify-id: ${f.ticket} task ${f.task}: accord task-done refused: ${m[1]}#${m[2]} is not in ${m[3]}${d ? `; the test sits inside describe('${d}')` : ''} — ${f.file}`);
    }
  }
  return out;
}

export function render(result) {
  const out = ['## Compliance', '', '| rule | count |', '| --- | ---: |'];
  for (const r of RULES) out.push(`| ${r} | ${result[r].length} |`);
  for (const r of RULES) out.push('', `### ${r}`, '', ...(result[r].length ? result[r] : ['None.']));
  return out.join('\n') + '\n';
}

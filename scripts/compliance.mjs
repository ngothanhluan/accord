// Process-compliance rules over parsed transcripts and git (ST-LN-14). Pure: no file, no spawn, no import.
// The rules are general; none names a ticket, a task or a commit.
export const RULES = ['tier-up', 'trailer', 'test-first', 'verify-id', 'round-cap', 'reassigned', 'brief-quote'];

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

export function compliance({ runs, refusals, commits, tickets, settings, commitInfo, testFile, ticketAt }) {
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
        const task = r.task ?? mine.map((c) => c.message.match(/\btask (\d+)/i)?.[1]).find(Boolean) ?? `none, a fix assignment "${r.desc}"`;
        if (asked !== expected) out['tier-up'].push(`- tier-up: ${id} review round ${n} (task ${task}): the fix executor asked for ${asked} where escalation.fix_round_tier_up asks for ${expected} — ${r.file}`);
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
    if (firstSrc && (firstTest < 0 || own.indexOf(firstSrc) < firstTest)) out['test-first'].push(`- test-first: ${label(r)}: its ${firstTest < 0 ? `first edit to a source file (${firstSrc}), no test edit seen through Edit or Write` : `first edit to a source file (${firstSrc}) came before its first edit to a test file`} — ${r.file}`);
  }

  for (const f of refusals) {
    for (const reason of f.reasons) {
      const m = reason.match(/^(\S+?)#(\S+) is not in (\S+)$/);
      if (!m) continue;
      const d = describeOf(testFile(m[1], f.ts), m[2]);
      out['verify-id'].push(`- verify-id: ${f.ticket} task ${f.task}: accord task-done refused: ${m[1]}#${m[2]} is not in ${m[3]}${d ? `; the test sits inside describe('${d}')` : ''} — ${f.file}`);
    }
  }
  for (const [id, t] of Object.entries(tickets)) {
    const n = Math.max(0, ...[...t.review.matchAll(/^## Round (\d+)/gm)].map((m) => Number(m[1])));
    const allowed = t.ledger.split('\n').some((l) => l.startsWith('- Ruling:') && /(past|beyond|over) the (round )?cap|round cap/i.test(l));
    if (n >= 6 && !allowed) out['round-cap'].push(`- round-cap: ${id} review: reached round ${n} with no Ruling that allows going past the round cap — accord/tickets/${id}/review.md`);
  }

  for (const r of execs) {
    for (const s of r.sends) {
      const before = r.handbacks.filter((h) => h.ts !== null && s.ts !== null && h.ts <= s.ts).sort((a, b) => a.ts - b.ts).at(-1);
      // A send after BLOCKED or NEEDS_CONTEXT, or before any handback, is a clarifying reply.
      if (before && /^\s*DONE/.test(before.text)) out.reassigned.push(`- reassigned: ${label(r)}: got another assignment through SendMessage ("${s.summary ?? String(s.message ?? '').slice(0, 80)}") after it reported DONE, instead of a fresh agent — ${r.file}`);
    }
  }

  if (ticketAt) {
    const memo = new Map();
    const committedAt = (id, ts) => { const key = `${id}@${ts}`; if (!memo.has(key)) memo.set(key, ticketAt(id, ts)); return memo.get(key); };
    for (const r of kept) {
      if (!r.dispatch) continue;
      const prompt = String(r.dispatch.prompt ?? '');
      const flat = lower(prompt);
      // The ticket the run read or the brief named wins over the one in its description or session branch.
      const named = (s) => s.match(/accord\/tickets\/([A-Za-z]+(?:-[A-Za-z]+)?-\d+)\.md/i)?.[1];
      const ticket = (r.reads.map((x) => named(x.path)).find(Boolean) ?? named(prompt) ?? r.ticket)?.toUpperCase();
      if (!ticket) continue;
      const quoted = r.reads.filter((x) => flat.includes(lower(x.path)) && !lower(x.path).endsWith(`accord/tickets/${ticket.toLowerCase()}.md`));
      for (const text of [prompt, ...quoted.map((x) => x.text)]) {
        const p = quoteProblem(text, ticket, committedAt(ticket, r.dispatch.ts));
        if (!p) continue;
        const tail = p.missing ? `no committed accord/tickets/${ticket}.md existed when it was dispatched` : `the brief's copy of the ticket differs from accord/tickets/${ticket}.md as committed when it was dispatched, first at line ${p.line}: "${p.text.slice(0, 120)}"`;
        out['brief-quote'].push(`- brief-quote: ${ticket} task ${r.task ?? '?'}: ${tail} — ${r.file}`);
      }
    }
  }
  return out;
}

export function quoteProblem(text, id, committed) {
  const norm = (x) => x.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n');
  const t = norm(text).split('\n');
  const c = committed === undefined ? undefined : norm(committed).replace(/\n+$/, '').split('\n');
  const idRe = new RegExp(`^id:\\s*"?${id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}"?(\\s|#|$)`);
  const at = t.findIndex((l) => idRe.test(l));
  let start = at < 0 ? -1 : t.slice(0, at).lastIndexOf('---');
  let from = 0;
  if (start < 0) {
    start = t.indexOf('## Intent');
    if (start < 0) return undefined;
    from = c ? Math.max(0, c.indexOf('## Intent')) : 0;
  }
  if (!c) return { missing: true };
  // Compare the quoted block with the committed ticket without HTML comments and blank lines; an excerpt
  // may skip lines or stop early, and text after the committed ticket's last line is the brief's own.
  const body = (ls, from0) => {
    const rows = [];
    let open = false;
    ls.slice(from0).forEach((l, i) => {
      if (open || l.trimStart().startsWith('<!--')) open = !l.includes('-->');
      else if (l.trim()) rows.push({ l, i });
    });
    return rows;
  };
  const tq = body(t, start), cq = body(c, from);
  let p = 0;
  for (const q of tq) {
    if (p >= cq.length) break;
    if (q.l === cq[p].l) { p++; continue; }
    const j = cq.findIndex((x, k) => k >= p && x.l === q.l);
    if (j >= 0) p = j + 1;
    else if (!cq.some((x) => x.l === q.l)) return { line: q.i + 1, text: q.l };
  }
  return undefined;
}

export function parseCompliance(text) {
  const out = Object.fromEntries(RULES.map((r) => [r, []]));
  let rule = null;
  for (const l of text.split('\n')) {
    const h = l.match(/^#{1,6} (.*)$/);
    if (h) rule = RULES.includes(h[1].trim()) ? h[1].trim() : null;
    else if (rule && l.startsWith('- ')) out[rule].push(l);
  }
  return out;
}

export function mergeCompliance(earlier, newer) {
  const key = (rule, l) => (rule === 'trailer' ? l.match(/commit [0-9a-f]{7} carries "[^"]*"/)?.[0] : rule === 'round-cap' ? l.match(/^- round-cap: \S+ review:/)?.[0] : undefined) ?? l;
  const out = {};
  for (const r of RULES) {
    const lines = [...(earlier[r] ?? [])];
    const keys = new Set(lines.map((l) => key(r, l)));
    for (const l of newer[r] ?? []) if (!keys.has(key(r, l))) { keys.add(key(r, l)); lines.push(l); }
    out[r] = lines;
  }
  return out;
}

export function render(result) {
  const out = ['## Compliance', '', '| rule | count |', '| --- | ---: |'];
  for (const r of RULES) out.push(`| ${r} | ${result[r].length} |`);
  for (const r of RULES) out.push('', `### ${r}`, '', ...(result[r].length ? result[r] : ['None.']));
  return out.join('\n') + '\n';
}

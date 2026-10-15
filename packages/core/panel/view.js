// Pure view of the dashboard: turns the CLI result into sections or a message. Never given `$`, never
// ranks, counts or decides anything: the numbers shown are the JSON's own.

const BAD = (c) =>
  c < 0x20 || (c >= 0x7f && c <= 0x9f) || c === 0x61c || c === 0x200e || c === 0x200f || c === 0x2028 || c === 0x2029 ||
  (c >= 0x202a && c <= 0x202e) || (c >= 0x2066 && c <= 0x2069);

// Control and bidi code points become spaces, space runs collapse; scanned by code point, never by regex.
export function clean(text) {
  let out = '';
  for (const ch of String(text)) {
    const c = ch.codePointAt(0);
    const sp = BAD(c) || c === 0x20;
    if (!sp) out += ch;
    else if (!out.endsWith(' ')) out += ' ';
  }
  return out.trim();
}

const plain = (o) => typeof o === 'object' && o !== null && !Array.isArray(o);
const sectionOk = (s) => plain(s) && Array.isArray(s.rows) && s.rows.every(plain);
const NONE = 'accord dashboard --json printed no dashboard';

export function outcome({ exitCode, stdout, stderr }) {
  if (exitCode !== 0) {
    const message = String(stderr ?? '')
      .split('\n')
      .filter((l) => !/^npm /i.test(l))
      .join('\n')
      .trim();
    return { message: message || `accord exited ${exitCode}` };
  }
  let d;
  try {
    d = JSON.parse(stdout);
  } catch {
    return { message: NONE };
  }
  const ok = plain(d) && ['yours', 'team', 'ready', 'epics'].every((k) => sectionOk(d[k])) && (d.upNext === undefined || sectionOk(d.upNext)) && plain(d.summary);
  return ok ? { dashboard: d } : { message: NONE };
}

export const failure = (err) => ({ message: 'accord did not finish: ' + (err?.message ?? String(err)) });

const rowsOf = (s) =>
  s.rows.filter((r) => typeof r.id === 'string').map((r) => ({ ...r, id: clean(r.id), title: typeof r.title === 'string' ? clean(r.title) : '' }));

// Same cells as the CLI text renderer, only those present; every value goes through clean.
const extras = (r) => {
  const stage = typeof r.stage === 'string' ? (r.stage === 'build' ? `build ${r.tasksDone ?? 0}/${r.tasksTotal ?? 0}` : r.stage) : '';
  return [
    clean(stage + (r.idleDays === undefined ? '' : ` idle ${r.idleDays}d`)),
    typeof r.claimedBy === 'string' ? clean(r.claimedBy) : '',
    Array.isArray(r.blockedBy) ? clean(r.blockedBy.join(' ')) : '',
  ];
};
const row = (r) => ({ text: [r.id, r.title, ...extras(r)].filter((x) => x).join('  ') });
const act = (key, label, id) => ({ key: `${key}:${id}`, label, args: `${key} ${id}` });
// same id pattern as cli new-ticket.ts: a file stem with spaces must never reach /accord as text
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const withAction = (key, label) => (r) => (SAFE_ID.test(r.id) ? { ...row(r), action: act(key, label, r.id) } : row(r));

export function view(state, query) {
  const q = query.trim().toLowerCase();
  if (state === undefined) return { message: ['Loading…'] };
  if (state.message !== undefined) return { message: state.message.split('\n').map(clean).filter((l) => l) };
  const d = state.dashboard;
  const keep = (r) => !q || r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
  const sections = [];
  const section = (heading, s, f = row) => {
    const rows = rowsOf(s).filter(keep).map(f);
    if (!q || rows.length > 0) sections.push({ heading, rows, more: s.more });
  };
  section('YOURS', d.yours, withAction('continue', 'Continue'));
  section('TEAM', d.team);
  section('READY', d.ready, withAction('pick-up', 'Pick up'));
  if (d.upNext) section('UP NEXT', d.upNext, withAction('pick-up', 'Pick up'));
  if (d.epics.rows.length > 0) {
    section('EPICS', d.epics, (r) => ({ text: `${row(r).text}  ${r.done}/${r.total} done` }));
  }
  const s = d.summary;
  let summary = `${s.inProgress} in progress, ${s.ready} ready, ${s.blocked} blocked, ${s.backlog} backlog, ${s.done} done`;
  if (s.withoutLane > 0) summary += `, ${s.withoutLane} without lane`;
  if (s.withSchemaErrors > 0) summary += `, ${s.withSchemaErrors} with schema errors, run accord lint`;
  const args = query.trim();
  return { sections, summary, ...(args ? { newRequest: { key: 'new-request', label: 'New request', args } } : {}) };
}

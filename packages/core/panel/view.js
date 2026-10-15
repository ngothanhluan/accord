// Pure view of the dashboard: turns the CLI result into sections or a message. Never given `$`, never
// ranks, counts or decides anything: the numbers shown are the JSON's own.

// Task 5 adds the failure paths; until then a result is assumed to parse.
export function outcome({ stdout }) {
  return { dashboard: JSON.parse(stdout) };
}

const row = (r) => ({ text: r.title ? `${r.id}  ${r.title}` : r.id });
const act = (key, label, id) => ({ key: `${key}:${id}`, label, args: `${key} ${id}` });
const withAction = (key, label) => (r) => ({ ...row(r), action: act(key, label, r.id) });

export function view(state, query) {
  const q = query.trim().toLowerCase();
  if (state === undefined) return { message: ['Loading…'] };
  const d = state.dashboard;
  const keep = (r) => !q || r.id.toLowerCase().includes(q) || (r.title ?? '').toLowerCase().includes(q);
  const sections = [];
  const section = (heading, s, f = row) => {
    const rows = s.rows.filter(keep).map(f);
    if (!q || rows.length > 0) sections.push({ heading, rows, more: s.more });
  };
  section('YOURS', d.yours, withAction('continue', 'Continue'));
  section('TEAM', d.team);
  section('READY', d.ready, withAction('pick-up', 'Pick up'));
  if (d.upNext) section('UP NEXT', d.upNext, withAction('pick-up', 'Pick up'));
  if (d.epics && d.epics.rows.length > 0) {
    section('EPICS', d.epics, (r) => ({ text: `${row(r).text}  ${r.done}/${r.total} done` }));
  }
  const s = d.summary;
  let summary = `${s.inProgress} in progress, ${s.ready} ready, ${s.blocked} blocked, ${s.backlog} backlog, ${s.done} done`;
  if (s.withoutLane > 0) summary += `, ${s.withoutLane} without lane`;
  if (s.withSchemaErrors > 0) summary += `, ${s.withSchemaErrors} with schema errors, run accord lint`;
  const args = query.trim();
  return { sections, summary, ...(args ? { newRequest: { key: 'new-request', label: 'New request', args } } : {}) };
}

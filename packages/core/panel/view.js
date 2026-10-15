// Pure view of the dashboard: turns the CLI result into sections or a message. Never given `$`, never
// ranks, counts or decides anything: the numbers shown are the JSON's own.

// Task 5 adds the failure paths; until then a result is assumed to parse.
export function outcome({ stdout }) {
  return { dashboard: JSON.parse(stdout) };
}

const row = (r) => ({ text: r.title ? `${r.id}  ${r.title}` : r.id });

export function view(state, query) {
  void query;
  if (state === undefined) return { message: ['Loading…'] };
  const d = state.dashboard;
  const section = (heading, s, f = row) => ({ heading, rows: s.rows.map(f), more: s.more });
  const sections = [section('YOURS', d.yours), section('TEAM', d.team), section('READY', d.ready)];
  if (d.upNext) sections.push(section('UP NEXT', d.upNext));
  if (d.epics && d.epics.rows.length > 0) {
    sections.push(section('EPICS', d.epics, (r) => ({ text: `${row(r).text}  ${r.done}/${r.total} done` })));
  }
  const s = d.summary;
  let summary = `${s.inProgress} in progress, ${s.ready} ready, ${s.blocked} blocked, ${s.backlog} backlog, ${s.done} done`;
  if (s.withoutLane > 0) summary += `, ${s.withoutLane} without lane`;
  if (s.withSchemaErrors > 0) summary += `, ${s.withSchemaErrors} with schema errors, run accord lint`;
  return { sections, summary };
}

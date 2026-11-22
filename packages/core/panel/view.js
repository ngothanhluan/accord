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

const failed = ({ exitCode, stderr }) => {
  const message = String(stderr ?? '')
    .split('\n')
    .filter((l) => !/^npm /i.test(l))
    .join('\n')
    .trim();
  return { message: message || `accord exited ${exitCode}` };
};

export function outcome({ exitCode, stdout, stderr }) {
  if (exitCode !== 0) return failed({ exitCode, stderr });
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

const STAGE_COLOR = { intent: 'blue', plan: 'cyan', build: 'yellow', review: 'magenta', verify: 'green', ready: 'green', research: 'cyan' };
const len = (t) => [...t].length;

const laneOf = (r) => (typeof r.lane === 'string' ? clean(r.lane) : '');
// One row's cells, every value through clean; stageColor reads the raw stage, own keys only.
const cells = (r) => {
  const lane = laneOf(r);
  const stage = typeof r.stage === 'string' ? (r.stage === 'build' && r.lane !== 'S' ? `build ${r.tasksDone ?? 0}/${r.tasksTotal ?? 0}` : r.stage) : '';
  const blocked = Array.isArray(r.blockedBy) && r.blockedBy.length > 0 ? 'blocked by ' + clean(r.blockedBy.join(' ')) : '';
  return {
    id: r.id,
    lane,
    stage: clean(stage + (r.idleDays === undefined ? '' : ` idle ${r.idleDays}d`)),
    stageColor: typeof r.stage === 'string' && Object.hasOwn(STAGE_COLOR, r.stage) ? STAGE_COLOR[r.stage] : undefined,
    title: r.title,
    blockedBy: blocked,
    // Phase 8.2 D-07: the CLI adds claimedByShown beside claimedBy when the person asked for initials; a string wins, anything else falls back to the email
    who: typeof r.claimedByShown === 'string' ? clean(r.claimedByShown) : typeof r.claimedBy === 'string' ? clean(r.claimedBy) : '',
  };
};
const epicCells = (r) => ({ id: r.id, lane: laneOf(r), stage: clean(`${r.done}/${r.total} done`), stageColor: undefined, title: r.title, blockedBy: '', who: '' });
// the panel runs /accord with the typed form: command accord, args `<action> <id>` (08.3-09 D-03)
const act = (key, label, action, id) => ({ key: `${key}:${id}`, label, command: 'accord', args: `${action} ${id}` });
// same id pattern as cli new-ticket.ts: a file stem with spaces must never reach a command as an id
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// A lane row opens its detail; the row's own button (if any) moves into the detail view.
const withOpen = (key, label, action) => (r) =>
  SAFE_ID.test(r.id)
    ? { ...cells(r), open: { key: `show:${r.id}`, id: r.id, ...(key ? { action: act(key, label, action, r.id) } : {}) } }
    : cells(r);

export function view(state, query) {
  const q = query.trim().toLowerCase();
  if (state === undefined) return { message: ['Loading…'] };
  if (state.message !== undefined) return { message: state.message.split('\n').map(clean).filter((l) => l) };
  const d = state.dashboard;
  const keep = (r) => !q || r.id.toLowerCase().includes(q) || r.title.toLowerCase().includes(q);
  const sections = [];
  const section = (heading, s, f = cells) => {
    const rows = rowsOf(s).filter(keep).map(f);
    if (!q || rows.length > 0) sections.push({ heading, rows, more: s.more });
  };
  section('YOURS', d.yours, (r) => ({ ...withOpen('continue', 'Continue', 'continue')(r), who: '' }));
  section('TEAM', d.team, withOpen());
  section('READY', d.ready, withOpen('pick-up', 'Pick up', 'pick-up'));
  if (d.upNext) section('UP NEXT', d.upNext, withOpen('pick-up', 'Pick up', 'pick-up'));
  if (d.epics.rows.length > 0) {
    section('EPICS', d.epics, epicCells);
  }
  // longest cell over every row before the search filter, so columns neither differ between sections nor move while typing
  const all = [d.yours, d.team, d.ready, ...(d.upNext ? [d.upNext] : []), d.epics];
  const widths = { id: len('ID'), lane: len('LANE'), stage: len('STAGE') };
  for (const sec of all) {
    for (const r of rowsOf(sec)) {
      const c = sec === d.epics ? epicCells(r) : cells(r);
      widths.id = Math.max(widths.id, len(c.id));
      widths.lane = Math.max(widths.lane, len(c.lane));
      widths.stage = Math.max(widths.stage, len(c.stage));
    }
  }
  const s = d.summary;
  let summary = `${s.inProgress} in progress, ${s.ready} ready, ${s.blocked} blocked, ${s.backlog} backlog, ${s.done} done`;
  if (s.withoutLane > 0) summary += `, ${s.withoutLane} without lane`;
  if (s.withSchemaErrors > 0) summary += `, ${s.withSchemaErrors} with schema errors, run accord lint`;
  const args = query.trim();
  const noMatch = args && sections.length === 0 ? 'No ticket shown here matches. Press New request to send this text to /accord.' : undefined;
  return {
    sections,
    summary,
    widths,
    // Phase 08.7 D-10: a loaded dashboard that names no claimed ticket says so in one line
    ...(currentOf(state) === undefined ? { hint: HINT } : {}),
    ...(noMatch ? { noMatch } : {}),
    ...(args ? { newRequest: { key: 'new-request', label: 'New request', command: 'accord', args } } : {}),
  };
}

// The action a row of the current dashboard offers for id, read at draw time so it follows the latest run.
export function actionFor(state, id) {
  if (!state?.dashboard) return undefined;
  for (const sec of view(state, '').sections ?? []) for (const r of sec.rows) if (r.id === id && r.open?.action) return r.open.action;
  return undefined;
}

const NL = String.fromCharCode(10);
const NO_DETAIL = 'accord show --json printed no ticket';
const strs = (a) => Array.isArray(a) && a.every((x) => typeof x === 'string');
const str = (v) => typeof v === 'string';
const strOrNull = (v) => v === null || str(v);
const critOk = (c) =>
  plain(c) && str(c.title) && str(c.label) && strs(c.steps) && [c.id, c.test, c.testResult, c.verification].every(strOrNull) && typeof c.ticked === 'boolean';
const ticketOk = (d) =>
  plain(d) &&
  [d.id, d.title, d.stage, d.lane, d.branch].every(str) &&
  typeof d.tasksDone === 'number' &&
  typeof d.tasksTotal === 'number' &&
  strOrNull(d.holder) &&
  strs(d.blockedBy) &&
  strs(d.intent) &&
  Array.isArray(d.criteria) &&
  d.criteria.every(critOk);

export function detailOutcome({ exitCode, stdout, stderr }) {
  if (exitCode !== 0) return failed({ exitCode, stderr });
  let d;
  try {
    d = JSON.parse(stdout);
  } catch {
    return { message: NO_DETAIL };
  }
  return ticketOk(d) ? { ticket: optionalKeys(d) } : { message: NO_DETAIL };
}

// Phase 08.7 D-04, D-07: the optional keys `review`, `log` and `stagesOff` are kept only when well formed, so a malformed one is drawn as absent and the base ticket still shows.
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const tallyOk = (t) => plain(t) && num(t.open) && num(t.fixed) && num(t.deferred);
const roundOk = (r) => plain(r) && num(r.n) && plain(r.findings) && tallyOk(r.findings.Must) && tallyOk(r.findings.Should) && tallyOk(r.findings.Nice);
const reviewOk = (r) => plain(r) && num(r.cycle) && num(r.round) && num(r.cap) && Array.isArray(r.rounds) && r.rounds.every(roundOk);
const LOG_KINDS = ['commit', 'gate', 'report'];
const logOk = (e) => plain(e) && num(e.at) && LOG_KINDS.includes(e.kind) && str(e.text);
function optionalKeys(d) {
  const { review, log, stagesOff, ...base } = d;
  const entries = Array.isArray(log) ? log.filter(logOk) : [];
  return { ...base, ...(reviewOk(review) ? { review } : {}), ...(entries.length > 0 ? { log: entries } : {}), ...(strs(stagesOff) ? { stagesOff } : {}) };
}

const orNone = (v) => (v === null || v === undefined || v === '' ? 'none' : v);

// Every string is whole and cleaned, never cut: the panel wraps it.
export function detailView({ action, state }) {
  const back = { key: 'back', label: 'Back' };
  if (state === undefined) return { back, action, message: ['Loading…'] };
  if (state.message !== undefined) return { back, message: state.message.split(NL).map(clean).filter((l) => l) };
  const t = state.ticket;
  const facts = [
    `Stage: ${t.stage}`,
    `Lane: ${t.lane}`,
    `Tasks: ${t.tasksDone}/${t.tasksTotal}`,
    `Branch: ${orNone(t.branch)}`,
    `Holder: ${orNone(str(t.holderShown) ? t.holderShown : t.holder)}`,
    `Blocked by: ${t.blockedBy.length > 0 ? t.blockedBy.join(' ') : 'none'}`,
  ].map(clean);
  const criteria = t.criteria.map((c) => ({
    head: clean(c.id === null ? c.title : `${c.id} ${c.title}`),
    steps: c.steps.map(clean),
    facts: [
      `State: ${c.label}`,
      `Test: ${orNone(c.test)}`,
      `Test result: ${orNone(c.testResult)}`,
      `Ticked: ${c.ticked === true ? 'yes' : 'no'}`,
      `Verification: ${orNone(c.verification)}`,
    ].map(clean),
  }));
  return { back, action, title: clean(t.title), facts, intent: t.intent.map(clean), criteria };
}

// ---- Phase 08.7: the ticket tab. Every number below is one the JSON holds, the length of a list it holds, or the mod's own count of running agents. ----

export const HINT = 'No ticket in flight in this worktree';
// Interim pane widths in terminal columns (08.7-04 owns the final values): at least WIDE is wide, below NARROW is narrow.
export const WIDE = 80;
export const NARROW = 56;

export function layoutOf(columns) {
  if (!num(columns)) return 'wide';
  return columns >= WIDE ? 'wide' : columns < NARROW ? 'narrow' : 'mid';
}

// D-10: the lane ticket this worktree claimed, as `dashboard --json` names it. The id becomes an argv element, so only a safe id passes.
export function currentOf(state) {
  const id = state?.dashboard?.current;
  return typeof id === 'string' && SAFE_ID.test(id) ? id : undefined;
}

// D-07, A-02: the one stage reader. Lanes M, L and P (and any lane not named below) hold five cells, the first labelled intent/approach because
// today's derivation reports `intent` for a ticket at approach; Phase 10's stage table replaces this reader and splits the cell.
const LANE_STAGES = { S: ['intent', 'build', 'review'], R: ['intent', 'research'] };
const FULL_STAGES = ['intent', 'plan', 'build', 'review', 'verify'];
const MERGED_INTENT = ['M', 'L', 'P'];

export function pipelineOf(t) {
  const keys = Object.hasOwn(LANE_STAGES, t.lane) ? LANE_STAGES[t.lane] : FULL_STAGES;
  const off = strs(t.stagesOff) ? t.stagesOff : [];
  const at = t.stage === 'done' ? keys.length : keys.indexOf(t.stage);
  const round = plain(t.review) && num(t.review.round) && num(t.review.cap) ? `r${t.review.round}/${t.review.cap}` : undefined;
  return keys.map((key, i) => {
    let label = key;
    if (key === 'intent' && MERGED_INTENT.includes(t.lane)) label = 'intent/approach';
    else if (key === 'build' && t.lane !== 'S') label = `build ${num(t.tasksDone) ? t.tasksDone : 0}/${num(t.tasksTotal) ? t.tasksTotal : 0}`;
    else if (key === 'review' && round !== undefined) label = `review ${round}`;
    const state = off.includes(key) ? 'off' : at < 0 ? 'todo' : i < at ? 'done' : i === at ? 'current' : 'todo';
    return { key, label, state, color: STAGE_COLOR[key] };
  });
}

// D-03: each tab label carries a live summary. `ticket` is the pane's `{ id, state }` of the claimed ticket, `running` the count of accord agents the mod holds.
const rowCount = (s) => (plain(s) && Array.isArray(s.rows) ? s.rows.length : 0) + (plain(s) && num(s.more) ? s.more : 0);

export function tabLabels({ state, ticket, running }) {
  const d = state?.dashboard;
  const summary = d === undefined ? '' : `${rowCount(d.yours)} yours · ${rowCount(d.ready)} ready · ${rowCount(d.team)} team`;
  const t = ticket?.state?.ticket;
  const id = clean(ticket?.id ?? '');
  const stage = t === undefined ? '' : clean(t.stage);
  const review = t !== undefined && t.stage === 'review' && plain(t.review) && num(t.review.round) && num(t.review.cap) ? `r${t.review.round}/${t.review.cap}` : undefined;
  const agents = num(running) && running > 0 ? running : undefined;
  const newest = Array.isArray(t?.log) ? t.log[0] : undefined;
  const failed = plain(newest) && newest.fail === true;
  const stageColor = t !== undefined && Object.hasOwn(STAGE_COLOR, t.stage) ? STAGE_COLOR[t.stage] : undefined;
  const label = ['1 ticket', id, stage, review, agents === undefined ? '' : `◐${agents}`, failed ? 'gate failed' : ''].filter((p) => p).join(' ');
  return {
    ticket: {
      label,
      id,
      stage,
      ...(stageColor === undefined ? {} : { stageColor }),
      ...(review === undefined ? {} : { review }),
      ...(agents === undefined ? {} : { running: agents }),
      ...(failed ? { failed: true } : {}),
    },
    dashboard: { label: summary === '' ? '2 dashboard' : `2 dashboard ${summary}`, summary },
  };
}

// D-01, D-02: the agents block. Only an agent whose list type is `accord-<role>` is drawn, and the view is never given an agent's label or description:
// a roster entry holds the type, the times and the state, nothing else. These rows rank the mod's own display state, not a number the CLI holds.
export const ACCORD_AGENT = /^accord-[a-z][a-z-]{0,30}$/;
export const AGENTS_SHOWN = 6;

export const isAccordAgent = (type) => typeof type === 'string' && ACCORD_AGENT.test(type);

// `m:ss`; a negative or non-finite time reads 0:00
export function mmss(ms) {
  if (!num(ms) || ms < 0) return '0:00';
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

// `roster` is an array of `{ key, type, running, startTime, durationMs?, endTime? }`, `now` epoch milliseconds: running agents first (newest start first), then finished ones (newest end first), at most AGENTS_SHOWN rows.
export function agentRows(roster, now) {
  const mine = roster.filter((a) => isAccordAgent(a.type));
  const running = mine.filter((a) => a.running === true).sort((a, b) => b.startTime - a.startTime);
  const finished = mine.filter((a) => a.running !== true).sort((a, b) => (b.endTime ?? 0) - (a.endTime ?? 0));
  return [...running, ...finished].slice(0, AGENTS_SHOWN).map((a) => ({
    key: a.key,
    name: clean(a.type.slice('accord-'.length)),
    running: a.running === true,
    time: mmss(a.running === true ? now - a.startTime : a.durationMs),
  }));
}

// D-06: the widget placement's lines: the two tab labels while a ticket is in flight, else the hint line (when the dashboard names no claimed ticket) and the dashboard's summary line.
// Plain text only, every line through clean.
export function widgetView({ state, ticket, running }) {
  if (state === undefined) return ['Loading…'];
  if (state.message !== undefined) return state.message.split(NL).map(clean).filter((l) => l);
  if (ticket !== undefined) {
    const labels = tabLabels({ state, ticket, running });
    return [labels.ticket.label, labels.dashboard.label].map(clean);
  }
  const v = view(state, '');
  return [...(v.hint === undefined ? [] : [v.hint]), v.summary].map(clean);
}

// D-04, A-01: the review block reads per round and per severity; the lens split is queued for Phase 10. Every count is one the JSON holds.
const SEVERITIES = ['Must', 'Should', 'Nice'];
const COUNTS = ['open', 'fixed', 'deferred'];
const SECURITY = { ran: 'security lens ran', none: 'no security pattern' };

export function reviewRows(review) {
  const verdict = str(review.verdict) && clean(review.verdict) !== '' ? ` ${clean(review.verdict)}` : '';
  const cycle = review.cycle > 1 ? `cycle ${review.cycle} ` : '';
  const rounds = review.rounds.map((r) => {
    const parts = SEVERITIES.flatMap((sev) => {
      const counts = COUNTS.filter((k) => r.findings[sev][k] > 0).map((k) => `${r.findings[sev][k]} ${k}`);
      return counts.length === 0 ? [] : [`${sev} ${counts.join(' ')}`];
    });
    return {
      head: `r${r.n}/${review.cap}${r.final === true ? ' final' : ''}${r.added === true ? ' added' : ''}`,
      parts: parts.length === 0 ? ['no findings'] : parts,
      security: Object.hasOwn(SECURITY, r.security) ? SECURITY[r.security] : undefined,
    };
  });
  return { heading: `REVIEW ${cycle}r${review.round}/${review.cap}${verdict}`, rounds };
}

const LABEL_COLOR = { failing: 'red', blocked: 'red', verified: 'green', passing: 'green', 'not run': 'yellow', untested: 'dim' };

export function criteriaRows(criteria) {
  return criteria.map((c) => ({
    id: str(c.id) ? clean(c.id) : '',
    title: clean(c.title),
    label: clean(c.label),
    color: Object.hasOwn(LABEL_COLOR, c.label) ? LABEL_COLOR[c.label] : 'dim',
  }));
}

// The age of a log line, `at` and `now` in epoch seconds; a time in the future reads 0s.
export function ago(at, now) {
  const s = now - at;
  if (!(s > 0)) return '0s';
  if (s < 60) return `${Math.floor(s)}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

// The CLI orders the log newest first; the view only cuts it. A commit, a report and a gate run draw alike.
export const LOG_SHOWN = 8;

export function logRows(log, now) {
  return log.slice(0, LOG_SHOWN).map((e) => ({ age: ago(e.at, now), text: clean(e.text), fail: e.fail === true }));
}

// The failure box: the newest log entry only, when it is a failed gate run.
export function failureOf(log) {
  const newest = Array.isArray(log) ? log[0] : undefined;
  return plain(newest) && newest.fail === true && str(newest.text) ? { text: clean(newest.text) } : undefined;
}

// The ticket tab: the head (title and stage bar), the failure box, then the review rounds, the criteria checklist and the session log, each only when the JSON holds it.
// `now` is the epoch second of the draw. A message replaces all of it while the run is loading or failed. An off cell reads `<label> off`.
export function ticketView({ ticket, now }) {
  const s = ticket?.state;
  if (s === undefined) return { message: ['Loading…'] };
  if (s.message !== undefined) return { message: s.message.split(NL).map(clean).filter((l) => l) };
  const t = s.ticket;
  const cells = pipelineOf(t).map((c) => ({ ...c, text: clean(c.state === 'off' ? `${c.label} off` : c.label) }));
  const current = cells.find((c) => c.state === 'current');
  const failure = failureOf(t.log);
  return {
    title: clean(`${t.id} ${t.title}`),
    cells,
    ...(current === undefined ? {} : { current: current.text }),
    ...(failure === undefined ? {} : { failure }),
    ...(t.review === undefined ? {} : { review: reviewRows(t.review) }),
    ...(t.criteria.length === 0 ? {} : { criteria: criteriaRows(t.criteria) }),
    ...(t.log === undefined ? {} : { log: logRows(t.log, now) }),
  };
}

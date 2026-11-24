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
    // D-05, D-07: the mini stage bar is the same stage reader as the ticket tab's; a row with no string stage gets none
    ...(typeof r.stage === 'string' ? { bar: pipelineOf(r).map(({ key, state, color }) => ({ key, state, color })) } : {}),
    stageColor: typeof r.stage === 'string' && Object.hasOwn(STAGE_COLOR, r.stage) ? STAGE_COLOR[r.stage] : undefined,
    title: r.title,
    blockedBy: blocked,
    // Phase 8.2 D-07: the CLI adds claimedByShown beside claimedBy when the person asked for initials; a string wins, anything else falls back to the email
    who: typeof r.claimedByShown === 'string' ? clean(r.claimedByShown) : typeof r.claimedBy === 'string' ? clean(r.claimedBy) : '',
  };
};
// D-05: an epic row's `progress` is the JSON's own done and total; a row without both numbers draws the count text only
const epicCells = (r) => ({
  id: r.id,
  lane: laneOf(r),
  stage: clean(`${r.done}/${r.total} done`),
  stageColor: undefined,
  title: r.title,
  blockedBy: '',
  who: '',
  ...(num(r.done) && num(r.total) ? { progress: { label: `${r.id} children done`, value: r.done, max: r.total, valueText: clean(`${r.done}/${r.total} done`) } } : {}),
});
// the panel runs /accord with the typed form: command accord, args `<action> <id>` (08.3-09 D-03)
const act = (key, label, action, id) => ({ key: `${key}:${id}`, label, command: 'accord', args: `${action} ${id}` });
// same id pattern as cli new-ticket.ts: a file stem with spaces must never reach a command as an id
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
// A lane row opens its detail; the row's own button (if any) moves into the detail view.
const withOpen = (key, label, action) => (r) =>
  SAFE_ID.test(r.id)
    ? { ...cells(r), open: { key: `show:${r.id}`, id: r.id, ...(key ? { action: act(key, label, action, r.id) } : {}) } }
    : cells(r);

export function view(state, query, columns) {
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
  const widths = { id: len('ID'), bar: 1, lane: len('LANE'), stage: len('STAGE') };
  for (const sec of all) {
    for (const r of rowsOf(sec)) {
      const c = sec === d.epics ? epicCells(r) : cells(r);
      widths.id = Math.max(widths.id, len(c.id));
      widths.bar = Math.max(widths.bar, c.bar?.length ?? 0);
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
    // Phase 08.7 D-03, D-05: which columns the rows draw at the width the pane reports
    layout: layoutOf(columns),
    // Phase 08.7 D-10: a loaded dashboard that names no claimed ticket says so in one line
    ...(currentOf(state) === undefined ? { hint: HINT } : {}),
    ...(noMatch ? { noMatch } : {}),
    // Phase 08.8 D-14 IN-04: the lead-in matches no typed form of /accord, so search text such as `queue x` is routed by its meaning (route.md) and never runs a typed form
    ...(args ? { newRequest: { key: 'new-request', label: 'New request', command: 'accord', args: 'new request: ' + args } } : {}),
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
// Phase 08.8.1 D-05, D-02: `warnings` is kept the same way, only its entries of the two kinds the CLI names, each with a string text.
const num = (v) => typeof v === 'number' && Number.isFinite(v);
const tallyOk = (t) => plain(t) && num(t.open) && num(t.fixed) && num(t.deferred);
const roundOk = (r) => plain(r) && num(r.n) && plain(r.findings) && tallyOk(r.findings.Must) && tallyOk(r.findings.Should) && tallyOk(r.findings.Nice);
const reviewOk = (r) => plain(r) && num(r.cycle) && num(r.round) && num(r.cap) && Array.isArray(r.rounds) && r.rounds.every(roundOk);
const LOG_KINDS = ['commit', 'gate', 'report'];
const logOk = (e) => plain(e) && num(e.at) && LOG_KINDS.includes(e.kind) && str(e.text);
// Phase 08.8.1 review WR-01: `plan-uncommitted` is an untracked plan.md, which keeps the stage track; `not-committed` (an ignored accord/) replaces it
const WARNING_KINDS = ['not-committed', 'plan-uncommitted', 'plan-changed'];
const warningOk = (w) => plain(w) && WARNING_KINDS.includes(w.kind) && str(w.text);
// Phase 08.8.1 L-06: `now` is kept only with a numeric task and a string title, `tasks` only as the entries with a numeric `n`, a string title, a boolean `done` and a string-array `covers`.
const nowOk = (n) => plain(n) && num(n.task) && str(n.title);
const taskOk = (t) => plain(t) && num(t.n) && str(t.title) && typeof t.done === 'boolean' && strs(t.covers);
function optionalKeys(d) {
  const { review, log, stagesOff, warnings, now, tasks, ...base } = d;
  const entries = Array.isArray(log) ? log.filter(logOk) : [];
  const notes = Array.isArray(warnings) ? warnings.filter(warningOk) : [];
  const taskList = Array.isArray(tasks) ? tasks.filter(taskOk) : [];
  return {
    ...base,
    ...(nowOk(now) ? { now } : {}),
    ...(taskList.length > 0 ? { tasks: taskList } : {}),
    ...(reviewOk(review) ? { review } : {}),
    ...(entries.length > 0 ? { log: entries } : {}),
    ...(strs(stagesOff) ? { stagesOff } : {}),
    ...(notes.length > 0 ? { warnings: notes } : {}),
  };
}

// Phase 08.8.1 D-05, D-02: the text of the first warning of each kind, cleaned; the CLI wrote it, the pane only draws it.
export function warningRows(warnings) {
  const list = Array.isArray(warnings) ? warnings.filter(warningOk) : [];
  const text = (kind) => {
    const w = list.find((x) => x.kind === kind);
    return w === undefined ? undefined : clean(w.text);
  };
  const notCommitted = text('not-committed');
  const planUncommitted = text('plan-uncommitted');
  const planChanged = text('plan-changed');
  return { ...(notCommitted === undefined ? {} : { notCommitted }), ...(planUncommitted === undefined ? {} : { planUncommitted }), ...(planChanged === undefined ? {} : { planChanged }) };
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
// Pane widths in terminal columns (D-03, A-09): the dock body is at most 45% of the terminal and at least 24 columns, so a 110-column terminal gives about 49 (narrow), 144 gives 64 (mid)
// and 200 gives 90 (wide). At least WIDE is wide, below NARROW is narrow.
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

export function tabLabels({ state, ticket, running, settings = DEFAULT_SETTINGS, waiting }) {
  const d = state?.dashboard;
  const summary = d === undefined ? '' : `${rowCount(d.yours)} yours · ${rowCount(d.ready)} ready · ${rowCount(d.team)} team`;
  // issue 342: the tabs line's short form keeps only the counts above 0
  const short = d === undefined ? '' : [[rowCount(d.yours), 'yours'], [rowCount(d.ready), 'ready'], [rowCount(d.team), 'team']].filter(([n]) => n > 0).map(([n, w]) => `${n} ${w}`).join(' · ');
  const t = ticket?.state?.ticket;
  const id = clean(ticket?.id ?? '');
  // Phase 08.8.1 D-05: a ticket the CLI says is not committed shows `not tracked` where its stage word would be, and no stage colour
  const untracked = t !== undefined && warningRows(t.warnings).notCommitted !== undefined;
  const stage = t === undefined ? '' : untracked ? 'not tracked' : clean(t.stage);
  const review = t !== undefined && !untracked && t.stage === 'review' && plain(t.review) && num(t.review.round) && num(t.review.cap) ? `r${t.review.round}/${t.review.cap}` : undefined;
  // issue 342: the stage as the tabs line reads it, `build 1/3` and `review r2/5` carrying the counts the track no longer holds
  const stageText = t === undefined ? '' : untracked ? 'not tracked' : t.stage === 'build' && t.lane !== 'S' && num(t.tasksDone) && num(t.tasksTotal) ? `build ${t.tasksDone}/${t.tasksTotal}` : review !== undefined ? `review ${review}` : stage;
  const agents = num(running) && running > 0 ? running : undefined;
  // Phase 08.8.1 W4: the newest gate run decides the mark, not the newest entry of any kind
  const newest = newestGate(t?.log);
  const failed = plain(newest) && newest.fail === true;
  // Phase 08.8.1-07 L-01: the stage word takes the live line's colour, never a colour per stage (the dashboard keeps its own); a not-tracked ticket has none
  const paint = (place) => drawColor(colorOf(place, settings, 0));
  const stageColor = t !== undefined && !untracked && stage !== '' ? paint('now') : undefined;
  const label = ['1 ticket', id, stage, review, agents === undefined ? '' : `◐${agents}`, failed ? 'gate failed' : ''].filter((p) => p).join(' ');
  const isWaiting = plain(waiting) && num(waiting.since);
  return {
    ticket: {
      label,
      id,
      stage,
      stageText,
      ...(stageColor === undefined ? {} : { stageColor }),
      ...(review === undefined ? {} : { review }),
      ...(agents === undefined ? {} : { running: agents, agentsColor: paint('agents') }),
      ...(isWaiting ? { waiting: true, waitColor: paint('wait') } : {}),
      ...(failed ? { failed: true, failColor: paint('fail') } : {}),
    },
    dashboard: { label: summary === '' ? '2 dashboard' : `2 dashboard ${summary}`, summary, short },
  };
}

// issue 342: the tabs line as parts, `{ text, color?, bold?, dim? }` each. A tab is drawn `k: ` (the hotkey and a colon) and its parts joined by single spaces, two cells between tabs;
// the dashboard's counts are dropped when the line would run past `columns`, so the line fits the pane and the Button row only wraps below that.
export function tabParts({ labels, columns }) {
  const t = labels.ticket;
  const part = (text, extra = {}) => ({ text: clean(text), ...extra });
  const color = (c) => (drawColor(c) === undefined ? {} : { color: drawColor(c) });
  const ticket = [
    part(t.id, { bold: true }),
    ...(t.stageText === '' ? [] : [part(t.stageText, color(t.stageColor))]),
    ...(t.running === undefined ? [] : [part(t.running > 1 ? `✦${t.running}` : '✦', color(t.agentsColor))]),
    ...(t.waiting === true ? [part('◆ you', color(t.waitColor))] : []),
    ...(t.failed === true ? [part('✗ gate', color(t.failColor))] : []),
  ];
  const withCounts = [part('dashboard', { bold: true }), ...(labels.dashboard.short === '' ? [] : [part(labels.dashboard.short, { dim: true })])];
  const bare = [part('dashboard', { bold: true })];
  const settings = [part('settings', { bold: true })];
  const width = (list) => 3 + len(list.map((p) => p.text).join(' '));
  const fits = !num(columns) || width(ticket) + width(withCounts) + width(settings) + 4 <= columns;
  return { ticket, dashboard: fits ? withCounts : bare, settings };
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
    // Phase 08.8.1 L-06, D-01: the task the agent holds and the tool it called last, when the mod saw them
    ...(num(a.task) ? { task: a.task } : {}),
    ...(str(a.tool) && clean(a.tool) !== '' ? { tool: clean(a.tool) } : {}),
  }));
}

// ---- Phase 08.8.1 D-01, L-05, L-06: what the pane takes from tool calls. Only a tool name, a base name, a program name and a task number matched from a fixed path shape reach the view; no argument, command text or file content does (T-08.8.1-14, T-08.8.1-15). ----

const LABEL_MAX = 40;
const FILE_TOOLS = { Read: 'file_path', Write: 'file_path', Edit: 'file_path', NotebookEdit: 'notebook_path', Grep: 'path', Glob: 'path' };
const SHELL_TOOLS = ['Bash', 'PowerShell'];
const PROGRAM = /^[A-Za-z0-9][A-Za-z0-9._+-]*$/;
const cut = (text, max) => [...text].slice(0, max).join('');
const baseOf = (path) => String(path).replaceAll('\\', '/').split('/').filter((x) => x !== '').at(-1) ?? '';

// The first words of a command line, a leading quoted word kept whole (a program path may hold a space).
function wordsOf(command) {
  const words = [];
  let rest = command.trim();
  while (rest !== '' && words.length < 10) {
    const quote = rest[0];
    let word;
    if (quote === '"' || quote === "'") {
      const end = rest.indexOf(quote, 1);
      word = end < 0 ? rest.slice(1) : rest.slice(1, end);
      rest = end < 0 ? '' : rest.slice(end + 1).trimStart();
    } else {
      word = /^\S+/.exec(rest)[0];
      rest = rest.slice(word.length).trimStart();
    }
    words.push(word);
  }
  return words;
}

// The program a shell command runs, never its arguments: leading NAME=value words are skipped, a path and an extension are cut off, and `npx` or `npm exec` name the first non-flag word after them (a version suffix cut off).
function programOf(command) {
  const words = wordsOf(command);
  let i = words.findIndex((w) => !/^[A-Za-z_][A-Za-z0-9_]*=/.test(w));
  if (i < 0) return undefined;
  const name = (w) => baseOf(w).replace(/\.(exe|cmd|bat|ps1|sh|com)$/i, '');
  let program = name(words[i]);
  if (program === 'npx' || (program === 'npm' && words[i + 1] === 'exec')) {
    i += program === 'npx' ? 1 : 2;
    const target = words.slice(i).find((w) => !w.startsWith('-'));
    if (target === undefined) return PROGRAM.test(program) ? program : undefined;
    program = name(target);
    const at = program.indexOf('@', 1);
    if (at > 0) program = program.slice(0, at);
  }
  return PROGRAM.test(program) ? program : undefined;
}

// D-01: `Edit view.js`, `Bash vitest`, `Grep`; at most 40 characters, cleaned. `e` is the `tool.call` input.
export function toolLabel(e) {
  if (!plain(e) || !str(e.tool)) return undefined;
  // Phase 08.8.1 review WR-03 (probe row P1): the engine's own last call of a subagent is not the agent's tool; the line keeps the one before it
  if (e.tool === 'SubagentHandback') return undefined;
  const tool = clean(e.tool);
  if (tool === '') return undefined;
  let detail = '';
  if (Object.hasOwn(FILE_TOOLS, e.tool)) {
    const path = e[FILE_TOOLS[e.tool]];
    if (str(path)) detail = clean(baseOf(path));
  } else if (SHELL_TOOLS.includes(e.tool) && str(e.command)) detail = programOf(e.command.slice(0, 2000)) ?? '';
  return cut(detail === '' ? tool : `${tool} ${detail}`, LABEL_MAX);
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// L-06: the task number of `.accord-reports/<id>/brief-<n>.md` or `task-<n>.md` for the shown ticket, matched only in that shape; anything else is undefined.
export function briefTask(path, id) {
  if (!str(path) || path.length > 1000 || !str(id) || !SAFE_ID.test(id)) return undefined;
  const m = new RegExp(`(?:^|/)\\.accord-reports/${escapeRe(id)}/(?:brief|task)-([1-9][0-9]{0,8})\\.md$`).exec(path.replaceAll('\\', '/'));
  return m === null ? undefined : Number(m[1]);
}

// L-05: a Bash or PowerShell call that runs accord (the word `accord` or `accord.cmd`, or the published package name).
export function runsAccord(e) {
  if (!plain(e) || !SHELL_TOOLS.includes(e.tool) || !str(e.command)) return false;
  return /(?:^|[\s"'])accord(?:\.cmd)?(?=$|[\s"'])|@accord-dev\/accord/.test(e.command.slice(0, 2000));
}

// L-06 (probe row P8): the last non-empty line of a turn's answer, cleaned and cut; undefined when the answer is no string or has none.
export function answerLine(answer) {
  if (!str(answer)) return undefined;
  const line = answer.split(NL).map(clean).filter((l) => l !== '').at(-1);
  return line === undefined ? undefined : cut(line, 200);
}

// Phase 08.8.1 L-06: the NOW lines under the ticket head. `ticket` is the `show --json` ticket, `agents` the roster as an array (`agentRows` input), `now` epoch milliseconds.
// The first line names the task in flight (build, from the JSON's `now` and `tasksTotal`), the review round (review) or the stage word; the second names the first running accord agent with its time.
export function nowLines({ ticket, agents, waiting, now }) {
  const t = ticket;
  let head;
  if (t.stage === 'build' && nowOk(t.now) && num(t.tasksTotal)) head = `task ${t.now.task} of ${t.tasksTotal} · ${t.now.title}`;
  else if (t.stage === 'review' && plain(t.review) && num(t.review.round) && num(t.review.cap)) head = `review round ${t.review.round} of ${t.review.cap}`;
  // the stage word alone: the stage track already draws the cell's own label (with its counts) once, and the tab names it once
  else head = str(t.stage) ? t.stage : '';
  // the main loop waits for the person: its turn ended or its question is open
  if (plain(waiting) && num(waiting.since)) {
    const line = str(waiting.line) ? clean(waiting.line) : '';
    return [{ text: `Waiting for you · ${mmss(now - waiting.since)}` }, ...(line === '' ? [] : [{ text: line }])];
  }
  const lines = [{ text: clean(head) }];
  const running = agentRows(Array.isArray(agents) ? agents : [], now).find((a) => a.running);
  if (running !== undefined) lines.push({ text: `${running.name} · ${running.time}${running.tool === undefined ? '' : ` · ${running.tool}`}` });
  return lines;
}

// Phase 08.8.1 L-07: one row per plan task from `show --json` `tasks`: `✓` done, `▸` the task in flight (`current` is `now.task`), `·` the rest. Titles are cleaned.
export function taskRows(tasks, current) {
  const list = Array.isArray(tasks) ? tasks.filter(taskOk) : [];
  return list.map((t) => {
    const state = t.done ? 'done' : t.n === current ? 'current' : 'todo';
    return { n: t.n, mark: state === 'done' ? '✓' : state === 'current' ? '▸' : '·', state, title: clean(t.title) };
  });
}

// Phase 08.8.1 L-07: the build bar's value and max are the JSON's own `tasksDone` and `tasksTotal`; none unless both are numbers and the total is above 0.
export function buildProgress(t) {
  if (!plain(t) || !num(t.tasksDone) || !num(t.tasksTotal) || !(t.tasksTotal > 0)) return undefined;
  return { value: t.tasksDone, max: t.tasksTotal, valueText: `${t.tasksDone} of ${t.tasksTotal}` };
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

// Phase 08.8.1 D-06: the verifier's own result, one cell beside the label; any other value draws none.
const VERIFY_COLOR = { pass: 'green', fail: 'red', blocked: 'red' };

export function criteriaRows(criteria) {
  return criteria.map((c) => ({
    id: str(c.id) ? clean(c.id) : '',
    title: clean(c.title),
    label: clean(c.label),
    color: Object.hasOwn(LABEL_COLOR, c.label) ? LABEL_COLOR[c.label] : 'dim',
    ...(str(c.verification) && Object.hasOwn(VERIFY_COLOR, c.verification) ? { verification: { text: 'verify ' + c.verification, color: VERIFY_COLOR[c.verification] } } : {}),
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

// Phase 08.8.1 L-07: the most lines the pane draws, the CLI's own cap (LOG_CAP in the CLI's ticket-log).
export const LOG_MAX = 50;

// Phase 08.8.1 L-07: entries of the same kind and text merge into the newest of them (the CLI orders newest first, so the first one met is kept in its place); `count` is the length of the list of repeats.
export function mergeLog(log) {
  const kept = new Map();
  for (const e of log) {
    const key = `${e.kind}\u0000${e.text}`;
    const seen = kept.get(key);
    if (seen === undefined) kept.set(key, { ...e, count: 1 });
    else seen.count += 1;
  }
  return [...kept.values()];
}

// Phase 08.8.1 L-07: merge first, then cut to the room the pane has (at least LOG_SHOWN, at most LOG_MAX), LOG_SHOWN when the room is no usable number; `count` only above 1, `newest` on the first row.
export function logRows(log, now, room) {
  const shown = num(room) ? Math.min(LOG_MAX, Math.max(LOG_SHOWN, Math.floor(room))) : LOG_SHOWN;
  return mergeLog(log)
    .slice(0, shown)
    .map((e, i) => ({
      age: ago(e.at, now),
      text: clean(e.text),
      fail: e.fail === true,
      ...(e.count > 1 ? { count: e.count } : {}),
      ...(i === 0 ? { newest: true } : {}),
    }));
}

// Phase 08.8.1 W4: the newest log entry of kind gate (the CLI orders the log newest first), so a newer report or commit does not hide a gate run.
const newestGate = (log) => (Array.isArray(log) ? log.find((e) => plain(e) && e.kind === 'gate') : undefined);

// The failure box: the newest gate run, when it failed.
export function failureOf(log) {
  const newest = newestGate(log);
  return plain(newest) && newest.fail === true && str(newest.text) ? { text: clean(newest.text) } : undefined;
}

// Phase 08.8.1-09 L-06: the identity of the failure box's entry (its time and text), so the pane can tell a failure that newly appeared from one it already showed; none when the newest gate run did not fail.
export function failureKey(log) {
  const newest = newestGate(log);
  return plain(newest) && newest.fail === true && str(newest.text) ? `${num(newest.at) ? newest.at : ''} ${clean(newest.text)}` : undefined;
}

// The ticket tab: the head (title and stage bar), the failure box, then the review rounds, the criteria checklist and the session log, each only when the JSON holds it.
// `now` is the epoch second of the draw. A message replaces all of it while the run is loading or failed. An off cell reads `<label> off`.
// Phase 08.8.1-08 D-03, L-01: `motion` is `{ effects, burst?, columns? }`: `effects` a Set from effectsOf (empty while nothing runs), `burst` the finished-task burst `{ at, seed }`, `columns` the pane's width; the draw's frame time `nowMs` moves what the person switched on.
export function ticketView({ ticket, now, nowMs = now * 1000, agents = [], waiting, room, settings = DEFAULT_SETTINGS, motion }) {
  const s = ticket?.state;
  if (s === undefined) return { message: ['Loading…'] };
  if (s.message !== undefined) return { message: s.message.split(NL).map(clean).filter((l) => l) };
  const t = s.ticket;
  const failure = failureOf(t.log);
  const warned = warningRows(t.warnings);
  const fx = motion?.effects instanceof Set ? motion.effects : new Set();
  // Phase 08.8.1-09 L-06: a failure the pane is flashing (`motion.flash`) says so, and only then
  const flashed = (f) => (motion?.flash === true ? { ...f, flash: true } : f);
  // Phase 08.8.1-09 L-01: with the ticker on, the newest log row carries the scrolled text of every row (the rows hold already cleaned texts)
  const tickerWidth = Math.max(10, Math.min(120, Math.floor(num(motion?.columns) ? motion.columns : 64) - 10));
  const logOf = () => {
    const rows = logRows(t.log, now, room);
    if (!fx.has('ticker') || rows.length === 0) return rows;
    return rows.map((r, i) => (i === 0 ? { ...r, ticker: ticker(rows.map((x) => `${x.age} ${x.text}${x.count > 1 ? ` ×${x.count}` : ''}`), tickerWidth, nowMs) } : r));
  };
  // Phase 08.8.1-07 L-01, L-02: the person's colours for each place of the tab, every one through drawColor; the stage track, the title and the criteria ids take a gradient where the style says so
  const paint = (place, p) => drawColor(colorOf(place, settings, p));
  const colors = { now: paint('now', 0), agents: paint('agents', 0), bar: paint('bar', 0), log: paint('log', 0), tick: paint('tick', 0), wait: paint('wait', 0), fail: paint('fail', 0) };
  const title = clean(t.title);
  // L-01: the criteria the task in flight covers breathe (`covered`, a Set of ids), the others keep their colour
  const criteriaOf = (covered) => (t.criteria.length === 0 ? undefined : criteriaRows(t.criteria).map((c, i, all) => ({ ...c, idColor: covered.has(c.id) ? drawColor(breathe(paint('criteria', i / all.length), nowMs)) : paint('criteria', i / all.length) })));
  // L-01: the title's gradient flows while the effect is on
  const titleRun = fx.has('flow') ? flowRun(title, flowStops('title', settings), nowMs).map(({ ch, color }) => ({ ch, color: drawColor(color) })) : placeRun('title', title, settings);
  // Phase 08.8.1 D-05: a not-committed ticket draws no stage, task count, progress bar or task row (the CLI's count is read from files git does not hold); a block a later plan adds goes into the tracked branch only.
  if (warned.notCommitted !== undefined) {
    const shown = criteriaOf(new Set());
    return {
      title,
      titleRun,
      colors,
      notCommitted: warned.notCommitted,
      ...(failure === undefined ? {} : { failure: flashed(failure) }),
      ...(t.review === undefined ? {} : { review: reviewRows(t.review) }),
      ...(shown === undefined ? {} : { criteria: shown }),
      ...(t.log === undefined ? {} : { log: logOf() }),
    };
  }
  // L-01: the stage track's cells take the stage track's gradient, not the stage's own colour
  const cells = pipelineOf(t).map((c, i, all) => ({ ...c, color: paint('stage', i / all.length), text: clean(c.state === 'off' ? `${c.label} off` : c.label) }));
  const current = cells.find((c) => c.state === 'current');
  const rows = taskRows(t.tasks, t.now?.task);
  const bar = buildProgress(t);
  const isWaiting = plain(waiting) && num(waiting.since);
  // Phase 08.8.1-09 L-06, D-03: while any effect is on (`motion.blinks`) the waiting line's diamond blinks and the line glows toward white, for the first BLINK_MS of a wait; then it stays lit and still
  const blinks = motion?.blinks === true;
  const glowing = isWaiting && blinks && nowMs - waiting.since < BLINK_MS;
  const waitColor = glowing && isHex(colors.wait) ? drawColor(mixHex(colors.wait, GLOW, pingpong(seconds(nowMs) * 0.8) * 0.6)) : colors.wait;
  const diamond = blinks && !blinkOn(nowMs, waiting?.since, nowMs) ? '◇' : '◆';
  const covered = new Set(fx.has('breathe') && nowOk(t.now) && Array.isArray(t.tasks) ? (t.tasks.filter(taskOk).find((x) => x.n === t.now.task)?.covers ?? []) : []);
  const criteria = criteriaOf(covered);
  // L-01: the build bar as a comet with a counter while the comet moves or the counter rolls (a burst's first ROLL_MS), else the engine's own Progress
  const burst = motion?.burst;
  const sinceBurst = plain(burst) && num(burst.at) ? nowMs - burst.at : -1;
  const rollOn = fx.has('roll') && sinceBurst >= 0 && sinceBurst < ROLL_MS;
  const cometOn = fx.has('comet');
  const columns = num(motion?.columns) ? motion.columns : 64;
  const barRow =
    bar !== undefined && (cometOn || rollOn)
      ? {
          cells: comet(bar.value / bar.max, Math.max(12, Math.min(40, Math.floor(columns) - 28)), cometOn ? nowMs : undefined, placeStops('bar', settings, 0.55)).map(({ ch, color }) => ({ ch, color: drawColor(color) })),
          counter: rollOn ? rolling(bar.value, bar.max, burst.at, nowMs) : bar.valueText,
          color: rollOn ? GLOW : colors.bar,
        }
      : undefined;
  // L-01: the sparkles of a finished task over the TASKS block, three rows of segments
  const sparks = fx.has('confetti') && plain(burst) ? sparkRows(sparkles(burst, nowMs, Math.max(10, Math.min(100, Math.floor(columns) - 4))), stopsOf(settings)) : undefined;
  // Phase 08.8.1-09 L-01: the mission preset's heartbeat across the top of the tab (a taller glyph where a log entry of the last seconds happened) and the train on the stage track's current connector
  const beat = fx.has('ecg') ? heartbeat(Math.max(20, Math.min(104, Math.floor(columns) - 2)), nowMs, t.log, nowMs, placeStops('stage', settings, 0.85)).map(({ ch, color }) => ({ ch, color: drawColor(color) })) : undefined;
  return {
    title,
    titleRun,
    colors,
    cells,
    // issue 342: the stage track as one connected line; the train effect rides its current connector
    track: stageTrack(cells, { columns: motion?.columns, nowMs, effects: fx }),
    // Phase 08.8.1 L-06: the NOW lines, in the tracked branch only; the first line is the waiting colour while the main loop waits for the person, else the live line's
    now: nowLines({ ticket: t, agents, waiting, now: nowMs }).map((l, i) =>
      i === 0 ? { ...l, color: isWaiting ? waitColor : colors.now, ...(isWaiting ? { diamond } : {}), ...(fx.has('shimmer') && !isWaiting ? { run: shimmer(l.text, nowMs, placeStops('now', settings)).map(({ ch, color }) => ({ ch, color: drawColor(color) })) } : {}) } : l,
    ),
    ...(current === undefined ? {} : { current: current.text }),
    // Phase 08.8.1 L-07: the task list and the build bar, in the tracked branch only (D-05: a not-committed ticket gets neither)
    ...(rows.length === 0 ? {} : { tasks: rows }),
    ...(bar === undefined ? {} : { progress: bar }),
    ...(barRow === undefined ? {} : { barRow }),
    ...(sparks === undefined ? {} : { sparks }),
    ...(beat === undefined ? {} : { heartbeat: beat }),
    // Phase 08.8.1 D-02: a plan changed after its gate passed keeps the stage track and shows its warning under it
    // Phase 08.8.1 review WR-01: an untracked plan.md keeps the stage track and says under it that its commit is still to come
    ...(warned.planUncommitted === undefined ? {} : { planUncommitted: warned.planUncommitted }),
    ...(warned.planChanged === undefined ? {} : { planChanged: warned.planChanged }),
    ...(failure === undefined ? {} : { failure: flashed(failure) }),
    ...(t.review === undefined ? {} : { review: reviewRows(t.review) }),
    ...(criteria === undefined ? {} : { criteria }),
    ...(t.log === undefined ? {} : { log: logOf() }),
  };
}

// ---- Phase 08.8.1-07 L-01, L-02, L-03, L-04: each person's colours. The settings live in the mod's own `$.store` (probe row P3: persists), never in the repository. ----

// Sketch 004's presets: each is one gradient used as a single system. `custom` is the person's own three colours (from, via, to).
export const PALETTES = {
  aurora: ['#e07a4f', '#f0907a', '#f08ca0', '#d98ad0', '#b49af2', '#8fb0f5', '#6cc7d9'],
  ember: ['#ff7a45', '#ff5f6d', '#ff8c5a', '#ffb347', '#ffd36e'],
  ocean: ['#3ec6e0', '#4f8ef7', '#7b6cf6', '#b58cf9'],
  forest: ['#9be15d', '#46c98b', '#2bb3a3', '#5fc4d6'],
  sunset: ['#ff9a8b', '#ff6a88', '#d66bd9', '#8f6bff'],
  mono: ['#e07a4f', '#e8936f', '#c9ccd8', '#9ea2b5'],
  contrast: ['#ffd400', '#ffffff', '#00e5ff'],
};
export const PALETTE_NAMES = [...Object.keys(PALETTES), 'custom'];

// The places a colour goes, with the gradient position each takes (sketch 004's ROLES); the done tick, the waiting line and the failure have no position, they take a fixed colour per preset.
export const PLACES = [
  { key: 'title', label: 'title', at: 0 },
  { key: 'stage', label: 'stage track', at: 0.15 },
  { key: 'now', label: 'live line', at: 0.3 },
  { key: 'agents', label: 'agents', at: 0.62 },
  { key: 'bar', label: 'progress bar', at: 0.45 },
  { key: 'criteria', label: 'criteria', at: 0.8 },
  { key: 'log', label: 'log', at: 0.55 },
  { key: 'tick', label: 'done tick' },
  { key: 'wait', label: 'waiting for you' },
  { key: 'fail', label: 'failure' },
];

export const MOTIONS = ['lively', 'mission', 'calm', 'off', 'mine'];

export const EFFECTS = [
  { key: 'shimmer', label: 'shimmer on the live line' },
  { key: 'flow', label: 'flowing gradient title' },
  { key: 'comet', label: 'comet progress bar' },
  { key: 'eq', label: 'agent equalizer' },
  { key: 'typing', label: 'typed log lines' },
  { key: 'confetti', label: 'sparkles on a finished task' },
  { key: 'roll', label: 'rolling counter' },
  { key: 'ecg', label: 'heartbeat line' },
  { key: 'train', label: 'train on the stage track' },
  { key: 'orbit', label: 'orbiting agent marks' },
  { key: 'ticker', label: 'scrolling log ticker' },
  { key: 'breathe', label: 'breathing criteria' },
];

// The effects each motion level switches on (sketch 004's MOTIONS); `off` and `mine` start with none.
export const PRESET_EFFECTS = {
  lively: ['shimmer', 'flow', 'comet', 'eq', 'typing', 'confetti', 'roll', 'breathe'],
  mission: ['ecg', 'train', 'orbit', 'ticker', 'confetti', 'roll', 'shimmer'],
  calm: ['shimmer', 'roll'],
  off: [],
};
const presetOf = (level) => Object.fromEntries((PRESET_EFFECTS[level] ?? []).map((k) => [k, true]));

// L-02 (Ruling): the pane's background for the contrast check; the mod API offers no theme getter, so this is sketch 004's own.
export const BACKGROUND = '#0b0c10';

// The colour of the places that take no gradient position, per preset (each contrast-checked against BACKGROUND by a test).
export const FIXED = {
  aurora: { tick: '#6fd39a', wait: '#e07a4f', fail: '#ff6b6b' },
  ember: { tick: '#8fd694', wait: '#ffb347', fail: '#ff5f6d' },
  ocean: { tick: '#5fd3a0', wait: '#7bd0f5', fail: '#ff6b7a' },
  forest: { tick: '#9be15d', wait: '#f0c75e', fail: '#ff7a7a' },
  sunset: { tick: '#7ee0b0', wait: '#ffb08a', fail: '#ff6a88' },
  mono: { tick: '#9fd8b0', wait: '#e8936f', fail: '#ff7b7b' },
  contrast: { tick: '#00ff88', wait: '#ffd400', fail: '#ff5252' },
};
const FIXED_PLACES = ['tick', 'wait', 'fail'];
// the two places a person must always be able to see: a gate failure and a question waiting for them
const MUST_SHOW = ['fail', 'wait'];

// A colour is `#rrggbb` after trimming; the lower-case value comes back, anything else is undefined. Only this or the fixed tables above reach a Text.
export function isHex(v) {
  if (typeof v !== 'string') return undefined;
  const t = v.trim();
  return /^#[0-9a-fA-F]{6}$/.test(t) ? t.toLowerCase() : undefined;
}

const rgbOf = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0')).join('');
const channel = (v) => {
  const c = v / 255;
  return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => {
  const [r, g, b] = rgbOf(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

// L-02 (Ruling): WCAG's contrast ratio of two `#rrggbb` colours, at least 3:1 (the figure for large and graphical text); anything that is no colour fails.
export function contrastOk(fg, bg = BACKGROUND) {
  const a = isHex(fg);
  const b = isHex(bg);
  if (a === undefined || b === undefined) return false;
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05) >= 3;
}

const defaults = () => ({ v: 1, palette: 'aurora', custom: ['#e07a4f', '#d98ad0', '#6cc7d9'], style: 'gradient', places: {}, motion: 'lively', effects: presetOf('lively') });
export const DEFAULT_SETTINGS = defaults();

// L-03, L-04 (T-08.8.1-20): the stored value read field by field. Anything missing, from another version or hand-edited into something invalid reads as that field's default; a failure or waiting colour that is too faint reads as `auto` (absent).
export function settingsOf(raw) {
  const d = defaults();
  if (!plain(raw) || raw.v !== 1) return d;
  const places = {};
  if (plain(raw.places)) {
    for (const { key } of PLACES) {
      const hex = Object.hasOwn(raw.places, key) ? isHex(raw.places[key]) : undefined;
      if (hex !== undefined && (!MUST_SHOW.includes(key) || contrastOk(hex, BACKGROUND))) places[key] = hex;
    }
  }
  const motion = MOTIONS.includes(raw.motion) ? raw.motion : d.motion;
  const effects = plain(raw.effects) ? Object.fromEntries(EFFECTS.filter(({ key }) => Object.hasOwn(raw.effects, key) && raw.effects[key] === true).map(({ key }) => [key, true])) : presetOf(motion);
  return {
    v: 1,
    palette: PALETTE_NAMES.includes(raw.palette) ? raw.palette : d.palette,
    custom: d.custom.map((own, i) => (Array.isArray(raw.custom) ? (isHex(raw.custom[i]) ?? own) : own)),
    style: raw.style === 'gradient' || raw.style === 'solid' ? raw.style : d.style,
    places,
    motion,
    effects,
  };
}

// The colour stops of the person's palette.
export const stopsOf = (settings) => (settings.palette === 'custom' ? settings.custom : PALETTES[settings.palette]);

// The colour at position p of a gradient, wrapping at 1, mixed linearly between the stops.
export function gradientAt(stops, p) {
  const q = num(p) ? ((p % 1) + 1) % 1 : 0;
  const x = q * (stops.length - 1);
  const i = Math.floor(x);
  const a = rgbOf(stops[i]);
  const b = rgbOf(stops[Math.min(i + 1, stops.length - 1)]);
  return toHex(a.map((v, k) => v + (b[k] - v) * (x - i)));
}

// One `{ ch, color }` per code point of text, the colours spread over the whole text from `offset`.
export function gradientRun(text, stops, offset = 0) {
  const chars = [...text];
  return chars.map((ch, i) => ({ ch, color: gradientAt(stops, offset + i / chars.length) }));
}

// The colour of a place: the person's own `#rrggbb` first, else the fixed colour of the places that take no position, else the palette at the place's position (plus `p` with the gradient style).
export function colorOf(place, settings, p) {
  if (Object.hasOwn(settings.places, place)) return settings.places[place];
  if (FIXED_PLACES.includes(place)) return (FIXED[settings.palette] ?? FIXED.aurora)[place];
  const at = PLACES.find((x) => x.key === place)?.at ?? 0;
  return gradientAt(stopsOf(settings), settings.style === 'gradient' ? at + (num(p) ? p : 0) : at);
}

// Probe row P4 (hex: drawn, 2026-11-23): a Text with `color: '#rrggbb'` validates on `terminal` and `desktop`, so a checked hex colour is drawn as it is. Probe row P5 (signals: none in the API): no terminal is told apart, so there is no named-colour branch.
// Every coloured Text of the ticket tab passes its colour through here: only a `#rrggbb` gets through, anything else draws no colour (T-08.8.1-21).
export const drawColor = (hex) => isHex(hex);

// A text drawn in a place's colour: one `{ ch, color }` per code point, the gradient spread over the text; one colour when the person gave the place one, chose the solid style or the place is a fixed one.
export function placeRun(place, text, settings, offset = 0) {
  const own = Object.hasOwn(settings.places, place);
  if (settings.style === 'gradient' && !own && !FIXED_PLACES.includes(place)) {
    const at = PLACES.find((x) => x.key === place)?.at ?? 0;
    return gradientRun(text, stopsOf(settings), at + offset).map(({ ch, color }) => ({ ch, color: drawColor(color) }));
  }
  const color = drawColor(colorOf(place, settings, offset));
  return [...text].map((ch) => ({ ch, color }));
}

// ---- Phase 08.8.1-07 task 2: the checked edits of the settings and the rows the view draws ----

const REFUSED = 'a colour is #rrggbb, e.g. #e07a4f';

// L-02 (T-08.8.1-21, T-08.8.1-22): a person's text for one place. `{ settings }` is the new value, `{ refused }` alone leaves the settings as they were (not `#rrggbb`), and a failure or waiting colour under 3:1 against `bg` gives both: the place is reset to `auto`, so neither the faint colour nor an earlier custom one is kept.
export function setPlace(settings, key, text, bg = BACKGROUND) {
  const t = String(text ?? '').trim().toLowerCase();
  const rest = Object.fromEntries(Object.entries(settings.places).filter(([k]) => k !== key));
  if (t === '' || t === 'auto') return { settings: { ...settings, places: rest } };
  const hex = isHex(t);
  if (hex === undefined) return { refused: REFUSED };
  if (MUST_SHOW.includes(key) && !contrastOk(hex, bg)) {
    const preset = (FIXED[settings.palette] ?? FIXED.aurora)[key];
    return { settings: { ...settings, places: rest }, refused: `too faint on this background (${bg}); using the preset's ${preset}` };
  }
  return { settings: { ...settings, places: { ...settings.places, [key]: hex } } };
}

// L-02: one of the custom palette's three colours (from, via, to); a good one makes `custom` the palette.
export function setCustom(settings, i, text) {
  const hex = isHex(text);
  if (hex === undefined || !(i >= 0 && i < settings.custom.length)) return { refused: REFUSED };
  return { settings: { ...settings, palette: 'custom', custom: settings.custom.map((c, j) => (j === i ? hex : c)) } };
}

export const setPalette = (settings, name) => (PALETTE_NAMES.includes(name) ? { ...settings, palette: name } : settings);
export const setStyle = (settings, style) => (style === 'gradient' || style === 'solid' ? { ...settings, style } : settings);

// L-01, L-03: a motion level sets the effects to its set; `mine` is only ever reached by switching a single effect.
export const setMotion = (settings, level) => (Object.hasOwn(PRESET_EFFECTS, level) ? { ...settings, motion: level, effects: presetOf(level) } : settings);

export function toggleEffect(settings, key) {
  if (!EFFECTS.some((e) => e.key === key)) return settings;
  const effects = Object.fromEntries(Object.entries(settings.effects).filter(([k]) => k !== key));
  if (settings.effects[key] !== true) effects[key] = true;
  return { ...settings, effects, motion: 'mine' };
}

// The rows the settings view draws, all from the settings: each palette with five swatch cells, the three custom colours, the style choice, each place's current colour or `auto`, the motion levels and the twelve switches.
export function settingsView(settings) {
  const swatch = (stops) => Array.from({ length: 5 }, (_, i) => ({ ch: '█', color: drawColor(gradientAt(stops, Math.min(i / 4, 0.9999))) }));
  return {
    palettes: PALETTE_NAMES.map((name) => ({ name, selected: settings.palette === name, swatch: swatch(name === 'custom' ? settings.custom : PALETTES[name]) })),
    custom: settings.custom.map((value, i) => ({ key: `custom:${i}`, label: ['from', 'via', 'to'][i], value, color: drawColor(value) })),
    styles: [
      { key: 'gradient', label: 'gradient', selected: settings.style === 'gradient' },
      { key: 'solid', label: 'one colour', selected: settings.style === 'solid' },
    ],
    places: PLACES.map(({ key, label }) => ({ key, label, value: Object.hasOwn(settings.places, key) ? settings.places[key] : 'auto', color: drawColor(colorOf(key, settings, 0.5)) })),
    motions: ['lively', 'mission', 'calm', 'off'].map((name) => ({ name, selected: settings.motion === name })),
    mine: settings.motion === 'mine',
    effects: EFFECTS.map(({ key, label }) => ({ key, label, on: settings.effects[key] === true, ...(CUT_EFFECTS.includes(key) ? { cut: true } : {}) })),
  };
}

// ---- Phase 08.8.1-08 D-03, L-01: motion. Every effect is a pure function of the frame time (epoch milliseconds, never read here) and the state the draw hands it. ----

// Probe row P6 (2026-11-23): `- P6 rate: 12 not measured` (the owner did not run the live rows, so no CPU number or smooth/stutter answer exists). Motion therefore starts at 12 frames a second.
// Guard: D-03's step-down (12 to 6 a second, then the costliest effects named in CUT_EFFECTS, in the order of 08.8.1-08's cut Ruling) is applied from the UAT's first line, before release (08.8.1-12): that line measures the real pane with cpu.ps1 and, if it fails, the release waits for a follow-up that lowers this number.
export const FRAME_RATE = 12;

// Effects the probe cut: never drawn, whatever the person chose. Empty: P6 reads `12 not measured`, so no cost per effect exists to rank them by; the UAT's first line decides any cut (see FRAME_RATE).
export const CUT_EFFECTS = [];

// Probe row P7 (2026-11-23): `- P7 desktop: not observed` (the owner did not open the Desktop Code tab). A pane that does not redraw on its timer would freeze an effect mid-frame, so a `static` answer would set this false; `not observed` keeps motion on, at most 10 frames a second, and the UAT's Desktop line checks it (a wrong answer there is fixed by setting this false before release).
export const DESKTOP_MOTION = true;

// The effects this person's motion level (or, under `mine`, their switches) turns on for a surface, less CUT_EFFECTS; a surface other than the terminal draws none while DESKTOP_MOTION is false. Motion `off` is empty.
export function effectsOf(settings, surface = 'terminal') {
  if (!DESKTOP_MOTION && surface !== 'terminal') return new Set();
  const level = settings?.motion;
  const keys = level === 'off' ? [] : level === 'mine' ? Object.keys(plain(settings.effects) ? settings.effects : {}).filter((k) => settings.effects[k] === true) : (PRESET_EFFECTS[level] ?? []);
  return new Set(keys.filter((k) => EFFECTS.some((e) => e.key === k) && !CUT_EFFECTS.includes(k)));
}

const seconds = (t) => (num(t) ? t / 1000 : 0);
const GLOW = '#ffffff';
const mixHex = (a, b, k) => {
  const x = rgbOf(a);
  const y = rgbOf(b);
  return toHex(x.map((v, i) => v + (y[i] - v) * k));
};

// The stops an effect spreads over a place: the palette from the place's position when the style is gradient and the person gave the place no colour, else the place's one colour.
export function placeStops(place, settings, width = 0.4) {
  const own = Object.hasOwn(settings.places, place);
  if (settings.style === 'gradient' && !own && !FIXED_PLACES.includes(place)) {
    const at = PLACES.find((x) => x.key === place)?.at ?? 0;
    const pal = stopsOf(settings);
    return [gradientAt(pal, at), gradientAt(pal, Math.min(0.9999, at + width))];
  }
  return [colorOf(place, settings, 0)];
}

// A glow band about four cells wide that moves across the text at about 12 cells a second over the stops; one `{ ch, color }` per code point.
export function shimmer(text, t, stops) {
  const chars = [...text];
  const centre = ((seconds(t) * 12) % (chars.length + 16)) - 8;
  return chars.map((ch, i) => ({ ch, color: mixHex(gradientAt(stops, i / chars.length), GLOW, Math.max(0, 1 - Math.abs(i - centre) / 4)) }));
}

// A triangle wave over 0 to 1 and back, period 2.
const pingpong = (x) => {
  const p = ((x % 2) + 2) % 2;
  return p <= 1 ? p : 2 - p;
};

// The title's gradient flowing: the same stops as the still title, shifted back and forth with the time (sketch 004's flowText); one `{ ch, color }` per code point.
export function flowRun(text, stops, t) {
  const chars = [...text];
  const shift = seconds(t) * 0.25;
  return chars.map((ch, i) => ({ ch, color: gradientAt(stops, Math.min(0.9999, pingpong((i / chars.length) * 0.9 + shift))) }));
}

// The empty track of the comet bar and the colour the breathing criteria dim to (sketch 004's faint greys).
const TRACK = '#2c2e3b';
const DIM = '#474a5c';

// The build bar as `width` one-cell `{ ch, color }`: the filled part `━` in the stops with a bright head that runs along it about 16 cells a second, the rest an empty `─` track; a time that is no number draws no head (a still bar).
export function comet(frac, width, t, stops) {
  const w = Math.max(0, Math.floor(num(width) ? width : 0));
  const filled = Math.round(Math.min(1, Math.max(0, num(frac) ? frac : 0)) * w);
  const head = num(t) ? Math.floor(seconds(t) * 16) % (filled + 10) : -1;
  return Array.from({ length: w }, (_, i) => {
    if (i >= filled) return { ch: '─', color: TRACK };
    const d = head - i;
    const lit = d >= 0 && d < 4 ? 1 - d / 4 : 0;
    return { ch: '━', color: mixHex(gradientAt(stops, (i / w) * 0.8), GLOW, lit * 0.85) };
  });
}

const BARS = [...'▁▂▃▄▅▆▇'];

// `width` bars of the equalizer, each moving with the time; `seed` keeps two rows from moving in step.
export function equalizer(t, width, seed = 0) {
  const s = seconds(t);
  let out = '';
  for (let k = 0; k < Math.max(0, Math.floor(num(width) ? width : 0)); k++) {
    const v = (Math.sin(s * 7 + k * 1.7 + seed) + Math.sin(s * 3.1 + k * 0.8 + seed * 2) + 2) / 4;
    out += BARS[Math.min(BARS.length - 1, Math.floor(v * BARS.length))];
  }
  return out;
}

export const TYPE_MS = 28;

// A line typed out a character every TYPE_MS from `start`, a cursor after it until it is whole.
export function typed(text, start, now) {
  const chars = [...clean(text)];
  const n = num(start) && num(now) ? Math.max(0, Math.floor((now - start) / TYPE_MS)) : chars.length;
  return n < chars.length ? chars.slice(0, n).join('') + '▌' : chars.join('');
}

export const BURST_MS = 1200;
export const ROLL_MS = 700;
export const SPARK_ROWS = 3;
const SPARKS = 46;
const SPARK_GLYPHS = [...'✦✧⋆·*+˚'];

// A small seeded generator (mulberry32): the same seed gives the same sequence.
function seeded(seed) {
  let a = (num(seed) ? seed : 0) >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// The sparkles of a burst `{ at, seed }` at time `now`, over SPARK_ROWS rows and `width` columns: `{ x, y, ch, p, fade }` (`p` a palette position 0 to 1, `fade` 0 to 1 as it ages). None before the burst or from BURST_MS on.
export function sparkles(burst, now, width) {
  if (!plain(burst) || !num(burst.at) || !num(now) || !num(width)) return [];
  const ms = now - burst.at;
  if (!(ms >= 0) || ms >= BURST_MS) return [];
  const age = ms / 1000;
  const rand = seeded(burst.seed);
  const out = new Map();
  for (let k = 0; k < SPARKS; k++) {
    const x0 = width * 0.5 - 7 + rand() * 14;
    const y0 = 1 + rand();
    const vx = (rand() - 0.2) * 20;
    const vy = -(0.6 + rand() * 1.6);
    const ch = SPARK_GLYPHS[Math.floor(rand() * SPARK_GLYPHS.length)];
    const p = rand();
    const x = Math.round(x0 + vx * age);
    const y = Math.round(y0 + vy * age + 2.2 * age * age);
    if (x >= 0 && x < width && y >= 0 && y < SPARK_ROWS) out.set(`${y}:${x}`, { x, y, ch, p, fade: Math.min(1, ms / BURST_MS) });
  }
  return [...out.values()].sort((a, b) => a.y - b.y || a.x - b.x);
}

// The counter `<n> of <total>`: for ROLL_MS after `at` its digit rolls (changing every 50 ms), then it reads the number.
export function rolling(n, total, at, now) {
  const age = num(at) && num(now) ? now - at : -1;
  if (age >= 0 && age < ROLL_MS) return `${(Math.floor(age / 50) * 7 + (num(n) ? n : 0) + 3) % 10} of ${total}`;
  return `${n} of ${total}`;
}

// A colour breathing between a dim grey and itself, one breath every 1.1 seconds; anything that is no `#rrggbb` is given back as it was.
export function breathe(color, t) {
  const c = isHex(color);
  if (c === undefined) return color;
  return mixHex(DIM, c, (1 - Math.cos((2 * Math.PI * seconds(t)) / 1.1)) / 2);
}

const SPIN = [...'◐◓◑◒'];

// A running agent's mark: four quarters, eight steps a second.
export const spinner = (t) => SPIN[Math.floor(Math.max(0, seconds(t)) * 8) % SPIN.length];

// The stops a flowing effect runs over: the whole palette for a place that takes the gradient, else the place's one colour (nothing to flow).
function flowStops(place, settings) {
  return settings.style === 'gradient' && !Object.hasOwn(settings.places, place) && !FIXED_PLACES.includes(place) ? stopsOf(settings) : [colorOf(place, settings, 0)];
}

// The sparkles as SPARK_ROWS rows of `{ text, color? }` segments (spaces between the glyphs, each glyph in the palette fading to a dim grey as it ages); undefined when none shows.
export function sparkRows(list, stops) {
  if (!Array.isArray(list) || list.length === 0) return undefined;
  return Array.from({ length: SPARK_ROWS }, (_, y) => {
    const segments = [];
    let at = 0;
    for (const p of list.filter((q) => q.y === y)) {
      if (p.x > at) segments.push({ text: ' '.repeat(p.x - at) });
      segments.push({ text: p.ch, color: drawColor(mixHex(gradientAt(stops, p.p), DIM, p.fade * 0.9)) });
      at = p.x + 1;
    }
    return segments;
  });
}

// What one running agent's row adds while motion is on: the spinner mark, the equalizer and the typed activity line (the tool it called last, else its name). `row` is an `agentRows` row, `entry` its roster entry, `fx` the effects now on.
export function agentMotion(row, entry, fx, now, index = 0) {
  if (!plain(row) || row.running !== true) return {};
  const since = str(row.tool) && num(entry?.toolAt) ? entry.toolAt : entry?.startTime;
  return {
    mark: fx.size > 0 ? (fx.has('orbit') ? orbit(now, index) : spinner(now)) : '◐',
    ...(fx.has('eq') ? { eq: equalizer(now, 8, index) } : {}),
    ...(fx.has('typing') ? { typed: typed(str(row.tool) ? row.tool : row.name, since, now) } : {}),
  };
}

// ---- Phase 08.8.1-09 L-01: the mission preset's effects, pure functions of the frame time like the lively ones ----

// The heartbeat line: one cell is HEART_STEP seconds of history, the newest at the right, a beat every HEART_BEAT seconds.
export const HEART_STEP = 0.07;
const HEART_BEAT = 2.5;

// `width` cells of `{ ch, color }`: a flat line with a beat that rides to the left as time passes, and one taller glyph for each log entry (`events`: entries with an `at` in epoch seconds, or such numbers) that happened inside the line's span; `t` and `now` are epoch milliseconds, `now` the draw's time the entries' ages count from. An entry older than the span shows none.
export function heartbeat(width, t, events, now, stops = PALETTES.aurora) {
  const w = Math.max(0, Math.floor(num(width) ? width : 0));
  const s = seconds(t);
  const spikes = new Set();
  for (const e of Array.isArray(events) ? events : []) {
    const at = num(e) ? e : plain(e) && num(e.at) ? e.at : undefined;
    const age = at === undefined ? -1 : seconds(now) - at;
    if (!(age >= 0)) continue;
    const c = w - Math.max(1, Math.round(age / HEART_STEP));
    if (c >= 0 && c < w) spikes.add(c);
  }
  return Array.from({ length: w }, (_, c) => {
    const base = gradientAt(stops, c / w);
    if (spikes.has(c)) return { ch: '▇', color: mixHex(base, GLOW, 0.5) };
    const ph = (((s - (w - c) * HEART_STEP) % HEART_BEAT) + HEART_BEAT) % HEART_BEAT;
    const ch = ph < 0.07 ? '╱' : ph < 0.14 ? '╲' : ph < 0.21 ? '╱' : ph > 0.21 && ph < 0.28 ? '‾' : '─';
    return ch === '─' ? { ch, color: TRACK } : { ch, color: mixHex(base, GLOW, c > w - 4 ? 0.6 : 0) };
  });
}

// issue 342: the stage track as one connected line of `{ text, color, bold? }` segments, `intent ━━━ plan ━━━ build ┄•┄ review ─── verify`. Passed stages are joined solid in their colour, the current stage
// is bold with a dotted connector that holds the marker (the mission train rides it), later stages are joined thin. Names are the cells' keys; an off stage reads `<key> off`. `cells` are `{ key, state, color }`.
// `columns` is the pane's width (64 when it is no number); a connector is at most 9 cells, and a pane too narrow for 2 cells cuts every name but the current one to its first letter.
export function stageTrack(cells, { columns, nowMs, effects } = {}) {
  const list = (Array.isArray(cells) ? cells : []).filter((c) => plain(c) && str(c.key));
  const fx = effects instanceof Set ? effects : new Set();
  const nameOf = (c, short) => clean(c.state === 'off' ? `${c.key} off` : short && c.state !== 'current' ? c.key.slice(0, 1) : c.key);
  const cols = num(columns) ? columns : 64;
  const gaps = Math.max(1, list.length - 1);
  const room = (short) => Math.floor((cols - list.reduce((n, c) => n + len(nameOf(c, short)), 0)) / gaps) - 2;
  const short = room(false) < 2;
  const seg = Math.max(1, Math.min(9, room(short)));
  const cur = list.findIndex((c) => c.state === 'current');
  const s = seconds(nowMs);
  const out = [];
  const put = (text, color, bold) => out.push({ text, color: drawColor(color), ...(bold ? { bold: true } : {}) });
  list.forEach((c, i) => {
    const passed = c.state === 'done';
    const current = i === cur;
    put(nameOf(c, short), passed || current ? c.color : DIM, current);
    if (i === list.length - 1) return;
    put(' ');
    if (passed) put('━'.repeat(seg), c.color);
    else if (current) {
      const at = fx.has('train') ? Math.floor(s * 6) % seg : fx.size > 0 ? Math.floor(s * 4) % seg : Math.floor(seg / 2);
      if (fx.has('train')) {
        if (at > 0) put('━'.repeat(at), c.color);
        put('▶', GLOW);
      } else {
        if (at > 0) put('┄'.repeat(at), DIM);
        put('•', c.color);
      }
      if (seg - at - 1 > 0) put('┄'.repeat(seg - at - 1), DIM);
    } else put('─'.repeat(seg), TRACK);
    put(' ');
  });
  return out;
}

// How long a wait keeps blinking, and how long a newly appeared gate failure flashes. D-03: after these nothing animates, so the frame timer can stop.
export const BLINK_MS = 600_000;
export const FLASH_MS = 1500;

const ORBIT = [...'◜◝◞◟'];

// A running agent's mark in the mission preset: four quarter arcs, eight steps a second, one step further for each next agent (`i`).
export const orbit = (t, i = 0) => ORBIT[(((Math.floor(Math.max(0, seconds(t)) * 8) + (num(i) ? Math.floor(i) : 0)) % ORBIT.length) + ORBIT.length) % ORBIT.length];

// The log as one scrolling line: exactly `width` characters of the lines (already cleaned display lines, newest first) joined behind a mark, about nine characters a second. Every line goes through `clean` once more, so no control or bidi code point scrolls past.
export function ticker(events, width, t) {
  const w = Math.max(0, Math.floor(num(width) ? width : 0));
  const text = [...`${(Array.isArray(events) ? events : []).map((e) => `✦ ${clean(e)}`).join('  ')}   `];
  const off = Math.floor(Math.max(0, seconds(t)) * 9) % text.length;
  let out = '';
  for (let k = 0; k < w; k++) out += text[(off + k) % text.length];
  return out;
}

// The waiting diamond: lit and dark twice a second, and lit for good once the wait (`now - since`, epoch milliseconds) has passed BLINK_MS.
export function blinkOn(t, since, now) {
  if (num(since) && num(now) && now - since >= BLINK_MS) return true;
  return Math.floor(seconds(t) * 2) % 2 === 0;
}

// The failure box's flash: red on every other sixth of a second for FLASH_MS from the time (`at`) the failure appeared, then never.
export const flashOn = (t, at) => num(t) && num(at) && t - at >= 0 && t - at < FLASH_MS && Math.floor(((t - at) / 1000) * 6) % 2 === 0;

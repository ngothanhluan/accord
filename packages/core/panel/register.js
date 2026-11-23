import { actionFor, agentRows, answerLine, briefTask, clean, currentOf, detailOutcome, detailView, failure, isAccordAgent, layoutOf, outcome, runsAccord, tabLabels, ticketView, toolLabel, view, widgetView } from './view.js';

// Phase 08.7 D-02, probe row A3 (headless session of 2026-11-23): the `$.agent.list()` entry joins a subagent event by its `id`, which equals the event's `agentId`.
const LIST_ID_KEY = 'id';
const ROSTER_MAX = 50;

let state;
let query = '';
// the open ticket detail, undefined while the dashboard shows
let detail;
// Phase 08.7 D-10: the lane ticket this worktree claimed, `{ id, state }` with the `show` result in state; undefined when the dashboard names none
let ticket;
// Phase 08.7 D-03: the tab the person pressed, 'ticket' or 'dashboard'; undefined until one is pressed
let picked;
// Phase 08.7 D-02: set once the pane was opened in this session (by start or by /accord-panel); until then no subagent event reads an agent list or draws anything
let active = false;
// Phase 08.7 D-06: `/accord-panel` is registered once per session, at every session start whatever the surface
let commandReady = false;
// Phase 08.7 D-01, D-02: the accord agents this mod saw start, `agentId` -> `{ type, startTime, running, durationMs?, endTime? }`; display only, never a label or a description
const roster = new Map();
// Phase 08.8.1 L-06: set while the main loop waits for the person (its turn ended, or its AskUserQuestion call is open), `{ since, line? }`; display only
let waiting;
let tick;
let debounce;
// whether the host's `$.agent.list()` answered with a list at its last call; the agents block is drawn only then. The host's nouns are only ever called (a call that throws means the host lacks the noun), never read as values.
let listing = false;

// Redraws without ever throwing into a hook
function redraw($) {
  try {
    void Promise.resolve($.ui.invalidate('ui.render')).catch(() => {});
  } catch {
    // a host without the call: nothing to redraw
  }
}

// Phase 08.8.1 IN-01: the pane is display only; a throw from the host inside an awaited call never stops the event's chain
async function guarded(work) {
  try {
    await work();
  } catch {
    // display only
  }
}

// the same for the redraws the loaders and the hooks await
const invalidate = ($) => guarded(() => $.ui.invalidate('ui.render'));

// Phase 08.8.1 D-01, L-06 (probe row P1): a subagent's tool call sets its roster row's last tool and, from the report path it reads or writes, its task. Only the label and a number are kept.
function noteTool($, e) {
  const agent = roster.get(e.agentId);
  if (agent === undefined || !agent.running) return;
  let changed = false;
  const label = toolLabel(e);
  if (label !== undefined && label !== agent.tool) {
    agent.tool = label;
    changed = true;
  }
  const task = ticket === undefined ? undefined : briefTask(e.file_path, ticket.id);
  if (task !== undefined && task !== agent.task) {
    agent.task = task;
    changed = true;
  }
  if (changed) redraw($);
}

const shownTab = () => (ticket === undefined ? 'dashboard' : (picked ?? 'ticket'));
const runningAgents = () => [...roster.values()].filter((a) => a.running).length;

// One 1-second redraw timer while an accord agent runs and the ticket tab is shown; cancelled when none runs or another tab shows. A host without `$.clock` gets no timer.
function ensureTick($, widget = false) {
  const want = !widget && shownTab() === 'ticket' && runningAgents() > 0;
  if (want && tick === undefined) {
    try {
      tick = $.clock.every(1000, () => void $.ui.invalidate('ui.render'));
    } catch {
      tick = undefined;
    }
  } else if (!want && tick !== undefined) {
    tick.cancel();
    tick = undefined;
  }
}

// Keeps the roster at ROSTER_MAX: the oldest finished entry goes first, then the oldest start.
function trimRoster() {
  while (roster.size > ROSTER_MAX) {
    const entries = [...roster.entries()];
    const done = entries.filter(([, a]) => !a.running).sort((x, y) => (x[1].endTime ?? 0) - (y[1].endTime ?? 0));
    const [oldest] = done.length > 0 ? done : entries.sort((x, y) => x[1].startTime - y[1].startTime);
    roster.delete(oldest[0]);
  }
}

// Reads the host's agent list; `listing` follows whether it answered with a list, so a host without `$.agent` never draws the block.
async function readList($) {
  try {
    const list = await $.agent.list();
    listing = Array.isArray(list);
    return listing ? list : undefined;
  } catch {
    listing = false;
    return undefined;
  }
}

// The type is on the `$.agent.list()` entry, not on the event: read the list once at the subagent's turn start and keep only an accord agent.
async function noteAgent($, agentId) {
  const was = listing;
  const list = await readList($);
  const entry = list?.find((a) => typeof a === 'object' && a !== null && a[LIST_ID_KEY] === agentId);
  if (entry === undefined || !isAccordAgent(entry.type)) {
    if (was !== listing) await invalidate($);
    return;
  }
  roster.set(agentId, { type: entry.type, startTime: typeof entry.startTime === 'number' ? entry.startTime : Date.now(), running: true });
  trimRoster();
  ensureTick($);
  await invalidate($);
}

// Phase 08.8.1 W5 (08.7 review WR-05): marks a running roster entry the host's list no longer shows as running, or lists with another status, as finished with its own time, so no agent and no redraw timer outlives a missed `turn.complete`.
async function reconcile($) {
  if (!active || runningAgents() === 0) return;
  const list = await readList($);
  if (list === undefined) return;
  const now = Date.now();
  for (const [id, a] of roster) {
    if (!a.running) continue;
    const entry = list.find((x) => typeof x === 'object' && x !== null && x[LIST_ID_KEY] === id);
    if (entry === undefined || (typeof entry.status === 'string' && entry.status !== 'running')) {
      a.running = false;
      a.durationMs = now - a.startTime;
      a.endTime = now;
    }
  }
  ensureTick($);
}

// One `show` refresh after an accord agent ends, debounced 3 seconds so a burst of agents costs one run.
function scheduleTicketRefresh($) {
  if (ticket === undefined) return;
  debounce?.cancel();
  try {
    debounce = $.clock.after(3000, async () => {
      debounce = undefined;
      const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
      if (pane?.isPlaced === true) void loadShow($, 'ticket');
      else if (pane) stale = true;
    });
  } catch {
    // a host without `$.clock`: refresh at once
    debounce = undefined;
    void loadShow($, 'ticket');
  }
}

let running = false;
let again = false;
// set when a turn completes while the pane is open but not drawn; the next draw refreshes
let stale = false;

async function refresh($) {
  if (running) {
    again = true;
    return;
  }
  running = true;
  try {
    do {
      again = false;
      try {
        state = outcome(await $.process.run(['npx', '--yes', 'ACCORD_PACKAGE_SPEC', 'dashboard', '--json'], { timeoutMs: 120000 }));
      } catch (err) {
        state = failure(err);
      }
      syncTicket($);
      await reconcile($);
      await invalidate($);
    } while (again);
  } finally {
    running = false;
  }
}

// Follows the dashboard's `current`: a new id starts its `show`, no id clears the ticket and the picked tab, a failed dashboard run keeps both.
function syncTicket($) {
  if (state?.dashboard === undefined) return;
  const id = currentOf(state);
  if (id === undefined) {
    if (ticket !== undefined) clearRoster($);
    ticket = undefined;
    picked = undefined;
    return;
  }
  if (ticket?.id === id) return;
  // Phase 08.8.1 W5: a change of ticket clears the roster, so the agents of the last ticket do not stay in the new one's block
  if (ticket !== undefined) clearRoster($);
  ticket = { id };
  void loadShow($, 'ticket');
}

function clearRoster($) {
  roster.clear();
  ensureTick($);
}

// Phase 08.8.1 IN-03: one single-flight loader for both `show` slots, the claimed ticket's and the open detail's.
const flights = { ticket: { running: false, again: false }, detail: { running: false, again: false } };
const slotOf = (slot) => (slot === 'ticket' ? ticket : detail);

// Runs `show` for the slot's id; a result for an id no longer held by the slot is dropped.
async function loadShow($, slot) {
  const flight = flights[slot];
  if (flight.running) {
    flight.again = true;
    return;
  }
  flight.running = true;
  try {
    do {
      flight.again = false;
      const id = slotOf(slot)?.id;
      if (id === undefined) break;
      let result;
      try {
        result = detailOutcome(await $.process.run(['npx', '--yes', 'ACCORD_PACKAGE_SPEC', 'show', id, '--json'], { timeoutMs: 120000 }));
      } catch (err) {
        result = failure(err);
      }
      const held = slotOf(slot);
      if (held?.id === id) held.state = result;
      await invalidate($);
    } while (flight.again);
  } finally {
    flight.running = false;
  }
}

// Phase 08.8.1 IN-03: the dashboard run first; the ticket's own `show` follows only when that run left the id unchanged, since a new id starts its show in `syncTicket`.
function refreshAll($) {
  const before = ticket?.id;
  void refresh($)
    .then(() => {
      if (ticket !== undefined && ticket.id === before) void loadShow($, 'ticket');
    })
    .catch(() => {});
  if (detail) void loadShow($, 'detail');
}

async function openDetail($, open) {
  detail = { id: open.id };
  const loading = loadShow($, 'detail'); // starts the run before the first redraw so a press runs it at once
  await invalidate($);
  await loading;
}

// D-06: the command exists on every surface, a headless session included; registered once per session.
async function ensureCommand($) {
  if (commandReady) return;
  commandReady = true;
  try {
    await $.command.register({ name: 'accord-panel', description: 'Open the accord pane' });
  } catch (err) {
    commandReady = false; // Phase 08.8.1 IN-01: a failed register is tried again at the next session event
    throw err;
  }
}

// Whether a desktop client is attached; the host's `$.session.surfaces()` lists the surfaces by name, and a host that cannot say counts as none.
async function desktopAttached($) {
  try {
    const list = await $.session.surfaces();
    return Array.isArray(list) && list.includes('desktop');
  } catch {
    return false;
  }
}

// Opens the pane unasked, once per session: the terminal's and the Desktop Code tab's session start and a desktop client's attach all come here.
// Phase 08.8.1 IN-01: `active` is set only after `$.ui.open` resolved, so a failed open is tried again at the next start; `opening` keeps two starts at once from opening twice.
let opening = false;
async function start($) {
  if (active || opening) return;
  opening = true;
  try {
    await readList($);
    await $.ui.open({ id: 'accord-panel', title: 'accord' });
    active = true;
  } finally {
    opening = false;
  }
  await guarded(async () => {
    const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
    if (pane && pane.isPlaced === false) $.ui.toast('Run /accord-panel to show the accord dashboard');
  });
  void refresh($);
}

export function register(on) {
  // D-06: every session start registers the command; only an interactive terminal or desktop client gets the pane opened unasked. A headless session pays nothing more.
  on('session.start', async ($, e, next) => {
    await guarded(async () => {
      await ensureCommand($);
      if (e.isInteractive === true && (e.surface === 'terminal' || e.surface === 'desktop')) await start($);
    });
    return next(e);
  });

  // D-06: a desktop client joins the running session through an attach, which the terminal's own binding does not raise
  on('session.attach', async ($, e, next) => {
    if (e.surface === 'desktop') {
      await guarded(async () => {
        await ensureCommand($);
        await start($);
      });
    }
    return next(e);
  });

  on('command.run', { command: 'accord-panel' }, async ($) => {
    await readList($);
    const opened = await $.ui.open({ id: 'accord-panel', title: 'accord', focus: true });
    active = true;
    const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
    if (pane && pane.isPlaced === false) {
      // with a desktop client attached the narrow terminal is not the likely cause: name the engine's own reason, cleaned (T-08.7-20)
      if (await desktopAttached($)) {
        const reason = typeof opened?.reason === 'string' ? clean(opened.reason) : '';
        $.ui.toast('The accord pane could not be placed here' + (reason === '' ? '' : ': ' + reason));
      } else $.ui.toast('The terminal is too narrow for the accord pane: it needs 110 columns');
    }
    void refresh($);
    return {};
  });

  // D-02: a subagent's turn start reads the agent list once, for the roster only; it runs no accord command
  on('turn.start', async ($, e, next) => {
    // Phase 08.8.1 L-06: a main-loop turn starting ends the waiting state
    if (typeof e.agentId !== 'string' && waiting !== undefined) {
      waiting = undefined;
      redraw($);
    }
    if (active && typeof e.agentId === 'string') await guarded(() => noteAgent($, e.agentId));
    return next(e);
  });

  // Phase 08.8.1 D-01, L-05, L-06 (probe rows P1, P2): the hook only records display state, in a try, and returns what the call returned with `e` unchanged. A subagent's call sets its row; a main-loop accord command schedules one debounced `show` refresh after it ran; an open AskUserQuestion call reads as waiting.
  on('tool.call', async ($, e, next) => {
    let asking;
    let refreshAfter = false;
    try {
      if (active && typeof e === 'object' && e !== null) {
        if (typeof e.agentId === 'string') noteTool($, e);
        else if (e.tool === 'AskUserQuestion') {
          asking = { since: Date.now() };
          waiting = asking;
          redraw($);
        } else refreshAfter = runsAccord(e);
      }
    } catch {
      // display only: a failed read of the call never reaches the call
    }
    try {
      return await next(e);
    } finally {
      try {
        if (asking !== undefined && waiting === asking) {
          waiting = undefined;
          redraw($);
        }
        if (refreshAfter) scheduleTicketRefresh($);
      } catch {
        // display only
      }
    }
  });

  on('turn.complete', async ($, e, next) => {
    await guarded(async () => {
      const agent = typeof e.agentId === 'string' ? roster.get(e.agentId) : undefined;
      if (agent !== undefined) {
        // an accord agent ended: keep its own time (the list entry may be gone by now), then one debounced ticket refresh
        const now = Date.now();
        agent.running = false;
        agent.durationMs = typeof e.durationMs === 'number' ? e.durationMs : now - agent.startTime;
        agent.endTime = now;
        ensureTick($);
        scheduleTicketRefresh($);
        await invalidate($);
        return;
      }
      // Phase 08.8.1 L-06 (probe row P8): the main loop's turn ended, so it waits for the person; the last line of its answer is kept when the host sent one
      if (active && typeof e.agentId !== 'string') waiting = { since: Date.now(), line: answerLine(e.answer) };
      // Phase 08.8.1 W5: the roster follows the host's list at each main-loop turn end
      if (typeof e.agentId !== 'string') await reconcile($);
      const pane = e.agentId ? undefined : (await $.ui.panes()).find((p) => p.id === 'accord-panel');
      if (pane?.isPlaced === true) {
        redraw($);
        refreshAll($);
      } else if (pane) stale = true;
    });
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'accord-panel') return next(e);
    if (stale) {
      stale = false;
      refreshAll($);
    }
    const { Box, Text, Button, Input, Progress } = $.ui.resolve(e);
    // D-06: where desktop shows the pane as a widget, clicks may not reach it: the two tab summaries (or the hint and the dashboard summary) as text, no Button
    const widget = e.props?.placement === 'widget';
    ensureTick($, widget);
    if (widget) return Box({ flexDirection: 'column', children: widgetView({ state, ticket, running: runningAgents() }).map((line) => Text({ children: [line] })) });
    const children = [];
    const run = (action) => () => void $.command.run({ command: action.command, args: action.args });
    // D-03: the ticket tab shows while a ticket is in flight, unless the person picked the dashboard; with none in flight the pane is the dashboard alone
    const tab = shownTab();
    const pick = (which) => () => {
      picked = which;
      void $.ui.invalidate('ui.render');
    };
    if (ticket !== undefined) {
      const labels = tabLabels({ state, ticket, running: runningAgents() });
      const t = labels.ticket;
      const ticketParts = [Text({ bold: true, children: ['1 ticket'] }), Text({ children: [' ' + t.id] })];
      if (t.stage !== '') ticketParts.push(Text({ ...(t.stageColor ? { color: t.stageColor } : {}), children: [' ' + t.stage + (t.review ? ' ' + t.review : '')] }));
      if (t.running) ticketParts.push(Text({ color: 'merged', children: [' ◐' + t.running] }));
      if (t.failed) ticketParts.push(Text({ color: 'red', children: [' gate failed'] }));
      const dashParts = [Text({ bold: true, children: ['2 dashboard'] })];
      if (labels.dashboard.summary !== '') dashParts.push(Text({ dimColor: true, children: [' ' + labels.dashboard.summary] }));
      // both tab Buttons keep their hotkeys on both tabs and neither takes focus by itself
      children.push(
        Box({
          flexDirection: 'row',
          columnGap: 2,
          children: [
            Button({ key: 'tab:ticket', hotkey: '1', variant: tab === 'ticket' ? 'primary' : 'secondary', label: t.label, onPress: pick('ticket'), children: ticketParts }),
            Button({ key: 'tab:dashboard', hotkey: '2', variant: tab === 'dashboard' ? 'primary' : 'secondary', label: labels.dashboard.label, onPress: pick('dashboard'), children: dashParts }),
          ],
        }),
      );
    }
    if (tab === 'ticket') {
      const nowMs = Date.now();
      const viewArgs = { ticket, now: Math.floor(nowMs / 1000), nowMs, agents: [...roster].map(([key, a]) => ({ key, ...a })), waiting };
      const tv = ticketView(viewArgs);
      // Phase 08.8.1 L-07: the rows drawn above the LOG block, counted as the blocks are built (a tab row, a bordered block is its rows plus two borders and a heading), so the log can take the rows the pane has left
      let used = ticket !== undefined ? 1 : 0;
      if (tv.message) {
        for (const line of tv.message) children.push(Text({ children: [line] }));
      } else {
        const narrow = layoutOf(e.props?.bodyColumns) === 'narrow';
        const cellBox = (c) => {
          const filled = c.state === 'done' || c.state === 'current';
          // Phase 08.8.1 W3: a filled cell at narrow holds a one-space Text, since an empty Box can collapse to no height (engine-dependent) and the track would lose its line at the last stage
          const label = narrow ? (filled ? [Text({ children: [' '] })] : [Text({ dimColor: true, children: ['·'] })]) : [Text({ ...(c.state === 'current' ? { bold: true } : {}), ...(filled ? {} : { dimColor: true }), children: [c.text] })];
          return Box({ paddingX: 1, flexShrink: 0, ...(filled ? { backgroundColor: c.color } : {}), children: label });
        };
        children.push(
          Box({
            flexDirection: 'column',
            borderStyle: 'round',
            borderColor: 'claude',
            children: [
              Text({ bold: true, wrap: 'truncate', children: [tv.title] }),
              // Phase 08.8.1 D-05: the CLI's not-committed line takes the stage track's place; D-02: a plan-changed line goes right under the track
              ...(tv.notCommitted === undefined
                ? [Box({ flexDirection: 'row', columnGap: 1, children: tv.cells.map(cellBox) })]
                : [Text({ bold: true, color: 'warning', wrap: 'wrap', children: [tv.notCommitted] })]),
              ...(narrow && tv.current !== undefined ? [Text({ children: [tv.current] })] : []),
              ...(tv.planChanged === undefined ? [] : [Text({ bold: true, color: 'warning', wrap: 'wrap', children: [tv.planChanged] })]),
            ],
          }),
        );
        used += 3 + (tv.planChanged === undefined ? 0 : 1) + (narrow && tv.current !== undefined ? 1 : 0) + (tv.now ?? []).length;
        // Phase 08.8.1 L-06: the NOW lines right under the head, the first bold and the second dimmed
        for (const [i, l] of (tv.now ?? []).entries()) children.push(Text({ ...(i === 0 ? { bold: true } : { dimColor: true }), wrap: 'truncate', children: [l.text] }));
        // D-04: below the head, in order: the failure box, the review rounds, the criteria checklist and the session log. Nothing here names context, tokens or cost (D-08).
        const block = (heading, rows) => {
          used += 3 + rows.length;
          return Box({ flexDirection: 'column', borderStyle: 'round', children: [Text({ bold: true, children: [heading] }), ...rows] });
        };
        const widest = (list) => Math.max(...list.map((x) => [...x].length));
        // Phase 08.8.1 L-07: the plan's tasks under the NOW lines, with the build bar (a text count where the engine has no Progress); a not-committed ticket has neither key
        if (tv.tasks) {
          const bar =
            tv.progress === undefined
              ? []
              : typeof Progress === 'function'
                ? [Progress({ label: 'build tasks done', ...tv.progress, color: 'green' })]
                : [Text({ children: [tv.progress.valueText] })];
          const taskBoxes = tv.tasks.map((r) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Text({ ...(r.state === 'done' ? { color: 'green' } : r.state === 'current' ? { bold: true } : { dimColor: true }), children: [r.mark] }),
                Text({ dimColor: r.state === 'todo', children: [String(r.n)] }),
                Box({ flexGrow: 1, flexShrink: 1, children: [Text({ wrap: 'truncate', ...(r.state === 'current' ? { bold: true } : {}), ...(r.state === 'todo' ? { dimColor: true } : {}), children: [r.title] })] }),
              ],
            }),
          );
          children.push(block('TASKS', [...bar, ...taskBoxes]));
        }
        if (tv.failure) {
          used += 4;
          children.push(
            Box({
              flexDirection: 'column',
              borderStyle: 'round',
              borderColor: 'red',
              children: [Text({ bold: true, color: 'red', children: ['Gate failed'] }), Text({ wrap: 'wrap', children: [tv.failure.text] })],
            }),
          );
        }
        // D-01, D-02: the accord agents running now and finished ones, from subagent events; drawn only where the host has an agent list
        if (listing) {
          const agents = agentRows(
            [...roster].map(([key, a]) => ({ key, ...a })),
            Date.now(),
          );
          const rows = agents.map((a) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Text({ color: a.running ? 'merged' : 'green', children: [(a.running ? '◐ ' : '✓ ') + a.name] }),
                Text({ dimColor: true, children: [a.time] }),
                // Phase 08.8.1 L-06: the task the mod saw the agent read or write a report for
                ...(a.task === undefined ? [] : [Text({ dimColor: true, children: ['task ' + a.task] })]),
              ],
            }),
          );
          used += 3 + Math.max(rows.length, 1);
          children.push(
            Box({
              flexDirection: 'column',
              borderStyle: 'round',
              borderColor: 'merged',
              children: [Text({ bold: true, children: ['AGENTS'] }), ...(rows.length > 0 ? rows : [Text({ dimColor: true, children: ['none running'] })])],
            }),
          );
        }
        if (tv.review) {
          const rounds = tv.review.rounds.map((r) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [Text({ bold: true, children: [r.head] }), ...r.parts.map((p) => Text({ children: [p] })), ...(r.security ? [Text({ dimColor: true, children: [r.security] })] : [])],
            }),
          );
          children.push(block(tv.review.heading, rounds));
        }
        if (tv.criteria) {
          const idWidth = widest(tv.criteria.map((c) => c.id));
          const rows = tv.criteria.map((c) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Box({ width: idWidth, flexShrink: 0, children: [Text({ bold: true, children: [c.id] })] }),
                // Phase 08.8.1 L-07: no flexGrow, so the label and the verifier cell follow the title and do not sit at the far right
                Box({ flexShrink: 1, children: [Text({ wrap: 'truncate', children: [c.title] })] }),
                Box({
                  flexShrink: 0,
                  flexDirection: 'row',
                  columnGap: 1,
                  children: [
                    Text({ ...(c.color === 'dim' ? { dimColor: true } : { color: c.color }), children: [c.label] }),
                    // Phase 08.8.1 D-06: the verifier's result beside the label
                    ...(c.verification ? [Text({ color: c.verification.color, children: [c.verification.text] })] : []),
                  ],
                }),
              ],
            }),
          );
          children.push(block('CRITERIA', rows));
        }
        if (tv.log) {
          // Phase 08.8.1 L-07: the log takes the rows the pane's room leaves (its own three rows of border and heading come off); no usable number keeps the eight lines
          const bodyRows = e.props?.scroll?.bodyRows;
          const logs = typeof bodyRows === 'number' ? ticketView({ ...viewArgs, room: bodyRows - used - 3 }).log : tv.log;
          const ageWidth = widest(logs.map((l) => l.age));
          const rows = logs.map((l) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Box({ width: ageWidth, flexShrink: 0, children: [Text({ dimColor: true, children: [l.age] })] }),
                // Phase 08.8.1 L-07: the newest line bold and undimmed, a repeated line with its count
                Box({ flexGrow: 1, flexShrink: 1, children: [Text({ wrap: 'truncate', ...(l.fail ? { color: 'red' } : {}), ...(l.newest ? { bold: true } : {}), children: [l.count > 1 ? `${l.text} ×${l.count}` : l.text] })] }),
              ],
            }),
          );
          children.push(block('LOG', rows));
        }
      }
      return Box({ flexDirection: 'column', children });
    }
    if (detail) {
      const d = detailView({ ...detail, action: actionFor(state, detail.id) });
      const bar = [
        Button({
          key: d.back.key,
          label: d.back.label,
          onPress: () => {
            detail = undefined;
            void $.ui.invalidate('ui.render');
          },
        }),
      ];
      if (d.action) bar.push(Button({ key: d.action.key, label: d.action.label, onPress: run(d.action) }));
      children.push(Box({ flexDirection: 'row', columnGap: 2, children: bar }));
      const wrapped = (props, text) => Text({ wrap: 'wrap', ...props, children: [text] });
      if (d.message) {
        for (const line of d.message) children.push(wrapped({}, line));
      } else {
        children.push(wrapped({ bold: true }, d.title));
        for (const f of d.facts) children.push(wrapped({}, f));
        children.push(Box({ marginTop: 1, flexDirection: 'column', children: [wrapped({ bold: true, color: 'cyan' }, 'Intent'), ...d.intent.map((l) => wrapped({}, l))] }));
        for (const c of d.criteria) {
          children.push(
            Box({
              marginTop: 1,
              flexDirection: 'column',
              children: [wrapped({ bold: true }, c.head), ...c.steps.map((st) => wrapped({}, st)), ...c.facts.map((f) => wrapped({ dimColor: true }, f))],
            }),
          );
        }
      }
      return Box({ flexDirection: 'column', children });
    }
    const v = view(state, query, e.props?.bodyColumns);
    // A drawn Input holds its value until the next draw, so every draw passes the stored text.
    const search = () =>
      Input({
        key: 'search',
        label: 'Search',
        placeholder: 'ticket id or title, or a new request',
        // A-04 (probe row A4 `keys: field takes digits`): while a ticket is in flight the tab keys 1 and 2 exist, so the field takes focus only when clicked
        ...(ticket === undefined ? { autoFocus: true } : {}),
        value: query,
        onInput: (text) => {
          query = text;
          void $.ui.invalidate('ui.render');
        },
        onSubmit: () => {},
      });
    if (v.message) {
      if (state === undefined) children.push(search());
      for (const line of v.message) children.push(Text({ children: [line] }));
    } else {
      if (v.hint) children.push(Text({ dimColor: true, children: [v.hint] }));
      children.push(search());
      if (v.noMatch) children.push(Text({ children: [v.noMatch] }));
      if (v.newRequest) children.push(Button({ key: v.newRequest.key, label: v.newRequest.label, onPress: run(v.newRequest) }));
      const { widths, layout } = v;
      // D-03, D-05: the columns follow the width the pane reports: wide ID, bar, lane, stage, title; mid drops the lane; narrow drops the stage text too
      const withLane = layout === 'wide';
      const withStage = layout !== 'narrow';
      const cellBoxes = (id, bar, lane, stage, title) => [
        Box({ width: widths.id, flexShrink: 0, children: [id] }),
        bar,
        ...(withLane ? [Box({ width: widths.lane, flexShrink: 0, children: [lane] })] : []),
        ...(withStage ? [Box({ width: widths.stage, flexShrink: 0, children: [stage] })] : []),
        Box({ flexGrow: 1, flexShrink: 1, children: [title] }),
      ];
      const line = (kids) => Box({ flexDirection: 'row', columnGap: 2, children: kids });
      // one 1-column Box per stage cell, coloured for done and current cells; a one-space Text gives each cell its line, so an empty Box cannot collapse to no height
      const barBox = (r) =>
        Box({
          width: widths.bar,
          flexShrink: 0,
          flexDirection: 'row',
          children: (r.bar ?? []).map((c) =>
            Box({ width: 1, flexShrink: 0, ...(c.state === 'done' || c.state === 'current' ? { backgroundColor: c.color } : {}), children: [Text({ children: [' '] })] }),
          ),
        });
      // an epic's progress spans the bar and lane columns (the bar column alone when the lane is dropped); an engine without Progress, or an epic with no children, shows the count as text
      const progressBox = (r) => {
        const span = widths.bar + (withLane ? widths.lane + 2 : 0);
        const p = r.progress;
        if (p === undefined) return Box({ width: span, flexShrink: 0, children: [] });
        if (typeof Progress === 'function' && p.max > 0) return Box({ width: span, flexShrink: 0, children: [Progress({ ...p, color: 'green' })] });
        return Box({ width: Math.max(span, [...p.valueText].length), flexShrink: 0, children: [Text({ children: [p.valueText] })] });
      };
      for (const s of v.sections) {
        const body = [Text({ bold: true, color: 'cyan', children: [s.heading] })];
        if (s.rows.length > 0) {
          const header = ['ID', 'LANE', 'STAGE', 'TITLE'].map((w) => Text({ dimColor: true, children: [w] }));
          body.push(line(cellBoxes(header[0], Box({ width: widths.bar, flexShrink: 0 }), header[1], header[2], header[3])));
        }
        for (const r of s.rows) {
          const stage = Text({ children: [r.stage], ...(r.stageColor ? { color: r.stageColor } : {}) });
          const idCell = r.open
            ? Button({
                key: r.open.key,
                label: r.open.id,
                plain: true,
                // the id of the ticket in flight shows its tab instead of opening a detail (D-03)
                onPress: r.open.id === ticket?.id ? pick('ticket') : () => void openDetail($, r.open),
                children: [Text({ bold: true, underline: true, color: 'suggestion', children: [r.id] })],
              })
            : Text({ bold: true, children: [r.id] });
          const epic = s.heading === 'EPICS';
          const kids = cellBoxes(idCell, epic ? progressBox(r) : barBox(r), Text({ children: [r.lane] }), stage, Text({ wrap: 'truncate', children: [r.title] }));
          // an epic's progress box already spans the lane column, so the lane cell leaves the epic row
          if (epic && withLane) kids.splice(2, 1);
          body.push(line(kids));
          if (r.blockedBy || r.who) {
            const sub = [Box({ width: widths.id, flexShrink: 0 })];
            if (r.blockedBy) sub.push(Text({ color: 'red', children: [r.blockedBy] }));
            if (r.who) sub.push(Text({ dimColor: true, children: [r.who] }));
            body.push(line(sub));
          }
        }
        if (s.rows.length === 0) body.push(Text({ dimColor: true, children: ['none'] }));
        if (s.more > 0) body.push(Text({ dimColor: true, children: ['+' + s.more + ' more'] }));
        children.push(Box({ marginTop: 1, flexDirection: 'column', borderStyle: 'round', paddingX: 1, children: body }));
      }
      children.push(Text({ dimColor: true, children: [v.summary] }));
    }
    return Box({ flexDirection: 'column', children });
  });
}

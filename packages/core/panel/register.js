import { actionFor, agentRows, currentOf, detailOutcome, detailView, failure, isAccordAgent, layoutOf, outcome, tabLabels, ticketView, view } from './view.js';

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
// Phase 08.7 D-01, D-02: the accord agents this mod saw start, `agentId` -> `{ type, startTime, running, durationMs?, endTime? }`; display only, never a label or a description
const roster = new Map();
let tick;
let debounce;
// whether the host's `$.agent.list()` answered with a list at its last call; the agents block is drawn only then. The host's nouns are only ever called (a call that throws means the host lacks the noun), never read as values.
let listing = false;

const shownTab = () => (ticket === undefined ? 'dashboard' : (picked ?? 'ticket'));
const runningAgents = () => [...roster.values()].filter((a) => a.running).length;

// One 1-second redraw timer while an accord agent runs and the ticket tab is shown; cancelled when none runs or another tab shows. A host without `$.clock` gets no timer.
function ensureTick($) {
  const want = shownTab() === 'ticket' && runningAgents() > 0;
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
    if (was !== listing) await $.ui.invalidate('ui.render');
    return;
  }
  roster.set(agentId, { type: entry.type, startTime: typeof entry.startTime === 'number' ? entry.startTime : Date.now(), running: true });
  trimRoster();
  ensureTick($);
  await $.ui.invalidate('ui.render');
}

// One `show` refresh after an accord agent ends, debounced 3 seconds so a burst of agents costs one run.
function scheduleTicketRefresh($) {
  if (ticket === undefined) return;
  debounce?.cancel();
  try {
    debounce = $.clock.after(3000, async () => {
      debounce = undefined;
      const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
      if (pane?.isPlaced === true) void loadTicket($);
      else if (pane) stale = true;
    });
  } catch {
    // a host without `$.clock`: refresh at once
    debounce = undefined;
    void loadTicket($);
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
      await $.ui.invalidate('ui.render');
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
    ticket = undefined;
    picked = undefined;
    return;
  }
  if (ticket?.id === id) return;
  ticket = { id };
  void loadTicket($);
}

let ticketRunning = false;
let ticketAgain = false;

// Runs `show` for the claimed ticket; a result for an id no longer current is dropped.
async function loadTicket($) {
  if (ticketRunning) {
    ticketAgain = true;
    return;
  }
  ticketRunning = true;
  try {
    do {
      ticketAgain = false;
      const id = ticket?.id;
      if (id === undefined) break;
      let result;
      try {
        result = detailOutcome(await $.process.run(['npx', '--yes', 'ACCORD_PACKAGE_SPEC', 'show', id, '--json'], { timeoutMs: 120000 }));
      } catch (err) {
        result = failure(err);
      }
      if (ticket?.id === id) ticket.state = result;
      await $.ui.invalidate('ui.render');
    } while (ticketAgain);
  } finally {
    ticketRunning = false;
  }
}

let detailRunning = false;
let detailAgain = false;

// Runs `show` for the open ticket; a result for a ticket no longer open is dropped.
async function loadDetail($) {
  if (detailRunning) {
    detailAgain = true;
    return;
  }
  detailRunning = true;
  try {
    do {
      detailAgain = false;
      const id = detail?.id;
      if (id === undefined) break;
      let result;
      try {
        result = detailOutcome(await $.process.run(['npx', '--yes', 'ACCORD_PACKAGE_SPEC', 'show', id, '--json'], { timeoutMs: 120000 }));
      } catch (err) {
        result = failure(err);
      }
      if (detail?.id === id) detail.state = result;
      await $.ui.invalidate('ui.render');
    } while (detailAgain);
  } finally {
    detailRunning = false;
  }
}

async function openDetail($, open) {
  detail = { id: open.id };
  const loading = loadDetail($); // starts the run before the first redraw so a press runs it at once
  await $.ui.invalidate('ui.render');
  await loading;
}

async function start($) {
  active = true;
  await readList($);
  await $.command.register({ name: 'accord-panel', description: 'Open the accord dashboard pane' });
  await $.ui.open({ id: 'accord-panel', title: 'accord' });
  const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
  if (pane && pane.isPlaced === false) $.ui.toast('Run /accord-panel to show the accord dashboard');
  void refresh($);
}

export function register(on) {
  on('session.start', async ($, e, next) => {
    if (e.isInteractive === true && e.surface === 'terminal') await start($);
    return next(e);
  });

  on('command.run', { command: 'accord-panel' }, async ($) => {
    active = true;
    await readList($);
    await $.ui.open({ id: 'accord-panel', title: 'accord', focus: true });
    const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
    if (pane && pane.isPlaced === false) $.ui.toast('The terminal is too narrow for the accord pane: it needs 110 columns');
    void refresh($);
    return {};
  });

  // D-02: a subagent's turn start reads the agent list once, for the roster only; it runs no accord command
  on('turn.start', async ($, e, next) => {
    if (active && typeof e.agentId === 'string') await noteAgent($, e.agentId);
    return next(e);
  });

  on('turn.complete', async ($, e, next) => {
    const agent = typeof e.agentId === 'string' ? roster.get(e.agentId) : undefined;
    if (agent !== undefined) {
      // an accord agent ended: keep its own time (the list entry may be gone by now), then one debounced ticket refresh
      const now = Date.now();
      agent.running = false;
      agent.durationMs = typeof e.durationMs === 'number' ? e.durationMs : now - agent.startTime;
      agent.endTime = now;
      ensureTick($);
      scheduleTicketRefresh($);
      await $.ui.invalidate('ui.render');
      return next(e);
    }
    const pane = e.agentId ? undefined : (await $.ui.panes()).find((p) => p.id === 'accord-panel');
    if (pane?.isPlaced === true) {
      void refresh($);
      if (detail) void loadDetail($);
      if (ticket) void loadTicket($);
    } else if (pane) stale = true;
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'accord-panel') return next(e);
    if (stale) {
      stale = false;
      void refresh($);
      if (detail) void loadDetail($);
      if (ticket) void loadTicket($);
    }
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const children = [];
    const run = (action) => () => void $.command.run({ command: action.command, args: action.args });
    // D-03: the ticket tab shows while a ticket is in flight, unless the person picked the dashboard; with none in flight the pane is the dashboard alone
    const tab = shownTab();
    ensureTick($);
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
      const tv = ticketView({ ticket, now: Math.floor(Date.now() / 1000) });
      if (tv.message) {
        for (const line of tv.message) children.push(Text({ children: [line] }));
      } else {
        const narrow = layoutOf(e.props?.bodyColumns) === 'narrow';
        const cellBox = (c) => {
          const filled = c.state === 'done' || c.state === 'current';
          const label = narrow ? (filled ? [] : [Text({ dimColor: true, children: ['·'] })]) : [Text({ ...(c.state === 'current' ? { bold: true } : {}), ...(filled ? {} : { dimColor: true }), children: [c.text] })];
          return Box({ paddingX: 1, flexShrink: 0, ...(filled ? { backgroundColor: c.color } : {}), children: label });
        };
        children.push(
          Box({
            flexDirection: 'column',
            borderStyle: 'round',
            borderColor: 'claude',
            children: [
              Text({ bold: true, wrap: 'truncate', children: [tv.title] }),
              Box({ flexDirection: 'row', columnGap: 1, children: tv.cells.map(cellBox) }),
              ...(narrow && tv.current !== undefined ? [Text({ children: [tv.current] })] : []),
            ],
          }),
        );
        // D-04: below the head, in order: the failure box, the review rounds, the criteria checklist and the session log. Nothing here names context, tokens or cost (D-08).
        const block = (heading, rows) => Box({ flexDirection: 'column', borderStyle: 'round', children: [Text({ bold: true, children: [heading] }), ...rows] });
        const widest = (list) => Math.max(...list.map((x) => [...x].length));
        if (tv.failure) {
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
              children: [Text({ color: a.running ? 'merged' : 'green', children: [(a.running ? '◐ ' : '✓ ') + a.name] }), Text({ dimColor: true, children: [a.time] })],
            }),
          );
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
                Box({ flexGrow: 1, flexShrink: 1, children: [Text({ wrap: 'truncate', children: [c.title] })] }),
                Box({ flexShrink: 0, children: [Text({ ...(c.color === 'dim' ? { dimColor: true } : { color: c.color }), children: [c.label] })] }),
              ],
            }),
          );
          children.push(block('CRITERIA', rows));
        }
        if (tv.log) {
          const ageWidth = widest(tv.log.map((l) => l.age));
          const rows = tv.log.map((l) =>
            Box({
              flexDirection: 'row',
              columnGap: 1,
              children: [
                Box({ width: ageWidth, flexShrink: 0, children: [Text({ dimColor: true, children: [l.age] })] }),
                Box({ flexGrow: 1, flexShrink: 1, children: [Text({ wrap: 'truncate', ...(l.fail ? { color: 'red' } : {}), children: [l.text] })] }),
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
    const v = view(state, query);
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
      const { widths } = v;
      const cellBoxes = (id, lane, stage, title) => [
        Box({ width: widths.id, flexShrink: 0, children: [id] }),
        Box({ width: widths.lane, flexShrink: 0, children: [lane] }),
        Box({ width: widths.stage, flexShrink: 0, children: [stage] }),
        Box({ flexGrow: 1, flexShrink: 1, children: [title] }),
      ];
      const line = (kids) => Box({ flexDirection: 'row', columnGap: 2, children: kids });
      for (const s of v.sections) {
        children.push(Box({ marginTop: 1, children: [Text({ bold: true, color: 'cyan', children: [s.heading] })] }));
        if (s.rows.length > 0) {
          children.push(line(cellBoxes(...['ID', 'LANE', 'STAGE', 'TITLE'].map((w) => Text({ dimColor: true, children: [w] })))));
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
          const kids = cellBoxes(idCell, Text({ children: [r.lane] }), stage, Text({ wrap: 'truncate', children: [r.title] }));
          children.push(line(kids));
          if (r.blockedBy || r.who) {
            const sub = [Box({ width: widths.id, flexShrink: 0 })];
            if (r.blockedBy) sub.push(Text({ color: 'red', children: [r.blockedBy] }));
            if (r.who) sub.push(Text({ dimColor: true, children: [r.who] }));
            children.push(line(sub));
          }
        }
        if (s.rows.length === 0) children.push(Text({ dimColor: true, children: ['none'] }));
        if (s.more > 0) children.push(Text({ dimColor: true, children: ['+' + s.more + ' more'] }));
      }
      children.push(Text({ dimColor: true, children: [v.summary] }));
    }
    return Box({ flexDirection: 'column', children });
  });
}

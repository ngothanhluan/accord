import { actionFor, detailOutcome, detailView, failure, outcome, view } from './view.js';

let state;
let query = '';
// the open ticket detail, undefined while the dashboard shows
let detail;

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
      await $.ui.invalidate('ui.render');
    } while (again);
  } finally {
    running = false;
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
    await $.ui.open({ id: 'accord-panel', title: 'accord', focus: true });
    const pane = (await $.ui.panes()).find((p) => p.id === 'accord-panel');
    if (pane && pane.isPlaced === false) $.ui.toast('The terminal is too narrow for the accord pane: it needs 110 columns');
    void refresh($);
    return {};
  });

  on('turn.complete', async ($, e, next) => {
    const pane = e.agentId ? undefined : (await $.ui.panes()).find((p) => p.id === 'accord-panel');
    if (pane?.isPlaced === true) {
      void refresh($);
      if (detail) void loadDetail($);
    } else if (pane) stale = true;
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'accord-panel') return next(e);
    if (stale) {
      stale = false;
      void refresh($);
      if (detail) void loadDetail($);
    }
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const children = [];
    const run = (args) => () => void $.command.run({ command: 'accord', args });
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
      if (d.action) bar.push(Button({ key: d.action.key, label: d.action.label, onPress: run(d.action.args) }));
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
    if (v.message) {
      for (const line of v.message) children.push(Text({ children: [line] }));
    } else {
      // A drawn Input holds its value until the next draw, so every draw passes the stored text.
      children.push(
        Input({
          key: 'search',
          label: 'Search',
          value: query,
          onInput: (text) => {
            query = text;
            void $.ui.invalidate('ui.render');
          },
          onSubmit: () => {},
        }),
      );
      if (v.newRequest) children.push(Button({ key: v.newRequest.key, label: v.newRequest.label, onPress: run(v.newRequest.args) }));
      const { widths } = v;
      const cellBoxes = (id, stage, title) => [
        Box({ width: widths.id, flexShrink: 0, children: [id] }),
        Box({ width: widths.stage, flexShrink: 0, children: [stage] }),
        Box({ flexGrow: 1, flexShrink: 1, children: [title] }),
      ];
      const line = (kids) => Box({ flexDirection: 'row', columnGap: 2, children: kids });
      for (const s of v.sections) {
        children.push(Box({ marginTop: 1, children: [Text({ bold: true, color: 'cyan', children: [s.heading] })] }));
        if (s.rows.length > 0) {
          children.push(line(cellBoxes(...['ID', 'STAGE', 'TITLE'].map((w) => Text({ dimColor: true, children: [w] })))));
        }
        for (const r of s.rows) {
          const stage = Text({ children: [r.stage], ...(r.stageColor ? { color: r.stageColor } : {}) });
          const idCell = r.open
            ? Button({
                key: r.open.key,
                label: r.open.id,
                plain: true,
                onPress: () => void openDetail($, r.open),
                children: [Text({ bold: true, underline: true, color: 'suggestion', children: [r.id] })],
              })
            : Text({ bold: true, children: [r.id] });
          const kids = cellBoxes(idCell, stage, Text({ wrap: 'truncate', children: [r.title] }));
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

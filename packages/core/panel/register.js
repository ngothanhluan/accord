import { failure, outcome, view } from './view.js';

let state;
let query = '';

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
    if (pane?.isPlaced === true) void refresh($);
    else if (pane) stale = true;
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'accord-panel') return next(e);
    if (stale) {
      stale = false;
      void refresh($);
    }
    const { Box, Text, Button, Input } = $.ui.resolve(e);
    const v = view(state, query);
    const children = [];
    const run = (args) => () => void $.command.run({ command: 'accord', args });
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
          const kids = cellBoxes(Text({ bold: true, children: [r.id] }), stage, Text({ wrap: 'truncate', children: [r.title] }));
          if (r.action) kids.push(Box({ flexShrink: 0, children: [Button({ key: r.action.key, label: r.action.label, onPress: run(r.action.args) })] }));
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

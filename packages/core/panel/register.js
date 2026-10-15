import { outcome, view } from './view.js';

let state;
let query = '';

async function refresh($) {
  const result = await $.process.run(['npx', '--yes', 'ACCORD_PACKAGE_SPEC', 'dashboard', '--json'], { timeoutMs: 120000 });
  state = outcome(result);
  $.ui.invalidate('ui.render');
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
    void refresh($);
    return {};
  });

  on('turn.complete', async ($, e, next) => {
    if (!e.agentId) void refresh($);
    return next(e);
  });

  on('ui.render', { component: 'Pane' }, async ($, e, next) => {
    if (e.requestId !== 'accord-panel') return next(e);
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
      for (const s of v.sections) {
        children.push(Text({ children: [s.heading] }));
        for (const r of s.rows) {
          const t = Text({ children: [r.text] });
          children.push(r.action ? Box({ flexDirection: 'row', children: [t, Button({ key: r.action.key, label: r.action.label, onPress: run(r.action.args) })] }) : t);
        }
        if (s.rows.length === 0) children.push(Text({ children: ['none'] }));
        if (s.more > 0) children.push(Text({ children: ['+' + s.more + ' more'] }));
      }
      children.push(Text({ children: [v.summary] }));
    }
    return Box({ flexDirection: 'column', children });
  });
}

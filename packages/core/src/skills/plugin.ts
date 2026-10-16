// The Claude Code pane as a plugin directory marketplace written into the repository. Pure: the panel
// sources are generated data, and the package identity arrives as an argument (core never reads package.json).
import { panel } from '../generated/panel.js';
import { stamp } from './render.js';
import type { AccordConfig } from '../model/snapshot.js';
import type { SkillFile } from './targets.js';

export const pluginDir = '.claude/accord-panel';

const SPEC = 'ACCORD_PACKAGE_SPEC';
const json = (value: unknown): string => stamp('{\n', JSON.stringify(value, null, 2).slice(2) + '\n', 'json');

/** The five plugin files, sorted by path; empty unless the claude runtime is declared. */
export function pluginTargets(config: Pick<AccordConfig, 'runtimes'>, pkg: { name: string; version: string }): SkillFile[] {
  if (!config.runtimes.includes('claude')) return [];
  if (!panel['register.js'].includes(SPEC)) throw new Error('panel/register.js lacks ' + SPEC);
  const files: SkillFile[] = [
    {
      path: `${pluginDir}/.claude-plugin/marketplace.json`,
      text: json({
        name: 'accord',
        owner: { name: 'accord' },
        plugins: [{ name: 'accord-panel', source: './plugin', description: 'The accord dashboard in a Claude Code pane' }],
      }),
    },
    { path: `${pluginDir}/plugin/.claude-plugin/plugin.json`, text: json({ name: 'accord-panel', version: pkg.version, author: { name: 'accord' } }) },
    { path: `${pluginDir}/plugin/hooks/hooks.json`, text: json({ modules: ['./register.js'] }) },
    {
      path: `${pluginDir}/plugin/hooks/register.js`,
      text: stamp('', panel['register.js'].replaceAll(SPEC, `${pkg.name}@${pkg.version}`), 'js'),
    },
    { path: `${pluginDir}/plugin/hooks/view.js`, text: stamp('', panel['view.js'], 'js') },
  ];
  return files.sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
}

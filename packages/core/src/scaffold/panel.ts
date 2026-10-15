// The two settings keys that enable the Claude Code panel plugin (see skills/plugin.ts for the files).
import { pluginDir } from '../skills/plugin.js';

export const panelSettings = {
  extraKnownMarketplaces: { accord: { source: { source: 'directory', path: './' + pluginDir } } },
  enabledPlugins: { 'accord-panel@accord': true },
};

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/**
 * Adds the marketplace and the enabled flag when absent; an existing key keeps its value (an owner's `false`
 * stays). Copies the two maps rather than writing into the parsed ones; every other key and the order survive.
 */
export function mergePanel(existing: Record<string, unknown>): Record<string, unknown> {
  const { extraKnownMarketplaces: m, enabledPlugins: p } = existing;
  if ((m !== undefined && !isObject(m)) || (p !== undefined && !isObject(p))) throw new TypeError('settings is not a JSON object');
  return {
    ...existing,
    extraKnownMarketplaces: { ...panelSettings.extraKnownMarketplaces, ...m },
    enabledPlugins: { ...panelSettings.enabledPlugins, ...p },
  };
}

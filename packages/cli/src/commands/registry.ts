// ST-LN-25: the registry request stands alone so a test can mock it; vi.mock cannot swap a binding used inside its own module (see fetch-limit.ts).
import { homedir } from 'node:os';
import { join } from 'node:path';

export const REGISTRY_MS = 3000;

export async function requestLatest(name: string): Promise<string | undefined> {
  try {
    // shortcut: Node's fetch ignores HTTPS_PROXY on Node 22, so a machine that reaches npm only through a proxy never sees the notice; upgrade when the engines floor reaches a Node whose fetch honours the proxy variables
    const res = await fetch(`https://registry.npmjs.org/-/package/${name.replace('/', '%2f')}/dist-tags`, {
      signal: AbortSignal.timeout(REGISTRY_MS),
    });
    if (!res.ok) return undefined;
    const body = (await res.json()) as { latest?: unknown } | null;
    return typeof body?.latest === 'string' ? body.latest : undefined;
  } catch {
    return undefined;
  }
}

export function cachePath(): string {
  const base =
    process.platform === 'win32'
      ? (process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'))
      : (process.env.XDG_CACHE_HOME ?? join(homedir(), '.cache'));
  return join(base, 'accord', 'registry.json');
}

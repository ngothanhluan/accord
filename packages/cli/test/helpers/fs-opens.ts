// Phase 08.9.2 Ruling-narrow: counts the files accord itself opens with `readFileSync`, as git-spawns.ts counts the git processes it starts. Never the test's own setup: counting is off until a test turns it on.
// A `vi.mock` factory loads this file, so it imports nothing:
//   vi.mock('node:fs', async (orig) => (await import('./helpers/fs-opens.js')).wrapFs(await orig()));

export const openLog: { on: boolean; paths: string[] } = { on: false, paths: [] };

type Fn = (...a: unknown[]) => unknown;

/** The path a `readFileSync` call names, posix slashes; undefined for a file descriptor. */
function pathOf(file: unknown): string | undefined {
  if (typeof file === 'string') return file.replace(/\\/g, '/');
  if (file instanceof URL) return decodeURIComponent(file.pathname);
  if (file instanceof Uint8Array) return Buffer.from(file).toString('utf8').replace(/\\/g, '/');
  return undefined;
}

export function wrapFs<T extends object>(actual: T): T {
  const real = actual as unknown as Record<string, Fn>;
  const readFileSync: Fn = function (this: unknown, file: unknown, ...rest: unknown[]) {
    if (openLog.on) {
      const path = pathOf(file);
      if (path !== undefined) openLog.paths.push(path);
    }
    return (real.readFileSync as Fn).call(this, file, ...rest);
  };
  const inner = (actual as unknown as { default?: object }).default;
  return {
    ...actual,
    readFileSync,
    ...(inner === undefined ? {} : { default: { ...inner, readFileSync } }),
  } as T;
}

/** Runs `fn` with counting on; returns its value and the paths it read. */
export async function countedOpens<T>(fn: () => Promise<T>): Promise<{ value: T; paths: string[] }> {
  openLog.paths = [];
  openLog.on = true;
  try {
    const value = await fn();
    return { value, paths: [...openLog.paths] };
  } finally {
    openLog.on = false;
  }
}

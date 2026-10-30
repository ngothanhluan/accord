// ST-LN-63: counts the git processes accord itself starts (D-09), never the ones git starts, never the test's own setup.
// A `vi.mock` factory loads this file, so it imports nothing:
//   vi.mock('node:child_process', async (orig) => (await import('./helpers/git-spawns.js')).wrapChildProcess(await orig()));

export const spawnLog: {
  on: boolean;
  calls: string[][];
  fail?: (args: string[]) => boolean;
  after?: (args: string[], options?: { cwd?: string }) => void;
} = { on: false, calls: [] };

type Fn = (...a: unknown[]) => unknown;
type Options = { cwd?: string };

/** `(file, args?, options?, callback?)` in any of the shapes node allows. */
function shape(rest: unknown[]): { args: string[]; options?: Options } {
  const [first, second] = rest;
  if (Array.isArray(first)) return { args: first as string[], options: typeof second === 'object' && second !== null ? (second as Options) : undefined };
  return { args: [], options: typeof first === 'object' && first !== null ? (first as Options) : undefined };
}

function injected(): Error {
  return Object.assign(new Error('Command failed: git (injected)'), { status: 128, stderr: 'fatal: injected' });
}

export function wrapChildProcess<T extends object>(actual: T): T {
  const real = actual as unknown as Record<string, Fn>;
  const wrap = (name: string, async: boolean): Fn =>
    function (this: unknown, file: unknown, ...rest: unknown[]) {
      const fn = real[name] as Fn;
      if (file !== 'git' || !spawnLog.on) return fn.call(this, file, ...rest);
      const { args, options } = shape(rest);
      spawnLog.calls.push([...args]);
      if (spawnLog.fail?.(args) === true) {
        const callback = rest.find((r) => typeof r === 'function') as ((e: Error) => void) | undefined;
        if (async && callback !== undefined) {
          queueMicrotask(() => callback(injected()));
          return undefined;
        }
        throw injected();
      }
      const result = fn.call(this, file, ...rest);
      if (spawnLog.after !== undefined) {
        // The hook's own git runs with counting off, then counting is restored.
        spawnLog.on = false;
        try {
          spawnLog.after([...args], options);
        } finally {
          spawnLog.on = true;
        }
      }
      return result;
    };
  return {
    ...actual,
    execFileSync: wrap('execFileSync', false),
    spawnSync: wrap('spawnSync', false),
    execFile: wrap('execFile', true),
    spawn: wrap('spawn', false),
  } as T;
}

/** Runs `fn` with counting on; returns its value and the git argument arrays it started. */
export function countedSync<T>(fn: () => T): { value: T; argv: string[][] } {
  spawnLog.calls = [];
  spawnLog.on = true;
  try {
    const value = fn();
    return { value, argv: spawnLog.calls.map((c) => [...c]) };
  } finally {
    spawnLog.on = false;
  }
}

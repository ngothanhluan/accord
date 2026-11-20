// ST-LN-25: the new-release line for the session-start hook and the dashboard; asks the registry at most once in 24 hours.
import { mkdirSync, readFileSync, renameSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import pkg from '../../package.json' with { type: 'json' };
import { cachePath, requestLatest } from './registry.js';

const PLAIN = /^\d+\.\d+\.\d+$/;
const DAY_MS = 86_400_000;

export function newer(a: string, b: string): boolean {
  if (!PLAIN.test(a) || !PLAIN.test(b)) return false;
  const x = a.split('.').map(Number);
  const y = b.split('.').map(Number);
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i]! > y[i]!;
  return false;
}

/**
 * The newest release the registry names, from the 24-hour cache or one request (Phase 8.1 G3b: `accord audit` and the notice share it). `observed` is true only when a version came back:
 * an unreachable registry, a bad answer or a cached failed attempt leaves `latest` undefined and `observed` false, so a caller never reads "no answer" as "up to date". Never throws.
 */
export async function latestRelease(): Promise<{ latest?: string; observed: boolean }> {
  try {
    const file = cachePath();
    let latest: string | undefined;
    let fresh = false;
    try {
      const c = JSON.parse(readFileSync(file, 'utf8')) as { checked?: unknown; latest?: unknown };
      if (typeof c.checked === 'number' && Number.isFinite(c.checked)) {
        const age = Date.now() - c.checked;
        if (age >= 0 && age < DAY_MS) {
          fresh = true;
          latest = typeof c.latest === 'string' ? c.latest : undefined;
        }
      }
    } catch {
      // no cache, or an unreadable one: ask
    }
    if (!fresh) {
      latest = await requestLatest(pkg.name);
      try {
        mkdirSync(dirname(file), { recursive: true });
        const tmp = `${file}.${process.pid}.tmp`;
        writeFileSync(tmp, JSON.stringify({ checked: Date.now(), ...(latest === undefined ? {} : { latest }) }));
        renameSync(tmp, file);
      } catch {
        // a write failure only means the next run asks again
      }
    }
    return latest === undefined ? { observed: false } : { latest, observed: true };
  } catch {
    return { observed: false };
  }
}

export async function upgradeNotice(pinned: string | undefined): Promise<string | undefined> {
  try {
    if (pinned === undefined || !PLAIN.test(pinned)) return undefined;
    const { latest } = await latestRelease();
    if (latest !== undefined && PLAIN.test(latest) && newer(latest, pinned)) {
      return `accord ${latest} is out, and this repository pins ${pinned}: type /accord-upgrade to run npx --yes ${pkg.name}@${latest} upgrade`;
    }
    return undefined;
  } catch {
    return undefined;
  }
}

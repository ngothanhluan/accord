// Phase 15 D-31, D-10: what `accord gate done <id> --slice <n>` judges. A slice below the last judges its own `covers:` criteria and the tasks of slices 1..n; the last slice judges the whole ticket.
// Pure: reads the snapshot's plan only. The CLI validates `--slice` through `sliceScope` (undefined is exit 2), and gateDone stamps the restricted scope on the snapshot it runs.
import type { RepoSnapshot } from '../model/snapshot.js';
import { workOf } from './work.js';

const AC_TOKEN = /^@(ac-[1-9][0-9]*)$/;

export interface SliceScope {
  n: number; // the slice the run is for
  of: number; // the plan's last slice number (m)
  last: boolean; // n = m: the full set is judged and nothing is restricted
  criteria: number; // how many criteria the run judges: the slice's `@ac-n` tokens, or every tagged scenario of the ticket for the last slice
  tags?: string[]; // `ac-n` tags of the slice's covers: set; absent for the last slice
  tasks?: number[]; // task numbers of slices 1..n; absent for the last slice
}

/** The scope of slice `n` of ticket `id`, or undefined when the ticket has no slice sections, `n` is no whole number or lies outside 1..m, or the plan holds no slice with that number. */
export function sliceScope(snapshot: RepoSnapshot, id: string, n: number): SliceScope | undefined {
  const slices = workOf(snapshot, id)?.plan?.slices;
  if (slices === undefined || slices.length === 0 || !Number.isSafeInteger(n)) return undefined;
  const of = Math.max(...slices.map((s) => s.n));
  const slice = slices.find((s) => s.n === n);
  if (n < 1 || n > of || slice === undefined) return undefined;
  if (n === of) {
    const tagged = new Set((Object.hasOwn(snapshot.tickets, id) ? snapshot.tickets[id].scenarios : []).flatMap((s) => (s.acTag === undefined ? [] : [s.acTag])));
    return { n, of, last: true, criteria: tagged.size };
  }
  const tags = [...new Set(slice.covers.flatMap((t) => AC_TOKEN.exec(t)?.[1] ?? []))];
  const tasks = [...new Set(slices.filter((s) => s.n <= n).flatMap((s) => s.tasks))];
  return { n, of, last: false, criteria: tags.length, tags, tasks };
}

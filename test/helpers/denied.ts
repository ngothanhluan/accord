// The CLAUDE.md hard constraint — nothing accord ships names another tool, plugin, harness, or planning
// system — as one list and one scan, for every shipped text surface rather than for one of them.
//
// It lived inside `skills.test.ts` while the rendered skill bodies were the only such surface. Phase 7 adds
// three more (the generated `config.yml` comments, the emitted workflow YAML, and the `AGENTS.md`/`CLAUDE.md`
// pointer block), so the list moved here rather than being copied: two copies of a project constraint are
// two things to keep in step, and the one that is forgotten is the one that goes stale.
//
// It sits at the repository root because the constraint it holds is the repository's, not one package's:
// the last surface it had to reach was `packages/cli/dist/cli.js`, the bundle npm publishes. Both test
// trees now import DOWNWARDS from here, so nothing imports a helper ACROSS a package boundary — which is
// what `packages/cli/test/load.test.ts:16` asks for, rather than a rule this file is exempt from.

/**
 * What this list holds is the tools accord is NOT built for: trackers, design tools, AI vendors, planning
 * systems. `accord` itself and the four host runtimes are absent, and not as a courtesy — `claude`, `codex`,
 * `cursor` and `copilot` are values of `runtimes:` in the `config.yml` that `init` writes and components of
 * the directory paths `skills sync` writes into (`scaffold/init.ts:48-50`, `skills/targets.ts:17-22`).
 * Banning them would ban the product from naming its own config and its own directories, and the scan would
 * fail on its own output. That is the rule, not an exemption granted one name at a time: a two-word product
 * name is only incidentally matchable where the one-word form is not, and spelling is not a policy.
 *
 * The match is case-SENSITIVE. Every name above is a proper noun with one canonical spelling, so nothing
 * is lost by that, and it is what stops the scan tripping over ordinary words that share a spelling with
 * a tool: `linear-gradient` in `lint/tokens.ts` is a CSS grammar term, not the tracker. The collision
 * only became reachable when core was bundled into `dist/cli.js` (09-01), which widened this scan from
 * accord's prose to accord's whole implementation.
 *
 * `Shortcut` is absent too — it is ordinary English and would flag prose like "a shortcut past the gate";
 * the tracker risk it stands for is carried by the two tracker entries. Split literals, as
 * `templates.test.ts` does, so this file does not contain the names it forbids and so trip the scan it is
 * running.
 */
export const DENIED: readonly string[] = [
  'G' + 'SD',
  'BM' + 'ad',
  'Ji' + 'ra',
  'Lin' + 'ear',
  'Fig' + 'ma',
  'Anthro' + 'pic',
  'Open' + 'AI',
];

// Code-point order, never a locale-aware compare (targets.ts:25), so a failure reads the same on every host.
const cmp = (a: string, b: string): number => (a < b ? -1 : a > b ? 1 : 0);

/**
 * `path:line: name` for every denied name any line of any file carries, sorted. Every offender is collected
 * before the caller asserts, so a RED names all of them at once rather than aborting on the first.
 */
export function deniedNames(files: readonly { path: string; text: string }[]): string[] {
  const offenders: string[] = [];
  for (const { path, text } of files) {
    text.split('\n').forEach((line, i) => {
      for (const name of DENIED) {
        if (new RegExp('\\b' + name + '\\b').test(line)) offenders.push(`${path}:${i + 1}: ${name}`);
      }
    });
  }
  return offenders.sort(cmp);
}

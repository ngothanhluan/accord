// LINT-04 token rule (D-66 allowlist over colour and spacing, D-67 derivation without a tokens file, D-68 every
// prototype in the snapshot). Property lists A5, named colours A6, header parsing A4, arbitrary properties A10.
// A line scanner over `snapshot.files` text: String, RegExp, Set, arrays only. Text arrives normalised (D-65).
// Levels live in rules.ts (D-57); every rule here is a warning in v0.1.
import { normaliseKey, PROTOTYPE } from '../load/snapshot.js';
import type { RepoSnapshot } from '../model/snapshot.js';
import type { Draft, Rule } from './rules.js';

const CONFIG = 'accord/config.yml';
const SOURCE = 'tokens are read from config.design.tokens only';

const COLOR_PROPS = new Set(
  `color background background-color background-image border border-color border-top border-right border-bottom
   border-left border-top-color border-right-color border-bottom-color border-left-color border-block border-inline
   border-block-color border-inline-color outline outline-color fill stroke text-decoration text-decoration-color
   caret-color accent-color box-shadow text-shadow column-rule column-rule-color`.split(/\s+/),
);
const SPACING_PROPS = new Set(
  `margin margin-top margin-right margin-bottom margin-left margin-block margin-inline margin-block-start
   margin-block-end margin-inline-start margin-inline-end padding padding-top padding-right padding-bottom
   padding-left padding-block padding-inline padding-block-start padding-block-end padding-inline-start
   padding-inline-end gap row-gap column-gap inset inset-block inset-inline inset-block-start inset-block-end
   inset-inline-start inset-inline-end top right bottom left`.split(/\s+/),
);
const COLOR_UTIL = new Set(
  `bg text border border-t border-r border-b border-l border-x border-y border-s border-e outline ring ring-offset
   shadow inset-shadow fill stroke accent caret decoration divide placeholder from via to`.split(/\s+/),
);
const SPACING_UTIL = new Set(
  `p px py pt pr pb pl ps pe m mx my mt mr mb ml ms me gap gap-x gap-y space-x space-y inset inset-x inset-y
   top right bottom left start end`.split(/\s+/),
);
const EXEMPT = new Set(['transparent', 'currentcolor', 'inherit', '0', '1px', '100%']);
// CSS Color Level 4 named colours (148).
const NAMED_COLORS = new Set(
  `aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood
   cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan darkblue darkcyan darkgoldenrod darkgray
   darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen
   darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
   firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew
   hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon lightblue lightcoral lightcyan
   lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray
   lightslategrey lightsteelblue lightyellow lime limegreen linen magenta maroon mediumaquamarine mediumblue
   mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred
   midnightblue mintcream mistyrose moccasin navajowhite navy oldlace olive olivedrab orange orangered orchid
   palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple
   rebeccapurple red rosybrown royalblue saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue
   slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato turquoise violet wheat white
   whitesmoke yellow yellowgreen`.split(/\s+/),
);
const COLOR_CALL = /^(?:rgba?|hsla?|hwb|lab|lch|oklab|oklch|color|color-mix|light-dark|device-cmyk|contrast-color)\(/i;
const LENGTH =
  /^-?(?:\d+\.?\d*|\.\d+)(?:px|em|rem|ex|rex|cap|rcap|ch|rch|ic|ric|lh|rlh|vw|vh|vmin|vmax|vb|vi|[sld]v(?:w|h|min|max|b|i)|cq(?:w|h|i|b|min|max)|cm|mm|q|in|pt|pc|%)$/i;

const isColor = (p: string) =>
  /^#(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(p) || COLOR_CALL.test(p) || NAMED_COLORS.has(p.toLowerCase());
const isLength = (p: string) => p === '0' || LENGTH.test(p);

/** Every `--name` declared at any nesting after comments are removed; wildcards and `initial` are skipped. */
export function tokenNames(css: string): Set<string> {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, ' ');
  const names = new Set<string>();
  for (const m of text.matchAll(/(?:^|[\s;{])(--[A-Za-z0-9_-]+)\s*:\s*([^;}]*)/g)) {
    if (m[1].includes('*') || m[2].trim() === 'initial') continue;
    names.add(m[1]);
  }
  return names;
}

/** Literals and unknown `var()` names in one declaration value; colour on any property, length only on spacing. */
export function offending(prop: string, value: string, known: Set<string>): { token: string; why: string }[] {
  const out: { token: string; why: string }[] = [];
  const stripped = value.replace(/var\(\s*(--[A-Za-z0-9_-]+)\s*(?:,[^)]*)?\)/g, (_, name: string) => {
    if (!known.has(name)) out.push({ token: `var(${name})`, why: 'unknown token' });
    return ' ';
  });
  const kind = COLOR_PROPS.has(prop) ? 'color' : SPACING_PROPS.has(prop) ? 'spacing' : undefined;
  if (!kind) return out;
  const parts: string[] = []; // split on whitespace and commas outside parentheses
  let depth = 0;
  let cur = '';
  for (const ch of stripped) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (depth === 0 && /[\s,]/.test(ch)) {
      if (cur) parts.push(cur);
      cur = '';
    } else {
      cur += ch;
    }
  }
  if (cur) parts.push(cur);
  for (const p of parts) {
    if (EXEMPT.has(p.toLowerCase()) || p === '!important') continue;
    if (isColor(p)) out.push({ token: p, why: 'hard-coded colour' });
    else if (kind === 'spacing' && isLength(p)) out.push({ token: p, why: 'hard-coded spacing' });
    else if (kind === 'color' && /^(?:linear|radial|conic)-gradient\(/i.test(p) && /#[0-9a-f]{3,8}|rgba?\(|hsla?\(|oklch\(/i.test(p)) {
      out.push({ token: p, why: 'hard-coded colour' });
    }
  }
  return out;
}

const blank = (s: string) => s.replace(/[^\n]/g, ' ');
// One anchored regex per whitespace-delimited token (Pitfall 10): `variant:util-[value]`, `util-(--var)`, `/NN`.
const CLASS = /^((?:[a-z-]+:)*(-?[a-z][a-z-]*?)-(?:\[([^\]]+)\]|\(([^)]+)\))(?:\/\d+)?)$/;
const ARBITRARY = /^\[([a-z-]+):([^\]]+)\]$/;

/** Findings at the line of the offending token across `<style>`, `style=` attributes, and utility classes. */
export function scanPrototype(html: string, known: Set<string>): { line: number; reason: string }[] {
  const starts = [0];
  for (let i = 0; i < html.length; i++) if (html[i] === '\n') starts.push(i + 1);
  const lineAt = (off: number) => {
    let lo = 0;
    let hi = starts.length - 1;
    while (lo < hi) {
      const mid = (lo + hi + 1) >> 1;
      if (starts[mid] <= off) lo = mid;
      else hi = mid - 1;
    }
    return lo + 1;
  };
  const body = html.replace(/<!--[\s\S]*?-->/g, blank).replace(/<script\b[\s\S]*?<\/script>/gi, blank);
  const findings: { line: number; reason: string }[] = [];
  const reason = (prefix: string, o: { token: string; why: string }) =>
    `${prefix}: ${o.why} ${o.token}${o.why === 'unknown token' ? `; ${SOURCE}` : ''}`;
  const decls = (css: string, base: number) => {
    const clean = css.replace(/\/\*[\s\S]*?\*\//g, blank);
    for (const d of clean.matchAll(/([A-Za-z-]+)\s*:\s*([^;{}]+)/g)) {
      const prop = d[1].toLowerCase();
      if (prop.startsWith('--')) continue;
      for (const o of offending(prop, d[2].trim(), known)) {
        const at = base + d.index + d[0].indexOf(o.token.startsWith('var(') ? 'var(' : o.token);
        findings.push({ line: lineAt(at), reason: reason(prop, o) });
      }
    }
  };
  for (const s of body.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi)) decls(s[1], s.index + s[0].indexOf(s[1]));
  for (const a of body.matchAll(/\sstyle\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
    decls(a[1] ?? a[2], a.index + a[0].indexOf(a[1] ?? a[2]));
  }
  for (const tok of body.matchAll(/[^\s"'=<>]+/g)) {
    const arb = ARBITRARY.exec(tok[0]);
    if (arb) {
      for (const o of offending(arb[1], arb[2].replace(/_/g, ' '), known)) {
        findings.push({ line: lineAt(tok.index), reason: reason(arb[1], o) });
      }
      continue;
    }
    const c = CLASS.exec(tok[0]);
    if (!c) continue;
    const util = c[2].replace(/^-/, '');
    const kind = COLOR_UTIL.has(util) ? 'color' : SPACING_UTIL.has(util) ? 'spacing' : undefined;
    if (!kind) continue;
    const value = (c[3] ?? `var(${c[4]})`).replace(/_/g, ' ');
    for (const o of offending(kind === 'color' ? 'color' : 'margin', value, known)) {
      findings.push({ line: lineAt(tok.index), reason: reason(`class ${c[1]}`, o) });
    }
  }
  return findings.sort((a, b) => a.line - b.line || (a.reason < b.reason ? -1 : a.reason > b.reason ? 1 : 0));
}

/** The `Derived from:` list of the first comment (A4); `<...>` is the placeholder; undefined when absent. */
export function derivedFrom(html: string): { line: number; paths: string[] } | undefined {
  const m = /<!--([\s\S]*?)-->/.exec(html);
  if (!m) return undefined;
  const lines = m[1].split('\n');
  const i = lines.findIndex((l) => /^\s*Derived from:/i.test(l));
  if (i < 0) return undefined;
  const entries = [/^\s*Derived from:\s*(.*)$/i.exec(lines[i])?.[1] ?? ''];
  for (let j = i + 1; j < lines.length && !/^\s*[A-Za-z][A-Za-z ]*:/.test(lines[j]); j++) entries.push(lines[j]);
  const paths = entries
    .map((e) => e.trim().replace(/^-\s+/, ''))
    .filter((e) => e !== '' && !(e.startsWith('<') && e.endsWith('>')))
    .map(normaliseKey);
  const line = html.slice(0, m.index).split('\n').length + i;
  return { line, paths };
}

const prototypes = (snapshot: RepoSnapshot) => Object.keys(snapshot.files).filter((k) => PROTOTYPE.test(k)).sort();
const tokensKey = (snapshot: RepoSnapshot) => {
  const tokens = snapshot.config?.design.tokens;
  return tokens === undefined || tokens === '' ? undefined : normaliseKey(tokens);
};

/** D-67: a configured tokens file absent from the snapshot; the allowlist check is skipped. */
export const tokensMissing: Rule['check'] = (snapshot) => {
  const key = tokensKey(snapshot);
  if (key === undefined || key in snapshot.files) return [];
  const tokens = snapshot.config?.design.tokens;
  return [
    {
      file: CONFIG,
      pointer: '/design/tokens',
      reason: `design.tokens "${tokens}" is not in the snapshot; ${SOURCE}, so the token rule is skipped`,
    },
  ];
};

/** D-66, D-68: every prototype against the tokens file's names, at the offending line. */
export const tokenHardcoded: Rule['check'] = (snapshot) => {
  const key = tokensKey(snapshot);
  if (key === undefined || !(key in snapshot.files)) return [];
  const known = tokenNames(snapshot.files[key]);
  return prototypes(snapshot).flatMap((file) => scanPrototype(snapshot.files[file], known).map((f) => ({ file, ...f })));
};

/** D-67: without a tokens file, the header must name existing source paths. */
export const prototypeDerivation: Rule['check'] = (snapshot) => {
  if (tokensKey(snapshot) !== undefined) return [];
  const out: Draft[] = [];
  for (const file of prototypes(snapshot)) {
    const d = derivedFrom(snapshot.files[file]);
    if (d === undefined) {
      out.push({ file, line: 1, reason: 'prototype has no "Derived from:" line in its header comment' });
    } else if (d.paths.length === 0) {
      out.push({ file, line: d.line, reason: '"Derived from:" lists no path' });
    } else {
      for (const p of d.paths) {
        if (!snapshot.tree.includes(p)) out.push({ file, line: d.line, reason: `"Derived from:" path "${p}" is not in the repository` });
      }
    }
  }
  return out;
};

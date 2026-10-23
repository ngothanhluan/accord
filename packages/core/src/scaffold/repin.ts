// ST-LN-25: the pin writers `accord upgrade` uses. Pure text in, text out; a text they cannot rewrite safely gives undefined.

const ACCORD_LINE = /^accord:[ \t]*(?:"[^"\r\n]*"|'[^'\r\n]*'|[^\s#'"]+)([ \t]+#[^\r\n]*)?[ \t]*(\r?)$/gm;

/** `config.yml` with its one top-level `accord:` line set to `version`; undefined unless exactly one line matches. */
export function repinConfig(text: string, version: string): string | undefined {
  if ([...text.matchAll(ACCORD_LINE)].length !== 1) return undefined;
  return text.replace(ACCORD_LINE, (_m, comment: string | undefined, cr: string) => `accord: "${version}"${comment ?? ''}${cr}`);
}

/** The workflow with each `<name>@<from>` that is not a longer version set to `<name>@<to>`. */
export function repinWorkflow(text: string, name: string, from: string, to: string): string {
  const esc = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(esc(name + '@' + from) + '(?![0-9A-Za-z.+-])', 'g'), () => name + '@' + to);
}

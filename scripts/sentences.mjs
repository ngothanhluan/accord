// Splits the owner-facing text of a main-session transcript into sentences and counts their words.
const WORD = /[\p{L}\p{N}]/u;

export function ownerSentences(records) {
  const out = [];
  for (const r of records) {
    if (r?.type !== 'assistant' || !Array.isArray(r.message?.content)) continue;
    for (const item of r.message.content) {
      if (item?.type !== 'text' || typeof item.text !== 'string') continue;
      let fence = false;
      let view = false;
      for (const line of item.text.split('\n')) {
        const t = line.trim();
        if (/^(```|~~~)/.test(line.trimStart())) { fence = !fence; continue; }
        if (fence) continue;
        if (view) { if (t === '---') view = false; continue; }
        if (t === '## Intent') { view = true; continue; }
        if (t.startsWith('|')) continue;
        for (const s of t.split(/(?<=[.?!])\s+/)) {
          const words = s.split(/\s+/).filter((x) => WORD.test(x)).length;
          if (words) out.push({ text: s, words, long: words > 25 });
        }
      }
    }
  }
  return out;
}

import { expect, it } from 'vitest';

type S = { text: string; words: number; long: boolean };
const load = async () =>
  ((await import(new URL('../../../scripts/sentences.mjs', import.meta.url).href)) as {
    ownerSentences: (r: unknown[]) => S[];
  }).ownerSentences;
const w = (n: number, tag: string) => Array.from({ length: n }, (_, i) => `${tag}${i + 1}`).join(' ');
const asst = (...content: unknown[]) => ({ type: 'assistant', message: { content } });

it('ac-3 the sentence counter counts only the owner-facing sentences of a main session', async () => {
  const ownerSentences = await load();
  const text = [
    `${w(12, 'a')} — ** ${w(13, 'b')}. ${w(12, 'd')} benchmark.mjs ${w(12, 'g')} 0.1.0.`,
    '- check the build',
    `${w(4, 'q')}? ${w(5, 'x')}! ${w(6, 'y')}.`,
    '```',
    w(40, 'f'),
    '```',
    `  | ${w(30, 'p')} |`,
    `first | ${w(9, 'e')}.`,
    '## Intent',
    `${w(40, 'i')}.`,
    '---',
    'Plain words: ac-1 means this.',
  ].join('\n');
  const records = [
    { type: 'user', message: { content: `${w(30, 'u')}.` } },
    asst(
      { type: 'thinking', thinking: `${w(30, 't')}.` },
      { type: 'tool_use', input: { command: `${w(30, 'c')}.` } },
      { type: 'text', text },
    ),
  ];
  const out = ownerSentences(records);
  expect(out.map((s) => s.words)).toEqual([25, 26, 3, 4, 5, 6, 10, 5]);
  expect(out.map((s) => s.long)).toEqual([false, true, false, false, false, false, false, false]);
});

it('risk:parsing a Vietnamese sentence counts the words whose letters are outside ASCII', async () => {
  const ownerSentences = await load();
  const out = ownerSentences([asst({ type: 'text', text: 'Tôi đã sửa lỗi ở đây.' })]);
  expect(out.map((s) => s.words)).toEqual([6]);
});

import { parseJsonLoose, GeminiError } from './gemini';

describe('parseJsonLoose', () => {
  it('parses plain JSON', () => {
    expect(parseJsonLoose('{"a":1}')).toEqual({ a: 1 });
  });

  it('strips ```json fences', () => {
    const raw = '```json\n{"id":"x","n":2}\n```';
    expect(parseJsonLoose(raw)).toEqual({ id: 'x', n: 2 });
  });

  it('strips bare ``` fences', () => {
    expect(parseJsonLoose('```\n{"a":true}\n```')).toEqual({ a: true });
  });

  it('extracts JSON object from surrounding prose', () => {
    const raw = 'はい、以下が草稿です:\n{"tier":"MINION"}\nご確認ください。';
    expect(parseJsonLoose(raw)).toEqual({ tier: 'MINION' });
  });

  it('throws GeminiError on unparseable input', () => {
    expect(() => parseJsonLoose('これは JSON ではありません')).toThrow(GeminiError);
  });
});

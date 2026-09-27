import { alignmentMaxLossFromEnv, DEFAULT_ALIGNMENT_MAX_LOSS, isUnspacedText, mapAlignmentToLines } from './cypher-align';

const w = (text: string, start: number, end: number) => ({ text, start, end });

describe('mapAlignmentToLines', () => {
  it('maps words back to lines by token order', () => {
    const lines = ['Hello there, friend.', 'How are you?'];
    const words = [w('Hello', 0.1, 0.4), w('there,', 0.45, 0.7), w('friend.', 0.75, 1.2), w('How', 2, 2.2), w('are', 2.25, 2.4), w('you?', 2.45, 2.8)];
    expect(mapAlignmentToLines(lines, { words, characters: [] })).toEqual({
      spans: [{ start: 0.1, end: 1.2 }, { start: 2, end: 2.8 }],
      complete: true,
    });
  });

  it('gets past a word the aligner split differently', () => {
    const lines = ["It's a well-known fact.", 'Yes.'];
    const words = [w("It's", 0, 0.2), w('a', 0.25, 0.3), w('well', 0.35, 0.5), w('known', 0.5, 0.7), w('fact.', 0.75, 1), w('Yes.', 1.5, 1.8)];
    const mapping = mapAlignmentToLines(lines, { words, characters: [] });
    expect(mapping.complete).toBe(true);
    expect(mapping.spans[1]).toEqual({ start: 1.5, end: 1.8 });
    expect(mapping.spans[0]!.start).toBe(0);
  });

  it('uses characters for unspaced scripts', () => {
    const lines = ['你好。', '谢谢你'];
    const characters = [w('你', 0, 0.2), w('好', 0.2, 0.4), w('。', 0.4, 0.45), w('\n', 0.45, 0.45), w('谢', 1, 1.2), w('谢', 1.2, 1.3), w('你', 1.3, 1.5)];
    expect(mapAlignmentToLines(lines, { words: [w('你好。谢谢你', 0, 1.5)], characters })).toEqual({
      spans: [{ start: 0, end: 0.4 }, { start: 1, end: 1.5 }],
      complete: true,
    });
  });

  it('maps Japanese and Thai by character too', () => {
    expect(isUnspacedText('こんにちは、元気ですか')).toBe(true);
    expect(isUnspacedText('สวัสดีครับ วันนี้อากาศดีมาก')).toBe(true);
    expect(isUnspacedText('안녕하세요 반갑습니다')).toBe(false); // Korean has spaces: words
    expect(isUnspacedText('Hello 你')).toBe(false);
  });

  it('reports a partial mapping, so the window falls back to its pauses', () => {
    const lines = ['First line here.', 'Second line is missing entirely.'];
    const words = [w('First', 0, 0.2), w('line', 0.2, 0.4), w('here.', 0.4, 0.6)];
    const mapping = mapAlignmentToLines(lines, { words, characters: [] });
    expect(mapping.complete).toBe(false);
    expect(mapping.spans[0]).toEqual({ start: 0, end: 0.6 });
    expect(mapping.spans[1]).toBeNull();
  });

  it('does not accept a line where under half the words were found', () => {
    const lines = ['one two three four'];
    const mapping = mapAlignmentToLines(lines, { words: [w('one', 0, 0.2), w('five', 0.3, 0.4), w('six', 0.5, 0.6), w('seven', 0.7, 0.8)], characters: [] });
    expect(mapping.complete).toBe(false);
  });

  it('gives a punctuation-only line the end of the line before it', () => {
    const mapping = mapAlignmentToLines(['Wait.', '...'], { words: [w('Wait.', 1, 1.4)], characters: [] });
    expect(mapping).toEqual({ spans: [{ start: 1, end: 1.4 }, { start: 1.4, end: 1.4 }], complete: true });
  });
});

describe('alignmentMaxLossFromEnv', () => {
  it('reads CYPHER_ALIGNMENT_MAX_LOSS, or the default', () => {
    expect(alignmentMaxLossFromEnv({})).toBe(DEFAULT_ALIGNMENT_MAX_LOSS);
    expect(alignmentMaxLossFromEnv({ CYPHER_ALIGNMENT_MAX_LOSS: '0.8' })).toBe(0.8);
    expect(alignmentMaxLossFromEnv({ CYPHER_ALIGNMENT_MAX_LOSS: '-1' })).toBe(DEFAULT_ALIGNMENT_MAX_LOSS);
    expect(alignmentMaxLossFromEnv({ CYPHER_ALIGNMENT_MAX_LOSS: 'x' })).toBe(DEFAULT_ALIGNMENT_MAX_LOSS);
  });
});

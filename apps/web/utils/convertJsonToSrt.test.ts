import { convertJsonToSrt } from '@repo/validation';

describe('convertJsonToSrt', () => {
  it('should convert subtitle array to SRT format', () => {
    const input = [
      { start: '00:00:01.000', end: '00:00:04.000', text: 'Hello' },
      { start: '00:00:05.000', end: '00:00:08.000', text: 'World' },
    ];

    const result = convertJsonToSrt(input);
    expect(result).toBe(
      '1\n00:00:01,000 --> 00:00:04,000\nHello\n\n2\n00:00:05,000 --> 00:00:08,000\nWorld'
    );
  });

  it('should filter out entries with empty text', () => {
    const input = [
      { start: '00:00:01.000', end: '00:00:04.000', text: 'Hello' },
      { start: '00:00:05.000', end: '00:00:08.000', text: '   ' },
    ];

    const result = convertJsonToSrt(input);
    expect(result).toBe('1\n00:00:01,000 --> 00:00:04,000\nHello');
  });

  it('should return empty string for null/undefined/empty input', () => {
    expect(convertJsonToSrt(null as any)).toBe('');
    expect(convertJsonToSrt(undefined as any)).toBe('');
    expect(convertJsonToSrt([])).toBe('');
  });

  it('should replace dots with commas in timestamps', () => {
    const input = [
      { start: '00:00:01.500', end: '00:00:02.750', text: 'Test' },
    ];

    const result = convertJsonToSrt(input);
    expect(result).toContain('00:00:01,500');
    expect(result).toContain('00:00:02,750');
  });
});

import { cleanLines, mergeWindow, type SourceAnalysis } from './cypher-analysis';

const empty: SourceAnalysis = { speakers: [], utterances: [], speech: [], windows: [], windowsDone: 0, complete: false };

describe('mergeWindow', () => {
  it('keeps the first description of a known speaker and adds new ones', () => {
    const first = mergeWindow(empty, [{ id: 'S1', description: 'host' }], [{ speaker: 'S1', start: 1, end: 3, text: 'Hi' }]);
    const second = mergeWindow(
      first,
      [{ id: 'S1', description: 'host again' }, { id: 'S2', description: 'guest' }],
      [{ speaker: 'S2', start: 602, end: 604, text: 'Hello' }, { speaker: 'S1', start: 600.5, end: 601.5, text: 'Welcome' }],
    );
    expect(second.speakers).toEqual([{ id: 'S1', description: 'host' }, { id: 'S2', description: 'guest' }]);
    expect(second.utterances.map((u) => [u.speaker, u.start])).toEqual([['S1', 1], ['S1', 600.5], ['S2', 602]]);
  });

  it('registers a speaker id that only appears on a line', () => {
    const merged = mergeWindow(empty, [], [{ speaker: 'S3', start: 0, end: 1, text: 'Hm' }]);
    expect(merged.speakers).toEqual([{ id: 'S3', description: '' }]);
  });
});

describe('cleanLines', () => {
  it('trims and drops lines without text or speaker', () => {
    expect(
      cleanLines([
        { speaker: ' S1 ', text: ' Hi ' },
        { speaker: 'S1', text: '   ' },
        { speaker: '', text: 'nobody' },
      ]),
    ).toEqual([{ speaker: 'S1', text: 'Hi' }]);
  });
});

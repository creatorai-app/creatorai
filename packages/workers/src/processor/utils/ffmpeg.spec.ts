import {
  concatList,
  fitTurnArgs,
  loudnessArgs,
  mixArgs,
  muxArgs,
  parseIntegratedLoudness,
  rawChannelsFor,
  silenceDetectArgs,
  SPEECH_DETECT_PRESETS,
  stemInputArgs,
  stemToFlacArgs,
} from './ffmpeg';

// The argument builders, checked as data. ffmpeg.check.ts runs the same commands through
// a real ffmpeg.

describe('silenceDetectArgs', () => {
  it('uses a high floor and a longer gap on the mix, and a lower one on clean vocals', () => {
    expect(silenceDetectArgs('in.m4a', 'mix')).toContain('silencedetect=noise=-35dB:d=0.3');
    expect(silenceDetectArgs('vocals.flac', 'vocals')).toContain('silencedetect=noise=-40dB:d=0.25');
    expect(SPEECH_DETECT_PRESETS.vocals.noiseDb).toBeLessThan(SPEECH_DETECT_PRESETS.mix.noiseDb);
  });
});

describe('stem arguments', () => {
  it('cuts a window at 44.1 kHz FLAC, keeping its channels', () => {
    expect(stemInputArgs('https://x/a.m4a', 600, 590.5, 'in.flac')).toEqual([
      '-y', '-ss', '600', '-t', '590.5', '-i', 'https://x/a.m4a', '-vn', '-ar', '44100', '-c:a', 'flac', 'in.flac',
    ]);
  });

  it('pads or cuts each stem to exactly the window length, reading headerless PCM when told to', () => {
    expect(stemToFlacArgs({ input: 'v.pcm', output: 'v.flac', durationSeconds: 12.5, raw: { sampleRate: 44100, channels: 2 } })).toEqual([
      '-y', '-f', 's16le', '-ar', '44100', '-ac', '2', '-i', 'v.pcm', '-af', 'apad,atrim=0:12.500', '-ar', '44100', '-c:a', 'flac', 'v.flac',
    ]);
    expect(stemToFlacArgs({ input: 'v.mp3', output: 'v.flac', durationSeconds: 3 })).toEqual([
      '-y', '-i', 'v.mp3', '-af', 'apad,atrim=0:3.000', '-ar', '44100', '-c:a', 'flac', 'v.flac',
    ]);
  });

  it('tells mono from stereo PCM by its size', () => {
    expect(rawChannelsFor(44100 * 2 * 10, 10)).toBe(1);
    expect(rawChannelsFor(44100 * 4 * 10, 10)).toBe(2);
    expect(rawChannelsFor(0, 0)).toBe(1);
  });

  it('writes a concat list with quotes escaped', () => {
    expect(concatList(['/tmp/a.flac', "/tmp/it's.flac"])).toBe("file '/tmp/a.flac'\nfile '/tmp/it'\\''s.flac'");
  });
});

describe('fitTurnArgs', () => {
  const pcm = ['-f', 's16le', '-ar', '24000', '-ac', '1'];

  it('trims silence at both ends', () => {
    const args = fitTurnArgs({ input: 'in.pcm', output: 'out.pcm', tempo: 1 });
    expect(args.slice(0, 7)).toEqual(['-y', ...pcm]);
    const filter = args[args.indexOf('-af') + 1];
    expect(filter).toBe(
      'silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse,silenceremove=start_periods=1:start_threshold=-50dB:start_silence=0.05,areverse',
    );
    expect(args.slice(-7)).toEqual([...pcm, 'out.pcm']);
  });

  it('adds atempo for a speed-up, and nothing when there is nothing to do', () => {
    expect(fitTurnArgs({ input: 'a', output: 'b', tempo: 1.12, trim: false })).toContain('atempo=1.120');
    expect(fitTurnArgs({ input: 'a', output: 'b', tempo: 1, trim: false })).not.toContain('-af');
  });
});

describe('loudness', () => {
  it('measures with ebur128, reading raw PCM when asked', () => {
    expect(loudnessArgs('v.flac')).toEqual(['-hide_banner', '-nostats', '-i', 'v.flac', '-vn', '-af', 'ebur128', '-f', 'null', '-']);
    expect(loudnessArgs('s.pcm', true)).toContain('s16le');
  });

  it('reads the integrated loudness from the summary, not the running log', () => {
    const log = `[Parsed_ebur128_0] t: 1.0 M: -30.0 S: -30.0 I: -31.2 LUFS LRA: 0.0 LU
[Parsed_ebur128_0] Summary:

  Integrated loudness:
    I:         -18.4 LUFS
    Threshold: -28.6 LUFS`;
    expect(parseIntegratedLoudness(log)).toBe(-18.4);
  });

  it('treats silence as unmeasurable', () => {
    expect(parseIntegratedLoudness('Summary:\n  Integrated loudness:\n    I:         -70.0 LUFS')).toBeNull();
    expect(parseIntegratedLoudness('no summary')).toBeNull();
  });
});

describe('mixArgs', () => {
  it('mixes speech over the background at 44.1 kHz stereo, without normalising, then limits', () => {
    const args = mixArgs({ speech: 's.pcm', background: 'https://x/background.flac', gainDb: 3.456, totalSeconds: 61.5, output: 'o.mp3' });
    expect(args.slice(0, 11)).toEqual(['-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 's.pcm', '-i', 'https://x/background.flac']);
    const graph = args[args.indexOf('-filter_complex') + 1];
    expect(graph).toBe(
      '[0:a]aresample=44100,volume=3.46dB,aformat=channel_layouts=stereo[speech];' +
        '[1:a]aresample=44100,aformat=channel_layouts=stereo[bed];' +
        '[speech][bed]amix=inputs=2:duration=longest:normalize=0,alimiter=limit=0.891:level=false[out]',
    );
    expect(args.slice(-9)).toEqual(['-map', '[out]', '-ar', '44100', '-t', '61.500', '-c:a', 'libmp3lame', '-q:a', '2', 'o.mp3'].slice(-9));
  });

  it('keeps speech alone, at matched loudness, when there is no background', () => {
    expect(mixArgs({ speech: 's.pcm', gainDb: -2, totalSeconds: 10, output: 'o.mp3' })).toEqual([
      '-y', '-f', 's16le', '-ar', '24000', '-ac', '1', '-i', 's.pcm',
      '-af', 'volume=-2.00dB,alimiter=limit=0.891:level=false',
      '-t', '10.000', '-c:a', 'libmp3lame', '-q:a', '2', 'o.mp3',
    ]);
  });

  it('never moves the level by more than 20 dB', () => {
    expect(mixArgs({ speech: 's', gainDb: 45, totalSeconds: 1, output: 'o' }).join(' ')).toContain('volume=20.00dB');
    expect(mixArgs({ speech: 's', gainDb: -45, totalSeconds: 1, output: 'o' }).join(' ')).toContain('volume=-20.00dB');
  });
});

describe('muxArgs', () => {
  it('copies the picture, writes AAC 192k, pads the audio and stops at the video', () => {
    expect(muxArgs({ audioPath: 'a.mp3', videoPath: 'v.mp4', outputPath: 'o.mp4' })).toEqual([
      '-y', '-i', 'v.mp4', '-i', 'a.mp3', '-map', '0:v:0', '-map', '1:a:0',
      '-c:v', 'copy', '-af', 'apad', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', 'o.mp4',
    ]);
  });
});

import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { zipSync, strToU8 } from 'fflate';
import { elevenLabsClock } from './elevenlabs-dubbing';
import { elevenLabsAudioKey, forcedAlign, identifyStems, separateStems, unzipTo } from './elevenlabs-audio';

let dir: string;
beforeEach(async () => {
  jest.restoreAllMocks();
  dir = await fs.mkdtemp(path.join(os.tmpdir(), 'el-audio-'));
  elevenLabsClock.sleep = async () => undefined;
});
afterEach(async () => {
  await fs.rm(dir, { recursive: true, force: true });
});

const opts = () => ({ apiKey: 'key', checkCancelled: async () => undefined, deadline: Date.now() + 60_000 });

describe('identifyStems', () => {
  it('finds the vocal stem by name, any case, and takes the other file as background', () => {
    expect(identifyStems(['song_Vocals.wav', 'song_Instrumental.wav'])).toEqual({ vocals: 'song_Vocals.wav', background: 'song_Instrumental.wav' });
    expect(identifyStems(['stems/', 'stems/VOCAL.pcm', 'stems/accompaniment.pcm'])).toEqual({
      vocals: 'stems/VOCAL.pcm',
      background: 'stems/accompaniment.pcm',
    });
  });

  it('does not mistake "no vocals" for the vocal stem', () => {
    expect(identifyStems(['vocals.mp3', 'no_vocals.mp3'])).toEqual({ vocals: 'vocals.mp3', background: 'no_vocals.mp3' });
  });

  it('returns null for names it cannot tell apart', () => {
    expect(identifyStems(['stem_0.wav', 'stem_1.wav'])).toBeNull();
    expect(identifyStems(['vocals.wav'])).toBeNull();
    expect(identifyStems(['vocals.wav', 'drums.wav', 'bass.wav'])).toBeNull();
    expect(identifyStems([])).toBeNull();
  });

  it('ignores the Mac metadata folder', () => {
    expect(identifyStems(['__MACOSX/._vocals.wav', 'vocals.wav', 'other.wav'])).toEqual({ vocals: 'vocals.wav', background: 'other.wav' });
  });
});

describe('unzipTo', () => {
  it('unpacks every entry into the folder, never outside it', async () => {
    const zip = zipSync({ 'a/vocals.pcm': strToU8('VVVV'), '../evil.pcm': strToU8('EEEE') });
    const zipPath = path.join(dir, 'x.zip');
    await fs.writeFile(zipPath, zip);
    const names = await unzipTo(zipPath, dir);
    expect(names.sort()).toEqual(['../evil.pcm', 'a/vocals.pcm']);
    await expect(fs.readFile(path.join(dir, 'vocals.pcm'), 'utf8')).resolves.toBe('VVVV');
    await expect(fs.readFile(path.join(dir, 'evil.pcm'), 'utf8')).resolves.toBe('EEEE');
    await expect(fs.access(path.join(dir, '..', 'evil.pcm'))).rejects.toThrow();
  });
});

describe('separateStems', () => {
  const zipResponse = (files: Record<string, string>) => new Response(zipSync(Object.fromEntries(Object.entries(files).map(([k, v]) => [k, strToU8(v)]))));

  it('asks for two stems as 44.1 kHz PCM and returns the unpacked files', async () => {
    const input = path.join(dir, 'in.flac');
    await fs.writeFile(input, 'FLAC');
    const calls: { url: string; body: FormData }[] = [];
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any) => {
      calls.push({ url: String(url), body: init.body });
      return zipResponse({ 'vocals.pcm': 'V', 'instrumental.pcm': 'I' });
    });
    const result = await separateStems({ ...opts(), inputPath: input, outDir: path.join(dir, 'out') });
    expect(calls[0].url).toBe('https://api.elevenlabs.io/v1/music/stem-separation?output_format=pcm_44100');
    expect(calls[0].body.get('stem_variation_id')).toBe('two_stems_v1');
    expect(calls[0].body.get('file')).toBeInstanceOf(Blob);
    expect(result).toMatchObject({ format: 'pcm_44100', names: ['vocals.pcm', 'instrumental.pcm'] });
    await expect(fs.readFile(result!.vocals, 'utf8')).resolves.toBe('V');
  });

  it('falls back to MP3 when the tier refuses PCM, and says which format it used', async () => {
    const input = path.join(dir, 'in.flac');
    await fs.writeFile(input, 'FLAC');
    const urls: string[] = [];
    const replies = [
      new Response(JSON.stringify({ detail: { status: 'output_format_not_allowed', message: 'pcm_44100 requires a Pro subscription' } }), { status: 403 }),
      zipResponse({ 'vocals.mp3': 'V', 'music.mp3': 'M' }),
    ];
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any) => (urls.push(String(url)), replies.shift()!));
    const log = jest.fn();
    const result = await separateStems({ ...opts(), inputPath: input, outDir: path.join(dir, 'out'), log });
    expect(urls.map((u) => u.split('=')[1])).toEqual(['pcm_44100', 'mp3_44100_192']);
    expect(result?.format).toBe('mp3_44100_192');
    expect(log).toHaveBeenCalledWith(expect.stringContaining('refused pcm_44100'));
  });

  it('returns null when the ZIP names cannot be told apart', async () => {
    const input = path.join(dir, 'in.flac');
    await fs.writeFile(input, 'FLAC');
    jest.spyOn(global, 'fetch').mockResolvedValue(zipResponse({ 'a.pcm': '1', 'b.pcm': '2' }));
    await expect(separateStems({ ...opts(), inputPath: input, outDir: path.join(dir, 'out') })).resolves.toBeNull();
  });

  it('throws on a real error, for the caller to fall back', async () => {
    const input = path.join(dir, 'in.flac');
    await fs.writeFile(input, 'FLAC');
    jest.spyOn(global, 'fetch').mockResolvedValue(new Response('{"detail":"bad audio"}', { status: 400 }));
    await expect(separateStems({ ...opts(), inputPath: input, outDir: path.join(dir, 'out') })).rejects.toThrow('bad audio');
  });
});

describe('forcedAlign', () => {
  it('sends the file and the lines as multipart and reads words, characters and loss', async () => {
    const input = path.join(dir, 'w.flac');
    await fs.writeFile(input, 'FLAC');
    let body: FormData | null = null;
    jest.spyOn(global, 'fetch').mockImplementation(async (url: any, init: any) => {
      expect(String(url)).toBe('https://api.elevenlabs.io/v1/forced-alignment');
      body = init.body;
      return new Response(JSON.stringify({ words: [{ text: 'Hi', start: 0, end: 0.3, loss: 0.1 }], characters: [{ text: 'H', start: 0, end: 0.1 }], loss: 0.4 }));
    });
    const result = await forcedAlign({ ...opts(), filePath: input, text: 'Hi\nThere', mimeType: 'audio/flac' });
    expect(body!.get('text')).toBe('Hi\nThere');
    expect(result).toEqual({ words: [{ text: 'Hi', start: 0, end: 0.3, loss: 0.1 }], characters: [{ text: 'H', start: 0, end: 0.1 }], loss: 0.4 });
  });
});

describe('elevenLabsAudioKey', () => {
  it('gates the audio tools on the key being set', () => {
    expect(elevenLabsAudioKey({})).toBeNull();
    expect(elevenLabsAudioKey({ ELEVENLABS_API_KEY: '  ' })).toBeNull();
    expect(elevenLabsAudioKey({ ELEVENLABS_API_KEY: 'k' })).toBe('k');
  });
});

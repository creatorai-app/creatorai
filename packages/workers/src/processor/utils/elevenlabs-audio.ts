import { createReadStream, createWriteStream, openAsBlob } from 'fs';
import fs from 'fs/promises';
import path from 'path';
import { pipeline } from 'stream/promises';
import { Readable } from 'stream';
import { Unzip, UnzipInflate } from 'fflate';
import { callElevenLabs, ELEVENLABS_API, ElevenLabsHttpError, type CallOptions } from './elevenlabs-dubbing';
import type { ForcedAlignment } from './cypher-align';

// ElevenLabs' audio tools that make Cypher better, never required by it: stem
// separation (the voices apart from the music and effects) and forced alignment (word
// timings). Both are gated on ELEVENLABS_API_KEY and both are allowed to fail: the
// caller then carries on exactly as Cypher did before them.
// https://elevenlabs.io/docs/api-reference/music/separate-stems
// https://elevenlabs.io/docs/api-reference/forced-alignment/create

/** The key when ElevenLabs' audio tools can be used, or null to skip them. */
export function elevenLabsAudioKey(env: NodeJS.ProcessEnv = process.env): string | null {
  return env.ELEVENLABS_API_KEY?.trim() || null;
}

/**
 * Output formats to ask stem separation for, best first. 44.1 kHz PCM needs a Pro tier
 * or above, 192 kbps MP3 Creator or above; the last one every tier allows.
 */
export const STEM_OUTPUT_FORMATS = ['pcm_44100', 'mp3_44100_192', 'mp3_44100_128'] as const;
export type StemOutputFormat = (typeof STEM_OUTPUT_FORMATS)[number];

/** True when ElevenLabs refused an output format for the account's tier, not the request. */
export function isTierRefusal(error: unknown): boolean {
  if (!(error instanceof ElevenLabsHttpError)) return false;
  if (![400, 401, 403, 422].includes(error.status)) return false;
  return /output_format|subscription|tier|upgrade|plan/i.test(error.body);
}

/**
 * Which file in a two-stem ZIP is the voice and which is everything else. The vocal stem
 * is the one whose name says "vocal" (any case); the background is the one other file.
 * Anything else (no vocal file, several of them, or more than one other) is not
 * trusted: null.
 */
export function identifyStems(names: string[]): { vocals: string; background: string } | null {
  const files = names.filter((n) => !n.endsWith('/') && !/(^|\/)(__MACOSX|\.)/.test(n));
  const vocals = files.filter((n) => /vocal/i.test(path.basename(n)) && !/no.?vocal|instrumental|without.?vocal/i.test(path.basename(n)));
  const others = files.filter((n) => !vocals.includes(n));
  if (vocals.length !== 1 || others.length !== 1) return null;
  return { vocals: vocals[0], background: others[0] };
}

export interface SeparatedStems {
  vocals: string;
  background: string;
  format: StemOutputFormat;
  /** Every name the ZIP held, for the log. */
  names: string[];
}

/**
 * Split one audio file into its vocal and background stems (`two_stems_v1`), trying the
 * output formats best first and falling back when the tier refuses one. The ZIP is
 * streamed to disk and unpacked file by file. Returns null when the stems cannot be told
 * apart; throws on anything else, for the caller to fall back.
 */
export async function separateStems(
  opts: CallOptions & { inputPath: string; outDir: string; log?: (message: string) => void },
): Promise<SeparatedStems | null> {
  for (const format of STEM_OUTPUT_FORMATS) {
    let response: Response;
    try {
      const form = new FormData();
      form.append('file', await openAsBlob(opts.inputPath, { type: 'audio/flac' }), path.basename(opts.inputPath));
      form.append('stem_variation_id', 'two_stems_v1');
      response = await callElevenLabs(
        opts,
        `${ELEVENLABS_API}/music/stem-separation?output_format=${format}`,
        { method: 'POST', body: form },
        'stem separation',
        { idempotent: false },
      );
    } catch (error) {
      if (isTierRefusal(error) && format !== STEM_OUTPUT_FORMATS[STEM_OUTPUT_FORMATS.length - 1]) {
        opts.log?.(`Stem separation refused ${format} on this plan; trying the next format.`);
        continue;
      }
      throw error;
    }

    await fs.mkdir(opts.outDir, { recursive: true });
    const zipPath = path.join(opts.outDir, 'stems.zip');
    if (!response.body) throw new Error('Stem separation returned an empty response');
    await pipeline(Readable.fromWeb(response.body as any), createWriteStream(zipPath));
    const names = await unzipTo(zipPath, opts.outDir);
    await fs.rm(zipPath, { force: true });
    opts.log?.(`Stem separation (${format}) returned: ${names.join(', ') || 'nothing'}.`);

    const picked = identifyStems(names);
    if (!picked) return null;
    return {
      vocals: path.join(opts.outDir, safeName(picked.vocals)),
      background: path.join(opts.outDir, safeName(picked.background)),
      format,
      names,
    };
  }
  return null;
}

/** A ZIP entry's name as a plain file name in the output folder (no paths out of it). */
function safeName(name: string): string {
  return path.basename(name).replace(/[^\w.\-]/g, '_') || 'stem';
}

/**
 * Unpack a ZIP into `dir`, streaming: each entry is inflated chunk by chunk as the file is
 * read, so a large stem never sits in memory whole. Returns the entry names.
 */
export async function unzipTo(zipPath: string, dir: string): Promise<string[]> {
  const names: string[] = [];
  const writes: Promise<void>[] = [];
  let failure: Error | null = null;

  const unzip = new Unzip();
  unzip.register(UnzipInflate);
  unzip.onfile = (file) => {
    names.push(file.name);
    if (file.name.endsWith('/')) return;
    const out = createWriteStream(path.join(dir, safeName(file.name)));
    writes.push(
      new Promise<void>((resolve, reject) => {
        out.on('finish', resolve);
        out.on('error', reject);
      }),
    );
    file.ondata = (error, chunk, final) => {
      if (error) {
        failure = error;
        out.destroy(error);
        return;
      }
      out.write(chunk);
      if (final) out.end();
    };
    file.start();
  };

  for await (const chunk of createReadStream(zipPath)) {
    unzip.push(new Uint8Array(chunk as Buffer));
    if (failure) throw failure;
  }
  unzip.push(new Uint8Array(0), true);
  await Promise.all(writes);
  if (failure) throw failure;
  return names;
}

/**
 * Time every word and character of `text` against the audio in `filePath` (under 1 GB).
 * `text` is the lines joined by newlines; ElevenLabs does no diarization, so speakers
 * stay with the lines they came from.
 */
export async function forcedAlign(opts: CallOptions & { filePath: string; text: string; mimeType: string }): Promise<ForcedAlignment> {
  const form = new FormData();
  form.append('file', await openAsBlob(opts.filePath, { type: opts.mimeType }), path.basename(opts.filePath));
  form.append('text', opts.text);
  const response = await callElevenLabs(opts, `${ELEVENLABS_API}/forced-alignment`, { method: 'POST', body: form }, 'forced alignment', {
    idempotent: false,
  });
  const data = (await response.json()) as Partial<ForcedAlignment>;
  return { words: data.words ?? [], characters: data.characters ?? [], loss: Number(data.loss ?? NaN) };
}

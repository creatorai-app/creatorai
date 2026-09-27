/**
 * Runnable self-check for the ffmpeg commands the dub runs. Needs ffmpeg + ffprobe on PATH.
 *   npx tsx packages/workers/src/processor/utils/ffmpeg.check.ts
 *
 * probeDurationSeconds is the only independent reading of a dub's length. The browser's
 * figure sets the reservation and the plan cap, and nothing else in the pipeline measures
 * the source, so a silent break here mis-prices every job. The rest runs every Cypher
 * command (speech detection on both presets, stem conversion, turn fitting, loudness,
 * the mix and the mux) against real media, so a filter ffmpeg rejects fails here, not
 * in a paid dub.
 */
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import {
  concatFlac,
  detectSpeech,
  DUB_PCM_BYTES_PER_SECOND,
  fitTurn,
  measureLoudness,
  mixDub,
  muxDubbedAudio,
  probeDurationSeconds,
  rawChannels,
  stemToFlac,
  toDubPcm,
} from './ffmpeg';

const execFileAsync = promisify(execFile);

async function main() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'ffprobe-check-'));
  try {
    const clip = path.join(dir, 'clip.mp3');
    await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=frequency=440:duration=7.5', '-c:a', 'libmp3lame', clip]);

    const seconds = await probeDurationSeconds(clip);
    assert.ok(seconds !== null, 'a real clip must report a duration');
    // MP3 frame padding moves the end by a few ms; the price is per second, not per frame.
    assert.ok(Math.abs(seconds - 7.5) < 0.2, `expected ~7.5s, got ${seconds}`);

    // A file with no media in it must fail loudly rather than price a dub at zero.
    const notMedia = path.join(dir, 'notes.txt');
    await fs.writeFile(notMedia, 'this is not a video');
    await assert.rejects(() => probeDurationSeconds(notMedia), /ffprobe failed/);

    // Speech with pauses: 2 s tone, 1 s silence, 2 s tone, over quiet noise (the "music").
    const speechy = path.join(dir, 'speechy.wav');
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=5',
      '-f', 'lavfi', '-i', 'anoisesrc=d=5:c=pink:a=0.01',
      '-filter_complex', "[0:a]volume='if(between(t,2,3),0,1)':eval=frame[s];[s][1:a]amix=inputs=2:normalize=0",
      '-ar', '44100', speechy,
    ]);
    const mixSpeech = await detectSpeech(speechy, 5, 'mix');
    assert.equal(mixSpeech.length, 2, `mix preset: expected two stretches, got ${JSON.stringify(mixSpeech)}`);
    assert.ok(Math.abs(mixSpeech[0].end - 2) < 0.15 && Math.abs(mixSpeech[1].start - 3) < 0.15, JSON.stringify(mixSpeech));
    // A clean vocal stem: the same without noise, the second phrase spoken softly (about
    // -37 dB peak; lavfi's sine is already at 1/8 scale). The vocals preset's lower floor
    // keeps it; the mix preset's would have dropped it as silence.
    const vocals = path.join(dir, 'vocals.wav');
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'sine=frequency=300:duration=5',
      '-af', "volume='if(between(t,2,3),0,if(gt(t,3),0.11,1))':eval=frame", '-ar', '44100', vocals,
    ]);
    const vocalSpeech = await detectSpeech(vocals, 5, 'vocals');
    assert.equal(vocalSpeech.length, 2, `vocals preset: expected two stretches, got ${JSON.stringify(vocalSpeech)}`);
    assert.equal((await detectSpeech(vocals, 5, 'mix')).length, 1, 'the mix floor should not hear the soft phrase');

    // A stem that came back as headerless stereo PCM becomes FLAC of exactly its window.
    const rawStem = path.join(dir, 'stem.pcm');
    await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'sine=duration=2.9', '-ac', '2', '-ar', '44100', '-f', 's16le', rawStem]);
    assert.equal(await rawChannels(rawStem, 3), 2);
    const stemFlac = path.join(dir, 'stem.flac');
    await stemToFlac({ input: rawStem, output: stemFlac, durationSeconds: 3, raw: { sampleRate: 44100, channels: 2 } });
    assert.ok(Math.abs((await probeDurationSeconds(stemFlac))! - 3) < 0.05, 'stem not padded to its window');
    const joined = path.join(dir, 'joined.flac');
    await concatFlac([stemFlac, stemFlac], path.join(dir, 'list.txt'), joined);
    assert.ok(Math.abs((await probeDurationSeconds(joined))! - 6) < 0.05, 'stems did not join end to end');

    // A synthesized turn: 0.5 s silence, 2 s speech, 0.5 s silence -> trimmed, then sped up.
    const turnWav = path.join(dir, 'turn.wav');
    await execFileAsync('ffmpeg', [
      '-y', '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono:d=0.5', '-f', 'lavfi', '-i', 'sine=frequency=220:duration=2:sample_rate=24000',
      '-f', 'lavfi', '-i', 'anullsrc=r=24000:cl=mono:d=0.5', '-filter_complex', '[0:a][1:a][2:a]concat=n=3:v=0:a=1', turnWav,
    ]);
    const turnPcm = path.join(dir, 'turn.pcm');
    await toDubPcm(turnWav, turnPcm);
    const trimmed = path.join(dir, 'trimmed.pcm');
    await fitTurn({ input: turnPcm, output: trimmed, tempo: 1, trim: true });
    const trimmedSeconds = (await fs.stat(trimmed)).size / DUB_PCM_BYTES_PER_SECOND;
    assert.ok(trimmedSeconds > 2 && trimmedSeconds < 2.25, `trim left ${trimmedSeconds}s`);
    const faster = path.join(dir, 'faster.pcm');
    await fitTurn({ input: trimmed, output: faster, tempo: 1.15, trim: false });
    const fasterSeconds = (await fs.stat(faster)).size / DUB_PCM_BYTES_PER_SECOND;
    assert.ok(Math.abs(fasterSeconds - trimmedSeconds / 1.15) < 0.05, `atempo gave ${fasterSeconds}s`);

    // Loudness: a real reading on speech, none on silence.
    const lufs = await measureLoudness(trimmed, true);
    assert.ok(lufs !== null && lufs < 0 && lufs > -40, `loudness ${lufs}`);
    const silence = path.join(dir, 'silence.pcm');
    await fs.writeFile(silence, Buffer.alloc(DUB_PCM_BYTES_PER_SECOND * 2));
    assert.equal(await measureLoudness(silence, true), null);

    // The mix: speech over a background, cut to the source's length, then speech alone.
    const mixed = path.join(dir, 'mixed.mp3');
    await mixDub({ speech: faster, background: speechy, gainDb: 3, totalSeconds: 4.5, output: mixed });
    assert.ok(Math.abs((await probeDurationSeconds(mixed))! - 4.5) < 0.1, 'mix is not the source length');
    const alone = path.join(dir, 'alone.mp3');
    await mixDub({ speech: faster, gainDb: -3, totalSeconds: 10, output: alone });
    assert.ok((await probeDurationSeconds(alone))! < 2.5, 'speech-only track should end with its speech');

    // The mux: dubbed audio over a video, padded and stopped at the video's length.
    const video = path.join(dir, 'video.mp4');
    await execFileAsync('ffmpeg', ['-y', '-f', 'lavfi', '-i', 'color=c=black:s=64x64:d=4', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', video]);
    const muxed = path.join(dir, 'muxed.mp4');
    await muxDubbedAudio({ audioPath: alone, videoPath: video, outputPath: muxed });
    assert.ok(Math.abs((await probeDurationSeconds(muxed))! - 4) < 0.15, 'mux did not follow the video length');

    console.log('ffmpeg self-check OK');
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

void main();

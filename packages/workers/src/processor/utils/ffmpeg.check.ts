/**
 * Runnable self-check for probeDurationSeconds. Needs ffmpeg + ffprobe on PATH.
 *   npx tsx packages/workers/src/processor/utils/ffmpeg.check.ts
 *
 * This is the only independent reading of a dub's length. The browser's figure sets the
 * reservation and the plan cap, and nothing else in the pipeline measures the source, so
 * a silent break here mis-prices every job.
 */
import assert from 'node:assert';
import { execFile } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';
import { probeDurationSeconds } from './ffmpeg';

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

    console.log('ffmpeg self-check OK');
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => null);
  }
}

void main();

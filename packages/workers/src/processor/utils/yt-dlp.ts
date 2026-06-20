/**
 * 
 * @todo Test utility to download audio from a video URL using yt-dlp.
 */

import { promisify } from 'util';
import { execFile } from 'child_process';
import fs from 'fs/promises';
import path from 'path';
import type { Logger } from '@nestjs/common';

const execFileAsync = promisify(execFile);

interface DownloadAudioOptions {
  quality?: 'highest' | 'medium';
  retries?: number;
  ffmpegLocation?: string;
}

export async function downloadAudio(
  videoUrl: string,
  outputPath: string,
  logger?: Logger,
  options: DownloadAudioOptions = {}
): Promise<void> {
  const { quality = 'highest', retries = 10, ffmpegLocation } = options;
  const audioQuality = quality === 'highest' ? '0' : '5';
  const dir = path.dirname(outputPath);
  await fs.mkdir(dir, { recursive: true });

  // Use a deterministic filename template that yt-dlp will produce
  const outTemplate = path.join(dir, '{id}.{ext}');

  const baseArgs = [
    '-f', 'bestaudio/best',
    '--extract-audio', '--audio-format', 'mp3',
    '--audio-quality', audioQuality, '--no-playlist',
    '--retries', String(retries),
    '--fragment-retries', String(retries * 2),
    '--ignore-errors',
    '-o', outTemplate
  ];

  if (ffmpegLocation) {
    baseArgs.push('--ffmpeg-location', ffmpegLocation);
  }

  try {
    // 1) Ask yt-dlp what filename it will produce (helps with short URLs etc.)
    const getNameArgs = ['--get-filename', '-o', '{id}.{ext}', videoUrl];
    const { stdout: nameOut } = await execFileAsync('yt-dlp', getNameArgs, { timeout: 30_000 });
    const expectedName = nameOut.toString().trim().split(/\r?\n/).pop();
    if (!expectedName) {
      throw new Error('Could not determine output filename from yt-dlp');
    }
    const tempFile = path.join(dir, expectedName);

    // 2) Run the actual download + conversion
    const { stdout } = await execFileAsync('yt-dlp', baseArgs.concat(videoUrl), { timeout: 300_000, maxBuffer: 10 * 1024 * 1024 });
    logger?.log(`yt-dlp: ${stdout?.toString().trim()}`);

    // 3) Wait for file to exist (small loop, more robust than immediate check)
    const exists = await waitForFile(tempFile, 30_000);
    if (!exists) throw new Error(`Expected output ${tempFile} not produced`);

    await fs.rename(tempFile, outputPath);
  } catch (err: any) {
    logger?.error(`yt-dlp failed for ${videoUrl}: ${err?.message || err}`);
    throw err; // allow queue retry
  }
}

async function waitForFile(p: string, timeout = 30_000): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      await fs.access(p);
      return true;
    } catch { }
    await new Promise(res => setTimeout(res, 500));
  }
  return false;
}

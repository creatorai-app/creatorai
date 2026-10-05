/**
 * Live smoke test of every ElevenLabs call the dubbing pipeline makes, against the real
 * API with a real key. It spends ElevenLabs credits (one dubbing language, one stem
 * separation and one alignment of the clip), so it only runs when asked to, and never in
 * CI (jest only picks up *.spec.ts under src/).
 *
 *   SMOKE_ELEVENLABS=1 ELEVENLABS_API_KEY=... \
 *     npx tsx packages/workers/scripts/dubbing-smoke.ts <clip> [--target es] [--source en] \
 *       [--mode balanced] [--keyterm "Creator AI"] [--keep]
 *
 * <clip> is a local audio or video file of 20 to 60 seconds. Steps, each printing what
 * was sent and what came back:
 *   1. project create (the model the worker would use for --target: dubbing_v1 for
 *      Bengali, dubbing_v2 otherwise; the file uploaded, source language and keyterms)
 *   2. wait for the project, read the source transcript (detected language)
 *   3. target create with the voice mode's cloning strength, read the target back
 *   4. wait for the target, download its fresh lossless audio, measure it
 *   5. read the target transcript and map both to the timeline shape
 *   6. stem separation of the clip (two_stems_v1; which output format the tier allows)
 *   7. forced alignment of the clip against the source transcript, and the line mapping
 * The project is deleted at the end unless --keep is passed.
 */
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { cloningStrengthFor, DUB_VOICE_MODES, elevenLabsModelFor, type DubVoiceMode } from '@repo/validation';
import {
  createLanguageTarget,
  createProject,
  deleteProject,
  downloadDub,
  getLanguageTarget,
  getSourceTranscript,
  getTargetTranscript,
  transcriptTimeline,
  waitForDub,
  waitForProjectReady,
  type CallOptions,
} from '../src/processor/utils/elevenlabs-dubbing';
import { forcedAlign, separateStems } from '../src/processor/utils/elevenlabs-audio';
import { mapAlignmentToLines, alignmentMaxLossFromEnv } from '../src/processor/utils/cypher-align';
import { cutAnalysisWindow, cutStemInput, probeDurationSeconds } from '../src/processor/utils/ffmpeg';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i > 0 ? process.argv[i + 1] : undefined;
}

function args(name: string): string[] {
  return process.argv.flatMap((a, i) => (a === `--${name}` && process.argv[i + 1] ? [process.argv[i + 1]] : []));
}

const show = (label: string, value: unknown) => console.log(`\n== ${label}\n${typeof value === 'string' ? value : JSON.stringify(value, null, 2)}`);

async function main() {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (process.env.SMOKE_ELEVENLABS !== '1' || !apiKey) {
    console.log('Skipped: set SMOKE_ELEVENLABS=1 and ELEVENLABS_API_KEY to run the ElevenLabs smoke test.');
    return;
  }
  const clip = process.argv[2];
  if (!clip || clip.startsWith('--')) throw new Error('Pass the path of a 20 to 60 second clip as the first argument.');
  const target = arg('target') ?? 'es';
  const source = arg('source') ?? null;
  const mode = (arg('mode') ?? 'balanced') as DubVoiceMode;
  if (!DUB_VOICE_MODES.includes(mode)) throw new Error(`--mode must be one of ${DUB_VOICE_MODES.join(', ')}`);
  const keyterms = args('keyterm');
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'dubbing-smoke-'));
  const seconds = await probeDurationSeconds(clip);
  show('clip', { clip, seconds, target, source, mode, keyterms, workdir: dir });

  const opts: CallOptions = {
    apiKey,
    deadline: Date.now() + 45 * 60 * 1000,
    checkCancelled: async () => undefined,
    onBusy: (ms) => console.log(`   busy (429 / concurrency), waiting ${Math.round(ms / 1000)}s`),
  };

  // 1-2. Project
  const model = elevenLabsModelFor(target);
  const sent = { file: path.basename(clip), model_id: model, source_language: source, keyterms, reference: `smoke-${Date.now()}` };
  show('1. POST /v1/dubbing/project (multipart), sent', sent);
  const projectId = await createProject({ ...opts, filePath: clip, modelId: model, sourceLanguage: source, keyterms, reference: sent.reference });
  show('   project_id', projectId);

  try {
    const project = await waitForProjectReady(opts, projectId);
    show('2. project ready', project);
    const sourceTranscript = await getSourceTranscript(opts, projectId);
    show('   source transcript', { language: sourceTranscript.language, segments: sourceTranscript.segments.length, first: sourceTranscript.segments.slice(0, 3) });

    // 3. Target
    // Cloning strength is a Dubbing v2 setting; a v1 (Bengali) target gets none.
    const strength = model === 'dubbing_v2'
      ? cloningStrengthFor({ voiceMode: mode, sourceLanguage: source ?? sourceTranscript.language, targetLanguage: target })
      : null;
    show('3. POST /v1/dubbing/project/{id}/language, sent', { target_language: target, ...(strength !== null ? { voice_settings: { cloning_strength: strength } } : {}) });
    const languageId = await createLanguageTarget({
      ...opts,
      projectId,
      targetLanguage: target,
      cloningStrength: strength,
      onVoiceSettingsRefused: (reason) => show('   !! voice_settings REFUSED, target created without them', reason),
    });
    const created = await getLanguageTarget(opts, projectId, languageId);
    show('   target as ElevenLabs reports it (check voice_settings)', created);

    // 4. Wait and download
    const dub = { kind: 'project' as const, projectId, languageId };
    const outcome = await waitForDub(opts, dub);
    show('4. target finished', outcome);
    const audio = path.join(dir, `dub-${target}`);
    await downloadDub(opts, dub, target, audio);
    show('   downloaded', { path: audio, bytes: (await fs.stat(audio)).size, seconds: await probeDurationSeconds(audio) });

    // 5. Timeline
    const targetTranscript = await getTargetTranscript(opts, projectId, languageId);
    const timeline = transcriptTimeline(sourceTranscript, targetTranscript);
    show('5. timeline', { segments: timeline.length, first: timeline.slice(0, 3) });

    // 6. Stems
    const stemInput = path.join(dir, 'stem-input.flac');
    await cutStemInput(clip, 0, seconds ?? 60, stemInput);
    const stems = await separateStems({ ...opts, inputPath: stemInput, outDir: path.join(dir, 'stems'), log: (m) => console.log(`   ${m}`) });
    show('6. stem separation', stems
      ? { format: stems.format, names: stems.names, vocalsBytes: (await fs.stat(stems.vocals)).size, backgroundBytes: (await fs.stat(stems.background)).size }
      : 'could not tell the stems apart (null)');

    // 7. Alignment
    const lines = sourceTranscript.segments.map((s) => s.text).filter((t) => t.trim());
    const alignInput = path.join(dir, 'align.flac');
    await cutAnalysisWindow(stems ? stems.vocals : clip, 0, seconds ?? 60, alignInput);
    const alignment = await forcedAlign({ ...opts, filePath: alignInput, text: lines.join('\n'), mimeType: 'audio/flac' });
    const mapping = mapAlignmentToLines(lines, alignment);
    show('7. forced alignment', {
      loss: alignment.loss,
      maxLoss: alignmentMaxLossFromEnv(),
      words: alignment.words.length,
      characters: alignment.characters.length,
      firstWords: alignment.words.slice(0, 5),
      allLinesFound: mapping.complete,
      spans: mapping.spans.slice(0, 5),
      wouldUse: mapping.complete && alignment.loss <= alignmentMaxLossFromEnv(),
    });
  } finally {
    if (process.argv.includes('--keep')) {
      show('kept', `ElevenLabs project ${projectId} left in place (--keep).`);
    } else {
      await deleteProject(opts, projectId).then(
        () => show('cleanup', `deleted ElevenLabs project ${projectId}`),
        (error) => show('cleanup failed', String(error?.message ?? error)),
      );
    }
  }
  show('done', `outputs in ${dir}`);
}

main().catch((error) => {
  console.error('\nSMOKE TEST FAILED:', error?.message ?? error);
  process.exit(1);
});

import type { SubtitleLine } from './schema/subtitle.schema';

export function convertJsonToSrt(subtitles: SubtitleLine[]): string {
  if (!subtitles || !Array.isArray(subtitles) || subtitles.length === 0) {
    return '';
  }

  return subtitles
    .filter(entry => entry && entry.text.trim() !== '')
    .map((entry, index) => {
      const srtStart = entry.start.replace(/\./g, ',');
      const srtEnd = entry.end.replace(/\./g, ',');
      const indexNumber = index + 1;

      return `${indexNumber}\n${srtStart} --> ${srtEnd}\n${entry.text.trim()}`;
    })
    .join('\n\n');
}

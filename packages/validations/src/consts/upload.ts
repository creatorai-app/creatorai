// Subtitle upload size caps by plan tier. Starter (free) is throttled; paid plans
// get the full GCS-backed ceiling.
export const SUBTITLE_FREE_UPLOAD_BYTES = 100 * 1024 * 1024; // 100MB — Starter
export const SUBTITLE_PAID_UPLOAD_BYTES = 2 * 1024 * 1024 * 1024; // 2GB — Pro and up

export function subtitleUploadLimitBytes(isPaidPlan: boolean): number {
  return isPaidPlan ? SUBTITLE_PAID_UPLOAD_BYTES : SUBTITLE_FREE_UPLOAD_BYTES;
}

// Duration cap only applies to Starter (free). Paid plans can upload any length
// (bounded only by the 2GB size cap). null = no duration limit.
export const SUBTITLE_FREE_MAX_DURATION_SECONDS = 10 * 60; // 10 minutes — Starter

export function subtitleMaxDurationSeconds(isPaidPlan: boolean): number | null {
  return isPaidPlan ? null : SUBTITLE_FREE_MAX_DURATION_SECONDS;
}

/** "100MB" / "2GB" for user-facing limit messages. */
export function formatUploadLimit(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024);
  if (gb >= 1) return `${Number.isInteger(gb) ? gb : gb.toFixed(1)}GB`;
  return `${Math.round(bytes / (1024 * 1024))}MB`;
}

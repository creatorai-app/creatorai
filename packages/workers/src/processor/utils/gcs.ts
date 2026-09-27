import type { Storage as GcsStorage } from '@google-cloud/storage';

/**
 * Minimal worker-side GCS upload. Omni Flash returns the generated clip as bytes (or a
 * short-lived Files URI we download), so — unlike Veo, which wrote straight to GCS — the
 * worker must persist the buffer itself. Auth uses the same ADC as Vertex/genai.
 *
 * The video bucket is public-read (like the subtitle bucket), so no ACL call is needed;
 * the object is reachable at https://storage.googleapis.com/<bucket>/<object>.
 */

let cachedStorage: GcsStorage | null = null;

async function getStorage(): Promise<GcsStorage> {
  if (cachedStorage) return cachedStorage;
  const project = process.env.GOOGLE_CLOUD_PROJECT;
  if (!project) throw new Error('GOOGLE_CLOUD_PROJECT is not configured (required for GCS)');
  const mod = await (Function('return import("@google-cloud/storage")')() as Promise<{
    Storage: new (opts: { projectId: string }) => GcsStorage;
  }>);
  cachedStorage = new mod.Storage({ projectId: project });
  return cachedStorage;
}

function videoBucket(): string {
  const bucket = process.env.GCS_VIDEO_BUCKET;
  if (!bucket) throw new Error('GCS_VIDEO_BUCKET is not configured');
  return bucket;
}

export interface UploadedVideo {
  gsUri: string;
  publicUrl: string;
}

/** Upload the generated clip and return both the gs:// ref (cleanup) and public URL (playback). */
export async function uploadVideoBuffer(
  objectName: string,
  buffer: Buffer,
  contentType = 'video/mp4',
): Promise<UploadedVideo> {
  const bucket = videoBucket();
  const storage = await getStorage();
  await storage.bucket(bucket).file(objectName).save(buffer, {
    contentType,
    resumable: false, // clips are ≤10s/720p — a single request is well under GCS's ceiling
  });
  return {
    gsUri: `gs://${bucket}/${objectName}`,
    publicUrl: `https://storage.googleapis.com/${bucket}/${objectName}`,
  };
}

/** gs://bucket/a/b → { bucket, objectName: 'a/b' } */
export function parseGsUri(gsUri: string): { bucket: string; objectName: string } {
  const match = /^gs:\/\/([^/]+)\/(.+)$/.exec(gsUri);
  if (!match) throw new Error(`Not a gs:// URI: ${gsUri}`);
  return { bucket: match[1], objectName: match[2] };
}

export function gcsPublicUrl(bucket: string, objectName: string): string {
  return `https://storage.googleapis.com/${bucket}/${objectName}`;
}

export async function gcsObjectExists(bucket: string, objectName: string): Promise<boolean> {
  const storage = await getStorage();
  const [exists] = await storage.bucket(bucket).file(objectName).exists();
  return exists;
}

export async function saveGcsBuffer(bucket: string, objectName: string, buffer: Buffer, contentType: string): Promise<void> {
  const storage = await getStorage();
  await storage.bucket(bucket).file(objectName).save(buffer, { contentType, resumable: false });
}

/** Streams a local file up (resumable, so a multi-GB mux output never sits in memory). */
export async function uploadGcsFile(bucket: string, objectName: string, localPath: string, contentType: string): Promise<void> {
  const storage = await getStorage();
  await storage.bucket(bucket).upload(localPath, { destination: objectName, contentType, resumable: true });
}

export async function downloadGcsFile(bucket: string, objectName: string, destination: string): Promise<void> {
  const storage = await getStorage();
  await storage.bucket(bucket).file(objectName).download({ destination });
}

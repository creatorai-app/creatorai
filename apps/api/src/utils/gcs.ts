import { ConfigService } from '@nestjs/config';
import type { Storage as GcsStorage } from '@google-cloud/storage';

/**
 * GCS access for subtitle media. Auth uses the same Application Default Credentials
 * (ADC) as Vertex (see genai.ts) — the Vertex service account needs
 * roles/storage.objectAdmin on the bucket, plus signing rights for signed upload URLs
 * (a SA key file signs locally; an attached SA needs iam.serviceAccounts.signBlob).
 */

let cachedStorage: GcsStorage | null = null;
let cachedProject: string | null = null;

async function getStorage(configService: ConfigService): Promise<GcsStorage> {
  const project = configService.get<string>('GOOGLE_CLOUD_PROJECT');
  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not configured (required for GCS)');
  }
  if (cachedStorage && cachedProject === project) return cachedStorage;

  const mod = await (Function('return import("@google-cloud/storage")')() as Promise<{
    Storage: new (opts: { projectId: string }) => GcsStorage;
  }>);
  cachedStorage = new mod.Storage({ projectId: project });
  cachedProject = project;
  return cachedStorage;
}

function getBucketName(configService: ConfigService): string {
  const bucket = configService.get<string>('GCS_SUBTITLE_BUCKET');
  if (!bucket) {
    throw new Error('GCS_SUBTITLE_BUCKET is not configured');
  }
  return bucket;
}

/** Dubbing keeps its own bucket so retention/cleanup can diverge from subtitles. */
export function getDubbingBucketName(configService: ConfigService): string {
  const bucket = configService.get<string>('GCS_DUBBING_BUCKET');
  if (!bucket) {
    throw new Error('GCS_DUBBING_BUCKET is not configured');
  }
  return bucket;
}

// The helpers below default to the subtitle bucket; pass `bucket` (e.g.
// getDubbingBucketName(...)) to target another one.
export function gcsPublicUrl(configService: ConfigService, objectName: string, bucket?: string): string {
  return `https://storage.googleapis.com/${bucket ?? getBucketName(configService)}/${objectName}`;
}

export function gcsUri(configService: ConfigService, objectName: string, bucket?: string): string {
  return `gs://${bucket ?? getBucketName(configService)}/${objectName}`;
}

/**
 * v4 signed PUT URL for direct browser → GCS upload. The browser PUTs the file with
 * matching Content-Type. Single-request upload, good to GCS's PUT ceiling.
 * ponytail: single signed PUT, no resume — a dropped 2GB upload restarts from zero.
 * Upgrade to a resumable session URI (file.createResumableUpload) if drop rate hurts.
 */
export async function getSignedUploadUrl(
  configService: ConfigService,
  objectName: string,
  contentType: string,
  bucket?: string,
): Promise<string> {
  const storage = await getStorage(configService);
  const [url] = await storage
    .bucket(bucket ?? getBucketName(configService))
    .file(objectName)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });
  return url;
}

/** Reads object size/type. Throws if the object does not exist. */
export async function gcsObjectMetadata(
  configService: ConfigService,
  objectName: string,
  bucket?: string,
): Promise<{ size: number; contentType: string }> {
  const storage = await getStorage(configService);
  const [meta] = await storage
    .bucket(bucket ?? getBucketName(configService))
    .file(objectName)
    .getMetadata();
  return { size: Number(meta.size ?? 0), contentType: meta.contentType ?? 'application/octet-stream' };
}

export async function deleteGcsObject(configService: ConfigService, objectName: string, bucket?: string): Promise<void> {
  const storage = await getStorage(configService);
  await storage
    .bucket(bucket ?? getBucketName(configService))
    .file(objectName)
    .delete({ ignoreNotFound: true });
}

/** Object read stream — for burn, so a 2GB file streams to a temp file instead of into RAM. */
export async function gcsReadStream(configService: ConfigService, objectName: string): Promise<NodeJS.ReadableStream> {
  const storage = await getStorage(configService);
  return storage.bucket(getBucketName(configService)).file(objectName).createReadStream();
}

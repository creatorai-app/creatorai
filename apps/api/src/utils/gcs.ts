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

function getVideoBucketName(configService: ConfigService): string {
  const bucket = configService.get<string>('GCS_VIDEO_BUCKET');
  if (!bucket) {
    throw new Error('GCS_VIDEO_BUCKET is not configured');
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

/** gs:// prefix Veo writes generated video(s) into. Trailing slash: it's a folder. */
export function videoGcsOutputPrefix(configService: ConfigService, objectPrefix: string): string {
  return `gs://${getVideoBucketName(configService)}/${objectPrefix}`;
}

/** gs://bucket/object → https public URL (video bucket is public-read, like subtitles). */
export function gcsUriToPublicUrl(gsUri: string): string {
  // gs://bucket/a/b.mp4 → https://storage.googleapis.com/bucket/a/b.mp4
  return gsUri.replace(/^gs:\/\//, 'https://storage.googleapis.com/');
}

/** Delete an object from the video bucket by its gs:// URI (for job cleanup). */
export async function deleteVideoGcsUri(configService: ConfigService, gsUri: string): Promise<void> {
  const bucket = getVideoBucketName(configService);
  const prefix = `gs://${bucket}/`;
  if (!gsUri.startsWith(prefix)) return;
  const objectName = gsUri.slice(prefix.length);
  if (!objectName) return;
  const storage = await getStorage(configService);
  await storage.bucket(bucket).file(objectName).delete({ ignoreNotFound: true });
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
  expiresMs: number = 15 * 60 * 1000,
): Promise<string> {
  const storage = await getStorage(configService);
  const [url] = await storage
    .bucket(bucket ?? getBucketName(configService))
    .file(objectName)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresMs,
      contentType,
    });
  return url;
}

/**
 * Server-initiated resumable session the browser uploads into. `origin` must be the
 * browser's Origin: GCS decides the session's CORS headers from the initiating request,
 * so without it every browser PUT to the session fails CORS. Sessions last a week.
 */
export async function createResumableSession(
  configService: ConfigService,
  objectName: string,
  contentType: string,
  bucket: string,
  origin?: string,
): Promise<string> {
  const storage = await getStorage(configService);
  const [uri] = await storage
    .bucket(bucket)
    .file(objectName)
    .createResumableUpload({ metadata: { contentType }, ...(origin ? { origin } : {}) });
  return uri;
}

/**
 * How many bytes a resumable session has persisted. Asked from the server so the browser
 * never has to read GCS's `Range` header across origins.
 * `expired`: the session is gone (a week old, or cancelled) and a new one is needed.
 */
export async function resumableSessionOffset(
  sessionUri: string,
  size: number,
): Promise<{ uploadedBytes: number; complete: boolean; expired: boolean }> {
  const res = await fetch(sessionUri, {
    method: 'PUT',
    headers: { 'Content-Range': `bytes */${size}` },
    redirect: 'manual',
  });
  if (res.status === 200 || res.status === 201) return { uploadedBytes: size, complete: true, expired: false };
  if (res.status === 308) {
    const match = /bytes=0-(\d+)/.exec(res.headers.get('range') ?? '');
    return { uploadedBytes: match ? Number(match[1]) + 1 : 0, complete: false, expired: false };
  }
  if (res.status === 404 || res.status === 410) return { uploadedBytes: 0, complete: false, expired: true };
  throw new Error(`Could not read the upload session (${res.status})`);
}

function xmlObjectUrl(bucket: string, objectName: string, query: string): string {
  const path = objectName.split('/').map(encodeURIComponent).join('/');
  return `https://storage.googleapis.com/${bucket}/${path}?${query}`;
}

/** Authenticated XML API call with the same credentials the Storage client uses. */
async function xmlRequest(
  configService: ConfigService,
  method: 'GET' | 'POST' | 'DELETE',
  url: string,
  options: { headers?: Record<string, string>; body?: string } = {},
): Promise<string> {
  const storage = await getStorage(configService);
  const res = await storage.authClient.request<string>({
    method,
    url,
    headers: options.headers,
    data: options.body,
    responseType: 'text',
  });
  return res.data;
}

function xmlTag(xml: string, tag: string): string | null {
  return new RegExp(`<${tag}>([^<]*)</${tag}>`).exec(xml)?.[1] ?? null;
}

/** Start an XML API multipart upload. The object's Content-Type is fixed here. */
export async function initiateMultipartUpload(
  configService: ConfigService,
  objectName: string,
  contentType: string,
  bucket: string,
): Promise<string> {
  const xml = await xmlRequest(configService, 'POST', xmlObjectUrl(bucket, objectName, 'uploads'), {
    headers: { 'Content-Type': contentType },
  });
  const uploadId = xmlTag(xml, 'UploadId');
  if (!uploadId) throw new Error('GCS did not return a multipart upload id');
  return uploadId;
}

/** v4 signed PUT URL for one part. The browser sends the raw byte range, no headers. */
export async function signMultipartPartUrl(
  configService: ConfigService,
  objectName: string,
  uploadId: string,
  partNumber: number,
  bucket: string,
  expiresMs: number = 60 * 60 * 1000,
): Promise<string> {
  const storage = await getStorage(configService);
  const [url] = await storage
    .bucket(bucket)
    .file(objectName)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + expiresMs,
      queryParams: { partNumber: String(partNumber), uploadId },
    });
  return url;
}

export interface MultipartPart {
  partNumber: number;
  etag: string;
  size: number;
}

/**
 * Parts GCS already holds. This is the source of truth for a resume, so the browser never
 * reads an ETag header. ponytail: one page of 1000; uploads are planned to stay under it.
 */
export async function listMultipartParts(
  configService: ConfigService,
  objectName: string,
  uploadId: string,
  bucket: string,
): Promise<MultipartPart[]> {
  const query = new URLSearchParams({ uploadId, 'max-parts': '1000' }).toString();
  const xml = await xmlRequest(configService, 'GET', xmlObjectUrl(bucket, objectName, query));
  return [...xml.matchAll(/<Part>([\s\S]*?)<\/Part>/g)].map(([, part]) => ({
    partNumber: Number(xmlTag(part, 'PartNumber')),
    etag: xmlTag(part, 'ETag') ?? '',
    size: Number(xmlTag(part, 'Size')),
  }));
}

/** Stitch the parts into the final object. `parts` must be sorted by part number. */
export async function completeMultipartUpload(
  configService: ConfigService,
  objectName: string,
  uploadId: string,
  parts: MultipartPart[],
  bucket: string,
): Promise<void> {
  const body =
    '<CompleteMultipartUpload>' +
    parts.map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`).join('') +
    '</CompleteMultipartUpload>';
  const query = new URLSearchParams({ uploadId }).toString();
  await xmlRequest(configService, 'POST', xmlObjectUrl(bucket, objectName, query), {
    headers: { 'Content-Type': 'application/xml' },
    body,
  });
}

/** Drop an unfinished multipart upload and the parts it holds. Best-effort. */
export async function abortMultipartUpload(
  configService: ConfigService,
  objectName: string,
  uploadId: string,
  bucket: string,
): Promise<void> {
  const query = new URLSearchParams({ uploadId }).toString();
  await xmlRequest(configService, 'DELETE', xmlObjectUrl(bucket, objectName, query)).catch(() => null);
}

export async function deleteGcsPrefix(configService: ConfigService, prefix: string, bucket: string): Promise<void> {
  const storage = await getStorage(configService);
  await storage.bucket(bucket).deleteFiles({ prefix, force: true });
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

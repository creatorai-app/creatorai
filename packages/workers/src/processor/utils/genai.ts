import { GoogleGenAI } from '@google/genai';

export { GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, GEMINI_EMBEDDING_MODEL, GEMINI_VIDEO_MODEL } from '@repo/validation';

let cached: GoogleGenAI | null = null;

/**
 * Returns a singleton Vertex AI–backed GoogleGenAI client.
 *
 * Auth uses Application Default Credentials (ADC): a service-account key referenced by
 * GOOGLE_APPLICATION_CREDENTIALS, an attached service account on GCP, or
 * `gcloud auth application-default login` for local dev. No API key is used.
 */
export function getGenAI(): GoogleGenAI {
  if (cached) return cached;

  const project = process.env.GOOGLE_CLOUD_PROJECT;
  const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not configured (required for Vertex AI)');
  }

  cached = new GoogleGenAI({ vertexai: true, project, location });
  return cached;
}

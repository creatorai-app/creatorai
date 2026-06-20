import { GoogleGenAI } from '@google/genai';

/**
 * Gemini model ids used by the worker. Centralized so a model swap is a one-line change.
 * Override per-environment via env vars if needed.
 */
export const GEMINI_TEXT_MODEL = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash';
export const GEMINI_IMAGE_MODEL = process.env.GEMINI_IMAGE_MODEL || 'gemini-2.5-flash-image';
export const GEMINI_EMBEDDING_MODEL = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

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

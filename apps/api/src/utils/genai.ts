import { ConfigService } from '@nestjs/config';

export { GEMINI_TEXT_MODEL, GEMINI_IMAGE_MODEL, GEMINI_EMBEDDING_MODEL } from '@repo/validation';

type Part =
  | { text?: string }
  | { fileData?: { fileUri: string; mimeType: string } }
  | { inlineData?: { data: string; mimeType: string } };

export interface GoogleAIInstance {
  models: {
    generateContent(params: {
      model: string;
      contents: Array<{ role: string; parts: Part[] }>;
      config?: {
        responseMimeType?: string;
        responseJsonSchema?: unknown;
        [key: string]: unknown;
      };
    }): Promise<{ text: string }>;
  };
}

let cachedGoogleAI: GoogleAIInstance | null = null;
let cachedKey: string | null = null;

/**
 * Builds a Vertex AI–backed GoogleGenAI client.
 *
 * Auth uses Application Default Credentials (ADC): a service-account key referenced by
 * GOOGLE_APPLICATION_CREDENTIALS, an attached service account on GCP (Cloud Run/GKE), or
 * `gcloud auth application-default login` for local dev. No API key is used.
 */
export async function createGoogleAI(configService: ConfigService): Promise<GoogleAIInstance> {
  const project = configService.get<string>('GOOGLE_CLOUD_PROJECT');
  const location = configService.get<string>('GOOGLE_CLOUD_LOCATION') || 'global';

  if (!project) {
    throw new Error('GOOGLE_CLOUD_PROJECT is not configured (required for Vertex AI)');
  }

  const cacheKey = `${project}:${location}`;
  if (cachedGoogleAI && cachedKey === cacheKey) {
    return cachedGoogleAI;
  }

  const mod = await (Function('return import("@google/genai")')() as Promise<{
    GoogleGenAI: new (opts: { vertexai: boolean; project: string; location: string }) => GoogleAIInstance;
  }>);
  cachedGoogleAI = new mod.GoogleGenAI({ vertexai: true, project, location });
  cachedKey = cacheKey;
  return cachedGoogleAI;
}

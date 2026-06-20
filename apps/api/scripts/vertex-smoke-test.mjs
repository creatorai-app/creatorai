/**
 * Vertex AI smoke test — verifies ADC auth + model access before running the app.
 *
 * Prereqs (see README / docs/SETUP.md):
 *   - Vertex AI API enabled on the project
 *   - Auth ready: `gcloud auth application-default login` OR GOOGLE_APPLICATION_CREDENTIALS set
 *   - env: GOOGLE_CLOUD_PROJECT, GOOGLE_CLOUD_LOCATION (e.g. global)
 *
 * Run from apps/api:  node scripts/vertex-smoke-test.mjs
 */
import { GoogleGenAI } from '@google/genai';

const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION || 'global';
const textModel = process.env.GEMINI_TEXT_MODEL || 'gemini-3.5-flash';
const embedModel = process.env.GEMINI_EMBEDDING_MODEL || 'gemini-embedding-001';

if (!project) {
  console.error('❌ GOOGLE_CLOUD_PROJECT is not set');
  process.exit(1);
}

const ai = new GoogleGenAI({ vertexai: true, project, location });
console.log(`→ Vertex AI: project=${project} location=${location}`);

try {
  const gen = await ai.models.generateContent({
    model: textModel,
    contents: [{ role: 'user', parts: [{ text: 'Reply with exactly: VERTEX_OK' }] }],
  });
  console.log(`✅ ${textModel}: ${gen.text?.trim()}`);

  const emb = await ai.models.embedContent({
    model: embedModel,
    contents: 'hello world',
    config: { outputDimensionality: 1536, taskType: 'RETRIEVAL_DOCUMENT' },
  });
  const dims = emb?.embeddings?.[0]?.values?.length;
  console.log(`✅ ${embedModel}: embedding length = ${dims} (expected 1536)`);

  console.log('\n🎉 Vertex AI is wired up correctly.');
} catch (err) {
  console.error('❌ Vertex call failed:', err?.message || err);
  console.error('\nCommon causes: API not enabled, missing roles/aiplatform.user, wrong project/location, or ADC not configured.');
  process.exit(1);
}

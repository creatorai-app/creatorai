import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createGoogleAI, GEMINI_TEXT_MODEL } from '../utils/genai';

/**
 * The ungated versions of ideation and script generation that power the public
 * /tools pages. Same Gemini model and the same prompt spine as the real
 * features, deliberately trimmed:
 *
 *   - one idea / one script per call, never a batch
 *   - no channel connection, so no Creator DNA, no trend snapshot, no
 *     differentiation pass — the personalization IS the paid product
 *   - synchronous, so there is no queue, no job row and nothing to poll
 *   - no credits and no user, so nothing to deduct against
 *
 * Anonymous by design; abuse control is the per-IP window in the controller.
 */

const IDEA_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Primary video title, optimized for CTR' },
    titleVariations: {
      type: 'array',
      items: { type: 'string' },
      description: 'Exactly 2 alternative title options',
    },
    uniqueAngle: { type: 'string', description: 'What makes this different from existing content' },
    whyItWorks: { type: 'string', description: 'Trend insight + audience psychology, 2 sentences' },
    hookAngle: { type: 'string', description: 'A specific opening concept for the first 15 seconds' },
    suggestedFormat: {
      type: 'string',
      description: 'Tutorial, Breakdown, Commentary, Case Study, Listicle, How-to, Comparison or Reaction',
    },
    targetKeywords: { type: 'array', items: { type: 'string' }, description: '3-5 search keywords' },
    talkingPoints: { type: 'array', items: { type: 'string' }, description: '5-7 points that structure the video' },
    opportunityScore: { type: 'number', description: 'Score 0-100 for trend momentum and competition gap' },
  },
  required: [
    'title', 'titleVariations', 'uniqueAngle', 'whyItWorks', 'hookAngle',
    'suggestedFormat', 'targetKeywords', 'talkingPoints', 'opportunityScore',
  ],
} as const;

const SCRIPT_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Suggested, SEO-friendly video title' },
    script: { type: 'string', description: 'Full script in markdown format' },
  },
  required: ['title', 'script'],
} as const;

export interface FreeIdea {
  title: string;
  titleVariations: string[];
  uniqueAngle: string;
  whyItWorks: string;
  hookAngle: string;
  suggestedFormat: string;
  targetKeywords: string[];
  talkingPoints: string[];
  opportunityScore: number;
}

export interface FreeScript {
  title: string;
  script: string;
}

@Injectable()
export class FreeToolsService {
  private readonly logger = new Logger(FreeToolsService.name);

  constructor(private readonly configService: ConfigService) {}

  private async generateJson<T>(prompt: string, schema: unknown, label: string): Promise<T> {
    try {
      const ai = await createGoogleAI(this.configService);
      const response = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { responseMimeType: 'application/json', responseJsonSchema: schema },
      });

      const raw =
        (response as any)?.candidates?.[0]?.content?.parts?.[0]?.text ?? response?.text ?? '';
      if (!raw) throw new Error('AI returned an empty response');

      return JSON.parse(raw) as T;
    } catch (error) {
      this.logger.error(`Free ${label} generation failed: ${(error as Error).message}`);
      throw new InternalServerErrorException(
        `Could not generate ${label} right now. Please try again in a moment.`,
      );
    }
  }

  async generateIdea(niche: string, audience?: string): Promise<FreeIdea> {
    const prompt = `You are an expert YouTube content strategist. Generate exactly ONE high-potential video idea.

NICHE / TOPIC: ${niche}
${audience ? `TARGET AUDIENCE: ${audience}` : ''}

RULES:
- Pick an under-served angle rather than the most obvious video on this topic.
- opportunityScore (0-100) should reflect trend momentum and how crowded the topic already is. Be honest — a saturated topic scores low.
- hookAngle: describe a specific opening for the first 15 seconds, not a generic "start with a question".
- suggestedFormat: pick the single best format for this idea.
- talkingPoints: 5-7 points that actually structure the video, in order.
- titleVariations: exactly 2 alternatives, optimized for click-through.
- Write in plain, concrete language. No filler, no hedging, no emoji.`;

    return this.generateJson<FreeIdea>(prompt, IDEA_SCHEMA, 'idea');
  }

  async generateScript(
    topic: string,
    tone: string,
    duration: number,
    options: { storytelling?: boolean; timestamps?: boolean } = {},
  ): Promise<FreeScript> {
    const minutes = Math.max(1, Math.round(duration / 60));
    const prompt = `You are an expert YouTube script writer. Generate a compelling, ready-to-record YouTube video script.

**Video topic:** ${topic}
**Tone:** ${tone}
**Target duration:** ${duration} seconds (about ${minutes} minute${minutes === 1 ? '' : 's'})
**Include storytelling elements:** ${options.storytelling ? 'Yes' : 'No'}
**Include timestamps:** ${options.timestamps ? 'Yes' : 'No'}

Guidelines:
- Generate a catchy, SEO-friendly title.
- Write the full script in markdown, using ## section headings.
- Open with a hook that earns the first 15 seconds — no channel-intro throat-clearing.
- Match the target duration at a natural speaking pace of roughly 150 words per minute.
- Include clear transitions between sections and one strong call-to-action at the end.
- Write it to be read aloud on camera: short sentences, spoken rhythm, no stage directions beyond the headings.
${options.storytelling ? '- Weave a narrative through the script: a concrete opening situation, tension that builds, and a payoff. Do not just list facts.' : ''}
${options.timestamps ? '- Prefix each section heading with an estimated time marker like [0:00], paced at roughly 150 words per minute.' : ''}
- No emoji, no placeholder text, no "[insert X here]".`;

    return this.generateJson<FreeScript>(prompt, SCRIPT_SCHEMA, 'script');
  }
}

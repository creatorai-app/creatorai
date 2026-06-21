import {
  Injectable,
  ForbiddenException,
  InternalServerErrorException,
  BadRequestException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import { createGoogleAI, GEMINI_TEXT_MODEL } from '../utils/genai';

const COURSE_MODULE_SCHEMA = {
  type: 'object',
  properties: {
    title: { type: 'string', description: 'Course title' },
    description: { type: 'string', description: 'Course description' },
    videoCount: { type: 'integer', description: 'Number of videos in the course' },
    difficulty: { type: 'string', description: 'Difficulty level' },
    estimatedDuration: { type: 'string', description: 'Total estimated duration' },
    videos: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer', description: 'Video sequence number' },
          title: { type: 'string', description: 'Video title' },
          duration: { type: 'string', description: 'Estimated duration' },
          description: { type: 'string', description: 'Video description' },
          script: { type: 'string', description: 'Full script outline' },
        },
        required: ['id', 'title', 'duration', 'description', 'script'],
      },
      minItems: 1,
    },
  },
  required: ['title', 'description', 'videoCount', 'difficulty', 'estimatedDuration', 'videos'],
} as const;

@Injectable()
export class CourseService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  private get supabase() {
    return this.supabaseService.getClient();
  }

  async generate(userId: string, body: {
    topic: string;
    description?: string;
    difficulty?: string;
    videoCount?: number;
    references?: string;
  }) {
    if (!body.topic) throw new BadRequestException('Topic is required');

    const { data: profileData, error: profileError } = await this.supabase
      .from('profiles')
      .select('credits')
      .eq('user_id', userId)
      .single();

    if (profileError) throw new InternalServerErrorException('Failed to fetch user profile');
    if (profileData.credits < 2) {
      throw new ForbiddenException('Insufficient credits. Course modules require 2 credits.');
    }

    const prompt = `
Create a detailed course module outline for a YouTube course on "${body.topic}".

Additional details:
- Description: ${body.description || `A comprehensive course on ${body.topic}`}
- Difficulty level: ${body.difficulty || 'intermediate'}
- Number of videos: ${body.videoCount || 5}
${body.references ? `- References to include: ${body.references}` : ''}

For each video in the course, include:
1. A title
2. Duration (estimated)
3. Brief description
4. A complete script outline with sections for intro, main content, key points, and conclusion
`;

    const ai = await createGoogleAI(this.configService);

    let result: any;
    try {
      result = await ai.models.generateContent({
        model: GEMINI_TEXT_MODEL,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: {
          responseMimeType: 'application/json',
          responseJsonSchema: COURSE_MODULE_SCHEMA,
        },
      });
    } catch {
      throw new InternalServerErrorException('Failed to generate course module');
    }

    const rawText = result?.candidates?.[0]?.content?.parts?.[0]?.text ?? result?.text;
    if (!rawText) throw new InternalServerErrorException('AI returned an empty response');

    let courseModule: any;
    try {
      courseModule = JSON.parse(rawText);
    } catch {
      throw new InternalServerErrorException('Failed to parse course module data');
    }

    const { error: creditError } = await this.supabase.rpc('update_user_credits', {
      user_uuid: userId,
      credit_change: -2,
    });

    if (creditError) {
      throw new ForbiddenException('Insufficient credits. Please upgrade your plan.');
    }

    return courseModule;
  }
}

/**
 * The Gemini `responseJsonSchema` for a story blueprint.
 *
 * Lives here rather than in the worker because two callers now need the exact
 * same shape: the paid story-builder job, and the anonymous /tools sample whose
 * output has to materialize into `story_builder_jobs.result` and render in the
 * dashboard unchanged. Two copies would drift the first time a field is added,
 * and the failure mode is a claimed blueprint with empty sections.
 */
export const STORY_BLUEPRINT_RESPONSE_SCHEMA = {
  type: 'object',
  properties: {
    structuredBlueprint: {
      type: 'object',
      properties: {
        hook: {
          type: 'object',
          properties: {
            curiosityStatement: { type: 'string', description: 'A statement that sparks curiosity in the first 5 seconds' },
            promise: { type: 'string', description: 'What the viewer will gain by watching' },
            stakes: { type: 'string', description: 'What is at risk or why this matters now' },
            openingLine: { type: 'string', description: 'Exact opening script line' },
            visualSuggestion: { type: 'string', description: 'What viewer should see during hook (0-15 sec)' },
            emotionalTrigger: { type: 'string', description: 'Primary emotion targeted' },
          },
          required: ['curiosityStatement', 'promise', 'stakes', 'openingLine', 'visualSuggestion', 'emotionalTrigger'],
        },
        contextSetup: {
          type: 'object',
          properties: {
            problem: { type: 'string', description: 'The core problem or question (15-45 sec)' },
            whyItMatters: { type: 'string', description: 'Why the viewer should care about this now' },
            backgroundInfo: { type: 'string', description: 'Essential context to understand the topic' },
          },
          required: ['problem', 'whyItMatters', 'backgroundInfo'],
        },
        escalationSegments: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              segmentNumber: { type: 'number' },
              title: { type: 'string' },
              microHook: { type: 'string', description: 'Mini-hook to re-engage attention at start of segment' },
              insight: { type: 'string', description: 'Core insight or value delivered' },
              transitionTension: { type: 'string', description: 'How this segment creates tension leading into the next' },
              estimatedDuration: { type: 'string' },
            },
            required: ['segmentNumber', 'title', 'microHook', 'insight', 'transitionTension', 'estimatedDuration'],
          },
          minItems: 3,
        },
        climax: {
          type: 'object',
          properties: {
            biggestInsight: { type: 'string', description: 'The most impactful revelation' },
            unexpectedTwist: { type: 'string', description: 'Surprising angle or counter-intuitive point' },
            coreValueMoment: { type: 'string', description: 'The deeper meaning or takeaway' },
          },
          required: ['biggestInsight', 'unexpectedTwist', 'coreValueMoment'],
        },
        resolution: {
          type: 'object',
          properties: {
            closeLoop: { type: 'string', description: 'How the opening promise is fulfilled' },
            reinforceTransformation: { type: 'string', description: 'Restate what viewer now knows/can do' },
            softCTA: { type: 'string', description: 'Natural call-to-action that fits the narrative' },
          },
          required: ['closeLoop', 'reinforceTransformation', 'softCTA'],
        },
      },
      required: ['hook', 'contextSetup', 'escalationSegments', 'climax', 'resolution'],
    },
    tensionMapping: {
      type: 'object',
      properties: {
        retentionScore: { type: 'number', description: 'Overall predicted retention 0-10' },
        curiosityLoops: { type: 'number', description: 'Number of curiosity loops planted' },
        emotionalPeaks: { type: 'number', description: 'Number of emotional high points' },
        predictedDropRisk: { type: 'string', description: 'low, medium, or high' },
        sectionScores: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              section: { type: 'string' },
              curiosityDensity: { type: 'number', description: '0-10 score' },
              emotionalShift: { type: 'number', description: '0-10 score' },
              informationSpike: { type: 'number', description: '0-10 score' },
              overallScore: { type: 'number', description: '0-10 score' },
            },
            required: ['section', 'curiosityDensity', 'emotionalShift', 'informationSpike', 'overallScore'],
          },
        },
      },
      required: ['retentionScore', 'curiosityLoops', 'emotionalPeaks', 'predictedDropRisk', 'sectionScores'],
    },
    retentionBeats: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['timestamp', 'type', 'description'],
      },
      minItems: 4,
    },
    openLoops: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          setup: { type: 'string' },
          payoffTimestamp: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['setup', 'payoffTimestamp', 'description'],
      },
      minItems: 2,
    },
    patternInterrupts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          type: { type: 'string' },
          description: { type: 'string' },
        },
        required: ['timestamp', 'type', 'description'],
      },
      minItems: 4,
    },
    emotionalArc: {
      type: 'object',
      properties: {
        structure: { type: 'string' },
        beats: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              phase: { type: 'string' },
              emotion: { type: 'string' },
              timestamp: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['phase', 'emotion', 'timestamp', 'description'],
          },
          minItems: 4,
        },
      },
      required: ['structure', 'beats'],
    },
    ctaPlacement: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          timestamp: { type: 'string' },
          type: { type: 'string' },
          script: { type: 'string' },
          rationale: { type: 'string' },
        },
        required: ['timestamp', 'type', 'script', 'rationale'],
      },
      minItems: 2,
    },
    storyPacing: {
      type: 'object',
      properties: {
        overview: { type: 'string' },
        sections: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string' },
              duration: { type: 'string' },
              pace: { type: 'string' },
              description: { type: 'string' },
            },
            required: ['name', 'duration', 'pace', 'description'],
          },
          minItems: 4,
        },
      },
      required: ['overview', 'sections'],
    },
    fullOutline: {
      type: 'string',
      description: 'Complete production outline incorporating all blueprint sections. Modular, not free-flow. Min 300 words.',
    },
    detectedContentType: {
      type: 'string',
      description: 'AI-detected best content type for this topic if different from user selection',
    },
  },
  required: [
    'structuredBlueprint', 'tensionMapping', 'retentionBeats', 'openLoops',
    'patternInterrupts', 'emotionalArc', 'ctaPlacement', 'storyPacing', 'fullOutline',
  ],
} as const;

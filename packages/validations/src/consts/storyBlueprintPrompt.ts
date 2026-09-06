/**
 * The story-blueprint prompt spine, shared by the paid worker job and the
 * anonymous /tools sample.
 *
 * Only the creator-profile block differs between the two: the paid job appends
 * one built from `user_style` + `youtube_channels`, the free sample has no
 * channel to read and appends nothing. Everything else, the story-mode
 * definitions, the structure templates and the numbered requirements, is what
 * makes the model fill STORY_BLUEPRINT_RESPONSE_SCHEMA correctly, so it lives
 * in one place. A second copy would drift, and a drifted free prompt produces a
 * blueprint that renders with holes once it is claimed into the dashboard.
 */

export interface StoryBlueprintPromptInput {
  videoTopic: string;
  /** Pre-resolved display labels, e.g. VIDEO_DURATION_LABELS[videoDuration]. */
  durationLabel: string;
  contentLabel: string;
  storyModeLabel: string;
  audienceLevel: string;
  targetAudience?: string;
  tone?: string;
  additionalContext?: string;
  ideationContext?: string;
  /** The paid job's creator-style block. Omitted for anonymous runs. */
  creatorSection?: string;
}

export function buildStoryBlueprintPrompt({
  videoTopic,
  durationLabel,
  contentLabel,
  storyModeLabel,
  audienceLevel,
  targetAudience,
  tone,
  additionalContext,
  ideationContext,
  creatorSection,
}: StoryBlueprintPromptInput): string {
  return `You are an expert YouTube content strategist specializing in story structure and retention optimization. Generate a comprehensive, MODULAR (not free-flow) story blueprint.

**Video Topic:** ${videoTopic}
**Structure Template:** ${contentLabel}
**Story Mode:** ${storyModeLabel}
**Video Duration:** ${durationLabel}
**Audience Level:** ${audienceLevel}
${targetAudience ? `**Target Audience:** ${targetAudience}` : ''}
${tone ? `**Desired Tone:** ${tone}` : ''}
${additionalContext ? `**Additional Context:** ${additionalContext}` : ''}
${ideationContext ? `**Idea Context from Ideation:** ${ideationContext}` : ''}
${creatorSection ?? ''}

STORY MODE "${storyModeLabel}" means:
- Cinematic: Dramatic visuals, slow reveals, epic tone, wide establishing shots
- High-Energy: Fast cuts, bold statements, rapid pacing, high intensity
- Documentary: Facts-first, interviews-style, measured pacing, authoritative
- Conversational: Casual, direct-to-camera, personal, relatable, as if talking to a friend
- Dramatic: Tension-heavy, cliffhangers, emotional peaks, suspenseful reveals
- Minimal: Clean, simple, essential info only, no fluff, elegant pacing

STRUCTURE TEMPLATE "${contentLabel}" shapes the escalation segments:
- Educational Breakdown: Progressive complexity, concept stacking
- Commentary: Opinion-led, reaction-driven, hot takes with evidence
- Documentary: Evidence gathering → reveal → impact → implications
- Case Study: Setup → investigation → findings → lessons → application
- Personal Story: Situation → struggle → turning point → transformation
- Listicle: Ranked items with escalating value, each standalone
- Tutorial: Setup → step-by-step → common mistakes → pro tips

REQUIREMENTS:
1. **Structured Blueprint** must be MODULAR with:
   - Hook (0-15 sec): curiosity statement, promise, stakes
   - Context Setup (15-45 sec): problem, why it matters
   - Escalation: 3-5 segments, each with micro-hook, insight, transition tension
   - Climax: biggest insight, unexpected twist, core value moment
   - Resolution + Callback: close loop, reinforce transformation, soft CTA

2. **Tension Mapping** must calculate:
   - retentionScore (0-10 overall)
   - curiosityLoops count
   - emotionalPeaks count
   - predictedDropRisk (low/medium/high)
   - Per-section scores for curiosityDensity, emotionalShift, informationSpike (each 0-10)

3. Retention beats (4-6), open loops (2-4), pattern interrupts (4-6), emotional arc (4-6 phases), CTAs (2-3, never first 30s), pacing sections (4-6)

4. fullOutline must be modular and detailed (300+ words), not free-flow text

5. If the chosen content type doesn't fit the topic well, suggest a better one in detectedContentType

6. All timestamps must be realistic for ${durationLabel}`;
}

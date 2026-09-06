import { scriptRow, ideaRow, storyRow } from './free-tool-runs.service';

/**
 * The row builders are the part of the claim that can fail silently: they turn
 * an anonymous run into a row in a table the dashboard renders, and a missing
 * field shows up as an empty panel on a page the user just signed up to see,
 * not as an error anyone notices.
 *
 * NOW is fixed so the assertions are about mapping, not about the clock.
 */
const NOW = '2026-09-06T12:00:00.000Z';
const USER = 'user-1';

describe('claiming a free script', () => {
  const output = { title: 'Why your espresso tastes sour', script: '## Hook\nStop.' };

  it('lands as a completed script with the generated content', () => {
    const row = scriptRow(USER, { topic: 'espresso', tone: 'funny', duration: 300 }, output, NOW);
    expect(row.user_id).toBe(USER);
    expect(row.title).toBe(output.title);
    expect(row.content).toBe(output.script);
    expect(row.status).toBe('completed');
  });

  it('costs no credits: the generation was already free', () => {
    expect(scriptRow(USER, { topic: 'espresso' }, output, NOW).credits_consumed).toBe(0);
  });

  it('carries the visitor’s own tone and duration rather than the defaults', () => {
    const row = scriptRow(USER, { topic: 'espresso', tone: 'funny', duration: 300 }, output, NOW);
    expect(row.tone).toBe('funny');
    expect(row.duration).toBe(300);
  });

  it('never writes an empty title, which would render as a blank history row', () => {
    const row = scriptRow(USER, { topic: 'espresso' }, { title: '', script: 'x' }, NOW);
    expect(row.title).toBe('espresso');
    expect(scriptRow(USER, {}, { title: '', script: '' }, NOW).title).toBe('Untitled script');
  });
});

describe('claiming a free idea', () => {
  const output = {
    title: 'Sour espresso, fixed',
    titleVariations: ['a', 'b'],
    uniqueAngle: 'angle',
    whyItWorks: 'because',
    hookAngle: 'hook',
    suggestedFormat: 'Tutorial',
    targetKeywords: ['espresso'],
    talkingPoints: ['one', 'two'],
    opportunityScore: 72,
  };

  it('wraps the single idea in the ideas[] the dashboard reads', () => {
    const row = ideaRow(USER, { niche: 'home espresso' }, output, NOW);
    expect(row.result.ideas).toHaveLength(1);
    expect(row.result.ideas[0]!.title).toBe(output.title);
    expect(row.idea_count).toBe(1);
    expect(row.status).toBe('completed');
  });

  it('fills the fields the free generator has no channel to derive', () => {
    const idea = ideaRow(USER, { niche: 'home espresso' }, output, NOW).result.ideas[0]!;
    // IdeaCard prints trendMomentum as text; undefined renders an empty badge.
    expect(idea.trendMomentum).toBe('stable');
    expect(idea.coreTopic).toBe('home espresso');
    expect(idea.referenceSignals).toEqual([]);
    expect(idea.id).toBeTruthy();
  });

  it('omits trendSnapshot and channelFit, which need a connected channel', () => {
    const row = ideaRow(USER, { niche: 'home espresso' }, output, NOW);
    expect(row.result).not.toHaveProperty('trendSnapshot');
    expect(row.result).not.toHaveProperty('channelFit');
  });

  it('survives a generation that came back missing array fields', () => {
    const idea = ideaRow(USER, {}, {} as never, NOW).result.ideas[0]!;
    // The dashboard maps over all three without guarding.
    expect(idea.titleVariations).toEqual([]);
    expect(idea.targetKeywords).toEqual([]);
    expect(idea.talkingPoints).toEqual([]);
  });
});

describe('claiming a free story blueprint', () => {
  const blueprint = { structuredBlueprint: { hook: {} }, tensionMapping: { retentionScore: 8 } };

  it('stores the blueprint verbatim, so the dashboard renders every section', () => {
    const row = storyRow(
      USER,
      {
        videoTopic: 'espresso',
        videoDuration: 'long',
        contentType: 'case_study',
        storyMode: 'documentary',
        audienceLevel: 'beginner',
      },
      blueprint,
      NOW,
    );
    expect(row.result).toBe(blueprint);
    expect(row.video_topic).toBe('espresso');
    expect(row.status).toBe('completed');
    expect(row.credits_consumed).toBe(0);
  });

  it('keeps the structural choices the visitor made on the public page', () => {
    const row = storyRow(
      USER,
      {
        videoTopic: 'espresso',
        videoDuration: 'long',
        contentType: 'case_study',
        storyMode: 'documentary',
        audienceLevel: 'beginner',
      },
      blueprint,
      NOW,
    );
    expect(row.video_duration).toBe('long');
    expect(row.content_type).toBe('case_study');
    expect(row.story_mode).toBe('documentary');
    expect(row.audience_level).toBe('beginner');
  });

  it('falls back to the same defaults the paid form uses', () => {
    const row = storyRow(USER, { videoTopic: 'espresso' }, blueprint, NOW);
    expect(row.video_duration).toBe('medium');
    expect(row.content_type).toBe('tutorial');
    expect(row.story_mode).toBe('conversational');
    expect(row.audience_level).toBe('general');
    expect(row.target_audience).toBeNull();
  });
});

import { Test, TestingModule } from '@nestjs/testing';
import { InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { FreeToolsService } from './free-tools.service';
import { createGoogleAI } from '../utils/genai';

jest.mock('../utils/genai', () => ({
  createGoogleAI: jest.fn(),
  GEMINI_TEXT_MODEL: 'gemini-test',
}));

/** Stands in for the genai client; `resolve` is whatever generateContent returns. */
function mockGemini(resolve: unknown) {
  const generateContent = jest.fn().mockResolvedValue(resolve);
  (createGoogleAI as jest.Mock).mockResolvedValue({ models: { generateContent } });
  return generateContent;
}

const candidate = (text: string) => ({ candidates: [{ content: { parts: [{ text }] } }] });

const storyInput = {
  videoTopic: 'Why espresso tastes sour',
  audienceLevel: 'general',
  videoDuration: 'medium',
  contentType: 'educational',
  storyMode: 'explainer',
} as any;

describe('FreeToolsService', () => {
  let service: FreeToolsService;

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      providers: [FreeToolsService, { provide: ConfigService, useValue: { get: () => undefined } }],
    }).compile();
    service = module.get(FreeToolsService);
  });

  describe('generateIdea', () => {
    it('returns the parsed idea and asks for JSON back', async () => {
      const gen = mockGemini(candidate('{"title":"Sour espresso, explained"}'));
      await expect(service.generateIdea('home espresso')).resolves.toEqual({
        title: 'Sour espresso, explained',
      });
      expect(gen.mock.calls[0][0].config.responseMimeType).toBe('application/json');
    });

    it('puts the niche in the prompt, and the audience only when given', async () => {
      const gen = mockGemini(candidate('{}'));
      await service.generateIdea('home espresso');
      expect(gen.mock.calls[0][0].contents[0].parts[0].text).not.toContain('TARGET AUDIENCE');

      await service.generateIdea('home espresso', 'new baristas');
      const prompt = gen.mock.calls[1][0].contents[0].parts[0].text;
      expect(prompt).toContain('home espresso');
      expect(prompt).toContain('TARGET AUDIENCE: new baristas');
    });

    it('falls back to response.text when the SDK returns no candidates', async () => {
      mockGemini({ text: '{"title":"from .text"}' });
      await expect(service.generateIdea('home espresso')).resolves.toEqual({ title: 'from .text' });
    });
  });

  describe('generateScript', () => {
    it('describes the duration in whole minutes for the model', async () => {
      const gen = mockGemini(candidate('{"title":"t","script":"s"}'));
      await service.generateScript('espresso', 'conversational', 300);
      const prompt = gen.mock.calls[0][0].contents[0].parts[0].text;
      expect(prompt).toContain('300 seconds (about 5 minutes)');
    });

    it('never asks for a zero-minute script', async () => {
      // duration/60 rounds to 0 under 30s, which would produce a nonsense instruction.
      const gen = mockGemini(candidate('{}'));
      await service.generateScript('espresso', 'conversational', 10);
      expect(gen.mock.calls[0][0].contents[0].parts[0].text).toContain('about 1 minute');
    });

    it('singularizes the one-minute case', async () => {
      const gen = mockGemini(candidate('{}'));
      await service.generateScript('espresso', 'conversational', 60);
      const prompt = gen.mock.calls[0][0].contents[0].parts[0].text;
      expect(prompt).toContain('about 1 minute)');
      expect(prompt).not.toContain('1 minutes');
    });

    it('adds the storytelling and timestamp instructions only when opted into', async () => {
      const gen = mockGemini(candidate('{}'));
      await service.generateScript('espresso', 'conversational', 180);
      expect(gen.mock.calls[0][0].contents[0].parts[0].text).not.toContain('[0:00]');

      await service.generateScript('espresso', 'conversational', 180, {
        storytelling: true,
        timestamps: true,
      });
      const prompt = gen.mock.calls[1][0].contents[0].parts[0].text;
      expect(prompt).toContain('[0:00]');
      expect(prompt).toContain('Weave a narrative');
    });
  });

  describe('generateStory', () => {
    it('stamps the requested mode onto the blueprint the dashboard will claim', async () => {
      mockGemini(candidate('{"hook":"Pour a shot"}'));
      await expect(service.generateStory(storyInput)).resolves.toEqual({
        hook: 'Pour a shot',
        storyMode: 'explainer',
      });
    });

    it('overrides a mode the model invented with the one the visitor picked', async () => {
      mockGemini(candidate('{"storyMode":"documentary"}'));
      const result = await service.generateStory(storyInput);
      expect(result.storyMode).toBe('explainer');
    });
  });

  describe('failure handling', () => {
    it.each([
      ['an empty response', candidate('')],
      ['malformed JSON', candidate('not json at all')],
    ])('turns %s into a retryable message, not a crash', async (_label, response) => {
      mockGemini(response);
      await expect(service.generateIdea('home espresso')).rejects.toThrow(InternalServerErrorException);
    });

    it('does not leak the upstream error to an anonymous visitor', async () => {
      (createGoogleAI as jest.Mock).mockRejectedValue(new Error('vertex 403 project-secret'));
      await expect(service.generateScript('espresso', 'conversational', 180)).rejects.toThrow(
        /Could not generate script right now/,
      );
    });

    it('names the tool that failed so the log points at the right path', async () => {
      mockGemini(candidate('nope'));
      await expect(service.generateStory(storyInput)).rejects.toThrow(/story blueprint/);
    });
  });
});

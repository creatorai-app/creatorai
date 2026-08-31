import { InternalServerErrorException } from '@nestjs/common';
import * as genai from '../utils/genai';
import { HannahService } from './hannah.service';

/**
 * Vertex returns a candidate with no `parts` when a safety filter fires. That used to
 * surface as a 500 that alerted us every time someone baited the public bot.
 */
describe('HannahService.chat empty-candidate handling', () => {
  const service = new HannahService(
    { get: () => 'test' } as never,
    { getClient: () => { throw new Error('unused on the public route'); } } as never,
  );

  const respondWith = (response: unknown) =>
    jest
      .spyOn(genai, 'createGoogleAI')
      .mockResolvedValue({ models: { generateContent: async () => response } } as never);

  const ask = () => service.chat([{ role: 'user', content: 'hi' }], 'public');

  afterEach(() => jest.restoreAllMocks());

  it.each(['SAFETY', 'PROHIBITED_CONTENT', 'RECITATION', 'BLOCKLIST', 'SPII'])(
    'answers in band when the candidate is blocked with %s',
    async (finishReason) => {
      respondWith({ candidates: [{ finishReason, content: {} }] });
      await expect(ask()).resolves.toEqual({ reply: expect.stringContaining("can't help with that one") });
    },
  );

  it('still throws when the response is empty for a benign reason, naming it', async () => {
    respondWith({ candidates: [{ finishReason: 'MAX_TOKENS', content: { parts: [] } }] });
    await expect(ask()).rejects.toThrow(
      new InternalServerErrorException('Hannah returned an empty response (finishReason: MAX_TOKENS).'),
    );
  });

  it('returns the reply on the happy path', async () => {
    respondWith({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hello!' }] } }] });
    await expect(ask()).resolves.toEqual({ reply: 'Hello!' });
  });
});

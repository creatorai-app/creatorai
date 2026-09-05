import { Test, TestingModule } from '@nestjs/testing';
import { getQueueToken } from '@nestjs/bullmq';
import { EmailCampaignService } from './email-campaign.service';
import { SupabaseService } from '../supabase/supabase.service';

type Result = { data?: unknown; error?: null; count?: number };

// Supabase query builders are chainable thenables — every filter returns the
// builder and awaiting it resolves the result. One stub per table is enough.
function builder(result: Result) {
  const chain: Record<string, unknown> = {};
  for (const method of ['select', 'eq', 'in', 'not', 'order', 'lte', 'gte']) {
    chain[method] = () => chain;
  }
  chain.then = (resolve: (r: Result) => unknown) =>
    Promise.resolve(result).then(resolve);
  return chain;
}

async function buildService(tables: Record<string, Result>) {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      EmailCampaignService,
      {
        provide: SupabaseService,
        useValue: {
          getAdminClient: () => ({
            from: (table: string) => builder(tables[table] ?? { data: [], error: null }),
          }),
        },
      },
      { provide: getQueueToken('email-campaign'), useValue: { add: jest.fn() } },
    ],
  }).compile();
  return module.get(EmailCampaignService);
}

describe('EmailCampaignService batching', () => {
  describe('previewRecipients', () => {
    it('flags who the template already reached and drops unsubscribed users', async () => {
      const service = await buildService({
        profiles: {
          data: [
            { user_id: 'u1', email: 'a@test.com', full_name: 'A', ai_trained: true },
            { user_id: 'u2', email: 'b@test.com', full_name: 'B', ai_trained: true },
            { user_id: 'u3', email: 'c@test.com', full_name: 'C', ai_trained: true },
          ],
          error: null,
        },
        youtube_channels: { data: [], error: null },
        subscriptions: { data: [], error: null },
        email_unsubscribes: { data: [{ user_id: 'u3' }], error: null },
        email_sends: { data: [{ delivered_ids: ['u1'] }], error: null },
      });

      const recipients = await service.previewRecipients({}, 'tpl-1');

      expect(recipients.map((r) => r.id)).toEqual(['u1', 'u2']); // u3 opted out
      expect(recipients.find((r) => r.id === 'u1')?.alreadySent).toBe(true);
      expect(recipients.find((r) => r.id === 'u2')?.alreadySent).toBe(false);
    });

    it('leaves recipients unflagged when no template is in scope', async () => {
      const service = await buildService({
        profiles: {
          data: [{ user_id: 'u1', email: 'a@test.com', full_name: 'A', ai_trained: false }],
          error: null,
        },
        youtube_channels: { data: [], error: null },
        subscriptions: { data: [], error: null },
        email_unsubscribes: { data: [], error: null },
      });

      const recipients = await service.previewRecipients({});

      expect(recipients[0]?.alreadySent).toBeUndefined();
    });
  });

  describe('getStats', () => {
    it('buckets volume by period and groups batches per template', async () => {
      const now = new Date();
      const today = now.toISOString();
      const lastYear = new Date(Date.UTC(now.getUTCFullYear() - 1, 5, 1)).toISOString();

      const service = await buildService({
        // Newest first, the order getStats queries in.
        email_sends: {
          data: [
            { template_id: 'tpl-1', delivered_count: 20, sent_at: today },
            { template_id: 'tpl-1', delivered_count: 30, sent_at: lastYear },
            { template_id: 'tpl-2', delivered_count: 5, sent_at: lastYear },
          ],
          error: null,
        },
        profiles: { count: 198, error: null },
        email_unsubscribes: { count: 8, error: null },
      });

      const stats = await service.getStats();

      expect(stats.totals.allTime).toBe(55);
      expect(stats.totals.today).toBe(20);
      expect(stats.totals.year).toBe(20); // last year's 35 excluded
      expect(stats.audienceSize).toBe(190); // 198 with an email, 8 opted out

      expect(stats.byTemplate['tpl-1']).toEqual({
        delivered: 50,
        batches: 2,
        lastSentAt: today, // newest of the two
      });
      expect(stats.byTemplate['tpl-2']?.delivered).toBe(5);
    });
  });
});

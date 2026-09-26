import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { SupabaseService } from '../supabase/supabase.service';

const APPLICATION = { id: 'app-1', email: 'candidate@example.com' };

/**
 * Minimal Supabase stub: `select(...).eq(...).single()` resolves to the row the
 * test hands in, `update(...).eq(...).select().single()` echoes the patch back
 * and records it so assertions can read what was written.
 */
function makeDb(row: Record<string, unknown> | null) {
  const writes: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () =>
            Promise.resolve(
              row ? { data: row, error: null } : { data: null, error: { message: 'no rows' } },
            ),
        }),
      }),
      update: (patch: Record<string, unknown>) => {
        writes.push(patch);
        return {
          eq: () => ({
            select: () => ({
              single: () => Promise.resolve({ data: { ...row, ...patch }, error: null }),
            }),
          }),
        };
      },
      insert: () => Promise.resolve({ error: null }),
    }),
  };
  return { client, writes };
}

function build(row: Record<string, unknown> | null, resendApiKey?: string) {
  const { client, writes } = makeDb(row);
  return Test.createTestingModule({
    providers: [
      AdminService,
      { provide: ConfigService, useValue: { get: () => resendApiKey } },
      { provide: SupabaseService, useValue: { getAdminClient: () => client } },
    ],
  })
    .compile()
    .then((module: TestingModule) => ({
      service: module.get<AdminService>(AdminService),
      writes,
    }));
}

describe('AdminService.replyToApplication', () => {
  it('rejects an empty subject or body before touching the database', async () => {
    const { service } = await build(APPLICATION);

    await expect(service.replyToApplication('app-1', 'admin-1', '   ', '<p>hi</p>')).rejects.toThrow(
      BadRequestException,
    );
    await expect(service.replyToApplication('app-1', 'admin-1', 'Subject', '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('throws NotFound for an unknown application', async () => {
    const { service } = await build(null, 're_test');

    await expect(
      service.replyToApplication('missing', 'admin-1', 'Subject', '<p>hi</p>'),
    ).rejects.toThrow(NotFoundException);
  });

  it('fails loudly when Resend is not configured', async () => {
    const { service } = await build(APPLICATION);

    await expect(
      service.replyToApplication('app-1', 'admin-1', 'Subject', '<p>hi</p>'),
    ).rejects.toThrow(InternalServerErrorException);
  });

  it('sends from the support mailbox and stamps the application as contacted', async () => {
    const { service, writes } = await build(APPLICATION, 're_test');
    const send = jest
      .fn()
      .mockResolvedValue({ data: { id: 'sent-1' }, error: null });
    (service as unknown as { resend: { emails: { send: unknown } } }).resend = {
      emails: { send },
    };

    const result = await service.replyToApplication(
      'app-1',
      'admin-1',
      'Your application for Engineer at Creator AI',
      '<p>Thanks for applying.</p>',
    );

    expect(send).toHaveBeenCalledTimes(1);
    const payload = send.mock.calls[0][0];
    expect(payload.from).toBe('Creator AI Support <support@trycreatorai.com>');
    expect(payload.replyTo).toBe('support@trycreatorai.com');
    expect(payload.to).toBe('candidate@example.com');
    expect(payload.html).toContain('Thanks for applying.');

    expect(writes).toHaveLength(1);
    expect(writes[0].replied_by).toBe('admin-1');
    expect(typeof writes[0].replied_at).toBe('string');
    expect(result.success).toBe(true);
  });

  it('does not mark the application contacted when the send fails', async () => {
    const { service, writes } = await build(APPLICATION, 're_test');
    (service as unknown as { resend: { emails: { send: unknown } } }).resend = {
      emails: { send: jest.fn().mockResolvedValue({ data: null, error: { message: 'boom' } }) },
    };

    await expect(
      service.replyToApplication('app-1', 'admin-1', 'Subject', '<p>hi</p>'),
    ).rejects.toThrow(InternalServerErrorException);
    expect(writes).toHaveLength(0);
  });
});

/**
 * Table-aware stub for the activity feed: every source resolves to the rows the
 * test registered for it, and each `select`/`order` pair is recorded so the test
 * can assert which column a source is read and sorted by.
 */
function makeFeedDb(rows: Record<string, Record<string, unknown>[]>) {
  const reads: { table: string; cols: string; order?: string }[] = [];
  const client = {
    from: (table: string) => ({
      select: (cols: string) => {
        const read = { table, cols } as { table: string; cols: string; order?: string };
        reads.push(read);
        return {
          order: (col: string) => {
            read.order = col;
            return { limit: () => Promise.resolve({ data: rows[table] ?? [] }) };
          },
          in: () => Promise.resolve({ data: rows[table] ?? [] }),
        };
      },
    }),
  };
  return { client, reads };
}

function buildFeed(rows: Record<string, Record<string, unknown>[]>) {
  const { client, reads } = makeFeedDb(rows);
  return Test.createTestingModule({
    providers: [
      AdminService,
      { provide: ConfigService, useValue: { get: () => undefined } },
      { provide: SupabaseService, useValue: { getAdminClient: () => client } },
    ],
  })
    .compile()
    .then((module: TestingModule) => ({ service: module.get<AdminService>(AdminService), reads }));
}

describe('AdminService.getActivityFeed', () => {
  it('surfaces a completed AI training, timed by updated_at', async () => {
    const { service, reads } = await buildFeed({
      user_style: [
        {
          id: 'style-1',
          user_id: 'u1',
          created_at: '2026-01-01T00:00:00.000Z',
          updated_at: '2026-09-01T00:00:00.000Z',
          credits_consumed: 40,
        },
      ],
      profiles: [{ user_id: 'u1', full_name: 'Ada', name: null, email: 'ada@x.com', avatar_url: null }],
    });

    const { data } = await service.getActivityFeed(1, 30, 'feature');
    const training = data.find((e) => e.label === 'AI Training');

    expect(training).toBeDefined();
    expect(training!.category).toBe('feature');
    expect(training!.action).toBe('completed');
    expect(training!.credits_consumed).toBe(40);
    // A retrain rewrites the row, so the event time is updated_at, not created_at.
    expect(training!.created_at).toBe('2026-09-01T00:00:00.000Z');
    expect(training!.profiles?.email).toBe('ada@x.com');

    const styleRead = reads.find((r) => r.table === 'user_style');
    expect(styleRead!.order).toBe('updated_at');
    expect(styleRead!.cols).not.toContain('status');
  });

  it('files a failed script under errors with its message', async () => {
    const { service } = await buildFeed({
      scripts: [
        {
          id: 'script-1',
          user_id: 'u1',
          created_at: '2026-09-02T00:00:00.000Z',
          credits_consumed: 0,
          status: 'failed',
          error_message: 'Gemini timed out',
        },
      ],
      profiles: [],
    });

    const { data } = await service.getActivityFeed(1, 30, 'error');
    const failed = data.find((e) => e.label === 'Script');

    expect(failed).toBeDefined();
    expect(failed!.category).toBe('error');
    expect(failed!.status).toBe('failed');
    expect(failed!.error_message).toBe('Gemini timed out');
  });

  it('reads the YouTube connect event without asking for a credits column', async () => {
    const { service, reads } = await buildFeed({
      youtube_channels: [{ id: 'ch-1', user_id: 'u1', created_at: '2026-09-03T00:00:00.000Z' }],
      profiles: [],
    });

    const { data } = await service.getActivityFeed(1, 30, 'feature');
    const connect = data.find((e) => e.label === 'YouTube channel');

    expect(connect).toBeDefined();
    expect(connect!.action).toBe('connected');
    expect(connect!.credits_consumed).toBe(0);
    expect(reads.find((r) => r.table === 'youtube_channels')!.cols).not.toContain('credits_consumed');
  });
});

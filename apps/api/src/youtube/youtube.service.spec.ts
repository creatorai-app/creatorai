import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';
import { YoutubeService } from './youtube.service';
import { SupabaseService } from '../supabase/supabase.service';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

/** Chainable supabase query mock. */
function chain(result: unknown) {
  const c: any = {};
  for (const m of ['select', 'eq', 'order', 'limit', 'insert', 'update', 'delete']) {
    c[m] = jest.fn(() => c);
  }
  c.single = jest.fn(() => Promise.resolve(result));
  c.maybeSingle = jest.fn(() => Promise.resolve(result));
  c.then = (res: any, rej: any) => Promise.resolve(result).then(res, rej);
  return c;
}

const USER = 'user-1';
const CONFIG: Record<string, string> = {
  YOUTUBE_API_KEY: 'yt-key',
  GOOGLE_CLIENT_ID: 'client-id',
  GOOGLE_CLIENT_SECRET: 'client-secret',
};

describe('YoutubeService', () => {
  let service: YoutubeService;
  let tables: Record<string, any>;
  let rpc: jest.Mock;

  async function build(overrides: Record<string, any> = {}, config = CONFIG) {
    jest.clearAllMocks();
    // isAxiosError is a real helper on the module; jest.mock replaces it with a stub.
    (mockedAxios.isAxiosError as unknown as jest.Mock) = jest.fn(() => true);
    tables = {
      youtube_channels: chain({
        data: { channel_id: 'chan-1', provider_token: 'token-ok', refresh_token: 'refresh-1' },
        error: null,
      }),
      ...overrides,
    };
    rpc = jest.fn().mockResolvedValue({ data: {}, error: null });

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        YoutubeService,
        {
          provide: SupabaseService,
          useValue: { getClient: () => ({ from: (t: string) => tables[t], rpc }) },
        },
        { provide: ConfigService, useValue: { get: (k: string) => config[k] } },
      ],
    }).compile();
    service = module.get(YoutubeService);
  }

  beforeEach(() => build());

  describe('getVideoMetadata', () => {
    const snippet = {
      items: [
        {
          snippet: {
            title: 'Why espresso tastes sour',
            thumbnails: { high: { url: 'https://i.ytimg.com/high.jpg' } },
          },
        },
      ],
    };

    function mockFetch(ok: boolean, body: unknown) {
      global.fetch = jest.fn().mockResolvedValue({ ok, json: () => Promise.resolve(body) }) as any;
    }

    it.each([
      'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      'https://youtu.be/dQw4w9WgXcQ',
      'https://www.youtube.com/shorts/dQw4w9WgXcQ',
      'https://www.youtube.com/embed/dQw4w9WgXcQ',
      'youtube.com/watch?v=dQw4w9WgXcQ',
    ])('extracts the video id from %s', async (url) => {
      mockFetch(true, snippet);
      await expect(service.getVideoMetadata(url)).resolves.toEqual({
        title: 'Why espresso tastes sour',
        thumbnail: 'https://i.ytimg.com/high.jpg',
      });
      expect((global.fetch as jest.Mock).mock.calls[0][0]).toContain('id=dQw4w9WgXcQ');
    });

    it.each([
      ['', 'an empty url'],
      ['https://vimeo.com/12345', 'a non-YouTube host'],
      ['https://youtu.be/tooshort', 'an id that is not 11 characters'],
    ])('%s is rejected (%s)', async (url) => {
      await expect(service.getVideoMetadata(url)).rejects.toThrow(BadRequestException);
    });

    it('prefers the highest available thumbnail resolution', async () => {
      mockFetch(true, {
        items: [
          {
            snippet: {
              title: 't',
              thumbnails: { medium: { url: 'med' }, high: { url: 'high' }, maxres: { url: 'max' } },
            },
          },
        ],
      });
      const res = await service.getVideoMetadata('https://youtu.be/dQw4w9WgXcQ');
      expect(res.thumbnail).toBe('max');
    });

    it('404s when YouTube returns no items for the id', async () => {
      mockFetch(true, { items: [] });
      await expect(service.getVideoMetadata('https://youtu.be/dQw4w9WgXcQ')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('fails fast when the server has no API key configured', async () => {
      await build({}, {});
      await expect(service.getVideoMetadata('https://youtu.be/dQw4w9WgXcQ')).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('getChannelVideos', () => {
    const searchPage = {
      data: {
        items: [{ id: { videoId: 'v1' }, snippet: { title: 'One', thumbnails: { high: { url: 'u1' } }, publishedAt: '2026-01-01' } }],
        nextPageToken: 'page-2',
      },
    };

    it('asks the user to connect a channel before anything else', async () => {
      await build({ youtube_channels: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.getChannelVideos(USER)).rejects.toThrow(NotFoundException);
    });

    it('merges per-video statistics into the search results', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: {} }) // tokeninfo: current token still valid
        .mockResolvedValueOnce(searchPage)
        .mockResolvedValueOnce({
          data: {
            items: [
              {
                id: 'v1',
                statistics: { viewCount: '1500', likeCount: '20', commentCount: '3' },
                contentDetails: { duration: 'PT5M' },
              },
            ],
          },
        });

      const res = await service.getChannelVideos(USER);
      expect(res.videos[0]).toMatchObject({ id: 'v1', viewCount: 1500, likeCount: 20, duration: 'PT5M' });
      expect(res.nextPageToken).toBe('page-2');
    });

    it('still returns the videos when the statistics call fails', async () => {
      // Titles and thumbnails are the page; zeroed counts beat an error screen.
      mockedAxios.get
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce(searchPage)
        .mockRejectedValueOnce(new Error('quota'));

      const res = await service.getChannelVideos(USER);
      expect(res.videos[0]).toMatchObject({ id: 'v1', viewCount: 0, likeCount: 0, duration: '' });
    });

    it('returns an empty page without asking for statistics', async () => {
      mockedAxios.get
        .mockResolvedValueOnce({ data: {} })
        .mockResolvedValueOnce({ data: { items: [] } });

      await expect(service.getChannelVideos(USER)).resolves.toEqual({ videos: [], nextPageToken: undefined });
      expect(mockedAxios.get).toHaveBeenCalledTimes(2);
    });

    it("surfaces Google's own reason instead of a bare 500", async () => {
      mockedAxios.get.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({
        response: { status: 403, data: { error: { errors: [{ reason: 'quotaExceeded' }] } } },
      });
      await expect(service.getChannelVideos(USER)).rejects.toThrow(/quotaExceeded/);
    });
  });

  describe('resolveAccessToken (via getChannelVideos)', () => {
    it('refreshes an expired token and persists the new one', async () => {
      mockedAxios.get
        .mockRejectedValueOnce({ response: { status: 400 } }) // tokeninfo: expired
        .mockResolvedValueOnce({ data: { items: [] } }); // search, with the refreshed token
      mockedAxios.post.mockResolvedValueOnce({ data: { access_token: 'token-new' } });

      await service.getChannelVideos(USER);

      expect(tables.youtube_channels.update).toHaveBeenCalledWith(
        expect.objectContaining({ provider_token: 'token-new' }),
      );
      const searchCall = mockedAxios.get.mock.calls[1][1] as any;
      expect(searchCall.headers.Authorization).toBe('Bearer token-new');
    });

    it('asks the user to reconnect when there is no refresh token to fall back on', async () => {
      await build({
        youtube_channels: chain({
          data: { channel_id: 'chan-1', provider_token: 'token-old', refresh_token: null },
          error: null,
        }),
      });
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 400 } });

      await expect(service.getChannelVideos(USER)).rejects.toThrow(/reconnect/i);
    });

    it('asks the user to reconnect when the refresh itself is rejected', async () => {
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 400 } });
      mockedAxios.post.mockRejectedValueOnce({ response: { status: 400 } });

      await expect(service.getChannelVideos(USER)).rejects.toThrow(BadRequestException);
    });

    it('reports a missing OAuth client as a server error, not a user problem', async () => {
      await build({}, { YOUTUBE_API_KEY: 'yt-key' });
      mockedAxios.get.mockRejectedValueOnce({ response: { status: 400 } });

      await expect(service.getChannelVideos(USER)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getTrainedVideos / saveTrainedVideos', () => {
    it('returns an empty list when the channel has never been trained on', async () => {
      await build({ youtube_channels: chain({ data: { youtube_trained_videos: null }, error: null }) });
      await expect(service.getTrainedVideos(USER)).resolves.toEqual([]);
    });

    it('404s when the caller has no channel row', async () => {
      await build({ youtube_channels: chain({ data: null, error: { message: 'no rows' } }) });
      await expect(service.getTrainedVideos(USER)).rejects.toThrow(NotFoundException);
    });

    it('surfaces a failed save as a 500', async () => {
      await build({ youtube_channels: chain({ error: { message: 'boom' } }) });
      await expect(service.saveTrainedVideos(USER, [])).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getChannelStats (cached read)', () => {
    const cached = {
      data: {
        channel_name: 'Espresso Lab',
        subscriber_count: 1000,
        view_count: 9000,
        video_count: 3,
        top_videos: [{ likeCount: 10 }, { likeCount: 20 }],
        recent_videos: [],
        custom_url: '@espressolab',
      },
      error: null,
    };

    it('derives the per-video averages from the stored totals', async () => {
      await build({ youtube_channels: chain(cached) });
      rpc.mockResolvedValue({ data: { plan: 'Pro', remaining: 4 }, error: null });

      const stats = await service.getChannelStats(USER);
      expect(stats).toMatchObject({
        avgViewsPerVideo: 3000, // 9000 / 3
        avgLikesPerVideo: 15, // (10 + 20) / 2 top videos
        plan: 'Pro',
      });
    });

    it('does not divide by zero on a channel with no videos', async () => {
      await build({
        youtube_channels: chain({ data: { ...cached.data, video_count: 0, top_videos: [] }, error: null }),
      });
      rpc.mockResolvedValue({ data: {}, error: null });

      const stats = await service.getChannelStats(USER);
      expect(stats.avgViewsPerVideo).toBe(0);
      expect(stats.avgLikesPerVideo).toBe(0);
    });

    it('surfaces a usage-RPC failure as a 500', async () => {
      await build({ youtube_channels: chain(cached) });
      rpc.mockResolvedValue({ data: null, error: { message: 'rpc down' } });
      await expect(service.getChannelStats(USER)).rejects.toThrow(InternalServerErrorException);
    });
  });

  describe('getChannelStats (forced sync)', () => {
    it('refuses the sync when the plan has no uses left, before spending quota', async () => {
      rpc.mockResolvedValue({ data: { allowed: false, message: 'Daily limit reached' }, error: null });
      await expect(service.getChannelStats(USER, true)).rejects.toThrow('Daily limit reached');
      expect(mockedAxios.get).not.toHaveBeenCalled();
    });
  });
});

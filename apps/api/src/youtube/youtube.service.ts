import {
  Injectable,
  BadRequestException,
  NotFoundException,
  InternalServerErrorException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupabaseService } from '../supabase/supabase.service';
import axios from 'axios';
import type { ChannelVideoItem, ChannelStatsItem, ChannelStats } from '@repo/validation';

const YT_REGEX = /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|embed\/|v\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;

@Injectable()
export class YoutubeService {
  private readonly supabase;

  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {
    this.supabase = this.supabaseService.getClient();
  }

  async getVideoMetadata(videoUrl: string) {
    const apiKey = this.configService.get<string>('YOUTUBE_API_KEY');
    if (!apiKey) throw new InternalServerErrorException('Server configuration error.');

    if (!videoUrl) throw new BadRequestException('videoUrl parameter is missing');

    const match = videoUrl.match(YT_REGEX);
    if (!match?.[1]) throw new BadRequestException('Invalid YouTube URL format');

    const apiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${match[1]}&key=${apiKey}`;

    try {
      const response = await fetch(apiUrl);
      const data = await response.json();

      if (!response.ok || !data.items?.length) {
        throw new NotFoundException('Failed to fetch video details or video not found');
      }

      const snippet = data.items[0].snippet;
      const thumbnail = snippet.thumbnails.maxres || snippet.thumbnails.high || snippet.thumbnails.medium;
      return { title: snippet.title, thumbnail: thumbnail.url };
    } catch (error) {
      if (error instanceof BadRequestException || error instanceof NotFoundException) throw error;
      throw new InternalServerErrorException('An unexpected error occurred');
    }
  }

  async getChannelVideos(
    userId: string,
    pageToken?: string,
    maxResults = 6,
  ): Promise<{ videos: ChannelVideoItem[]; nextPageToken?: string }> {
    const { data: channel, error } = await this.supabase
      .from('youtube_channels')
      .select('channel_id, provider_token, refresh_token')
      .eq('user_id', userId)
      .single();

    if (error || !channel) {
      throw new NotFoundException('YouTube channel not found. Please connect your channel first.');
    }

    const accessToken = await this.resolveAccessToken(userId, channel);

    const searchParams: Record<string, string | number> = {
      part: 'snippet',
      forMine: 'true',
      type: 'video',
      order: 'viewCount',
      maxResults,
    };
    if (pageToken) searchParams.pageToken = pageToken;

    const searchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
      params: searchParams,
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    }).catch(() => {
      throw new InternalServerErrorException('Failed to fetch videos from YouTube');
    });

    const items = searchRes.data.items;
    if (!items?.length) {
      return { videos: [], nextPageToken: undefined };
    }

    const videoIds = items.map((i: any) => i.id.videoId).join(',');
    const statsRes = await axios.get('https://www.googleapis.com/youtube/v3/videos', {
      params: { part: 'statistics', id: videoIds },
      headers: { Authorization: `Bearer ${accessToken}` },
      timeout: 15000,
    }).catch(() => null);

    const statsMap = new Map<string, number>();
    if (statsRes?.data?.items) {
      for (const v of statsRes.data.items) {
        statsMap.set(v.id, parseInt(v.statistics.viewCount, 10) || 0);
      }
    }

    const videos: ChannelVideoItem[] = items.map((item: any) => {
      const snippet = item.snippet;
      const thumb = snippet.thumbnails?.high || snippet.thumbnails?.medium || snippet.thumbnails?.default;
      return {
        id: item.id.videoId,
        title: snippet.title,
        thumbnail: thumb?.url || '',
        publishedAt: snippet.publishedAt,
        viewCount: statsMap.get(item.id.videoId) ?? 0,
      };
    });

    return { videos, nextPageToken: searchRes.data.nextPageToken };
  }

  async getTrainedVideos(userId: string): Promise<ChannelVideoItem[]> {
    const { data: channel, error } = await this.supabase
      .from('youtube_channels')
      .select('youtube_trained_videos')
      .eq('user_id', userId)
      .single();

    if (error || !channel) {
      throw new NotFoundException('Channel not found.');
    }

    return (channel.youtube_trained_videos as ChannelVideoItem[]) || [];
  }

  async saveTrainedVideos(userId: string, videos: ChannelVideoItem[]): Promise<{ message: string }> {
    const { error } = await this.supabase
      .from('youtube_channels')
      .update({ youtube_trained_videos: videos })
      .eq('user_id', userId);

    if (error) {
      throw new InternalServerErrorException('Failed to save trained videos');
    }

    return { message: 'Trained videos saved successfully' };
  }

  async getChannelStats(userId: string, forceSync?: boolean): Promise<ChannelStats> {

    console.log('forceSync', forceSync);

    if (forceSync) {
      const { data: usageData, error: usageError } = await this.supabase.rpc('use_feature', {
        p_user_id: userId,
      });
      if (usageError) {
        throw new InternalServerErrorException('Failed to get feature usage');
      }
      if (!usageData.allowed) {
        throw new BadRequestException(usageData.message);
      }
     
      const { data: channel, error } = await this.supabase
        .from('youtube_channels')
        .select('channel_id, provider_token, refresh_token')
        .eq('user_id', userId)
        .single();

      if (error || !channel) {
        throw new NotFoundException('YouTube channel not found. Please connect your channel first.');
      }

      const accessToken = await this.resolveAccessToken(userId, channel);

      // Fetch channel-level stats
      const channelRes = await axios.get('https://www.googleapis.com/youtube/v3/channels', {
        params: { part: 'snippet,statistics', mine: 'true' },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }).catch(() => {
        throw new InternalServerErrorException('Failed to fetch channel info from YouTube');
      });

      const channelItem = channelRes.data.items?.[0];
      if (!channelItem) {
        throw new NotFoundException('Channel data not found.');
      }

      const channelSnippet = channelItem.snippet;
      const channelStats = channelItem.statistics;

      // Fetch top videos by view count (up to 5)
      const topSearchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          forMine: 'true',
          type: 'video',
          order: 'viewCount',
          maxResults: 5,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }).catch(() => {
        throw new InternalServerErrorException('Failed to fetch top videos from YouTube');
      });

      // Fetch recent videos (up to 5)
      const recentSearchRes = await axios.get('https://www.googleapis.com/youtube/v3/search', {
        params: {
          part: 'snippet',
          forMine: 'true',
          type: 'video',
          order: 'date',
          maxResults: 5,
        },
        headers: { Authorization: `Bearer ${accessToken}` },
        timeout: 15000,
      }).catch(() => null);

      const allVideoIds = new Set<string>();
      (topSearchRes.data.items || []).forEach((i: any) => allVideoIds.add(i.id.videoId));
      (recentSearchRes?.data?.items || []).forEach((i: any) => allVideoIds.add(i.id.videoId));

      const videoDetailsRes = allVideoIds.size > 0
        ? await axios.get('https://www.googleapis.com/youtube/v3/videos', {
          params: { part: 'statistics,contentDetails', id: Array.from(allVideoIds).join(',') },
          headers: { Authorization: `Bearer ${accessToken}` },
          timeout: 15000,
        }).catch(() => null)
        : null;

      type VideoDetail = { statistics: { viewCount: string; likeCount: string; commentCount: string }; contentDetails: { duration: string } };
      const detailsMap = new Map<string, VideoDetail>();
      if (videoDetailsRes?.data?.items) {
        for (const v of videoDetailsRes.data.items) {
          detailsMap.set(v.id, v);
        }
      }

      const mapItem = (item: any): ChannelStatsItem => {
        const snippet = item.snippet;
        const thumb = snippet.thumbnails?.high || snippet.thumbnails?.medium || snippet.thumbnails?.default;
        const detail = detailsMap.get(item.id.videoId);
        return {
          id: item.id.videoId,
          title: snippet.title,
          thumbnail: thumb?.url || '',
          publishedAt: snippet.publishedAt,
          viewCount: parseInt(detail?.statistics?.viewCount || '0', 10),
          likeCount: parseInt(detail?.statistics?.likeCount || '0', 10),
          commentCount: parseInt(detail?.statistics?.commentCount || '0', 10),
          duration: detail?.contentDetails?.duration || '',
        };
      };

      const topVideos: ChannelStatsItem[] = (topSearchRes.data.items || []).map(mapItem);
      const recentVideos: ChannelStatsItem[] = (recentSearchRes?.data?.items || []).map(mapItem);

      const totalViews = parseInt(channelStats.viewCount || '0', 10);
      const totalVideos = parseInt(channelStats.videoCount || '0', 10);
      const totalLikes = topVideos.reduce((sum, v) => sum + v.likeCount, 0);

      const { data: updatedChannel, error: updateError } = await this.supabase.from('youtube_channels').update({
        channel_name: channelSnippet.title,
        subscriber_count: parseInt(channelStats.subscriberCount || '0', 10),
        view_count: totalViews,
        video_count: totalVideos,
        top_videos: topVideos,
        recent_videos: recentVideos,
        last_synced_at: new Date().toISOString(),

      }).eq('user_id', userId)
        .select('custom_url, country, default_language, thumbnail')
        .single();

      if (updateError) {
        throw new InternalServerErrorException('Failed to update channel stats');
      }

      return {
        channelName: channelSnippet.title,
        subscriberCount: parseInt(channelStats.subscriberCount || '0', 10),
        totalViews,
        totalVideos,
        topVideos,
        recentVideos,
        avgViewsPerVideo: totalVideos > 0 ? Math.round(totalViews / totalVideos) : 0,
        avgLikesPerVideo: topVideos.length > 0 ? Math.round(totalLikes / topVideos.length) : 0,
        cooldown_minutes: usageData.cooldown_minutes,
        can_use_now: usageData.can_use_now,
        plan: usageData.plan,
        remaining: usageData.remaining,
        daily_limit: usageData.daily_limit,
        usage_count: usageData.usage_count,
        cooldown_remaining: usageData.cooldown_remaining,
        custom_url: updatedChannel?.custom_url || '',
        country: updatedChannel?.country,
        default_language: updatedChannel?.default_language,
        thumbnail: updatedChannel?.thumbnail || '',
      };
    }

    const { data: channel, error: channelError } = await this.supabase
      .from('youtube_channels')
      .select(
        'channel_name, subscriber_count, view_count, video_count, top_videos, recent_videos, last_synced_at, usage_count, custom_url, country, default_language, thumbnail ',
      )
      .eq('user_id', userId)
      .single();
    if (channelError) {
      throw new InternalServerErrorException('Failed to get channel stats');
    }
    if (!channel) {
      throw new NotFoundException('Channel not found');
    }

    const { data: usageData, error: usageError } = await this.supabase.rpc('get_feature_usage', {
      p_user_id: userId,
    });

    if (usageError) {
      throw new InternalServerErrorException('Failed to get feature usage');
    }
    // console.log('usageData', usageData);

    const topVideos: ChannelStatsItem[] = (channel.top_videos ?? []) as ChannelStatsItem[];
    const recentVideos: ChannelStatsItem[] = (channel.recent_videos ?? []) as ChannelStatsItem[];
    const totalLikes = topVideos.reduce((sum, v) => sum + (v.likeCount ?? 0), 0);

    return {
      channelName: channel.channel_name,
      subscriberCount: channel.subscriber_count,
      totalViews: channel.view_count,
      totalVideos: channel.video_count,
      topVideos,
      recentVideos,
      avgViewsPerVideo: channel.video_count > 0 ? Math.round(channel.view_count / channel.video_count) : 0,
      avgLikesPerVideo: topVideos.length > 0 ? Math.round(totalLikes / topVideos.length) : 0,
      cooldown_minutes: usageData.cooldown_minutes,
      can_use_now: usageData.can_use_now,
      plan: usageData.plan,
      remaining: usageData.remaining,
      daily_limit: usageData.daily_limit,
      usage_count: usageData.usage_count,
      cooldown_remaining: usageData.cooldown_remaining,
      custom_url: channel.custom_url,
      country: channel.country,
      default_language: channel.default_language,
      thumbnail: channel.thumbnail,

    };

  }

  private async resolveAccessToken(
    userId: string,
    channel: { provider_token: string; refresh_token?: string },
  ): Promise<string> {
    try {
      await axios.get('https://oauth2.googleapis.com/tokeninfo', {
        params: { access_token: channel.provider_token },
        timeout: 10000,
      });
      return channel.provider_token;
    } catch {
      // Token expired, try refresh
    }

    if (!channel.refresh_token) {
      throw new BadRequestException('YouTube connection expired. Please reconnect your channel.');
    }

    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    const clientSecret = this.configService.get<string>('GOOGLE_CLIENT_SECRET');
    if (!clientId || !clientSecret) {
      throw new InternalServerErrorException('Server configuration error.');
    }

    try {
      const tokenRes = await axios.post('https://oauth2.googleapis.com/token', {
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: channel.refresh_token,
        grant_type: 'refresh_token',
      }, { timeout: 15000, headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

      const newToken = tokenRes.data.access_token;

      await this.supabase
        .from('youtube_channels')
        .update({ provider_token: newToken, updated_at: new Date().toISOString() })
        .eq('user_id', userId);

      return newToken;
    } catch {
      throw new BadRequestException('YouTube connection expired. Please reconnect your channel.');
    }
  }
}
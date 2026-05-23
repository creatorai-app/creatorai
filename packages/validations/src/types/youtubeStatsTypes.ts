
export interface ChannelVideoItem {
  id: string
  title: string
  thumbnail: string
  publishedAt: string
  viewCount: number
}

export interface ChannelStatsVideo {
  id: string
  title: string
  thumbnail: string
  publishedAt: string
  viewCount: number
  likeCount: number
  commentCount: number
  duration: string
}

export type ChannelStatsItem = ChannelStatsVideo

export interface ChannelStats {
  channelName: string
  subscriberCount: number
  totalViews: number
  totalVideos: number
  topVideos: ChannelStatsVideo[]
  recentVideos: ChannelStatsVideo[]
  avgViewsPerVideo: number
  avgLikesPerVideo: number
  cooldown_minutes: number
  can_use_now: boolean
  plan: string
  remaining: number
  daily_limit: number
  usage_count: number
  cooldown_remaining: number
  custom_url: string
  country?: string
  default_language?: string
  thumbnail: string
}

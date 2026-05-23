import { Body, Controller, Get, ParseBoolPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SupabaseAuthGuard } from '../guards/auth.guard';
import { YoutubeService } from './youtube.service';
import type { AuthRequest } from '../common/interfaces/auth-request.interface';
import { getUserId } from '../common/get-user-id';

@ApiTags('youtube')
@ApiBearerAuth()
@Controller('youtube')
@UseGuards(SupabaseAuthGuard)
export class YoutubeController {
  constructor(private readonly youtubeService: YoutubeService) {}

  @Get('video-metadata')
  @ApiOperation({ summary: 'Resolve YouTube video metadata from URL' })
  @ApiQuery({ name: 'videoUrl', required: true })
  getVideoMetadata(@Query('videoUrl') videoUrl: string) {
    return this.youtubeService.getVideoMetadata(videoUrl);
  }

  @Get('channel-videos')
  @ApiOperation({ summary: 'List videos from the connected YouTube channel' })
  @ApiQuery({ name: 'pageToken', required: false })
  @ApiQuery({ name: 'maxResults', required: false, description: 'Capped at 24' })
  getChannelVideos(
    @Req() req: AuthRequest,
    @Query('pageToken') pageToken?: string,
    @Query('maxResults') maxResults?: string,
  ) {
    const userId = getUserId(req);
    return this.youtubeService.getChannelVideos(
      userId,
      pageToken,
      maxResults ? Math.min(parseInt(maxResults, 10), 24) : 6,
    );
  }

  @Get('trained-videos')
  getTrainedVideos(@Req() req: AuthRequest) {
    const userId = getUserId(req);
    return this.youtubeService.getTrainedVideos(userId);
  }

  @Post('trained-videos')
  saveTrainedVideos(@Req() req: AuthRequest, @Body() data: any) {
    const userId = getUserId(req);
    return this.youtubeService.saveTrainedVideos(userId, data.videos);
  }

  @Get('channel-stats')
  getChannelStats(@Req() req: AuthRequest, @Query('forceSync', ParseBoolPipe) forceSync?: boolean) {
    const userId = getUserId(req);
    return this.youtubeService.getChannelStats(userId, forceSync);
  }
}

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import * as path from 'path';
import { getRedisConnection } from './redis';
import { SupabaseModule } from './supabase/supabase.module';

import { AppController } from './app.controller';
import { HealthController } from './health.controller';
import { TrainAiModule } from './train-ai/train-ai.module';
import { AuthModule } from './auth/auth.module';
import { SubtitleModule } from './subtitle/subtitle.module';
import { DubbingModule } from './dubbing/dubbing.module';
import { ThumbnailModule } from './thumbnail/thumbnail.module';
import { StoryBuilderModule } from './story-builder/story-builder.module';
import { ReferralModule } from './referral/referral.module';
import { ScriptModule } from './script/script.module';
import { CourseModule } from './course/course.module';
import { YoutubeModule } from './youtube/youtube.module';
import { UploadModule } from './upload/upload.module';
import { SupportModule } from './support/support.module';
import { IdeationModule } from './ideation/ideation.module';
import { BillingModule } from './billing/billing.module';
import { AdminModule } from './admin/admin.module';
import { AffiliateModule } from './affiliate/affiliate.module';
import { HannahModule } from './hannah/hannah.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [
        '.env',
        '.env.local',
        path.resolve(process.cwd(), '../../.env'),
        path.resolve(process.cwd(), '../../.env.local'),
      ],
    }),
    BullModule.forRootAsync({
      useFactory: () => ({
        connection: getRedisConnection(),
        defaultJobOptions: {
          attempts: 1,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: { count: 1000 },
          removeOnFail: { count: 5000 },
          limiter: { max: 100, duration: 60000 }
        },
      }),
    }),
    SupabaseModule,
    TrainAiModule,
    AuthModule,
    SubtitleModule,
    DubbingModule,
    ThumbnailModule,
    StoryBuilderModule,
    ReferralModule,
    ScriptModule,
    CourseModule,
    YoutubeModule,
    UploadModule,
    SupportModule,
    IdeationModule,
    BillingModule,
    AdminModule,
    AffiliateModule,
    HannahModule,
  ],
  controllers: [AppController, HealthController],
  providers: [],
})
export class AppModule { }

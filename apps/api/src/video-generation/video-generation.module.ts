import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { VideoGenerationController } from './video-generation.controller';
import { VideoGenerationService } from './video-generation.service';

@Module({
  imports: [
    SupabaseModule,
    ConfigModule,
    BullModule.registerQueue({ name: 'video-generation' }),
  ],
  controllers: [VideoGenerationController],
  providers: [VideoGenerationService],
})
export class VideoGenerationModule {}

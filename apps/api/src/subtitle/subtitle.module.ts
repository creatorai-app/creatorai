import { Module } from '@nestjs/common';
import { SubtitleService } from './subtitle.service';
import { SubtitleController } from './subtitle.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';

@Module({
  imports: [SupabaseModule, ConfigModule, BullModule.registerQueue({ name: 'subtitle' })],
  controllers: [SubtitleController],
  providers: [SubtitleService],
})
export class SubtitleModule { }

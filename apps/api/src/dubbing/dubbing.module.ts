import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { BullModule } from '@nestjs/bullmq';
import { DubbingService } from './dubbing.service';
import { DubbingController } from './dubbing.controller';
import { SupabaseModule } from '../supabase/supabase.module';

@Module({
  imports: [SupabaseModule, ConfigModule, BullModule.registerQueue({ name: 'dubbing' })],
  providers: [DubbingService],
  controllers: [DubbingController],
})
export class DubbingModule {}

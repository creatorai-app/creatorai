import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ThumbnailService } from './thumbnail.service';
import { ThumbnailController } from './thumbnail.controller';
import { SupabaseModule } from '../supabase/supabase.module';
import { BillingModule } from '../billing/billing.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [
    SupabaseModule,
    BillingModule,
    ConfigModule,
    BullModule.registerQueue({ name: 'thumbnail' }),
  ],
  controllers: [ThumbnailController],
  providers: [ThumbnailService],
})
export class ThumbnailModule {}

import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SupabaseModule } from '../supabase/supabase.module';
import { EmailCampaignController } from './email-campaign.controller';
import { EmailCampaignService } from './email-campaign.service';

@Module({
  imports: [SupabaseModule, BullModule.registerQueue({ name: 'email-campaign' })],
  controllers: [EmailCampaignController],
  providers: [EmailCampaignService],
})
export class EmailCampaignModule {}

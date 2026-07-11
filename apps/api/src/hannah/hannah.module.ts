import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { HannahController } from './hannah.controller';
import { HannahService } from './hannah.service';

@Module({
  imports: [ConfigModule, SupabaseModule],
  controllers: [HannahController],
  providers: [HannahService],
})
export class HannahModule {}

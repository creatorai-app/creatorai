import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { SupabaseModule } from '../supabase/supabase.module';
import { FreeToolsController } from './free-tools.controller';
import { FreeToolsService } from './free-tools.service';
import { FreeToolRunsService } from './free-tool-runs.service';

@Module({
  // SupabaseModule for the run store: the generators themselves stay stateless,
  // but a run has to survive the visitor navigating to /signup.
  imports: [ConfigModule, SupabaseModule],
  controllers: [FreeToolsController],
  providers: [FreeToolsService, FreeToolRunsService],
})
export class FreeToolsModule {}

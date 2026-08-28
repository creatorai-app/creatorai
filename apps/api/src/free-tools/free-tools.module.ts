import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { FreeToolsController } from './free-tools.controller';
import { FreeToolsService } from './free-tools.service';

@Module({
  imports: [ConfigModule],
  controllers: [FreeToolsController],
  providers: [FreeToolsService],
})
export class FreeToolsModule {}

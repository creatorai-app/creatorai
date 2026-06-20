import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { getRedisConnection } from './redis';
import { HealthController } from './health.controller';
import { TrainAiProcessor } from './processor/train-ai.processor';
import { ThumbnailProcessor } from './processor/thumbnail.processor';
import { StoryBuilderProcessor } from './processor/story-builder.processor';
import { IdeationProcessor } from './processor/ideation.processor';
import { ScriptProcessor } from './processor/script.processor';

@Module({
  controllers: [HealthController],
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
    BullModule.forRoot({
      connection: getRedisConnection(),
      defaultJobOptions: {
        attempts: 1,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: { count: 1000 },
        removeOnFail: { count: 5000 },
      },
    }),
    BullModule.registerQueue(
      { name: 'train-ai' },
      { name: 'thumbnail' },
      { name: 'story-builder' },
      { name: 'ideation' },
      { name: 'script' },
    ),
  ],
  providers: [TrainAiProcessor, ThumbnailProcessor, StoryBuilderProcessor, IdeationProcessor, ScriptProcessor],
})
export class WorkerModule {}
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import axios from 'axios';
import {
  installCreatorAiAxiosDefaults,
  installCreatorAiFetchDefaults,
} from '@repo/validation';
import { WorkerModule } from './worker.module';

installCreatorAiFetchDefaults();
installCreatorAiAxiosDefaults(axios);

async function bootstrap() {
  const app = await NestFactory.create(WorkerModule);

  const swaggerConfig = new DocumentBuilder()
    .setTitle('Creator AI Worker')
    .setDescription('Background job processor for Creator AI platform')
    .setVersion('1.0')
    .addTag('health', 'Health check')
    .addTag('processors', 'BullMQ job processors: train-ai, thumbnail, story-builder, ideation, script')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  const port = process.env.PORT ?? 8001;
  await app.listen(port);
  console.log(`Train AI Worker listening on :${port}`);
  console.log(`Swagger docs available at http://localhost:${port}/docs`);

  process.on('SIGTERM', async () => {
    console.log('SIGTERM received – shutting down gracefully…');
    await app.close();
    process.exit(0);
  });
}

bootstrap().catch((error) => {
  console.error('Failed to start Train AI Worker:', error);
  process.exit(1);
});
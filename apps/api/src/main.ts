import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import axios from 'axios';
import {
  CREATOR_AI_USER_AGENT,
  installCreatorAiAxiosDefaults,
  installCreatorAiFetchDefaults,
} from '@repo/validation';
import { AppModule } from './app.module';

installCreatorAiFetchDefaults();
installCreatorAiAxiosDefaults(axios);

async function bootstrap() {
  const app = await NestFactory.create(AppModule, { rawBody: true });

  app.use((_req, res, next) => {
    res.setHeader('Server', CREATOR_AI_USER_AGENT);
    next();
  });

  const isWorker = process.env.NODE_ENV === 'worker';

  if (isWorker) {
    await app.init();
    console.log('Worker initialized successfully');
  } else {
    app.setGlobalPrefix('api/v1', {
      exclude: ['/'],
    });

    const swaggerConfig = new DocumentBuilder()
      .setTitle('Creator AI API')
      .setDescription(
        [
          'OpenAPI for the Creator AI backend. Global prefix: **/api/v1** (except `GET /` health).',
          '',
          '**Auth:** click *Authorize*, enter `Bearer <token>` or paste the Supabase JWT only — the guard reads `Authorization: Bearer …`.',
          '',
          '**Webhooks** (`POST /api/v1/lemonsqueezy/webhook`) require valid `x-signature` and Lemon Squeezy payload; not practical from Swagger alone.',
          '',
          '**SSE** job status routes are documented for visibility; use browser `EventSource` or a client — Swagger UI may not stream reliably.',
        ].join('\n'),
      )
      .setVersion('1.0')
      .addBearerAuth({
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Supabase access token',
      })
      .addTag('health', 'Health check endpoints')
      .addTag('app', 'Internal / debug (authenticated)')
      .addTag('auth', 'Authentication & password reset')
      .addTag('billing', 'Plans, subscriptions & checkout')
      .addTag('affiliate', 'Affiliate program')
      .addTag('admin', 'Admin management')
      .addTag('course', 'AI course generation')
      .addTag('dubbing', 'Video dubbing')
      .addTag('ideation', 'Content ideation')
      .addTag('referral', 'Referral system')
      .addTag('sales-rep', 'Sales representative portal')
      .addTag('script', 'Script generation')
      .addTag('story-builder', 'Story builder')
      .addTag('subtitle', 'Subtitle management')
      .addTag('support', 'Support & issue reporting')
      .addTag('thumbnail', 'Thumbnail generation')
      .addTag('train-ai', 'AI training')
      .addTag('upload', 'File uploads')
      .addTag('youtube', 'YouTube integration')
      .build();

    const document = SwaggerModule.createDocument(app, swaggerConfig);
    SwaggerModule.setup('api/docs', app, document, {
      swaggerOptions: {
        persistAuthorization: true,
        docExpansion: 'list',
        tryItOutEnabled: true,
      },
      customSiteTitle: 'Creator AI API',
    });

    const allowedOrigins = [
      process.env.FRONTEND_DEV_URL,
      process.env.FRONTEND_PROD_URL,
      "*",
    ];

    app.enableCors({
      origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
          callback(null, true);
        } else {
          callback(new Error('Not allowed by CORS'));
        }
      },
      credentials: true,
    });

    await app.listen(process.env.PORT || 8000, () => {
      console.log(`API Server running on port ${process.env.PORT || 8000}`);
      console.log(`Swagger docs available at http://localhost:${process.env.PORT || 8000}/api/docs`);
    });
  }
}
bootstrap();
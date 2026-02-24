import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import { json } from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Increase body size limit to support base64-encoded file attachments (up to ~25MB files)
  app.use(json({ limit: '200mb' }));

  const config = app.get(ConfigService);
  const port = config.get<number>('API_PORT', 3001);

  app.setGlobalPrefix('api');
  app.enableCors({
    origin: config.get('CORS_ORIGIN', 'http://localhost:3027'),
    credentials: true,
  });

  await app.listen(port);
}

bootstrap();

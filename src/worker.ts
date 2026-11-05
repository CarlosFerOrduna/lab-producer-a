import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { WorkerModule } from './worker/worker.module';

// The worker serves only GET /health, for its liveness probe.
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(WorkerModule);
  app.enableShutdownHooks();
  const config = app.get(ConfigService);
  const port = config.getOrThrow<number>('PORT');
  await app.listen(port);
}

void bootstrap();

import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { workerEnvValidationSchema } from '../config/env-validation.schema';
import { HealthModule } from '../health/health.module';
import { PublishingModule } from '../publishing/publishing.module';
import { EventPublishWorkerService } from './event-publish-worker.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validationSchema: workerEnvValidationSchema,
    }),
    HealthModule,
    PublishingModule,
  ],
  providers: [EventPublishWorkerService],
})
export class WorkerModule {}

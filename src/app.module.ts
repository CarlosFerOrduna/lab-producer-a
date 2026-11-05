import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { apiEnvValidationSchema } from './config/env-validation.schema';
import { HealthModule } from './health/health.module';
import { ReadinessModule } from './health/readiness.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validationSchema: apiEnvValidationSchema,
    }),
    HealthModule,
    ReadinessModule,
    MessagesModule,
  ],
})
export class AppModule {}

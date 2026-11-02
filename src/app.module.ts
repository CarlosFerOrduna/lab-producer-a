import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { envValidationSchema } from './config/env-validation.schema';
import { HealthModule } from './health/health.module';
import { MessagesModule } from './messages/messages.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      ignoreEnvFile: true,
      validationSchema: envValidationSchema,
    }),
    HealthModule,
    MessagesModule,
  ],
})
export class AppModule {}

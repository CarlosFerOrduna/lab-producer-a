import { ConfigService } from '@nestjs/config';
import type { RedisOptions } from 'bullmq';

/** Connection to the queue's Valkey, from the validated environment. */
export function queueConnectionOptions(config: ConfigService): RedisOptions {
  return {
    host: config.getOrThrow<string>('QUEUE_HOST'),
    port: config.getOrThrow<number>('QUEUE_PORT'),
    password: config.getOrThrow<string>('QUEUE_PASSWORD'),
  };
}

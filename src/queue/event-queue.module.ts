import { Inject, Module, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { Redis } from 'ioredis';
import { PublishedEvent } from '../publishing/types/published-event.type';
import { EVENT_QUEUE } from './constants/event-queue.constant';
import { queueConnectionOptions } from './queue-connection.util';

@Module({
  providers: [
    {
      provide: EVENT_QUEUE.queueToken,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Queue<PublishedEvent>(EVENT_QUEUE.name, {
          // Sin cola offline: si Valkey no está, encolar falla enseguida en vez de colgar el pedido.
          connection: { ...queueConnectionOptions(config), enableOfflineQueue: false },
          defaultJobOptions: {
            attempts: EVENT_QUEUE.attempts,
            backoff: { type: 'custom' },
            removeOnComplete: { count: EVENT_QUEUE.keepCompletedJobs },
            removeOnFail: { age: EVENT_QUEUE.keepFailedJobsSeconds },
          },
        }),
    },
    {
      // A plain client on the same Valkey, for the readiness write probe: BullMQ 6 keeps its own connection private.
      provide: EVENT_QUEUE.probeClientToken,
      inject: [ConfigService],
      useFactory: (config: ConfigService) =>
        new Redis({ ...queueConnectionOptions(config), enableOfflineQueue: false, maxRetriesPerRequest: 1 }),
    },
  ],
  exports: [EVENT_QUEUE.queueToken, EVENT_QUEUE.probeClientToken],
})
export class EventQueueModule implements OnApplicationShutdown {
  constructor(
    @Inject(EVENT_QUEUE.queueToken) private readonly eventQueue: Queue<PublishedEvent>,
    @Inject(EVENT_QUEUE.probeClientToken) private readonly probeClient: Redis,
  ) {}

  async onApplicationShutdown(): Promise<void> {
    await this.eventQueue.close();
    await this.probeClient.quit();
  }
}

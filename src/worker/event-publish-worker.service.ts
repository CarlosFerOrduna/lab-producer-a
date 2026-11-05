import { Inject, Injectable, Logger, OnApplicationBootstrap, OnApplicationShutdown } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Worker } from 'bullmq';
import { PUBLISHING } from '../publishing/constants/publishing.constant';
import type { EventPublisher } from '../publishing/types/event-publisher.type';
import { PublishedEvent } from '../publishing/types/published-event.type';
import { EVENT_QUEUE } from '../queue/constants/event-queue.constant';
import { eventBackoffDelay } from '../queue/event-backoff.util';
import { queueConnectionOptions } from '../queue/queue-connection.util';
import { createEventPublishProcessor } from './event-publish.processor';

/** Takes events from the queue and publishes them to the processor. */
@Injectable()
export class EventPublishWorkerService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(EventPublishWorkerService.name);
  private worker?: Worker<PublishedEvent>;

  constructor(
    private readonly config: ConfigService,
    @Inject(PUBLISHING.eventPublisherToken) private readonly eventPublisher: EventPublisher,
  ) {}

  onApplicationBootstrap(): void {
    this.worker = new Worker<PublishedEvent>(EVENT_QUEUE.name, createEventPublishProcessor(this.eventPublisher), {
      // BullMQ exige maxRetriesPerRequest: null en el worker: sus comandos bloqueantes esperan sin límite.
      connection: { ...queueConnectionOptions(this.config), maxRetriesPerRequest: null },
      concurrency: EVENT_QUEUE.workerConcurrency,
      settings: { backoffStrategy: eventBackoffDelay },
    });
    this.worker.on('completed', (job) => this.logger.log(`Event ${job.id} published`));
    this.worker.on('failed', (job, error) =>
      this.logger.warn(`Event ${job?.id} attempt ${job?.attemptsMade} failed: ${error.message}`),
    );
  }

  async onApplicationShutdown(): Promise<void> {
    // close() espera a que terminen los jobs en curso: un rollout no corta un evento a medio publicar.
    await this.worker?.close();
  }
}

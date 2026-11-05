import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PUBLISHING } from '../publishing/constants/publishing.constant';
import { PublishedEvent } from '../publishing/types/published-event.type';
import { EVENT_QUEUE } from '../queue/constants/event-queue.constant';
import { EventEnqueueError } from '../queue/event-enqueue.error';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(@Inject(EVENT_QUEUE.queueToken) private readonly eventQueue: Queue<PublishedEvent>) {}

  /** Queues a message.created event and returns its id. The worker publishes it later. */
  async send(message: SendMessageDto): Promise<string> {
    const event: PublishedEvent = {
      id: randomUUID(),
      source: PUBLISHING.eventSource,
      type: 'message.created',
      occurredAt: new Date().toISOString(),
      payload: { text: message.text },
    };

    try {
      // El jobId es el id del evento: si el mismo evento se encola dos veces, BullMQ guarda uno solo.
      await this.eventQueue.add(EVENT_QUEUE.jobName, event, { jobId: event.id });
    } catch (error) {
      throw new EventEnqueueError(`Event ${event.id} could not be queued`, { cause: error });
    }

    return event.id;
  }
}

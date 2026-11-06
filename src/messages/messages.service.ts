import { Inject, Injectable } from '@nestjs/common';
import { Queue } from 'bullmq';
import { randomUUID } from 'node:crypto';
import { PUBLISHING } from '../publishing/constants/publishing.constant';
import { PublishedEvent } from '../publishing/types/published-event.type';
import { EVENT_QUEUE } from '../queue/constants/event-queue.constant';
import { EventEnqueueError } from '../queue/event-enqueue.error';
import { SendMessageDto } from './dto/send-message.dto';
import { SentMessage } from './types/sent-message.type';

@Injectable()
export class MessagesService {
  constructor(@Inject(EVENT_QUEUE.queueToken) private readonly eventQueue: Queue<PublishedEvent>) {}

  /**
   * Gives the message its own id, queues a message.created event about it and returns both ids.
   * The worker publishes the event later.
   */
  async send(message: SendMessageDto): Promise<SentMessage> {
    const messageId = randomUUID();
    const event: PublishedEvent = {
      id: randomUUID(),
      source: PUBLISHING.eventSource,
      type: 'message.created',
      occurredAt: new Date().toISOString(),
      payload: { messageId, text: message.text },
    };

    try {
      // El jobId es el id del evento: si el mismo evento se encola dos veces, BullMQ guarda uno solo.
      await this.eventQueue.add(EVENT_QUEUE.jobName, event, { jobId: event.id });
    } catch (error) {
      throw new EventEnqueueError(`Event ${event.id} could not be queued`, { cause: error });
    }

    return {
      eventId: event.id,
      messageId,
    };
  }
}

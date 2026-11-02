import { Inject, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { PUBLISHING } from '../publishing/constants/publishing.constant';
import type { EventPublisher } from '../publishing/types/event-publisher.type';
import { SendMessageDto } from './dto/send-message.dto';

@Injectable()
export class MessagesService {
  constructor(@Inject(PUBLISHING.eventPublisherToken) private readonly eventPublisher: EventPublisher) {}

  /** Publishes a message.created event and returns its id. */
  async send(message: SendMessageDto): Promise<string> {
    const eventId = randomUUID();
    await this.eventPublisher.publish({
      id: eventId,
      source: PUBLISHING.eventSource,
      type: 'message.created',
      occurredAt: new Date().toISOString(),
      payload: { text: message.text },
    });

    return eventId;
  }
}

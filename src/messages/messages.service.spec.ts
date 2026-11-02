import { EventPublisher } from '../publishing/types/event-publisher.type';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  it('publishes a message.created event from producer-a', async () => {
    const eventPublisher: jest.Mocked<EventPublisher> = { publish: jest.fn().mockResolvedValue(undefined) };
    const service = new MessagesService(eventPublisher);

    const eventId = await service.send({ text: 'hello' });

    expect(eventPublisher.publish).toHaveBeenCalledWith({
      id: eventId,
      source: 'producer-a',
      type: 'message.created',
      occurredAt: expect.any(String),
      payload: { text: 'hello' },
    });
  });
});

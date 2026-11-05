import { Job, UnrecoverableError } from 'bullmq';
import { EventPublishError } from '../publishing/event-publish.error';
import { EventRejectedError } from '../publishing/event-rejected.error';
import { EventPublisher } from '../publishing/types/event-publisher.type';
import { PublishedEvent } from '../publishing/types/published-event.type';
import { createEventPublishProcessor } from './event-publish.processor';

describe('createEventPublishProcessor', () => {
  const event: PublishedEvent = {
    id: '0b6f3c2e-6c1a-4c55-9a59-1f0d6f2c9b11',
    source: 'producer-a',
    type: 'message.created',
    occurredAt: '2026-11-05T18:00:00.000Z',
    payload: { text: 'hello' },
  };
  const job = { data: event } as Job<PublishedEvent>;
  let eventPublisher: jest.Mocked<EventPublisher>;

  beforeEach(() => {
    eventPublisher = { publish: jest.fn() };
  });

  it('publishes the queued event', async () => {
    eventPublisher.publish.mockResolvedValue(undefined);

    await createEventPublishProcessor(eventPublisher)(job);

    expect(eventPublisher.publish).toHaveBeenCalledWith(event);
  });

  it('marks an event the processor rejected as not retryable', async () => {
    eventPublisher.publish.mockRejectedValue(new EventRejectedError('rejected with 400'));

    await expect(createEventPublishProcessor(eventPublisher)(job)).rejects.toThrow(UnrecoverableError);
  });

  it('lets any other failure be retried by the queue', async () => {
    const failure = new EventPublishError('processor down');
    eventPublisher.publish.mockRejectedValue(failure);

    await expect(createEventPublishProcessor(eventPublisher)(job)).rejects.toBe(failure);
  });
});

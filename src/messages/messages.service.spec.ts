import { Queue } from 'bullmq';
import { EventEnqueueError } from '../queue/event-enqueue.error';
import { MessagesService } from './messages.service';

describe('MessagesService', () => {
  let add: jest.Mock;
  let service: MessagesService;

  beforeEach(() => {
    add = jest.fn().mockResolvedValue(undefined);
    service = new MessagesService({ add } as unknown as Queue);
  });

  it('queues a message.created event from producer-a, with the event id as the job id', async () => {
    const eventId = await service.send({ text: 'hello' });

    expect(add).toHaveBeenCalledWith(
      'publish',
      {
        id: eventId,
        source: 'producer-a',
        type: 'message.created',
        occurredAt: expect.any(String),
        payload: { text: 'hello' },
      },
      { jobId: eventId },
    );
  });

  it('fails with an enqueue error when the queue does not take the job', async () => {
    add.mockRejectedValue(new Error("Stream isn't writeable and enableOfflineQueue options is false"));

    await expect(service.send({ text: 'hello' })).rejects.toThrow(EventEnqueueError);
  });
});

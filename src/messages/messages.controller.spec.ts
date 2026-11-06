import { ServiceUnavailableException } from '@nestjs/common';
import { EventEnqueueError } from '../queue/event-enqueue.error';
import { MessagesController } from './messages.controller';
import { MessagesService } from './messages.service';

describe('MessagesController', () => {
  let send: jest.Mock;
  let controller: MessagesController;

  beforeEach(() => {
    send = jest.fn();
    controller = new MessagesController({ send } as unknown as MessagesService);
  });

  it('answers with the event id and the message id', async () => {
    const sent = {
      eventId: '0b6f3c2e-6c1a-4c55-9a59-1f0d6f2c9b11',
      messageId: '5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f',
    };
    send.mockResolvedValue(sent);

    await expect(controller.send({ text: 'hello' })).resolves.toEqual(sent);
  });

  it('answers 503 when the event could not be queued', async () => {
    send.mockRejectedValue(new EventEnqueueError('queue down'));

    await expect(controller.send({ text: 'hello' })).rejects.toThrow(ServiceUnavailableException);
  });
});

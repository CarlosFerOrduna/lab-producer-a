import { EventKeyUtil } from './event-key.util';
import { PublishedEvent } from './types/published-event.type';

describe('EventKeyUtil', () => {
  const event: PublishedEvent = {
    id: '0b6f3c2e-6c1a-4c55-9a59-1f0d6f2c9b11',
    source: 'producer-a',
    type: 'message.created',
    occurredAt: '2026-11-06T18:00:00.000Z',
    payload: { messageId: '5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f', text: 'hello' },
  };

  it('keys an event by the id of its message', () => {
    expect(EventKeyUtil.keyOf(event)).toBe('5c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f');
  });

  it('falls back to the event id for an event queued before messages had an id', () => {
    expect(EventKeyUtil.keyOf({ ...event, payload: { text: 'hello' } })).toBe(event.id);
  });
});

import { eventBackoffDelay } from './event-backoff.util';

describe('eventBackoffDelay', () => {
  it('doubles from one second', () => {
    expect([1, 2, 3, 4].map(eventBackoffDelay)).toEqual([1000, 2000, 4000, 8000]);
  });

  it('never waits more than a minute', () => {
    expect(eventBackoffDelay(7)).toBe(60_000);
    expect(eventBackoffDelay(1000)).toBe(60_000);
  });
});

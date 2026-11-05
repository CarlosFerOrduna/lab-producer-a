import { EVENT_QUEUE } from './constants/event-queue.constant';

/** Delay before the next attempt: doubles from 1 s and never exceeds 60 s. */
export function eventBackoffDelay(attemptsMade: number): number {
  const exponentialDelay = EVENT_QUEUE.initialBackoffMs * 2 ** Math.max(attemptsMade - 1, 0);
  return Math.min(exponentialDelay, EVENT_QUEUE.maxBackoffMs);
}

export const PUBLISHING = {
  eventPublisherToken: Symbol('EventPublisher'),
  eventSource: 'producer-a',
  maxAttempts: 3,
  initialBackoffMs: 200,
  requestTimeoutMs: 2000,
} as const;

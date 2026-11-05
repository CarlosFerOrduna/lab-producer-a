export const EVENT_QUEUE = {
  name: 'events',
  jobName: 'publish',
  queueToken: Symbol('EventQueue'),
  probeClientToken: Symbol('EventQueueProbeClient'),
  // With 1-minute retries at most, about a day of attempts before a job is marked failed.
  attempts: 1440,
  initialBackoffMs: 1000,
  maxBackoffMs: 60_000,
  // noeviction never frees memory on its own: finished jobs must be trimmed.
  keepCompletedJobs: 1000,
  keepFailedJobsSeconds: 7 * 24 * 60 * 60,
  workerConcurrency: 5,
} as const;

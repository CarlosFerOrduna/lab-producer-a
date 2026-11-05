import { Job, UnrecoverableError } from 'bullmq';
import { EventRejectedError } from '../publishing/event-rejected.error';
import { EventPublisher } from '../publishing/types/event-publisher.type';
import { PublishedEvent } from '../publishing/types/published-event.type';

/** Builds the job handler: publishes the queued event, and never retries an event the processor rejected. */
export function createEventPublishProcessor(eventPublisher: EventPublisher) {
  return async (job: Job<PublishedEvent>): Promise<void> => {
    try {
      await eventPublisher.publish(job.data);
    } catch (error) {
      if (error instanceof EventRejectedError) {
        throw new UnrecoverableError(error.message);
      }
      throw error;
    }
  };
}

import { PublishedEvent } from './types/published-event.type';

/** Helpers for the Kafka key of an event. */
export class EventKeyUtil {
  /**
   * The key of an event: the id of the message it is about, so every event of one message goes to the
   * same partition. Falls back to the event id for an event without a message id.
   */
  static keyOf(event: PublishedEvent): string {
    const { messageId } = event.payload as { messageId?: unknown };
    // Los jobs encolados antes de que existiera messageId no lo tienen: el id del evento también es único.
    return typeof messageId === 'string' ? messageId : event.id;
  }
}

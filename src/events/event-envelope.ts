export type EventEnvelope<T> = {
  eventId: string;
  eventType: string;
  version: number;
  occurredAt: string;
  data: T;
};
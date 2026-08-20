import { DateTime } from "luxon";

export type ReplayEvent = {
  key: string;
  eventType: string;
  thread: string;
  timestamp: string;
  timeAbsMs: number;
  details: any;
};

export function replayEventsFrom(session: any): ReplayEvent[] {
  const collectedEvents: Omit<ReplayEvent, "key">[] = [];

  Object.keys(session.threads ?? {}).forEach((thread) => {
    session.threads[thread].forEach((event: any) => {
      collectedEvents.push({
        eventType: event.event_type,
        thread,
        timestamp: event.timestamp,
        timeAbsMs: DateTime.fromISO(event.timestamp, {
          zone: "utc",
        }).toMillis(),
        details: event,
      });
    });
  });

  if (Array.isArray(session.traces)) {
    session.traces.forEach((trace: any) => {
      collectedEvents.push({
        eventType: "trace",
        thread: String(trace.thread_name ?? "unknown"),
        timestamp: trace.start_time,
        timeAbsMs: DateTime.fromISO(trace.start_time, {
          zone: "utc",
        }).toMillis(),
        details: trace,
      });
    });
  }

  collectedEvents.sort((a, b) => a.timeAbsMs - b.timeAbsMs);

  return collectedEvents.map((event, index) => ({
    ...event,
    key: `${event.eventType}|${event.thread}|${event.timestamp}|${index}`,
  }));
}

import { replayEventsFrom } from "@/app/components/session_replay/events";

const at = (seconds: number) =>
  new Date(Date.parse(start) + seconds * 1000).toISOString();

function timelineWith(events: any[], traces: any[] = []) {
  return { threads: { main: events }, traces };
}

const start = "2026-05-26T10:00:00.000Z";

describe("replayEventsFrom", () => {
  it("merges threads and traces into one stream ordered by time", () => {
    const events = replayEventsFrom(
      timelineWith(
        [
          { event_type: "gesture_click", timestamp: at(3) },
          { event_type: "lifecycle_app", timestamp: at(1) },
        ],
        [{ thread_name: "main", trace_name: "t", start_time: at(2) }],
      ),
    );

    expect(events.map((e) => e.eventType)).toEqual([
      "lifecycle_app",
      "trace",
      "gesture_click",
    ]);
  });

  it("sets each event's thread and defaults missing trace threads", () => {
    const events = replayEventsFrom(
      timelineWith(
        [{ event_type: "gesture_click", timestamp: at(1) }],
        [
          { thread_name: "msr-default", trace_name: "t", start_time: at(2) },
          { trace_name: "u", start_time: at(3) },
        ],
      ),
    );

    // An event uses its containing thread. A trace uses its own thread name,
    // or "unknown" when it has none.
    expect(events.map((e) => e.thread)).toEqual([
      "main",
      "msr-default",
      "unknown",
    ]);
  });

  it("gives colliding events distinct keys", () => {
    const events = replayEventsFrom(
      timelineWith([
        { event_type: "lifecycle_view_controller", timestamp: at(1) },
        { event_type: "lifecycle_view_controller", timestamp: at(1) },
      ]),
    );

    expect(new Set(events.map((e) => e.key)).size).toBe(2);
  });
});

import { PillType } from "@/app/components/pill";
import { replayEventsFrom } from "@/app/components/session_replay/events";
import {
  replayFrom,
  idleSkipThresholdMs,
} from "@/app/components/session_replay/replay";

const at = (seconds: number) =>
  new Date(Date.parse(start) + seconds * 1000).toISOString();

function timelineWith(events: any[], traces: any[] = []) {
  return { threads: { main: events }, traces };
}

function attachment(type: string, name: string) {
  return { id: name, name, type, key: "k", location: `https://cdn/${name}` };
}

const start = "2026-05-26T10:00:00.000Z";

describe("attachment refs", () => {
  const attachmentRefsOf = (events: any[]) =>
    replayFrom(timelineWith(events)).attachmentRefs;

  it("keeps every attachment, ordered by layout, wireframe, then image", () => {
    const attachmentRefs = attachmentRefsOf([
      {
        event_type: "gesture_click",
        timestamp: at(1),
        attachments: [
          attachment("screenshot", "shot.webp"),
          attachment("layout_snapshot", "snapshot.svg"),
          attachment("layout_snapshot_json", "b.json"),
          attachment("layout_snapshot_json", "a.json"),
        ],
      },
    ]);

    // Attachments are ordered as layout trees, SVG wireframes, then raster
    // images, preserving their order within each kind. The first is shown
    // initially; the switcher offers the rest.
    expect(attachmentRefs.map((attachmentRef) => attachmentRef.url)).toEqual([
      "https://cdn/b.json",
      "https://cdn/a.json",
      "https://cdn/snapshot.svg",
      "https://cdn/shot.webp",
    ]);
    expect(attachmentRefs.map((attachmentRef) => attachmentRef.format)).toEqual(
      ["layout", "layout", "svg", "raster"],
    );
  });

  it("includes screenshots attached to crash events", () => {
    const attachmentRefs = attachmentRefsOf([
      {
        event_type: "exception",
        timestamp: at(1),
        attachments: [attachment("screenshot", "shot.webp")],
      },
    ]);

    expect(attachmentRefs.map((attachmentRef) => attachmentRef.format)).toEqual(
      ["raster"],
    );
  });

  it("uses the attachment name to identify an SVG wireframe", () => {
    const attachmentRefs = attachmentRefsOf([
      {
        event_type: "gesture_click",
        timestamp: at(1),
        attachments: [attachment("layout_snapshot", "snapshot.svg")],
      },
    ]);

    expect(attachmentRefs[0].format).toBe("svg");
  });

  it("ignores attachments without an id", () => {
    const attachmentRefs = attachmentRefsOf([
      {
        event_type: "gesture_click",
        timestamp: at(1),
        attachments: [
          {
            name: "a.json",
            type: "layout_snapshot_json",
            location: "https://cdn/a.json",
          },
          attachment("layout_snapshot_json", "b.json"),
        ],
      },
    ]);

    expect(attachmentRefs.map((attachmentRef) => attachmentRef.id)).toEqual([
      "b.json",
    ]);
  });

  it("ignores attachments without a location", () => {
    const attachmentRefs = attachmentRefsOf([
      {
        event_type: "gesture_click",
        timestamp: at(1),
        attachments: [
          { id: "a", name: "snapshot.svg", type: "layout_snapshot" },
          attachment("layout_snapshot_json", "snapshot.json"),
        ],
      },
    ]);

    expect(attachmentRefs.map((attachmentRef) => attachmentRef.format)).toEqual(
      ["layout"],
    );
  });
});

describe("attachment ref groups", () => {
  const withAttachments = (seconds: number, ...names: string[]) => ({
    event_type: "gesture_click",
    timestamp: at(seconds),
    attachments: names.map((name) => attachment("layout_snapshot_json", name)),
  });
  const plain = (seconds: number) => ({
    event_type: "lifecycle_app",
    timestamp: at(seconds),
  });

  it("collects an event's attachments into one group, in the order it offers them", () => {
    const replay = replayFrom(
      timelineWith([
        withAttachments(1, "b.json", "a.json"),
        withAttachments(2, "c.json"),
      ]),
    );

    expect(
      replay.attachmentRefGroups.map((group) =>
        group.attachmentRefs.map((attachmentRef) => attachmentRef.url),
      ),
    ).toEqual([
      ["https://cdn/b.json", "https://cdn/a.json"],
      ["https://cdn/c.json"],
    ]);
    expect(replay.attachmentRefGroups.map((group) => group.eventIndex)).toEqual(
      [0, 1],
    );
  });

  it("keeps showing an attachment until a later event has one", () => {
    const replay = replayFrom(
      timelineWith([
        withAttachments(1, "a.json"),
        plain(2),
        withAttachments(3, "b.json"),
      ]),
    );

    expect(replay.shownAttachmentRefGroupIndexByEventIndex).toEqual([0, 0, 1]);
  });

  it("leaves the events before the first attachment with none to show", () => {
    const replay = replayFrom(
      timelineWith([plain(1), withAttachments(2, "a.json")]),
    );

    expect(replay.shownAttachmentRefGroupIndexByEventIndex).toEqual([
      undefined,
      0,
    ]);
  });
});

describe("replayFrom", () => {
  const timeline = timelineWith([
    { event_type: "lifecycle_app", timestamp: at(0) },
    { event_type: "gesture_click", timestamp: at(2), x: 40, y: 100 },
    { event_type: "lifecycle_app", timestamp: at(10) },
  ]);
  const events = replayEventsFrom(timeline);

  it("spans the whole session", () => {
    const replay = replayFrom(timeline);

    expect(replay.startAbsMs).toBe(events[0].timeAbsMs);
    expect(replay.durationMs).toBe(10_000);
    expect(replay.events).toHaveLength(3);
  });

  it("carries each event's thread onto its row", () => {
    const rows = replayFrom({
      threads: {
        main: [{ event_type: "gesture_click", timestamp: at(0) }],
        "com.apple.main-thread": [
          { event_type: "lifecycle_view_controller", timestamp: at(1) },
        ],
        "msr-default": [{ event_type: "http", timestamp: at(2) }],
      },
      traces: [],
    }).rows;

    expect(rows.map((row) => row.threadName)).toEqual([
      "main",
      "com.apple.main-thread",
      "msr-default",
    ]);
  });

  it("formats launch durations", () => {
    const rows = replayFrom(
      timelineWith([
        { event_type: "cold_launch", timestamp: at(0), duration: 238 },
        { event_type: "warm_launch", timestamp: at(1), duration: 9174 },
        { event_type: "hot_launch", timestamp: at(2) },
      ]),
    ).rows;

    expect(rows[0].title).toBe("238ms");
    expect(rows[1].title).toBe("9.174s");
    // A launch without a duration keeps its pill and has an empty title.
    expect(rows[2].title).toBe("");
    expect(rows[2].pillType).toBe(PillType.SessionEventHotLaunch);
  });

  it("formats app hang titles using the duration and state", () => {
    const rows = replayFrom(
      timelineWith([
        {
          event_type: "app_hang",
          thread_name: "main",
          duration: 5090,
          state: "recovered",
          method_name: "ViewController.blockMainThread()",
          file_name: "ViewController.swift",
          timestamp: at(0),
        },
        {
          event_type: "app_hang",
          thread_name: "main",
          duration: 8000,
          state: "killed",
          method_name: "ViewController.blockMainThread()",
          file_name: "ViewController.swift",
          timestamp: at(1),
        },
      ]),
    ).rows;

    expect(rows[0].title).toBe("Main thread blocked for 5.1s");
    expect(rows[0].pillType).toBe(PillType.SessionEventAppHang);
    expect(rows[1].title).toBe("Main thread blocked for 8s, app killed");
    expect(rows[1].pillType).toBe(PillType.SessionEventAppHang);
  });

  it("formats a network change from the previous to the new network", () => {
    const rows = replayFrom(
      timelineWith([
        {
          event_type: "network_change",
          timestamp: at(1),
          previous_network_type: "cellular",
          previous_network_generation: "4g",
          network_type: "wifi",
          network_generation: "unknown",
        },
        {
          event_type: "network_change",
          timestamp: at(2),
          previous_network_type: "",
          network_type: "cellular",
          network_generation: "5g",
        },
      ]),
    ).rows;

    expect(rows[0].title).toBe("cellular (4g) to wifi");
    expect(rows[0].pillType).toBe(PillType.SessionEventNetworkChange);
    // The pill contains the label, so the row's pill text is null.
    expect(rows[0].pillText).toBeNull();
    // When the previous network is missing, the title still names the new one.
    expect(rows[1].title).toBe("unknown to cellular (5g)");
  });

  it("gives every event a row the list can render without formatting", () => {
    const replay = replayFrom(timeline);

    expect(replay.rows).toHaveLength(replay.events.length);
    expect(replay.rows[1].atOffsetLabel).toBe("0:02.000");
    expect(replay.rows[1].pillType).toBe(PillType.SessionEventGestureClick);
  });

  it("slices at every event and at every touch release", () => {
    const replay = replayFrom(timeline);

    expect(replay.slices.map((slice) => slice.startOffsetMs)).toEqual([
      0, 2000, 2220, 10_000,
    ]);
    expect(replay.slices.map((slice) => slice.eventIndex)).toEqual([
      0, 1, 1, 2,
    ]);
  });

  it("uses the highlighted gesture's position for the touch indicator", () => {
    const replay = replayFrom(
      timelineWith([
        { event_type: "gesture_click", timestamp: at(1), x: 10, y: 10 },
        { event_type: "gesture_click", timestamp: at(1), x: 90, y: 90 },
      ]),
    );

    // Two gestures at the same time share a slice. The slice uses the later
    // gesture, so the touch indicator must use its position too.
    expect(replay.touches).toHaveLength(2);
    expect(replay.slices[0].eventIndex).toBe(1);
    expect(replay.slices[0].touchIndex).toBe(1);
    expect(replay.touches[1].from).toEqual({ x: 90, y: 90 });
  });

  it("shows the touch indicator from press to release", () => {
    const replay = replayFrom(timeline);

    expect(replay.slices[0].touchIndex).toBeNull();
    expect(replay.slices[1].touchIndex).toBe(0);
    expect(replay.slices[2].touchIndex).toBeNull();
  });

  it("removes the tap indicator when the app opens a new screen", () => {
    const replay = replayFrom(
      timelineWith([
        {
          event_type: "gesture_click",
          timestamp: at(1),
          x: 10,
          y: 10,
          attachments: [attachment("layout_snapshot_json", "tapped.json")],
        },
        { event_type: "lifecycle_activity", timestamp: at(1.05) },
        {
          event_type: "screen_view",
          timestamp: at(1.12),
          attachments: [attachment("layout_snapshot_json", "opened.json")],
        },
      ]),
    );

    // The screen view occurs during the tap's 220 ms hold. The lifecycle
    // event between them has no screen of its own, so the tap's screen remains
    // on the stage and the indicator stays visible until the screen view.
    expect(
      replay.slices.map((slice) => [slice.startOffsetMs, slice.touchIndex]),
    ).toEqual([
      [0, 0],
      [50, 0],
      [120, null],
      [220, null],
    ]);
  });

  it("continues to show touch indicators when the screen stays the same", () => {
    const replay = replayFrom(
      timelineWith([
        {
          event_type: "screen_view",
          timestamp: at(1),
          attachments: [attachment("layout_snapshot_json", "list.json")],
        },
        { event_type: "gesture_scroll", timestamp: at(2), x: 40, y: 300 },
      ]),
    );

    // Only taps record their own screen. The scroll uses the screen from the
    // preceding screen view, which is also the screen used to draw it.
    expect(replay.shownAttachmentRefGroupIndexByEventIndex).toEqual([0, 0]);
    expect(
      replay.slices.map((slice) => [slice.startOffsetMs, slice.touchIndex]),
    ).toEqual([
      [0, null],
      [1000, 0],
      [1220, null],
    ]);
  });

  it("turns a gesture into a pressed touch that releases after a hold", () => {
    const replay = replayFrom(timeline);

    expect(replay.touches).toHaveLength(1);
    const touch = replay.touches[0];
    expect(touch.pressOffsetMs).toBe(2000);
    expect(touch.releaseOffsetMs).toBe(2220);
    expect(touch.to).toEqual(touch.from);
    expect(touch.from).toEqual({ x: 40, y: 100 });
  });

  it("preserves the device-reported touch coordinates", () => {
    const scrolled = timelineWith([
      {
        event_type: "gesture_scroll",
        timestamp: at(1),
        x: 40,
        y: 300,
        end_x: 60,
        end_y: 100,
      },
      { event_type: "lifecycle_app", timestamp: at(3) },
    ]);
    const replay = replayFrom(scrolled);

    const touch = replay.touches[0];
    expect(touch.from).toEqual({ x: 40, y: 300 });
    expect(touch.to).toEqual({ x: 60, y: 100 });
    expect(touch.releaseOffsetMs).toBe(touch.pressOffsetMs + 320);
  });

  it("treats a gesture with no movement as a tap", () => {
    const tapped = timelineWith([
      {
        event_type: "gesture_click",
        timestamp: at(1),
        x: 40,
        y: 300,
        end_x: 40,
        end_y: 300,
      },
      { event_type: "lifecycle_app", timestamp: at(3) },
    ]);
    const replay = replayFrom(tapped);

    expect(replay.touches[0].to).toEqual(replay.touches[0].from);
    expect(replay.touches[0].releaseOffsetMs).toBe(
      replay.touches[0].pressOffsetMs + 220,
    );
  });

  it("extends the timeline past a session-ending tap so its ring can release", () => {
    const replay = replayFrom(
      timelineWith([
        { event_type: "lifecycle_app", timestamp: at(0) },
        { event_type: "gesture_click", timestamp: at(10), x: 40, y: 100 },
      ]),
    );

    expect(replay.durationMs).toBe(10_220);
    expect(replay.slices[replay.slices.length - 1].startOffsetMs).toBe(10_220);
    expect(replay.slices[replay.slices.length - 1].touchIndex).toBeNull();
  });

  it("ends at a swipe's release even when a later tap releases sooner", () => {
    const replay = replayFrom(
      timelineWith([
        { event_type: "lifecycle_app", timestamp: at(0) },
        {
          event_type: "gesture_scroll",
          timestamp: at(10),
          x: 40,
          y: 100,
          end_x: 40,
          end_y: 300,
        },
        { event_type: "gesture_click", timestamp: at(10.05), x: 40, y: 100 },
      ]),
    );

    expect(replay.durationMs).toBe(10_320);
  });

  it("has nothing to play when the session carries no events", () => {
    const replay = replayFrom(timelineWith([]));

    expect(replay.durationMs).toBe(0);
    expect(replay.slices).toHaveLength(0);
  });
});

describe("idle stretches", () => {
  const timeline = timelineWith([
    { event_type: "cold_launch", timestamp: at(0) },
    { event_type: "lifecycle_activity", timestamp: at(1) },
    { event_type: "gesture_click", timestamp: at(2) },
    { event_type: "http", timestamp: at(20) },
    { event_type: "trim_memory", timestamp: at(40) },
    { event_type: "error", timestamp: at(60), severity: "unhandled" },
    { event_type: "anr", timestamp: at(70) },
    { event_type: "bug_report", timestamp: at(80) },
    { event_type: "trim_memory", timestamp: at(90) },
  ]);
  const events = replayEventsFrom(timeline);
  const startMs = events[0].timeAbsMs;
  const durationMs = events[events.length - 1].timeAbsMs - startMs;

  const sliceAt = (offsetMs: number) => {
    const replay = replayFrom(timeline);
    return {
      replay,
      slice: replay.slices.findLast(
        (slice) => slice.startOffsetMs <= offsetMs,
      )!,
    };
  };

  it("skips a stretch that carries events but leaves the screen alone", () => {
    // The events between the gesture and the error are a network call and a
    // memory trim, neither of which puts anything new on the screen.
    const { slice } = sliceAt(3000);

    expect(slice.skipToOffsetMs).toBe(59_500);
  });

  it.each(["screen_view", "lifecycle_activity", "lifecycle_app"])(
    "stops at a %s, which can carry a layout snapshot",
    (eventType) => {
      const replay = replayFrom(
        timelineWith([
          { event_type: "gesture_click", timestamp: at(0) },
          {
            event_type: eventType,
            timestamp: at(30),
            name: "Checkout",
            type: "resumed",
          },
          { event_type: "gesture_click", timestamp: at(60) },
        ]),
      );

      expect(replay.slices[0].skipToOffsetMs).toBe(29_500);
    },
  );

  it("plays through a wait short enough to sit out", () => {
    const shortWait = replayFrom(
      timelineWith([
        { event_type: "gesture_click", timestamp: at(0) },
        { event_type: "gesture_click", timestamp: at(3) },
      ]),
    );

    expect(idleSkipThresholdMs).toBe(5000);
    expect(shortWait.slices[0].skipToOffsetMs).toBeNull();
  });

  it("skips to the end when no activity remains", () => {
    const { replay, slice } = sliceAt(80_000);

    expect(slice.skipToOffsetMs).toBe(replay.durationMs);
  });

  it("does not skip when the end is within the threshold", () => {
    const { slice } = sliceAt(90_000);

    expect(slice.skipToOffsetMs).toBeNull();
  });
});

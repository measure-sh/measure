import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { createActor, waitFor as machineWaitFor } from "xstate";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactElement } from "react";
import {
  containerScaleOf,
  fitInto,
  imageSizeOf,
  layerCountOf,
  treeOutlineWidthPx,
  ringOnStageAt,
  sourceSizeOf,
  viewBoxOf,
  stagePointFrom,
  tiltScaleFor,
  ringPositionAt,
  sessionReplayMachine,
  StageAttachment,
  replayFrom,
  replayEventsFrom,
  demoSession,
  shownAttachmentRefOf,
  attachmentRefIndexAt,
  windowedAttachmentRefs,
  defaultReplayAccent,
  formatOffset,
  formatSkipped,
  tickOffsetMs,
  idleSkipThresholdMs,
  projectedExtent,
  sessionEventTitle,
  detailRows,
  eventTrace,
  type LayoutElement,
  type Attachment,
} from "@/app/components/session_replay";
import SessionReplay from "@/app/components/session_replay";
import { makeSessionReplayFixture } from "@/__tests__/msw/fixtures";
import { PillType } from "@/app/components/pill";
import posthog from "posthog-js";

// jsdom has no layout, so it leaves this unimplemented. The player observes
// its stage for resizes.
Object.defineProperty(window, "ResizeObserver", {
  value: class {
    observe() {}
    unobserve() {}
    disconnect() {}
  },
  writable: true,
  configurable: true,
});

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { captureException: jest.fn() },
}));

// Many tests here drive attachments into failures on purpose, and the player
// reports each one to the console as it would in the browser. Silencing that
// keeps the run readable; the tests that care about a report assert on the
// PostHog mock or on a spy of their own.
jest.spyOn(console, "error").mockImplementation(() => {});

// Shiki highlighting does not run under jsdom; the stacktrace tests only need
// the text.
jest.mock("@/app/components/code_block", () => ({
  __esModule: true,
  CODE_BLOCK_CARD_CLASS: "",
  default: ({ code }: any) => <pre>{code}</pre>,
}));

// The snapshot the marketing demo ships, which follows the SDK's convention of
// absolute coordinates within the root.
const demoLayout: LayoutElement = JSON.parse(
  readFileSync(
    join(process.cwd(), "public/snapshots/demo_snapshot_discount_click.json"),
    "utf8",
  ),
);

const start = "2026-05-26T10:00:00.000Z";
const at = (seconds: number) =>
  new Date(Date.parse(start) + seconds * 1000).toISOString();

function timelineWith(events: any[], traces: any[] = []) {
  return { threads: { main: events }, traces };
}

function attachment(type: string, name: string) {
  return { id: name, name, type, key: "k", location: `https://cdn/${name}` };
}

function nodesOf(node: any, out: any[] = []): any[] {
  out.push(node);
  (node.childNodes ?? []).forEach((child: any) => nodesOf(child, out));
  return out;
}

function classesOf(fullSnapshot: any): string[] {
  return nodesOf(fullSnapshot.data.node)
    .map((n) => n.attributes?.class)
    .filter(Boolean);
}

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

  it("names the thread of every event, and of a trace that left it out", () => {
    const events = replayEventsFrom(
      timelineWith(
        [{ event_type: "gesture_click", timestamp: at(1) }],
        [
          { thread_name: "msr-default", trace_name: "t", start_time: at(2) },
          { trace_name: "u", start_time: at(3) },
        ],
      ),
    );

    // An event's thread is the group it arrived under. A trace names its own,
    // and one that left it out takes the same filler the SDKs use.
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

describe("attachment refs", () => {
  const attachmentRefsOf = (events: any[]) =>
    replayFrom(timelineWith(events)).attachmentRefs;

  it("keeps every attachment, layout trees first, then wireframes, then images", () => {
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

    // Layout trees, then SVG wireframes, then raster images, and within a
    // kind the order the event carries them. The first is what plays; the rest
    // are what the switcher offers.
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

  it("takes a screenshot from a crash as readily as from a gesture", () => {
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

  it("falls back to the wireframe, reading its format from the name", () => {
    const attachmentRefs = attachmentRefsOf([
      {
        event_type: "gesture_click",
        timestamp: at(1),
        attachments: [attachment("layout_snapshot", "snapshot.svg")],
      },
    ]);

    expect(attachmentRefs[0].format).toBe("svg");
  });

  it("ignores an attachment without an id to file it under", () => {
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

  it("ignores an attachment without a location to fetch", () => {
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

  it("holds an attachment over the events that follow it until a newer one", () => {
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

describe("the demo session", () => {
  it("gives every one of its screens an id of its own", () => {
    // Attachments are cached under the id the session gives them, so two screens
    // sharing an id would draw as one screen shown twice.
    const ids = replayFrom(demoSession).attachmentRefs.map(
      (attachmentRef) => attachmentRef.id,
    );

    expect(ids.length).toBeGreaterThan(1);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("the attachment window", () => {
  const attachmentRefsAt = (...seconds: number[]) =>
    seconds.map((second, index) => ({
      eventIndex: index,
      eventKey: `k${index}`,
      orderIndex: 0,
      id: `a${index}`,
      atOffsetMs: second * 1000,
      url: `https://cdn/a${index}`,
      format: "layout" as const,
    }));

  it("centres on the attachment the playhead has reached, or the next one due", () => {
    const attachmentRefs = attachmentRefsAt(0, 5, 10);

    expect(attachmentRefIndexAt(attachmentRefs, 5000)).toBe(1);
    expect(attachmentRefIndexAt(attachmentRefs, 6000)).toBe(2);
    expect(attachmentRefIndexAt(attachmentRefs, 99_000)).toBe(3);
  });

  it("offers the attachments nearest the playhead first", () => {
    const attachmentRefs = attachmentRefsAt(0, 1, 2, 3, 4);

    expect(
      windowedAttachmentRefs(attachmentRefs, 2, 5).map(
        (attachmentRef) => attachmentRef.id,
      ),
    ).toEqual(["a2", "a1", "a3", "a0", "a4"]);
  });

  it("reaches no further than the radius, at either end of the session", () => {
    const attachmentRefs = attachmentRefsAt(0, 1, 2, 3, 4);

    expect(
      windowedAttachmentRefs(attachmentRefs, 2, 1).map(
        (attachmentRef) => attachmentRef.id,
      ),
    ).toEqual(["a2", "a1", "a3"]);
    expect(
      windowedAttachmentRefs(attachmentRefs, 0, 2).map(
        (attachmentRef) => attachmentRef.id,
      ),
    ).toEqual(["a0", "a1", "a2"]);
  });

  it("works back from the end when the playhead is past the last attachment", () => {
    const attachmentRefs = attachmentRefsAt(0, 1, 2);

    expect(
      windowedAttachmentRefs(attachmentRefs, 3, 1).map(
        (attachmentRef) => attachmentRef.id,
      ),
    ).toEqual(["a2"]);
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

  it("reads a launch as how long it took", () => {
    const rows = replayFrom(
      timelineWith([
        { event_type: "cold_launch", timestamp: at(0), duration: 238 },
        { event_type: "warm_launch", timestamp: at(1), duration: 9174 },
        { event_type: "hot_launch", timestamp: at(2) },
      ]),
    ).rows;

    expect(rows[0].title).toBe("238ms");
    expect(rows[1].title).toBe("9.174s");
    // A launch that reports no duration keeps its pill and says no more.
    expect(rows[2].title).toBe("");
    expect(rows[2].pillType).toBe(PillType.SessionEventHotLaunch);
  });

  it("reads a network change as the move from one network to the next", () => {
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
    // The pill carries the label, so the row keeps its own text empty.
    expect(rows[0].pillText).toBeNull();
    // A missing previous network still names the one being moved to.
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

  it("draws the ring of the gesture whose row is active, not an earlier one at the same time", () => {
    const replay = replayFrom(
      timelineWith([
        { event_type: "gesture_click", timestamp: at(1), x: 10, y: 10 },
        { event_type: "gesture_click", timestamp: at(1), x: 90, y: 90 },
      ]),
    );

    // Two gestures in one millisecond share a slice, and the slice names the
    // later of them, so the ring has to come from that same gesture.
    expect(replay.touches).toHaveLength(2);
    expect(replay.slices[0].eventIndex).toBe(1);
    expect(replay.slices[0].touchIndex).toBe(1);
    expect(replay.touches[1].from).toEqual({ x: 90, y: 90 });
  });

  it("shows the ring from the press until the release", () => {
    const replay = replayFrom(timeline);

    expect(replay.slices[0].touchIndex).toBeNull();
    expect(replay.slices[1].touchIndex).toBe(0);
    expect(replay.slices[2].touchIndex).toBeNull();
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

  it("keeps a touch in the coordinates the device reported", () => {
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

  it("taps rather than drags when a gesture did not travel", () => {
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

describe("fitInto", () => {
  it("keeps its aspect and clears the bands the overlays sit in", () => {
    const fit = fitInto({ width: 200, height: 400 }, 1000, 1000);

    expect(fit.widthPercent).toBeCloseTo(fit.heightPercent / 2);
    // Below the switcher and the notice, above the turn hint.
    expect(fit.topPercent).toBeGreaterThanOrEqual(4.4);
    expect(fit.topPercent + fit.heightPercent).toBeLessThanOrEqual(97.2);
    expect(fit.leftPercent).toBeCloseTo((100 - fit.widthPercent) / 2);
  });

  it("fills the width when the attachment is wider than it is tall", () => {
    const fit = fitInto({ width: 400, height: 200 }, 1000, 1000);

    expect(fit.heightPercent).toBeCloseTo(fit.widthPercent / 2);
    expect(fit.widthPercent).toBeLessThanOrEqual(94.4);
  });

  it("gives the same box to two attachments of one screen at different resolutions", () => {
    const screenshot = fitInto({ width: 1170, height: 2532 }, 1000, 1000);
    const wireframe = fitInto({ width: 390, height: 844 }, 1000, 1000);

    // The boxes coincide, so the picture holds still when the switcher is
    // used. Only the space each maps gestures from differs.
    expect(screenshot.leftPercent).toBeCloseTo(wireframe.leftPercent);
    expect(screenshot.topPercent).toBeCloseTo(wireframe.topPercent);
    expect(screenshot.widthPercent).toBeCloseTo(wireframe.widthPercent);
    expect(screenshot.heightPercent).toBeCloseTo(wireframe.heightPercent);
  });
});

describe("imageSizeOf", () => {
  // jsdom loads no images, so this stands in for one. It records what is
  // assigned to src and hands back the instance so a test can decode it.
  const trackingImage = () => {
    const assigned: string[] = [];
    const instances: any[] = [];
    const original = (globalThis as any).Image;
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor() {
        instances.push(this);
      }
      set src(url: string) {
        assigned.push(url);
      }
    };
    return {
      assigned,
      instances,
      restore: () => {
        (globalThis as any).Image = original;
      },
    };
  };

  it("drops the image source when the fetch is aborted", async () => {
    const { assigned, restore } = trackingImage();
    try {
      // An abort that only settled the promise would leave the browser
      // downloading a screenshot nobody is waiting for, holding bandwidth
      // against the ones the playhead is heading towards.
      const controller = new AbortController();
      const size = imageSizeOf("https://cdn/shot.webp", controller.signal);
      const reason = new Error("attachment fetch timed out");
      controller.abort(reason);

      await expect(size).rejects.toBe(reason);
      expect(assigned).toEqual(["https://cdn/shot.webp", ""]);
    } finally {
      restore();
    }
  });

  it("leaves the image source alone once it has been measured", async () => {
    const { assigned, instances, restore } = trackingImage();
    try {
      const controller = new AbortController();
      const size = imageSizeOf("https://cdn/shot.webp", controller.signal);
      instances[0].onload();

      await expect(size).resolves.toEqual({ width: 200, height: 400 });
      expect(assigned).toEqual(["https://cdn/shot.webp"]);
    } finally {
      restore();
    }
  });
});

describe("sourceSizeOf", () => {
  it("divides an Apple screenshot into the points its gestures use", () => {
    expect(
      sourceSizeOf(
        { width: 1179, height: 2556 },
        {
          os_name: "ios",
          device_density: 3,
        },
      ),
    ).toEqual({ width: 393, height: 852 });
  });

  it("leaves Android alone, where both are already pixels", () => {
    expect(
      sourceSizeOf(
        { width: 1080, height: 2400 },
        {
          os_name: "android",
          device_density: 3,
        },
      ),
    ).toEqual({ width: 1080, height: 2400 });
  });

  it("leaves an Apple screenshot alone when the density is missing", () => {
    expect(
      sourceSizeOf({ width: 1179, height: 2556 }, { os_name: "ios" }),
    ).toEqual({ width: 1179, height: 2556 });
  });
});

describe("viewBoxOf", () => {
  it("reads the width and height a wireframe is drawn at", () => {
    expect(viewBoxOf('<svg viewBox="0 0 300 600">')).toEqual({
      width: 300,
      height: 600,
    });
  });

  it("reads a viewBox written with commas", () => {
    expect(viewBoxOf("<svg viewBox='0,0,300,600'>")).toEqual({
      width: 300,
      height: 600,
    });
  });

  it.each([
    ["no viewBox at all", "<svg><rect/></svg>"],
    ["a viewBox short of four numbers", '<svg viewBox="0 0 300">'],
    [
      "a viewBox carrying something other than numbers",
      '<svg viewBox="0 0 a 600">',
    ],
    ["a viewBox with no area to draw in", '<svg viewBox="0 0 0 600">'],
  ])("has no size to give for %s", (_case, svg) => {
    expect(viewBoxOf(svg)).toBeNull();
  });
});

describe("stagePointFrom", () => {
  it("maps a gesture through the box its attachment was given", () => {
    const fit = fitInto({ width: 200, height: 400 }, 1000, 1000);

    const centre = stagePointFrom({ x: 100, y: 200 }, fit);
    expect(centre.xPercent).toBeCloseTo(50);
    expect(centre.yPercent).toBeCloseTo(fit.topPercent + fit.heightPercent / 2);
  });

  it("maps a gesture to the same place on a 3x screenshot as on a wireframe", () => {
    const attributes = { os_name: "ios", device_density: 3 };
    const screenshot = fitInto(
      sourceSizeOf({ width: 1170, height: 2532 }, attributes),
      1000,
      1000,
    );
    const wireframe = fitInto({ width: 390, height: 844 }, 1000, 1000);

    expect(stagePointFrom({ x: 195, y: 422 }, screenshot)).toEqual(
      stagePointFrom({ x: 195, y: 422 }, wireframe),
    );
  });
});

describe("tiltScaleFor", () => {
  const fit = fitInto({ width: 390, height: 844 }, 1000, 1000);

  it("pulls back by nothing while the attachment is at rest", () => {
    expect(tiltScaleFor(12, fit, { xDegrees: 0, yDegrees: 0 })).toBe(1);
  });

  it("pulls back far enough to keep a full tilt inside the stage", () => {
    const scale = tiltScaleFor(12, fit, { xDegrees: -40, yDegrees: 40 });

    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.2);
  });

  it("gives a narrow attachment the same pull-back as a wide one", () => {
    // The lift is a share of the width the attachment was given, so a screen
    // fitted into a third of the stage turns at the same proportions as one
    // that fills it.
    const narrow = fitInto({ width: 390, height: 844 }, 3000, 1000);
    const wide = fitInto({ width: 390, height: 844 }, 1000, 1000);
    const tilt = { xDegrees: -20, yDegrees: 35 };

    expect(tiltScaleFor(16, narrow, tilt)).toBeCloseTo(
      tiltScaleFor(16, wide, tilt),
      1,
    );
  });

  it("pulls back further for a deeper tree", () => {
    expect(tiltScaleFor(16, fit, { xDegrees: -40, yDegrees: 40 })).toBeLessThan(
      tiltScaleFor(4, fit, { xDegrees: -40, yDegrees: 40 }),
    );
  });

  it("leaves an attachment that cannot tilt at full size", () => {
    expect(tiltScaleFor(null, fit, { xDegrees: -40, yDegrees: 40 })).toBe(1);
  });
});

describe("treeOutlineWidthPx", () => {
  it("asks for the same width in device pixels whatever the display", () => {
    expect(treeOutlineWidthPx(2, 1) * 2).toBeCloseTo(2.5);
    expect(treeOutlineWidthPx(1.8, 1) * 1.8).toBeCloseTo(2.5);
  });

  it("widens the request when a scaled ancestor shrinks the stage", () => {
    expect(treeOutlineWidthPx(2, 0.5)).toBeCloseTo(
      treeOutlineWidthPx(2, 1) * 2,
    );
  });

  it("stays at a whole pixel on a display that has no room to spare", () => {
    expect(treeOutlineWidthPx(1, 1)).toBe(2.5);
    expect(treeOutlineWidthPx(8, 1)).toBe(1);
  });
});

describe("containerScaleOf", () => {
  const viewOf = (frames: { rect: number; offset: number }[]): Window => {
    const build = (index: number): Window =>
      ({
        frameElement:
          index >= frames.length
            ? null
            : ({
                offsetWidth: frames[index].offset,
                getBoundingClientRect: () => ({ width: frames[index].rect }),
                ownerDocument: { defaultView: build(index + 1) },
              } as unknown as HTMLElement),
      }) as Window;
    return build(0);
  };

  it("reports no scaling for a document that stands on its own", () => {
    expect(containerScaleOf(viewOf([]))).toBe(1);
  });

  it("reads the scale a transformed frame applies", () => {
    expect(containerScaleOf(viewOf([{ rect: 800, offset: 1000 }]))).toBeCloseTo(
      0.8,
    );
  });

  it("multiplies the scales of nested frames", () => {
    expect(
      containerScaleOf(
        viewOf([
          { rect: 800, offset: 1000 },
          { rect: 250, offset: 500 },
        ]),
      ),
    ).toBeCloseTo(0.4);
  });

  it("stops at a frame it cannot measure", () => {
    expect(
      containerScaleOf(
        viewOf([
          { rect: 800, offset: 1000 },
          { rect: 250, offset: 0 },
        ]),
      ),
    ).toBeCloseTo(0.8);
  });
});

describe("ringPositionAt", () => {
  const tap = {
    pressOffsetMs: 1000,
    releaseOffsetMs: 1220,
    from: { x: 10, y: 10 },
    to: { x: 10, y: 10 },
  };
  const swipe = {
    pressOffsetMs: 2000,
    releaseOffsetMs: 2320,
    from: { x: 0, y: 0 },
    to: { x: 100, y: 0 },
  };

  it("is at the touch position during the hold", () => {
    expect(ringPositionAt(tap, 1100)).toEqual({ x: 10, y: 10 });
  });

  it("interpolates a swipe's travel", () => {
    expect(ringPositionAt(swipe, 2160).x).toBeCloseTo(50);
  });

  it("holds at the lift point once the travel is done", () => {
    expect(ringPositionAt(swipe, 2320).x).toBeCloseTo(100);
  });
});

describe("the stage frames", () => {
  const countNodes = (node: LayoutElement): number =>
    1 +
    (node.children ?? []).reduce((sum, child) => sum + countNodes(child), 0);

  const layoutFrame: Attachment = {
    id: "layout",
    sourceSize: { width: demoLayout.width, height: demoLayout.height },
    layerCount: layerCountOf(demoLayout),
    content: { kind: "layout", root: demoLayout },
  };

  it("renders every element of the tree as a node", () => {
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={layoutFrame}
        hidden={false}
        accent="#00ff00"
        fit={fitInto(
          { width: demoLayout.width, height: demoLayout.height },
          demoLayout.width,
          demoLayout.height,
        )}
        stageWidthPx={demoLayout.width}
      />,
    );

    expect(container.querySelectorAll("[data-label]")).toHaveLength(
      countNodes(demoLayout),
    );
  });

  it("marks the tapped element and leaves exactly one target", () => {
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={layoutFrame}
        hidden={false}
        accent="#00ff00"
        fit={fitInto(
          { width: demoLayout.width, height: demoLayout.height },
          demoLayout.width,
          demoLayout.height,
        )}
        stageWidthPx={demoLayout.width}
      />,
    );

    const targets = [
      ...container.querySelectorAll<HTMLElement>("[data-label]"),
    ].filter((node) => node.className.includes("bg-primary/30"));
    expect(targets).toHaveLength(1);
  });

  it("positions nodes at their own absolute coordinates", () => {
    const child = (demoLayout.children ?? [])[0];
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={layoutFrame}
        hidden={false}
        accent="#00ff00"
        fit={fitInto(
          { width: demoLayout.width, height: demoLayout.height },
          demoLayout.width,
          demoLayout.height,
        )}
        stageWidthPx={demoLayout.width}
      />,
    );

    const styles = [...container.querySelectorAll<HTMLElement>("[data-label]")];
    expect(
      styles.some(
        (node) =>
          node.style.left === `${child.x}px` &&
          node.style.top === `${child.y}px`,
      ),
    ).toBe(true);
  });

  it("wraps the tree in a turnable layer", () => {
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={layoutFrame}
        hidden={false}
        accent="#00ff00"
        fit={fitInto(
          { width: demoLayout.width, height: demoLayout.height },
          demoLayout.width,
          demoLayout.height,
        )}
        stageWidthPx={demoLayout.width}
      />,
    );

    const layout = container.firstElementChild?.firstElementChild;
    expect(layout?.firstElementChild?.className).toContain("transform-3d");
  });

  it("lifts nested nodes along z by their depth", () => {
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={layoutFrame}
        hidden={false}
        accent="#00ff00"
        fit={fitInto(
          { width: demoLayout.width, height: demoLayout.height },
          demoLayout.width,
          demoLayout.height,
        )}
        stageWidthPx={demoLayout.width}
      />,
    );

    const transforms = [
      ...container.querySelectorAll<HTMLElement>("[data-label]"),
    ].map((node) => node.style.transform);
    expect(
      transforms.every((transform) =>
        transform.includes("translateZ(calc(var(--msr-depth, 0)"),
      ),
    ).toBe(true);
    expect(new Set(transforms).size).toBeGreaterThan(1);
  });

  it("hides an attachment that is not the one on show", () => {
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={layoutFrame}
        hidden={true}
        accent="#00ff00"
        fit={fitInto(
          { width: demoLayout.width, height: demoLayout.height },
          demoLayout.width,
          demoLayout.height,
        )}
        stageWidthPx={demoLayout.width}
      />,
    );

    expect(container.firstElementChild?.hasAttribute("hidden")).toBe(true);
  });

  it("recolours an SVG wireframe with the accent", () => {
    const svgAttachment = {
      id: "wireframe",
      sourceSize: { width: 100, height: 200 },
      layerCount: null,
      content: {
        kind: "svg",
        markup: '<svg viewBox="0 0 100 200"><rect stroke="#fef08a"/></svg>',
      },
    } as Attachment;
    const { container } = render(
      <StageAttachment
        imageUrl="https://cdn/shot.webp"
        attachment={svgAttachment}
        hidden={false}
        accent="#00ff00"
        fit={fitInto({ width: 100, height: 200 }, 100, 200)}
        stageWidthPx={100}
      />,
    );

    const img = container.querySelector("img");
    expect(img?.getAttribute("src")).toContain(encodeURIComponent("#00ff00"));
    expect(img?.getAttribute("src")).not.toContain(
      encodeURIComponent("#fef08a"),
    );
  });
});

describe("projectedExtent", () => {
  const box = { width: 200, height: 400, depth: 0 };
  const perspective = 940;

  it("is the box itself when the tree is not turned", () => {
    const extent = projectedExtent(
      box,
      { xDegrees: 0, yDegrees: 0 },
      perspective,
    );
    expect(extent.width).toBeCloseTo(200);
    expect(extent.height).toBeCloseTo(400);
  });

  it("grows with the depth the layers are lifted to", () => {
    const flatStack = projectedExtent(
      box,
      { xDegrees: 0, yDegrees: 20 },
      perspective,
    );
    const liftedStack = projectedExtent(
      { ...box, depth: 120 },
      { xDegrees: 0, yDegrees: 20 },
      perspective,
    );
    expect(liftedStack.width).toBeGreaterThan(flatStack.width);
  });

  it("narrows a plane turned away from the viewer", () => {
    // No depth to lift, so turning only foreshortens.
    const extent = projectedExtent(
      box,
      { xDegrees: 0, yDegrees: 45 },
      perspective,
    );
    expect(extent.width).toBeLessThan(box.width);
  });
});

describe("formatOffset", () => {
  it.each([
    [0, "0:00.000"],
    [1234, "0:01.234"],
    [61_007, "1:01.007"],
  ])("formats %ims as %s", (ms, expected) => {
    expect(formatOffset(ms)).toBe(expected);
  });
});

describe("idle stretches", () => {
  const timeline = timelineWith([
    { event_type: "cold_launch", timestamp: at(0) },
    { event_type: "lifecycle_activity", timestamp: at(1) },
    { event_type: "gesture_click", timestamp: at(2) },
    { event_type: "http", timestamp: at(20) },
    { event_type: "lifecycle_app", timestamp: at(40) },
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
    // The events between the gesture and the error are network calls and
    // lifecycle transitions, none of which put anything new on the screen.
    const { slice } = sliceAt(3000);

    expect(slice.skipToOffsetMs).toBe(59_500);
  });

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

  it("runs to the end once no activity is left to watch", () => {
    const { replay, slice } = sliceAt(80_000);

    expect(slice.skipToOffsetMs).toBe(replay.durationMs);
  });

  it("stays put when the end is already in reach", () => {
    const { slice } = sliceAt(90_000);

    expect(slice.skipToOffsetMs).toBeNull();
  });
});

describe("tickOffsetMs", () => {
  it("advances by the time a frame took", () => {
    expect(tickOffsetMs(1000, 16, 1, 60_000)).toBe(1016);
  });

  it("advances by the playback speed on top of that", () => {
    expect(tickOffsetMs(1000, 16, 4, 60_000)).toBe(1064);
  });

  it("caps a frame that stood for a tab left in the background", () => {
    // Thirty seconds away from the tab, and the playhead moves on by the cap
    // rather than by the whole stretch.
    expect(tickOffsetMs(1000, 30_000, 1, 600_000)).toBe(1250);
    expect(tickOffsetMs(1000, 30_000, 4, 600_000)).toBe(2000);
  });

  it("stops at the end of the replay", () => {
    expect(tickOffsetMs(59_900, 200, 4, 60_000)).toBe(60_000);
  });
});

describe("formatSkipped", () => {
  it.each([
    [12_000, "12s"],
    [59_600, "1m 0s"],
    [331_000, "5m 31s"],
    [600_000, "10m 0s"],
  ])("says %ims as %s", (ms, expected) => {
    expect(formatSkipped(ms)).toBe(expected);
  });
});

describe("the machine", () => {
  const tenIdleSeconds = {
    threads: {
      main: [
        { event_type: "lifecycle_app", timestamp: "2026-04-10T10:00:00Z" },
        { event_type: "lifecycle_app", timestamp: "2026-04-10T10:00:10Z" },
      ],
    },
    traces: [],
  };

  const tiltableMachine = sessionReplayMachine.provide({
    guards: { isShownAttachmentTiltable: () => true },
  });

  async function readyMachine(session: unknown = tenIdleSeconds) {
    const actor = createActor(sessionReplayMachine).start();
    actor.send({ type: "replay.received", session });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    return actor;
  }

  it("is ready to play the moment the session arrives", async () => {
    const actor = createActor(sessionReplayMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });

    // The replay is built from the session in one pass, so playback is ready
    // while the attachments are still on their way.
    expect(actor.getSnapshot().matches({ ready: { playback: "paused" } })).toBe(
      true,
    );
    actor.send({ type: "user.seek", toOffsetMs: 3000 });
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(3000);
    actor.send({ type: "user.toggle" });
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    actor.stop();
  });

  const twoAttachments = timelineWith([
    {
      event_type: "gesture_click",
      timestamp: at(0),
      x: 1,
      y: 1,
      attachments: [
        attachment("layout_snapshot_json", "tree.json"),
        attachment("screenshot", "shot.webp"),
      ],
    },
  ]);

  it("calls for the attachment the session lists first", async () => {
    const actor = await readyMachine(twoAttachments);

    expect(shownAttachmentRefOf(actor.getSnapshot().context)?.id).toBe(
      "tree.json",
    );
    actor.stop();
  });

  it("calls for the attachment the switcher was pointed at", async () => {
    const actor = await readyMachine(twoAttachments);

    actor.send({ type: "user.selectAttachment", index: 1 });

    expect(shownAttachmentRefOf(actor.getSnapshot().context)?.id).toBe(
      "shot.webp",
    );
    actor.stop();
  });

  it("turns a layout tree and leaves a screenshot flat", async () => {
    const actor = await readyMachine(twoAttachments);
    const press = {
      type: "user.pointerDown" as const,
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    };

    // The stage plays the layout tree first, which has layers to turn.
    actor.send(press);
    expect(
      actor.getSnapshot().matches({ ready: { inspection: "dragging" } }),
    ).toBe(true);
    actor.send({ type: "user.pointerUp" });

    // The switcher moves to the screenshot of the same screen, which is flat.
    actor.send({ type: "user.selectAttachment", index: 1 });
    actor.send(press);
    expect(
      actor.getSnapshot().matches({ ready: { inspection: "dragging" } }),
    ).toBe(false);
    actor.stop();
  });

  it("starts a drag on a primary press and ends it when the slice changes", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    });
    expect(
      actor.getSnapshot().matches({ ready: { inspection: "dragging" } }),
    ).toBe(true);
    expect(actor.getSnapshot().context.dragOrigin).not.toBeNull();

    actor.send({ type: "slice.changed" });
    expect(actor.getSnapshot().matches({ ready: { inspection: "idle" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.dragOrigin).toBeNull();
    actor.stop();
  });

  it("ignores a press that is not the primary button", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 2,
      screenScale: 1,
    });
    expect(actor.getSnapshot().matches({ ready: { inspection: "idle" } })).toBe(
      true,
    );
    actor.stop();
  });

  it("ends a drag when a move reports every button released", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    });
    actor.send({
      type: "user.pointerMove",
      x: 20,
      y: 10,
      buttons: 0,
      hoverLabel: null,
    });
    expect(actor.getSnapshot().matches({ ready: { inspection: "idle" } })).toBe(
      true,
    );
    actor.stop();
  });

  it("turns the tilt pose with a drag, scaled by the press's screen scale", async () => {
    const actor = createActor(tiltableMachine).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });
    const resting = actor.getSnapshot().context.tilt;
    actor.send({
      type: "user.pointerDown",
      x: 10,
      y: 10,
      button: 0,
      screenScale: 1,
    });
    actor.send({
      type: "user.pointerMove",
      x: 20,
      y: 10,
      buttons: 1,
      hoverLabel: null,
    });
    expect(actor.getSnapshot().context.tilt).toEqual({
      xDegrees: resting.xDegrees,
      yDegrees: resting.yDegrees + 5,
    });
    actor.stop();
  });

  it("remembers which group the switcher's pick belongs to", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.selectAttachment", index: 2 });

    // This session lists no attachments, so the pick has no group to belong to.
    // It carries a null key, and the stage shows the first attachment of
    // whichever group it reaches.
    expect(actor.getSnapshot().context.attachmentSwitcher).toEqual({
      eventKey: null,
      shownIndex: 2,
    });
    actor.stop();
  });

  it("jumps an idle gap on a tick and reports the skipped stretch", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.toggleIdleSkip" });
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 1 });

    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(10000);
    expect(actor.getSnapshot().context.skippedIdleMs).toBe(9999);
    expect(actor.getSnapshot().matches({ ready: { notice: "visible" } })).toBe(
      true,
    );
    actor.stop();
  });

  it("plays on after skipping a gap in the middle of a session", async () => {
    // The target sits inside the slice that carries it, so the playhead lands
    // back on that same slice. Playback has to carry on from there rather than
    // taking the jump again on the next tick.
    const actor = await readyMachine({
      threads: {
        main: [
          {
            event_type: "gesture_click",
            thread_name: "main",
            x: 1,
            y: 1,
            timestamp: "2026-04-10T10:00:00Z",
          },
          {
            event_type: "gesture_click",
            thread_name: "main",
            x: 1,
            y: 1,
            timestamp: "2026-04-10T10:01:00Z",
          },
        ],
      },
      traces: [],
    });
    actor.send({ type: "user.toggleIdleSkip" });
    actor.send({ type: "user.seek", toOffsetMs: 1000 });
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 1016 });

    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(59_500);
    expect(actor.getSnapshot().context.skippedIdleMs).toBe(58_484);

    actor.send({ type: "clock.tick", clockOffsetMs: 59_516 });
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(59_516);
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    actor.stop();
  });

  it("rewinds when play is pressed after seeking to the end", async () => {
    const actor = await readyMachine();
    const durationMs = actor.getSnapshot().context.replay!.durationMs;
    actor.send({ type: "user.seek", toOffsetMs: durationMs });
    actor.send({ type: "user.toggle" });

    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(0);
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    actor.stop();
  });

  it("ends the run when a tick reaches the duration, and plays again from the start", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 99999 });
    expect(actor.getSnapshot().matches({ ready: { playback: "ended" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(10000);

    actor.send({ type: "user.toggle" });
    expect(
      actor.getSnapshot().matches({ ready: { playback: "playing" } }),
    ).toBe(true);
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(0);
    actor.stop();
  });

  it("ignores a clock tick while paused", async () => {
    const actor = await readyMachine();
    actor.send({ type: "user.seek", toOffsetMs: 4000 });
    actor.send({ type: "clock.tick", clockOffsetMs: 99999 });
    expect(actor.getSnapshot().matches({ ready: { playback: "paused" } })).toBe(
      true,
    );
    expect(actor.getSnapshot().context.playheadOffsetMs).toBe(4000);
    actor.stop();
  });

  it("shows the skip notice and hides it after the delay", async () => {
    const quickNotice = sessionReplayMachine.provide({
      delays: { noticeDelay: 20 },
    });
    const actor = createActor(quickNotice).start();
    actor.send({ type: "replay.received", session: tenIdleSeconds });
    await machineWaitFor(actor, (s) => s.matches("ready"), { timeout: 2000 });

    actor.send({ type: "user.toggleIdleSkip" });
    actor.send({ type: "user.toggle" });
    actor.send({ type: "clock.tick", clockOffsetMs: 1 });
    expect(actor.getSnapshot().matches({ ready: { notice: "visible" } })).toBe(
      true,
    );

    await machineWaitFor(
      actor,
      (s) => s.matches({ ready: { notice: "hidden" } }),
      { timeout: 2000 },
    );
    expect(actor.getSnapshot().context.skippedIdleMs).toBeNull();
    actor.stop();
  });
});

describe("the player", () => {
  // Attachments are cached under the session's id, and every fixture session
  // carries the same one, so each test gets a store of its own.
  let queries = new QueryClient();
  beforeEach(() => {
    queries = new QueryClient();
  });
  const withQueries = (ui: ReactElement) => (
    <QueryClientProvider client={queries}>{ui}</QueryClientProvider>
  );

  const renderReplay = (overrides: Record<string, any> = {}) =>
    render(
      withQueries(
        <SessionReplay
          teamId="test-team"
          appId="app-1"
          session={makeSessionReplayFixture(overrides)}
        />,
      ),
    );

  // Two events five seconds apart, for tests that move the playhead.
  const fiveSecondSession = {
    threads: {
      main: [
        {
          event_type: "lifecycle_activity",
          thread_name: "main",
          type: "created",
          class_name: "sh.measure.demo.MainActivity",
          timestamp: "2026-04-10T10:00:00Z",
        },
        {
          event_type: "lifecycle_app",
          thread_name: "main",
          type: "background",
          timestamp: "2026-04-10T10:00:05Z",
        },
      ],
    },
    traces: [],
  };

  describe("event list", () => {
    it("lists the session's events, each read out by its own rules", async () => {
      renderReplay();

      await waitFor(() => {
        // A lifecycle event is titled from its type and class name, a trace
        // from its name alone.
        expect(screen.getByText(/Created: MainActivity/)).toBeTruthy();
        expect(screen.getByText(/activity\.onCreate/)).toBeTruthy();
      });
    });

    it("titles logs and network calls from their content", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "string",
              thread_name: "main",
              severity_text: "debug",
              string: "Rendered product grid",
              timestamp: "2026-04-10T10:00:00Z",
            },
            {
              event_type: "http",
              thread_name: "main",
              method: "get",
              status_code: 200,
              url: "https://api.example.com/v1/products",
              timestamp: "2026-04-10T10:00:01Z",
            },
          ],
        },
        traces: [],
      });

      await waitFor(() => {
        // A log's pill carries its severity; the row text is the message.
        expect(screen.getByText("Log: Debug")).toBeTruthy();
        expect(screen.getByText("Rendered product grid")).toBeTruthy();
        expect(
          screen.getByText("GET 200 https://api.example.com/v1/products"),
        ).toBeTruthy();
      });
    });

    it("keeps events that collide on type, thread and timestamp apart", async () => {
      // Two view controller callbacks fired on the same thread in the same
      // millisecond, so (event type, thread, timestamp) is not a unique
      // identity; rows keyed on it alone share a React key and trigger the
      // "Encountered two children with the same key" warning. The file-level
      // spy is read directly rather than replaced, because restoring a spy of
      // this test's own would put the real console.error back and let every
      // test after this one print again.
      const consoleError = console.error as jest.Mock<void, unknown[]>;

      renderReplay({
        threads: {
          "com.apple.main-thread": [
            {
              event_type: "lifecycle_view_controller",
              thread_name: "com.apple.main-thread",
              class_name: "HomeViewController",
              type: "viewWillAppear",
              timestamp: "2026-05-26T10:18:42.322Z",
            },
            {
              event_type: "lifecycle_view_controller",
              thread_name: "com.apple.main-thread",
              class_name: "HomeViewController",
              type: "viewDidAppear",
              timestamp: "2026-05-26T10:18:42.322Z",
            },
          ],
        },
        traces: [],
      });

      // Both colliding events have to render, or the case that triggers the
      // warning is not exercised.
      await waitFor(() => {
        expect(
          screen.getByText("HomeViewController: viewWillAppear"),
        ).toBeTruthy();
        expect(
          screen.getByText("HomeViewController: viewDidAppear"),
        ).toBeTruthy();
      });

      const duplicateKeyWarning = consoleError.mock.calls.find((call) =>
        call.some(
          (arg) =>
            typeof arg === "string" &&
            arg.includes("two children with the same key"),
        ),
      );
      expect(duplicateKeyWarning).toBeUndefined();
    });
  });

  describe("event details", () => {
    it("opens an event's details when its row is clicked", async () => {
      renderReplay();

      const traceRow = (await screen.findByText(/activity\.onCreate/)).closest(
        "button",
      );
      await act(async () => {
        fireEvent.click(traceRow!);
      });

      await waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(text).toContain("trace_id");
        expect(text).toContain("trace-001");
      });
    });

    it("opens one event at a time, so a second click moves the details", async () => {
      renderReplay();

      const lifecycleRow = (
        await screen.findByText(/Created: MainActivity/)
      ).closest("button");
      await act(async () => {
        fireEvent.click(lifecycleRow!);
      });
      await waitFor(() => {
        expect(document.body.textContent).toContain("event_type");
      });

      const traceRow = (await screen.findByText(/activity\.onCreate/)).closest(
        "button",
      );
      await act(async () => {
        fireEvent.click(traceRow!);
      });

      await waitFor(() => {
        const text = document.body.textContent ?? "";
        expect(text).toContain("trace_id");
        // A trace carries no event_type row, so its absence is the lifecycle
        // event's details having closed.
        expect(text).not.toContain("event_type");
      });
    });

    it("shows a crash's stacktrace and links to its error group", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "error",
              thread_name: "main",
              severity: "fatal",
              group_id: "group-9",
              type: "java.lang.IllegalStateException",
              message: "Payment method must be specified",
              file_name: "CheckoutActivity.kt",
              stacktrace:
                "java.lang.IllegalStateException: Payment method must be specified\n\tat MaterialButton.onClick(CheckoutActivity.kt:102)",
              timestamp: "2026-04-10T10:00:00Z",
            },
          ],
        },
        traces: [],
      });

      const row = (
        await screen.findByText(/IllegalStateException: Payment method/)
      ).closest("button");
      await act(async () => {
        fireEvent.click(row!);
      });

      await waitFor(() => {
        expect(screen.getByText(/at MaterialButton\.onClick/)).toBeTruthy();
      });
      const link = screen.getByText("View Error Details").closest("a");
      expect(link?.getAttribute("href")).toBe(
        "/test-team/errors/app-1/group-9/java.lang.IllegalStateException%40CheckoutActivity.kt",
      );
    });
  });

  describe("controls", () => {
    it("plays and pauses from one control", async () => {
      renderReplay();

      const play = await screen.findByLabelText("Play");
      await act(async () => {
        fireEvent.click(play);
      });
      expect(screen.getByLabelText("Pause")).toBeTruthy();

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Pause"));
      });
      expect(screen.getByLabelText("Play")).toBeTruthy();
    });

    it("moves the playhead from the keyboard", async () => {
      renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });

      expect(slider.getAttribute("aria-valuenow")).toBe("1000");
      expect(screen.getByText(/^0:01\.000 \//)).toBeTruthy();
    });

    it("marks a chosen playback speed as pressed", async () => {
      renderReplay(fiveSecondSession);

      const twoX = await screen.findByRole("button", { name: "2x" });
      await act(async () => {
        fireEvent.click(twoX);
      });

      expect(twoX.getAttribute("aria-pressed")).toBe("true");
    });

    it("does not seek on a right or middle click on the scrubber", async () => {
      renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.pointerDown(slider, { button: 2, clientX: 50 });
        fireEvent.pointerDown(slider, { button: 1, clientX: 50 });
      });

      expect(slider.getAttribute("aria-valuenow")).toBe("0");
    });

    it("restores a paused playhead when a session refetch remounts the player", async () => {
      const view = renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });
      expect(slider.getAttribute("aria-valuenow")).toBe("1000");

      await act(async () => {
        view.rerender(
          withQueries(
            <SessionReplay
              teamId="test-team"
              appId="app-1"
              session={makeSessionReplayFixture(fiveSecondSession)}
            />,
          ),
        );
      });

      await waitFor(
        () => {
          const after = screen.getByRole("slider", { name: "Playhead" });
          expect(after.getAttribute("aria-valuenow")).toBe("1000");
        },
        { timeout: 3000 },
      );
      expect(screen.getByLabelText("Play")).toBeTruthy();
    });

    it("keeps playing from the same position when the player remounts", async () => {
      const view = renderReplay(fiveSecondSession);

      const play = await screen.findByLabelText("Play");
      await act(async () => {
        fireEvent.click(play);
      });
      const slider = screen.getByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });

      await act(async () => {
        view.rerender(
          withQueries(
            <SessionReplay
              teamId="test-team"
              appId="app-1"
              session={makeSessionReplayFixture(fiveSecondSession)}
            />,
          ),
        );
      });

      await waitFor(
        () => {
          expect(screen.getByLabelText("Pause")).toBeTruthy();
          const after = screen.getByRole("slider", { name: "Playhead" });
          expect(
            Number(after.getAttribute("aria-valuenow")),
          ).toBeGreaterThanOrEqual(1000);
        },
        { timeout: 3000 },
      );
    });

    it("skips the idle session to its end, and again after a restart", async () => {
      renderReplay({
        threads: {
          main: [
            {
              event_type: "lifecycle_activity",
              thread_name: "main",
              type: "created",
              class_name: "sh.measure.demo.MainActivity",
              timestamp: "2026-04-10T10:00:00Z",
            },
            {
              event_type: "lifecycle_app",
              thread_name: "main",
              type: "background",
              timestamp: "2026-04-10T10:00:10Z",
            },
          ],
        },
        traces: [],
      });

      const skip = await screen.findByRole("switch", { name: "Skip idle" });
      await act(async () => {
        fireEvent.click(skip);
      });
      await act(async () => {
        fireEvent.click(screen.getByLabelText("Play"));
      });
      await waitFor(
        () => {
          expect(screen.getByLabelText("Play")).toBeTruthy();
        },
        { timeout: 3000 },
      );
      const slider = screen.getByRole("slider", { name: "Playhead" });
      expect(slider.getAttribute("aria-valuenow")).toBe("10000");

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Play"));
      });
      await waitFor(
        () => {
          expect(screen.getByLabelText("Play")).toBeTruthy();
        },
        { timeout: 3000 },
      );
      expect(slider.getAttribute("aria-valuenow")).toBe("10000");
    });

    it("returns the playhead to the start on restart", async () => {
      renderReplay(fiveSecondSession);

      const slider = await screen.findByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "ArrowRight" });
      });
      expect(slider.getAttribute("aria-valuenow")).toBe("1000");

      await act(async () => {
        fireEvent.click(screen.getByLabelText("Restart"));
      });
      expect(slider.getAttribute("aria-valuenow")).toBe("0");
      expect(screen.getByText(/^0:00\.000 \//)).toBeTruthy();
    });

    it("plays at normal speed until another is chosen", async () => {
      renderReplay();

      const normal = await screen.findByRole("button", { name: "1x" });
      const double = screen.getByRole("button", { name: "2x" });
      expect(normal.getAttribute("aria-pressed")).toBe("true");
      expect(double.getAttribute("aria-pressed")).toBe("false");

      await act(async () => {
        fireEvent.click(double);
      });
      expect(double.getAttribute("aria-pressed")).toBe("true");
      expect(normal.getAttribute("aria-pressed")).toBe("false");
    });

    it("plays idle stretches unless asked to skip them", async () => {
      renderReplay();

      const skip = await screen.findByRole("switch", { name: "Skip idle" });
      expect(skip.getAttribute("aria-checked")).toBe("false");

      await act(async () => {
        fireEvent.click(skip);
      });
      expect(skip.getAttribute("aria-checked")).toBe("true");
    });

    it("draws a lane for each metric series the session carries", async () => {
      renderReplay();

      await waitFor(() => {
        expect(screen.getByRole("img", { name: "CPU usage" })).toBeTruthy();
        expect(
          screen.getAllByRole("img", { name: "Memory usage" }).length,
        ).toBeGreaterThan(0);
      });
    });

    it("draws none when the session carries no samples", async () => {
      renderReplay({
        cpu_usage: [],
        memory_usage: [],
        memory_usage_absolute: [],
      });

      await screen.findByLabelText("Restart");
      expect(screen.queryByRole("img", { name: "CPU usage" })).toBeNull();
    });
  });

  // jsdom has no network, so the stub decides which attachment locations
  // load.
  const stubFetch = () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async (url: unknown) => {
      if (String(url).includes("good")) {
        return { ok: true, json: async () => ({ width: 200, height: 400 }) };
      }
      throw new Error("network");
    });
    return () => {
      (globalThis as any).fetch = original;
    };
  };

  // One tap carrying whichever attachments a test needs. The stub above decides
  // which locations can be fetched, so tests that care pass their own.
  const tapWith = (
    attachments: { type: string; name: string; location?: string }[],
  ) => ({
    threads: {
      main: [
        {
          event_type: "gesture_click",
          thread_name: "main",
          target: "android.widget.Button",
          x: 10,
          y: 10,
          timestamp: "2026-04-10T10:00:00Z",
          attachments: attachments.map((attachment, index) => ({
            id: `a${index}`,
            key: `k${index}`,
            location: `https://cdn/a${index}`,
            ...attachment,
          })),
        },
      ],
    },
    traces: [],
  });

  const tapWithAttachments = (locations: string[]) =>
    tapWith(
      locations.map((location) => ({
        type: "layout_snapshot_json",
        name: "snapshot.json",
        location,
      })),
    );

  it("offers the event list while the first screen is still downloading", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/slow.json"]));
      expect(await screen.findByLabelText("Play")).toBeTruthy();
      expect(
        screen.getByTestId("session-replay-events").children.length,
      ).toBeGreaterThan(0);
    } finally {
      global.fetch = originalFetch;
    }
  });

  it('shows "No captures in this session" on the stage when the session captured none', async () => {
    renderReplay(fiveSecondSession);

    expect(await screen.findByText("No captures in this session")).toBeTruthy();
  });

  it("holds the empty-session message back until the replay is built", () => {
    // The session reaches the machine in an effect, so the first paint has no
    // replay to count attachments from and must say nothing either way.
    const { container } = renderReplay(
      tapWith([{ type: "layout_snapshot_json", name: "a.json" }]),
    );

    expect(container.textContent).not.toContain("No captures in this session");
  });

  const loadingMessage = "Captures loading...";
  const failedMessage =
    "Error loading captures here. Refresh page to try again.";

  it('shows "Captures loading..." on the stage while an attachment is being fetched', async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/slow.json"]));

      expect(await screen.findByText(loadingMessage)).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows nothing on the stage before the session's first attachment", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      // The replay opens on the lifecycle event, which carries no attachment and
      // has no earlier one to fall back on, so the stage stays blank until the
      // tap five seconds later. Nothing is being fetched for that position and
      // the viewer is told nothing, rather than being told to wait for a
      // attachment that this moment of the session never had.
      renderReplay({
        threads: {
          main: [
            {
              event_type: "lifecycle_activity",
              thread_name: "main",
              type: "created",
              class_name: "sh.measure.demo.MainActivity",
              timestamp: "2026-04-10T10:00:00Z",
            },
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:05Z",
              attachments: [
                {
                  id: "a0",
                  name: "snapshot.json",
                  type: "layout_snapshot_json",
                  key: "k0",
                  location: "https://cdn/slow.json",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      await screen.findByLabelText("Play");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(screen.queryByText(loadingMessage)).toBeNull();
      expect(screen.queryByText(failedMessage)).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows nothing on the stage at any point when an attachment is fetched quickly", async () => {
    const original = (globalThis as any).fetch;
    // Faster than the 200ms the stage waits, so no message is due, but slow
    // enough that a stage showing one immediately would be caught at it.
    (globalThis as any).fetch = jest.fn(
      () =>
        new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                json: async () => ({ width: 200, height: 400 }),
              }),
            50,
          ),
        ),
    );
    const restoreFetch = () => {
      (globalThis as any).fetch = original;
    };
    // Checking the page once the attachment has been drawn would pass even for a
    // message that appeared and disappeared along the way, so every change to
    // the page is watched instead.
    let everShown = false;
    const observer = new MutationObserver(() => {
      everShown ||=
        document.body.textContent?.includes(loadingMessage) === true;
    });
    try {
      const { container } = renderReplay(
        tapWithAttachments(["https://cdn/quick.json"]),
      );
      observer.observe(container, {
        childList: true,
        subtree: true,
        characterData: true,
      });

      await screen.findByTestId("session-replay-touch-ring");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(everShown).toBe(false);
      expect(screen.queryByText(loadingMessage)).toBeNull();
    } finally {
      observer.disconnect();
      restoreFetch();
    }
  });

  it("shows error message on the stage when an attachment cannot be fetched", async () => {
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapWithAttachments(["https://cdn/bad.json"]));

      // A failed fetch is retried once, and the query waits about a second
      // before the retry, which is longer than the one second a findBy allows
      // by default.
      expect(
        await screen.findByText(failedMessage, {}, { timeout: 5000 }),
      ).toBeTruthy();
      expect(screen.queryByText(loadingMessage)).toBeNull();
    } finally {
      restoreFetch();
    }
  });

  it("shows nothing on the stage when the fetch for an attachment is cancelled", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => {
      const aborted = new Error("aborted");
      aborted.name = "AbortError";
      throw aborted;
    });
    try {
      // A fetch is aborted when the viewer leaves the replay and when the
      // window of attachments being held moves past this one, and neither means
      // the attachment could not be fetched.
      renderReplay(tapWithAttachments(["https://cdn/gone.json"]));

      await screen.findByLabelText("Play");
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 400));
      });
      expect(screen.queryByText(failedMessage)).toBeNull();
      expect(screen.queryByText(loadingMessage)).toBeNull();
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it('shows "Error loading captures" on the stage when a fetched screenshot fails to draw', async () => {
    const originalFetch = (globalThis as any).fetch;
    const originalImage = (globalThis as any).Image;
    (globalThis as any).fetch = jest.fn(async () => {
      throw new Error("a screenshot is fetched by the img that draws it");
    });
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      // Only the screenshot's size is fetched and kept; the image itself is
      // drawn from its URL every time. The fetch can therefore succeed and the
      // drawing still fail, which is what the error event below stands for.
      const { container } = renderReplay({
        threads: {
          main: [
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [
                {
                  id: "a0",
                  name: "shot.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/shot.webp",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      const image = await waitFor(() => {
        const found = container.querySelector(
          'img[src="https://cdn/shot.webp"]',
        );
        expect(found).toBeTruthy();
        return found!;
      });
      expect(screen.queryByText(failedMessage)).toBeNull();

      await act(async () => {
        fireEvent.error(image);
      });
      expect(screen.getByText(failedMessage)).toBeTruthy();
    } finally {
      (globalThis as any).fetch = originalFetch;
      (globalThis as any).Image = originalImage;
    }
  });

  it('keeps "Error loading captures" up when a hidden screenshot fails after the shown one', async () => {
    const originalFetch = (globalThis as any).fetch;
    const originalImage = (globalThis as any).Image;
    (globalThis as any).fetch = jest.fn(async () => {
      throw new Error("a screenshot is fetched by the img that draws it");
    });
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      // Both screenshots belong to the one tap, so the switcher keeps the
      // second mounted and hidden. Presigned URLs expire together, so the
      // hidden one usually fails right behind the shown one.
      const { container } = renderReplay({
        threads: {
          main: [
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [
                {
                  id: "a0",
                  name: "shown.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/shown.webp",
                },
                {
                  id: "a1",
                  name: "hidden.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/hidden.webp",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      const shown = await waitFor(() => {
        const found = container.querySelector(
          'img[src="https://cdn/shown.webp"]',
        );
        expect(found).toBeTruthy();
        return found!;
      });
      const hidden = container.querySelector(
        'img[src="https://cdn/hidden.webp"]',
      )!;
      expect(hidden).toBeTruthy();

      await act(async () => {
        fireEvent.error(shown);
      });
      expect(screen.getByText(failedMessage)).toBeTruthy();

      // The hidden one failing says nothing about what the viewer is looking
      // at, and must not take the message away from the shown one.
      await act(async () => {
        fireEvent.error(hidden);
      });
      expect(screen.getByText(failedMessage)).toBeTruthy();
    } finally {
      (globalThis as any).fetch = originalFetch;
      (globalThis as any).Image = originalImage;
    }
  });

  it("asks for an attachment that failed once, however far the playhead travels", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const original = (globalThis as any).fetch;
    const fetched = jest.fn(async () => ({ ok: false, status: 403 }));
    (globalThis as any).fetch = fetched;
    try {
      // Thirty attachments a second apart, so seeking to the end carries the
      // playhead past a stride and the window is worked out again.
      renderReplay({
        threads: {
          main: Array.from({ length: 30 }, (_, index) => ({
            event_type: "gesture_click",
            thread_name: "main",
            target: "android.widget.Button",
            x: 10,
            y: 10,
            timestamp: new Date(
              Date.parse("2026-04-10T10:00:00Z") + index * 1000,
            ).toISOString(),
            attachments: [
              {
                id: `a${index}`,
                name: "snapshot.json",
                type: "layout_snapshot_json",
                key: `k${index}`,
                location: `https://cdn/a${index}.json`,
              },
            ],
          })),
        },
        traces: [],
      });

      await waitFor(() => expect(reportedAttachmentIds()).toHaveLength(30), {
        timeout: 12_000,
      });
      const askedOnce = fetched.mock.calls.length;

      const slider = screen.getByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "End" });
      });
      await act(async () => {
        await new Promise((resolve) => setTimeout(resolve, 2000));
      });

      // An attachment that failed holds no data, which counts as stale however long
      // it is kept fresh for, so the window would fetch and report all thirty
      // afresh on this pass. The one the playhead lands on is drawn again and
      // gets one more attempt, which is the only traffic this pass allows.
      expect(reportedAttachmentIds().filter((id) => id === "a0")).toEqual([
        "a0",
      ]);
      expect(fetched.mock.calls.length - askedOnce).toBeLessThanOrEqual(
        attemptsPerAttachment,
      );
    } finally {
      (globalThis as any).fetch = original;
    }
  }, 20_000);

  it("holds the touch ring back until there is a screen to place it on", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(() => new Promise(() => {})) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/slow.json"]));

      // The playhead opens on the tap, so the slice carries the touch. The
      // gesture's coordinates are read against the screen it was made on, and
      // until that screen arrives there is nothing to place the ring against.
      await screen.findByLabelText("Play");
      expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows the touch ring once the screen the gesture was made on arrives", async () => {
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapWithAttachments(["https://cdn/good.json"]));

      expect(
        await screen.findByTestId("session-replay-touch-ring"),
      ).toBeTruthy();
    } finally {
      restoreFetch();
    }
  });

  it("waits for the attachment it calls for while another of the same screen arrives", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn((url: unknown) =>
      String(url).includes("good")
        ? Promise.resolve({
            ok: true,
            json: async () => ({ width: 200, height: 400 }),
          })
        : new Promise(() => {}),
    );
    try {
      // Both attachments belong to the tap the playhead opens on, and the stage
      // plays the first. The second arriving is no reason to draw it, so the
      // ring has nothing to place itself against.
      renderReplay(
        tapWithAttachments(["https://cdn/slow.json", "https://cdn/good.json"]),
      );

      await screen.findByLabelText("Play");
      expect(screen.queryByTestId("session-replay-touch-ring")).toBeNull();
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  // Six hundred taps a second apart, each carrying a screen.
  const sixHundredAttachments = {
    threads: {
      main: Array.from({ length: 600 }, (_, index) => ({
        event_type: "gesture_click",
        thread_name: "main",
        target: "android.widget.Button",
        x: 10,
        y: 10,
        timestamp: new Date(
          Date.parse("2026-04-10T10:00:00Z") + index * 1000,
        ).toISOString(),
        attachments: [
          {
            id: `a${index}`,
            name: "snapshot.json",
            type: "layout_snapshot_json",
            key: `k${index}`,
            location: `https://cdn/a${index}.json`,
          },
        ],
      })),
    },
    traces: [],
  };

  // One try and one retry, as attachmentFetchRetries has it.
  const attemptsPerAttachment = 2;

  const reportedAttachmentIds = (): string[] =>
    (posthog.captureException as jest.Mock).mock.calls.map(
      (call) => call[1].attachment_id,
    );

  const cachedAttachmentIds = (client: QueryClient) =>
    client
      .getQueryCache()
      .getAll()
      .filter((query) => query.state.data !== undefined)
      .map((query) => query.queryKey[2]);

  it("fetches the attachments around the playhead and leaves the rest alone", async () => {
    const original = (globalThis as any).fetch;
    const fetched = jest.fn(async () => ({
      ok: true,
      json: async () => ({ width: 200, height: 400 }),
    }));
    (globalThis as any).fetch = fetched;
    try {
      // The playhead opens on the first attachment, so the window reaches ahead
      // of it and no further.
      renderReplay(sixHundredAttachments);

      await screen.findByTestId("session-replay-touch-ring");
      await waitFor(() =>
        expect(queries.getQueryCache().getAll().length).toBeGreaterThan(100),
      );
      expect(fetched.mock.calls.length).toBeLessThanOrEqual(226);
      expect(queries.getQueryCache().getAll().length).toBeLessThanOrEqual(501);
      expect(cachedAttachmentIds(queries)).toContain("a0");
      expect(cachedAttachmentIds(queries)).not.toContain("a599");
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("drops the attachments it holds when the viewer leaves the replay", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ width: 200, height: 400 }),
    }));
    try {
      const { unmount } = renderReplay(
        tapWithAttachments(["https://cdn/good.json"]),
      );
      await screen.findByTestId("session-replay-touch-ring");
      expect(cachedAttachmentIds(queries)).toContain("a0");

      unmount();

      expect(
        queries
          .getQueryCache()
          .getAll()
          .filter((query) => query.queryKey[0] === "session-attachment"),
      ).toHaveLength(0);
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("moves the window to where the playhead lands, dropping what it left", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({ width: 200, height: 400 }),
    }));
    try {
      renderReplay(sixHundredAttachments);
      await screen.findByTestId("session-replay-touch-ring");
      await waitFor(() =>
        expect(cachedAttachmentIds(queries)).toContain("a100"),
      );

      const slider = screen.getByRole("slider", { name: "Playhead" });
      await act(async () => {
        fireEvent.keyDown(slider, { key: "End" });
      });

      // The attachments around the end are pulled in and the ones the window
      // left behind are dropped, so the store stays the same size.
      await waitFor(
        () => expect(cachedAttachmentIds(queries)).toContain("a599"),
        {
          timeout: 3000,
        },
      );
      expect(cachedAttachmentIds(queries)).not.toContain("a0");
      expect(queries.getQueryCache().getAll().length).toBeLessThanOrEqual(501);
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("draws a screenshot from the URL the session gave, holding only its size", async () => {
    const originalFetch = (globalThis as any).fetch;
    const originalImage = (globalThis as any).Image;
    const fetched = jest.fn(async () => {
      throw new Error("a screenshot is fetched by the img that draws it");
    });
    (globalThis as any).fetch = fetched;
    // jsdom loads no images, so this stands in for one that decodes at a
    // known size.
    (globalThis as any).Image = class {
      naturalWidth = 200;
      naturalHeight = 400;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      const { container } = renderReplay({
        threads: {
          main: [
            {
              event_type: "gesture_click",
              thread_name: "main",
              target: "android.widget.Button",
              x: 10,
              y: 10,
              timestamp: "2026-04-10T10:00:00Z",
              attachments: [
                {
                  id: "a0",
                  name: "shot.webp",
                  type: "screenshot",
                  key: "k0",
                  location: "https://cdn/shot.webp",
                },
              ],
            },
          ],
        },
        traces: [],
      });

      await screen.findByTestId("session-replay-touch-ring");
      expect(
        container.querySelector('img[src="https://cdn/shot.webp"]'),
      ).toBeTruthy();
      expect(fetched).not.toHaveBeenCalled();
      expect(
        (queries.getQueryData(["session-attachment", "sess-001", "a0"]) as any)
          .content,
      ).toEqual({ kind: "image" });
    } finally {
      (globalThis as any).fetch = originalFetch;
      (globalThis as any).Image = originalImage;
    }
  });

  it("draws a wireframe, recoloured, from the markup the session points at", async () => {
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: true,
      text: async () =>
        '<svg viewBox="0 0 300 600"><rect stroke="#fef08a"/></svg>',
    }));
    try {
      const { container } = renderReplay(
        tapWith([{ type: "layout_snapshot", name: "snapshot.svg" }]),
      );

      const drawn = await waitFor(() => {
        const img = container.querySelector<HTMLImageElement>(
          'img[src^="data:image/svg"]',
        );
        expect(img).toBeTruthy();
        return img!;
      });
      const markup = decodeURIComponent(drawn.src.split(",")[1]);
      expect(markup).toContain('viewBox="0 0 300 600"');
      expect(markup).not.toContain("#fef08a");
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it.each([
    [
      "a signature the store has stopped accepting",
      { ok: false, status: 403 },
      { type: "layout_snapshot_json", name: "snapshot.json" },
    ],
    [
      "a layout snapshot that is not a tree",
      { ok: true, json: async () => ({ nope: true }) },
      { type: "layout_snapshot_json", name: "snapshot.json" },
    ],
    [
      "a wireframe with no viewBox to size it by",
      { ok: true, text: async () => "<svg><rect/></svg>" },
      { type: "layout_snapshot", name: "snapshot.svg" },
    ],
  ])("leaves the stage empty for %s", async (_case, response, attachment) => {
    (posthog.captureException as jest.Mock).mockClear();
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => response);
    try {
      const { container } = renderReplay(tapWith([attachment]));

      await waitFor(
        () =>
          expect(posthog.captureException).toHaveBeenCalledWith(
            new Error("session replay failed to load an attachment"),
            expect.objectContaining({ attachment_id: "a0" }),
          ),
        { timeout: 3000 },
      );
      expect(container.querySelector("img")).toBeNull();
      // The session did list a screen, so the empty-session message stays away
      // even though the download failed.
      expect(screen.queryByText("No captures in this session")).toBeNull();
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it.each([
    ["did not load", "onerror"],
    ["decoded to nothing", "onload"],
  ])(
    "leaves the stage empty for a screenshot that %s",
    async (_case, event) => {
      (posthog.captureException as jest.Mock).mockClear();
      const originalImage = (globalThis as any).Image;
      (globalThis as any).Image = class {
        naturalWidth = 0;
        naturalHeight = 0;
        onload: (() => void) | null = null;
        onerror: (() => void) | null = null;
        set src(_url: string) {
          setTimeout(() => (this as any)[event]?.(), 0);
        }
      };
      try {
        renderReplay(tapWith([{ type: "screenshot", name: "shot.webp" }]));

        await waitFor(
          () =>
            expect(posthog.captureException).toHaveBeenCalledWith(
              new Error("session replay failed to load an attachment"),
              { attachment_id: "a0", attachment_format: "raster" },
            ),
          { timeout: 3000 },
        );
      } finally {
        (globalThis as any).Image = originalImage;
      }
    },
  );

  it("records a screenshot the browser could not draw", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const originalImage = (globalThis as any).Image;
    (globalThis as any).Image = class {
      naturalWidth = 720;
      naturalHeight = 1280;
      onload: (() => void) | null = null;
      onerror: (() => void) | null = null;
      set src(_url: string) {
        setTimeout(() => this.onload?.(), 0);
      }
    };
    try {
      const { container } = renderReplay(
        tapWith([{ type: "screenshot", name: "shot.webp" }]),
      );

      // The screenshot measured, so its query holds the size and the stage
      // draws it. The browser then fails to fetch the pixels for the img.
      const img = await waitFor(() => {
        const drawn = container.querySelector("img");
        expect(drawn).toBeTruthy();
        return drawn!;
      });
      fireEvent.error(img);

      expect(posthog.captureException).toHaveBeenCalledWith(
        new Error("session replay failed to load an attachment"),
        { attachment_id: "a0", attachment_format: "raster" },
      );
    } finally {
      (globalThis as any).Image = originalImage;
    }
  });

  it("records an attachment once, though the window and the stage both want it", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const original = (globalThis as any).fetch;
    (globalThis as any).fetch = jest.fn(async () => ({
      ok: false,
      status: 500,
    }));
    try {
      // The playhead opens on this attachment, so the window prefetches it and
      // the stage subscribes to the same query.
      renderReplay(tapWith([{ type: "layout_snapshot_json", name: "a.json" }]));

      await waitFor(() => expect(posthog.captureException).toHaveBeenCalled(), {
        timeout: 3000,
      });
      expect(posthog.captureException).toHaveBeenCalledTimes(1);
      expect(posthog.captureException).toHaveBeenCalledWith(
        new Error("session replay failed to load an attachment"),
        { attachment_id: "a0", attachment_format: "layout" },
      );
    } finally {
      (globalThis as any).fetch = original;
    }
  });

  it("plays on through a partial attachment failure and records it", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const restoreFetch = stubFetch();
    try {
      renderReplay(
        tapWithAttachments(["https://cdn/good.json", "https://cdn/bad.json"]),
      );

      await screen.findByLabelText("Restart");
      // The screen that did arrive plays, and the one that did not is reported.
      expect(screen.queryByText("No captures in this session")).toBeNull();
      // The failure is reported once the attachment's one retry is spent.
      await waitFor(
        () =>
          expect(posthog.captureException).toHaveBeenCalledWith(
            new Error("session replay failed to load an attachment"),
            { attachment_id: "a1", attachment_format: "layout" },
          ),
        { timeout: 3000 },
      );
      expect(posthog.captureException).toHaveBeenCalledTimes(1);
    } finally {
      restoreFetch();
    }
  });

  it("plays the session through when no attachment can be fetched", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const restoreFetch = stubFetch();
    try {
      renderReplay(tapWithAttachments(["https://cdn/bad.json"]));

      // Playback still reaches the end, and the attachment the session listed
      // is reported as a failure rather than passed off as a session that had
      // no attachments at all.
      await screen.findByLabelText("Restart");
      expect(screen.queryByText("No captures in this session")).toBeNull();
      await waitFor(
        () =>
          expect(posthog.captureException).toHaveBeenCalledWith(
            new Error("session replay failed to load an attachment"),
            { attachment_id: "a0", attachment_format: "layout" },
          ),
        { timeout: 3000 },
      );
    } finally {
      restoreFetch();
    }
  });

  it("does not record a failure when a load is cancelled by leaving the page", async () => {
    (posthog.captureException as jest.Mock).mockClear();
    const originalFetch = global.fetch;
    global.fetch = jest.fn(
      (_url: string, options: { signal?: AbortSignal }) =>
        new Promise((_, reject) => {
          options.signal?.addEventListener("abort", () =>
            reject(new DOMException("Aborted", "AbortError")),
          );
        }),
    ) as any;
    try {
      const { unmount } = renderReplay(
        tapWithAttachments(["https://cdn/slow.json"]),
      );
      await screen.findByLabelText("Play");
      unmount();
      await act(async () => {
        await Promise.resolve();
      });
      expect(posthog.captureException).not.toHaveBeenCalled();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("shows the hover label for the element under the cursor", async () => {
    const originalFetch = global.fetch;
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        width: 200,
        height: 400,
        type: "Button",
        label: "btn_pay",
      }),
    })) as any;
    try {
      renderReplay(tapWithAttachments(["https://cdn/tree.json"]));
      await screen.findByLabelText("Restart");
      const node = await waitFor(() => {
        const el = document.querySelector<HTMLElement>("[data-label]");
        if (!el) {
          throw new Error("layout nodes not rendered yet");
        }
        return el;
      });
      const move = new Event("pointermove", { bubbles: true }) as any;
      move.clientX = 50;
      move.clientY = 50;
      move.buttons = 0;
      node.dispatchEvent(move);
      await act(async () => {
        await new Promise((resolve) =>
          requestAnimationFrame(() => resolve(null)),
        );
      });
      expect(screen.getByText("btn_pay (Button)")).toBeTruthy();
    } finally {
      global.fetch = originalFetch;
    }
  });

  it("holds together when a session carries no metrics, traces or events", async () => {
    renderReplay({
      cpu_usage: [],
      memory_usage: [],
      memory_usage_absolute: [],
      threads: {},
      traces: [],
    });

    await waitFor(() => {
      expect(screen.getByText(/User ID:/)).toBeTruthy();
    });
  });
});

describe("anr events", () => {
  it("titles an anr with its reason, which is all that tells two apart", () => {
    expect(
      sessionEventTitle("anr", {
        type: "sh.measure.android.anr.AnrError",
        message: "Broadcast of Intent (sh.measure.sample/.SyncReceiver)",
      }),
    ).toBe("Broadcast of Intent (sh.measure.sample/.SyncReceiver)");
  });

  it("falls back to the anr type when the system reported no reason", () => {
    expect(
      sessionEventTitle("anr", {
        type: "sh.measure.android.anr.AnrError",
        message: "",
      }),
    ).toBe("sh.measure.android.anr.AnrError");
  });

  it("shows the reason and the dump on their own, not among the rows", () => {
    const rows = detailRows("anr", {
      subject: "Input dispatching timed out (sh.measure.sample/.MainActivity)",
      art_thread_dump: '"main" prio=5 tid=1 Blocked',
      thread_name: "main",
    });

    expect(rows.map(([key]) => key)).toEqual(["thread_name"]);
  });

  it("renders an art thread dump in place of the stacktrace", () => {
    expect(
      eventTrace({
        stacktrace: "at Main.run(Main.java:10)",
        art_thread_dump: '"main" prio=5 tid=1 Blocked',
      }),
    ).toEqual({
      trace: '"main" prio=5 tid=1 Blocked',
      traceLabel: "ART THREAD DUMP",
    });
  });

  it("keeps the stacktrace when the system recorded no dump", () => {
    expect(
      eventTrace({ stacktrace: "at Main.run(Main.java:10)" }),
    ).toEqual({
      trace: "at Main.run(Main.java:10)",
      traceLabel: "STACKTRACE",
    });
  });
});

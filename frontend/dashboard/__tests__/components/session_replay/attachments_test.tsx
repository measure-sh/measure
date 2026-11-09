import {
  attachmentRefIndexAt,
  windowedAttachmentRefs,
  imageSizeOf,
  viewBoxOf,
} from "@/app/components/session_replay/attachments";

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { captureException: jest.fn() },
}));

// These tests deliberately make attachments fail, which the player reports
// to the console as it does in the browser. Silence those reports to keep the
// test output readable. Tests that check reporting use the PostHog mock or
// their own spy.
jest.spyOn(console, "error").mockImplementation(() => {});

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
      type: "layout_snapshot_json" as const,
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

  it("counts the window back from the end when its center is past the last attachment", () => {
    const attachmentRefs = attachmentRefsAt(0, 1, 2);

    expect(
      windowedAttachmentRefs(attachmentRefs, 3, 1).map(
        (attachmentRef) => attachmentRef.id,
      ),
    ).toEqual(["a2"]);
  });
});

describe("imageSizeOf", () => {
  // jsdom does not load images, so this mock records assigned src values and
  // returns its instance so a test can trigger image decoding.
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
      // Rejecting the promise alone would leave the browser downloading an
      // unused screenshot and using bandwidth needed for upcoming attachments.
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

describe("viewBoxOf", () => {
  it("reads the wireframe dimensions from its viewBox", () => {
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

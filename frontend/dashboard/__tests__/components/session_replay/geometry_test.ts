import {
  fitInto,
  sourceSizeOf,
  treeOutlineWidthPx,
  containerScaleOf,
  projectedExtent,
} from "@/app/components/session_replay/geometry";

describe("fitInto", () => {
  it("preserves the aspect ratio and leaves room for the overlays", () => {
    const fit = fitInto({ width: 200, height: 400 }, 1000, 1000);

    expect(fit.widthPercent).toBeCloseTo(fit.heightPercent / 2);
    // Leave room for the switcher and notice at the top and the turn hint
    // at the bottom.
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

    // The boxes coincide, so switching attachments leaves the image in place.
    // Only the source dimensions used to map gestures differ.
    expect(screenshot.leftPercent).toBeCloseTo(wireframe.leftPercent);
    expect(screenshot.topPercent).toBeCloseTo(wireframe.topPercent);
    expect(screenshot.widthPercent).toBeCloseTo(wireframe.widthPercent);
    expect(screenshot.heightPercent).toBeCloseTo(wireframe.heightPercent);
  });
});

describe("sourceSizeOf", () => {
  it("converts Apple screenshot pixels to gesture points", () => {
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

  it("keeps Android screenshot dimensions in pixels", () => {
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

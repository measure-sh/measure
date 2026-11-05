import { render } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  type Attachment,
  type LayoutElement,
} from "@/app/components/session_replay/attachments";
import {
  fitInto,
  sourceSizeOf,
  layerCountOf,
} from "@/app/components/session_replay/geometry";
import {
  ringPositionAt,
  stagePointFrom,
  tiltScaleFor,
  StageAttachment,
} from "@/app/components/session_replay/stage";

// jsdom does not implement layout. The player uses ResizeObserver to detect
// changes to the stage size.
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

// These tests deliberately make attachments fail, which the player reports
// to the console as it does in the browser. Silence those reports to keep the
// test output readable. Tests that check reporting use the PostHog mock or
// their own spy.
jest.spyOn(console, "error").mockImplementation(() => {});

// Shiki highlighting does not run in jsdom, and the stacktrace tests only
// need the code text.
jest.mock("@/app/components/code_block", () => ({
  __esModule: true,
  CODE_BLOCK_CARD_CLASS: "",
  default: ({ code }: any) => <pre>{code}</pre>,
}));

// The marketing demo snapshot follows the SDK convention of using absolute
// coordinates within the root.
const demoLayout: LayoutElement = JSON.parse(
  readFileSync(
    join(process.cwd(), "public/snapshots/demo_snapshot_discount_click.json"),
    "utf8",
  ),
);

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

  it("does not scale down an attachment at rest", () => {
    expect(tiltScaleFor(12, fit, { xDegrees: 0, yDegrees: 0 })).toBe(1);
  });

  it("scales down a fully tilted attachment to fit the stage", () => {
    const scale = tiltScaleFor(12, fit, { xDegrees: -40, yDegrees: 40 });

    expect(scale).toBeLessThan(1);
    expect(scale).toBeGreaterThan(0.2);
  });

  it("scales narrow and wide attachments equally when tilted", () => {
    // The lift is proportional to the attachment width, so a screen fitted
    // into a third of the stage tilts in the same proportions as one that
    // fills the stage.
    const narrow = fitInto({ width: 390, height: 844 }, 3000, 1000);
    const wide = fitInto({ width: 390, height: 844 }, 1000, 1000);
    const tilt = { xDegrees: -20, yDegrees: 35 };

    expect(tiltScaleFor(16, narrow, tilt)).toBeCloseTo(
      tiltScaleFor(16, wide, tilt),
      1,
    );
  });

  it("scales down a deeper tree more", () => {
    expect(tiltScaleFor(16, fit, { xDegrees: -40, yDegrees: 40 })).toBeLessThan(
      tiltScaleFor(4, fit, { xDegrees: -40, yDegrees: 40 }),
    );
  });

  it("keeps an attachment that cannot tilt at full size", () => {
    expect(tiltScaleFor(null, fit, { xDegrees: -40, yDegrees: 40 })).toBe(1);
  });
});

describe("ringPositionAt", () => {
  const tap = {
    eventIndex: 0,
    pressOffsetMs: 1000,
    releaseOffsetMs: 1220,
    from: { x: 10, y: 10 },
    to: { x: 10, y: 10 },
  };
  const swipe = {
    eventIndex: 1,
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

  it("stays at the release point after the swipe ends", () => {
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

  it("hides an attachment that is not selected", () => {
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

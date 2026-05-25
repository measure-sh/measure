import { describe, expect, it } from "@jest/globals";
import { act, fireEvent, render, screen } from "@testing-library/react";
import { useRef, useState } from "react";
import { useBrushToZoom } from "@/app/components/trace/use_brush_zoom";

/**
 * Harness — mirrors how TraceWaterfall wires the hook, but exposes the
 * internal state via test ids so we can assert on it from the outside.
 *
 * Container width: 1000px. Left col fraction: 0.5 → resizer at 506px →
 * timeline area spans [506, 1000] (timelineWidth = 494).
 */
function Harness({
  initialStart = 0,
  initialEnd = 1000,
  traceDurationMs = 1000,
}: {
  initialStart?: number;
  initialEnd?: number;
  traceDurationMs?: number;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [viewStartMs, setViewStartMs] = useState(initialStart);
  const [viewEndMs, setViewEndMs] = useState(initialEnd);
  const { startPx, currentPx } = useBrushToZoom({
    waterfallRef: ref,
    leftColumnFraction: 0.5,
    viewStartMs,
    viewEndMs,
    traceDurationMs,
    setViewStartMs,
    setViewEndMs,
  });
  return (
    <div ref={ref} data-testid="container">
      <span data-testid="view-start">{viewStartMs}</span>
      <span data-testid="view-end">{viewEndMs}</span>
      <span data-testid="brush-start">{startPx ?? -1}</span>
      <span data-testid="brush-current">{currentPx ?? -1}</span>
    </div>
  );
}

function mockBoundingRect(el: Element, width = 1000) {
  el.getBoundingClientRect = () => ({
    width,
    left: 0,
    right: width,
    top: 0,
    bottom: 100,
    height: 100,
    x: 0,
    y: 0,
    toJSON: () => ({}),
  });
}

function dispatchWindowMouse(type: "mousemove" | "mouseup", clientX: number) {
  act(() => {
    window.dispatchEvent(new MouseEvent(type, { clientX, bubbles: true }));
  });
}

describe("useBrushToZoom", () => {
  it("starts and tracks a brush while dragging across the timeline", () => {
    render(<Harness />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    // mousedown at 600 (inside timeline area, which starts at 506)
    fireEvent.mouseDown(container, { clientX: 600, button: 0 });
    expect(screen.getByTestId("brush-start").textContent).toBe("600");
    expect(screen.getByTestId("brush-current").textContent).toBe("600");

    // drag to 800 — brush-current updates, view window unchanged
    dispatchWindowMouse("mousemove", 800);
    expect(screen.getByTestId("brush-current").textContent).toBe("800");
    expect(screen.getByTestId("view-start").textContent).toBe("0");
    expect(screen.getByTestId("view-end").textContent).toBe("1000");
  });

  it("commits a zoom on mouseup when the drag exceeds the threshold", () => {
    render(<Harness />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    fireEvent.mouseDown(container, { clientX: 600, button: 0 });
    dispatchWindowMouse("mousemove", 800);
    dispatchWindowMouse("mouseup", 800);

    // timelineLeft = 1000*0.5 + 6 + 8 = 514, timelineRight = 992,
    // timelineWidth = 478, range = 1000.
    // newStart = ((600-514)/478)*1000 ≈ 180
    // newEnd   = ((800-514)/478)*1000 ≈ 598
    const start = Number(screen.getByTestId("view-start").textContent);
    const end = Number(screen.getByTestId("view-end").textContent);
    expect(start).toBeGreaterThan(170);
    expect(start).toBeLessThan(200);
    expect(end).toBeGreaterThan(580);
    expect(end).toBeLessThan(610);

    // brush is cleared
    expect(screen.getByTestId("brush-start").textContent).toBe("-1");
    expect(screen.getByTestId("brush-current").textContent).toBe("-1");
  });

  it("treats a sub-threshold drag as a click — no zoom commit", () => {
    render(<Harness />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    fireEvent.mouseDown(container, { clientX: 600, button: 0 });
    dispatchWindowMouse("mousemove", 602); // 2px move
    dispatchWindowMouse("mouseup", 602);

    expect(screen.getByTestId("view-start").textContent).toBe("0");
    expect(screen.getByTestId("view-end").textContent).toBe("1000");
    expect(screen.getByTestId("brush-start").textContent).toBe("-1");
  });

  it("ignores mousedown outside the timeline area (over span/thread cols)", () => {
    render(<Harness />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    fireEvent.mouseDown(container, { clientX: 200, button: 0 }); // before resizer
    expect(screen.getByTestId("brush-start").textContent).toBe("-1");
  });

  it("ignores non-primary mouse buttons", () => {
    render(<Harness />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    fireEvent.mouseDown(container, { clientX: 600, button: 2 }); // right click
    expect(screen.getByTestId("brush-start").textContent).toBe("-1");
  });

  it("clamps the brush within the timeline area when dragging beyond bounds", () => {
    render(<Harness />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    fireEvent.mouseDown(container, { clientX: 600, button: 0 });
    dispatchWindowMouse("mousemove", 9999);
    // Clamped to timelineRight = container width - 8px right inset.
    expect(screen.getByTestId("brush-current").textContent).toBe("992");

    dispatchWindowMouse("mousemove", -100);
    expect(screen.getByTestId("brush-current").textContent).toBe("514");
  });

  it("zooms relative to the current view window when already zoomed", () => {
    render(<Harness initialStart={200} initialEnd={600} />);
    const container = screen.getByTestId("container");
    mockBoundingRect(container);

    // brush from 700 to 900 (in the right half of the timeline area)
    fireEvent.mouseDown(container, { clientX: 700, button: 0 });
    dispatchWindowMouse("mousemove", 900);
    dispatchWindowMouse("mouseup", 900);

    // current range = 600 - 200 = 400, timelineLeft=506, width=494.
    // start fraction = (700-506)/494 ≈ 0.393
    // end fraction   = (900-506)/494 ≈ 0.797
    // newStart = 200 + 0.393*400 ≈ 357
    // newEnd   = 200 + 0.797*400 ≈ 519
    const start = Number(screen.getByTestId("view-start").textContent);
    const end = Number(screen.getByTestId("view-end").textContent);
    expect(start).toBeGreaterThan(340);
    expect(start).toBeLessThan(370);
    expect(end).toBeGreaterThan(500);
    expect(end).toBeLessThan(540);
  });
});

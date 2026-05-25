import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import { act, render, screen } from "@testing-library/react";
import TickRuler, {
  pickTickFractions,
} from "@/app/components/trace/tick_ruler";

// --------------------------------------------------------------
// MIN_LABEL_PX (in tick_ruler.tsx) is 70. Densities are:
//   6 ticks: 5 gaps → width >= 350
//   4 ticks: 3 gaps → width >= 210
//   3 ticks: 2 gaps → width >= 140
//   2 ticks: 1 gap  → width >= 70 (otherwise fallback)
// --------------------------------------------------------------

describe("pickTickFractions", () => {
  it("returns 6 ticks when width >= 350", () => {
    expect(pickTickFractions(350)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
    expect(pickTickFractions(1000)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it("returns 4 ticks when width in [210, 350)", () => {
    expect(pickTickFractions(349)).toEqual([0, 1 / 3, 2 / 3, 1]);
    expect(pickTickFractions(210)).toEqual([0, 1 / 3, 2 / 3, 1]);
  });

  it("returns 3 ticks when width in [140, 210)", () => {
    expect(pickTickFractions(209)).toEqual([0, 0.5, 1]);
    expect(pickTickFractions(140)).toEqual([0, 0.5, 1]);
  });

  it("returns 2 ticks when width >= 70 and < 140", () => {
    expect(pickTickFractions(139)).toEqual([0, 1]);
    expect(pickTickFractions(70)).toEqual([0, 1]);
  });

  it("falls back to 2 ticks for tiny / zero widths", () => {
    expect(pickTickFractions(69)).toEqual([0, 1]);
    expect(pickTickFractions(0)).toEqual([0, 1]);
    expect(pickTickFractions(-50)).toEqual([0, 1]);
  });
});

// --------------------------------------------------------------
// Component tests
// --------------------------------------------------------------

interface MockObserverEntry {
  contentRect: { width: number };
}

class MockResizeObserver {
  static instances: MockResizeObserver[] = [];
  callback: (entries: MockObserverEntry[]) => void;
  observeCalls = 0;
  disconnectCalls = 0;
  constructor(cb: (entries: MockObserverEntry[]) => void) {
    this.callback = cb;
    MockResizeObserver.instances.push(this);
  }
  observe() {
    this.observeCalls++;
  }
  unobserve() {}
  disconnect() {
    this.disconnectCalls++;
  }
}

function lastObserver() {
  const arr = MockResizeObserver.instances;
  return arr[arr.length - 1];
}

function triggerResize(width: number) {
  const ro = lastObserver();
  act(() => {
    ro.callback([{ contentRect: { width } }]);
  });
}

function getTicks() {
  return Array.from(
    document.querySelectorAll('[data-testid="trace-tick-ruler"] > div'),
  ) as HTMLElement[];
}

describe("TickRuler", () => {
  beforeEach(() => {
    MockResizeObserver.instances = [];
    (global as { ResizeObserver?: unknown }).ResizeObserver =
      MockResizeObserver;
  });

  afterEach(() => {
    delete (global as { ResizeObserver?: unknown }).ResizeObserver;
  });

  it("renders the ruler container with the testid", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    expect(screen.getByTestId("trace-tick-ruler")).toBeTruthy();
  });

  it("renders 2 ticks initially (jsdom returns width=0)", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    expect(getTicks()).toHaveLength(2);
  });

  it("renders 6 ticks after the ResizeObserver reports a wide container", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    expect(getTicks()).toHaveLength(6);
  });

  it("renders 4 ticks at medium widths", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(250);
    expect(getTicks()).toHaveLength(4);
  });

  it("renders 3 ticks at small widths", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(150);
    expect(getTicks()).toHaveLength(3);
  });

  it("collapses back to 2 ticks when the container shrinks", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    expect(getTicks()).toHaveLength(6);
    triggerResize(100);
    expect(getTicks()).toHaveLength(2);
  });

  it("places ticks at the correct horizontal percentages", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    const lefts = getTicks().map((el) => el.style.left);
    expect(lefts).toEqual(["0%", "20%", "40%", "60%", "80%", "100%"]);
  });

  it("aligns the first / last / middle ticks with the right transform", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    const transforms = getTicks().map((el) => el.style.transform);
    expect(transforms[0]).toBe("translateX(0)");
    expect(transforms[transforms.length - 1]).toBe("translateX(-100%)");
    for (let i = 1; i < transforms.length - 1; i++) {
      expect(transforms[i]).toBe("translateX(-50%)");
    }
  });

  it("formats labels relative to startMs across the windowMs range", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    const labels = getTicks().map((el) => el.textContent);
    // windowMs=1000 with 6 ticks → 0ms, 200ms, 400ms, 600ms, 800ms, 1.0s
    expect(labels[0]).toBe("0ms");
    expect(labels[1]).toBe("200ms");
    expect(labels[labels.length - 1]).toBe("1s");
  });

  it("offsets labels by startMs when zoomed in", () => {
    render(<TickRuler startMs={500} windowMs={500} />);
    triggerResize(400);
    const labels = getTicks().map((el) => el.textContent);
    // Zoomed range [500, 1000] → first label = 500ms, last = 1.0s
    expect(labels[0]).toBe("500ms");
    expect(labels[labels.length - 1]).toBe("1s");
  });

  it("updates labels when startMs / windowMs change", () => {
    const { rerender } = render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    expect(getTicks()[0].textContent).toBe("0ms");
    rerender(<TickRuler startMs={2000} windowMs={1000} />);
    expect(getTicks()[0].textContent).toBe("2s");
  });

  it("observes the container element on mount", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    expect(lastObserver().observeCalls).toBe(1);
  });

  it("disconnects the ResizeObserver on unmount", () => {
    const { unmount } = render(<TickRuler startMs={0} windowMs={1000} />);
    const ro = lastObserver();
    expect(ro.disconnectCalls).toBe(0);
    unmount();
    expect(ro.disconnectCalls).toBe(1);
  });

  it("ignores observer entries with non-numeric widths", () => {
    render(<TickRuler startMs={0} windowMs={1000} />);
    triggerResize(400);
    expect(getTicks()).toHaveLength(6);
    // Empty entries array - should not crash, count stays the same
    act(() => {
      lastObserver().callback([]);
    });
    expect(getTicks()).toHaveLength(6);
  });

  it("renders without crashing when ResizeObserver is undefined", () => {
    delete (global as { ResizeObserver?: unknown }).ResizeObserver;
    expect(() =>
      render(<TickRuler startMs={0} windowMs={1000} />),
    ).not.toThrow();
    // Falls back to the initial (width=0) 2-tick layout.
    expect(getTicks()).toHaveLength(2);
  });

  it("uses the element's initial bounding rect width on mount", () => {
    // Override getBoundingClientRect to simulate a real layout width on mount.
    const origRect = Element.prototype.getBoundingClientRect;
    Element.prototype.getBoundingClientRect = jest.fn(
      () =>
        ({
          width: 400,
          height: 16,
          top: 0,
          left: 0,
          right: 400,
          bottom: 16,
          x: 0,
          y: 0,
          toJSON: () => ({}),
        }) as DOMRect,
    );
    try {
      render(<TickRuler startMs={0} windowMs={1000} />);
      expect(getTicks()).toHaveLength(6);
    } finally {
      Element.prototype.getBoundingClientRect = origRect;
    }
  });
});

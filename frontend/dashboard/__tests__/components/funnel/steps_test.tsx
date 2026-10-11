import type { Funnel } from "@/app/api/api_calls";
import FunnelSteps from "@/app/components/funnel/steps";
import { useChartColors } from "@/app/utils/chart_utils";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";

// jsdom does no layout, so element widths come from this description.
type Layout = {
  available: number;
  stepWidths: number[];
  separator: number;
  labelWidth: number;
  pillPadding: number;
};

let layout: Layout;

function rect(left: number, width: number): DOMRect {
  return {
    x: left,
    y: 0,
    left,
    right: left + width,
    top: 0,
    bottom: 20,
    width,
    height: 20,
    toJSON: () => ({}),
  } as DOMRect;
}

function isMeasurer(el: Element | null): boolean {
  return el?.getAttribute("aria-hidden") === "true";
}

function mockGetBoundingClientRect(this: Element): DOMRect {
  const { available, stepWidths, separator, labelWidth, pillPadding } = layout;
  if (this.hasAttribute("data-funnel-step")) {
    const steps = [
      ...this.parentElement!.querySelectorAll("[data-funnel-step]"),
    ];
    const index = steps.indexOf(this);
    const left =
      pillPadding / 2 +
      stepWidths.slice(0, index).reduce((sum, w) => sum + w, 0) +
      index * separator;
    return rect(left, stepWidths[index]);
  }
  if (this.hasAttribute("data-hidden-steps")) {
    return rect(0, labelWidth);
  }
  if (isMeasurer(this.parentElement)) {
    const full =
      pillPadding +
      stepWidths.reduce((sum, w) => sum + w, 0) +
      (stepWidths.length - 1) * separator;
    return rect(0, full);
  }
  if (isMeasurer(this.firstElementChild)) {
    return rect(0, available);
  }
  return rect(0, 0);
}

type Observer = {
  callback: ResizeObserverCallback;
  observed: Element[];
  disconnected: boolean;
};

let observers: Observer[];

class MockResizeObserver {
  private observer: Observer;
  constructor(callback: ResizeObserverCallback) {
    this.observer = { callback, observed: [], disconnected: false };
    observers.push(this.observer);
  }
  observe(el: Element) {
    this.observer.observed.push(el);
  }
  unobserve() {}
  disconnect() {
    this.observer.disconnected = true;
  }
}

const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;

beforeAll(() => {
  Element.prototype.getBoundingClientRect = mockGetBoundingClientRect;
  (globalThis as any).ResizeObserver = MockResizeObserver;
});

afterAll(() => {
  Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  delete (globalThis as any).ResizeObserver;
});

beforeEach(() => {
  observers = [];
});

function funnelOf(eventNames: string[]): Funnel {
  return {
    id: "funnel-1",
    app_id: "app-1",
    name: "Checkout",
    steps: eventNames.map((event_name) => ({ event_name })),
    conversion_window_seconds: 3600,
    pinned: false,
    pin_order: null,
    created_by: null,
    created_by_email: null,
    created_at: "2026-01-01T00:00:00Z",
    updated_at: "2026-01-01T00:00:00Z",
  };
}

function visiblePill(container: HTMLElement): HTMLElement {
  return container.firstElementChild!.children[1] as HTMLElement;
}

function visibleItems(container: HTMLElement): HTMLElement[] {
  return [...visiblePill(container).children].filter(
    (el): el is HTMLElement => el.tagName === "SPAN",
  );
}

function visibleTexts(container: HTMLElement): string[] {
  return visibleItems(container).map((el) => el.textContent ?? "");
}

function shrinkFixed(container: HTMLElement): string[] {
  return visibleItems(container)
    .filter((el) => el.classList.contains("shrink-0"))
    .map((el) => el.textContent ?? "");
}

function chevronCount(container: HTMLElement): number {
  return visiblePill(container).querySelectorAll(":scope > svg").length;
}

function cssColor(hex: string): string {
  const el = document.createElement("span");
  el.style.backgroundColor = hex;
  return el.style.backgroundColor;
}

const FIVE_STEPS = ["open", "browse", "cart", "pay", "done"];

// With these widths the measured pill is 460 wide. Showing the first `n`
// steps, the "+N steps" label and the last step needs 430 for n = 3, 340 for
// n = 2 and 240 for n = 1.
const FIVE_STEP_LAYOUT: Omit<Layout, "available"> = {
  stepWidths: [100, 90, 80, 70, 60],
  separator: 10,
  labelWidth: 40,
  pillPadding: 20,
};

function renderFiveSteps(available: number) {
  layout = { ...FIVE_STEP_LAYOUT, available };
  return render(<FunnelSteps funnel={funnelOf(FIVE_STEPS)} />);
}

describe("FunnelSteps", () => {
  describe("when every step fits", () => {
    it("shows every step in order with a chevron between each", () => {
      const { container } = renderFiveSteps(1000);
      expect(visibleTexts(container)).toEqual(FIVE_STEPS);
      expect(chevronCount(container)).toBe(4);
      expect(shrinkFixed(container)).toEqual([]);
    });

    it("shows every step when the pill is as wide as the room", () => {
      const { container } = renderFiveSteps(460);
      expect(visibleTexts(container)).toEqual(FIVE_STEPS);
    });

    it("colors each step with its step color", () => {
      const colors = renderHook(() => useChartColors()).result.current;
      const { container } = renderFiveSteps(1000);
      const dots = visibleItems(container).map(
        (el) => (el.firstElementChild as HTMLElement).style.backgroundColor,
      );
      expect(dots).toEqual(FIVE_STEPS.map((_, i) => cssColor(colors[i])));
    });
  });

  describe("when the pill is too narrow", () => {
    it("hides the steps that do not fit and counts them", () => {
      const { container } = renderFiveSteps(400);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "+2 steps",
        "done",
      ]);
      expect(chevronCount(container)).toBe(3);
      expect(shrinkFixed(container)).toEqual(["+2 steps"]);
    });

    it("hides one step as soon as the full pill is one pixel too wide", () => {
      const { container } = renderFiveSteps(459);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "cart",
        "+1 step",
        "done",
      ]);
    });

    it("keeps only the first step when that is all that fits", () => {
      const { container } = renderFiveSteps(240);
      expect(visibleTexts(container)).toEqual(["open", "+3 steps", "done"]);
    });

    it("keeps the first step, the count and the last step when even they do not fit", () => {
      const { container } = renderFiveSteps(100);
      expect(visibleTexts(container)).toEqual(["open", "+3 steps", "done"]);
      expect(shrinkFixed(container)).toEqual(["+3 steps"]);
    });

    it("keeps the last step's own color", () => {
      const colors = renderHook(() => useChartColors()).result.current;
      const { container } = renderFiveSteps(400);
      const items = visibleItems(container);
      const last = items[items.length - 1].firstElementChild as HTMLElement;
      expect(last.style.backgroundColor).toBe(cssColor(colors[4]));
    });

    it("draws no color dot for the hidden steps count", () => {
      const { container } = renderFiveSteps(400);
      const count = visibleItems(container).find(
        (el) => el.textContent === "+2 steps",
      )!;
      expect(count.children).toHaveLength(1);
    });

    it("collapses a funnel of three steps to the first, +1 step and the last", () => {
      layout = {
        available: 339,
        stepWidths: [100, 100, 100],
        separator: 10,
        labelWidth: 40,
        pillPadding: 20,
      };
      const { container } = render(
        <FunnelSteps funnel={funnelOf(["open", "cart", "done"])} />,
      );
      expect(visibleTexts(container)).toEqual(["open", "+1 step", "done"]);
    });
  });

  describe("truncated step", () => {
    it("shows the next hidden step truncated when 64px of room is left", () => {
      const { container } = renderFiveSteps(414);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "cart",
        "+1 step",
        "done",
      ]);
      expect(shrinkFixed(container)).toEqual([
        "open",
        "browse",
        "+1 step",
        "done",
      ]);
    });

    it("does not show a truncated step when 63px of room is left", () => {
      const { container } = renderFiveSteps(413);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "+2 steps",
        "done",
      ]);
    });

    it("truncates the second step when only the first fits whole", () => {
      const { container } = renderFiveSteps(314);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "+2 steps",
        "done",
      ]);
      expect(shrinkFixed(container)).toEqual(["open", "+2 steps", "done"]);
    });

    // Truncating the one hidden step would leave the label reading "+0 steps".
    it("does not truncate when only one step is hidden, however much room is left", () => {
      layout = {
        available: 429,
        stepWidths: [60, 60, 200, 60],
        separator: 10,
        labelWidth: 40,
        pillPadding: 20,
      };
      const { container } = render(
        <FunnelSteps funnel={funnelOf(["open", "browse", "cart", "done"])} />,
      );
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "+1 step",
        "done",
      ]);
      expect(shrinkFixed(container)).toEqual(["+1 step"]);
    });
  });

  describe("short funnels", () => {
    it.each([[["open"]], [["open", "done"]]])(
      "shows every step of %j however narrow the pill is",
      (eventNames) => {
        layout = {
          available: 10,
          stepWidths: eventNames.map(() => 100),
          separator: 10,
          labelWidth: 40,
          pillPadding: 20,
        };
        const { container } = render(
          <FunnelSteps funnel={funnelOf(eventNames)} />,
        );
        expect(visibleTexts(container)).toEqual(eventNames);
        expect(chevronCount(container)).toBe(eventNames.length - 1);
      },
    );
  });

  describe("tooltip", () => {
    it("shows every step, including hidden ones, when the pill is focused", async () => {
      const { container } = renderFiveSteps(240);
      fireEvent.focus(visiblePill(container));
      expect(await screen.findByRole("tooltip")).toHaveTextContent(
        "open → browse → cart → pay → done",
      );
    });
  });

  describe("resizing", () => {
    function resize(available: number) {
      layout = { ...layout, available };
      act(() => {
        for (const observer of observers) {
          if (!observer.disconnected) {
            observer.callback([], observer as unknown as ResizeObserver);
          }
        }
      });
    }

    it("collapses when the room shrinks and expands when it grows", () => {
      const { container } = renderFiveSteps(1000);
      expect(visibleTexts(container)).toEqual(FIVE_STEPS);

      resize(400);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "+2 steps",
        "done",
      ]);

      resize(1000);
      expect(visibleTexts(container)).toEqual(FIVE_STEPS);
    });

    it("re-measures when the step names change width", () => {
      const { container } = renderFiveSteps(460);
      expect(visibleTexts(container)).toEqual(FIVE_STEPS);

      layout = { ...layout, stepWidths: [110, 90, 80, 70, 60] };
      resize(460);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "cart",
        "+1 step",
        "done",
      ]);
    });

    it("watches the wrapper and the full-width copy of the pill", () => {
      const { container } = renderFiveSteps(1000);
      const wrapper = container.firstElementChild!;
      const measuredPill = wrapper.firstElementChild!.firstElementChild!;
      expect(observers).toHaveLength(1);
      expect(observers[0].observed).toEqual([wrapper, measuredPill]);
    });

    it("stops watching on unmount", () => {
      const { unmount } = renderFiveSteps(1000);
      unmount();
      expect(observers.every((o) => o.disconnected)).toBe(true);
    });

    it("re-measures when the funnel changes", () => {
      const { container, rerender } = renderFiveSteps(400);
      expect(visibleTexts(container)).toEqual([
        "open",
        "browse",
        "+2 steps",
        "done",
      ]);

      layout = { ...layout, stepWidths: [100, 90, 80] };
      rerender(<FunnelSteps funnel={funnelOf(["open", "browse", "done"])} />);
      expect(visibleTexts(container)).toEqual(["open", "browse", "done"]);
      expect(observers[0].disconnected).toBe(true);
    });
  });
});

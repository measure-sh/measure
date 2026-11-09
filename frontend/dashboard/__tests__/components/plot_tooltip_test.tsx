import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  jest,
} from "@jest/globals";
import "@testing-library/jest-dom";
import { pointerDown } from "@/__tests__/helpers/pointer_events";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

import {
  PlotTooltip,
  PlotTooltipArea,
  PlotTooltipShell,
  PlotTooltipSwatch,
  type TooltipTaps,
  tooltipPosition,
  useTooltipTaps,
} from "@/app/components/plot_tooltip";

describe("PlotTooltipShell", () => {
  it("renders children inside the shared tooltip panel", () => {
    const { container, getByText } = render(
      <PlotTooltipShell>
        <p>body</p>
      </PlotTooltipShell>,
    );
    expect(getByText("body")).toBeInTheDocument();
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("bg-background");
    expect(shell.className).toContain("rounded-md");
    expect(shell.className).toContain("font-body");
    expect(shell.className).toContain("text-xs");
  });

  it("adds the className it is given", () => {
    const { container } = render(
      <PlotTooltipShell className="py-4">
        <p>body</p>
      </PlotTooltipShell>,
    );
    const shell = container.firstChild as HTMLElement;
    expect(shell.className).toContain("py-4");
  });
});

describe("PlotTooltipSwatch", () => {
  it("renders a colour dot with the given background colour", () => {
    const { container } = render(<PlotTooltipSwatch color="rgb(1, 2, 3)" />);
    const dot = container.firstChild as HTMLElement;
    expect(dot.className).toContain("rounded-full");
    expect(dot.style.backgroundColor).toBe("rgb(1, 2, 3)");
  });
});

describe("tooltipPosition", () => {
  const viewportSize = { width: 1000, height: 800 };
  const tooltipSize = { width: 300, height: 100 };

  it("centres a tooltip above the pointer", () => {
    expect(
      tooltipPosition(tooltipSize, { x: 500, y: 400 }, viewportSize),
    ).toEqual({
      x: 350,
      y: 286,
    });
  });

  it("keeps a tooltip inside the right edge", () => {
    expect(
      tooltipPosition(tooltipSize, { x: 990, y: 400 }, viewportSize),
    ).toEqual({
      x: 692,
      y: 286,
    });
  });

  it("keeps a tooltip inside the left edge", () => {
    expect(
      tooltipPosition(tooltipSize, { x: 20, y: 400 }, viewportSize),
    ).toEqual({
      x: 8,
      y: 286,
    });
  });

  it("places a tooltip below the pointer when there's no room above", () => {
    expect(
      tooltipPosition(tooltipSize, { x: 500, y: 50 }, viewportSize),
    ).toEqual({
      x: 350,
      y: 64,
    });
  });

  it("opens a corner tooltip below and to the right of the pointer", () => {
    expect(
      tooltipPosition(tooltipSize, { x: 500, y: 400 }, viewportSize, "corner"),
    ).toEqual({ x: 512, y: 412 });
  });

  it("opens a corner tooltip on the other side of the pointer at the right and bottom edges", () => {
    expect(
      tooltipPosition(tooltipSize, { x: 900, y: 750 }, viewportSize, "corner"),
    ).toEqual({ x: 588, y: 638 });
  });
});

describe("PlotTooltipArea", () => {
  // jsdom has no ResizeObserver, so the mock reports a fixed tooltip size
  // as soon as it observes an element.
  class MockResizeObserver {
    constructor(private callback: ResizeObserverCallback) {}
    observe(el: Element) {
      this.callback(
        [{ target: el, contentRect: { width: 300, height: 100 } } as any],
        this as any,
      );
    }
    unobserve() {}
    disconnect() {}
  }

  // jsdom has no PointerEvent, so a MouseEvent with a pointer event type carries
  // the position.
  function pointer(target: Element, type: string, x: number, y: number) {
    const view = target.ownerDocument.defaultView as typeof window;
    act(() => {
      target.dispatchEvent(
        new view.MouseEvent(type, { bubbles: true, clientX: x, clientY: y }),
      );
    });
  }

  function Chart({
    hovered,
    tip = "body",
  }: {
    hovered: boolean;
    tip?: string;
  }) {
    return (
      <PlotTooltipArea>
        <div data-testid="chart" />
        {hovered && (
          <PlotTooltip key={tip}>
            <p>{tip}</p>
          </PlotTooltip>
        )}
      </PlotTooltipArea>
    );
  }

  function layer() {
    return document.body.querySelector<HTMLElement>(":scope > .fixed")!;
  }

  beforeEach(() => {
    (globalThis as any).ResizeObserver = MockResizeObserver;
    Object.defineProperty(document.documentElement, "clientWidth", {
      configurable: true,
      value: 1000,
    });
    Object.defineProperty(document.documentElement, "clientHeight", {
      configurable: true,
      value: 800,
    });
  });

  afterEach(() => {
    delete (globalThis as any).ResizeObserver;
    delete (document.documentElement as any).clientWidth;
    delete (document.documentElement as any).clientHeight;
  });

  it("renders the tooltip in the body and follows the pointer within the area", () => {
    const { container, rerender } = render(<Chart hovered={false} />);
    expect(layer().style.visibility).toBe("hidden");

    pointer(screen.getByTestId("chart"), "pointermove", 500, 400);
    rerender(<Chart hovered />);

    const tooltip = screen.getByRole("tooltip");
    expect(tooltip).toBe(layer());
    expect(container).not.toContainElement(tooltip);
    expect(tooltip).toHaveTextContent("body");
    expect(tooltip.style.transform).toBe("translate(350px, 286px)");

    pointer(screen.getByTestId("chart"), "pointermove", 990, 400);
    expect(tooltip.style.transform).toBe("translate(692px, 286px)");
  });

  it("positions the tooltip on tap when no pointer move fires", () => {
    const { rerender } = render(<Chart hovered={false} />);

    pointer(screen.getByTestId("chart"), "pointerover", 500, 400);
    pointer(screen.getByTestId("chart"), "pointerdown", 500, 400);
    rerender(<Chart hovered />);

    expect(screen.getByRole("tooltip").style.transform).toBe(
      "translate(350px, 286px)",
    );
  });

  it("keeps the layer visible while a chart remounts its tooltip", async () => {
    const { rerender } = render(<Chart hovered={false} />);
    pointer(screen.getByTestId("chart"), "pointermove", 500, 400);
    rerender(<Chart hovered tip="first" />);
    const before = screen.getByRole("tooltip");
    await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
    expect(before).toHaveClass("transition-transform");

    rerender(<Chart hovered tip="second" />);
    await act(async () => {});

    const after = screen.getByRole("tooltip");
    expect(after).toBe(before);
    expect(after).toHaveTextContent("second");
    expect(after.style.visibility).toBe("");
    expect(after).toHaveClass("transition-transform");
  });

  it("shows a reopened tooltip only after measuring its new content", async () => {
    // The observer reports a size only when the test calls report().
    const observers: { callback: ResizeObserverCallback; el: Element }[] = [];
    (globalThis as any).ResizeObserver = class {
      constructor(private callback: ResizeObserverCallback) {}
      observe(el: Element) {
        observers.push({ callback: this.callback, el });
      }
      unobserve() {}
      disconnect() {}
    };
    const report = (width: number, height: number) =>
      act(() => {
        const { callback, el } = observers.at(-1)!;
        callback(
          [{ target: el, contentRect: { width, height } } as any],
          {} as ResizeObserver,
        );
      });

    const { rerender } = render(<Chart hovered={false} />);
    pointer(screen.getByTestId("chart"), "pointermove", 500, 400);
    rerender(<Chart hovered tip="first" />);
    report(300, 100);
    expect(layer().style.visibility).toBe("");

    rerender(<Chart hovered={false} />);
    await waitFor(() => expect(layer().style.visibility).toBe("hidden"));
    rerender(<Chart hovered tip="second" />);
    expect(layer().style.visibility).toBe("hidden");

    report(200, 50);
    expect(layer().style.visibility).toBe("");
    expect(layer().style.transform).toBe("translate(400px, 336px)");
    expect(layer()).not.toHaveClass("transition-transform");
  });

  it("keeps the last tooltip visible as the pointer crosses a gap", () => {
    const { rerender } = render(<Chart hovered={false} />);
    pointer(screen.getByTestId("chart"), "pointermove", 500, 400);
    rerender(<Chart hovered tip="first" />);
    const before = screen.getByRole("tooltip");

    rerender(<Chart hovered={false} />);
    expect(screen.getByRole("tooltip")).toHaveTextContent("first");
    expect(layer().style.visibility).toBe("");

    rerender(<Chart hovered tip="second" />);
    const after = screen.getByRole("tooltip");
    expect(after).toBe(before);
    expect(after).toHaveTextContent("second");
    expect(after.style.visibility).toBe("");
  });

  it("hides and empties the layer after a short delay following tooltip unmount", async () => {
    const { rerender } = render(<Chart hovered={false} />);
    pointer(screen.getByTestId("chart"), "pointermove", 500, 400);
    rerender(<Chart hovered />);

    rerender(<Chart hovered={false} />);

    await waitFor(() => expect(screen.queryByRole("tooltip")).toBeNull());
    expect(layer().style.visibility).toBe("hidden");
    expect(layer()).toBeEmptyDOMElement();
  });

  describe("on scroll", () => {
    // jsdom has no layout, so the tests set each element's top edge and
    // whether the area has a box of its own.
    let tops: Map<Element, number>;
    let areaHasBox: boolean;

    beforeEach(() => {
      tops = new Map();
      areaHasBox = true;
      jest
        .spyOn(Element.prototype, "getBoundingClientRect")
        .mockImplementation(function (this: Element) {
          return { left: 0, top: tops.get(this) ?? 0 } as DOMRect;
        });
      jest
        .spyOn(Element.prototype, "getClientRects")
        .mockImplementation(function (this: Element) {
          const hasBox = this.className === "size-full" && areaHasBox;
          return (hasBox ? [{}] : []) as unknown as DOMRectList;
        });
    });

    afterEach(() => {
      jest.restoreAllMocks();
    });

    function area() {
      return screen.getByTestId("chart").parentElement!;
    }

    function hover() {
      const { rerender } = render(<Chart hovered={false} />);
      pointer(screen.getByTestId("chart"), "pointermove", 500, 400);
      rerender(<Chart hovered />);
    }

    it("moves the tooltip with the area as it scrolls", () => {
      hover();
      expect(layer().style.transform).toBe("translate(350px, 286px)");

      tops.set(area(), -100);
      fireEvent.scroll(document);
      expect(layer().style.transform).toBe("translate(350px, 186px)");
    });

    it("tracks the first child when the area has no box", () => {
      areaHasBox = false;
      hover();

      tops.set(area(), -100);
      fireEvent.scroll(document);
      expect(layer().style.transform).toBe("translate(350px, 286px)");

      tops.set(screen.getByTestId("chart"), -100);
      fireEvent.scroll(document);
      expect(layer().style.transform).toBe("translate(350px, 186px)");
    });

    it("keeps the tooltip in place when a scroll doesn't move the area", () => {
      hover();
      fireEvent.scroll(document);
      expect(layer().style.transform).toBe("translate(350px, 286px)");
    });

    it("disables the transition while scrolling and restores it on pointer move", async () => {
      hover();
      await act(() => new Promise((resolve) => requestAnimationFrame(resolve)));
      expect(layer()).toHaveClass("transition-transform");

      tops.set(area(), -100);
      fireEvent.scroll(document);
      expect(layer()).not.toHaveClass("transition-transform");

      pointer(screen.getByTestId("chart"), "pointermove", 500, 300);
      expect(layer()).toHaveClass("transition-transform");
      expect(layer().style.transform).toBe("translate(350px, 186px)");
    });
  });

  it("throws when PlotTooltip is rendered outside PlotTooltipArea", () => {
    const consoleError = jest
      .spyOn(console, "error")
      .mockImplementation(() => {});
    expect(() =>
      render(
        <PlotTooltip>
          <p>body</p>
        </PlotTooltip>,
      ),
    ).toThrow("PlotTooltip must be used within a PlotTooltipArea.");
    consoleError.mockRestore();
  });

  it("renders into an iframe's body and positions itself in the iframe's window", () => {
    const iframe = document.createElement("iframe");
    document.body.appendChild(iframe);
    const iframeWindow = iframe.contentWindow as typeof window;
    Object.defineProperty(
      iframeWindow.document.documentElement,
      "clientWidth",
      { value: 1440 },
    );
    Object.defineProperty(
      iframeWindow.document.documentElement,
      "clientHeight",
      { value: 900 },
    );
    const container = iframeWindow.document.createElement("div");
    iframeWindow.document.body.appendChild(container);
    const { rerender, unmount } = render(<Chart hovered={false} />, {
      container,
    });

    pointer(
      container.querySelector('[data-testid="chart"]')!,
      "pointermove",
      1300,
      400,
    );
    rerender(<Chart hovered />);

    const tooltip =
      iframeWindow.document.body.querySelector<HTMLElement>(
        '[role="tooltip"]',
      )!;
    expect(tooltip.parentElement).toBe(iframeWindow.document.body);
    // The iframe's window is 1440px wide, so the tooltip moves left only to
    // stay within it.
    expect(tooltip.style.transform).toBe("translate(1132px, 286px)");
    unmount();
    iframe.remove();
  });
});

describe("TooltipTaps", () => {
  let tooltipTaps: TooltipTaps;

  function Chart({ shownKey }: { shownKey: string | null }) {
    tooltipTaps = useTooltipTaps();
    return (
      <PlotTooltipArea taps={tooltipTaps}>
        <div data-testid="chart" />
        {shownKey !== null && (
          <PlotTooltip tapKey={shownKey}>
            <p>{shownKey}</p>
          </PlotTooltip>
        )}
      </PlotTooltipArea>
    );
  }

  function pointerDownOnChart(pointerType: string) {
    pointerDown(screen.getByTestId("chart"), pointerType);
  }

  it("acts on a mouse or pen click when no tooltip is visible", () => {
    render(<Chart shownKey={null} />);

    pointerDownOnChart("mouse");
    expect(tooltipTaps.shouldAct("a")).toBe(true);
    pointerDownOnChart("pen");
    expect(tooltipTaps.shouldAct("a")).toBe(true);
    expect(tooltipTaps.shouldAct(null)).toBe(true);
  });

  it("acts on a click with no preceding pointer event", () => {
    render(<Chart shownKey={null} />);

    expect(tooltipTaps.shouldAct("a")).toBe(true);
  });

  it("does not act on a target's first tap", () => {
    render(<Chart shownKey={null} />);

    pointerDownOnChart("touch");
    expect(tooltipTaps.shouldAct("a")).toBe(false);
  });

  it("acts on a tap on the target with the visible tooltip", () => {
    render(<Chart shownKey="a" />);

    pointerDownOnChart("touch");
    expect(tooltipTaps.shouldAct("a")).toBe(true);
  });

  it("does not act on another target or on a target with no tooltip", () => {
    render(<Chart shownKey="a" />);

    pointerDownOnChart("touch");
    expect(tooltipTaps.shouldAct("b")).toBe(false);
    expect(tooltipTaps.shouldAct(null)).toBe(false);
  });

  it("uses the tooltip that was visible when the tap started", () => {
    const { rerender } = render(<Chart shownKey="a" />);

    pointerDownOnChart("touch");
    rerender(<Chart shownKey="b" />);
    expect(tooltipTaps.shouldAct("a")).toBe(true);
    expect(tooltipTaps.shouldAct("b")).toBe(false);
  });

  it("does not act on a target after its tooltip closes", () => {
    const { rerender } = render(<Chart shownKey="a" />);

    rerender(<Chart shownKey={null} />);
    pointerDownOnChart("touch");
    expect(tooltipTaps.shouldAct("a")).toBe(false);
  });
});

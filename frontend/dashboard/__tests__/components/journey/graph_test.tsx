import type {
  Journey,
  JourneyNode,
  JourneySelection,
} from "@/app/api/api_calls";
import JourneyGraph from "@/app/components/journey/graph";
import { layOut, linkPath } from "@/app/components/journey/graph_layout";
import { useChartColor } from "@/app/utils/chart_utils";
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import "@testing-library/jest-dom";
import { pointerDown, pointerLeave } from "@/__tests__/helpers/pointer_events";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";

const WIDTH = 800;
const HEIGHT = 400;

// The graph sizes itself from ResizeObserver, which jsdom lacks, so the mock
// reports a fixed size as soon as an element is observed.
class MockResizeObserver {
  constructor(private callback: ResizeObserverCallback) {}
  observe(el: Element) {
    this.callback(
      [{ target: el, contentRect: { width: WIDTH, height: HEIGHT } } as any],
      this as any,
    );
  }
  unobserve() {}
  disconnect() {}
}

// jsdom has no PointerEvent, and the Event it falls back to drops the
// pointer's position and buttons, which panning reads.
class MockPointerEvent extends MouseEvent {
  pointerId: number;
  constructor(type: string, init: PointerEventInit = {}) {
    super(type, init);
    this.pointerId = init.pointerId ?? 1;
  }
}

beforeAll(() => {
  (globalThis as any).ResizeObserver = MockResizeObserver;
  (globalThis as any).PointerEvent = MockPointerEvent;
  Element.prototype.scrollIntoView = jest.fn();
  Element.prototype.setPointerCapture = jest.fn();
  Element.prototype.releasePointerCapture = jest.fn();
});

afterAll(() => {
  delete (globalThis as any).ResizeObserver;
  delete (globalThis as any).PointerEvent;
});

function node(
  id: string,
  kind: JourneyNode["kind"],
  step: number,
  users: number,
): JourneyNode {
  return {
    id,
    name: id,
    kind,
    step,
    users,
    continuing: users / 2,
    median_ms_from_previous: null,
  };
}

// MainActivity leads to ProductActivity and SettingsActivity, and
// ProductActivity on to add_to_cart.
const journey: Journey = {
  sample_percent: 100,
  nodes: [
    node("sh.measure.demo.MainActivity", "screen", 0, 1_000),
    node("sh.measure.demo.ProductActivity", "screen", 1, 600),
    node("sh.measure.demo.SettingsActivity", "screen", 1, 100),
    node("add_to_cart", "event", 2, 300),
  ],
  links: [
    {
      source: "sh.measure.demo.MainActivity",
      target: "sh.measure.demo.ProductActivity",
      users: 600,
    },
    {
      source: "sh.measure.demo.MainActivity",
      target: "sh.measure.demo.SettingsActivity",
      users: 100,
    },
    {
      source: "sh.measure.demo.ProductActivity",
      target: "add_to_cart",
      users: 300,
    },
  ],
};

const onSelect = jest.fn();

function renderGraph(
  props: {
    journey?: Journey;
    selection?: JourneySelection | null;
    selectable?: boolean;
  } = {},
) {
  return render(
    <JourneyGraph
      journey={props.journey ?? journey}
      selection={props.selection ?? null}
      onSelect={props.selectable === false ? undefined : onSelect}
    />,
  );
}

// A tooltip shows the node's name too, so this looks only at the SVG text.
const nodeGroup = (shortName: string) =>
  screen
    .getAllByText(shortName)
    .find((el) => el.tagName === "text")!
    .closest("g")!;

// Each link draws a visible path with an arrow and an invisible, wider path
// that takes the pointer, both along the curve the layout gives the link.
function linkPaths(container: HTMLElement, source: string, target: string) {
  const { boxes } = layOut(journey);
  const d = linkPath(boxes.get(source)!, boxes.get(target)!);
  const [visible, hit] = container.querySelectorAll(`path[d="${d}"]`);
  return { visible, hit };
}

// A node's step numbers or plus are its only centred text.
const badgeOf = (shortName: string) =>
  nodeGroup(shortName).querySelector('text[text-anchor="middle"]')?.textContent;

const transformOf = (container: HTMLElement) =>
  container.querySelector("svg > g")!.getAttribute("transform");

// The canvas is the element that holds the graph's svg, between the toolbar
// and the footer. The toolbar's icons are svgs too, so the graph's svg is
// found by its class.
const canvasOf = (container: HTMLElement) =>
  container.querySelector("svg.block")!.parentElement!;

describe("JourneyGraph", () => {
  beforeEach(() => {
    onSelect.mockReset();
  });

  it("draws each node with its short name and users", () => {
    renderGraph();

    expect(screen.getByText("MainActivity")).toBeInTheDocument();
    expect(screen.getByText("1K users")).toBeInTheDocument();
    expect(screen.getByText("add_to_cart")).toBeInTheDocument();
    expect(screen.getByText("300 users")).toBeInTheDocument();
  });

  it("shortens long names to fit the node", () => {
    renderGraph({
      journey: {
        sample_percent: 100,
        nodes: [node("checkout_payment_method_selected", "event", 0, 10)],
        links: [],
      },
    });

    expect(screen.getByText("checkout_payment_me…")).toBeInTheDocument();
  });

  it("draws an arrow for each link between nodes it has", () => {
    const { container } = renderGraph({
      journey: {
        ...journey,
        links: [
          ...journey.links,
          { source: "add_to_cart", target: "missing", users: 5 },
        ],
      },
    });

    const arrows = container.querySelectorAll(
      'path[marker-end="url(#journey-arrow-default)"]',
    );
    expect(arrows).toHaveLength(journey.links.length);
  });

  it("draws busier links thicker", () => {
    const { container } = renderGraph();
    const busy = linkPaths(
      container,
      "sh.measure.demo.MainActivity",
      "sh.measure.demo.ProductActivity",
    ).visible;
    const quiet = linkPaths(
      container,
      "sh.measure.demo.MainActivity",
      "sh.measure.demo.SettingsActivity",
    ).visible;

    expect(Number(busy.getAttribute("stroke-width"))).toBeGreaterThan(
      Number(quiet.getAttribute("stroke-width")),
    );
  });

  it("shows a legend of only the kinds of node it has", () => {
    renderGraph();

    expect(screen.getByText("Screen")).toBeInTheDocument();
    expect(screen.getByText("Custom event")).toBeInTheDocument();
    expect(screen.queryByText("Fatal error")).toBeNull();
  });

  describe("selecting", () => {
    it("selects a clicked node", () => {
      renderGraph();
      fireEvent.click(nodeGroup("ProductActivity"));

      expect(onSelect).toHaveBeenCalledWith({
        node: "sh.measure.demo.ProductActivity",
      });
    });

    it("clears the selection when the selected node is clicked", () => {
      renderGraph({ selection: { node: "sh.measure.demo.ProductActivity" } });
      fireEvent.click(nodeGroup("ProductActivity"));

      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it("selects a clicked link", () => {
      const { container } = renderGraph();
      fireEvent.click(
        linkPaths(container, "sh.measure.demo.ProductActivity", "add_to_cart")
          .hit,
      );

      expect(onSelect).toHaveBeenCalledWith({
        source: "sh.measure.demo.ProductActivity",
        target: "add_to_cart",
      });
    });

    it("clears a selected node from the toolbar", () => {
      renderGraph({ selection: { node: "sh.measure.demo.ProductActivity" } });
      fireEvent.click(screen.getByLabelText("Clear selection"));

      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it("offers the clear button only while something is selected", () => {
      renderGraph();

      expect(screen.queryByLabelText("Clear selection")).toBeNull();
    });

    it("keeps a selected node and its neighbours clear and dims the rest", () => {
      renderGraph({ selection: { node: "sh.measure.demo.ProductActivity" } });

      expect(nodeGroup("ProductActivity")).toHaveAttribute("opacity", "1");
      expect(nodeGroup("MainActivity")).toHaveAttribute("opacity", "0.85");
      expect(nodeGroup("add_to_cart")).toHaveAttribute("opacity", "0.85");
      expect(nodeGroup("SettingsActivity")).toHaveAttribute("opacity", "0.12");
    });

    it("draws a selected link in blue and dims the links off its path", () => {
      const { container } = renderGraph({
        selection: {
          source: "sh.measure.demo.ProductActivity",
          target: "add_to_cart",
        },
      });
      const selected = linkPaths(
        container,
        "sh.measure.demo.ProductActivity",
        "add_to_cart",
      ).visible;
      const other = linkPaths(
        container,
        "sh.measure.demo.MainActivity",
        "sh.measure.demo.SettingsActivity",
      ).visible;

      expect(selected).toHaveAttribute("stroke", useChartColor().blue);
      expect(selected).toHaveAttribute(
        "marker-end",
        "url(#journey-arrow-selected)",
      );
      expect(other).toHaveAttribute("marker-end", "url(#journey-arrow-dimmed)");
      expect(nodeGroup("SettingsActivity")).toHaveAttribute("opacity", "0.12");
    });

    it("adds a shift-clicked node that a link from the selected node leads to", () => {
      renderGraph({ selection: { node: "sh.measure.demo.MainActivity" } });
      fireEvent.click(nodeGroup("ProductActivity"), { shiftKey: true });

      expect(onSelect).toHaveBeenCalledWith({
        path: [
          "sh.measure.demo.MainActivity",
          "sh.measure.demo.ProductActivity",
        ],
      });
    });

    it("ignores a shift-click on a node without a link from the selection's last node", () => {
      renderGraph({ selection: { node: "sh.measure.demo.MainActivity" } });
      fireEvent.click(nodeGroup("add_to_cart"), { shiftKey: true });

      expect(onSelect).not.toHaveBeenCalled();
    });

    it("clears a path when any node is clicked without shift", () => {
      renderGraph({
        selection: {
          path: [
            "sh.measure.demo.MainActivity",
            "sh.measure.demo.ProductActivity",
          ],
        },
      });
      fireEvent.click(nodeGroup("ProductActivity"));
      fireEvent.click(nodeGroup("SettingsActivity"));

      expect(onSelect).toHaveBeenNthCalledWith(1, null);
      expect(onSelect).toHaveBeenNthCalledWith(2, null);
    });

    it("adds a node to the path when its plus is clicked", () => {
      renderGraph({
        selection: {
          path: [
            "sh.measure.demo.MainActivity",
            "sh.measure.demo.ProductActivity",
          ],
        },
      });
      fireEvent.click(screen.getByLabelText("Add add_to_cart to the path"));

      expect(onSelect).toHaveBeenCalledTimes(1);
      expect(onSelect).toHaveBeenCalledWith({
        path: [
          "sh.measure.demo.MainActivity",
          "sh.measure.demo.ProductActivity",
          "add_to_cart",
        ],
      });
    });

    it("marks the nodes a shift-click can add with a plus", () => {
      renderGraph({ selection: { node: "sh.measure.demo.MainActivity" } });

      expect(badgeOf("ProductActivity")).toBe("+");
      expect(badgeOf("SettingsActivity")).toBe("+");
      expect(badgeOf("MainActivity")).toBeUndefined();
      expect(badgeOf("add_to_cart")).toBeUndefined();
    });

    it("numbers a path's nodes and draws the links between them as selected", () => {
      const { container } = renderGraph({
        selection: {
          path: [
            "sh.measure.demo.MainActivity",
            "sh.measure.demo.ProductActivity",
            "add_to_cart",
          ],
        },
      });

      expect(badgeOf("MainActivity")).toBe("1");
      expect(badgeOf("ProductActivity")).toBe("2");
      expect(badgeOf("add_to_cart")).toBe("3");
      expect(badgeOf("SettingsActivity")).toBeUndefined();
      expect(nodeGroup("add_to_cart")).toHaveAttribute("opacity", "1");
      expect(nodeGroup("SettingsActivity")).toHaveAttribute("opacity", "0.12");
      expect(
        linkPaths(container, "sh.measure.demo.ProductActivity", "add_to_cart")
          .visible,
      ).toHaveAttribute("marker-end", "url(#journey-arrow-selected)");
      expect(
        linkPaths(
          container,
          "sh.measure.demo.MainActivity",
          "sh.measure.demo.SettingsActivity",
        ).visible,
      ).toHaveAttribute("marker-end", "url(#journey-arrow-dimmed)");
    });

    it("clears a selected path from the toolbar", () => {
      renderGraph({
        selection: {
          path: [
            "sh.measure.demo.MainActivity",
            "sh.measure.demo.ProductActivity",
          ],
        },
      });

      fireEvent.click(screen.getByLabelText("Clear selection"));

      expect(onSelect).toHaveBeenCalledWith(null);
    });

    it("offers no clear button and ignores clicks without onSelect", () => {
      renderGraph({
        selection: { node: "sh.measure.demo.ProductActivity" },
        selectable: false,
      });
      fireEvent.click(nodeGroup("ProductActivity"));

      expect(screen.queryByLabelText("Clear selection")).toBeNull();
      expect(nodeGroup("ProductActivity")).not.toHaveClass("cursor-pointer");
      expect(screen.queryByText("Shift")).toBeNull();
    });
  });

  describe("tooltips", () => {
    it("shows a node's stats and what a click does while it is hovered", async () => {
      renderGraph();
      fireEvent.pointerEnter(nodeGroup("ProductActivity"));

      const tooltip = screen.getByText("Continuing").closest("div.fixed")!;
      expect(tooltip.parentElement).toBe(document.body);
      expect(tooltip).toHaveTextContent("Users600");
      expect(tooltip).toHaveTextContent(
        "Click to highlight paths and see details",
      );

      fireEvent.pointerLeave(nodeGroup("ProductActivity"));

      await waitFor(() => expect(screen.queryByText("Continuing")).toBeNull());
    });

    it("says a shift-click adds a node that a link from the selection leads to", () => {
      renderGraph({ selection: { node: "sh.measure.demo.MainActivity" } });
      fireEvent.pointerEnter(nodeGroup("ProductActivity"));

      expect(
        screen.getByText(
          "Click to highlight paths and see details. Click the plus or shift-click to add it to the current path",
        ),
      ).toBeInTheDocument();
    });

    it("says a click clears the selection on the selected node", () => {
      renderGraph({ selection: { node: "sh.measure.demo.ProductActivity" } });
      fireEvent.pointerEnter(nodeGroup("ProductActivity"));

      expect(
        screen.getByText("Click to clear the selection"),
      ).toBeInTheDocument();
    });

    it("says a click clears the selection on any node during a path", () => {
      renderGraph({
        selection: {
          path: [
            "sh.measure.demo.MainActivity",
            "sh.measure.demo.ProductActivity",
          ],
        },
      });
      fireEvent.pointerEnter(nodeGroup("SettingsActivity"));

      expect(
        screen.getByText("Click to clear the selection"),
      ).toBeInTheDocument();
    });

    it("shows a link's users and conversion while it is hovered", () => {
      const { container } = renderGraph();
      fireEvent.pointerEnter(
        linkPaths(container, "sh.measure.demo.ProductActivity", "add_to_cart")
          .hit,
      );

      expect(
        screen.getByText("ProductActivity → add_to_cart"),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Conversion from ProductActivity").nextSibling,
      ).toHaveTextContent("50%");
      expect(screen.getByText("Click to see details")).toBeInTheDocument();
    });

    it("leaves out the click hint without onSelect", () => {
      renderGraph({ selectable: false });
      fireEvent.pointerEnter(nodeGroup("ProductActivity"));

      expect(screen.getByText("Continuing")).toBeInTheDocument();
      expect(screen.queryByText(/^Click to/)).toBeNull();
    });

    it("hides the tooltip when the pointer leaves the graph", async () => {
      const { container } = renderGraph();
      fireEvent.pointerEnter(nodeGroup("ProductActivity"));
      fireEvent.pointerLeave(canvasOf(container));

      await waitFor(() => expect(screen.queryByText("Continuing")).toBeNull());
    });
  });

  describe("touch", () => {
    // A touch pointer leaves the pressed element on finger lift, before the
    // click.
    const tap = (target: Element) => {
      pointerDown(target, "touch");
      pointerLeave(target, "touch");
      fireEvent.click(target);
    };

    it("shows a node tooltip on the first tap, then selects the node and hides the tooltip on the second", async () => {
      renderGraph();

      tap(nodeGroup("ProductActivity"));
      expect(screen.getByText("Continuing")).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();

      tap(nodeGroup("ProductActivity"));
      expect(onSelect).toHaveBeenCalledWith({
        node: "sh.measure.demo.ProductActivity",
      });
      await waitFor(() => expect(screen.queryByText("Continuing")).toBeNull());
    });

    it("shows a link tooltip on the first tap, then selects the link and hides the tooltip on the second", async () => {
      const { container } = renderGraph();
      const link = linkPaths(
        container,
        "sh.measure.demo.ProductActivity",
        "add_to_cart",
      ).hit;

      tap(link);
      expect(
        screen.getByText("ProductActivity → add_to_cart"),
      ).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();

      tap(link);
      expect(onSelect).toHaveBeenCalledWith({
        source: "sh.measure.demo.ProductActivity",
        target: "add_to_cart",
      });
      await waitFor(() =>
        expect(screen.queryByText("ProductActivity → add_to_cart")).toBeNull(),
      );
    });

    it("hides the tooltip on a tap elsewhere, then shows it on the next node tap without selecting the node", async () => {
      const { container } = renderGraph();

      tap(nodeGroup("ProductActivity"));
      tap(canvasOf(container));
      await waitFor(() => expect(screen.queryByText("Continuing")).toBeNull());

      tap(nodeGroup("ProductActivity"));
      expect(screen.getByText("Continuing")).toBeInTheDocument();
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("hides a tapped link tooltip when the journey changes", async () => {
      const { container, rerender } = renderGraph();
      tap(
        linkPaths(container, "sh.measure.demo.ProductActivity", "add_to_cart")
          .hit,
      );
      expect(
        screen.getByText("ProductActivity → add_to_cart"),
      ).toBeInTheDocument();

      const withoutProduct: Journey = {
        ...journey,
        nodes: journey.nodes.filter(
          (n) => n.id !== "sh.measure.demo.ProductActivity",
        ),
        links: journey.links.filter(
          (l) =>
            l.source !== "sh.measure.demo.ProductActivity" &&
            l.target !== "sh.measure.demo.ProductActivity",
        ),
      };
      rerender(
        <JourneyGraph
          journey={withoutProduct}
          selection={null}
          onSelect={onSelect}
        />,
      );

      await waitFor(() =>
        expect(screen.queryByText("ProductActivity → add_to_cart")).toBeNull(),
      );
    });

    it("keeps a node tooltip open when a mouse click selects the node", () => {
      renderGraph();
      fireEvent.pointerEnter(nodeGroup("ProductActivity"));
      pointerDown(nodeGroup("ProductActivity"), "mouse");
      fireEvent.click(nodeGroup("ProductActivity"));

      expect(onSelect).toHaveBeenCalledWith({
        node: "sh.measure.demo.ProductActivity",
      });
      expect(screen.getByText("Continuing")).toBeInTheDocument();
    });

    it.each([
      [
        "the zoom in button",
        () => screen.getByRole("button", { name: "Zoom in" }),
      ],
      ["the page", () => document.body],
    ])("hides the tooltip when tapping %s", async (_, target) => {
      renderGraph();

      tap(nodeGroup("ProductActivity"));
      expect(screen.getByText("Continuing")).toBeInTheDocument();

      pointerDown(target(), "touch");
      await waitFor(() => expect(screen.queryByText("Continuing")).toBeNull());
    });
  });

  describe("panning and zooming", () => {
    it("shows a placeholder in place of the nodes and keeps the toolbar", () => {
      const { container } = render(
        <JourneyGraph
          journey={journey}
          onSelect={onSelect}
          toolbarStart={<button>Node picker</button>}
          placeholder={<p>Loading the journey</p>}
        />,
      );

      expect(screen.getByText("Loading the journey")).toBeInTheDocument();
      expect(container.querySelector("svg.block")).toBeNull();
      expect(screen.getByLabelText("Zoom in")).toBeInTheDocument();
      expect(
        screen.getByRole("button", { name: "Node picker" }),
      ).toBeInTheDocument();
    });

    it("shows the summary before the gestures in the footer", () => {
      render(<JourneyGraph journey={journey} summary={["3 of 4 nodes"]} />);

      const summary = screen.getByText("3 of 4 nodes");
      expect(summary.closest("p")).toHaveTextContent(
        /^3 of 4 nodes·Drag pan·Ctrl\+Scroll zoom$/,
      );
    });

    it("shows the end controls before the zoom buttons", () => {
      render(
        <JourneyGraph
          journey={journey}
          toolbarEnd={<button>Sample control</button>}
        />,
      );

      const sample = screen.getByRole("button", { name: "Sample control" });
      expect(sample.nextElementSibling).toBe(screen.getByLabelText("Zoom in"));
    });

    it("zooms in and out around the centre and fits the graph again", () => {
      const { container } = renderGraph();
      const fitted = transformOf(container);
      const scale = () =>
        Number(transformOf(container)!.match(/scale\(([\d.]+)\)/)![1]);
      const fittedScale = scale();

      fireEvent.click(screen.getByLabelText("Zoom in"));
      expect(scale()).toBeCloseTo(fittedScale * 1.25);

      fireEvent.click(screen.getByLabelText("Zoom out"));
      fireEvent.click(screen.getByLabelText("Zoom out"));
      expect(scale()).toBeCloseTo(fittedScale * 0.8);

      fireEvent.click(screen.getByLabelText("Fit to view"));
      expect(transformOf(container)).toBe(fitted);
    });

    it("zooms on a pinch or ctrl + scroll and leaves plain scrolling to the page", () => {
      const { container } = renderGraph();
      const graph = canvasOf(container);
      const fitted = transformOf(container);

      const plain = new WheelEvent("wheel", {
        deltaY: -100,
        cancelable: true,
      });
      act(() => {
        graph.dispatchEvent(plain);
      });
      expect(plain.defaultPrevented).toBe(false);
      expect(transformOf(container)).toBe(fitted);

      const pinch = new WheelEvent("wheel", {
        deltaY: -100,
        ctrlKey: true,
        cancelable: true,
      });
      act(() => {
        graph.dispatchEvent(pinch);
      });
      expect(pinch.defaultPrevented).toBe(true);
      expect(transformOf(container)).not.toBe(fitted);
    });

    it("pans on a drag without selecting what the drag ends on", () => {
      const { container } = renderGraph();
      const graph = canvasOf(container);
      const fitted = transformOf(container);

      fireEvent.pointerDown(graph, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(graph, { buttons: 1, clientX: 160, clientY: 130 });
      fireEvent.pointerUp(graph, { clientX: 160, clientY: 130 });
      fireEvent.click(nodeGroup("ProductActivity"));

      expect(transformOf(container)).not.toBe(fitted);
      expect(onSelect).not.toHaveBeenCalled();
    });

    it("treats a press that barely moves as a click", () => {
      const { container } = renderGraph();
      const graph = canvasOf(container);
      const fitted = transformOf(container);

      fireEvent.pointerDown(graph, { button: 0, clientX: 100, clientY: 100 });
      fireEvent.pointerMove(graph, { buttons: 1, clientX: 102, clientY: 101 });
      fireEvent.pointerUp(graph, { clientX: 102, clientY: 101 });
      fireEvent.click(nodeGroup("ProductActivity"));

      expect(transformOf(container)).toBe(fitted);
      expect(onSelect).toHaveBeenCalledTimes(1);
    });

    it("fits a new journey even after the view was moved", () => {
      const { container, rerender } = renderGraph();
      const fitted = transformOf(container);
      fireEvent.click(screen.getByLabelText("Zoom in"));

      rerender(<JourneyGraph journey={{ ...journey }} onSelect={onSelect} />);

      expect(transformOf(container)).toBe(fitted);
    });
  });
});

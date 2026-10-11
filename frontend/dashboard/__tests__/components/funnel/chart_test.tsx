import type { FunnelConversion } from "@/app/api/api_calls";
import FunnelChart from "@/app/components/funnel/chart";
import { useChartColors } from "@/app/utils/chart_utils";
import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, renderHook, screen } from "@testing-library/react";

let lastFunnelProps: any = null;

jest.mock("@nivo/funnel", () => ({
  ResponsiveFunnel: (props: any) => {
    lastFunnelProps = props;
    return <div data-testid="funnel-mock" />;
  },
}));

// jsdom has no canvas, so the mocked context measures every character as 7px
// wide.
const CHAR_WIDTH = 7;
const LABEL_PADDING = 6;

function labelWidth(label: string): number {
  return label.length * CHAR_WIDTH + 2 * LABEL_PADDING;
}

beforeAll(() => {
  const context = {
    font: "",
    measureText: (text: string) => ({ width: text.length * CHAR_WIDTH }),
  };
  jest
    .spyOn(HTMLCanvasElement.prototype, "getContext")
    .mockReturnValue(context as unknown as CanvasRenderingContext2D);
});

beforeEach(() => {
  lastFunnelProps = null;
});

const conversion: FunnelConversion = {
  steps: [
    { event_name: "app_open", users: 2000, median_seconds_from_previous: null },
    { event_name: "add_to_cart", users: 500, median_seconds_from_previous: 90 },
    { event_name: "add_to_cart", users: 499, median_seconds_from_previous: 5 },
    { event_name: "purchase", users: 499, median_seconds_from_previous: null },
  ],
};

function renderChart(onSelectStep = jest.fn()) {
  render(<FunnelChart conversion={conversion} onSelectStep={onSelectStep} />);
  return onSelectStep;
}

function renderTooltip(index: number, color = "#38bdf8") {
  renderChart();
  const Tooltip = lastFunnelProps.tooltip;
  return render(<Tooltip part={{ data: { id: index }, color }} />);
}

function rowValue(label: string): string | null {
  return screen.getByText(label).nextElementSibling!.textContent;
}

type Part = {
  data: { id: number };
  formattedValue: string;
  width: number;
  height: number;
  x: number;
  y: number;
  labelColor: string;
};

function partOf(
  id: number,
  formattedValue: string,
  width: number,
  height: number,
): Part {
  return {
    data: { id },
    formattedValue,
    width,
    height,
    x: 100 * id + 50,
    y: 120,
    labelColor: `#00000${id}`,
  };
}

function renderPartLabels(parts: Part[]) {
  renderChart();
  const PartLabels = lastFunnelProps.layers.find(
    (layer: unknown) => typeof layer === "function",
  );
  const { container } = render(
    <svg>
      <PartLabels parts={parts} />
    </svg>,
  );
  return [...container.querySelectorAll("text")].map((text) => ({
    label: text.textContent,
    transform: text.getAttribute("transform"),
    fill: text.style.fill,
  }));
}

describe("FunnelChart", () => {
  describe("data", () => {
    it("keys each part by its position so repeated event names stay separate parts", () => {
      renderChart();
      expect(lastFunnelProps.data).toEqual([
        { id: 0, label: "app_open", value: 2000 },
        { id: 1, label: "add_to_cart", value: 500 },
        { id: 2, label: "add_to_cart", value: 499 },
        { id: 3, label: "purchase", value: 499 },
      ]);
    });

    it("colors each part with its step color", () => {
      const colors = renderHook(() => useChartColors()).result.current;
      renderChart();
      expect(
        lastFunnelProps.data.map((datum: { id: number }) =>
          lastFunnelProps.colors(datum),
        ),
      ).toEqual([colors[0], colors[1], colors[2], colors[3]]);
    });

    it("abbreviates the user counts drawn on the parts", () => {
      renderChart();
      expect(lastFunnelProps.valueFormat(1500)).toBe("1.5K");
      expect(lastFunnelProps.valueFormat(999)).toBe("999");
    });
  });

  describe("selecting a step", () => {
    it("selects a step after the first when its part is clicked", () => {
      const onSelectStep = renderChart();
      lastFunnelProps.onClick({ data: { id: 1 } });
      expect(onSelectStep).toHaveBeenCalledTimes(1);
      expect(onSelectStep).toHaveBeenCalledWith(1);
    });

    it("does nothing when the first step's part is clicked", () => {
      const onSelectStep = renderChart();
      lastFunnelProps.onClick({ data: { id: 0 } });
      expect(onSelectStep).not.toHaveBeenCalled();
    });
  });

  describe("step tooltip", () => {
    it("shows the step's event name and color", () => {
      const { container } = renderTooltip(1, "#fbbf24");
      expect(screen.getByText("add_to_cart")).toBeInTheDocument();
      const swatch = container.querySelector(".rounded-full") as HTMLElement;
      expect(swatch.style.backgroundColor).toBe("rgb(251, 191, 36)");
    });

    it("shows only users and conversion from start for the first step", () => {
      renderTooltip(0);
      expect(rowValue("Users")).toBe((2000).toLocaleString());
      expect(rowValue("Conversion from start")).toBe("100%");
      expect(
        screen.queryByText("Conversion from previous step"),
      ).not.toBeInTheDocument();
      expect(screen.queryByText("Dropped")).not.toBeInTheDocument();
      expect(screen.queryByText("Median time")).not.toBeInTheDocument();
    });

    it("compares a later step with the start and the previous step", () => {
      renderTooltip(1);
      expect(rowValue("Users")).toBe("500");
      expect(rowValue("Conversion from start")).toBe("25%");
      expect(rowValue("Conversion from previous step")).toBe("25%");
      expect(rowValue("Dropped")).toBe((1500).toLocaleString());
      expect(rowValue("Median time")).toBe("1m 30s");
    });

    it("compares with the step just before, not the first step", () => {
      renderTooltip(2);
      expect(rowValue("Conversion from start")).toBe("25%");
      expect(rowValue("Conversion from previous step")).toBe(">99%");
      expect(rowValue("Dropped")).toBe("1");
      expect(rowValue("Median time")).toBe("5s");
    });

    it("shows zero dropped and leaves out the median time when it is missing", () => {
      renderTooltip(3);
      expect(rowValue("Conversion from previous step")).toBe("100%");
      expect(rowValue("Dropped")).toBe("0");
      expect(screen.queryByText("Median time")).not.toBeInTheDocument();
    });
  });

  describe("part labels", () => {
    it("writes every count across its part when every part is wide enough", () => {
      const labels = renderPartLabels([
        partOf(0, "2K", 200, 10),
        partOf(1, "500", 200, 10),
      ]);
      expect(labels).toEqual([
        { label: "2K", transform: "translate(50, 120)", fill: "#000000" },
        { label: "500", transform: "translate(150, 120)", fill: "#000001" },
      ]);
    });

    it("writes a count across when its part is as wide as the label", () => {
      const labels = renderPartLabels([partOf(0, "500", labelWidth("500"), 0)]);
      expect(labels.map((l) => l.transform)).toEqual(["translate(50, 120)"]);
    });

    it("rotates every count when any part is too narrow for its count", () => {
      const labels = renderPartLabels([
        partOf(0, "2K", 200, 200),
        partOf(1, "500", labelWidth("500") - 1, 200),
      ]);
      expect(labels.map((l) => l.transform)).toEqual([
        "translate(50, 120) rotate(-90)",
        "translate(150, 120) rotate(-90)",
      ]);
    });

    it("leaves out a rotated count that is too long for its part's height", () => {
      const labels = renderPartLabels([
        partOf(0, "2K", 200, labelWidth("2K")),
        partOf(1, "500", 10, labelWidth("500") - 1),
        partOf(2, "499", 10, 200),
      ]);
      expect(labels.map((l) => l.label)).toEqual(["2K", "499"]);
      expect(labels.every((l) => l.transform!.endsWith("rotate(-90)"))).toBe(
        true,
      );
    });
  });
});

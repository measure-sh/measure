import TimeSeriesPlot, {
  formatCount,
  formatCountWithShare,
  formatDurationTick,
} from "@/app/components/time_series_plot";
import { numberToKMB } from "@/app/utils/number_utils";
import "@testing-library/jest-dom";
import { render } from "@testing-library/react";

let lastLineProps: any = null;

jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    lastLineProps = props;
    return <div data-testid="line-mock" />;
  },
}));

jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));

const data = [
  { id: "1.0.0", data: [{ x: "2026-02-01T01:00:00", y: 3 }] },
  { id: "2.0.0", data: [{ x: "2026-02-01T01:00:00", y: 1 }] },
];

function renderPlot(props: Partial<Parameters<typeof TimeSeriesPlot>[0]>) {
  render(
    <TimeSeriesPlot
      data={data}
      plotTimeGroup="minutes"
      formatTick={numberToKMB}
      formatTooltip={(seriesId, datum) => `${seriesId} - ${datum.y}`}
      {...props}
    />,
  );
}

describe("TimeSeriesPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("spans the x axis over the selected range", () => {
    renderPlot({
      startDate: "2026-02-01T00:00:00Z",
      endDate: "2026-02-01T06:00:00Z",
    });
    expect(lastLineProps.xScale.min).toEqual(new Date("2026-02-01T00:00:00Z"));
    expect(lastLineProps.xScale.max).toEqual(new Date("2026-02-01T06:00:00Z"));
  });

  it("spans the x axis over the data when the range is missing", () => {
    renderPlot({ startDate: "", endDate: undefined });
    expect(lastLineProps.xScale.min).toBe("auto");
    expect(lastLineProps.xScale.max).toBe("auto");
  });

  it("labels time ticks with the time within a day and the date at midnight", () => {
    renderPlot({ plotTimeGroup: "minutes" });
    const format = lastLineProps.axisBottom.format;
    expect(format(new Date(2026, 1, 1, 9, 30))).toBe("09:30");
    expect(format(new Date(2026, 1, 2, 0, 0))).toBe("Feb 02");
  });

  it("labels time ticks with the month for month-grouped ranges", () => {
    renderPlot({ plotTimeGroup: "months" });
    expect(lastLineProps.axisBottom.format(new Date(2026, 0, 1))).toBe(
      "Jan 2026",
    );
  });

  it("hides fractional value ticks for counts", () => {
    renderPlot({ integerTicks: true });
    expect(lastLineProps.axisLeft.format(0.5)).toBe("");
    expect(lastLineProps.axisLeft.format(1500)).toBe("1.5K");
  });

  it("puts a count tick on every whole number below a peak of 5", () => {
    renderPlot({
      data: [{ id: "1.0.0", data: [{ x: "2026-02-01T01:00:00", y: 2 }] }],
      integerTicks: true,
    });
    expect(lastLineProps.axisLeft.tickValues).toEqual([0, 1, 2]);
  });

  it("lets the axis pick count ticks from a peak of 5", () => {
    renderPlot({
      data: [{ id: "1.0.0", data: [{ x: "2026-02-01T01:00:00", y: 5 }] }],
      integerTicks: true,
    });
    expect(lastLineProps.axisLeft.tickValues).toBe(5);
  });

  it("formats value ticks with the caller's formatter", () => {
    renderPlot({ formatTick: (value) => `${value} ms` });
    expect(lastLineProps.axisLeft.format(0.5)).toBe("0.5 ms");
  });

  it("adds axis titles only when given", () => {
    renderPlot({ xAxisTitle: "Date", yAxisTitle: "Requests" });
    expect(lastLineProps.axisBottom.legend).toBe("Date");
    expect(lastLineProps.axisLeft.legend).toBe("Requests");
    const marginWithTitles = lastLineProps.margin;

    renderPlot({});
    expect(lastLineProps.axisLeft.legend).toBeUndefined();
    expect(lastLineProps.margin.left).toBeLessThan(marginWithTitles.left);
    expect(lastLineProps.margin.bottom).toBeLessThan(marginWithTitles.bottom);
  });

  it("rotates date labels and makes room for them below the axis", () => {
    renderPlot({ xAxisTitle: "Date" });
    const flatBottom = lastLineProps.margin.bottom;

    renderPlot({ xAxisTitle: "Date", xTickRotation: 60 });
    expect(lastLineProps.axisBottom.tickRotation).toBe(60);
    expect(lastLineProps.margin.bottom).toBeGreaterThan(flatBottom);
  });

  it("colors series with the caller's mapping", () => {
    renderPlot({ colors: (id) => (id === "1.0.0" ? "#f00" : "#888") });
    expect(lastLineProps.colors({ id: "1.0.0" })).toBe("#f00");
    expect(lastLineProps.colors({ id: "other" })).toBe("#888");
  });

  it("shows the hovered series and the date in the tooltip", () => {
    renderPlot({});
    const { container } = render(
      lastLineProps.tooltip({
        point: {
          seriesId: "1.0.0",
          seriesColor: "#111",
          data: { xFormatted: "2026-02-01T01:00:00", y: 3 },
        },
      }),
    );
    expect(container.textContent).toContain("1.0.0 - 3");
    expect(container.textContent).not.toContain("2.0.0");
    expect(container.textContent).toContain("Date:");
  });
});

describe("TimeSeriesPlot tooltip with every series", () => {
  it("lists every series with a value at the hovered date", () => {
    renderPlot({
      data: [
        { id: "2xx", data: [{ x: "2026-02-01T01:00:00", y: 90 }] },
        { id: "4xx", data: [{ x: "2026-02-01T01:00:00", y: 10 }] },
        { id: "5xx", data: [{ x: "2026-02-01T01:00:00", y: null }] },
      ],
      showAllSeriesInTooltip: true,
    });
    const hovered = lastLineProps.data[0].data[0];
    const { container } = render(
      lastLineProps.tooltip({
        point: {
          seriesId: "2xx",
          seriesColor: "#111",
          data: { ...hovered, xFormatted: "2026-02-01T01:00:00" },
        },
      }),
    );
    expect(container.textContent).toContain("2xx - 90");
    expect(container.textContent).toContain("4xx - 10");
    expect(container.textContent).not.toContain("5xx");
  });

  it("fades the rows of the series that are not hovered", () => {
    renderPlot({
      data: [
        { id: "2xx", data: [{ x: "2026-02-01T01:00:00", y: 90 }] },
        { id: "4xx", data: [{ x: "2026-02-01T01:00:00", y: 10 }] },
      ],
      showAllSeriesInTooltip: true,
    });
    const hovered = lastLineProps.data[1].data[0];
    const { getByText } = render(
      lastLineProps.tooltip({
        point: {
          seriesId: "4xx",
          seriesColor: "#111",
          data: { ...hovered, xFormatted: "2026-02-01T01:00:00" },
        },
      }),
    );
    expect(getByText("2xx - 90").parentElement).toHaveClass("opacity-20");
    expect(getByText("4xx - 10").parentElement).not.toHaveClass("opacity-20");
  });
});

describe("TimeSeriesPlot tooltip total", () => {
  function renderTooltip() {
    const { container } = render(
      lastLineProps.tooltip({
        point: {
          seriesId: "1.0.0",
          seriesColor: "#111",
          data: { xFormatted: "2026-02-01T01:00:00", y: 3, total_count: 1200 },
        },
      }),
    );
    return container.textContent;
  }

  it("shows the total when the chart gives one", () => {
    renderPlot({ tooltipTotal: () => 1200 });
    expect(renderTooltip()).toContain("Total: 1,200");
  });

  it("leaves out the total otherwise", () => {
    renderPlot({});
    expect(renderTooltip()).not.toContain("Total:");
  });
});

describe("TimeSeriesPlot layer", () => {
  function drawWith(values: (number | null)[]) {
    renderPlot({});
    const arcs: number[] = [];
    const ctx = {
      save: jest.fn(),
      restore: jest.fn(),
      beginPath: jest.fn(),
      moveTo: jest.fn(),
      lineTo: jest.fn(),
      stroke: jest.fn(),
      fill: jest.fn(),
      setLineDash: jest.fn(),
      arc: (x: number) => arcs.push(x),
    };
    const lineGenerator = Object.assign(jest.fn(), { context: jest.fn() });
    const scale = Object.assign((value: number) => value, {
      ticks: () => [],
    });
    lastLineProps.layers[1](ctx, {
      series: [
        {
          id: "1.0.0",
          color: "#111",
          data: values.map((y, index) => ({
            data: { y },
            position: { x: index, y: y ?? 0 },
          })),
        },
      ],
      lineGenerator,
      currentPoint: null,
      xScale: scale,
      yScale: scale,
      innerWidth: 100,
      innerHeight: 100,
    });
    return arcs;
  }

  it("draws a point for each value with no value on either side", () => {
    expect(drawWith([null, 5, null, 7, 8, null, 9])).toEqual([1, 6]);
  });

  it("draws a point for a series with a single value", () => {
    expect(drawWith([4])).toEqual([0]);
  });

  it("draws no points for values joined by a line", () => {
    expect(drawWith([1, 2, 3])).toEqual([]);
  });
});

describe("formatCount", () => {
  it("uses the singular noun only for one", () => {
    expect(formatCount(1, "instance", "instances")).toBe("1 instance");
    expect(formatCount(0, "instance", "instances")).toBe("0 instances");
    expect(formatCount(1200, "instance", "instances")).toBe("1,200 instances");
  });
});

describe("formatCountWithShare", () => {
  it("shows the count with its percentage of the total", () => {
    expect(formatCountWithShare(25, 200)).toBe("25 (12.5%)");
    expect(formatCountWithShare(0, 0)).toBe("0 (0.0%)");
    expect(formatCountWithShare(0, 10000)).toBe("0 (0.0%)");
    expect(formatCountWithShare(3, 10000)).toBe("3 (<0.1%)");
  });
});

describe("formatDurationTick", () => {
  it("keeps fractional milliseconds below a second", () => {
    expect(formatDurationTick(0.5)).toBe("0.5ms");
    expect(formatDurationTick(0.25)).toBe("0.25ms");
    expect(formatDurationTick(2)).toBe("2ms");
    expect(formatDurationTick(250)).toBe("250ms");
  });

  it("formats a second and above like other durations", () => {
    expect(formatDurationTick(1500)).toBe("1.5s");
    expect(formatDurationTick(80000)).toBe("1m 20s");
  });
});

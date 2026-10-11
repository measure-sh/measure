import type { FunnelTrend, FunnelTrendPeriod } from "@/app/api/api_calls";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";

let conversionProps: any = null;
let usersProps: any = null;

jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    const isUsers = props.axisLeft.legend === "Users";
    if (isUsers) {
      usersProps = props;
    } else {
      conversionProps = props;
    }
    return <div data-testid={isUsers ? "users-plot" : "conversion-plot"} />;
  },
}));

let mockResolvedTheme = "light";

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: mockResolvedTheme }),
}));

jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div>,
}));

jest.mock("lucide-react", () => ({
  ...jest.requireActual("lucide-react"),
  CircleCheck: () => <span data-testid="selected-icon" />,
}));

// Popover content renders only once opened, so these stand-ins always render
// it.
jest.mock("@/app/components/popover", () => ({
  Popover: ({ children }: any) => <div>{children}</div>,
  PopoverTrigger: ({ children }: any) => <div>{children}</div>,
  PopoverContent: ({ children }: any) => <div>{children}</div>,
}));

jest.mock("@/app/components/command", () => ({
  Command: ({ children }: any) => <div>{children}</div>,
  CommandInput: () => null,
  CommandEmpty: () => null,
  CommandGroup: ({ children }: any) => <div>{children}</div>,
  CommandItem: ({ children, onSelect }: any) => (
    <div data-testid="command-item" onClick={() => onSelect?.()}>
      {children}
    </div>
  ),
}));

import FunnelTrendPlot, {
  FunnelTrendMetric,
} from "@/app/components/funnel/trend_plot";
import { gridDotPositions } from "@/app/utils/chart_utils";

type TrendPoint = FunnelTrend["points"][number];
type TrendBuild = FunnelTrend["builds"][number];

const FOREGROUND = "#222222";
const MUTED = "#6b6b6b";
const DARK_FOREGROUND = "#fafafa";
const DARK_MUTED = "#a1a1a1";
const STEP_1_COLOR = "#fbbf24";
const STEP_2_COLOR = "#a78bfa";
const INNER_WIDTH = 300;
const INNER_HEIGHT = 200;

function point(
  datetime: string,
  users: number[],
  {
    stepMedians = users.slice(1).map(() => null),
    median = null,
    complete = true,
  }: {
    stepMedians?: (number | null)[];
    median?: number | null;
    complete?: boolean;
  } = {},
): TrendPoint {
  return {
    datetime,
    steps: users.map((count, i) => ({
      users: count,
      median_seconds_from_previous: i === 0 ? null : stepMedians[i - 1],
    })),
    median_seconds_to_convert: median,
    complete,
  };
}

function build(overrides: Partial<TrendBuild> = {}): TrendBuild {
  return {
    version_name: "1.2.0",
    version_code: "120",
    patch_id: null,
    patch_version: null,
    uploaded_at: "2026-01-11T09:00:00",
    ...overrides,
  };
}

function patch(overrides: Partial<TrendBuild> = {}): TrendBuild {
  return build({
    version_name: "",
    version_code: "",
    patch_id: "p-1",
    ...overrides,
  });
}

const eventNames = ["Open", "Cart", "Pay"];

// Three days. The second day has no users past the first step, and the third
// day is still converting.
const points: TrendPoint[] = [
  point("2026-01-10T00:00:00", [1000, 500, 250], {
    stepMedians: [30, 60],
    median: 90,
  }),
  point("2026-01-11T00:00:00", [800, 0, 0]),
  point("2026-01-12T00:00:00", [600, 300, 100], {
    stepMedians: [45, 15],
    median: 60,
    complete: false,
  }),
];

const completePoints = points.map((p) => ({ ...p, complete: true }));

function trendWith(overrides: Partial<FunnelTrend> = {}): FunnelTrend {
  return { event_names: eventNames, points, builds: [], ...overrides };
}

type PlotProps = Parameters<typeof FunnelTrendPlot>[0];

function plotProps(overrides: Partial<PlotProps> = {}): PlotProps {
  return {
    period: "day",
    metric: FunnelTrendMetric.Conversion,
    status: "success",
    trend: trendWith(),
    onSelectPoint: jest.fn(),
    ...overrides,
  };
}

function renderPlot(overrides: Partial<PlotProps> = {}) {
  const props = plotProps(overrides);
  const { rerender } = render(<FunnelTrendPlot {...props} />);
  return {
    rerenderWith: (next: Partial<PlotProps>) =>
      rerender(<FunnelTrendPlot {...props} {...next} />),
  };
}

function seriesValues(lineProps: any) {
  return Object.fromEntries(
    lineProps.data.map((s: any) => [s.id, s.data.map((d: any) => d.y)]),
  );
}

function seriesIds() {
  return conversionProps.data.map((s: any) => s.id);
}

function stepItem(label: string) {
  const item = screen
    .getAllByTestId("command-item")
    .find((el) => el.textContent === label);
  if (!item) {
    throw new Error(`No step item labelled ${label}`);
  }
  return item;
}

function isSelected(label: string) {
  return within(stepItem(label)).queryByTestId("selected-icon") !== null;
}

function renderTooltip(lineProps: any, seriesId: string, index: number) {
  const { container } = render(
    lineProps.tooltip({
      point: {
        seriesId,
        seriesColor: "#123456",
        data: lineProps.data[0].data[index],
      },
    }),
  );
  return container;
}

function tooltipText(lineProps: any, seriesId: string, index: number) {
  return renderTooltip(lineProps, seriesId, index).textContent;
}

function tooltipLines(lineProps: any, seriesId: string, index: number) {
  return Array.from(
    renderTooltip(lineProps, seriesId, index).querySelectorAll("p"),
    (p) => p.textContent,
  );
}

function plotWrapper(testId: string) {
  return screen.getByTestId(testId).parentElement!;
}

const RECT_LEFT = 40;
const RECT_TOP = 30;
const PLOT_HEIGHTS: Record<string, number> = {
  "conversion-plot": 384,
  "users-plot": 176,
};

// jsdom does no layout, so the wrapper gets a mocked size and offset. The
// cursor goes at `share` of the plot width and `y` below the top.
function hoverAt(testId: string, share: number, y: number) {
  const wrapper = plotWrapper(testId);
  const { left, right } = conversionProps.margin;
  wrapper.getBoundingClientRect = () =>
    ({
      left: RECT_LEFT,
      top: RECT_TOP,
      width: left + right + INNER_WIDTH,
      height: PLOT_HEIGHTS[testId],
    }) as DOMRect;
  fireEvent.mouseMove(wrapper, {
    clientX: RECT_LEFT + left + share * INNER_WIDTH,
    clientY: RECT_TOP + y,
  });
}

function fakeCanvas() {
  const calls = {
    rects: [] as { args: number[]; alpha: number }[],
    fillText: [] as { text: string; x: number; y: number }[],
    markers: [] as { from: number[]; to: number[] }[],
    arcs: [] as { x: number; y: number; r: number }[],
    fills: [] as { color: string; alpha: number }[],
    strokes: [] as { color: string; alpha: number; dashed: boolean }[],
    lines: [] as { positions: any[]; dashed: boolean }[],
  };
  let dash: number[] = [];
  let lastMove: number[] = [];
  const ctx: any = {
    globalAlpha: 1,
    save: () => {},
    restore: () => {},
    beginPath: () => {},
    fill: () =>
      calls.fills.push({ color: ctx.fillStyle, alpha: ctx.globalAlpha }),
    moveTo: (x: number, y: number) => {
      lastMove = [x, y];
    },
    lineTo: (x: number, y: number) =>
      calls.markers.push({ from: lastMove, to: [x, y] }),
    arc: (x: number, y: number, r: number) => calls.arcs.push({ x, y, r }),
    fillRect: (...args: number[]) =>
      calls.rects.push({ args, alpha: ctx.globalAlpha }),
    fillText: (text: string, x: number, y: number) =>
      calls.fillText.push({ text, x, y }),
    measureText: (text: string) => ({ width: text.length * 6 }),
    setLineDash: (next: number[]) => {
      dash = next;
    },
    stroke: () =>
      calls.strokes.push({
        color: ctx.strokeStyle,
        alpha: ctx.globalAlpha,
        dashed: dash.length > 0,
      }),
  };
  const lineGenerator = Object.assign(
    (positions: any[]) =>
      calls.lines.push({ positions, dashed: dash.length > 0 }),
    { context: () => {} },
  );
  return { ctx, calls, lineGenerator };
}

// Maps the x scale's range onto INNER_WIDTH, so with three day periods each
// day is 100 wide.
function xScaleFor(lineProps: any) {
  const min = lineProps.xScale.min.getTime();
  const max = lineProps.xScale.max.getTime();
  return (value: Date) => ((value.getTime() - min) / (max - min)) * INNER_WIDTH;
}

const valueScale = Object.assign((value: number) => INNER_HEIGHT - value, {
  ticks: () => [0, 50, 100],
});

type CurrentPoint = { seriesId: string; seriesColor: string };

function drawLayer(
  lineProps: any,
  {
    currentPoint = null,
    yScale = valueScale,
  }: {
    currentPoint?: CurrentPoint | null;
    yScale?: (value: number) => number;
  } = {},
) {
  const { ctx, calls, lineGenerator } = fakeCanvas();
  const xScale = xScaleFor(lineProps);
  const series = lineProps.data.map((s: any) => ({
    id: s.id,
    data: s.data.map((d: any) => ({
      data: d,
      position: { x: xScale(d.x), y: d.y === null ? null : yScale(d.y) },
    })),
  }));
  lineProps.layers[1](ctx, {
    series,
    lineGenerator,
    currentPoint,
    xScale,
    yScale,
    innerWidth: INNER_WIDTH,
    innerHeight: INNER_HEIGHT,
  });
  return { calls, series };
}

beforeEach(() => {
  conversionProps = null;
  usersProps = null;
  mockResolvedTheme = "light";
});

describe("FunnelTrendPlot states", () => {
  it("shows a skeleton while loading", () => {
    renderPlot({ status: "pending", trend: undefined });
    expect(screen.getByTestId("skeleton-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("conversion-plot")).not.toBeInTheDocument();
  });

  it("shows an error message when the request fails", () => {
    renderPlot({ status: "error", trend: undefined });
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
    expect(screen.queryByTestId("conversion-plot")).not.toBeInTheDocument();
  });

  it.each<[string, TrendPoint[]]>([
    [
      "no period has users entering the funnel",
      [
        point("2026-01-10T00:00:00", [0, 0, 0]),
        point("2026-01-11T00:00:00", [0, 0, 0]),
      ],
    ],
    ["the trend has no periods", []],
  ])("shows the empty state when %s", (_, emptyPoints) => {
    renderPlot({ trend: trendWith({ points: emptyPoints }) });
    expect(
      screen.getByText("No users entered this funnel"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try different filters")).toBeInTheDocument();
    expect(screen.queryByTestId("conversion-plot")).not.toBeInTheDocument();
  });

  it("draws the plots when any period has users", () => {
    renderPlot({
      trend: trendWith({
        points: [
          point("2026-01-10T00:00:00", [0, 0, 0]),
          point("2026-01-11T00:00:00", [5, 1, 0]),
        ],
      }),
    });
    expect(screen.getByTestId("conversion-plot")).toBeInTheDocument();
    expect(screen.getByTestId("users-plot")).toBeInTheDocument();
    expect(
      screen.queryByText("No users entered this funnel"),
    ).not.toBeInTheDocument();
  });
});

describe("FunnelTrendPlot series", () => {
  it("plots an overall line and a line for each pair of steps", () => {
    renderPlot();
    expect(seriesIds()).toEqual(["overall", "step:1", "step:2"]);
  });

  it("plots conversion as a percentage rounded to one decimal, with a gap where the previous step has no users", () => {
    renderPlot();
    expect(seriesValues(conversionProps)).toEqual({
      overall: [25, 0, 16.7],
      "step:1": [50, 0, 50],
      "step:2": [50, null, 33.3],
    });
  });

  it("plots median time to convert in milliseconds, with gaps for missing medians", () => {
    renderPlot({ metric: FunnelTrendMetric.Time });
    expect(seriesValues(conversionProps)).toEqual({
      overall: [90000, null, 60000],
      "step:1": [30000, null, 45000],
      "step:2": [60000, null, 15000],
    });
  });

  const between = (start: Date, end: Date) =>
    new Date((start.getTime() + end.getTime()) / 2);

  it.each<[FunnelTrendPeriod, string[], Date[], Date, Date]>([
    [
      "week",
      ["2026-01-05T00:00:00", "2026-01-12T00:00:00"],
      [new Date(2026, 0, 8, 12), new Date(2026, 0, 15, 12)],
      new Date(2026, 0, 5),
      new Date(2026, 0, 19),
    ],
    [
      "month",
      ["2026-01-01T00:00:00", "2026-02-01T00:00:00"],
      [
        between(new Date(2026, 0, 1), new Date(2026, 1, 1)),
        between(new Date(2026, 1, 1), new Date(2026, 2, 1)),
      ],
      new Date(2026, 0, 1),
      new Date(2026, 2, 1),
    ],
  ])(
    "spaces %s periods by their length on a shared x axis",
    (period, datetimes, middles, min, max) => {
      renderPlot({
        period,
        trend: trendWith({
          points: datetimes.map((datetime) => point(datetime, [10, 5, 1])),
        }),
      });
      expect(conversionProps.data[0].data.map((d: any) => d.x)).toEqual(
        middles,
      );
      expect(conversionProps.xScale.min).toEqual(min);
      expect(conversionProps.xScale.max).toEqual(max);
      expect(usersProps.xScale).toEqual(conversionProps.xScale);
    },
  );

  it("plots the users who entered each period at the middle of the period in the users plot", () => {
    renderPlot();
    expect(usersProps.data).toEqual([
      {
        id: "entered",
        data: [
          { x: new Date(2026, 0, 10, 12), y: 1000, index: 0 },
          { x: new Date(2026, 0, 11, 12), y: 800, index: 1 },
          { x: new Date(2026, 0, 12, 12), y: 600, index: 2 },
        ],
      },
    ]);
  });

  it("colors the overall line with the text color and each step with its step color", () => {
    renderPlot();
    expect(conversionProps.colors({ id: "overall" })).toBe(FOREGROUND);
    expect(conversionProps.colors({ id: "step:1" })).toBe(STEP_1_COLOR);
    expect(conversionProps.colors({ id: "step:2" })).toBe(STEP_2_COLOR);
    expect(usersProps.colors).toEqual([FOREGROUND]);
  });

  it("plots only the overall line, at 100%, for a single step funnel", () => {
    renderPlot({
      trend: trendWith({
        event_names: ["Open"],
        points: [
          point("2026-01-10T00:00:00", [40]),
          point("2026-01-11T00:00:00", [0]),
          point("2026-01-12T00:00:00", [10]),
        ],
      }),
    });
    expect(seriesValues(conversionProps)).toEqual({
      overall: [100, null, 100],
    });
  });

  it("keeps a separate line for each step when event names repeat", () => {
    renderPlot({
      trend: trendWith({
        event_names: ["Open", "Cart", "Open"],
        points: [point("2026-01-10T00:00:00", [100, 50, 10])],
      }),
    });
    expect(seriesValues(conversionProps)).toEqual({
      overall: [10],
      "step:1": [50],
      "step:2": [20],
    });
    expect(stepItem("Open → Cart")).toBeInTheDocument();
    expect(stepItem("Cart → Open")).toBeInTheDocument();
  });
});

describe("FunnelTrendPlot axes", () => {
  it("formats the conversion axis as percentages and the users axis as abbreviated counts", () => {
    renderPlot();
    expect(conversionProps.axisLeft.legend).toBe("Conversion");
    expect(conversionProps.axisLeft.format(40)).toBe("40%");
    expect(usersProps.axisLeft.format(1500)).toBe("1.5K");
  });

  it("formats the time axis as durations", () => {
    renderPlot({ metric: FunnelTrendMetric.Time });
    expect(conversionProps.axisLeft.legend).toBe("Median time");
    expect(conversionProps.axisLeft.format(1500)).toBe("1.5s");
  });

  it.each<[FunnelTrendPeriod, string]>([
    ["day", "Day"],
    ["week", "Week"],
    ["month", "Month"],
  ])("titles the date axis for %s periods", (period, legend) => {
    renderPlot({ period });
    expect(usersProps.axisBottom.legend).toBe(legend);
  });

  it("labels each date tick with the start of its period", () => {
    renderPlot();
    const { format, tickValues } = usersProps.axisBottom;
    expect(tickValues.map(format)).toEqual(["Jan 10", "Jan 11", "Jan 12"]);
    expect(format(new Date(2026, 0, 10, 6))).toBe("");
  });

  it("labels month ticks with the month and year", () => {
    renderPlot({
      period: "month",
      trend: trendWith({
        points: [
          point("2026-01-01T00:00:00", [10, 5, 1]),
          point("2026-02-01T00:00:00", [10, 5, 1]),
        ],
      }),
    });
    const { format, tickValues } = usersProps.axisBottom;
    expect(tickValues.map(format)).toEqual(["Jan 2026", "Feb 2026"]);
  });

  it("spaces date ticks back from the latest period when there are many periods", () => {
    renderPlot({
      trend: trendWith({
        points: Array.from({ length: 8 }, (_, i) =>
          point(
            `2026-01-${String(10 + i).padStart(2, "0")}T00:00:00`,
            [10, 5, 1],
          ),
        ),
      }),
    });
    const { format, tickValues } = usersProps.axisBottom;
    expect(tickValues.map(format)).toEqual([
      "Jan 11",
      "Jan 13",
      "Jan 15",
      "Jan 17",
    ]);
  });
});

describe("FunnelTrendPlot tooltip", () => {
  it("shows only the hovered line with its conversion", () => {
    renderPlot();
    const stepText = tooltipText(conversionProps, "step:1", 0);
    expect(stepText).toContain("Open → Cart - 50%");
    expect(stepText).not.toContain("Overall");
    expect(stepText).not.toContain("Cart → Pay");

    const overallText = tooltipText(conversionProps, "overall", 2);
    expect(overallText).toContain("Overall - 16.7%");
    expect(overallText).not.toContain("Open → Cart");
  });

  it("shows No users when the line has no value for the period", () => {
    renderPlot();
    expect(tooltipText(conversionProps, "step:2", 1)).toContain(
      "Cart → Pay - No users",
    );
  });

  it("shows the time to convert as a duration", () => {
    renderPlot({ metric: FunnelTrendMetric.Time });
    expect(tooltipText(conversionProps, "overall", 0)).toContain(
      "Overall - 1m 30s",
    );
    expect(tooltipText(conversionProps, "step:1", 2)).toContain(
      "Open → Cart - 45s",
    );
  });

  it("shows the users who entered the funnel, and the step for a step line", () => {
    renderPlot();
    const stepText = tooltipText(conversionProps, "step:2", 0);
    expect(stepText).toContain("Users entered (overall): 1K");
    expect(stepText).toContain("Users entered (step): 500");

    const overallText = tooltipText(conversionProps, "overall", 0);
    expect(overallText).toContain("Users entered (overall): 1K");
    expect(overallText).not.toContain("Users entered (step)");
  });

  it("marks a period whose users are still converting", () => {
    renderPlot();
    expect(tooltipLines(conversionProps, "overall", 0)).toContain(
      "Date: 10 Jan, 2026",
    );
    expect(tooltipLines(conversionProps, "overall", 2)).toContain(
      "Date: 12 Jan, 2026 · Still converting",
    );
  });

  it.each<[FunnelTrendPeriod, string, string]>([
    ["week", "2026-01-05T00:00:00", "Date: Week of 5 Jan, 2026"],
    ["month", "2026-01-01T00:00:00", "Date: Jan 2026"],
  ])("names %s periods in the date", (period, datetime, expected) => {
    renderPlot({
      period,
      trend: trendWith({ points: [point(datetime, [10, 5, 1])] }),
    });
    expect(tooltipLines(conversionProps, "overall", 0)).toContain(expected);
  });

  it("lists the builds uploaded within the hovered period", () => {
    renderPlot({
      trend: trendWith({
        builds: [
          build({ uploaded_at: "2026-01-11T00:00:00" }),
          patch({
            patch_id: "p-abc",
            patch_version: "3",
            uploaded_at: "2026-01-11T18:00:00",
          }),
          patch({ patch_id: "p-xyz", uploaded_at: "2026-01-11T20:00:00" }),
          build({
            version_name: "1.3.0",
            uploaded_at: "2026-01-12T00:00:00",
          }),
          build({
            version_name: "1.1.0",
            uploaded_at: "2026-01-10T23:59:00",
          }),
        ],
      }),
    });
    const lines = tooltipLines(conversionProps, "overall", 1);
    expect(lines.filter((line) => line?.includes("uploaded"))).toEqual([
      "Build uploaded: 1.2.0 (120)",
      "Patch uploaded: 3 (p-abc)",
      "Patch uploaded: p-xyz",
    ]);
  });

  it("shows the period details without a line in the users plot", () => {
    renderPlot();
    const text = tooltipText(usersProps, "entered", 2);
    expect(text).toContain("Users entered (overall): 600");
    expect(text).toContain("Date: 12 Jan, 2026 · Still converting");
    expect(text).not.toContain("Users entered (step)");
    expect(text).not.toContain("Overall -");
  });
});

describe("FunnelTrendPlot hover and click", () => {
  it("opens the clicked period for the clicked line", () => {
    const onSelectPoint = jest.fn();
    renderPlot({ onSelectPoint });
    conversionProps.onClick({ seriesId: "step:2", data: { index: 1 } });
    expect(onSelectPoint).toHaveBeenCalledWith("2026-01-11T00:00:00", 2);

    conversionProps.onClick({ seriesId: "overall", data: { index: 0 } });
    expect(onSelectPoint).toHaveBeenLastCalledWith("2026-01-10T00:00:00", null);
  });

  it("opens the whole funnel for a click in the users plot", () => {
    const onSelectPoint = jest.fn();
    renderPlot({ onSelectPoint });
    usersProps.onClick({ seriesId: "entered", data: { index: 2 } });
    expect(onSelectPoint).toHaveBeenCalledWith("2026-01-12T00:00:00", null);
  });

  it("ignores clicks that are not on a point", () => {
    const onSelectPoint = jest.fn();
    renderPlot({ onSelectPoint });
    conversionProps.onClick({ id: "slice", data: [] });
    usersProps.onClick({ id: "slice", data: [] });
    expect(onSelectPoint).not.toHaveBeenCalled();
  });

  it("uses the period under the cursor for the tooltip and click, over the point nivo picked", () => {
    const onSelectPoint = jest.fn();
    renderPlot({ onSelectPoint });
    hoverAt("conversion-plot", 2.5 / 3, 200);

    const text = tooltipText(conversionProps, "overall", 0);
    expect(text).toContain("Overall - 16.7%");
    expect(text).toContain("Users entered (overall): 600");

    conversionProps.onClick({ seriesId: "step:1", data: { index: 0 } });
    expect(onSelectPoint).toHaveBeenCalledWith("2026-01-12T00:00:00", 1);
  });

  it("shares the hovered period from the users plot with the conversion plot", () => {
    const onSelectPoint = jest.fn();
    renderPlot({ onSelectPoint });
    hoverAt("users-plot", 1.5 / 3, 50);

    expect(tooltipText(conversionProps, "overall", 0)).toContain(
      "Users entered (overall): 800",
    );
    usersProps.onClick({ seriesId: "entered", data: { index: 0 } });
    expect(onSelectPoint).toHaveBeenCalledWith("2026-01-11T00:00:00", null);
  });

  it("falls back to the point nivo picked when the cursor is in the top margin", () => {
    renderPlot();
    hoverAt("conversion-plot", 2.5 / 3, 10);
    expect(tooltipText(conversionProps, "overall", 0)).toContain(
      "Overall - 25%",
    );
  });

  it("falls back to the point nivo picked when the cursor is right of the last period", () => {
    renderPlot();
    hoverAt("conversion-plot", 1.1, 200);
    expect(tooltipText(conversionProps, "overall", 0)).toContain(
      "Overall - 25%",
    );
  });

  it("forgets the hovered period when the cursor leaves the plot", () => {
    renderPlot();
    hoverAt("conversion-plot", 2.5 / 3, 200);
    fireEvent.mouseLeave(plotWrapper("conversion-plot"));
    expect(tooltipText(conversionProps, "overall", 0)).toContain(
      "Overall - 25%",
    );
  });
});

describe("FunnelTrendPlot step selection", () => {
  it("lists every line with its label and color, all selected", () => {
    renderPlot();
    const items = screen.getAllByTestId("command-item");
    expect(items.map((item) => item.textContent)).toEqual([
      "Overall",
      "Open → Cart",
      "Cart → Pay",
    ]);
    const dotColors = items.map(
      (item) =>
        (item.querySelector(".rounded-full") as HTMLElement).style
          .backgroundColor,
    );
    expect(dotColors).toEqual([
      "rgb(34, 34, 34)",
      "rgb(251, 191, 36)",
      "rgb(167, 139, 250)",
    ]);
    expect(
      items.every((item) => within(item).queryByTestId("selected-icon")),
    ).toBe(true);
  });

  it("hides a line when its step is unselected and shows it again in step order", () => {
    renderPlot();
    fireEvent.click(stepItem("Open → Cart"));
    expect(seriesIds()).toEqual(["overall", "step:2"]);
    expect(isSelected("Open → Cart")).toBe(false);

    fireEvent.click(stepItem("Overall"));
    expect(seriesIds()).toEqual(["step:2"]);

    fireEvent.click(stepItem("Open → Cart"));
    expect(seriesIds()).toEqual(["step:1", "step:2"]);
    expect(isSelected("Open → Cart")).toBe(true);
  });

  it("keeps the users plot when steps are hidden", () => {
    renderPlot();
    fireEvent.click(screen.getByText("Clear"));
    expect(usersProps.data[0].data.map((d: any) => d.y)).toEqual([
      1000, 800, 600,
    ]);
  });

  it("shows No steps selected after Clear and removes it after All", () => {
    renderPlot();
    expect(screen.queryByText("No steps selected")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Clear"));
    expect(conversionProps.data).toEqual([]);
    expect(screen.getByText("No steps selected")).toBeInTheDocument();
    expect(isSelected("Overall")).toBe(false);

    fireEvent.click(screen.getByText("All"));
    expect(seriesIds()).toEqual(["overall", "step:1", "step:2"]);
    expect(screen.queryByText("No steps selected")).not.toBeInTheDocument();
  });

  it("keeps hidden lines hidden when the metric changes", () => {
    const { rerenderWith } = renderPlot();
    fireEvent.click(stepItem("Cart → Pay"));
    rerenderWith({ metric: FunnelTrendMetric.Time });
    expect(seriesValues(conversionProps)).toEqual({
      overall: [90000, null, 60000],
      "step:1": [30000, null, 45000],
    });
    expect(isSelected("Cart → Pay")).toBe(false);
  });

  it("keeps hidden lines hidden when the trend changes", () => {
    const { rerenderWith } = renderPlot();
    fireEvent.click(stepItem("Cart → Pay"));
    rerenderWith({ trend: trendWith({ points: points.slice(0, 1) }) });
    expect(seriesValues(conversionProps)).toEqual({
      overall: [25],
      "step:1": [50],
    });
  });

  it("selects a step added to the funnel while keeping hidden steps hidden", () => {
    const { rerenderWith } = renderPlot();
    fireEvent.click(stepItem("Open → Cart"));
    rerenderWith({
      trend: trendWith({
        event_names: ["Open", "Cart", "Pay", "Done"],
        points: [point("2026-01-10T00:00:00", [100, 50, 20, 5])],
      }),
    });
    expect(seriesIds()).toEqual(["overall", "step:2", "step:3"]);
    expect(isSelected("Open → Cart")).toBe(false);
    expect(isSelected("Pay → Done")).toBe(true);
  });

  it("keeps lines unselected while a new period loads", () => {
    const { rerenderWith } = renderPlot();
    fireEvent.click(stepItem("Cart → Pay"));
    rerenderWith({ status: "pending", trend: undefined });
    rerenderWith({ status: "success", trend: trendWith() });
    expect(seriesIds()).toEqual(["overall", "step:1"]);
    expect(isSelected("Cart → Pay")).toBe(false);
  });
});

describe("FunnelTrendPlot legend", () => {
  it("shows nothing when every period is complete and there are no builds", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    expect(screen.queryByText("Build uploaded")).not.toBeInTheDocument();
    expect(screen.queryByText("Still converting")).not.toBeInTheDocument();
  });

  it("shows Still converting when a period is incomplete", () => {
    renderPlot();
    expect(screen.getByText("Still converting")).toBeInTheDocument();
    expect(screen.queryByText("Build uploaded")).not.toBeInTheDocument();
  });

  it("shows Build uploaded when there are builds", () => {
    renderPlot({
      trend: trendWith({ points: completePoints, builds: [build()] }),
    });
    expect(screen.getByText("Build uploaded")).toBeInTheDocument();
    expect(screen.queryByText("Still converting")).not.toBeInTheDocument();
  });

  it("shows Build uploaded before Still converting", () => {
    renderPlot({ trend: trendWith({ builds: [build()] }) });
    const buildEntry = screen.getByText("Build uploaded");
    const stillConvertingEntry = screen.getByText("Still converting");
    expect(
      buildEntry.compareDocumentPosition(stillConvertingEntry) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });
});

describe("FunnelTrendPlot conversion layer", () => {
  const connectedPoints = [
    point("2026-01-10T00:00:00", [100, 50, 20]),
    point("2026-01-11T00:00:00", [100, 40, 10]),
    point("2026-01-12T00:00:00", [100, 60, 30]),
  ];

  it("draws periods that are still converting as a dashed line joined to the last complete period", () => {
    renderPlot();
    const { calls, series } = drawLayer(conversionProps);
    const positions = series[0].data.map((d: any) => d.position);
    const overallLines = calls.lines.slice(0, 2);
    expect(overallLines).toEqual([
      { positions: positions.slice(0, 2), dashed: false },
      { positions: positions.slice(1), dashed: true },
    ]);
    expect(calls.lines).toHaveLength(6);
  });

  it("draws the whole line dashed when every period is still converting", () => {
    renderPlot({
      trend: trendWith({
        points: points.map((p) => ({ ...p, complete: false })),
      }),
    });
    const { calls, series } = drawLayer(conversionProps);
    const positions = series[0].data.map((d: any) => d.position);
    expect(calls.lines.slice(0, 2)).toEqual([
      { positions: [], dashed: false },
      { positions, dashed: true },
    ]);
  });

  it("draws one solid line per series when every period is complete", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    const { calls } = drawLayer(conversionProps);
    expect(calls.lines).toHaveLength(3);
    expect(calls.lines.every((line) => !line.dashed)).toBe(true);
    expect(calls.lines[0].positions).toHaveLength(3);
  });

  it("shades the plot from the first period still converting, and not at all when every period is complete", () => {
    const { rerenderWith } = renderPlot();
    expect(drawLayer(conversionProps).calls.rects).toEqual([
      { args: [200, 0, 100, INNER_HEIGHT], alpha: 0.06 },
    ]);

    rerenderWith({ trend: trendWith({ points: completePoints }) });
    expect(drawLayer(conversionProps).calls.rects).toEqual([]);
  });

  function highlighted() {
    return drawLayer(conversionProps)
      .calls.rects.filter((rect) => rect.alpha === 0.1)
      .map((rect) => rect.args[0]);
  }

  it("highlights the hovered period", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    hoverAt("conversion-plot", 1.5 / 3, 200);
    expect(drawLayer(conversionProps).calls.rects).toEqual([
      { args: [100, 0, 100, INNER_HEIGHT], alpha: 0.1 },
    ]);
  });

  it("highlights the period on either side of a period edge", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    hoverAt("conversion-plot", 0.998 / 3, 200);
    expect(highlighted()).toEqual([0]);
    hoverAt("conversion-plot", 1.002 / 3, 200);
    expect(highlighted()).toEqual([100]);
  });

  it("highlights no period when the cursor is in the bottom margin", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    hoverAt("conversion-plot", 1.5 / 3, 380);
    expect(highlighted()).toEqual([]);
    hoverAt("users-plot", 1.5 / 3, 170);
    expect(highlighted()).toEqual([]);
  });

  it("dims every line except the hovered one", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    const lineAlphas = (currentPoint: CurrentPoint | null) =>
      drawLayer(conversionProps, { currentPoint }).calls.strokes.map(
        (stroke) => stroke.alpha,
      );
    expect(lineAlphas(null)).toEqual([1, 1, 1]);
    expect(
      lineAlphas({ seriesId: "step:1", seriesColor: STEP_1_COLOR }),
    ).toEqual([0.15, 1, 0.15]);
  });

  it("draws grid dots at the date ticks and value ticks", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    const { calls } = drawLayer(conversionProps);
    const xs = gridDotPositions(
      usersProps.axisBottom.tickValues.map(xScaleFor(conversionProps)),
      INNER_WIDTH,
    );
    const ys = gridDotPositions([200, 150, 100], INNER_HEIGHT);
    expect(xs.length).toBeGreaterThan(3);
    expect(calls.arcs.filter((arc) => arc.r === 1)).toEqual(
      xs.flatMap((x) => ys.map((y) => ({ x, y, r: 1 }))),
    );
    expect(calls.fills[0]).toEqual({ color: MUTED, alpha: 0.3 });
  });

  it("draws with the dark theme's colors", () => {
    mockResolvedTheme = "dark";
    renderPlot({
      trend: trendWith({
        points: completePoints,
        builds: [build({ uploaded_at: "2026-01-11T12:00:00" })],
      }),
    });
    expect(conversionProps.colors({ id: "overall" })).toBe(DARK_FOREGROUND);

    const { calls } = drawLayer(conversionProps);
    expect(calls.fills[0]).toEqual({ color: DARK_MUTED, alpha: 0.1 });
    expect(calls.strokes[0]).toMatchObject({ color: DARK_MUTED });
  });

  it("marks the hovered line's point in the period under the cursor", () => {
    renderPlot({ trend: trendWith({ points: connectedPoints }) });
    hoverAt("conversion-plot", 2.5 / 3, 200);
    const { calls, series } = drawLayer(conversionProps, {
      currentPoint: { seriesId: "step:1", seriesColor: STEP_1_COLOR },
    });
    const { x, y } = series[1].data[2].position;
    expect(calls.arcs.filter((arc) => arc.r === 3)).toEqual([{ x, y, r: 3 }]);
  });

  it("marks no point when the hovered line has no value in the hovered period", () => {
    renderPlot({
      trend: trendWith({
        points: [
          ...connectedPoints.slice(0, 2),
          point("2026-01-12T00:00:00", [100, 0, 0]),
        ],
      }),
    });
    hoverAt("conversion-plot", 2.5 / 3, 200);
    const { calls } = drawLayer(conversionProps, {
      currentPoint: { seriesId: "step:2", seriesColor: STEP_2_COLOR },
    });
    expect(calls.arcs.filter((arc) => arc.r === 3)).toEqual([]);
  });

  it("draws a dot for a value with no value on either side", () => {
    renderPlot({
      trend: trendWith({
        points: [
          point("2026-01-10T00:00:00", [0, 0, 0]),
          point("2026-01-11T00:00:00", [10, 5, 0]),
          point("2026-01-12T00:00:00", [0, 0, 0]),
        ],
      }),
    });
    const { calls, series } = drawLayer(conversionProps);
    const dots = calls.arcs.filter((arc) => arc.r === 3);
    expect(dots).toEqual(
      series.map((s: any) => ({ ...s.data[1].position, r: 3 })),
    );
  });

  it("draws no dots for values joined by a line", () => {
    renderPlot({ trend: trendWith({ points: connectedPoints }) });
    const { calls } = drawLayer(conversionProps);
    expect(calls.arcs.filter((arc) => arc.r === 3)).toEqual([]);
  });
});

describe("FunnelTrendPlot build markers", () => {
  function drawBuilds(builds: TrendBuild[], lineProps = () => conversionProps) {
    renderPlot({ trend: trendWith({ points: completePoints, builds }) });
    return drawLayer(lineProps()).calls;
  }

  it("draws a dashed marker and a label at each build", () => {
    const calls = drawBuilds([build({ uploaded_at: "2026-01-11T12:00:00" })]);
    expect(calls.markers).toEqual([
      { from: [150, 0], to: [150, INNER_HEIGHT] },
    ]);
    expect(calls.strokes[0]).toEqual({
      color: MUTED,
      alpha: 0.6,
      dashed: true,
    });
    expect(calls.strokes.slice(1).every((stroke) => !stroke.dashed)).toBe(true);
    expect(calls.fillText).toEqual([{ text: "1.2.0 (120)", x: 117, y: -6 }]);
  });

  it("labels a patch with its patch version and id, or its patch id without a version", () => {
    const calls = drawBuilds([
      patch({ patch_version: "3", uploaded_at: "2026-01-10T12:00:00" }),
      patch({ patch_id: "p-2", uploaded_at: "2026-01-12T12:00:00" }),
    ]);
    expect(calls.fillText.map((t) => t.text)).toEqual(["3 (p-1)", "p-2"]);
  });

  it("shortens a patch label to the patch version when the id does not fit", () => {
    const calls = drawBuilds([
      patch({
        patch_id: "0f8c2e4a-6b1d-4c3e-9a7f-2d5b8e1c4a90",
        patch_version: "hotfix-2",
        uploaded_at: "2026-01-11T12:00:00",
      }),
    ]);
    expect(calls.fillText.map((t) => t.text)).toEqual(["hotfix-2"]);
  });

  it("leaves out builds outside the plotted range", () => {
    const calls = drawBuilds([
      build({ uploaded_at: "2026-01-09T12:00:00" }),
      build({ uploaded_at: "2026-01-13T12:00:00" }),
    ]);
    expect(calls.markers).toEqual([]);
    expect(calls.fillText).toEqual([]);
  });

  it("keeps labels within the plot at either edge", () => {
    const calls = drawBuilds([
      build({ uploaded_at: "2026-01-10T00:30:00" }),
      build({ uploaded_at: "2026-01-12T23:30:00" }),
    ]);
    expect(calls.fillText.map((t) => [t.x, t.y])).toEqual([
      [0, -6],
      [INNER_WIDTH - 66, -6],
    ]);
  });

  it("shortens a label to the version name, and cuts a name too long to fit with an ellipsis", () => {
    const name25 = "1.2.0-beta.20260111-buil1";
    const name28 = "1.2.0-beta.20260111-build-99";
    const calls = drawBuilds([
      build({ version_name: name25, uploaded_at: "2026-01-10T12:00:00" }),
      build({ version_name: name28, uploaded_at: "2026-01-12T12:00:00" }),
    ]);
    expect(calls.fillText.map((t) => t.text)).toEqual([
      name25,
      "1.2.0-beta.20260111-build…",
    ]);
  });

  it("cuts a patch id too long to fit with an ellipsis", () => {
    const calls = drawBuilds([
      patch({
        patch_id: "0f8c2e4a-6b1d-4c3e-9a7f-2d5b8e1c4a90",
        uploaded_at: "2026-01-11T12:00:00",
      }),
    ]);
    expect(calls.fillText.map((t) => t.text)).toEqual([
      "0f8c2e4a-6b1d-4c3e-9a7f-2…",
    ]);
  });

  it("moves an overlapping label up a row and leaves out labels with no free row", () => {
    const calls = drawBuilds([
      build({ uploaded_at: "2026-01-11T12:00:00" }),
      build({ version_name: "1.2.1", uploaded_at: "2026-01-11T12:00:00" }),
      build({ version_name: "1.2.2", uploaded_at: "2026-01-11T12:00:00" }),
    ]);
    expect(calls.fillText).toEqual([
      { text: "1.2.0 (120)", x: 117, y: -6 },
      { text: "1.2.1 (120)", x: 117, y: -20 },
    ]);
    expect(calls.markers).toEqual([
      { from: [150, 0], to: [150, INNER_HEIGHT] },
      { from: [150, -18], to: [150, INNER_HEIGHT] },
      { from: [150, 0], to: [150, INNER_HEIGHT] },
    ]);
  });

  it("marks builds in the users plot without labels", () => {
    const calls = drawBuilds(
      [build({ uploaded_at: "2026-01-11T12:00:00" })],
      () => usersProps,
    );
    expect(calls.markers).toEqual([
      { from: [150, 0], to: [150, INNER_HEIGHT] },
    ]);
    expect(calls.fillText).toEqual([]);
  });

  it("offers no build select without builds", () => {
    renderPlot();
    expect(screen.queryByText("Select Builds")).not.toBeInTheDocument();
  });

  it("hides an unselected build's marker and tooltip line, and shows it again when selected", () => {
    const calls = drawBuilds([
      build({ uploaded_at: "2026-01-11T06:00:00" }),
      build({
        version_name: "1.3.0",
        version_code: "130",
        uploaded_at: "2026-01-11T18:00:00",
      }),
    ]);
    expect(calls.markers).toHaveLength(2);

    fireEvent.click(stepItem("1.2.0 (120)"));
    expect(drawLayer(conversionProps).calls.fillText).toEqual([
      { text: "1.3.0 (130)", x: 142, y: -6 },
    ]);
    expect(drawLayer(usersProps).calls.markers).toHaveLength(1);
    expect(
      tooltipLines(conversionProps, "overall", 1).filter((line) =>
        line?.includes("uploaded"),
      ),
    ).toEqual(["Build uploaded: 1.3.0 (130)"]);

    fireEvent.click(stepItem("1.2.0 (120)"));
    expect(drawLayer(conversionProps).calls.markers).toHaveLength(2);
  });
});

describe("FunnelTrendPlot build selection across trends", () => {
  const firstBuild = build({ uploaded_at: "2026-01-11T06:00:00" });
  const secondBuild = build({
    version_name: "1.3.0",
    version_code: "130",
    uploaded_at: "2026-01-11T18:00:00",
  });
  const withBuilds = (builds: TrendBuild[]) =>
    trendWith({ points: completePoints, builds });

  // Loads a new trend the way a period change does, through the loading
  // state.
  function loadTrendWith(
    rerenderWith: (next: Partial<PlotProps>) => void,
    builds: TrendBuild[],
  ) {
    rerenderWith({ status: "pending", trend: undefined });
    rerenderWith({ status: "success", trend: withBuilds(builds) });
  }

  it("keeps a build unselected when the next trend also has it", () => {
    const { rerenderWith } = renderPlot({
      trend: withBuilds([firstBuild, secondBuild]),
    });
    fireEvent.click(stepItem("1.2.0 (120)"));

    loadTrendWith(rerenderWith, [firstBuild, secondBuild]);

    expect(isSelected("1.2.0 (120)")).toBe(false);
    expect(isSelected("1.3.0 (130)")).toBe(true);
    expect(drawLayer(conversionProps).calls.markers).toHaveLength(1);
  });

  it("discards an unselected build when the next trend does not have it, so it is selected when a later trend brings it back", () => {
    const { rerenderWith } = renderPlot({
      trend: withBuilds([firstBuild, secondBuild]),
    });
    fireEvent.click(stepItem("1.2.0 (120)"));

    loadTrendWith(rerenderWith, [secondBuild]);
    loadTrendWith(rerenderWith, [firstBuild, secondBuild]);

    expect(isSelected("1.2.0 (120)")).toBe(true);
    expect(drawLayer(conversionProps).calls.markers).toHaveLength(2);
  });

  it("keeps a build unselected when the metric changes", () => {
    const { rerenderWith } = renderPlot({
      trend: withBuilds([firstBuild, secondBuild]),
    });
    fireEvent.click(stepItem("1.2.0 (120)"));

    rerenderWith({ metric: FunnelTrendMetric.Time });

    expect(isSelected("1.2.0 (120)")).toBe(false);
    expect(drawLayer(conversionProps).calls.markers).toHaveLength(1);
  });

  it("selects a build the previous trend did not have", () => {
    const { rerenderWith } = renderPlot({ trend: withBuilds([secondBuild]) });
    fireEvent.click(stepItem("1.3.0 (130)"));

    loadTrendWith(rerenderWith, [firstBuild, secondBuild]);

    expect(isSelected("1.2.0 (120)")).toBe(true);
    expect(isSelected("1.3.0 (130)")).toBe(false);
  });
});

describe("FunnelTrendPlot users layer", () => {
  const barScale = (value: number) => INNER_HEIGHT - value / 10;

  function bars() {
    return drawLayer(usersProps, { yScale: barScale }).calls.rects.filter(
      (rect) => rect.args[2] === 60,
    );
  }

  it("draws a bar centered in each period up from the axis", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    expect(bars()).toEqual([
      { args: [20, 100, 60, 100], alpha: 0.35 },
      { args: [120, 120, 60, 80], alpha: 0.35 },
      { args: [220, 140, 60, 60], alpha: 0.35 },
    ]);
  });

  it("darkens the bar of the hovered period", () => {
    renderPlot({ trend: trendWith({ points: completePoints }) });
    hoverAt("users-plot", 0.5 / 3, 50);
    expect(bars().map((bar) => bar.alpha)).toEqual([0.7, 0.35, 0.35]);
  });
});

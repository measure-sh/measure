import type { FunnelCadence } from "@/app/api/api_calls";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";

let lineProps: any = null;

jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    lineProps = props;
    return <div data-testid="cadence-plot" />;
  },
}));

jest.mock("next-themes", () => ({
  useTheme: () => ({ resolvedTheme: "light" }),
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

import FunnelCadencePlot from "@/app/components/funnel/cadence_plot";

const cadence: FunnelCadence = {
  from: "2026-10-05T00:00:00.000+05:30",
  to: "2026-10-12T00:00:00.000+05:30",
  hours: [
    { weekday: 1, hour: 9, users: 400, converted: 12 },
    { weekday: 3, hour: 14, users: 200, converted: 3 },
  ],
};

type PlotProps = Parameters<typeof FunnelCadencePlot>[0];

function renderPlot(overrides: Partial<PlotProps> = {}) {
  const props: PlotProps = {
    status: "success",
    hours: cadence,
    onSelectPoint: jest.fn(),
    ...overrides,
  };
  const { rerender } = render(<FunnelCadencePlot {...props} />);
  return {
    props,
    rerenderWith: (next: Partial<PlotProps>) =>
      rerender(<FunnelCadencePlot {...props} {...next} />),
  };
}

function dayItem(label: string) {
  return screen
    .getAllByTestId("command-item")
    .find((el) => el.textContent === label)!;
}

function seriesIds() {
  return lineProps.data.map((s: any) => s.id);
}

beforeEach(() => {
  lineProps = null;
});

describe("FunnelCadencePlot", () => {
  it("shows a skeleton while loading", () => {
    renderPlot({ status: "pending", hours: undefined });
    expect(screen.getByTestId("skeleton-mock")).toBeInTheDocument();
  });

  it("shows an error message when the request fails", () => {
    renderPlot({ status: "error", hours: undefined });
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("shows an empty state when no users entered the funnel", () => {
    renderPlot({ hours: { ...cadence, hours: [] } });
    expect(
      screen.getByText("No users entered this funnel"),
    ).toBeInTheDocument();
  });

  it("plots a line for each weekday with the conversion of every hour, and gaps for hours without users", () => {
    renderPlot();
    expect(seriesIds()).toEqual([
      "Monday",
      "Tuesday",
      "Wednesday",
      "Thursday",
      "Friday",
      "Saturday",
      "Sunday",
    ]);
    const monday = lineProps.data[0].data;
    expect(monday).toHaveLength(24);
    expect(monday[9].y).toBe(3);
    expect(monday[10].y).toBeNull();
    expect(lineProps.data[2].data[14].y).toBe(1.5);
  });

  it("draws a dot for an hour with no users in the hours on either side", () => {
    renderPlot();
    const dots: { x: number; y: number; r: number }[] = [];
    const ctx: any = {
      save: () => {},
      restore: () => {},
      beginPath: () => {},
      moveTo: () => {},
      fill: () => {},
      stroke: () => {},
      arc: (x: number, y: number, r: number) => dots.push({ x, y, r }),
    };
    const lineGenerator = Object.assign(() => {}, { context: () => {} });
    const xScale = (hour: number) => hour * 10;
    const yScale = Object.assign((value: number) => 100 - value, {
      ticks: () => [0, 50, 100],
    });
    const series = lineProps.data.map((s: any) => ({
      id: s.id,
      color: "#000000",
      data: s.data.map((d: any) => ({
        data: d,
        position: { x: xScale(d.x), y: d.y === null ? null : yScale(d.y) },
      })),
    }));
    lineProps.layers[1](ctx, {
      series,
      lineGenerator,
      currentPoint: null,
      xScale,
      yScale,
      innerWidth: 230,
      innerHeight: 100,
    });
    // Monday 9am converts 3% and Wednesday 2pm 1.5%; the smaller arcs are the
    // grid.
    expect(dots.filter((dot) => dot.r === 3)).toEqual([
      { x: 90, y: 97, r: 3 },
      { x: 140, y: 98.5, r: 3 },
    ]);
  });

  it("shows the day, hour and users of the hovered point", () => {
    renderPlot();
    const { container } = render(
      lineProps.tooltip({
        point: {
          seriesId: "Monday",
          seriesColor: "#38bdf8",
          data: lineProps.data[0].data[9],
        },
      }),
    );
    expect(container.textContent).toContain("Monday - 3.0%");
    expect(container.textContent).toContain("Hour: 9am to 10am");
    expect(container.textContent).toContain("Users entered: 400");
    expect(container.textContent).toContain("Users converted: 12");
  });

  it("opens the clicked weekday and hour", () => {
    const { props } = renderPlot();
    lineProps.onClick({ seriesId: "Wednesday", data: { x: 14 } });
    expect(props.onSelectPoint).toHaveBeenCalledWith(3, 14);
  });

  it("hides an unselected day", () => {
    renderPlot();
    fireEvent.click(dayItem("Sunday"));
    expect(seriesIds()).not.toContain("Sunday");
    expect(within(dayItem("Sunday")).queryByTestId("selected-icon")).toBeNull();
  });

  it("keeps days unselected while a new span loads", () => {
    const { rerenderWith } = renderPlot();
    fireEvent.click(dayItem("Sunday"));
    rerenderWith({ status: "pending", hours: undefined });
    rerenderWith({ status: "success", hours: cadence });
    expect(seriesIds()).not.toContain("Sunday");
    expect(within(dayItem("Sunday")).queryByTestId("selected-icon")).toBeNull();
  });
});

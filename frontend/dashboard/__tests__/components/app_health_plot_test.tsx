import AppHealthPlot from "@/app/components/app_health_plot";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

let lastLineProps: any = null;

jest.mock("@nivo/line", () => ({
  ResponsiveLineCanvas: (props: any) => {
    lastLineProps = props;
    return <div data-testid="line-mock" />;
  },
}));

jest.mock("next-themes", () => ({ useTheme: () => ({ theme: "light" }) }));
jest.mock("@/app/components/skeleton", () => ({
  SkeletonPlot: () => <div data-testid="skeleton-mock">loading</div>,
}));

const plotDates = {
  startDate: "2026-02-01T00:00:00Z",
  endDate: "2026-02-01T06:00:00Z",
};

describe("AppHealthPlot", () => {
  beforeEach(() => {
    lastLineProps = null;
  });

  it("renders loading state", () => {
    render(<AppHealthPlot {...plotDates} status="pending" plot={undefined} />);
    expect(screen.getByText("loading")).toBeInTheDocument();
  });

  it("renders error state", () => {
    render(<AppHealthPlot {...plotDates} status="error" plot={undefined} />);
    expect(screen.getByText(/Error fetching plot/)).toBeInTheDocument();
  });

  it("renders no data state", () => {
    render(<AppHealthPlot {...plotDates} status="success" plot={null} />);
    expect(screen.getByText("No Data")).toBeInTheDocument();
  });

  it("renders data and minute precision axis for sub-12h range", () => {
    render(
      <AppHealthPlot
        {...plotDates}
        status="success"
        plot={[
          {
            id: "Sessions",
            data: [{ id: "s1", x: "2026-02-01T01:00:00", y: 10 }],
          },
        ]}
      />,
    );

    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    expect(lastLineProps.xScale.precision).toBe("minute");
    expect(lastLineProps.data[0].id).toBe("Sessions");
  });

  it("uses hour/day/month axis config based on range", () => {
    const plot = [
      {
        id: "Sessions",
        data: [{ id: "s1", x: "2026-02-01T01:00:00", y: 10 }],
      },
    ];

    // Hours range (5 days)
    const { unmount: u1 } = render(
      <AppHealthPlot
        startDate="2026-02-01T00:00:00Z"
        endDate="2026-02-06T00:00:00Z"
        status="success"
        plot={plot}
      />,
    );
    expect(lastLineProps.xScale.precision).toBe("hour");
    u1();

    // Days range (73 days)
    const { unmount: u2 } = render(
      <AppHealthPlot
        startDate="2026-01-01T00:00:00Z"
        endDate="2026-03-15T00:00:00Z"
        status="success"
        plot={plot}
      />,
    );
    expect(lastLineProps.xScale.precision).toBe("day");
    u2();

    // Months range (1 year)
    render(
      <AppHealthPlot
        startDate="2025-01-01T00:00:00Z"
        endDate="2026-01-01T00:00:00Z"
        status="success"
        plot={plot}
      />,
    );
    expect(lastLineProps.axisBottom.format).toBe("%d %b, %Y");
  });

  it("renders tooltip in Sessions, Crashes, ANRs order", () => {
    render(
      <AppHealthPlot
        {...plotDates}
        status="success"
        plot={[
          { id: "ANRs", data: [{ id: "a1", x: "2026-02-01T01:00:00", y: 1 }] },
          {
            id: "Sessions",
            data: [{ id: "s1", x: "2026-02-01T01:00:00", y: 10 }],
          },
          {
            id: "Crashes",
            data: [{ id: "c1", x: "2026-02-01T01:00:00", y: 2 }],
          },
        ]}
      />,
    );
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();

    const datum = lastLineProps.data[0].data[0];
    const tooltip = lastLineProps.tooltip({
      point: { data: { ...datum, xFormatted: "2026-02-01T01:00:00" } },
    });

    const { container } = render(tooltip);
    const text = container.textContent || "";
    expect(text.indexOf("Sessions")).toBeLessThan(text.indexOf("Crashes"));
    expect(text.indexOf("Crashes")).toBeLessThan(text.indexOf("ANRs"));
  });

  it("skips missing tooltip series and keeps known ordering", () => {
    render(
      <AppHealthPlot
        {...plotDates}
        status="success"
        plot={[
          {
            id: "Sessions",
            data: [{ id: "s1", x: "2026-02-01T01:00:00", y: 10 }],
          },
          { id: "ANRs", data: [{ id: "a1", x: "2026-02-01T01:00:00", y: 1 }] },
        ]}
      />,
    );

    const datum = lastLineProps.data[0].data[0];
    const tooltip = lastLineProps.tooltip({
      point: { data: { ...datum, xFormatted: "2026-02-01T01:00:00" } },
    });

    const { container } = render(tooltip);
    const text = container.textContent || "";
    expect(text).toContain("Sessions");
    expect(text).not.toContain("Crashes");
    expect(text).toContain("ANRs");
  });

  it("uses fallback color for unknown series id", () => {
    render(
      <AppHealthPlot
        {...plotDates}
        status="success"
        plot={[
          {
            id: "Sessions",
            data: [{ id: "s1", x: "2026-02-01T01:00:00", y: 10 }],
          },
        ]}
      />,
    );

    expect(lastLineProps.colors({ id: "Unknown" })).toBe("#888");
    expect(lastLineProps.pointBorderColor({ seriesId: "Unknown" })).toBe(
      "#888",
    );
  });

  it("hides stale chart while new range data is loading", () => {
    // First render with data
    const { unmount } = render(
      <AppHealthPlot
        {...plotDates}
        status="success"
        plot={[
          {
            id: "Sessions",
            data: [{ id: "s1", x: "2026-02-01T01:00:00", y: 10 }],
          },
        ]}
      />,
    );
    expect(screen.getByTestId("line-mock")).toBeInTheDocument();
    unmount();

    // New range, data loading
    render(
      <AppHealthPlot
        startDate="2026-02-01T00:00:00Z"
        endDate="2026-02-01T03:00:00Z"
        status="pending"
        plot={undefined}
      />,
    );

    expect(screen.getByText("loading")).toBeInTheDocument();
    expect(screen.queryByTestId("line-mock")).not.toBeInTheDocument();
  });
});

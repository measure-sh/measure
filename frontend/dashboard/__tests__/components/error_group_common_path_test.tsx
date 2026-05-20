import ErrorGroupCommonPath from "@/app/components/error_group_common_path";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

jest.mock("@/app/components/beta_badge", () => ({
  __esModule: true,
  default: () => <span data-testid="beta-badge-mock" />,
}));

jest.mock("@/app/components/code_block", () => ({
  __esModule: true,
  default: ({ code }: { code: string }) => (
    <div data-testid="code-block-mock">{code}</div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: ({ className }: any) => (
    <div data-testid="skeleton-mock" className={className} />
  ),
  SkeletonPlot: () => <div data-testid="skeleton-plot-mock" />,
}));

jest.mock("@/app/components/slider", () => ({
  __esModule: true,
  Slider: ({ value, onValueChange }: any) => (
    <input
      data-testid="slider-mock"
      type="range"
      value={value?.[0]}
      onChange={(e) => onValueChange([Number(e.target.value)])}
    />
  ),
}));

const mockUseErrorGroupCommonPathQuery = jest.fn(
  (): { data: any; status: string; error: Error | null } => ({
    data: undefined,
    status: "pending",
    error: null,
  }),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorGroupCommonPathQuery: () => mockUseErrorGroupCommonPathQuery(),
}));

describe("ErrorGroupCommonPath", () => {
  beforeEach(() => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
  });

  it("renders the section heading", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorGroupCommonPath appId="app-1" groupId="g1" />);
    expect(screen.getByText(/Common Path/)).toBeInTheDocument();
  });

  it("renders loading skeleton while query is pending", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorGroupCommonPath appId="app-1" groupId="g1" />);
    expect(screen.getAllByTestId("skeleton-mock").length).toBeGreaterThan(0);
  });

  it("renders error message when query errors", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: undefined,
      status: "error",
      error: new Error("boom"),
    });
    render(<ErrorGroupCommonPath appId="app-1" groupId="g1" />);
    expect(screen.getByText(/Error fetching common path/)).toBeInTheDocument();
  });

  it("renders empty-state message when no steps meet threshold", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: {
        sessions_analyzed: 100,
        steps: [
          {
            description: "Low confidence",
            thread_name: "main",
            confidence_pct: 10,
          },
        ],
      },
      status: "success",
      error: null,
    });
    render(<ErrorGroupCommonPath appId="app-1" groupId="g1" />);
    expect(
      screen.getByText(
        /No events are common in at least 80% of analyzed sessions/,
      ),
    ).toBeInTheDocument();
  });

  it("renders steps that meet the default 80% confidence threshold", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: {
        sessions_analyzed: 100,
        steps: [
          { description: "High step", thread_name: "main", confidence_pct: 95 },
          { description: "Low step", thread_name: "main", confidence_pct: 10 },
        ],
      },
      status: "success",
      error: null,
    });
    render(<ErrorGroupCommonPath appId="app-1" groupId="g1" />);

    expect(screen.getByText("High step")).toBeInTheDocument();
    expect(screen.queryByText("Low step")).not.toBeInTheDocument();
    // Threshold count summary: 1 of 2 steps
    expect(screen.getByText(/1 of\s+2 steps/)).toBeInTheDocument();
    expect(
      screen.getByText(/Analyzed from latest\s+100 sessions/),
    ).toBeInTheDocument();
  });

  it("renders thread name and confidence pct for each step", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: {
        sessions_analyzed: 50,
        steps: [
          { description: "Step", thread_name: "okhttp", confidence_pct: 92 },
        ],
      },
      status: "success",
      error: null,
    });
    render(<ErrorGroupCommonPath appId="app-1" groupId="g1" />);

    expect(
      screen.getByText(/Thread: okhttp \| Occurs in 92% of analyzed sessions/),
    ).toBeInTheDocument();
  });

  it("renders demo data and bypasses query in demo mode", () => {
    mockUseErrorGroupCommonPathQuery.mockReturnValue({
      data: undefined,
      status: "pending",
      error: null,
    });
    render(<ErrorGroupCommonPath appId="" groupId="" demo />);

    // Demo data is rendered even though the query reports pending
    expect(screen.queryAllByTestId("skeleton-mock").length).toBe(0);
    // At least one demo step description is in the DOM
    expect(screen.getByText(/App moved to foreground/)).toBeInTheDocument();
    // Sessions analyzed total comes from demo data (50)
    expect(
      screen.getByText(/Analyzed from latest\s+50 sessions/),
    ).toBeInTheDocument();
  });
});

import { mockRouter } from "@/__tests__/helpers/mock_router";
import type { Funnel } from "@/app/api/api_calls";
import { ApiError, invalidFilterExpr } from "@/app/api/api_error";
import type FilterBar from "@/app/components/filter_bar/filter_bar";
import type { FilterChange } from "@/app/components/filter_bar/filter_bar";
import { DateRange } from "@/app/components/filter_bar/date_range_select";
import type FunnelChart from "@/app/components/funnel/chart";
import FunnelDetails from "@/app/components/funnel/details";
import type FunnelEditor from "@/app/components/funnel/editor";
import type FunnelFriction from "@/app/components/funnel/friction";
import type FunnelSessions from "@/app/components/funnel/sessions";
import type FunnelTrendPlot from "@/app/components/funnel/trend_plot";
import { toastNegative, toastPositive } from "@/app/components/toast";
import { formatDateToHumanReadableDateTime } from "@/app/utils/time_utils";
import { beforeAll, beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";

type FilterBarProps = React.ComponentProps<typeof FilterBar>;
type ChartProps = React.ComponentProps<typeof FunnelChart>;
type TrendPlotProps = React.ComponentProps<typeof FunnelTrendPlot>;
type FrictionProps = React.ComponentProps<typeof FunnelFriction>;
type SessionsProps = React.ComponentProps<typeof FunnelSessions>;
type EditorProps = React.ComponentProps<typeof FunnelEditor>;

jest.mock("next/navigation", () =>
  jest
    .requireActual<
      typeof import("@/__tests__/helpers/mock_router")
    >("@/__tests__/helpers/mock_router")
    .nextNavigationMock(),
);

const mockUseFunnelQuery = jest.fn();
const mockUseFunnelConversionQuery = jest.fn();
const mockUseFunnelTrendQuery = jest.fn();
const mockUseDeleteFunnelMutation = jest.fn();
const mockUseAuthzAndMembersQuery = jest.fn();
// The cadence's weeks end two weeks before this week, as for a funnel whose
// conversion window is longer than a week.
const mockUseFunnelCadenceQuery = jest.fn((..._args: unknown[]) => ({
  status: "success",
  data: {
    from: new Date(2026, 8, 28).toISOString(),
    to: new Date(2026, 9, 5).toISOString(),
    hours: [],
  },
}));
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useAuthzAndMembersQuery: (...args: unknown[]) =>
    mockUseAuthzAndMembersQuery(...args),
  useFunnelQuery: (...args: unknown[]) => mockUseFunnelQuery(...args),
  useFunnelConversionQuery: (...args: unknown[]) =>
    mockUseFunnelConversionQuery(...args),
  useFunnelTrendQuery: (...args: unknown[]) => mockUseFunnelTrendQuery(...args),
  useFunnelCadenceQuery: (...args: unknown[]) =>
    mockUseFunnelCadenceQuery(...args),
  useDeleteFunnelMutation: () => mockUseDeleteFunnelMutation(),
}));

const trackMock = jest.fn();
jest.mock("@/app/utils/analytics/track", () => ({
  __esModule: true,
  track: (...args: unknown[]) => trackMock(...args),
}));

const mockOnChange = jest.fn<void, [FilterChange]>();
// Writes the key into the URL like the real hook, so the page re-reads its
// state from the URL.
const mockSetPageUrlKey = jest.fn((key: string, value: string) => {
  const params = new URLSearchParams(window.location.search);
  params.set(key, value);
  mockRouter.setUrl(params.toString());
});
const mockUseFilterPage = jest.fn();
jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  __esModule: true,
  useFilterPage: (args: unknown) => mockUseFilterPage(args),
}));

const mockFilterBar = jest.fn<void, [FilterBarProps]>();
jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: FilterBarProps) => {
    mockFilterBar(props);
    return <div data-testid="filter-bar" />;
  },
}));

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastPositive: jest.fn(),
  toastNegative: jest.fn(),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  Skeleton: () => <div data-testid="skeleton" />,
  SkeletonPlot: () => <div data-testid="skeleton-plot" />,
}));

// FunnelSteps measures its layout with ResizeObserver, which jsdom lacks.
jest.mock("@/app/components/funnel/steps", () => ({
  __esModule: true,
  default: ({ funnel }: { funnel: Funnel }) => (
    <div data-testid="funnel-steps">
      {funnel.steps.map((step) => step.event_name).join(" > ")}
    </div>
  ),
}));

jest.mock("@/app/components/funnel/chart", () => ({
  __esModule: true,
  default: ({ onSelectStep }: ChartProps) => (
    <button data-testid="funnel-chart" onClick={() => onSelectStep(2)}>
      chart
    </button>
  ),
}));

const mockTrendPlot = jest.fn<void, [TrendPlotProps]>();
jest.mock("@/app/components/funnel/trend_plot", () => ({
  __esModule: true,
  FunnelTrendMetric: { Conversion: "Conversion", Time: "Time to convert" },
  default: (props: TrendPlotProps) => {
    mockTrendPlot(props);
    return (
      <div data-testid="trend-plot">
        <button
          onClick={() => props.onSelectPoint("2026-01-05T00:00:00.000Z", 2)}
        >
          select step point
        </button>
        <button
          onClick={() => props.onSelectPoint("2026-01-05T00:00:00.000Z", null)}
        >
          select overall point
        </button>
      </div>
    );
  },
}));

const mockFriction = jest.fn<void, [FrictionProps]>();
jest.mock("@/app/components/funnel/cadence_plot", () => ({
  __esModule: true,
  default: ({
    onSelectPoint,
  }: {
    onSelectPoint: (weekday: number, hour: number) => void;
  }) => (
    <button onClick={() => onSelectPoint(3, 14)}>select cadence point</button>
  ),
}));

jest.mock("@/app/components/funnel/friction", () => ({
  __esModule: true,
  FrictionList: { Errors: "Errors", Traces: "Traces", Network: "Network" },
  ControlSeparator: () => null,
  default: (props: FrictionProps) => {
    mockFriction(props);
    return (
      <div data-testid="friction">
        <button onClick={() => props.onSelectStep(2)}>friction step</button>
        <button onClick={() => props.onOpenItem("trace")}>friction item</button>
        <button
          onClick={() => props.onSelectList("Network" as FrictionProps["list"])}
        >
          friction list
        </button>
      </div>
    );
  },
}));

const mockSessions = jest.fn<void, [SessionsProps]>();
jest.mock("@/app/components/funnel/sessions", () => ({
  __esModule: true,
  SessionsOutcome: { Dropped: "Dropped off", Converted: "Converted" },
  outcomeParams: { "Dropped off": "dropped", Converted: "converted" },
  default: (props: SessionsProps) => {
    mockSessions(props);
    return (
      <div data-testid="sessions">
        <button onClick={() => props.onSelectStep(2)}>sessions step</button>
        <button onClick={() => props.onOpenSession()}>sessions item</button>
        <button
          onClick={() =>
            props.onSelectOutcome("Converted" as SessionsProps["outcome"])
          }
        >
          sessions outcome
        </button>
      </div>
    );
  },
}));

const mockEditor = jest.fn<void, [EditorProps]>();
jest.mock("@/app/components/funnel/editor", () => ({
  __esModule: true,
  default: (props: EditorProps) => {
    mockEditor(props);
    return (
      <div data-testid="editor" data-open={String(props.open)}>
        <button
          onClick={() =>
            props.onSaved!({ ...props.funnel!, name: "Paid users" })
          }
        >
          save editor
        </button>
        <button onClick={() => props.onOpenChange(false)}>close editor</button>
      </div>
    );
  },
}));

const NBSP = "\u00a0";

const funnel: Funnel = {
  id: "funnel-1",
  app_id: "app-1",
  name: "Checkout",
  steps: [
    { event_name: "view_cart" },
    { event_name: "start_checkout" },
    { event_name: "purchase" },
  ],
  conversion_window_seconds: 7200,
  pinned: false,
  pin_order: null,
  created_by: "user-1",
  created_by_email: "ada@example.com",
  created_at: "2026-01-01T00:00:00Z",
  updated_at: "2026-01-02T10:30:00Z",
};

const filterParams = {
  appId: "app-1",
  startDate: "2026-01-01T00:00:00Z",
  endDate: "2026-01-31T00:00:00Z",
  filterExpr: null,
};

const conversion = (users: number[]) => ({
  steps: users.map((count, index) => ({
    event_name: funnel.steps[index].event_name,
    users: count,
    median_seconds_from_previous: index === 0 ? null : 60,
  })),
});

const trend = (points: number[][]) => ({
  event_names: funnel.steps.map((step) => step.event_name),
  points: points.map((users, index) => ({
    datetime: `2026-01-0${index + 1}T00:00:00Z`,
    steps: users.map((count) => ({
      users: count,
      median_seconds_from_previous: null,
    })),
    median_seconds_to_convert: null,
    complete: true,
  })),
  builds: [],
});

type QueryStatus = "pending" | "error" | "success";
const queryState = (status: QueryStatus, data?: unknown, error?: unknown) => ({
  status,
  data,
  isPending: status === "pending",
  isError: status === "error",
  error: status === "error" ? (error ?? new Error("failed")) : null,
});

const mockMutateAsync = jest.fn<Promise<unknown>, [unknown]>();

function setUp({
  funnelQuery = queryState("success", funnel),
  conversionQuery = queryState("success", conversion([1000, 400, 250])),
  trendQuery = queryState("success", trend([[100, 50, 20]])),
  filterStatus = { kind: "ready" },
  deletePending = false,
  authz = { can_change_funnels: true },
  apps = [{ id: "app-1", os_names: ["android"] }],
}: {
  funnelQuery?: ReturnType<typeof queryState>;
  conversionQuery?: ReturnType<typeof queryState>;
  trendQuery?: ReturnType<typeof queryState>;
  filterStatus?: { kind: string; message?: string };
  deletePending?: boolean;
  // null leaves the permissions loading
  authz?: { can_change_funnels: boolean } | null;
  apps?: { id: string; os_names: string[] | null }[];
} = {}) {
  mockUseAuthzAndMembersQuery.mockReturnValue({ data: authz ?? undefined });
  mockUseFunnelQuery.mockReturnValue(funnelQuery);
  mockUseFunnelConversionQuery.mockReturnValue(conversionQuery);
  mockUseFunnelTrendQuery.mockReturnValue(trendQuery);
  mockUseDeleteFunnelMutation.mockReturnValue({
    mutateAsync: mockMutateAsync,
    isPending: deletePending,
  });
  mockUseFilterPage.mockReturnValue({
    value: {},
    apps,
    keys: [],
    keyGroups: [],
    keysUnavailable: false,
    status: filterStatus,
    filterParams,
    onChange: mockOnChange,
    setPageUrlKey: mockSetPageUrlKey,
  });
}

function renderDetails(search = "") {
  if (search !== "") {
    mockRouter.setUrl(search);
  }
  return render(
    <FunnelDetails teamId="team-1" appId="app-1" funnelId="funnel-1" />,
  );
}

const lastProps = <P,>(mock: jest.Mock<void, [P]>) =>
  mock.mock.calls.at(-1)![0];

const summary = (title: string) =>
  screen.getByText(title, { selector: "p" }).parentElement!.nextElementSibling!
    .textContent;

const openedRange = () => {
  const { dateRange } = mockOnChange.mock.calls[0][0];
  return {
    kind: dateRange!.dateRange,
    start: Date.parse(dateRange!.startDate!),
    end: Date.parse(dateRange!.endDate!),
  };
};

beforeAll(() => {
  window.scrollTo = jest.fn();
});

beforeEach(() => {
  mockRouter.reset();
  setUp();
});

describe("FunnelDetails header", () => {
  it("shows a skeleton and no actions while the funnel loads", () => {
    setUp({ funnelQuery: queryState("pending") });
    renderDetails();

    expect(screen.getAllByTestId("skeleton").length).toBeGreaterThan(0);
    expect(screen.queryByLabelText("Edit funnel")).not.toBeInTheDocument();
    expect(screen.queryByLabelText("Delete funnel")).not.toBeInTheDocument();
    expect(screen.queryByTestId("editor")).not.toBeInTheDocument();
  });

  it("shows only an error message when the funnel fails to load", () => {
    setUp({ funnelQuery: queryState("error") });
    renderDetails();

    expect(
      screen.getByText(
        "Error fetching funnel, please refresh page to try again",
      ),
    ).toBeInTheDocument();
    expect(screen.queryByTestId("filter-bar")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friction")).not.toBeInTheDocument();
  });

  it("shows the name, steps, conversion window, creator and update time", () => {
    renderDetails();

    expect(screen.getByText("Checkout")).toBeInTheDocument();
    expect(screen.getByTestId("funnel-steps")).toHaveTextContent(
      "view_cart > start_checkout > purchase",
    );
    expect(screen.getByText("Conversion window: 2 hours")).toBeInTheDocument();
    expect(screen.getByText("Created by: ada@example.com")).toBeInTheDocument();
    expect(
      screen.getByText(
        `Updated: ${formatDateToHumanReadableDateTime(funnel.updated_at)}`,
      ),
    ).toBeInTheDocument();
  });

  it("shows a deleted creator as a deleted user", () => {
    setUp({
      funnelQuery: queryState("success", { ...funnel, created_by_email: null }),
    });
    renderDetails();

    expect(screen.getByText("Created by: Deleted user")).toBeInTheDocument();
  });
});

describe("FunnelDetails Breakdown view", () => {
  it("is the default view and queries conversion with the filters", () => {
    renderDetails();

    expect(
      screen.getByText("Breakdown", { selector: "p" }),
    ).toBeInTheDocument();
    expect(mockUseFunnelConversionQuery).toHaveBeenCalledWith(
      filterParams,
      "funnel-1",
      true,
    );
    expect(mockUseFunnelTrendQuery).toHaveBeenCalledWith(
      filterParams,
      "funnel-1",
      "week",
      true,
      false,
    );
    expect(lastProps(mockFilterBar).showDateRange).toBe(true);
    expect(screen.queryByTestId("trend-plot")).not.toBeInTheDocument();
    expect(screen.queryByText("Weekly")).not.toBeInTheDocument();
  });

  it("falls back to the Breakdown view for an unknown view in the URL", () => {
    renderDetails("fv=Pie");

    expect(
      screen.getByText("Breakdown", { selector: "p" }),
    ).toBeInTheDocument();
  });

  it("summarises the conversion from the first to the last step", () => {
    renderDetails();

    expect(summary("Breakdown")).toBe("25% converted · 250 of 1K users");
  });

  it("shows a skeleton and a placeholder summary while conversion loads", () => {
    setUp({ conversionQuery: queryState("pending") });
    renderDetails();

    expect(screen.getByTestId("skeleton-plot")).toBeInTheDocument();
    expect(summary("Breakdown")).toBe(NBSP);
    expect(screen.queryByTestId("funnel-chart")).not.toBeInTheDocument();
  });

  it("shows an error when conversion fails", () => {
    setUp({ conversionQuery: queryState("error") });
    renderDetails();

    expect(
      screen.getByText(
        "Error fetching plot, please change filters or refresh page to try again",
      ),
    ).toBeInTheDocument();
    expect(summary("Breakdown")).toBe(NBSP);
    expect(lastProps(mockFriction).conversionFailed).toBe(true);
    expect(lastProps(mockFilterBar).filterExprIssues).toBeNull();
  });

  it("hands a refused filter to the filter bar without the plot error", () => {
    const issues = [{ message: "unknown key os" }];
    setUp({
      conversionQuery: queryState(
        "error",
        undefined,
        new ApiError(400, invalidFilterExpr, issues),
      ),
    });
    renderDetails();

    expect(lastProps(mockFilterBar).filterExprIssues).toEqual(issues);
    expect(screen.queryByText(/Error fetching plot/)).not.toBeInTheDocument();
  });

  it("shows an empty state when no users entered the funnel", () => {
    setUp({ conversionQuery: queryState("success", conversion([0, 0, 0])) });
    renderDetails();

    expect(
      screen.getByText("No users entered this funnel"),
    ).toBeInTheDocument();
    expect(screen.getByText("Try different filters")).toBeInTheDocument();
    expect(screen.queryByTestId("funnel-chart")).not.toBeInTheDocument();
    expect(summary("Breakdown")).toBe(NBSP);
  });

  it("opens the friction section for a step chosen on the chart", () => {
    renderDetails();
    expect(lastProps(mockFriction).selectedStep).toBeNull();

    fireEvent.click(screen.getByTestId("funnel-chart"));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fs", "2");
    expect(lastProps(mockFriction).selectedStep).toBe(2);
  });

  it("writes a step chosen in the friction section to the URL", () => {
    renderDetails();

    fireEvent.click(screen.getByText("friction step"));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fs", "2");
    expect(lastProps(mockFriction).selectedStep).toBe(2);
  });

  it("reads the friction list from the URL and writes a new one to it", () => {
    renderDetails("fl=Traces");
    expect(lastProps(mockFriction).list).toBe("Traces");

    fireEvent.click(screen.getByText("friction list"));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fl", "Network");
    expect(lastProps(mockFriction).list).toBe("Network");
  });

  it("falls back to the errors list for an unknown list in the URL", () => {
    renderDetails("fl=Logs");

    expect(lastProps(mockFriction).list).toBe("Errors");
  });

  it("gives the session replays the friction section's step and the filters", () => {
    renderDetails("fs=2");

    expect(lastProps(mockSessions).selectedStep).toBe(2);
    expect(lastProps(mockSessions).params).toEqual(filterParams);
  });

  it("writes a step chosen in the session replays to the URL", () => {
    renderDetails();

    fireEvent.click(screen.getByText("sessions step"));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fs", "2");
    expect(lastProps(mockFriction).selectedStep).toBe(2);
    expect(lastProps(mockSessions).selectedStep).toBe(2);
  });

  it("shows drop-offs first and writes a chosen outcome to the URL", () => {
    renderDetails();
    expect(lastProps(mockSessions).outcome).toBe("Dropped off");

    fireEvent.click(screen.getByText("sessions outcome"));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fo", "Converted");
    expect(lastProps(mockSessions).outcome).toBe("Converted");
  });

  it("falls back to drop-offs for an unknown outcome in the URL", () => {
    renderDetails("fo=Both");

    expect(lastProps(mockSessions).outcome).toBe("Dropped off");
  });

  it.each([
    ["no step", "", null],
    ["the whole funnel", "fs=overall", null],
    ["the second transition", "fs=2", 2],
    ["a step past the last transition", "fs=3", null],
    ["step zero", "fs=0", null],
    ["a fraction", "fs=1.5", null],
    ["a non-number", "fs=two", null],
  ])("selects the right step for %s in the URL", (_, search, expected) => {
    renderDetails(search);

    expect(lastProps(mockFriction).selectedStep).toBe(expected);
  });

  it("selects the whole funnel when a saved edit removed the step before the conversion refetches", () => {
    setUp({
      funnelQuery: queryState("success", {
        ...funnel,
        steps: funnel.steps.slice(0, 2),
      }),
    });
    renderDetails("fs=2");

    expect(lastProps(mockFriction).selectedStep).toBeNull();
  });

  it("selects the whole funnel until the conversion loads", () => {
    setUp({ conversionQuery: queryState("pending") });
    renderDetails("fs=2");

    expect(lastProps(mockFriction).selectedStep).toBeNull();
  });

  it("shows the filter error in place of the funnel and friction", () => {
    setUp({
      filterStatus: { kind: "error", message: "Error fetching filters" },
    });
    renderDetails();

    expect(screen.getByText("Error fetching filters")).toBeInTheDocument();
    expect(
      screen.queryByText("Breakdown", { selector: "p" }),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("funnel-chart")).not.toBeInTheDocument();
    expect(screen.queryByTestId("friction")).not.toBeInTheDocument();
  });
});

describe("FunnelDetails Trend view", () => {
  it("switches to the Trend view through the URL", () => {
    renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Trend" }));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fv", "Trend");
    expect(screen.getByText("Trend", { selector: "p" })).toBeInTheDocument();
    expect(screen.getByTestId("trend-plot")).toBeInTheDocument();
    expect(screen.queryByTestId("friction")).not.toBeInTheDocument();
    expect(screen.queryByTestId("funnel-chart")).not.toBeInTheDocument();
  });

  it("queries the trend with the filters and the weekly period by default", () => {
    renderDetails("fv=Trend");

    expect(mockUseFunnelTrendQuery).toHaveBeenCalledWith(
      filterParams,
      "funnel-1",
      "week",
      true,
      true,
    );
    expect(mockUseFunnelConversionQuery).toHaveBeenCalledWith(
      filterParams,
      "funnel-1",
      false,
    );
    expect(lastProps(mockFilterBar).showDateRange).toBe(false);
  });

  it("passes the trend and its status to the plot", () => {
    renderDetails("fv=Trend");

    expect(lastProps(mockTrendPlot).trend).toEqual(trend([[100, 50, 20]]));
    expect(lastProps(mockTrendPlot).status).toBe("success");
  });

  it("keeps the plot pending until the funnel loads", () => {
    setUp({ funnelQuery: queryState("pending") });
    renderDetails("fv=Trend");

    expect(lastProps(mockTrendPlot).status).toBe("pending");
  });

  it("hands a refused filter from the trend to the filter bar", () => {
    const issues = [{ message: "unknown key os" }];
    setUp({
      trendQuery: queryState(
        "error",
        undefined,
        new ApiError(400, invalidFilterExpr, issues),
      ),
    });
    renderDetails("fv=Trend");

    expect(lastProps(mockFilterBar).filterExprIssues).toEqual(issues);
  });

  it("summarises every period of the trend with the period span", () => {
    setUp({
      trendQuery: queryState(
        "success",
        trend([
          [600, 300, 100],
          [400, 200, 150],
        ]),
      ),
    });
    renderDetails("fv=Trend");

    expect(summary("Trend")).toBe("25% converted · 250 of 1K users");
  });

  it("summarises when only some periods had users", () => {
    setUp({
      trendQuery: queryState(
        "success",
        trend([
          [0, 0, 0],
          [200, 100, 50],
        ]),
      ),
    });
    renderDetails("fv=Trend&fp=day");

    expect(summary("Trend")).toBe("25% converted · 50 of 200 users");
  });

  it("shows a placeholder summary when no period had users", () => {
    setUp({
      trendQuery: queryState(
        "success",
        trend([
          [0, 0, 0],
          [0, 0, 0],
        ]),
      ),
    });
    renderDetails("fv=Trend");

    expect(summary("Trend")).toBe(NBSP);
  });

  it("shows a placeholder summary while the trend loads", () => {
    setUp({ trendQuery: queryState("pending") });
    renderDetails("fv=Trend");

    expect(summary("Trend")).toBe(NBSP);
  });

  it.each([
    ["day", "day"],
    ["month", "month"],
    ["year", "week"],
  ])("uses fp=%s from the URL as the %s period", (urlPeriod, period) => {
    renderDetails(`fv=Trend&fp=${urlPeriod}`);

    expect(mockUseFunnelTrendQuery).toHaveBeenLastCalledWith(
      filterParams,
      "funnel-1",
      period,
      true,
      true,
    );
    expect(lastProps(mockTrendPlot).period).toBe(period);
  });

  it("writes a chosen period to the URL", () => {
    renderDetails("fv=Trend");

    fireEvent.click(screen.getByRole("button", { name: "Monthly" }));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fp", "month");
    expect(lastProps(mockTrendPlot).period).toBe("month");
  });

  it.each([
    ["1", 1],
    ["12", 12],
    ["52", 4],
  ])("uses fw=%s from the URL as %d weeks of cadence", (urlWeeks, weeks) => {
    renderDetails(`fv=Cadence&fw=${urlWeeks}`);

    expect(mockUseFunnelCadenceQuery).toHaveBeenLastCalledWith(
      filterParams,
      "funnel-1",
      weeks,
      true,
    );
  });

  it("writes a chosen cadence span to the URL", () => {
    renderDetails("fv=Cadence");

    fireEvent.click(screen.getByRole("button", { name: "12 weeks" }));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fw", "12");
    expect(mockUseFunnelCadenceQuery).toHaveBeenLastCalledWith(
      filterParams,
      "funnel-1",
      12,
      true,
    );
  });

  it("writes a chosen metric to the URL", () => {
    renderDetails("fv=Trend");

    fireEvent.click(screen.getByRole("button", { name: "Time to convert" }));

    expect(mockSetPageUrlKey).toHaveBeenCalledWith("fm", "Time to convert");
    expect(lastProps(mockTrendPlot).metric).toBe("Time to convert");
  });

  it("falls back to the conversion metric for an unknown metric", () => {
    renderDetails("fv=Trend&fm=Revenue");

    expect(lastProps(mockTrendPlot).metric).toBe("Conversion");
  });

  it("opens a step's period at the top of the Breakdown view with the step selected", () => {
    renderDetails("fv=Trend");

    fireEvent.click(screen.getByText("select step point"));

    expect(openedRange()).toEqual({
      kind: DateRange.Custom,
      start: Date.parse("2026-01-05T00:00:00.000Z"),
      end: Date.parse("2026-01-12T00:00:00.000Z"),
    });
    expect(mockSetPageUrlKey.mock.calls).toEqual([
      ["fs", "2"],
      ["fv", "Breakdown"],
    ]);
    expect(lastProps(mockFriction).selectedStep).toBe(2);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "instant",
    });
  });

  it("opens the whole period picked for the trend", () => {
    renderDetails("fv=Trend&fp=day");

    fireEvent.click(screen.getByText("select step point"));

    expect(openedRange()).toMatchObject({
      start: Date.parse("2026-01-05T00:00:00.000Z"),
      end: Date.parse("2026-01-06T00:00:00.000Z"),
    });
  });

  it("opens the overall line's period for the whole funnel at the top of the Breakdown view", () => {
    renderDetails("fv=Trend");

    fireEvent.click(screen.getByText("select overall point"));

    expect(mockOnChange).toHaveBeenCalledTimes(1);
    expect(mockSetPageUrlKey.mock.calls).toEqual([
      ["fs", "overall"],
      ["fv", "Breakdown"],
    ]);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "instant",
    });
  });

  it("opens a cadence point's hour in the cadence's last week for the whole funnel at the top of the Breakdown view", () => {
    renderDetails("fv=Cadence");

    fireEvent.click(screen.getByText("select cadence point"));

    // The Wednesday before the cadence's end on Monday 5 October.
    expect(openedRange()).toEqual({
      kind: DateRange.Custom,
      start: new Date(2026, 8, 30, 14).valueOf(),
      end: new Date(2026, 8, 30, 15).valueOf(),
    });
    expect(mockSetPageUrlKey.mock.calls).toEqual([
      ["fs", "overall"],
      ["fv", "Breakdown"],
    ]);
    expect(window.scrollTo).toHaveBeenCalledWith({
      top: 0,
      behavior: "instant",
    });
  });

  it("does not scroll when the Breakdown view is chosen from the tabs", () => {
    renderDetails("fv=Trend");

    fireEvent.click(screen.getByRole("button", { name: "Breakdown" }));

    expect(
      screen.getByText("Breakdown", { selector: "p" }),
    ).toBeInTheDocument();
    expect(window.scrollTo).not.toHaveBeenCalled();
  });
});

describe("FunnelDetails permissions", () => {
  it("reads the permissions of the team", () => {
    renderDetails();

    expect(mockUseAuthzAndMembersQuery).toHaveBeenCalledWith("team-1");
  });

  it("enables edit and delete when the role can change funnels", () => {
    renderDetails();

    expect(screen.getByLabelText("Edit funnel")).toBeEnabled();
    expect(screen.getByLabelText("Delete funnel")).toBeEnabled();
  });

  it.each([
    ["the role cannot change funnels", { can_change_funnels: false }],
    ["the permissions have not loaded", null],
  ])("disables edit and delete when %s", (_, authz) => {
    setUp({ authz });
    renderDetails();

    expect(screen.getByLabelText("Edit funnel")).toBeDisabled();
    expect(screen.getByLabelText("Delete funnel")).toBeDisabled();
  });
});

describe("FunnelDetails edit", () => {
  it("opens the editor with the funnel", () => {
    renderDetails();
    expect(screen.getByTestId("editor")).toHaveAttribute("data-open", "false");

    fireEvent.click(screen.getByLabelText("Edit funnel"));

    expect(screen.getByTestId("editor")).toHaveAttribute("data-open", "true");
    expect(lastProps(mockEditor).funnel).toBe(funnel);
    expect(lastProps(mockEditor).appId).toBe("app-1");
  });

  it("closes the editor when it asks to", () => {
    renderDetails();
    fireEvent.click(screen.getByLabelText("Edit funnel"));

    fireEvent.click(screen.getByText("close editor"));

    expect(screen.getByTestId("editor")).toHaveAttribute("data-open", "false");
  });

  it("tracks the saved edit", () => {
    renderDetails();

    fireEvent.click(screen.getByText("save editor"));

    expect(trackMock).toHaveBeenCalledWith("funnel_edited", {
      team_id: "team-1",
      app_id: "app-1",
      app_platform: "android",
      feature_area: "funnels",
      entry_point: "direct",
    });
  });
});

describe("FunnelDetails delete", () => {
  const openDialog = () => {
    fireEvent.click(screen.getByLabelText("Delete funnel"));
    return screen.getByRole("dialog");
  };

  it("asks for confirmation with the funnel name", () => {
    renderDetails();

    const dialog = openDialog();

    expect(dialog).toHaveTextContent(
      "Delete funnel Checkout? This cannot be undone.",
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("closes without deleting on cancel", async () => {
    renderDetails();
    const dialog = openDialog();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));

    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
    expect(mockMutateAsync).not.toHaveBeenCalled();
  });

  it("deletes the funnel, confirms it, and goes back to the funnels list", async () => {
    mockMutateAsync.mockResolvedValueOnce(undefined);
    renderDetails();
    const dialog = openDialog();

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete funnel" }),
      );
    });

    expect(mockMutateAsync).toHaveBeenCalledWith({
      appId: "app-1",
      funnelId: "funnel-1",
    });
    expect(toastPositive).toHaveBeenCalledWith(
      "Funnel Checkout has been deleted",
    );
    expect(mockRouter.pushMock).toHaveBeenCalledWith("/team-1/funnels");
    expect(trackMock).toHaveBeenCalledWith("funnel_deleted", {
      team_id: "team-1",
      app_id: "app-1",
      app_platform: "android",
      feature_area: "funnels",
      entry_point: "direct",
    });
    expect(toastNegative).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument(),
    );
  });

  it("reports a failed delete and stays on the page", async () => {
    mockMutateAsync.mockRejectedValueOnce(new Error("Funnel is in use"));
    renderDetails();
    const dialog = openDialog();

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete funnel" }),
      );
    });

    expect(toastNegative).toHaveBeenCalledWith(
      "Error deleting funnel: Funnel is in use",
    );
    expect(toastPositive).not.toHaveBeenCalled();
    expect(mockRouter.pushMock).not.toHaveBeenCalled();
    expect(trackMock).not.toHaveBeenCalledWith(
      "funnel_deleted",
      expect.anything(),
    );
  });

  it("reports an unknown error when the failure is not an Error", async () => {
    mockMutateAsync.mockRejectedValueOnce("offline");
    renderDetails();
    const dialog = openDialog();

    await act(async () => {
      fireEvent.click(
        within(dialog).getByRole("button", { name: "Delete funnel" }),
      );
    });

    expect(toastNegative).toHaveBeenCalledWith(
      "Error deleting funnel: Unknown error",
    );
  });

  it("disables the delete button while the delete is in flight", () => {
    setUp({ deletePending: true });
    renderDetails();

    expect(screen.getByLabelText("Delete funnel")).toBeDisabled();
  });
});

describe("FunnelDetails analytics", () => {
  it("tracks the view with the entry point the URL names", () => {
    renderDetails("from=pinned");

    expect(trackMock).toHaveBeenCalledWith("funnel_investigated", {
      team_id: "team-1",
      app_id: "app-1",
      app_platform: "android",
      feature_area: "funnels",
      entry_point: "pinned",
    });
  });

  it("tracks a direct entry when the URL names none", () => {
    renderDetails();

    expect(trackMock).toHaveBeenCalledWith(
      "funnel_investigated",
      expect.objectContaining({ entry_point: "direct" }),
    );
  });

  it("tracks a view of an app without platforms", () => {
    setUp({ apps: [{ id: "app-1", os_names: null }] });
    renderDetails();

    expect(trackMock).toHaveBeenCalledWith(
      "funnel_investigated",
      expect.objectContaining({ app_platform: undefined }),
    );
  });

  it("tracks a funnel view once, not again when the funnel and apps refetch", () => {
    const { rerender } = renderDetails();

    setUp({
      funnelQuery: queryState("success", { ...funnel, name: "Paid users" }),
      apps: [{ id: "app-1", os_names: ["android"] }],
    });
    rerender(
      <FunnelDetails teamId="team-1" appId="app-1" funnelId="funnel-1" />,
    );

    expect(screen.getByText("Paid users")).toBeInTheDocument();
    expect(trackMock).toHaveBeenCalledTimes(1);
  });

  it("does not track before the funnel has loaded", () => {
    setUp({ funnelQuery: queryState("pending") });
    renderDetails();

    expect(trackMock).not.toHaveBeenCalled();
  });

  it("does not track before the app has loaded", () => {
    setUp({ apps: [] });
    renderDetails();

    expect(trackMock).not.toHaveBeenCalled();
  });
});

describe("FunnelDetails interaction analytics", () => {
  const shared = {
    team_id: "team-1",
    app_id: "app-1",
    app_platform: "android",
    feature_area: "funnels",
    entry_point: "direct",
  };
  const callsOf = (name: string) =>
    trackMock.mock.calls
      .filter(([event]) => event === name)
      .map(([, props]) => props);

  it("tracks a view picked from the tabs, but not the one already shown", () => {
    renderDetails();

    fireEvent.click(screen.getByRole("button", { name: "Breakdown" }));
    fireEvent.click(screen.getByRole("button", { name: "Trend" }));

    expect(callsOf("funnel_view_switched")).toEqual([
      { ...shared, section: "view", selected: "trend" },
    ]);
  });

  it("tracks a friction list picked from the tabs", () => {
    renderDetails();

    fireEvent.click(screen.getByText("friction list"));

    expect(callsOf("funnel_view_switched")).toEqual([
      { ...shared, section: "friction", selected: "network" },
    ]);
  });

  it("tracks a session replays outcome picked from the tabs", () => {
    renderDetails();

    fireEvent.click(screen.getByText("sessions outcome"));

    expect(callsOf("funnel_view_switched")).toEqual([
      { ...shared, section: "sessions", selected: "converted" },
    ]);
  });

  it.each([
    ["chart", () => screen.getByTestId("funnel-chart")],
    ["friction", () => screen.getByText("friction step")],
    ["sessions", () => screen.getByText("sessions step")],
  ])("tracks a step picked in the %s", (source, control) => {
    renderDetails();

    fireEvent.click(control());

    expect(callsOf("funnel_step_selected")).toEqual([
      { ...shared, step: 2, source },
    ]);
  });

  it("does not track picking the step that is already selected", () => {
    renderDetails("fs=2");

    fireEvent.click(screen.getByTestId("funnel-chart"));
    fireEvent.click(screen.getByText("friction step"));

    expect(callsOf("funnel_step_selected")).toEqual([]);
  });

  it("tracks a clicked friction item and session with the selected step", () => {
    renderDetails("fs=2");

    fireEvent.click(screen.getByText("friction item"));
    fireEvent.click(screen.getByText("sessions item"));

    expect(callsOf("funnel_friction_item_clicked")).toEqual([
      { ...shared, target: "trace", step: 2 },
      { ...shared, target: "session", step: 2 },
    ]);
  });

  it("tracks a clicked friction item for the whole funnel", () => {
    renderDetails();

    fireEvent.click(screen.getByText("friction item"));

    expect(callsOf("funnel_friction_item_clicked")).toEqual([
      { ...shared, target: "trace", step: "overall" },
    ]);
  });

  it("tracks a point picked on the trend with its period, metric and step", () => {
    renderDetails("fv=Trend&fp=day");

    fireEvent.click(screen.getByText("select step point"));

    expect(callsOf("funnel_chart_point_selected")).toEqual([
      {
        ...shared,
        view: "trend",
        period: "day",
        metric: "Conversion",
        step: 2,
      },
    ]);
    expect(callsOf("funnel_step_selected")).toEqual([]);
    expect(callsOf("funnel_view_switched")).toEqual([]);
  });

  it("tracks a point picked on the trend's overall line for the whole funnel", () => {
    renderDetails("fv=Trend");

    fireEvent.click(screen.getByText("select overall point"));

    expect(callsOf("funnel_chart_point_selected")).toEqual([
      expect.objectContaining({ view: "trend", step: "overall" }),
    ]);
  });

  it("tracks a point picked on the cadence", () => {
    renderDetails("fv=Cadence");

    fireEvent.click(screen.getByText("select cadence point"));

    expect(callsOf("funnel_chart_point_selected")).toEqual([
      { ...shared, view: "cadence" },
    ]);
  });
});

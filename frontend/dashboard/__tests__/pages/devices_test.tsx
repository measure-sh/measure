import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  ApiError,
  invalidFilterExpr,
  type FilterExprIssue,
} from "@/app/api/api_error";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen, within } from "@testing-library/react";

type MockQuery = {
  status: string;
  data?: unknown;
  error: Error | null;
  isFetching?: boolean;
};

const mockUseFilterPage = jest.fn();
const mockPush = jest.fn();
const mockUseDevicesListQuery = jest.fn((..._args: unknown[]): MockQuery => ({
  status: "pending",
  error: null,
}));
const mockUseDevicesSessionsPlotQuery = jest.fn(
  (..._args: unknown[]): MockQuery => ({ status: "pending", error: null }),
);
const mockUseRootSpanNamesQuery = jest.fn((..._args: unknown[]): MockQuery => ({
  status: "pending",
  error: null,
}));

jest.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams("d=Last+7+Days"),
  useRouter: () => ({ push: mockPush }),
}));
jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  useFilterPage: (...args: unknown[]) => mockUseFilterPage(...args),
}));
jest.mock("@/app/query/hooks", () => ({
  DEVICES_LIST_LIMIT: 5,
  useDevicesListQuery: (...args: unknown[]) => mockUseDevicesListQuery(...args),
  useDevicesSessionsPlotQuery: (...args: unknown[]) =>
    mockUseDevicesSessionsPlotQuery(...args),
  useRootSpanNamesQuery: (...args: unknown[]) =>
    mockUseRootSpanNamesQuery(...args),
}));
jest.mock("@/app/components/devices/sessions_plot", () => () => (
  <div data-testid="devices-sessions-plot" />
));
jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: ({
    entity,
    filterExprIssues,
  }: {
    entity: string;
    filterExprIssues: FilterExprIssue[] | null;
  }) => (
    <div data-testid="filter-bar-mock" data-entity={entity}>
      {filterExprIssues?.map((issue) => (
        <p key={issue.message}>{issue.message}</p>
      ))}
    </div>
  ),
}));
jest.mock("@/app/components/skeleton", () => ({
  ...jest.requireActual("@/app/components/skeleton"),
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

import DevicesPage from "@/app/[teamId]/devices/page";

const pixel = {
  device_manufacturer: "Google",
  device_model: "Pixel 8",
  device_name: "shiba",
};

const rowsByList: Record<string, unknown> = {
  sessions: { ...pixel, session_count: 30, percent_of_sessions: 75 },
  errors: {
    ...pixel,
    crash_count: 2,
    anr_count: 1,
    app_hang_count: 0,
    non_fatal_count: 3,
    error_count: 6,
    session_count: 4,
  },
  launches: { ...pixel, p50: 100, p90: 200, p95: 300, count: 4 },
  spans: { ...pixel, p50: 100, p90: 200, p95: 300, count: 4 },
  memory: {
    ...pixel,
    p50: 1024,
    p90: 2048,
    p95: 4096,
    session_count: 5,
    sample_count: 50,
  },
};

function lastCallFor(list: string) {
  const calls = mockUseDevicesListQuery.mock.calls.filter(
    (call) => call[0] === list,
  );
  return calls[calls.length - 1];
}

describe("DevicesPage", () => {
  const params = promiseParams({ teamId: "team-1" });

  function setApp(osName: string) {
    const filterParams = {
      appId: "app-1",
      startDate: "2026-01-05",
      endDate: "2026-01-06",
      filterExpr: "version_name:in:1.0",
    };
    mockUseFilterPage.mockReturnValue({
      status: { kind: "ready" },
      value: {
        app: { id: "app-1", os_names: [osName] },
        date: { startDate: "2026-01-05", endDate: "2026-01-06" },
      },
      filterParams,
    });
    return filterParams;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseDevicesListQuery.mockImplementation((list) => ({
      status: "success",
      error: null,
      isFetching: false,
      data: {
        results: [rowsByList[list as string]],
        meta: { next: true, previous: false },
      },
    }));
    mockUseDevicesSessionsPlotQuery.mockReturnValue({
      status: "success",
      error: null,
      data: [],
    });
    mockUseRootSpanNamesQuery.mockReturnValue({
      status: "success",
      error: null,
      data: ["checkout", "search"],
    });
  });

  it("renders loading state while filters resolve", () => {
    mockUseFilterPage.mockReturnValue({
      status: { kind: "loading" },
      value: null,
      filterParams: null,
    });
    render(<DevicesPage params={params} />);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(mockUseDevicesSessionsPlotQuery).toHaveBeenLastCalledWith(null);
  });

  it("filters by the devices entity and sends the filter to every list", () => {
    const filterParams = setApp("android");
    render(<DevicesPage params={params} />);

    expect(mockUseFilterPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity: "devices" }),
    );
    expect(screen.getByTestId("filter-bar-mock")).toHaveAttribute(
      "data-entity",
      "devices",
    );
    expect(mockUseDevicesSessionsPlotQuery).toHaveBeenLastCalledWith(
      filterParams,
    );
    expect(lastCallFor("sessions")).toEqual([
      "sessions",
      filterParams,
      "desc",
      0,
      {},
      true,
    ]);
    expect(lastCallFor("launches")).toEqual([
      "launches",
      filterParams,
      "desc",
      0,
      { launch_type: "cold_launch", percentile: "p95" },
      true,
    ]);
    expect(lastCallFor("spans")).toEqual([
      "spans",
      filterParams,
      "desc",
      0,
      { span_name: "checkout", percentile: "p95" },
      true,
    ]);
    expect(lastCallFor("errors")?.[1]).toBe(filterParams);
    expect(lastCallFor("memory")?.[1]).toBe(filterParams);
    expect(lastCallFor("memory")?.[4]).toEqual({ percentile: "p95" });
    expect(screen.getByTestId("devices-sessions-plot")).toBeInTheDocument();
  });

  it("passes filter validation errors to the filter bar", () => {
    setApp("android");
    mockUseDevicesSessionsPlotQuery.mockReturnValue({
      status: "error",
      error: new ApiError(400, invalidFilterExpr, [
        { message: "Unknown filter key" },
      ]),
    });
    render(<DevicesPage params={params} />);
    expect(screen.getByText("Unknown filter key")).toBeInTheDocument();
  });

  it("shows the manufacturer and device name under the model", () => {
    setApp("android");
    render(<DevicesPage params={params} />);
    const sessions = screen.getByTestId("devices-sessions");
    expect(within(sessions).getByText("Pixel 8")).toBeInTheDocument();
    expect(within(sessions).getByText("Google, shiba")).toBeInTheDocument();
  });

  it("ranks a list from the lowest value and pages through it", () => {
    setApp("android");
    render(<DevicesPage params={params} />);
    const errors = screen.getByTestId("devices-errors");

    fireEvent.click(within(errors).getByText("Next"));
    expect(lastCallFor("errors")?.[2]).toBe("desc");
    expect(lastCallFor("errors")?.[3]).toBe(5);
    expect(lastCallFor("sessions")?.[3]).toBe(0);

    fireEvent.click(within(errors).getByText("Lowest"));
    expect(lastCallFor("errors")?.[2]).toBe("asc");
    expect(lastCallFor("errors")?.[3]).toBe(0);
  });

  it("ranks a duration list by the selected percentile", () => {
    setApp("android");
    render(<DevicesPage params={params} />);
    const launches = screen.getByTestId("devices-launches");
    const headers = () =>
      within(launches)
        .getAllByRole("columnheader")
        .map((header) => header.textContent);
    expect(headers()).toEqual(["Device", "p95", "Launches"]);
    fireEvent.click(within(launches).getByText("Next"));
    expect(lastCallFor("launches")?.[3]).toBe(5);

    fireEvent.click(within(launches).getByRole("button", { name: "p50" }));
    expect(lastCallFor("launches")?.[3]).toBe(0);
    expect(lastCallFor("launches")?.[4]).toEqual({
      launch_type: "cold_launch",
      percentile: "p50",
    });
    expect(headers()).toEqual(["Device", "p50", "Launches"]);
    expect(lastCallFor("memory")?.[4]).toEqual({ percentile: "p95" });
    expect(
      within(screen.getByTestId("devices-sessions")).queryByRole("button", {
        name: "p50",
      }),
    ).not.toBeInTheDocument();
  });

  it("makes each row open the device's errors, profiles, traces and memory", () => {
    setApp("android");
    render(<DevicesPage params={params} />);
    const device =
      'device_manufacturer:in:Google AND device_model:in:"Pixel 8"';
    const hrefOf = (testId: string) =>
      new URL(
        within(screen.getByTestId(testId))
          .getByRole("link", { name: "Google Pixel 8" })
          .getAttribute("href")!,
        "http://localhost",
      );

    const errors = hrefOf("devices-errors");
    expect(errors.pathname).toBe("/team-1/errors");
    expect(errors.searchParams.get("a")).toBe("app-1");
    expect(errors.searchParams.get("d")).toBe("Last 7 Days");
    expect(errors.searchParams.get("filter_expr")).toBe(device);

    expect(hrefOf("devices-launches").pathname).toBe("/team-1/profiles");

    const traces = hrefOf("devices-spans");
    expect(traces.pathname).toBe("/team-1/traces");
    expect(traces.searchParams.get("r")).toBe("checkout");
    expect(traces.searchParams.get("filter_expr")).toBe(device);

    const memory = hrefOf("devices-memory");
    expect(memory.pathname).toBe("/team-1/memory");
    expect(memory.searchParams.get("filter_expr")).toBe(device);

    expect(
      within(screen.getByTestId("devices-sessions")).queryByRole("link"),
    ).not.toBeInTheDocument();
  });

  it("opens a row's page with the keyboard", () => {
    setApp("android");
    render(<DevicesPage params={params} />);
    const row = within(screen.getByTestId("devices-errors")).getByTestId(
      "devices-errors-row",
    );
    fireEvent.keyDown(row, { key: "Enter" });
    expect(mockPush).toHaveBeenCalledWith(
      expect.stringMatching(/^\/team-1\/errors\?/),
    );
  });

  it("shows app hangs and no profile links for an iOS app", () => {
    setApp("ios");
    render(<DevicesPage params={params} />);
    const errors = screen.getByTestId("devices-errors");
    expect(within(errors).getByText("App hangs")).toBeInTheDocument();
    expect(within(errors).queryByText("ANRs")).not.toBeInTheDocument();
    expect(
      within(screen.getByTestId("devices-launches")).queryByRole("link"),
    ).not.toBeInTheDocument();
  });

  it("asks for no span list when the app has no traces", () => {
    setApp("android");
    mockUseRootSpanNamesQuery.mockReturnValue({
      status: "success",
      error: null,
      data: [],
    });
    render(<DevicesPage params={params} />);
    expect(lastCallFor("spans")?.[5]).toBe(false);
    expect(
      screen.getByText("No traces received for this app yet"),
    ).toBeInTheDocument();
  });
});

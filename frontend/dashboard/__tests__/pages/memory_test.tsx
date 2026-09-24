import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  ApiError,
  invalidFilterExpr,
  type FilterExprIssue,
} from "@/app/api/api_error";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";

const mockUseFilterPage = jest.fn();
const mockUseMemoryUsagePlotQuery = jest.fn((..._args: unknown[]) => ({
  status: "pending",
  error: null as Error | null,
}));
const mockUseMemoryUsageBreakdownQuery = jest.fn((..._args: unknown[]) => ({
  status: "pending",
  error: null as Error | null,
}));
const mockUseHighMemoryUsageSessionsQuery = jest.fn((..._args: unknown[]) => ({
  status: "pending",
  error: null as Error | null,
}));

jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  useFilterPage: (...args: unknown[]) => mockUseFilterPage(...args),
}));
jest.mock("@/app/query/hooks", () => ({
  HIGH_MEMORY_USAGE_SESSIONS_LIMIT: 5,
  useMemoryUsagePlotQuery: (...args: unknown[]) =>
    mockUseMemoryUsagePlotQuery(...args),
  useMemoryUsageBreakdownQuery: (...args: unknown[]) =>
    mockUseMemoryUsageBreakdownQuery(...args),
  useHighMemoryUsageSessionsQuery: (...args: unknown[]) =>
    mockUseHighMemoryUsageSessionsQuery(...args),
}));
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
jest.mock("@/app/components/memory_usage_plot", () => () => (
  <div data-testid="memory-plot" />
));
jest.mock("@/app/components/memory_usage_breakdown", () => () => (
  <div data-testid="memory-breakdown" />
));
jest.mock("@/app/components/high_memory_usage_sessions", () => () => (
  <div data-testid="high-memory-sessions" />
));

import MemoryPage from "@/app/[teamId]/memory/page";

describe("MemoryPage", () => {
  const params = promiseParams({ teamId: "team-1" });

  function setApp() {
    const filterParams = {
      appId: "android-app",
      startDate: "2026-01-05",
      endDate: "2026-01-06",
      filterExpr: null,
    };
    mockUseFilterPage.mockReturnValue({
      status: { kind: "ready" },
      value: {
        app: { id: "android-app", os_names: ["android"] },
        date: { startDate: "2026-01-05", endDate: "2026-01-06" },
      },
      filterParams,
      paginationOffset: 0,
    });
    return filterParams;
  }

  beforeEach(() => {
    jest.clearAllMocks();
    mockUseMemoryUsagePlotQuery.mockReturnValue({
      status: "success",
      error: null,
    });
    mockUseMemoryUsageBreakdownQuery.mockReturnValue({
      status: "success",
      error: null,
    });
    mockUseHighMemoryUsageSessionsQuery.mockReturnValue({
      status: "success",
      error: null,
    });
  });

  it("renders loading state while filters resolve", () => {
    mockUseFilterPage.mockReturnValue({
      status: { kind: "loading" },
      value: null,
      filterParams: null,
      paginationOffset: 0,
    });
    render(<MemoryPage params={params} />);
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(screen.queryByTestId("memory-plot")).not.toBeInTheDocument();
    expect(mockUseMemoryUsagePlotQuery).toHaveBeenLastCalledWith(null);
  });

  it("renders filter loading errors", () => {
    mockUseFilterPage.mockReturnValue({
      status: { kind: "error", message: "Unable to load apps" },
      value: null,
      filterParams: null,
      paginationOffset: 0,
    });
    render(<MemoryPage params={params} />);
    expect(screen.getByText("Unable to load apps")).toBeInTheDocument();
  });

  it.each([
    { name: "plot", query: mockUseMemoryUsagePlotQuery },
    { name: "breakdown", query: mockUseMemoryUsageBreakdownQuery },
    { name: "sessions", query: mockUseHighMemoryUsageSessionsQuery },
  ])("passes $name filter validation errors to the filter bar", ({ query }) => {
    setApp();
    query.mockReturnValue({
      status: "error",
      error: new ApiError(400, invalidFilterExpr, [
        { message: "Unknown filter key" },
      ]),
    });
    render(<MemoryPage params={params} />);
    expect(screen.getByText("Unknown filter key")).toBeInTheDocument();
  });

  it("filters by the memory entity and sends the filter to every memory query", () => {
    const filterParams = setApp();
    render(<MemoryPage params={params} />);

    expect(mockUseFilterPage).toHaveBeenLastCalledWith(
      expect.objectContaining({ entity: "memory" }),
    );
    expect(screen.getByTestId("filter-bar-mock")).toHaveAttribute(
      "data-entity",
      "memory",
    );
    expect(mockUseMemoryUsagePlotQuery).toHaveBeenLastCalledWith(filterParams);
    expect(mockUseMemoryUsageBreakdownQuery).toHaveBeenLastCalledWith(
      filterParams,
    );
    expect(mockUseHighMemoryUsageSessionsQuery).toHaveBeenLastCalledWith(
      filterParams,
      0,
    );
  });
});

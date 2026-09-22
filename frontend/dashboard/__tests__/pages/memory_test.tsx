import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  ApiError,
  invalidFilterExpr,
  type FilterExprIssue,
} from "@/app/api/api_error";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

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
  paginationOffsetUrlKey: "po",
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
    filterExprIssues,
  }: {
    filterExprIssues: FilterExprIssue[] | null;
  }) => (
    <div data-testid="filter-bar-mock">
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
jest.mock("@/app/components/dropdown_select", () => ({
  __esModule: true,
  DropdownSelectType: { SingleString: 0 },
  default: (props: {
    title: string;
    initialSelected: string;
    items: string[];
    onChangeSelected: (item: string) => void;
  }) => (
    <select
      aria-label={props.title}
      value={props.initialSelected}
      onChange={(event) => props.onChangeSelected(event.target.value)}
    >
      {props.items.map((item) => (
        <option key={item}>{item}</option>
      ))}
    </select>
  ),
}));

import MemoryPage from "@/app/[teamId]/memory/page";

describe("MemoryPage", () => {
  const params = promiseParams({ teamId: "team-1" });
  const setPageUrlKey = jest.fn();

  function setApp(id: string, osName: string) {
    const filterParams = {
      appId: id,
      startDate: "2026-01-05",
      endDate: "2026-01-06",
      filterExpr: null,
    };
    mockUseFilterPage.mockReturnValue({
      status: { kind: "ready" },
      value: {
        app: { id, os_names: [osName] },
        date: { startDate: "2026-01-05", endDate: "2026-01-06" },
      },
      filterParams,
      paginationOffset: 0,
      setPageUrlKey,
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
    expect(mockUseMemoryUsagePlotQuery).toHaveBeenLastCalledWith(
      null,
      undefined,
    );
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
  ])(
    "shows a placeholder while $name loads and preserves the selection",
    ({ query }) => {
      setApp("android-app", "android");
      const { rerender } = render(<MemoryPage params={params} />);
      fireEvent.change(screen.getByRole("combobox"), {
        target: { value: "Background" },
      });

      query.mockReturnValue({ status: "pending", error: null });
      rerender(<MemoryPage params={params} />);
      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(
        screen.getByRole("status", { name: "Loading app importance" }),
      ).toBeInTheDocument();

      query.mockReturnValue({ status: "success", error: null });
      rerender(<MemoryPage params={params} />);
      expect(screen.getByRole("combobox")).toHaveValue("Background");
      expect(
        screen.queryByRole("status", { name: "Loading app importance" }),
      ).not.toBeInTheDocument();
    },
  );

  it.each([
    { name: "plot", query: mockUseMemoryUsagePlotQuery },
    { name: "breakdown", query: mockUseMemoryUsageBreakdownQuery },
    { name: "sessions", query: mockUseHighMemoryUsageSessionsQuery },
  ])("passes $name filter validation errors to the filter bar", ({ query }) => {
    setApp("android-app", "android");
    query.mockReturnValue({
      status: "error",
      error: new ApiError(400, invalidFilterExpr, [
        { message: "Unknown filter key" },
      ]),
    });
    render(<MemoryPage params={params} />);
    expect(screen.getByText("Unknown filter key")).toBeInTheDocument();
  });

  it.each(["iOS", "ipados"])(
    "shows memory views without process-state filtering for %s",
    (osName) => {
      const filterParams = setApp("apple-app", osName);
      render(<MemoryPage params={params} />);

      expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
      expect(screen.getByTestId("memory-plot")).toBeInTheDocument();
      expect(screen.getByTestId("memory-breakdown")).toBeInTheDocument();
      expect(screen.getByTestId("high-memory-sessions")).toBeInTheDocument();
      expect(mockUseMemoryUsagePlotQuery).toHaveBeenLastCalledWith(
        filterParams,
        undefined,
      );
      expect(mockUseMemoryUsageBreakdownQuery).toHaveBeenLastCalledWith(
        filterParams,
        undefined,
      );
      expect(mockUseHighMemoryUsageSessionsQuery).toHaveBeenLastCalledWith(
        filterParams,
        undefined,
        0,
      );
    },
  );

  it("keeps the Android state selection out of iOS queries when switching apps", () => {
    const androidParams = setApp("android-app", "android");
    const { rerender } = render(<MemoryPage params={params} />);
    expect(screen.getByRole("combobox")).toHaveValue("Foreground");

    fireEvent.change(screen.getByRole("combobox"), {
      target: { value: "Background" },
    });
    expect(setPageUrlKey).toHaveBeenCalledWith("po", "0");
    expect(mockUseMemoryUsageBreakdownQuery).toHaveBeenLastCalledWith(
      androidParams,
      "background",
    );
    expect(mockUseHighMemoryUsageSessionsQuery).toHaveBeenLastCalledWith(
      androidParams,
      "background",
      0,
    );

    const appleParams = setApp("apple-app", "ios");
    rerender(<MemoryPage params={params} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    expect(mockUseMemoryUsagePlotQuery).toHaveBeenLastCalledWith(
      appleParams,
      undefined,
    );
    expect(mockUseMemoryUsageBreakdownQuery).toHaveBeenLastCalledWith(
      appleParams,
      undefined,
    );
    expect(mockUseHighMemoryUsageSessionsQuery).toHaveBeenLastCalledWith(
      appleParams,
      undefined,
      0,
    );

    setApp("android-app", "android");
    rerender(<MemoryPage params={params} />);
    expect(screen.getByRole("combobox")).toHaveValue("Background");
    expect(mockUseMemoryUsageBreakdownQuery).toHaveBeenLastCalledWith(
      androidParams,
      "background",
    );
    expect(mockUseHighMemoryUsageSessionsQuery).toHaveBeenLastCalledWith(
      androidParams,
      "background",
      0,
    );
  });
});

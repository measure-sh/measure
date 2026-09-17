import { promiseParams } from "@/__tests__/helpers/promise_params";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

const mockUseFilterPage = jest.fn();
const mockUseMemoryUsagePlotQuery = jest.fn();
const mockUseMemoryUsageBreakdownQuery = jest.fn();
const mockUseHighMemoryUsageSessionsQuery = jest.fn();

jest.mock("@/app/components/filter_bar/use_filter_page", () => ({
  useFilterPage: (...args: unknown[]) => mockUseFilterPage(...args),
}));
jest.mock("@/app/query/hooks", () => ({
  paginationOffsetUrlKey: "po",
  useMemoryUsagePlotQuery: (...args: unknown[]) =>
    mockUseMemoryUsagePlotQuery(...args),
  useMemoryUsageBreakdownQuery: (...args: unknown[]) =>
    mockUseMemoryUsageBreakdownQuery(...args),
  useHighMemoryUsageSessionsQuery: (...args: unknown[]) =>
    mockUseHighMemoryUsageSessionsQuery(...args),
}));
jest.mock("@/app/components/filter_bar/filter_bar", () => () => null);
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
    const filterParams = { appId: id, filterExpr: null };
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

import { mockRouter } from "@/__tests__/helpers/mock_router";
import type { App } from "@/app/api/api_calls";
import type {
  FilterRequest,
  FilterState,
} from "@/app/components/filter_bar/filter_bar";
import { useExprFilterPage } from "@/app/components/filter_bar/use_expr_filter_page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import { act, render } from "@testing-library/react";
import { useEffect } from "react";

const replaceMock = mockRouter.replaceMock;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  filterExprUrlKey: "filter_expr",
}));

jest.mock("@/app/stores/filters_store", () => ({
  __esModule: true,
  urlFiltersKeyMap: {
    appId: "a",
    dateRange: "d",
    startDate: "sd",
    endDate: "ed",
  },
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  paginationOffsetUrlKey: "po",
}));

const app = { id: "app-1", name: "Sample" } as App;
const last6Hours = {
  dateRange: "Last 6 Hours",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-01T06:00:00.000Z",
};
const custom = {
  dateRange: "Custom Range",
  startDate: "2026-02-01T00:00:00.000Z",
  endDate: "2026-02-02T00:00:00.000Z",
};

type Page = ReturnType<typeof useExprFilterPage>;

// The stub bar keeps the props of its latest render so a test can read what
// the page handed it.
let bar: {
  requestedAppId: string | null;
  requestedDateRange: { dateRange: string | null };
  requestedFilterExpr: string | null;
  requestedRootSpanName: string | null;
  onRequestChange: (change: Partial<FilterRequest>) => void;
  onFilterChange: (state: FilterState) => void;
};
let page: Page;

function HostWithPageKey() {
  const rendered = useExprFilterPage({
    extraUrlKeys: { rootSpanName: "r" },
    pageUrlKeys: ["jt"],
  });
  useEffect(() => {
    page = rendered;
    bar = {
      requestedAppId: rendered.requestedFilters.appId,
      requestedDateRange: rendered.requestedFilters.dateRange,
      requestedFilterExpr: rendered.requestedFilters.filterExpr,
      requestedRootSpanName: rendered.requestedFilters.rootSpanName,
      onRequestChange: rendered.onRequestChange,
      onFilterChange: rendered.onFilterChange,
    };
  });
  return null;
}

function Host({ paginationLimit }: { paginationLimit?: number }) {
  const rendered = useExprFilterPage({
    paginationLimit,
    extraUrlKeys: { rootSpanName: "r" },
  });
  useEffect(() => {
    page = rendered;
    bar = {
      requestedAppId: rendered.requestedFilters.appId,
      requestedDateRange: rendered.requestedFilters.dateRange,
      requestedFilterExpr: rendered.requestedFilters.filterExpr,
      requestedRootSpanName: rendered.requestedFilters.rootSpanName,
      onRequestChange: rendered.onRequestChange,
      onFilterChange: rendered.onFilterChange,
    };
  });
  return null;
}

const ready = (
  overrides: Partial<Extract<FilterState, { status: "ready" }>> = {},
): FilterState => ({
  status: "ready",
  app,
  date: last6Hours,
  filterExpr: null,
  rootSpanName: "span.first",
  appliedAsRequested: true,
  ...overrides,
});

const request = (overrides: Partial<FilterRequest> = {}): FilterRequest => ({
  appId: app.id,
  dateRange: last6Hours,
  filterExpr: null,
  rootSpanName: "span.first",
  ...overrides,
});

const settledParams = "a=app-1&d=Last+6+Hours&r=span.first";

function renderPage(paginationLimit?: number) {
  return render(<Host paginationLimit={paginationLimit} />);
}

describe("useExprFilterPage", () => {
  beforeEach(() => {
    mockRouter.reset();
  });

  it("hands the bar its request before and after the write lands", async () => {
    mockRouter.searchParams = new URLSearchParams(`po=20&${settledParams}`);
    renderPage(10);
    await act(async () => {
      bar.onFilterChange(ready());
    });

    mockRouter.deferReplace = true;
    await act(async () => {
      bar.onRequestChange(request({ filterExpr: "patch_id:" }));
    });
    expect(bar.requestedFilterExpr).toBe("patch_id:");
    expect(replaceMock).not.toHaveBeenCalled();

    await act(async () => {
      bar.onFilterChange(ready({ filterExpr: null }));
    });
    expect(replaceMock).toHaveBeenLastCalledWith(`?po=0&${settledParams}`, {
      scroll: false,
    });
    expect(bar.requestedFilterExpr).toBe("patch_id:");

    await act(async () => {
      mockRouter.applyReplaceUrl(mockRouter.deferredReplaceUrl!);
    });
    expect(bar.requestedFilterExpr).toBe("patch_id:");
  });

  it("hands the bar the URL after a search string the page did not write", async () => {
    mockRouter.searchParams = new URLSearchParams(settledParams);
    renderPage();
    await act(async () => {
      bar.onRequestChange(request({ filterExpr: "patch_id:" }));
    });
    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(bar.requestedFilterExpr).toBe("patch_id:");

    await act(async () => {
      mockRouter.applyReplaceUrl("?a=app-2&d=Last+Week&r=span.second");
    });
    expect(bar.requestedAppId).toBe("app-2");
    expect(bar.requestedDateRange.dateRange).toBe("Last Week");
    expect(bar.requestedFilterExpr).toBeNull();
    expect(bar.requestedRootSpanName).toBe("span.second");
  });

  it("writes again after a navigation back to the search string a request was stored on", async () => {
    renderPage();
    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(replaceMock).toHaveBeenLastCalledWith(`?${settledParams}`, {
      scroll: false,
    });
    expect(bar.requestedAppId).toBe("app-1");
    expect(bar.requestedRootSpanName).toBe("span.first");

    await act(async () => {
      mockRouter.applyReplaceUrl("?");
    });
    expect(bar.requestedAppId).toBeNull();

    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(replaceMock).toHaveBeenCalledTimes(2);
    expect(replaceMock).toHaveBeenLastCalledWith(`?${settledParams}`, {
      scroll: false,
    });
  });

  it("writes a navigation whose resolution equals the last written URL", async () => {
    mockRouter.searchParams = new URLSearchParams(settledParams);
    renderPage();
    await act(async () => {
      bar.onFilterChange(ready());
    });
    await act(async () => {
      bar.onRequestChange({ filterExpr: "patch_id:1" });
    });
    await act(async () => {
      bar.onFilterChange(ready({ filterExpr: "patch_id:1" }));
    });
    await act(async () => {
      bar.onRequestChange({ filterExpr: null });
    });
    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(replaceMock).toHaveBeenLastCalledWith(`?${settledParams}`, {
      scroll: false,
    });

    await act(async () => {
      mockRouter.applyReplaceUrl("?");
    });
    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(replaceMock).toHaveBeenCalledTimes(3);
    expect(replaceMock).toHaveBeenLastCalledWith(`?${settledParams}`, {
      scroll: false,
    });
  });

  it("merges a change into the request it hands the bar", async () => {
    mockRouter.searchParams = new URLSearchParams("r=span.checkout");
    renderPage();
    await act(async () => {
      bar.onRequestChange({ dateRange: custom });
    });
    expect(bar.requestedDateRange.dateRange).toBe(custom.dateRange);
    expect(bar.requestedRootSpanName).toBe("span.checkout");
  });

  it("keeps the request across a pagination write", async () => {
    mockRouter.searchParams = new URLSearchParams(`po=0&${settledParams}`);
    renderPage(10);
    await act(async () => {
      bar.onRequestChange(request({ filterExpr: "patch_id:" }));
    });
    await act(async () => {
      bar.onFilterChange(ready());
    });

    await act(async () => {
      page.nextPage();
    });
    expect(replaceMock).toHaveBeenLastCalledWith(`?po=10&${settledParams}`, {
      scroll: false,
    });
    expect(bar.requestedFilterExpr).toBe("patch_id:");
  });

  it("writes a relative label without timestamps and a custom range with them", async () => {
    renderPage();
    await act(async () => {
      bar.onFilterChange(ready({ date: last6Hours }));
    });
    expect(replaceMock).toHaveBeenLastCalledWith(`?${settledParams}`, {
      scroll: false,
    });

    await act(async () => {
      bar.onFilterChange(ready({ date: custom, appliedAsRequested: false }));
    });
    expect(replaceMock).toHaveBeenLastCalledWith(
      "?a=app-1&d=Custom+Range&sd=2026-02-01T00%3A00%3A00.000Z&ed=2026-02-02T00%3A00%3A00.000Z&r=span.first",
      { scroll: false },
    );
  });

  it("gates a relative range on its label alone, with the state's timestamps", async () => {
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(
      `${settledParams}&sd=2020-01-01T00%3A00%3A00.000Z&ed=2020-01-02T00%3A00%3A00.000Z`,
    );
    renderPage();
    await act(async () => {
      bar.onFilterChange(ready());
    });

    expect(page.filterParams).toEqual({
      appId: app.id,
      startDate: last6Hours.startDate,
      endDate: last6Hours.endDate,
      filterExpr: null,
    });
  });

  it("gates a custom range on its timestamps", async () => {
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(
      "a=app-1&d=Custom+Range&sd=2020-01-01T00%3A00%3A00.000Z&ed=2020-01-02T00%3A00%3A00.000Z&r=span.first",
    );
    renderPage();
    await act(async () => {
      bar.onFilterChange(ready({ date: custom, appliedAsRequested: false }));
    });
    expect(page.filterParams).toBeNull();

    await act(async () => {
      mockRouter.applyReplaceUrl(mockRouter.deferredReplaceUrl!);
    });
    expect(page.filterParams).toEqual({
      appId: app.id,
      startDate: custom.startDate,
      endDate: custom.endDate,
      filterExpr: null,
    });
  });

  it("resets the offset after a pick and keeps it after an unchanged request", async () => {
    mockRouter.searchParams = new URLSearchParams(`po=20&${settledParams}`);
    renderPage(10);
    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(page.paginationOffset).toBe(20);

    await act(async () => {
      bar.onRequestChange(request({ rootSpanName: "span.second" }));
    });
    await act(async () => {
      bar.onFilterChange(ready({ rootSpanName: "span.second" }));
    });
    expect(replaceMock).toHaveBeenLastCalledWith(
      "?po=0&a=app-1&d=Last+6+Hours&r=span.second",
      { scroll: false },
    );
    expect(page.paginationOffset).toBe(0);
  });

  it("keeps a pick made while an earlier write is still in flight", async () => {
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams("a=app-1&d=Last+6+Hours");
    renderPage();
    await act(async () => {
      bar.onFilterChange(ready());
    });
    const firstWrite = mockRouter.deferredReplaceUrl!;

    await act(async () => {
      bar.onRequestChange({ rootSpanName: "span.second" });
    });
    expect(bar.requestedRootSpanName).toBe("span.second");

    await act(async () => {
      mockRouter.applyReplaceUrl(firstWrite);
    });
    expect(bar.requestedRootSpanName).toBe("span.second");
  });

  it("keeps a page key written just before a pick", async () => {
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(`${settledParams}&jt=Paths`);
    const { unmount } = render(<HostWithPageKey />);
    await act(async () => {
      bar.onFilterChange(ready());
    });
    await act(async () => {
      page.setPageUrlKey("jt", "Exceptions");
    });
    await act(async () => {
      bar.onRequestChange({ dateRange: last6Hours });
      bar.onRequestChange({ rootSpanName: "span.second" });
    });
    await act(async () => {
      bar.onFilterChange(ready({ rootSpanName: "span.second" }));
    });

    expect(mockRouter.deferredReplaceUrl).toBe(
      "?a=app-1&d=Last+6+Hours&r=span.second&jt=Exceptions",
    );
    unmount();
  });

  it("ignores a change that leaves the request as it is", async () => {
    mockRouter.searchParams = new URLSearchParams(`po=20&${settledParams}`);
    renderPage(10);
    await act(async () => {
      bar.onFilterChange(ready());
    });
    await act(async () => {
      bar.onRequestChange({ filterExpr: null });
    });
    await act(async () => {
      bar.onFilterChange(ready());
    });

    expect(page.paginationOffset).toBe(20);
  });

  it("reads the offset it wrote while that write is still in flight", async () => {
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(
      "po=10&a=not-an-app&d=Last+6+Hours&r=span.first",
    );
    renderPage(10);
    await act(async () => {
      bar.onFilterChange(ready({ appliedAsRequested: false }));
    });
    expect(replaceMock).toHaveBeenLastCalledWith(`?po=0&${settledParams}`, {
      scroll: false,
    });
    expect(page.paginationOffset).toBe(0);

    await act(async () => {
      bar.onFilterChange(ready());
    });
    expect(replaceMock).toHaveBeenCalledTimes(1);

    await act(async () => {
      mockRouter.applyReplaceUrl(mockRouter.deferredReplaceUrl!);
    });
    expect(page.paginationOffset).toBe(0);
    expect(page.filterParams).not.toBeNull();
  });
});

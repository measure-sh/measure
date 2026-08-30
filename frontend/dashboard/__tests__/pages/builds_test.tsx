import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import Builds from "@/app/[teamId]/builds/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const replaceMock = mockRouter.replaceMock;
const applyReplaceUrl = mockRouter.applyReplaceUrl;

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

const downloadBuildFileMock = jest.fn();
jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyBuildsResponse: {
    meta: { next: false, previous: false },
    results: [],
  },
  downloadBuildFile: (url: string) => downloadBuildFileMock(url),
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

const mockUseBuildsQuery = jest.fn((_filter: any, _offset: number) => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useBuildsQuery: (filter: any, offset: number) =>
    mockUseBuildsQuery(filter, offset),
  paginationOffsetUrlKey: "po",
}));

const mockReportedApp = { id: "app-1", name: "Sample" };
const mockReportedDate = {
  dateRange: "Last 6 Hours",
  startDate: "2026-01-01T00:00:00.000Z",
  endDate: "2026-01-01T06:00:00.000Z",
};

// Makes the stub drop the URL's filter on mount, like the bar discarding
// a filter it cannot read.
let mockMountDiscardsFilter = false;

// Only an undiscarded mount report carries appliedAsRequested true; a
// report from a button models a user edit.
jest.mock("@/app/components/filter_bar/filter_bar", () => {
  const { useEffect } = require("react");

  function FilterBarMock(props: any) {
    const ready = (
      filterExpr: string | null,
      appliedAsRequested: boolean = false,
    ) => ({
      status: "ready",
      app: mockReportedApp,
      date: mockReportedDate,
      filterExpr,
      appliedAsRequested,
    });

    useEffect(() => {
      if (mockMountDiscardsFilter) {
        props.onFilterChange(ready(null, false));
      } else {
        props.onFilterChange(ready(props.requestedFilterExpr, true));
      }
    }, []);

    return (
      <div data-testid="filter-bar-mock">
        <span data-testid="filter-bar-expr">
          {props.requestedFilterExpr ?? "none"}
        </span>
        <button
          data-testid="filter-bar-apply"
          onClick={() => props.onFilterChange(ready("mapping_type:in:dsym"))}
        >
          apply
        </button>
        <button
          data-testid="filter-bar-clear"
          onClick={() => props.onFilterChange(ready(null))}
        >
          clear
        </button>
        <button
          data-testid="filter-bar-fail"
          onClick={() =>
            props.onFilterChange({
              status: "error",
              message: "Error fetching apps, please refresh page to try again",
            })
          }
        >
          fail
        </button>
      </div>
    );
  }

  return {
    __esModule: true,
    default: FilterBarMock,
    filterExprUrlKey: "filter_expr",
  };
});

jest.mock("@/app/components/paginator", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="paginator-mock">
      <button
        data-testid="prev-button"
        onClick={props.onPrev}
        disabled={!props.prevEnabled}
      >
        Prev
      </button>
      <button
        data-testid="next-button"
        onClick={props.onNext}
        disabled={!props.nextEnabled}
      >
        Next
      </button>
      <span>{props.displayText}</span>
    </div>
  ),
}));

jest.mock("@/app/components/loading_bar", () => () => (
  <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
));

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDateTime: jest.fn(() => "1 Jan, 2020, 12:00:00 AM"),
}));

const buildFile = (id: string, mappingType: string) => ({
  id,
  mapping_type: mappingType,
  download_url: `/apps/app1/builds/${id}/download`,
  filesize: 100,
  last_updated: "2020-01-01T00:00:00Z",
});

const mockBuildsData = {
  results: [
    {
      version_name: "1.0.2",
      version_code: "2",
      last_updated: "2020-01-01T00:00:00Z",
      files: [buildFile("mapping-1", "dsym")],
    },
  ],
  meta: { previous: true, next: true },
};

function loaded(data: any = mockBuildsData) {
  mockUseBuildsQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

// What the stub bar reports, as the page writes it into the URL.
const selectionParams =
  "a=app-1&d=Last+6+Hours&sd=2026-01-01T00%3A00%3A00.000Z&ed=2026-01-01T06%3A00%3A00.000Z";

const selectionUrl = (offset: number, filterParam?: string) =>
  `?po=${offset}&${selectionParams}${filterParam ? `&${filterParam}` : ""}`;

function renderPage() {
  return render(<Builds params={promiseParams({ teamId: "123" })} />);
}

describe("Builds page", () => {
  beforeEach(() => {
    mockRouter.reset();
    downloadBuildFileMock.mockClear();
    mockMountDiscardsFilter = false;
    mockUseBuildsQuery.mockReset();
    mockUseBuildsQuery.mockReturnValue({
      data: undefined,
      status: "pending" as string,
      isFetching: true,
      error: null,
    });
  });

  it("renders the filter bar", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
  });

  it("hands the bar the filter the URL opened on", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=0&filter_expr=patch_id%3Ais_set",
    );
    loaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "patch_id:is_set",
    );
  });

  it("fetches nothing until the bar settles on an app and a range", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=patch_id%3Ais_set",
    );
    loaded();
    renderPage();

    expect(mockUseBuildsQuery).toHaveBeenNthCalledWith(1, null, 20);
  });

  it("fetches the page the URL names, filtered by what the bar reported", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=patch_id%3Ais_set",
    );
    loaded();
    renderPage();

    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(
      {
        appId: mockReportedApp.id,
        startDate: mockReportedDate.startDate,
        endDate: mockReportedDate.endDate,
        filterExpr: "patch_id:is_set",
      },
      20,
    );
  });

  it("never fetches a filter the bar discarded on mount", async () => {
    mockMountDiscardsFilter = true;
    mockRouter.deferReplace = true;
    mockRouter.searchParams = new URLSearchParams(
      `po=30&filter_expr=patch_id%3Ais_set&${selectionParams}`,
    );
    loaded();
    renderPage();

    // The write has not landed, so the URL still holds the discarded
    // filter and the query stays disabled.
    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(null, 30);

    await act(async () => {
      applyReplaceUrl(mockRouter.deferredReplaceUrl!);
    });

    expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
      scroll: false,
    });
    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(
      {
        appId: mockReportedApp.id,
        startDate: mockReportedDate.startDate,
        endDate: mockReportedDate.endDate,
        filterExpr: null,
      },
      0,
    );
    for (const [params] of mockUseBuildsQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("patch_id:is_set");
    }
  });

  it("records what the bar settled on, keeping the page the link asked for", () => {
    mockRouter.searchParams = new URLSearchParams(
      "po=20&filter_expr=patch_id%3Ais_set",
    );
    loaded();
    renderPage();

    expect(replaceMock).toHaveBeenCalledTimes(1);
    expect(replaceMock).toHaveBeenCalledWith(
      selectionUrl(20, "filter_expr=patch_id%3Ais_set"),
      { scroll: false },
    );
  });

  it("renders no list while the builds are still loading", () => {
    renderPage();
    expect(screen.queryByTestId("paginator-mock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading-bar-mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Build")).not.toBeInTheDocument();
  });

  it("renders the paginator and table headers once the builds arrive", async () => {
    loaded();
    renderPage();

    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Build" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Files" }),
    ).toBeInTheDocument();
  });

  it("titles a build by its version and shows each file's type and date", () => {
    loaded();
    renderPage();

    expect(screen.getByText("1.0.2 (2)")).toBeInTheDocument();
    expect(screen.getByText("dsym")).toBeInTheDocument();
    // The date belongs to the file; a build carries none of its own.
    expect(screen.getAllByText("1 Jan, 2020, 12:00:00 AM")).toHaveLength(1);
  });

  it("points a file's download link at the download endpoint", () => {
    loaded();
    renderPage();

    const link = screen.getByRole("link", { name: "Download" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/api/apps/app1/builds/mapping-1/download",
    );
    expect(link).toHaveAttribute("download");
  });

  it("downloads through downloadBuildFile rather than following the link", async () => {
    loaded();
    renderPage();

    const link = screen.getByRole("link", { name: "Download" });
    await act(async () => {
      fireEvent.click(link);
    });

    expect(downloadBuildFileMock).toHaveBeenCalledWith(
      "/api/apps/app1/builds/mapping-1/download",
    );
  });

  it("titles version builds, patches, and patches with no version", () => {
    loaded({
      results: [
        {
          version_name: "1.0.2",
          version_code: "2",
          last_updated: "2020-01-01T00:00:00Z",
          files: [
            buildFile("mapping-1", "proguard"),
            buildFile("mapping-2", "elf_debug"),
          ],
        },
        {
          version_name: "1.0.1",
          version_code: "1",
          last_updated: "2020-01-01T00:00:00Z",
          files: [buildFile("mapping-3", "proguard")],
        },
        {
          version_name: "",
          version_code: "",
          patch_id: "3f0e7c3e-9c31-4d9d-9a4e-2f6a3d0f5b21",
          patch_version: "3.1.0",
          last_updated: "2020-01-01T00:00:00Z",
          files: [
            buildFile("mapping-4", "jsbundle"),
            buildFile("mapping-5", "proguard"),
          ],
        },
        {
          version_name: "",
          version_code: "",
          patch_id: "b2c4e6a8-0d1f-4357-9b8c-2e4a6c8e0a1b",
          last_updated: "2020-01-01T00:00:00Z",
          files: [buildFile("mapping-6", "jsbundle")],
        },
      ],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getAllByTestId("build-row")).toHaveLength(4);

    // The type, date and download link are per file, so the counts below are
    // over the six files, not the four builds.
    expect(screen.getAllByText("proguard")).toHaveLength(3);
    expect(screen.getAllByText("elf_debug")).toHaveLength(1);
    expect(screen.getAllByText("jsbundle")).toHaveLength(2);
    expect(screen.getAllByText("1 Jan, 2020, 12:00:00 AM")).toHaveLength(6);
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(6);

    expect(screen.getByText("1.0.2 (2)")).toBeInTheDocument();
    expect(screen.getByText("1.0.1 (1)")).toBeInTheDocument();

    // A patch with a version is titled by that version, with its id
    // underneath; a patch without one is titled by its id alone.
    expect(screen.getByText("patch_version: 3.1.0")).toBeInTheDocument();
    expect(
      screen.getByText("patch_id: 3f0e7c3e-9c31-4d9d-9a4e-2f6a3d0f5b21"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("patch_id: b2c4e6a8-0d1f-4357-9b8c-2e4a6c8e0a1b"),
    ).toBeInTheDocument();
  });

  it("renders an empty table when the server sends no results", () => {
    loaded({ results: null, meta: { previous: false, next: false } });
    renderPage();

    expect(
      screen.getByRole("columnheader", { name: "Build" }),
    ).toBeInTheDocument();
    expect(screen.queryAllByTestId("build-row")).toHaveLength(0);
  });

  it("shows an error when the builds request fails", () => {
    mockUseBuildsQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of builds/),
    ).toBeInTheDocument();
  });

  it("shows the loading bar only while a refetch is in flight", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: mockBuildsData,
      status: "success",
      isFetching: true,
      error: null,
    });
    const { rerender } = renderPage();

    const loadingBarContainer =
      screen.getByTestId("loading-bar-mock").parentElement;
    expect(loadingBarContainer).toHaveClass("visible");
    expect(loadingBarContainer).not.toHaveClass("invisible");

    await act(async () => {
      loaded();
      rerender(<Builds params={promiseParams({ teamId: "123" })} />);
    });

    await screen.findByText("1.0.2 (2)");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });

  describe("a filter the bar could not settle", () => {
    beforeEach(() => {
      mockRouter.searchParams = new URLSearchParams(`po=10&${selectionParams}`);
      loaded();
    });

    it("is said by the page, in place of the list", async () => {
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
    });

    it("stops the page fetching anything", async () => {
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(null, 10);
    });

    it("leaves the URL where the link had it", async () => {
      renderPage();
      replaceMock.mockClear();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-fail"));
      });

      expect(replaceMock).not.toHaveBeenCalled();
    });
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=patch_id%3Ais_set&${selectionParams}`,
      );
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      // Paging keeps everything else the URL was carrying.
      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(10, "filter_expr=patch_id%3Ais_set"),
        { scroll: false },
      );
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "po=10&filter_expr=patch_id%3Ais_set",
      );
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "filter_expr=patch_id%3Ais_set"),
        { scroll: false },
      );

      mockRouter.searchParams = new URLSearchParams(
        "po=0&filter_expr=patch_id%3Ais_set",
      );
      renderPage();
      await act(async () => {
        fireEvent.click(screen.getAllByTestId("prev-button")[1]);
      });
      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "filter_expr=patch_id%3Ais_set"),
        { scroll: false },
      );
    });

    it("goes back to the first page when the filter changes", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "po=30&filter_expr=patch_id%3Ais_set",
      );
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(
        selectionUrl(0, "filter_expr=mapping_type%3Ain%3Adsym"),
        { scroll: false },
      );
      // The changed filter and the reset offset reach the query together,
      // through the URL, so the new filter is never fetched at the page the
      // old filter was on.
      expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterExpr: "mapping_type:in:dsym" }),
        0,
      );
      for (const [params, offset] of mockUseBuildsQuery.mock.calls) {
        if (params?.filterExpr === "mapping_type:in:dsym") {
          expect(offset).toBe(0);
        }
      }
    });

    it("cannot be used while a refetch is in flight", () => {
      mockUseBuildsQuery.mockReturnValue({
        data: mockBuildsData,
        status: "success",
        isFetching: true,
        error: null,
      });
      renderPage();

      expect(screen.getByTestId("next-button")).toBeDisabled();
      expect(screen.getByTestId("prev-button")).toBeDisabled();
    });

    it("goes back to the first page when the filter is cleared", async () => {
      mockRouter.searchParams = new URLSearchParams(
        "po=30&filter_expr=patch_id%3Ais_set",
      );
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(replaceMock).toHaveBeenLastCalledWith(selectionUrl(0), {
        scroll: false,
      });
    });
  });
});

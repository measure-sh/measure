import { mockFiltersStore } from "@/__tests__/helpers/mock_filters_store";
import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

jest.mock("@/app/stores/provider", () =>
  require("@/__tests__/helpers/mock_filters_store").filtersProviderMock(),
);

const downloadBuildFileMock = jest.fn();
jest.mock("@/app/api/api_calls", () => ({
  ...jest.requireActual("@/app/api/api_calls"),
  downloadBuildFile: (url: string) => downloadBuildFileMock(url),
}));

const mockToastNegative = jest.fn();
jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: (text: string) => mockToastNegative(text),
}));

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseBuildsQuery = jest.fn((_filter: any, _offset: number) => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  paginationOffsetUrlKey: "po",
  useAppsQuery: (teamId: string) => mockUseAppsQuery(teamId),
  useFilterKeysQuery: (
    appId: string | undefined,
    entity: string,
    keyNames: string[],
  ) => mockUseFilterKeysQuery(appId, entity, keyNames),
  useRootSpanNamesQuery: () => ({
    data: undefined,
    isSuccess: false,
    isError: false,
  }),
  useBuildsQuery: (filter: any, offset: number) =>
    mockUseBuildsQuery(filter, offset),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-app">
        {props.value?.app.name ?? "none"}
      </span>
      <span data-testid="filter-bar-expr">
        {props.value?.filterExpr ?? "none"}
      </span>
      <span data-testid="filter-bar-span-names">
        {props.spanNames === undefined ? "hidden" : "shown"}
      </span>
      <button
        data-testid="filter-bar-apply"
        onClick={() => props.onChange({ filterExpr: "mapping_type:in:dsym" })}
      >
        apply
      </button>
      <button
        data-testid="filter-bar-clear"
        onClick={() => props.onChange({ filterExpr: null })}
      >
        clear
      </button>
    </div>
  ),
}));

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

import Builds from "@/app/[teamId]/builds/page";

const mockApp = { id: "app-1", name: "Sample" };

const keys = [
  {
    name: "mapping_type",
    label: "File type",
    key_group: "Build",
    description: "The kind of mapping file",
    value_type: "string",
    value_suggestion_mode: "full_list",
    operators: ["in", "not_in"],
  },
  {
    name: "patch_id",
    label: "Patch",
    key_group: "Build",
    description: "Whether the build is a patch",
    value_type: "string",
    value_suggestion_mode: "none",
    operators: ["is_set", "is_not_set"],
  },
];

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

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(<Builds params={promiseParams({ teamId: "123" })} />);
}

describe("Builds page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockToastNegative.mockClear();
    downloadBuildFileMock.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys, key_groups: ["Build"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseBuildsQuery.mockReset();
    mockUseBuildsQuery.mockReturnValue({
      data: undefined,
      status: "pending" as string,
      isFetching: true,
      error: null,
    });
  });

  it("renders the filter bar without a span selector", () => {
    renderPage();
    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-span-names")).toHaveTextContent(
      "hidden",
    );
  });

  it("hands the bar the app and filter it settled on", () => {
    mockRouter.setUrl("?po=0&filter_expr=patch_id%3Ais_set");
    loaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
    expect(screen.getByTestId("filter-bar-expr")).toHaveTextContent(
      "patch_id:is_set",
    );
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockRouter.setUrl("?po=20&filter_expr=patch_id%3Ais_set");
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    loaded();
    renderPage();

    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(null, 20);
    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("none");
  });

  it("fetches the page the URL names, filtered by what it settled on", () => {
    mockRouter.setUrl("?po=20&filter_expr=patch_id%3Ais_set");
    loaded();
    renderPage();

    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({
        appId: "app-1",
        filterExpr: "patch_id:is_set",
      }),
      20,
    );
  });

  it("never fetches a filter it discarded on mount", async () => {
    mockRouter.setUrl(
      "?po=30&filter_expr=device_cohort%3Ain%3Anew&a=app-1&d=Last+6+Hours",
    );
    mockRouter.deferReplace = true;
    loaded();
    renderPage();

    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(null, 30);
    expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    expect(mockToastNegative).toHaveBeenCalledWith(
      "Some filters were invalid, page reset to defaults",
    );

    await act(async () => {
      mockRouter.applyDeferredReplace();
    });

    expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1", filterExpr: null }),
      0,
    );
    for (const [params] of mockUseBuildsQuery.mock.calls) {
      expect(params?.filterExpr ?? null).not.toBe("device_cohort:in:new");
    }
  });

  it("records what it settled on, keeping the page the link asked for", () => {
    mockRouter.setUrl("?po=20&filter_expr=patch_id%3Ais_set");
    loaded();
    renderPage();

    expect(mockRouter.urlParams()).toEqual({
      ...settled,
      po: "20",
      filter_expr: "patch_id:is_set",
    });
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

  describe("a filter it could not settle", () => {
    beforeEach(() => {
      mockRouter.setUrl("?po=10&a=app-1&d=Last+6+Hours");
      mockUseAppsQuery.mockReturnValue({ status: "error", data: undefined });
      loaded();
    });

    it("is said by the page, in place of the list", () => {
      renderPage();

      expect(
        screen.getByText(
          "Error fetching apps, please refresh page to try again",
        ),
      ).toBeInTheDocument();
    });

    it("stops the page fetching anything", () => {
      renderPage();

      expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(null, 10);
    });

    it("leaves the URL where the link had it", () => {
      renderPage();

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "10" });
    });
  });

  describe("pagination", () => {
    it("moves the offset on by the page size when Next is clicked", async () => {
      mockRouter.setUrl(
        "?po=0&filter_expr=patch_id%3Ais_set&a=app-1&d=Last+6+Hours",
      );
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("next-button"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "10",
        filter_expr: "patch_id:is_set",
      });
      expect(mockUseBuildsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ filterExpr: "patch_id:is_set" }),
        10,
      );
    });

    it("moves the offset back when Prev is clicked, and never below zero", async () => {
      mockRouter.setUrl("?po=10&filter_expr=patch_id%3Ais_set");
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "patch_id:is_set",
      });

      await act(async () => {
        fireEvent.click(screen.getByTestId("prev-button"));
      });
      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "patch_id:is_set",
      });
    });

    it("goes back to the first page when the filter changes", async () => {
      mockRouter.setUrl("?po=30&filter_expr=patch_id%3Ais_set");
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "mapping_type:in:dsym",
      });
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
      mockRouter.setUrl("?po=30&filter_expr=patch_id%3Ais_set");
      loaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-clear"));
      });

      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    });
  });
});

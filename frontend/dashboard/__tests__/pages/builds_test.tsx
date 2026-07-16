import { promiseParams } from "@/__tests__/helpers/promise_params";
import Builds from "@/app/[teamId]/builds/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

// Global replace mock for router.replace
const replaceMock = jest.fn();
const pushMock = jest.fn();

// Mock next/navigation hooks
let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  // By default, return empty search params.
  useSearchParams: () => mockSearchParams,
}));

// Mock API calls and constants
const downloadBuildFileMock = jest.fn();
jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyBuildsResponse: {
    meta: { next: false, previous: false },
    results: [],
  },
  FilterSource: { Builds: "builds" },
  downloadBuildFile: (url: string) => downloadBuildFileMock(url),
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: "" },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

const mockUseBuildsQuery = jest.fn(() => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useBuildsQuery: () => mockUseBuildsQuery(),
  paginationOffsetUrlKey: "po",
}));

jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters-mock" />,
  AppVersionsInitialSelectionType: { All: "all" },
}));

// Updated Paginator mock renders Next and Prev buttons.
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

// Mock LoadingBar component.
jest.mock("@/app/components/loading_bar", () => () => (
  <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
));

// Mock time utils
jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDateTime: jest.fn(() => "1 Jan, 2020, 12:00:00 AM"),
}));

const { useFiltersStore } = require("@/app/stores/provider") as any;

const mockBuildResult = {
  version_name: "1.0.2",
  version_code: "2",
  last_updated: "2020-01-01T00:00:00Z",
  files: [
    {
      id: "mapping-1",
      mapping_type: "dsym",
      download_url: "/apps/app1/builds/mapping-1/download",
      filesize: 100,
      last_updated: "2020-01-01T00:00:00Z",
    },
  ],
};

const mockBuildsData = {
  results: [mockBuildResult],
  meta: { previous: true, next: true },
};

describe("Builds Component", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    downloadBuildFileMock.mockClear();
    mockSearchParams = new URLSearchParams();
    mockUseBuildsQuery.mockReset();
    mockUseBuildsQuery.mockReturnValue({
      data: undefined,
      status: "pending" as string,
      isFetching: true,
      error: null,
    });
    useFiltersStore.setState({
      filters: { ready: false, serialisedFilters: "" },
    });
  });

  it("renders the Filters component", () => {
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
  });

  it("does not render main builds UI when filters are not ready", () => {
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    expect(screen.queryByTestId("paginator-mock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading-bar-mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Build")).not.toBeInTheDocument();
  });

  it("renders main builds UI, updates URL when filters become ready, and renders table headers", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: mockBuildsData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    // Check URL update.
    expect(replaceMock).toHaveBeenCalledWith("?po=0&updated", {
      scroll: false,
    });

    // Verify main UI components are rendered.
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();
    // Check that the table header cells are rendered.
    expect(
      screen.getByRole("columnheader", { name: "Build" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("columnheader", { name: "Files" }),
    ).toBeInTheDocument();
  });

  it("displays build data correctly when API returns results", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: mockBuildsData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    // Main line is the version (code); each file shows its mapping
    // type with its own upload time below it. The build itself shows
    // no date, so exactly one date renders for the single file.
    expect(screen.getByText("1.0.2 (2)")).toBeInTheDocument();
    expect(screen.getByText("dsym")).toBeInTheDocument();
    expect(screen.getAllByText("1 Jan, 2020, 12:00:00 AM")).toHaveLength(1);
  });

  it("renders a download link per file pointing at the download endpoint", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: mockBuildsData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    const link = screen.getByRole("link", { name: "Download" });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute(
      "href",
      "/api/apps/app1/builds/mapping-1/download",
    );
    expect(link).toHaveAttribute("download");
  });

  it("downloads through the session-refreshing helper on click", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: mockBuildsData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    const link = screen.getByRole("link", { name: "Download" });
    await act(async () => {
      fireEvent.click(link);
    });

    expect(downloadBuildFileMock).toHaveBeenCalledWith(
      "/api/apps/app1/builds/mapping-1/download",
    );
  });

  it("renders single and multi file builds for version, patch and version+patch variants", async () => {
    const file = (id: string, mappingType: string) => ({
      id,
      mapping_type: mappingType,
      download_url: `/apps/app1/builds/${id}/download`,
      filesize: 100,
      last_updated: "2020-01-01T00:00:00Z",
    });

    mockUseBuildsQuery.mockReturnValue({
      data: {
        results: [
          {
            version_name: "1.0.2",
            version_code: "2",
            last_updated: "2020-01-01T00:00:00Z",
            files: [
              file("mapping-1", "proguard"),
              file("mapping-2", "elf_debug"),
            ],
          },
          {
            version_name: "1.0.1",
            version_code: "1",
            last_updated: "2020-01-01T00:00:00Z",
            files: [file("mapping-3", "proguard")],
          },
          {
            version_name: "",
            version_code: "",
            patch_id: "3f0e7c3e-9c31-4d9d-9a4e-2f6a3d0f5b21",
            last_updated: "2020-01-01T00:00:00Z",
            files: [
              file("mapping-4", "jsbundle"),
              file("mapping-5", "proguard"),
            ],
          },
          {
            version_name: "",
            version_code: "",
            patch_id: "b2c4e6a8-0d1f-4357-9b8c-2e4a6c8e0a1b",
            last_updated: "2020-01-01T00:00:00Z",
            files: [file("mapping-6", "jsbundle")],
          },
          {
            version_name: "2.4.1",
            version_code: "2401",
            patch_id: "9b1de2a7-5c44-4f8e-8a3d-6f2e91c07b55",
            last_updated: "2020-01-01T00:00:00Z",
            files: [
              file("mapping-7", "jsbundle"),
              file("mapping-8", "elf_debug"),
            ],
          },
          {
            version_name: "2.4.0",
            version_code: "2400",
            patch_id: "d4f6a8b0-2c3e-4579-8d9e-4a6c8e0b2d3f",
            last_updated: "2020-01-01T00:00:00Z",
            files: [file("mapping-9", "jsbundle")],
          },
        ],
        meta: { previous: false, next: false },
      },
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    // Six builds render as six rows, one per group.
    expect(screen.getAllByTestId("build-row")).toHaveLength(6);

    // Every file shows its mapping type, its own date and a download;
    // the builds themselves carry no date.
    expect(screen.getAllByText("proguard")).toHaveLength(3);
    expect(screen.getAllByText("elf_debug")).toHaveLength(2);
    expect(screen.getAllByText("jsbundle")).toHaveLength(4);
    expect(screen.getAllByText("1 Jan, 2020, 12:00:00 AM")).toHaveLength(9);
    expect(screen.getAllByRole("link", { name: "Download" })).toHaveLength(9);

    // Version-only builds title by version.
    expect(screen.getByText("1.0.2 (2)")).toBeInTheDocument();
    expect(screen.getByText("1.0.1 (1)")).toBeInTheDocument();

    // Patch-only builds title by patch id.
    expect(
      screen.getByText("Patch: 3f0e7c3e-9c31-4d9d-9a4e-2f6a3d0f5b21"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Patch: b2c4e6a8-0d1f-4357-9b8c-2e4a6c8e0a1b"),
    ).toBeInTheDocument();

    // Builds carrying a version and a patch id keep the version as
    // the title and show the patch id as a subtitle.
    expect(screen.getByText("2.4.1 (2401)")).toBeInTheDocument();
    expect(
      screen.getByText("Patch: 9b1de2a7-5c44-4f8e-8a3d-6f2e91c07b55"),
    ).toBeInTheDocument();
    expect(screen.getByText("2.4.0 (2400)")).toBeInTheDocument();
    expect(
      screen.getByText("Patch: d4f6a8b0-2c3e-4579-8d9e-4a6c8e0b2d3f"),
    ).toBeInTheDocument();
  });

  it("shows error message when API returns error status", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    // Check that error message is displayed
    expect(
      screen.getByText(/Error fetching list of builds/),
    ).toBeInTheDocument();
  });

  describe("Pagination offset handling", () => {
    it("initializes pagination offset to 0 when no offset is provided", async () => {
      mockUseBuildsQuery.mockReturnValue({
        data: mockBuildsData,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<Builds params={promiseParams({ teamId: "123" })} />);
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app1" },
          },
        });
      });
      expect(replaceMock).toHaveBeenCalledWith("?po=0&updated", {
        scroll: false,
      });
    });

    it("increments pagination offset when Next is clicked", async () => {
      mockUseBuildsQuery.mockReturnValue({
        data: mockBuildsData,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<Builds params={promiseParams({ teamId: "123" })} />);
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app1" },
          },
        });
      });
      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      // The pagination limit is 10 so offset should be 10.
      expect(replaceMock).toHaveBeenLastCalledWith("?po=10&updated", {
        scroll: false,
      });
    });

    it("decrements pagination offset when Prev is clicked, but not below 0", async () => {
      mockUseBuildsQuery.mockReturnValue({
        data: mockBuildsData,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<Builds params={promiseParams({ teamId: "123" })} />);
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app1" },
          },
        });
      });
      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=10&updated", {
        scroll: false,
      });
      const prevButton = await screen.findByTestId("prev-button");
      await act(async () => {
        fireEvent.click(prevButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=0&updated", {
        scroll: false,
      });
      await act(async () => {
        fireEvent.click(prevButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=0&updated", {
        scroll: false,
      });
    });

    it("resets pagination offset to 0 when filters change (if previous filters were non-default)", async () => {
      mockUseBuildsQuery.mockReturnValue({
        data: mockBuildsData,
        status: "success",
        isFetching: false,
        error: null,
      });

      render(<Builds params={promiseParams({ teamId: "123" })} />);
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app1" },
          },
        });
      });
      expect(replaceMock).toHaveBeenCalledWith("?po=0&updated", {
        scroll: false,
      });

      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=10&updated", {
        scroll: false,
      });

      // Now simulate a filter change with a different value.
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated2",
            app: { id: "app1" },
          },
        });
        await new Promise((resolve) => setTimeout(resolve, 0));
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=0&updated2", {
        scroll: false,
      });
    });
  });

  it("correctly toggles loading bar visibility based on API status", async () => {
    mockUseBuildsQuery.mockReturnValue({
      data: undefined,
      status: "pending" as string,
      isFetching: true,
      error: null,
    });
    render(<Builds params={promiseParams({ teamId: "123" })} />);

    // Set loading state
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    // Test the loading state - loading bar should be visible
    const loadingBarContainer =
      screen.getByTestId("loading-bar-mock").parentElement;
    expect(loadingBarContainer).toHaveClass("visible");
    expect(loadingBarContainer).not.toHaveClass("invisible");

    // Set success state
    await act(async () => {
      mockUseBuildsQuery.mockReturnValue({
        data: mockBuildsData,
        status: "success",
        isFetching: false,
        error: null,
      });
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app1" },
        },
      });
    });

    // After loading, the loading bar should be invisible
    await screen.findByText("1.0.2 (2)");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});

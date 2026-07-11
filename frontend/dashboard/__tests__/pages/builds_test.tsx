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
const downloadBuildMock = jest.fn();
jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyBuildsResponse: {
    meta: { next: false, previous: false },
    results: [],
  },
  FilterSource: { Builds: "builds" },
  downloadBuild: (url: string) => downloadBuildMock(url),
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
  id: "mapping-1",
  version_name: "1.0.2",
  version_code: "2",
  mapping_type: "dsym",
  download_url: "/apps/app1/builds/mapping-1/download",
  filesize: 100,
  last_updated: "2020-01-01T00:00:00Z",
};

const mockBuildsData = {
  results: [mockBuildResult],
  meta: { previous: true, next: true },
};

describe("Builds Component", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    downloadBuildMock.mockClear();
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
      screen.getByRole("columnheader", { name: "Download" }),
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

    // Main line is the mapping id, second line is version (code), type, datetime.
    expect(screen.getByText("mapping-1")).toBeInTheDocument();
    expect(
      screen.getByText("1.0.2 (2), dsym, 1 Jan, 2020, 12:00:00 AM"),
    ).toBeInTheDocument();
  });

  it("renders a download link per build pointing at the download endpoint", async () => {
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

    expect(downloadBuildMock).toHaveBeenCalledWith(
      "/api/apps/app1/builds/mapping-1/download",
    );
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
    await screen.findByText("mapping-1");
    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});

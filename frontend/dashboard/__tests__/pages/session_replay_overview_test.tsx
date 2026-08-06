import { promiseParams } from "@/__tests__/helpers/promise_params";
import SessionReplayOverview from "@/app/[teamId]/session_replays/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const replaceMock = jest.fn();
const pushMock = jest.fn();

let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    replace: replaceMock,
    push: pushMock,
  }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptySessionReplayOverviewResponse: {
    meta: { next: false, previous: false },
    results: [],
  },
  FilterSource: { Events: "events" },
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: "" },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

const mockUseSessionReplayOverviewQuery = jest.fn(() => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useSessionReplayOverviewQuery: () => mockUseSessionReplayOverviewQuery(),
  paginationOffsetUrlKey: "po",
}));

jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters-mock" />,
  AppVersionsInitialSelectionType: { All: "all" },
}));

jest.mock("@/app/components/session_replay_overview_plot", () => () => (
  <div data-testid="session-replay-overview-plot-mock">
    SessionReplayOverviewPlot Rendered
  </div>
));

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
  formatDateToHumanReadableDate: jest.fn(() => "Jan 1, 2020"),
  formatDateToHumanReadableTime: jest.fn(() => "12:00 AM"),
  formatMillisToHumanReadable: jest.fn(() => "1s"),
}));

jest.mock("@/app/utils/shared_styles", () => ({
  underlineLinkStyle: "underline-link",
}));

const { useFiltersStore } = require("@/app/stores/provider") as any;

const mockSessionTimelineData = {
  results: [
    {
      session_id: "session1",
      app_id: "app1",
      first_event_time: "2020-01-01T00:00:00Z",
      last_event_time: "2020-01-01T00:05:00Z",
      duration: "1000",
      matched_free_text: "dummyMatch",
      attribute: {
        app_version: "1.0",
        app_build: "1",
        user_id: "user1",
        device_name: "iPhone",
        device_model: "iPhone 12",
        device_manufacturer: "Apple",
        os_name: "ios",
        os_version: "15",
      },
    },
  ],
  meta: { previous: true, next: true },
};

describe("SessionReplayOverview Component", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    mockSearchParams = new URLSearchParams();
    mockUseSessionReplayOverviewQuery.mockReset();
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: undefined,
      status: "pending" as string,
      isFetching: true,
      error: null,
    });
    useFiltersStore.setState({
      filters: { ready: false, serialisedFilters: "" },
    });
  });

  // Renders the page with the given query data and marks filters ready so the
  // sessions table and paginator mount.
  async function renderWithData(data: any) {
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });
  }

  it("renders the Filters component", () => {
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
  });

  it("does not render main sessions UI when filters are not ready", () => {
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    expect(
      screen.queryByTestId("session-replay-overview-plot-mock"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("paginator-mock")).not.toBeInTheDocument();
    expect(screen.queryByTestId("loading-bar-mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Session")).not.toBeInTheDocument();
  });

  it("renders main sessions UI, updates URL when filters become ready, and renders table headers", async () => {
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: mockSessionTimelineData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    expect(replaceMock).toHaveBeenCalledWith("?po=0&updated", {
      scroll: false,
    });

    expect(
      await screen.findByTestId("session-replay-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();

    expect(screen.getByText("Session Replay")).toBeInTheDocument();
    expect(screen.getByText("Start Time")).toBeInTheDocument();
    expect(screen.getByText("Duration")).toBeInTheDocument();
  });

  it("displays session data correctly when API returns results", async () => {
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: mockSessionTimelineData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    expect(screen.getByText("Session ID: session1")).toBeInTheDocument();
    expect(screen.getByText("Jan 1, 2020")).toBeInTheDocument();
    expect(screen.getByText("12:00 AM")).toBeInTheDocument();
    expect(screen.getByText("1s")).toBeInTheDocument();
    expect(screen.getByText("Matched dummyMatch")).toBeInTheDocument();
    expect(
      screen.getByText("1.0(1), iOS 15, Apple iPhone 12"),
    ).toBeInTheDocument();
  });

  it("shows error message when API returns error status", async () => {
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    expect(
      screen.getByText(/Error fetching list of sessions/),
    ).toBeInTheDocument();
  });

  it("renders appropriate link for each session that includes teamId, app_id and session_id", async () => {
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: mockSessionTimelineData,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    const link = screen.getByRole("link", { name: /Session ID: session1/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/session_replays/app1/session1");

    const row = link.closest("tr");
    expect(row).toBeInTheDocument();

    await act(async () => {
      fireEvent.keyDown(row!, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/session_replays/app1/session1");

    await act(async () => {
      fireEvent.keyDown(row!, { key: " " });
    });
    expect(pushMock).toHaveBeenCalledWith("/123/session_replays/app1/session1");
  });

  it("shows N/A instead of a formatted duration for zero-duration sessions", async () => {
    // The backend sends duration as the number 0 for sessions with no
    // measurable span, and the page renders N/A instead of formatting it.
    await renderWithData({
      ...mockSessionTimelineData,
      results: [{ ...mockSessionTimelineData.results[0], duration: 0 }],
    });

    expect(screen.getByText("N/A")).toBeInTheDocument();
    expect(screen.queryByText("1s")).not.toBeInTheDocument();
  });

  it.each([
    ["ipados", "17", "1.0(1), iPadOS 17, Apple iPhone 12"],
    ["android", "14", "1.0(1), Android API Level 14, Apple iPhone 12"],
    ["harmony", "4", "1.0(1), harmony 4, Apple iPhone 12"],
  ])(
    "formats the OS name for os_name=%s in the device info line",
    async (osName, osVersion, expected) => {
      await renderWithData({
        ...mockSessionTimelineData,
        results: [
          {
            ...mockSessionTimelineData.results[0],
            attribute: {
              ...mockSessionTimelineData.results[0].attribute,
              os_name: osName,
              os_version: osVersion,
            },
          },
        ],
      });

      expect(screen.getByText(expected)).toBeInTheDocument();
    },
  );

  describe("paginator state derived from meta", () => {
    it("enables Next and disables Previous on the first page", async () => {
      await renderWithData({
        ...mockSessionTimelineData,
        meta: { previous: false, next: true },
      });

      expect(screen.getByTestId("next-button")).not.toBeDisabled();
      expect(screen.getByTestId("prev-button")).toBeDisabled();
    });

    it("enables Previous and disables Next on the last page", async () => {
      await renderWithData({
        ...mockSessionTimelineData,
        meta: { previous: true, next: false },
      });

      expect(screen.getByTestId("prev-button")).not.toBeDisabled();
      expect(screen.getByTestId("next-button")).toBeDisabled();
    });

    it("renders the table shell with both buttons disabled when results are empty", async () => {
      await renderWithData({
        results: [],
        meta: { previous: false, next: false },
      });

      expect(screen.getByText("Session Replay")).toBeInTheDocument();
      expect(screen.getByText("Start Time")).toBeInTheDocument();
      expect(screen.queryByText(/Session ID:/)).not.toBeInTheDocument();
      expect(screen.getByTestId("prev-button")).toBeDisabled();
      expect(screen.getByTestId("next-button")).toBeDisabled();
    });
  });

  describe("Pagination offset handling", () => {
    it("initializes pagination offset to 0 when no offset is provided", async () => {
      mockUseSessionReplayOverviewQuery.mockReturnValue({
        data: mockSessionTimelineData,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(
        <SessionReplayOverview params={promiseParams({ teamId: "123" })} />,
      );
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app-1" },
          },
        });
      });
      expect(replaceMock).toHaveBeenCalledWith("?po=0&updated", {
        scroll: false,
      });
    });

    it("increments pagination offset when Next is clicked", async () => {
      mockUseSessionReplayOverviewQuery.mockReturnValue({
        data: mockSessionTimelineData,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(
        <SessionReplayOverview params={promiseParams({ teamId: "123" })} />,
      );
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app-1" },
          },
        });
      });
      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      // The pagination limit is 5 so offset should be 5.
      expect(replaceMock).toHaveBeenLastCalledWith("?po=5&updated", {
        scroll: false,
      });
    });

    it("decrements pagination offset when Prev is clicked, but not below 0", async () => {
      mockUseSessionReplayOverviewQuery.mockReturnValue({
        data: mockSessionTimelineData,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(
        <SessionReplayOverview params={promiseParams({ teamId: "123" })} />,
      );
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app-1" },
          },
        });
      });
      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=5&updated", {
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
      mockUseSessionReplayOverviewQuery.mockReturnValue({
        data: mockSessionTimelineData,
        status: "success",
        isFetching: false,
        error: null,
      });

      render(
        <SessionReplayOverview params={promiseParams({ teamId: "123" })} />,
      );
      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated",
            app: { id: "app-1" },
          },
        });
      });
      expect(replaceMock).toHaveBeenCalledWith("?po=0&updated", {
        scroll: false,
      });

      // Click Next twice to get to offset 10.
      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=5&updated", {
        scroll: false,
      });

      await act(async () => {
        fireEvent.click(nextButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=10&updated", {
        scroll: false,
      });

      await act(async () => {
        useFiltersStore.setState({
          filters: {
            ready: true,
            serialisedFilters: "updated2",
            app: { id: "app-1" },
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
    mockUseSessionReplayOverviewQuery.mockReturnValue({
      data: undefined,
      status: "pending" as string,
      isFetching: true,
      error: null,
    });
    render(<SessionReplayOverview params={promiseParams({ teamId: "123" })} />);

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    const loadingBarContainer =
      screen.getByTestId("loading-bar-mock").parentElement;
    expect(loadingBarContainer).toHaveClass("visible");
    expect(loadingBarContainer).not.toHaveClass("invisible");

    await act(async () => {
      mockUseSessionReplayOverviewQuery.mockReturnValue({
        data: mockSessionTimelineData,
        status: "success",
        isFetching: false,
        error: null,
      });
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    expect(loadingBarContainer).not.toHaveClass("visible");
    expect(loadingBarContainer).toHaveClass("invisible");
  });
});

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

jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: jest.fn(),
}));

const pendingQueryState = () => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
});

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseProfilesQuery = jest.fn((_filter: any, _offset: number) =>
  pendingQueryState(),
);

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  paginationOffsetUrlKey: "po",
  PROFILES_LIMIT: 10,
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
  useProfilesQuery: (filter: any, offset: number) =>
    mockUseProfilesQuery(filter, offset),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-app">
        {props.value?.app.name ?? "none"}
      </span>
    </div>
  ),
}));

jest.mock("@/app/components/skeleton", () => ({
  __esModule: true,
  SkeletonListPage: () => <div data-testid="skeleton-list-page-mock" />,
}));

jest.mock("@/app/components/paginator", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="paginator-mock">
      <button
        data-testid="next-button"
        onClick={props.onNext}
        disabled={!props.nextEnabled}
      >
        Next
      </button>
    </div>
  ),
}));

jest.mock("@/app/components/loading_bar", () => () => (
  <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
));

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDate: jest.fn(() => "Jan 1, 2020"),
  formatDateToHumanReadableTime: jest.fn(() => "12:00 AM"),
}));

const mockOpenTraceInPerfetto = jest.fn((_url: string, _title: string) =>
  Promise.resolve(),
);
jest.mock("@/app/utils/perfetto_utils", () => ({
  openTraceInPerfetto: (url: string, title: string) =>
    mockOpenTraceInPerfetto(url, title),
}));

import ProfilesPage from "@/app/[teamId]/profiles/page";

const mockApps = [{ id: "app-1", name: "Sample", onboarded: true }];

const anrProfile = {
  id: "profile-anr",
  app_id: "app-1",
  session_id: "session-anr",
  timestamp: "2020-01-01T00:00:00Z",
  trigger: "anr",
  format: "perfetto_trace",
  attribute: {
    app_version: "1.2.0",
    app_build: "120",
    os_name: "android",
    os_version: "36",
    device_manufacturer: "Google",
    device_model: "Pixel 9",
  },
  attachments: [
    {
      id: "attachment-anr",
      name: "anr.perfetto-trace",
      type: "perfetto_trace",
      key: "anr.perfetto-trace",
      location: "https://example.com/anr.perfetto-trace",
    },
  ],
};

const drawnProfile = {
  ...anrProfile,
  id: "profile-drawn",
  session_id: "session-drawn",
  trigger: "app_fully_drawn",
  format: "perfetto_java_heap_dump",
};

function profilesLoaded(
  data: any = {
    results: [anrProfile, drawnProfile],
    meta: { previous: false, next: true },
  },
) {
  mockUseProfilesQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

function renderPage() {
  return render(<ProfilesPage params={promiseParams({ teamId: "123" })} />);
}

describe("Profiles page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockFiltersStore.reset();
    mockOpenTraceInPerfetto.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: mockApps });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [], key_groups: [] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseProfilesQuery.mockReset();
    mockUseProfilesQuery.mockReturnValue(pendingQueryState());
  });

  it("fetches nothing until it settles on an app and a range", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("none");
    expect(screen.getByTestId("skeleton-list-page-mock")).toBeInTheDocument();
    expect(mockUseProfilesQuery).toHaveBeenLastCalledWith(null, 0);
  });

  it("hands the bar the app it settled on", () => {
    profilesLoaded();
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent("Sample");
  });

  it("asks for the profiles entity's keys, and says so when they cannot be fetched", () => {
    mockUseFilterKeysQuery.mockReturnValue({
      data: undefined,
      isPending: false,
      isError: true,
      isPlaceholderData: false,
    });
    renderPage();

    expect(mockUseFilterKeysQuery).toHaveBeenCalledWith(
      "app-1",
      "profiles",
      [],
    );
    expect(
      screen.getByText(
        "Error fetching filters, please refresh page to try again",
      ),
    ).toBeInTheDocument();
  });

  it("fetches the profiles of the app and range it settled on", () => {
    profilesLoaded();
    renderPage();

    expect(mockUseProfilesQuery).toHaveBeenLastCalledWith(
      {
        appId: "app-1",
        startDate: expect.any(String),
        endDate: expect.any(String),
        filterExpr: null,
      },
      0,
    );
  });

  it("shows an error message when the profiles request fails", () => {
    mockUseProfilesQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of profiles/),
    ).toBeInTheDocument();
  });

  it("shows the empty state in place of the table when there are no profiles", () => {
    profilesLoaded({ results: [], meta: { previous: false, next: false } });
    renderPage();

    expect(screen.getByText("No profiles found")).toBeInTheDocument();
    expect(screen.queryByText("Profile Trigger")).not.toBeInTheDocument();
  });

  it("points the empty state to the profiling docs", () => {
    profilesLoaded({ results: [], meta: { previous: false, next: false } });
    renderPage();

    expect(screen.getByRole("link", { name: "Learn more" })).toHaveAttribute(
      "href",
      "/docs/performance-tracing/profiling",
    );
  });

  it("renders each profile's trigger, type, details and time", () => {
    profilesLoaded();
    renderPage();

    expect(screen.getByText("Perfetto trace")).toBeInTheDocument();
    expect(screen.getByText("ANR")).toBeInTheDocument();
    expect(screen.getByText("Perfetto Java heap dump")).toBeInTheDocument();
    expect(screen.getByText("App fully drawn")).toBeInTheDocument();
    expect(
      screen.getAllByText("1.2.0 (120), android 36, Google Pixel 9"),
    ).toHaveLength(2);
    expect(screen.getAllByText("Jan 1, 2020")).toHaveLength(2);
    expect(screen.getAllByText("12:00 AM")).toHaveLength(2);
  });

  it("labels the android 17 triggers", () => {
    profilesLoaded({
      results: [
        { ...anrProfile, id: "profile-oom", trigger: "oom" },
        { ...anrProfile, id: "profile-cold-start", trigger: "cold_start" },
        {
          ...anrProfile,
          id: "profile-cpu",
          trigger: "kill_excessive_cpu_usage",
        },
      ],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getByText("Out of Memory")).toBeInTheDocument();
    expect(screen.getByText("Cold start")).toBeInTheDocument();
    expect(screen.getByText("Excessive CPU usage")).toBeInTheDocument();
  });

  it("shows a trigger or type it does not know by its raw value", () => {
    profilesLoaded({
      results: [
        { ...anrProfile, trigger: "future_trigger", format: "future_type" },
      ],
      meta: { previous: false, next: false },
    });
    renderPage();

    expect(screen.getByText("future_trigger")).toBeInTheDocument();
    expect(screen.getByText("future_type")).toBeInTheDocument();
  });

  it("opens a profile's attachment in Perfetto", async () => {
    profilesLoaded();
    renderPage();

    await act(async () => {
      fireEvent.click(
        screen.getAllByRole("button", { name: "Open in Perfetto" })[0],
      );
    });

    expect(mockOpenTraceInPerfetto).toHaveBeenCalledWith(
      "https://example.com/anr.perfetto-trace",
      "anr.perfetto-trace",
    );
  });

  it("links each profile to its session replay", () => {
    profilesLoaded();
    renderPage();

    const links = screen.getAllByRole("link", { name: "View session replay" });
    expect(links.map((link) => link.getAttribute("href"))).toEqual([
      "/123/session_replays/app-1/session-anr",
      "/123/session_replays/app-1/session-drawn",
    ]);
  });

  it("downloads a profile's attachment", () => {
    profilesLoaded();
    renderPage();

    const download = screen.getAllByRole("link", { name: "Download" })[0];
    expect(download).toHaveAttribute(
      "href",
      "https://example.com/anr.perfetto-trace",
    );
    expect(download).toHaveAttribute("download", "anr.perfetto-trace");
  });

  it("moves the offset on by the page size when Next is clicked", async () => {
    mockRouter.setUrl("?po=0&a=app-1&d=Last+6+Hours");
    profilesLoaded();
    renderPage();

    await act(async () => {
      fireEvent.click(screen.getByTestId("next-button"));
    });

    expect(mockRouter.urlParams()).toEqual({
      a: "app-1",
      d: "Last 6 Hours",
      po: "10",
    });
  });
});

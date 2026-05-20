import ErrorDetailsPage from "@/app/[teamId]/errors/[appId]/[errorGroupId]/[errorGroupName]/page";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen } from "@testing-library/react";

const replaceMock = jest.fn();
const pushMock = jest.fn();

let mockSearchParams = new URLSearchParams();
jest.mock("next/navigation", () => ({
  useRouter: () => ({ replace: replaceMock, push: pushMock }),
  useSearchParams: () => mockSearchParams,
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyErrorGroupDetails: {
    meta: { next: false, previous: false },
    results: [],
  },
  FilterSource: { Errors: "errors", Events: "events" },
}));

jest.mock("@/app/stores/provider", () => {
  const { create } = jest.requireActual("zustand");
  const filtersStore = create(() => ({
    filters: { ready: false, serialisedFilters: "" },
  }));
  return { __esModule: true, useFiltersStore: filtersStore };
});

const mockUseErrorsDetailsQuery = jest.fn(() => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorsDetailsQuery: () => mockUseErrorsDetailsQuery(),
  paginationOffsetUrlKey: "po",
}));

jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters-mock" />,
  AppVersionsInitialSelectionType: { Latest: "latest", All: "all" },
}));

jest.mock("@/app/components/errors_details_plot", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="errors-details-plot-mock">ErrorsDetailsPlot Rendered</div>
  ),
}));

jest.mock("@/app/components/errors_distribution_plot", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="errors-distribution-plot-mock">
      ErrorsDistributionPlot Rendered
    </div>
  ),
}));

jest.mock("@/app/components/error_group_common_path", () => ({
  __esModule: true,
  default: () => (
    <div data-testid="error-group-common-path-mock">
      ErrorGroupCommonPath Rendered
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
    </div>
  ),
}));

jest.mock("@/app/components/copy_ai_context", () => ({
  __esModule: true,
  default: () => <div data-testid="copy-ai-context-mock" />,
}));

jest.mock("@/app/components/code_block", () => ({
  __esModule: true,
  default: ({ code }: any) => <div data-testid="code-block-mock">{code}</div>,
}));

jest.mock("next/image", () => ({
  __esModule: true,
  default: (props: any) => <img alt={props.alt} {...props} />,
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...rest }: any) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

jest.mock("@/app/utils/time_utils", () => ({
  formatDateToHumanReadableDateTime: () => "Jan 1, 2026, 12:00 AM",
}));

const { useFiltersStore } = require("@/app/stores/provider") as any;

const sampleErrorEvent = {
  id: "event-1",
  session_id: "sess-1",
  timestamp: "2026-04-10T10:30:00Z",
  type: "java.lang.NullPointerException",
  attribute: {
    app_version: "3.1.0",
    app_build: "310",
    thread_name: "main",
    device_manufacturer: "Google",
    device_model: "Pixel 8",
    network_type: "wifi",
  },
  exception: {
    title: "NullPointerException at CheckoutActivity.onClick",
    stacktrace:
      "java.lang.NullPointerException\n\tat sh.measure.demo.CheckoutActivity.onClick(CheckoutActivity.kt:42)",
    message: "Attempt to invoke virtual method on null object reference",
  },
  anr: null,
  attachments: [],
  threads: [
    { name: "AsyncTask #1", frames: ["java.lang.Thread.run(Thread.java:920)"] },
  ],
};

const sampleErrorsDetails = {
  results: [sampleErrorEvent],
  meta: { previous: false, next: true },
};

describe("ErrorGroupDetails Page", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    mockSearchParams = new URLSearchParams();
    mockUseErrorsDetailsQuery.mockReset();
    mockUseErrorsDetailsQuery.mockReturnValue({
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
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
  });

  it("does not render the main UI when filters are not ready", () => {
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    expect(
      screen.queryByTestId("errors-details-plot-mock"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("errors-distribution-plot-mock"),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId("error-group-common-path-mock"),
    ).not.toBeInTheDocument();
  });

  it("renders details plot, distribution plot, and common path when filters are ready", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: sampleErrorsDetails,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
        },
      });
    });

    expect(
      await screen.findByTestId("errors-details-plot-mock"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("errors-distribution-plot-mock"),
    ).toBeInTheDocument();
    expect(
      await screen.findByTestId("error-group-common-path-mock"),
    ).toBeInTheDocument();
  });

  it("renders Stack traces heading and event details when query succeeds", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: sampleErrorsDetails,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
        },
      });
    });

    expect(screen.getByText(/Stack traces/)).toBeInTheDocument();
    expect(screen.getByText(/Id: event-1/)).toBeInTheDocument();
    expect(screen.getByText(/App version: 3\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Device: GooglePixel 8/)).toBeInTheDocument();
    expect(screen.getByText(/Network type: wifi/)).toBeInTheDocument();
  });

  it("renders View Session Timeline link with teamId/appId/sessionId", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: sampleErrorsDetails,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
        },
      });
    });

    const link = screen.getByText("View Session Timeline").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/session_timelines/app-1/sess-1");
  });

  it("renders error message when details query errors", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
        },
      });
    });

    expect(
      screen.getByText(/Error fetching list of errors/),
    ).toBeInTheDocument();
  });

  it("Next click increments pagination offset by 1 and updates URL", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: sampleErrorsDetails,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
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
    expect(replaceMock).toHaveBeenLastCalledWith("?po=1&updated", {
      scroll: false,
    });
  });

  it("Prev click does not go below 0", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: { ...sampleErrorsDetails, meta: { previous: true, next: true } },
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
        },
      });
    });

    const prevButton = await screen.findByTestId("prev-button");
    await act(async () => {
      fireEvent.click(prevButton);
    });
    expect(replaceMock).toHaveBeenLastCalledWith("?po=0&updated", {
      scroll: false,
    });
  });

  it("resets pagination offset when filters change", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: { ...sampleErrorsDetails, meta: { previous: true, next: true } },
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={{
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        }}
      />,
    );
    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1", name: "measure demo" },
        },
      });
    });
    const nextButton = await screen.findByTestId("next-button");
    await act(async () => {
      fireEvent.click(nextButton);
    });
    expect(replaceMock).toHaveBeenLastCalledWith("?po=1&updated", {
      scroll: false,
    });

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated2",
          app: { id: "app-1", name: "measure demo" },
        },
      });
      await new Promise((r) => setTimeout(r, 0));
    });
    expect(replaceMock).toHaveBeenLastCalledWith("?po=0&updated2", {
      scroll: false,
    });
  });
});

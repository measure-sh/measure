import { promiseParams } from "@/__tests__/helpers/promise_params";
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

jest.mock("@/app/components/copy_agent_prompt", () => ({
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
      />,
    );
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
  });

  it("does not render the main UI when filters are not ready", () => {
    render(
      <ErrorDetailsPage
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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

  it("renders View Session Replay link with teamId/appId/sessionId", async () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: sampleErrorsDetails,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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

    const link = screen.getByText("View Session Replay").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/session_replays/app-1/sess-1");
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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

  // Renders the page with a single event assembled from sampleErrorEvent plus
  // the given field overrides, then marks filters ready so the details UI
  // paints. Used by the ANR and extra-attribute cases below.
  async function renderPageWithEvent(overrides: Record<string, any>) {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: {
        results: [{ ...sampleErrorEvent, ...overrides }],
        meta: { previous: false, next: true },
      },
      status: "success",
      isFetching: false,
      error: null,
    });
    render(
      <ErrorDetailsPage
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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
  }

  it("renders the ANR stack trace when the event is an ANR", async () => {
    await renderPageWithEvent({
      exception: null,
      anr: {
        title: "ANR at CheckoutActivity.onClick",
        stacktrace:
          "ANR in sh.measure.demo.CheckoutActivity.onClick(CheckoutActivity.kt:42)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)",
      },
    });
    expect(screen.getByText(/ANR in sh\.measure\.demo/)).toBeInTheDocument();
  });

  it("renders num_code, code, meta, and user_defined_attribute rows when present", async () => {
    await renderPageWithEvent({
      num_code: 137,
      code: "OUT_OF_MEMORY",
      meta: {
        error_domain: "PaymentDomain",
        recoverable: false,
      },
      user_defined_attribute: {
        user_tier: "premium",
        account_age_days: 142,
      },
    });

    expect(screen.getByText("num_code")).toBeInTheDocument();
    expect(screen.getByText("137")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
    expect(screen.getByText("OUT_OF_MEMORY")).toBeInTheDocument();
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByText(/error_domain/)).toBeInTheDocument();
    expect(screen.getByText("user_defined_attribute")).toBeInTheDocument();
    expect(screen.getByText(/user_tier/)).toBeInTheDocument();
    expect(screen.getByText(/premium/)).toBeInTheDocument();
  });

  it("omits num_code, code, meta, and user_defined_attribute rows when absent", async () => {
    await renderPageWithEvent({});
    expect(screen.queryByText("num_code")).not.toBeInTheDocument();
    expect(screen.queryByText("code")).not.toBeInTheDocument();
    expect(screen.queryByText("meta")).not.toBeInTheDocument();
    expect(
      screen.queryByText("user_defined_attribute"),
    ).not.toBeInTheDocument();
  });

  // The events endpoint returns num_code (number or null), code (string), and
  // meta (object or null) independently, so any combination can arrive. Each
  // row shows only when its value is available: num_code when it is a number
  // (including 0), code when it is a non-empty string, meta when it is a
  // non-null object with keys. The three cases below mirror real iOS error
  // payloads where that mix occurs.

  it("shows num_code 0 and meta, hides empty code", async () => {
    await renderPageWithEvent({
      num_code: 0,
      code: "",
      meta: {
        NSFilePath: "//invalid/file",
        NSURL: null,
        NSUnderlyingError: null,
        NSUserStringVariant: ["Remove"],
      },
    });

    // num_code of 0 is a real value, so the row must still show.
    expect(screen.getByText("num_code")).toBeInTheDocument();
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByText(/NSFilePath/)).toBeInTheDocument();
    // An empty code string hides the code row.
    expect(screen.queryByText("code")).not.toBeInTheDocument();
  });

  it("shows num_code 0 and code, hides null meta", async () => {
    await renderPageWithEvent({
      num_code: 0,
      code: "NamedException, Something happened",
      meta: null,
    });

    expect(screen.getByText("num_code")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
    expect(
      screen.getByText("NamedException, Something happened"),
    ).toBeInTheDocument();
    expect(screen.queryByText("meta")).not.toBeInTheDocument();
  });

  it("shows num_code, code, and meta together", async () => {
    await renderPageWithEvent({
      num_code: 260,
      code: "NSCocoaErrorDomain",
      meta: {
        NSFilePath: "/path/that/does/not/exist.txt",
        NSURL: null,
        NSUnderlyingError: null,
      },
    });

    expect(screen.getByText("num_code")).toBeInTheDocument();
    expect(screen.getByText("260")).toBeInTheDocument();
    expect(screen.getByText("code")).toBeInTheDocument();
    expect(screen.getByText("NSCocoaErrorDomain")).toBeInTheDocument();
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByText(/NSFilePath/)).toBeInTheDocument();
  });

  it("hides the meta row when meta is an empty object", async () => {
    await renderPageWithEvent({ meta: {} });
    expect(screen.queryByText("meta")).not.toBeInTheDocument();
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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
        params={promiseParams({
          teamId: "123",
          appId: "app-1",
          errorGroupId: "g1",
          errorGroupName: "test",
        })}
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

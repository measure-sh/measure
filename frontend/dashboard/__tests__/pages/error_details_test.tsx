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

const mockToastNegative = jest.fn();
jest.mock("@/app/components/toast", () => ({
  __esModule: true,
  toastNegative: (text: string) => mockToastNegative(text),
}));

jest.mock("@/app/api/api_calls", () => ({
  __esModule: true,
  emptyErrorGroupDetails: {
    meta: { next: false, previous: false },
    results: [],
  },
}));

const pendingQueryState = () => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
});

const mockUseAppsQuery = jest.fn();
const mockUseFilterKeysQuery = jest.fn();
const mockUseErrorsDetailsQuery = jest.fn(
  (_filter: any, _errorGroupId: string, _offset: number) => pendingQueryState(),
);
const mockUseErrorsDetailsPlotQuery = jest.fn(
  (_filter: any, _errorGroupId: string) => pendingQueryState(),
);
const mockUseErrorsDistributionPlotQuery = jest.fn(
  (_filter: any, _errorGroupId: string) => pendingQueryState(),
);

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
  useErrorsDetailsQuery: (filter: any, errorGroupId: string, offset: number) =>
    mockUseErrorsDetailsQuery(filter, errorGroupId, offset),
  useErrorsDetailsPlotQuery: (filter: any, errorGroupId: string) =>
    mockUseErrorsDetailsPlotQuery(filter, errorGroupId),
  useErrorsDistributionPlotQuery: (filter: any, errorGroupId: string) =>
    mockUseErrorsDistributionPlotQuery(filter, errorGroupId),
}));

jest.mock("@/app/components/filter_bar/filter_bar", () => ({
  __esModule: true,
  default: (props: any) => (
    <div data-testid="filter-bar-mock">
      <span data-testid="filter-bar-entity">{props.entity}</span>
      <span data-testid="filter-bar-show-app-select">
        {String(props.showAppSelect)}
      </span>
      <span data-testid="filter-bar-app">
        {props.value?.app.name ?? "none"}
      </span>
      <span data-testid="filter-bar-expr">
        {props.value?.filterExpr ?? "none"}
      </span>
      <button
        data-testid="filter-bar-apply"
        onClick={() => props.onChange({ filterExpr: "os_name:in:android" })}
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

import ErrorDetailsPage from "@/app/[teamId]/errors/[appId]/[errorGroupId]/[errorGroupName]/page";

const mockApp = { id: "app-1", name: "measure demo", onboarded: true };

const osNameKey = {
  name: "os_name",
  label: "OS name",
  key_group: "OS",
  description: "The operating system the error occurred on",
  value_type: "string",
  value_suggestion_mode: "full_list",
  operators: ["in", "not_in"],
};

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

function detailsLoaded(data: any = sampleErrorsDetails) {
  mockUseErrorsDetailsQuery.mockReturnValue({
    data,
    status: "success",
    isFetching: false,
    error: null,
  });
}

const settled = { a: "app-1", d: "Last 6 Hours" };

function renderPage() {
  return render(
    <ErrorDetailsPage
      params={promiseParams({
        teamId: "123",
        appId: "app-1",
        errorGroupId: "g1",
        errorGroupName: "test",
      })}
    />,
  );
}

describe("ErrorGroupDetails page", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockToastNegative.mockClear();
    mockUseAppsQuery.mockReturnValue({ status: "success", data: [mockApp] });
    mockUseFilterKeysQuery.mockReturnValue({
      data: { keys: [osNameKey], key_groups: ["Error"] },
      isPending: false,
      isError: false,
      isPlaceholderData: false,
    });
    mockUseErrorsDetailsQuery.mockReset();
    mockUseErrorsDetailsQuery.mockReturnValue(pendingQueryState());
    mockUseErrorsDetailsPlotQuery.mockReset();
    mockUseErrorsDetailsPlotQuery.mockReturnValue(pendingQueryState());
    mockUseErrorsDistributionPlotQuery.mockReset();
    mockUseErrorsDistributionPlotQuery.mockReturnValue(pendingQueryState());
  });

  it("renders the filter bar fixed to the route's app, with no app select", () => {
    renderPage();

    expect(screen.getByTestId("filter-bar-mock")).toBeInTheDocument();
    expect(screen.getByTestId("filter-bar-entity")).toHaveTextContent(
      "error_group_events",
    );
    expect(screen.getByTestId("filter-bar-show-app-select")).toHaveTextContent(
      "false",
    );
    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent(
      "measure demo",
    );
  });

  it("stays fixed to the route's app even when the URL names another one", () => {
    mockRouter.setUrl("?a=some-other-app");
    renderPage();

    expect(screen.getByTestId("filter-bar-app")).toHaveTextContent(
      "measure demo",
    );
    expect(mockUseErrorsDetailsQuery).toHaveBeenLastCalledWith(
      expect.objectContaining({ appId: "app-1" }),
      "g1",
      0,
    );
  });

  it("does not render the main UI until the app and range settle", () => {
    mockUseAppsQuery.mockReturnValue({ status: "pending", data: undefined });
    renderPage();

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

  it("renders details plot, distribution plot, and common path once ready", async () => {
    detailsLoaded();
    renderPage();

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

  it("renders Stack traces heading and event details when the query succeeds", () => {
    detailsLoaded();
    renderPage();

    expect(screen.getByText(/Stack traces/)).toBeInTheDocument();
    expect(screen.getByText(/Id: event-1/)).toBeInTheDocument();
    expect(screen.getByText(/App version: 3\.1\.0/)).toBeInTheDocument();
    expect(screen.getByText(/Device: GooglePixel 8/)).toBeInTheDocument();
    expect(screen.getByText(/Network type: wifi/)).toBeInTheDocument();
  });

  it("renders a View Session Replay link with teamId/appId/sessionId", () => {
    detailsLoaded();
    renderPage();

    const link = screen.getByText("View Session Replay").closest("a");
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/123/session_replays/app-1/sess-1");
  });

  it("shows an error message when the details query errors", () => {
    mockUseErrorsDetailsQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    renderPage();

    expect(
      screen.getByText(/Error fetching list of errors/),
    ).toBeInTheDocument();
  });

  // Renders the page with a single event assembled from sampleErrorEvent plus
  // the given field overrides.
  function renderPageWithEvent(overrides: Record<string, any>) {
    detailsLoaded({
      results: [{ ...sampleErrorEvent, ...overrides }],
      meta: { previous: false, next: true },
    });
    return renderPage();
  }

  it("renders the ANR stack trace when the event is an ANR", () => {
    renderPageWithEvent({
      exception: null,
      anr: {
        title: "ANR at CheckoutActivity.onClick",
        stacktrace:
          "ANR in sh.measure.demo.CheckoutActivity.onClick(CheckoutActivity.kt:42)\n\tat android.os.Handler.dispatchMessage(Handler.java:106)",
      },
    });
    expect(screen.getByText(/ANR in sh\.measure\.demo/)).toBeInTheDocument();
  });

  it("renders num_code, code, meta, and user_defined_attribute rows when present", () => {
    renderPageWithEvent({
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

  it("omits num_code, code, meta, and user_defined_attribute rows when absent", () => {
    renderPageWithEvent({});
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

  it("shows num_code 0 and meta, hides empty code", () => {
    renderPageWithEvent({
      num_code: 0,
      code: "",
      meta: {
        NSFilePath: "//invalid/file",
        NSURL: null,
        NSUnderlyingError: null,
        NSUserStringVariant: ["Remove"],
      },
    });

    expect(screen.getByText("num_code")).toBeInTheDocument();
    expect(screen.getByText("meta")).toBeInTheDocument();
    expect(screen.getByText(/NSFilePath/)).toBeInTheDocument();
    expect(screen.queryByText("code")).not.toBeInTheDocument();
  });

  it("shows num_code 0 and code, hides null meta", () => {
    renderPageWithEvent({
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

  it("shows num_code, code, and meta together", () => {
    renderPageWithEvent({
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

  it("hides the meta row when meta is an empty object", () => {
    renderPageWithEvent({ meta: {} });
    expect(screen.queryByText("meta")).not.toBeInTheDocument();
  });

  describe("pagination", () => {
    it("Next click increments the pagination offset by 1", async () => {
      detailsLoaded();
      renderPage();

      const nextButton = await screen.findByTestId("next-button");
      await act(async () => {
        fireEvent.click(nextButton);
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "1" });
      expect(mockUseErrorsDetailsQuery).toHaveBeenLastCalledWith(
        expect.objectContaining({ appId: "app-1" }),
        "g1",
        1,
      );
    });

    it("Prev click does not go below 0", async () => {
      mockRouter.setUrl("?po=1");
      detailsLoaded({
        ...sampleErrorsDetails,
        meta: { previous: true, next: true },
      });
      renderPage();

      const prevButton = await screen.findByTestId("prev-button");
      await act(async () => {
        fireEvent.click(prevButton);
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });

      await act(async () => {
        fireEvent.click(prevButton);
      });
      expect(mockRouter.urlParams()).toEqual({ ...settled, po: "0" });
    });

    it("resets the pagination offset when the filter changes", async () => {
      mockRouter.setUrl("?po=1");
      detailsLoaded();
      renderPage();

      await act(async () => {
        fireEvent.click(screen.getByTestId("filter-bar-apply"));
      });

      expect(mockRouter.urlParams()).toEqual({
        ...settled,
        po: "0",
        filter_expr: "os_name:in:android",
      });
    });
  });
});

import { promiseParams } from "@/__tests__/helpers/promise_params";
import ErrorsOverviewPage from "@/app/[teamId]/errors/page";
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
  emptyErrorsOverviewResponse: {
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

const mockUseErrorsOverviewQuery = jest.fn(() => ({
  data: undefined as any,
  status: "pending" as string,
  isFetching: true,
  error: null as Error | null,
}));

jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  useErrorsOverviewQuery: () => mockUseErrorsOverviewQuery(),
  paginationOffsetUrlKey: "po",
}));

jest.mock("@/app/components/filters", () => ({
  __esModule: true,
  default: () => <div data-testid="filters-mock" />,
  AppVersionsInitialSelectionType: { Latest: "latest", All: "all" },
}));

jest.mock("@/app/components/errors_overview_plot", () => () => (
  <div data-testid="errors-overview-plot-mock">ErrorsOverviewPlot Rendered</div>
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
    </div>
  ),
}));

jest.mock("@/app/components/loading_bar", () => () => (
  <div data-testid="loading-bar-mock">LoadingBar Rendered</div>
));

const { useFiltersStore } = require("@/app/stores/provider") as any;

const sampleErrorGroup = {
  id: "group-1",
  type: "java.lang.NullPointerException",
  message: "something went wrong",
  method_name: "onClick",
  file_name: "CheckoutActivity.kt",
  count: 1523,
  percentage_contribution: 45.2,
};

const sampleErrorsOverview = {
  results: [sampleErrorGroup],
  meta: { previous: false, next: true },
};

describe("ErrorsOverview Page", () => {
  beforeEach(() => {
    replaceMock.mockClear();
    pushMock.mockClear();
    mockSearchParams = new URLSearchParams();
    mockUseErrorsOverviewQuery.mockReset();
    mockUseErrorsOverviewQuery.mockReturnValue({
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
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
    expect(screen.getByTestId("filters-mock")).toBeInTheDocument();
  });

  it("does not render the main UI when filters are not ready", () => {
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
    expect(
      screen.queryByTestId("errors-overview-plot-mock"),
    ).not.toBeInTheDocument();
    expect(screen.queryByTestId("paginator-mock")).not.toBeInTheDocument();
    expect(screen.queryByText("Error")).not.toBeInTheDocument();
  });

  it("renders main UI, table headers, and updates URL when filters become ready", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: sampleErrorsOverview,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);

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
      await screen.findByTestId("errors-overview-plot-mock"),
    ).toBeInTheDocument();
    expect(await screen.findByTestId("paginator-mock")).toBeInTheDocument();

    expect(screen.getByText("Error")).toBeInTheDocument();
    expect(screen.getByText("Instances")).toBeInTheDocument();
    expect(screen.getByText("Percentage contribution")).toBeInTheDocument();
  });

  it("renders error group data rows from query result", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: sampleErrorsOverview,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);

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
      screen.getByText("CheckoutActivity.kt: onClick()"),
    ).toBeInTheDocument();
    expect(
      screen.getByText("java.lang.NullPointerException:something went wrong"),
    ).toBeInTheDocument();
    expect(screen.getByText("1523")).toBeInTheDocument();
    expect(screen.getByText("45.2%")).toBeInTheDocument();
  });

  it("shows error message when overview query errors", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: undefined,
      status: "error",
      isFetching: false,
      error: new Error("fail"),
    });
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);

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
      screen.getByText(/Error fetching list of errors/),
    ).toBeInTheDocument();
  });

  it("row link points to detail route with teamId/appId/errorGroupId/encoded name", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: sampleErrorsOverview,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    const link = screen.getByRole("link", {
      name: /CheckoutActivity\.kt: onClick\(\)/i,
    });
    expect(link).toBeInTheDocument();
    const href = link.getAttribute("href");
    expect(href).toContain("/123/errors/app-1/group-1/");
    expect(href).toContain(
      encodeURIComponent("java.lang.NullPointerException@CheckoutActivity.kt"),
    );
  });

  it("Enter key on a data row navigates to detail page", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: sampleErrorsOverview,
      status: "success",
      isFetching: false,
      error: null,
    });
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);

    await act(async () => {
      useFiltersStore.setState({
        filters: {
          ready: true,
          serialisedFilters: "updated",
          app: { id: "app-1" },
        },
      });
    });

    const link = screen.getByRole("link", {
      name: /CheckoutActivity\.kt: onClick\(\)/i,
    });
    const row = link.closest("tr")!;
    await act(async () => {
      fireEvent.keyDown(row, { key: "Enter" });
    });
    expect(pushMock).toHaveBeenCalled();
    const target = pushMock.mock.calls[pushMock.mock.calls.length - 1][0];
    expect(target).toContain("/123/errors/app-1/group-1/");
  });

  describe("pagination", () => {
    it("initializes paginationOffset to 0 in URL when none provided", async () => {
      mockUseErrorsOverviewQuery.mockReturnValue({
        data: sampleErrorsOverview,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
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

    it("increments offset by 5 on Next click", async () => {
      mockUseErrorsOverviewQuery.mockReturnValue({
        data: sampleErrorsOverview,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
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
    });

    it("decrements offset by 5 on Prev click (not below 0)", async () => {
      mockUseErrorsOverviewQuery.mockReturnValue({
        data: { ...sampleErrorsOverview, meta: { previous: true, next: true } },
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
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

      // Clicking Prev again must not go negative
      await act(async () => {
        fireEvent.click(prevButton);
      });
      expect(replaceMock).toHaveBeenLastCalledWith("?po=0&updated", {
        scroll: false,
      });
    });

    it("resets pagination offset when filters change", async () => {
      mockUseErrorsOverviewQuery.mockReturnValue({
        data: sampleErrorsOverview,
        status: "success",
        isFetching: false,
        error: null,
      });
      render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
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

  it("toggles loading bar visibility from isFetching", async () => {
    mockUseErrorsOverviewQuery.mockReturnValue({
      data: sampleErrorsOverview,
      status: "success",
      isFetching: true,
      error: null,
    });
    render(<ErrorsOverviewPage params={promiseParams({ teamId: "123" })} />);
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
      mockUseErrorsOverviewQuery.mockReturnValue({
        data: sampleErrorsOverview,
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

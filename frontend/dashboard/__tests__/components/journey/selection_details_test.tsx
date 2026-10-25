import { mockRouter } from "@/__tests__/helpers/mock_router";
import type {
  Journey,
  JourneyNode,
  JourneySelection,
} from "@/app/api/api_calls";
import SelectionDetails from "@/app/components/journey/selection_details";
import { beforeEach, describe, expect, it } from "@jest/globals";
import "@testing-library/jest-dom";
import { fireEvent, render, screen } from "@testing-library/react";

jest.mock("next/navigation", () =>
  require("@/__tests__/helpers/mock_router").nextNavigationMock(),
);

// The four list hooks report to one mock, with the list's name first, so a
// test can find the calls of each list. The sample percent comes last.
const mockUseJourneyListQuery = jest.fn();
const mockUseJourneyPathUsersQuery = jest.fn();
jest.mock("@/app/query/hooks", () => ({
  __esModule: true,
  JOURNEY_LIST_LIMIT: 5,
  RootSpanMetricsQuantile: { p50: "p50", p90: "p90", p95: "p95", p99: "p99" },
  useJourneyErrorsQuery: (
    params: unknown,
    samplePercent: unknown,
    selection: unknown,
    offset: number,
    enabled: boolean,
  ) =>
    mockUseJourneyListQuery(
      "errors",
      params,
      selection,
      null,
      offset,
      enabled,
      samplePercent,
    ),
  useJourneyTracesQuery: (
    params: unknown,
    samplePercent: unknown,
    selection: unknown,
    quantile: string,
    offset: number,
    enabled: boolean,
  ) =>
    mockUseJourneyListQuery(
      "traces",
      params,
      selection,
      quantile,
      offset,
      enabled,
      samplePercent,
    ),
  useJourneyNetworkQuery: (
    params: unknown,
    samplePercent: unknown,
    selection: unknown,
    quantile: string,
    offset: number,
    enabled: boolean,
  ) =>
    mockUseJourneyListQuery(
      "network",
      params,
      selection,
      quantile,
      offset,
      enabled,
      samplePercent,
    ),
  useJourneySessionsQuery: (
    params: unknown,
    samplePercent: unknown,
    selection: unknown,
    offset: number,
    enabled: boolean,
  ) =>
    mockUseJourneyListQuery(
      "sessions",
      params,
      selection,
      null,
      offset,
      enabled,
      samplePercent,
    ),
  useJourneyPathUsersQuery: (...args: unknown[]) =>
    mockUseJourneyPathUsersQuery(...args),
}));

function node(
  id: string,
  kind: JourneyNode["kind"],
  users: number,
  continuing: number,
): JourneyNode {
  return {
    id,
    name: id,
    kind,
    step: 1,
    users,
    continuing,
    median_ms_from_previous: 2_000,
  };
}

const journey: Journey = {
  sample_percent: 37.5,
  nodes: [
    node("sh.measure.demo.CartActivity", "screen", 1_000, 800),
    node("checkout_started", "event", 400, 400),
    node("Fatal error", "fatal", 50, 0),
  ],
  links: [
    {
      source: "sh.measure.demo.CartActivity",
      target: "checkout_started",
      users: 400,
    },
    {
      source: "sh.measure.demo.CartActivity",
      target: "Fatal error",
      users: 30,
    },
  ],
};

const params = {
  appId: "app-1",
  startDate: "2026-10-01T00:00:00Z",
  endDate: "2026-10-08T00:00:00Z",
  filterExpr: null,
};

const page = (results: unknown[], next = false, previous = false) => ({
  status: "success",
  isFetching: false,
  data: { meta: { next, previous }, results },
});

const errors = [
  {
    id: "g1",
    type: "IllegalStateException",
    error_type: "exception",
    severity: "fatal",
    message: "cart empty",
    method_name: "checkout()",
    file_name: "Cart.kt",
    count: 12,
    users: 9,
  },
];
const traces = [
  { span_name: "cart.load", count: 30, users: 20, duration_ms: 1_500 },
];
const endpoints = [
  {
    domain: "api.example.com",
    path_pattern: "/v1/cart",
    count: 40,
    users: 25,
    latency_ms: 300,
  },
];
const sessions = [
  {
    session_id: "s1",
    user_id: "user-1",
    installation_id: "install-1",
    first_event_time: "2026-10-02T10:00:00Z",
    duration: 60_000,
  },
];

const listsByName: Record<string, unknown[]> = {
  errors,
  traces,
  network: endpoints,
  sessions,
};

function lastCall(list: string) {
  const calls = mockUseJourneyListQuery.mock.calls.filter(
    ([name]) => name === list,
  );
  const [, , selection, quantile, offset, enabled, samplePercent] =
    calls[calls.length - 1];
  return { selection, quantile, offset, enabled, samplePercent };
}

function renderDetails(selection: JourneySelection) {
  return render(
    <SelectionDetails
      teamId="test-team"
      params={params}
      journey={journey}
      selection={selection}
      onChangeUrl={mockRouter.setPageUrlKeys}
      onDiscardUrlKeys={mockRouter.discardPageUrlKeys}
    />,
  );
}

const button = (name: string) => screen.getByRole("button", { name });

describe("SelectionDetails", () => {
  beforeEach(() => {
    mockRouter.reset();
    mockRouter.setUrl("?d=Last+7+Days");
    mockUseJourneyListQuery.mockReset();
    mockUseJourneyListQuery.mockImplementation((list: string) =>
      page(listsByName[list]),
    );
    mockUseJourneyPathUsersQuery.mockReset();
    mockUseJourneyPathUsersQuery.mockReturnValue({
      data: { users: 250 },
      isError: false,
    });
  });

  describe("the summary", () => {
    it("describes a selected node with its stats", () => {
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      const title = screen.getByText("CartActivity");
      expect(title).toHaveAttribute("title", "sh.measure.demo.CartActivity");
      expect(
        screen.getByText(
          "Errors, traces, network requests and session replays between CartActivity and all immediate next steps.",
        ),
      ).toBeInTheDocument();
      expect(screen.getByText("Continuing").nextSibling).toHaveTextContent(
        "800 (80%)",
      );
      expect(screen.getByText("Dropping off").nextSibling).toHaveTextContent(
        "200 (20%)",
      );
    });

    it("describes the fatal error node", () => {
      renderDetails({ node: "Fatal error" });

      expect(
        screen.getByText("Crashes, ANRs and App hangs that ended sessions."),
      ).toBeInTheDocument();
      expect(screen.queryByText("Continuing")).toBeNull();
    });

    it("describes a selected link with its stats", () => {
      renderDetails({
        source: "sh.measure.demo.CartActivity",
        target: "checkout_started",
      });

      expect(
        screen.getByText("CartActivity → checkout_started"),
      ).toHaveAttribute(
        "title",
        "sh.measure.demo.CartActivity → checkout_started",
      );
      expect(
        screen.getByText(
          "Errors, traces, network requests and session replays between CartActivity and checkout_started.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Conversion from CartActivity").nextSibling,
      ).toHaveTextContent("40%");
    });

    it("describes a link to the fatal error node", () => {
      renderDetails({
        source: "sh.measure.demo.CartActivity",
        target: "Fatal error",
      });

      expect(
        screen.getByText(
          "Errors, traces, network requests and session replays between CartActivity and the fatal error.",
        ),
      ).toBeInTheDocument();
    });

    it("describes a selected path with the users that went through it", () => {
      const path = [
        "sh.measure.demo.CartActivity",
        "checkout_started",
        "Fatal error",
      ];
      renderDetails({ path });

      expect(
        screen.getByText("CartActivity → checkout_started → Fatal error"),
      ).toHaveAttribute(
        "title",
        "sh.measure.demo.CartActivity → checkout_started → Fatal error",
      );
      expect(
        screen.getByText(
          "Errors, traces, network requests and session replays between CartActivity and the fatal error in sessions that sequentially progressed through the path.",
        ),
      ).toBeInTheDocument();
      expect(
        screen.getByText("Users", { selector: "p" }).nextSibling,
      ).toHaveTextContent("250");
      expect(
        screen.getByText("Conversion from CartActivity").nextSibling,
      ).toHaveTextContent("25%");
      expect(mockUseJourneyPathUsersQuery).toHaveBeenLastCalledWith(
        params,
        37.5,
        path,
        true,
      );
      expect(lastCall("errors").selection).toEqual({ path });
    });

    it("leaves the path's users unfetched for a node or link", () => {
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(mockUseJourneyPathUsersQuery).toHaveBeenLastCalledWith(
        params,
        37.5,
        [],
        false,
      );
    });

    it("shows a placeholder for the stats until the path's users load, and an error if they fail", () => {
      const path = ["sh.measure.demo.CartActivity", "checkout_started"];
      mockUseJourneyPathUsersQuery.mockReturnValue({
        data: undefined,
        isError: false,
      });
      const { rerender } = renderDetails({ path });

      expect(screen.queryByText("Users", { selector: "p" })).toBeNull();

      mockUseJourneyPathUsersQuery.mockReturnValue({
        data: undefined,
        isError: true,
      });
      rerender(
        <SelectionDetails
          teamId="test-team"
          params={params}
          journey={journey}
          selection={{ path }}
          onChangeUrl={mockRouter.setPageUrlKeys}
          onDiscardUrlKeys={mockRouter.discardPageUrlKeys}
        />,
      );

      expect(
        screen.getByText("Error fetching the users of this path."),
      ).toBeInTheDocument();
    });

    it("shows nothing for a path through a node the journey doesn't have", () => {
      const { container } = renderDetails({
        path: ["sh.measure.demo.CartActivity", "missing"],
      });

      expect(container).toBeEmptyDOMElement();
    });

    it("shows nothing for a selection the journey doesn't have", () => {
      const { container } = renderDetails({
        source: "checkout_started",
        target: "sh.measure.demo.CartActivity",
      });

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe("the lists", () => {
    it("fetches only the errors until another list is opened, each in the sample of the journey", () => {
      const selection = { node: "sh.measure.demo.CartActivity" };
      renderDetails(selection);

      expect(lastCall("errors")).toEqual({
        selection,
        quantile: null,
        offset: 0,
        enabled: true,
        samplePercent: 37.5,
      });
      expect(lastCall("traces").enabled).toBe(false);
      expect(lastCall("network").enabled).toBe(false);
      expect(lastCall("sessions").enabled).toBe(false);

      fireEvent.click(button("Traces"));
      fireEvent.click(button("Errors"));

      expect(lastCall("traces")).toEqual({
        selection,
        quantile: "p50",
        offset: 0,
        enabled: true,
        samplePercent: 37.5,
      });
      expect(lastCall("network").enabled).toBe(false);
      expect(lastCall("network").samplePercent).toBe(37.5);
      expect(lastCall("sessions").samplePercent).toBe(37.5);
    });

    it("links each error to its error group with the date range", () => {
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      const row = screen.getByRole("link", { name: "Cart.kt: checkout()" });
      expect(row).toHaveAttribute(
        "href",
        "/test-team/errors/app-1/g1/IllegalStateException%40Cart.kt?d=Last+7+Days&from=journeys",
      );
      expect(
        screen.getByText("IllegalStateException:cart empty"),
      ).toBeInTheDocument();
    });

    it("links each trace to the traces page for its root span", () => {
      renderDetails({ node: "sh.measure.demo.CartActivity" });
      fireEvent.click(button("Traces"));

      expect(screen.getByRole("link", { name: "cart.load" })).toHaveAttribute(
        "href",
        "/test-team/traces?d=Last+7+Days&a=app-1&r=cart.load",
      );
      expect(screen.getByText("Duration (p50)")).toBeInTheDocument();
    });

    it("links each endpoint to its network details", () => {
      renderDetails({ node: "sh.measure.demo.CartActivity" });
      fireEvent.click(button("Network"));

      expect(
        screen.getByRole("link", { name: "api.example.com/v1/cart" }),
      ).toHaveAttribute(
        "href",
        "/test-team/network/details?d=Last+7+Days&a=app-1&domain=api.example.com&path=%2Fv1%2Fcart&from=journeys",
      );
    });

    it("links each session to its replay", () => {
      renderDetails({ node: "sh.measure.demo.CartActivity" });
      fireEvent.click(button("Session Replays"));

      expect(
        screen.getByRole("link", { name: "Session ID: s1" }),
      ).toHaveAttribute(
        "href",
        "/test-team/session_replays/app-1/s1?from=journeys",
      );
      expect(screen.getByText("user-1")).toBeInTheDocument();
      expect(screen.getByText("install-1")).toBeInTheDocument();
    });

    it("changes the quantile of traces and network together and returns both to the first page", () => {
      mockUseJourneyListQuery.mockImplementation((list: string) =>
        page(listsByName[list], true),
      );
      renderDetails({ node: "sh.measure.demo.CartActivity" });
      fireEvent.click(button("Network"));
      fireEvent.click(button("Next"));
      expect(lastCall("network").offset).toBe(5);

      fireEvent.click(button("p95"));

      expect(lastCall("network")).toMatchObject({ quantile: "p95", offset: 0 });
      expect(lastCall("traces").quantile).toBe("p95");
      expect(screen.getByText("Latency (p95)")).toBeInTheDocument();
    });

    it("pages each list on its own", () => {
      mockUseJourneyListQuery.mockImplementation((list: string) =>
        page(listsByName[list], true, true),
      );
      renderDetails({ node: "sh.measure.demo.CartActivity" });
      fireEvent.click(button("Next"));
      fireEvent.click(button("Next"));
      expect(lastCall("errors").offset).toBe(10);

      fireEvent.click(button("Traces"));
      expect(lastCall("traces").offset).toBe(0);
      fireEvent.click(button("Next"));
      expect(lastCall("traces").offset).toBe(5);

      fireEvent.click(button("Errors"));
      fireEvent.click(button("Previous"));
      expect(lastCall("errors").offset).toBe(5);
    });

    it("opens the list, quantile and pages from the URL, fetching only that list", () => {
      mockRouter.setUrl("?d=Last+7+Days&jl=Network&jq=p95&jon=10&joe=5");
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(lastCall("network")).toMatchObject({
        quantile: "p95",
        offset: 10,
        enabled: true,
      });
      expect(lastCall("errors")).toMatchObject({ offset: 5, enabled: false });
      expect(screen.getByText("Latency (p95)")).toBeInTheDocument();
    });

    it.each([
      ["an unknown list and quantile", "jl=Logs&jq=p42"],
      ["a negative page", "joe=-5"],
      ["a fractional page", "joe=2.5"],
      ["a page that is not a number", "joe=five"],
    ])(
      "falls back to the errors at p50 from the first page for %s",
      (_, search) => {
        mockRouter.setUrl(`?${search}`);
        renderDetails({ node: "sh.measure.demo.CartActivity" });

        expect(lastCall("errors")).toMatchObject({ offset: 0, enabled: true });
        expect(lastCall("traces").quantile).toBe("p50");
      },
    );

    it("writes the list, quantile and pages to the URL and leaves the first page out", () => {
      mockUseJourneyListQuery.mockImplementation((list: string) =>
        page(listsByName[list], true, true),
      );
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      fireEvent.click(button("Traces"));
      fireEvent.click(button("p90"));
      fireEvent.click(button("Next"));

      expect(mockRouter.urlParams()).toEqual({
        d: "Last 7 Days",
        jl: "Traces",
        jq: "p90",
        jot: "5",
      });

      fireEvent.click(button("Previous"));

      expect(mockRouter.urlParams()).toEqual({
        d: "Last 7 Days",
        jl: "Traces",
        jq: "p90",
      });
    });

    it("removes an unknown list, quantile and pages from the URL and keeps the rest", () => {
      mockRouter.setUrl("?jl=Logs&jq=p42&joe=five&jot=-5&jon=0&jos=10");
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(mockRouter.urlParams()).toEqual({ jos: "10" });
    });

    it("keeps a known list, quantile and page in the URL", () => {
      mockRouter.setUrl("?jl=Traces&jq=p95&jot=5");
      mockUseJourneyListQuery.mockImplementation((list: string) =>
        page(listsByName[list], true, true),
      );
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(mockRouter.urlParams()).toEqual({
        jl: "Traces",
        jq: "p95",
        jot: "5",
      });
    });

    it("goes back to the first page of a list that comes back empty past it", () => {
      mockRouter.setUrl("?jl=Traces&jot=10");
      mockUseJourneyListQuery.mockImplementation(
        (
          list: string,
          _params: unknown,
          _selection: unknown,
          _quantile: unknown,
          offset: number,
        ) =>
          list === "traces" && offset === 10
            ? page([], false, true)
            : page(listsByName[list], true),
      );
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(mockRouter.urlParams()).toEqual({ jl: "Traces" });
      expect(lastCall("traces").offset).toBe(0);
    });

    it("keeps a page in the URL while its list shows the rows of the previous page", () => {
      mockRouter.setUrl("?jot=10&jl=Traces");
      mockUseJourneyListQuery.mockImplementation((list: string) =>
        list === "traces"
          ? { ...page([]), isPlaceholderData: true }
          : page(listsByName[list]),
      );
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(mockRouter.urlParams()).toEqual({ jot: "10", jl: "Traces" });
    });

    it("disables paging while the list fetches", () => {
      mockUseJourneyListQuery.mockImplementation((list: string) => ({
        ...page(listsByName[list], true, true),
        isFetching: true,
      }));
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(button("Next")).toBeDisabled();
      expect(button("Previous")).toBeDisabled();
    });

    it("says when a list has nothing for the selection", () => {
      mockUseJourneyListQuery.mockImplementation(() => page([]));
      renderDetails({ node: "sh.measure.demo.CartActivity" });

      expect(
        screen.getByText("No errors between these steps"),
      ).toBeInTheDocument();
    });
  });
});

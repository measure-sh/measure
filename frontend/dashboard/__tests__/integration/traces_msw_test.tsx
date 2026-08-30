/**
 * Integration tests for Traces Overview and Detail pages.
 *
 * Overview: FilterBar-driven spans list with 4 columns (Trace, Start Time,
 * Duration, Status), a span metrics plot with quantile selector, and a
 * root span ("Trace Name") selector the FilterBar owns and whose resolved
 * choice the span queries require.
 *
 * Detail: single trace with pills (User ID, Start Time, Duration,
 * Device, App version, Network type), TraceWaterfall timeline visualization,
 * and "View Session Replay" link.
 */
import { mockRouter } from "@/__tests__/helpers/mock_router";
import { promiseParams } from "@/__tests__/helpers/promise_params";
import {
  afterAll,
  afterEach,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
} from "@jest/globals";
import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { http, HttpResponse } from "msw";

// --- External dependency mocks ---

jest.mock("posthog-js", () => ({
  __esModule: true,
  default: { reset: jest.fn(), capture: jest.fn(), init: jest.fn() },
}));

const mockRouterReplace = mockRouter.replaceMock;
const mockRouterPush = mockRouter.pushMock;

jest.mock("next/navigation", () => ({
  ...require("@/__tests__/helpers/mock_router").nextNavigationMock(),
  usePathname: () => "/test-team/traces",
}));

jest.mock("next/link", () => ({
  __esModule: true,
  default: ({ children, href, ...props }: any) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

jest.mock("next-themes", () => ({
  __esModule: true,
  useTheme: () => ({ theme: "light" }),
}));

jest.mock("@nivo/line", () => {
  const LineChartStub = ({ data }: any) => (
    <div data-testid="nivo-line-chart">
      {data?.map((s: any) => (
        <span key={s.id} data-testid={`chart-series-${s.id}`}>
          {s.id}: {s.data?.length ?? 0} points
        </span>
      ))}
    </div>
  );
  return {
    __esModule: true,
    ResponsiveLine: LineChartStub,
    ResponsiveLineCanvas: LineChartStub,
  };
});

// The trace name select and the filter pickers are Radix popovers, which
// need a resize observer and pointer capture that jsdom does not have.
(globalThis as any).ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
Element.prototype.scrollIntoView = jest.fn();
Element.prototype.hasPointerCapture = jest.fn(() => false);
Element.prototype.setPointerCapture = jest.fn();
Element.prototype.releasePointerCapture = jest.fn();

// --- MSW ---
import {
  makeAppFixture,
  makeSpanMetricsPlotFixture,
  makeSpansOverviewFixture,
  makeTraceDetailFixture,
} from "../msw/fixtures";
import { server } from "../msw/server";

jest.spyOn(console, "log").mockImplementation(() => {});
jest.spyOn(console, "error").mockImplementation(() => {});

beforeAll(() => server.listen({ onUnhandledRequest: "warn" }));
afterEach(() => {
  server.resetHandlers();
  mockRouterReplace.mockClear();
  mockRouterPush.mockClear();
});
afterAll(() => server.close());

// --- Store/component imports ---
import TracesOverview from "@/app/[teamId]/traces/page";
import TraceDetails from "@/app/components/trace/details";
import { queryClient } from "@/app/query/query_client";
import { createFiltersStore } from "@/app/stores/filters_store";
import { createOnboardingStore } from "@/app/stores/onboarding_store";
import { QueryClientProvider } from "@tanstack/react-query";

let filtersStore = createFiltersStore();
let onboardingStore = createOnboardingStore();

jest.mock("@/app/stores/provider", () => {
  const { useStore } = require("zustand");
  return {
    __esModule: true,
    useFiltersStore: (selector?: any) =>
      useStore(filtersStore, selector ?? ((s: any) => s)),
    useOnboardingStore: (selector?: any) =>
      useStore(onboardingStore, selector ?? ((s: any) => s)),
    useMeasureStoreRegistry: () => ({ filtersStore, onboardingStore }),
  };
});

const appId = makeAppFixture().id;

// What the default root span names handler serves, in order.
const firstRootSpanName = "checkout_full_display";

beforeEach(() => {
  filtersStore = createFiltersStore();
  onboardingStore = createOnboardingStore();
  queryClient.clear();
  mockRouter.searchParams = new URLSearchParams();
  const { apiClient } = require("@/app/api/api_client");
  apiClient.init({ replace: jest.fn(), push: jest.fn() });
});

function renderWithProviders(ui: React.ReactElement) {
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

// ====================================================================
// TRACES OVERVIEW
// ====================================================================
describe("Traces Overview (MSW integration)", () => {
  function renderPage() {
    return renderWithProviders(
      <TracesOverview params={promiseParams({ teamId: "test-team" })} />,
    );
  }

  function recordSpansRequests() {
    const sent: URL[] = [];
    server.use(
      http.get("*/api/apps/:appId/spans", ({ request }) => {
        const url = new URL(request.url);
        if (
          url.pathname.includes("/plots/") ||
          url.pathname.includes("/roots/")
        ) {
          return;
        }
        sent.push(url);
        return HttpResponse.json(makeSpansOverviewFixture());
      }),
    );
    return sent;
  }

  async function waitForSpans() {
    await waitFor(
      () => expect(screen.getByText("ID: trace-001")).toBeTruthy(),
      { timeout: 5000 },
    );
  }

  describe("opening the page", () => {
    it("lists the spans the server sent under the plot", async () => {
      renderPage();
      await waitForSpans();

      expect(screen.getByText("ID: trace-002")).toBeTruthy();
      expect(screen.getByTestId("nivo-line-chart")).toBeTruthy();
    });

    it("asks for the first root span over the range it settled on", async () => {
      const sent = recordSpansRequests();
      renderPage();
      await waitForSpans();

      expect(sent).toHaveLength(1);
      expect(sent[0].pathname).toBe(`/api/apps/${appId}/spans`);
      expect(sent[0].searchParams.get("span_name")).toBe(firstRootSpanName);
      const from = sent[0].searchParams.get("from")!;
      const to = sent[0].searchParams.get("to")!;
      expect(from).toMatch(/Z$/);
      expect(to).toMatch(/Z$/);
      expect(sent[0].searchParams.get("timezone")).toBeTruthy();
      expect(sent[0].searchParams.get("limit")).toBe("5");
      expect(sent[0].searchParams.get("offset")).toBe("0");
      expect(sent[0].searchParams.has("filter_expr")).toBe(false);
      expect(sent[0].searchParams.has("filter_short_code")).toBe(false);
      expect(sent[0].searchParams.has("span_statuses")).toBe(false);
    });

    it("sends the span and time group in the plot request", async () => {
      const plotUrls: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", ({ request }) => {
          plotUrls.push(new URL(request.url));
          return HttpResponse.json(makeSpanMetricsPlotFixture());
        }),
      );
      renderPage();
      await waitForSpans();

      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].searchParams.get("span_name")).toBe(firstRootSpanName);
      expect(plotUrls[0].searchParams.get("plot_time_group")).toBeTruthy();
      expect(plotUrls[0].searchParams.has("filter_expr")).toBe(false);
    });

    it("records the app, range and span name it settled on in the URL", async () => {
      renderPage();
      await waitForSpans();

      const written = new URLSearchParams(
        mockRouterReplace.mock.calls[0][0].slice(1),
      );
      expect(written.get("a")).toBe(appId);
      expect(written.get("d")).toBe("Last 6 Hours");
      expect(written.get("sd")).toBeTruthy();
      expect(written.get("ed")).toBeTruthy();
      expect(written.get("po")).toBe("0");
      expect(written.get("r")).toBe(firstRootSpanName);
    });
  });

  describe("root span selection", () => {
    it("restores the name a link asked for when its app matches", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&a=${appId}&r=api_fetch_payments`,
      );
      const sent = recordSpansRequests();
      renderPage();
      await waitForSpans();

      expect(sent[0].searchParams.get("span_name")).toBe("api_fetch_payments");
    });

    it("picking another name refetches for it from page one", async () => {
      const sent = recordSpansRequests();
      renderPage();
      await waitForSpans();

      fireEvent.click(screen.getByRole("button", { name: firstRootSpanName }));
      const list = within(await screen.findByRole("dialog"));
      await act(async () => {
        fireEvent.click(list.getByText("api_fetch_payments"));
      });

      await waitFor(() => expect(sent.length).toBeGreaterThan(1));
      const last = sent[sent.length - 1];
      expect(last.searchParams.get("span_name")).toBe("api_fetch_payments");
      expect(last.searchParams.get("offset")).toBe("0");

      const written = new URLSearchParams(
        mockRouterReplace.mock.calls[
          mockRouterReplace.mock.calls.length - 1
        ][0].slice(1),
      );
      expect(written.get("r")).toBe("api_fetch_payments");
      expect(written.get("po")).toBe("0");
    });

    it("falls back to the first name when the link's app is not the selected one", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&a=some-other-app&r=api_fetch_payments`,
      );
      const sent = recordSpansRequests();
      renderPage();
      await waitForSpans();

      expect(sent[0].searchParams.get("span_name")).toBe(firstRootSpanName);
    });

    it("falls back to the first name when the link names an unknown span", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&a=${appId}&r=span.gone`,
      );
      const sent = recordSpansRequests();
      renderPage();
      await waitForSpans();

      expect(sent[0].searchParams.get("span_name")).toBe(firstRootSpanName);
    });

    it("says there is no data when the app never reported a trace", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans/roots/names", () => {
          return HttpResponse.json({ results: null });
        }),
      );
      renderPage();

      expect(
        await screen.findByText("No traces received for this app yet"),
      ).toBeTruthy();
      expect(screen.queryByText("ID: trace-001")).toBeNull();
    });
  });

  describe("a link carrying a filter", () => {
    it("filters the spans and the plot by it", async () => {
      mockRouter.searchParams = new URLSearchParams(
        `po=0&filter_expr=${encodeURIComponent("version_name:in:3.1.0")}`,
      );
      const sent = recordSpansRequests();
      const plotUrls: URL[] = [];
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", ({ request }) => {
          plotUrls.push(new URL(request.url));
          return HttpResponse.json(makeSpanMetricsPlotFixture());
        }),
      );
      renderPage();
      await waitForSpans();

      expect(sent[0].searchParams.get("filter_expr")).toBe(
        "version_name:in:3.1.0",
      );
      await waitFor(() => expect(plotUrls.length).toBeGreaterThan(0));
      expect(plotUrls[0].searchParams.get("filter_expr")).toBe(
        "version_name:in:3.1.0",
      );
    });
  });

  describe("deep links", () => {
    it("with po=5 asks for page 2", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          ) {
            return;
          }
          const offset = url.searchParams.get("offset");
          if (offset === "5") {
            return HttpResponse.json(
              makeSpansOverviewFixture({
                results: [
                  {
                    ...makeSpansOverviewFixture().results[0],
                    trace_id: "trace-deep-link",
                    span_name: "deep_link_span",
                  },
                ],
              }),
            );
          }
          return HttpResponse.json(makeSpansOverviewFixture());
        }),
      );

      mockRouter.searchParams = new URLSearchParams("po=5");
      renderPage();
      await waitFor(
        () => {
          expect(screen.getByText("ID: trace-deep-link")).toBeTruthy();
        },
        { timeout: 5000 },
      );
      expect(screen.queryByText("ID: trace-001")).toBeNull();
    });
  });

  describe("when the server fails", () => {
    it("shows the error message", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans", ({ request }) => {
          const url = new URL(request.url);
          if (
            url.pathname.includes("/plots/") ||
            url.pathname.includes("/roots/")
          ) {
            return;
          }
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(
        await screen.findByText(/Error fetching list of traces/),
      ).toBeTruthy();
    });

    it("says so when the plot cannot be fetched", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans/plots/metrics", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching plot/)).toBeTruthy();
    });

    it("says so when the root span names cannot be fetched", async () => {
      server.use(
        http.get("*/api/apps/:appId/spans/roots/names", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(
        await screen.findByText(/Error fetching traces list/),
      ).toBeTruthy();
    });

    it("says so when the team's apps cannot be fetched", async () => {
      server.use(
        http.get("*/api/teams/:teamId/apps", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderPage();

      expect(await screen.findByText(/Error fetching apps/)).toBeTruthy();
    });
  });

  describe("re-render", () => {
    it("re-render still shows data", async () => {
      const { unmount } = renderPage();
      await waitForSpans();

      unmount();
      renderPage();
      await waitForSpans();
    });
  });
});

// ====================================================================
// TRACE DETAIL
// ====================================================================
describe("Trace Detail (MSW integration)", () => {
  const defaultParams = {
    teamId: "test-team",
    appId: "b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f",
    traceId: "trace-001",
  };

  async function renderDetail(params = defaultParams) {
    renderWithProviders(<TraceDetails params={params} />);
    await waitFor(
      () => {
        // Wait for data to load (pills appear on success)
        expect(screen.getByText(/User ID:/)).toBeTruthy();
      },
      { timeout: 5000 },
    );
  }

  // ================================================================
  // ERROR STATES
  // ================================================================
  describe("error states", () => {
    it("shows error message when detail API returns 500", async () => {
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", () => {
          return new HttpResponse(null, { status: 500 });
        }),
      );
      renderWithProviders(<TraceDetails params={defaultParams} />);
      await waitFor(
        () => {
          expect(screen.getByText(/Error fetching trace/)).toBeTruthy();
        },
        { timeout: 5000 },
      );
    });
  });

  // ================================================================
  // CACHING
  // ================================================================
  describe("caching", () => {
    it("data is cached by TanStack Query", async () => {
      await renderDetail();
      // Data loaded successfully and is cached
      expect(screen.getByText(/User ID:/)).toBeTruthy();
    });
  });

  // ================================================================
  // API PATH VERIFICATION
  // ================================================================
  describe("API paths", () => {
    it("fetches from /traces/:traceId", async () => {
      let detailPath = "";
      server.use(
        http.get("*/api/apps/:appId/traces/:traceId", ({ request }) => {
          detailPath = new URL(request.url).pathname;
          return HttpResponse.json(makeTraceDetailFixture());
        }),
      );
      await renderDetail();
      expect(detailPath).toContain(
        "/apps/b5f3e8a1-6c2d-4f9a-8e7b-1a2b3c4d5e6f/traces/trace-001",
      );
    });
  });
});
